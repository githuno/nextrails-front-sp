import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { z } from "zod"
import { cameraActions, type CameraExternalActions, SavedFileResult } from "../camera/cameraStore"
import { microphoneActions } from "../microphone/microphoneStore"
import { useExternalStore } from "./atoms/useExternalStore"
import { capturedFiles } from "./db/pgliteSchema"
import { idbStore } from "./db/useIdbStore"
import { getDb, subscribe as subscribePglite } from "./db/usePgliteStore"
import { getSessionState, sessionStore } from "./useSessionSync"

/**
 * 型定義
 */
const RawSetInfoSchema = z.object({
  name: z.string(),
  count: z.number(),
  latest_idb_key: z.string().nullable(),
})

export interface ToolFile {
  id: string
  sessionId: string
  fileName: string
  mimeType: string
  size: number
  idbKey: string
  createdAt: Date
  url: string | null
  isPending?: boolean
}

export interface FileSetInfo {
  name: string
  latestImageUrl: string | null
  count: number
  latestIdbKey: string | null
}

interface RawSetInfo {
  name: string
  count: number
  latest_idb_key: string | null
}

interface PendingSave {
  id: string
  file: Blob | File
  options?: { fileName?: string }
  resolve: (value: SavedFileResult) => void
  reject: (reason?: unknown) => void
}

/**
 * アクションの型定義
 */
export interface ToolActions extends Required<CameraExternalActions> {
  addPreviewFile: (url: string) => string
  handleScan: (data: string) => void
  switchFileSet: (fileSet: string) => void
  closeWebView: () => void
  setCameraOpen: (isOpen: boolean) => void
  setMicrophoneOpen: (isOpen: boolean) => void
  addFiles: (files: FileList | File[]) => void
  handleSelect: (fileInputRef: React.RefObject<HTMLInputElement | null>) => void
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  deleteFiles: (items: { idbKey: string; id: string }[]) => Promise<void>
}

export interface ToolActionState {
  isReady: boolean // actionsの準備状態
  isDbReady: boolean // DBの準備状態
  files: ToolFile[]
  fileSets: string[]
  fileSetInfo: FileSetInfo[]
  currentFileSet: string
  isCameraOpen: boolean
  isMicrophoneOpen: boolean
  isWebViewOpen: boolean
  webUrl: string
  error: Error | null
  pendingSaves: PendingSave[]
  syncStatus: "idle" | "buffering" | "syncing" | "error"
}

/**
 * シングルトンとしてのStore実装
 * Reactの外で状態を保持し、副作用（データロードやアクション注入）を中央管理する
 */
let state: ToolActionState = {
  isReady: false,
  isDbReady: false, // DBの準備状態
  files: [],
  fileSets: ["1"],
  fileSetInfo: [],
  currentFileSet: "1",
  isCameraOpen: false,
  isMicrophoneOpen: false,
  isWebViewOpen: false,
  webUrl: "",
  error: null,
  pendingSaves: [],
  syncStatus: "idle",
}

const listeners = new Set<() => void>()
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const notify = () => {
  listeners.forEach((l) => l())
}

const getSnapshot = () => state

/**
 * プレビューURLのリソース解放
 */
const revokeUrls = (files: ToolFile[], setInfos: FileSetInfo[] = []) => {
  files.forEach((f) => {
    if (f.url?.startsWith("blob:")) URL.revokeObjectURL(f.url)
  })
  setInfos.forEach((s) => {
    if (s.latestImageUrl?.startsWith("blob:")) URL.revokeObjectURL(s.latestImageUrl)
  })
}

/**
 * データの自動ロードとアクションの依存注入
 * DBの初期化をトリガーに実行される
 */
let isSyncing = false
let needsSync = false

async function syncData() {
  if (isSyncing) {
    needsSync = true
    return
  }
  isSyncing = true

  try {
    const idb = idbStore()

    let shouldSync = true
    while (shouldSync) {
      shouldSync = false
      needsSync = false

      const db = await getDb()
      const initialSessionID = getSessionState()?.currentId || "default"
      const initialFileSet = state.currentFileSet

      // 0. バッファされた保存を処理 (セッションやセットが確定してから保存し、その結果もメタデータ取得に含める)
      if (state.pendingSaves.length > 0) {
        const queue = [...state.pendingSaves]
        state = { ...state, pendingSaves: [], syncStatus: "syncing" }
        notify()
        try {
          for (const pending of queue) {
            const fileName = pending.options?.fileName || `captured_${Date.now()}`
            const [inserted] = await db
              .insert(capturedFiles)
              .values({
                sessionId: initialSessionID,
                fileSet: initialFileSet,
                fileName,
                mimeType: pending.file.type,
                size: pending.file.size,
                idbKey: pending.id,
              })
              .returning()
            pending.resolve(inserted)
          }
          state = { ...state, syncStatus: "idle" }
        } catch (error) {
          state = { ...state, syncStatus: "error" }
          queue.forEach((p) => p.reject(error))
        }
        notify()
      }

      // 1. セッション内の全ファイルセット情報を取得 (メタデータ: カウントと最新プレビュー)
      // PGlite (Postgres) の ARRAY_AGG を使用して最新の idbKey を取得
      const res = await db
        .select({
          name: capturedFiles.fileSet,
          count: sql<number>`count(*)::int`,
          latest_idb_key: sql<
            string | null
          >`(array_agg(${capturedFiles.idbKey} order by ${capturedFiles.createdAt} desc))[1]`,
        })
        .from(capturedFiles)
        .where(eq(capturedFiles.sessionId, initialSessionID))
        .groupBy(capturedFiles.fileSet)

      // Zodにより実行時型安全性を確保。不正なデータは例外をスローして早期終了させる
      const rawSetInfos: RawSetInfo[] = z.array(RawSetInfoSchema).parse(res)
      const fileSetNameList = Array.from(new Set([...rawSetInfos.map((s) => s.name), state.currentFileSet])).sort()
      const existingSetInfoMap = new Map(state.fileSetInfo.map((s) => [s.name, s]))

      const fileSetInfo: FileSetInfo[] = await Promise.all(
        fileSetNameList.map(async (name) => {
          const info = rawSetInfos.find((s) => s.name === name)
          const latestIdbKey = info?.latest_idb_key || null
          // 前回の情報を再利用して、Blobの読み込みとURL生成を最小限にする
          const existing = existingSetInfoMap.get(name)
          if (existing && existing.latestIdbKey === latestIdbKey && existing.count === (info?.count || 0)) {
            return existing
          }
          // 新規、または変更があった場合
          let latestImageUrl = null
          if (latestIdbKey) {
            const blob = await idb.get(latestIdbKey)
            if (blob) latestImageUrl = URL.createObjectURL(blob)
          }
          // 古いUrlはあとで一括で解放される
          return {
            name,
            count: info?.count || 0,
            latestImageUrl,
            latestIdbKey,
          }
        }),
      )

      // 2. 現在のファイルセットのメタデータを取得
      const records = await db
        .select()
        .from(capturedFiles)
        .where(and(eq(capturedFiles.sessionId, initialSessionID), eq(capturedFiles.fileSet, state.currentFileSet)))
        .orderBy(desc(capturedFiles.createdAt))

      // 3. 状態更新
      const existingFileMap = new Map(state.files.map((f) => [f.idbKey, f]))
      const newFiles: ToolFile[] = records.map((r) => {
        const existingFile = existingFileMap.get(r.idbKey)
        return {
          ...r,
          url: existingFile?.url || null,
        } as ToolFile
      })

      // 重複を避けるため、DBにあるデータ（newFiles）のidbKeyセットを作成
      const dbIdbKeys = new Set(newFiles.map((f) => f.idbKey))

      // 現在のstate.filesから、まだDBに存在しない（pendingな）ファイルのみを抽出
      const pendingFiles = state.files.filter((f) => f.isPending && !dbIdbKeys.has(f.idbKey))

      // URLのリソース管理：消えるファイル（pendingでもない、newFilesでもない）のURLを解放
      const nextFiles = [...pendingFiles, ...newFiles]
      const nextIdbKeys = new Set(nextFiles.map((f) => f.idbKey))

      // 解放対象の算出
      const filesToRevoke = state.files.filter((f) => !nextIdbKeys.has(f.idbKey))
      const setsToRevoke = state.fileSetInfo.filter((s) => {
        const next = fileSetInfo.find((ns) => ns.name === s.name)
        return !next || (next.latestImageUrl !== s.latestImageUrl && s.latestImageUrl?.startsWith("blob:"))
      })

      revokeUrls(filesToRevoke, setsToRevoke)

      state = {
        ...state,
        files: nextFiles,
        fileSets: fileSetNameList,
        fileSetInfo,
        isDbReady: true,
        error: null,
      }
      notify()

      // 4. 未取得のURLをバックグラウンドで逐次ロードする
      const filesWithoutUrl = nextFiles.filter((f) => !f.url)
      if (filesWithoutUrl.length > 0) {
        const CHUNK_SIZE = 5
        for (let i = 0; i < filesWithoutUrl.length; i += CHUNK_SIZE) {
          const chunk = filesWithoutUrl.slice(i, i + CHUNK_SIZE)
          const updatedChunk = await Promise.all(
            chunk.map(async (f) => {
              const blob = await idb.get(f.idbKey)
              return { ...f, url: blob ? URL.createObjectURL(blob) : null }
            }),
          )
          const updatedMap = new Map(updatedChunk.map((up) => [up.idbKey, up]))
          state = {
            ...state,
            files: state.files.map((f) => {
              const updated = updatedMap.get(f.idbKey)
              return updated || f
            }),
          }
          notify()
          if (needsSync) break
        }
      }

      // 外部からの割り込み、あるいは同期処理中にセッションやファイルセットが変更された場合は、再度ループする
      const latestSessionID = getSessionState()?.currentId || "default"
      if (needsSync || latestSessionID !== initialSessionID || state.currentFileSet !== initialFileSet) {
        shouldSync = true
      }
    }

    notify()
  } catch (err) {
    console.error("[ToolActionStore] syncData error:", err)
    state = {
      ...state,
      error: err instanceof Error ? err : new Error(String(err)),
    }
    notify()
  } finally {
    isSyncing = false
  }
}

/**
 * 外から呼び出すアクション
 */
export const actions: ToolActions = {
  /**
   * 撮影・選択されたファイルを保存する
   */
  saveCapturedFile: async (
    file: Blob | File,
    options?: { fileName?: string; idbKey?: string },
  ): Promise<SavedFileResult> => {
    const idb = idbStore()
    const idbKey = options?.idbKey || crypto.randomUUID()

    // 1. 最適化UI更新 (Reflection fix)
    // すでに addPreviewFile で追加されている場合はスキップまたは更新
    const existingIndex = state.files.findIndex((f) => f.idbKey === idbKey)
    if (existingIndex === -1) {
      const tempUrl = URL.createObjectURL(file)
      const tempFile: ToolFile = {
        id: idbKey,
        sessionId: getSessionState()?.currentId || "default",
        fileName: options?.fileName || `captured_${Date.now()}`,
        mimeType: file.type,
        size: file.size,
        idbKey,
        createdAt: new Date(),
        url: tempUrl,
        isPending: true,
      }
      state = {
        ...state,
        files: [tempFile, ...state.files],
      }
      notify()
    } else {
      // 既存のプレビューがあればフラグ等を維持しつつURLだけBlob URLに差し替え
      const oldFile = state.files[existingIndex]
      const tempUrl = URL.createObjectURL(file)

      // 重要：以前のURLがBlob URL（DataURL等ではない）ならメモリリーク防止のために解放
      if (oldFile.url?.startsWith("blob:")) {
        URL.revokeObjectURL(oldFile.url)
      }

      state = {
        ...state,
        files: state.files.map((f, i) =>
          i === existingIndex ? { ...f, url: tempUrl, size: file.size, isPending: true } : f,
        ),
      }
      notify()
    }
    const MAX_BUFFER_SIZE = 50
    if (state.pendingSaves.length >= MAX_BUFFER_SIZE) {
      throw new Error("Buffer full, cannot save more files")
    }
    try {
      // 2. IDB保存 (Background)
      await idb.put(idbKey, file)
      if (state.isDbReady) {
        // PGliteがreadyなら非同期でDB保存
        const saveToDb = async () => {
          try {
            const db = await getDb()
            const sessionID = getSessionState()?.currentId || "default"
            const fileName = options?.fileName || `captured_${Date.now()}`
            const [inserted] = await db
              .insert(capturedFiles)
              .values({
                sessionId: sessionID,
                fileSet: state.currentFileSet,
                fileName,
                mimeType: file.type,
                size: file.size,
                idbKey,
              })
              .returning()
            // 状態を再同期
            await syncData()
            return inserted
          } catch (e) {
            console.error("[ToolActionStore] Async save failed:", e)
            await syncData()
            throw e
          }
        }

        void saveToDb()
        return { id: idbKey, idbKey }
      } else {
        // バッファに追加
        state = {
          ...state,
          syncStatus: "buffering",
        }
        notify()

        return new Promise<SavedFileResult>((resolve, reject) => {
          state.pendingSaves.push({
            id: idbKey,
            file,
            options,
            resolve,
            reject,
          })
          notify()
        })
      }
    } catch (error) {
      await idb.remove(idbKey).catch(() => {})
      // 失敗時はUIからも消す
      state = {
        ...state,
        files: state.files.filter((f) => f.idbKey !== idbKey),
      }
      notify()
      throw new Error("Failed to save captured file", { cause: error })
    }
  },

  /**
   * プレビュー（DataURL）を即座にUIに反映する
   */
  addPreviewFile: (url: string): string => {
    const tempId = crypto.randomUUID()
    const tempFile: ToolFile = {
      id: tempId,
      sessionId: getSessionState()?.currentId || "default",
      fileName: `capturing_${Date.now()}`,
      mimeType: "image/jpeg",
      size: 0,
      idbKey: tempId,
      createdAt: new Date(),
      url: url, // DataURL
      isPending: true,
    }
    state = {
      ...state,
      files: [tempFile, ...state.files],
    }
    notify()
    return tempId
  },

  /**
   * ファイルを削除する
   */
  deleteFile: async (idbKey: string, dbId: string): Promise<void> => {
    return actions.deleteFiles([{ idbKey, id: dbId }])
  },

  /**
   * 複数のファイルを一括削除する
   */
  deleteFiles: async (items: { idbKey: string; id: string }[]): Promise<void> => {
    if (items.length === 0) return
    const idbKeysToRemove = new Set(items.map((i) => i.idbKey))
    // 1. 最適化UI更新: 即座にメモリから消して再描画
    // これにより、重いDB処理を待たずにサムネイルが消える
    state = {
      ...state,
      files: state.files.filter((f) => !idbKeysToRemove.has(f.idbKey)),
    }
    notify()
    // 2. バックグラウンドで残りの処理を行う
    // async関数自体は即座に終了する（awaitしない）
    const processDeletion = async () => {
      const db = await getDb()
      const idb = idbStore()
      try {
        const validDbIds = items.map((i) => i.id).filter((id) => id && id.length > 10)
        if (validDbIds.length > 0) {
          await db.delete(capturedFiles).where(inArray(capturedFiles.id, validDbIds))
        }
        // IndexedDBから削除 (並列実行)
        await Promise.all(items.map((item) => idb.remove(item.idbKey)))
        // 最後に一回だけデータを同期して整合性を確定させる
        await syncData()
      } catch (error) {
        console.error("[ToolActionStore] Background delete failed:", error)
        await syncData() // 復旧のために再読み込み
      }
    }
    // 非同期で実行し、この関数自体はすぐにリターンする
    void processDeletion()
  },

  /**
   * IDBからBlobのURLを取得するのみ
   */
  getFileWithUrl: async (idbKey: string): Promise<string | null> => {
    const idb = idbStore()
    const blob = await idb.get(idbKey)
    return blob ? URL.createObjectURL(blob) : null
  },

  /**
   * スキャンの処理
   */
  handleScan: (data: string): void => {
    try {
      const url = new URL(data)
      if (url.protocol === "http:" || url.protocol === "https:") {
        state = {
          ...state,
          webUrl: data,
          isWebViewOpen: true,
        }
      } else {
        alert(`Detected: ${data}`)
      }
    } catch {
      alert(`Detected text: ${data}`)
    }
    notify()
  },

  /**
   * ファイルセットを切り替える
   */
  switchFileSet: (fileSet: string): void => {
    // 即座に既存のファイルをクリアしてUIフィードバックを出す
    revokeUrls(state.files, state.fileSetInfo)
    state = {
      ...state,
      currentFileSet: fileSet,
      files: [],
    }
    notify()
    syncData()
  },

  /**
   * UI状態のリセット
   */
  closeWebView: (): void => {
    state = {
      ...state,
      isWebViewOpen: false,
      webUrl: "",
    }
    notify()
  },

  setCameraOpen: (isOpen: boolean): void => {
    state = {
      ...state,
      isCameraOpen: isOpen,
    }
    notify()
  },

  setMicrophoneOpen: (isOpen: boolean): void => {
    state = {
      ...state,
      isMicrophoneOpen: isOpen,
    }
    notify()
  },

  /**
   * ファイル選択時の処理（UIから渡されたFile集を直接保存）
   */
  addFiles: (files: FileList | File[]): void => {
    Array.from(files).forEach((file) => {
      actions.saveCapturedFile(file)
    })
  },

  /**
   * ファイル選択ダイアログを開く
   */
  handleSelect: (fileInputRef: React.RefObject<HTMLInputElement | null>): void => {
    fileInputRef?.current?.click()
  },

  /**
   * ファイル変更時の処理
   */
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>): void => {
    const files = event.target.files
    if (!files || files.length === 0) return
    actions.addFiles(files)
    // 同じファイルを再度選択できるようにinputをリセットする
    event.target.value = ""
  },
}

if (typeof window !== "undefined") {
  // PGliteの準備が整う前でも、基本的なアクションは登録しておく
  cameraActions.setExternalActions({
    saveCapturedFile: actions.saveCapturedFile,
    getFileWithUrl: actions.getFileWithUrl,
    deleteFile: actions.deleteFile,
  })
  microphoneActions.setExternalActions({
    saveRecordedAudio: actions.saveCapturedFile,
    getFileWithUrl: actions.getFileWithUrl,
    deleteFile: actions.deleteFile,
  })
  state = { ...state, isReady: true }
  notify()

  // PGliteの準備が整ったら自動で同期を開始
  subscribePglite(() => {
    if (!state.isDbReady) syncData()
  })
  // セッションが変更された場合も再同期する
  sessionStore.subscribe(() => {
    syncData()
  })
  // 初期化キック: すでに準備ができている場合も同期を開始するようにする
  const initStore = async () => {
    try {
      const db = await getDb()
      if (db && !state.isDbReady) {
        await syncData()
      }
    } catch (err) {
      console.error("[ToolActionStore] Initial DB kick failed:", err)
    }
  }
  initStore()
}

/**
 * UIから利用するHook
 */
export function useToolActionStore<T = ToolActionState & ToolActions>(
  selector?: (state: ToolActionState & ToolActions) => T,
): T {
  const storeState: ToolActionState = useExternalStore({
    subscribe,
    getSnapshot,
    getServerSnapshot: getSnapshot,
  })
  const full: ToolActionState & ToolActions = { ...storeState, ...actions }
  return selector ? selector(full) : (full as unknown as T)
}
