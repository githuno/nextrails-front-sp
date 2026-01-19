import { and, desc, eq, sql } from "drizzle-orm"
import { z } from "zod"
import { cameraActions, type CameraExternalActions, SavedFileResult } from "../camera/cameraStore"
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
  handleScan: (data: string) => void
  switchFileSet: (fileSet: string) => void
  closeWebView: () => void
  setCameraOpen: (isOpen: boolean) => void
  addFiles: (files: FileList | File[]) => void
  handleSelect: (fileInputRef: React.RefObject<HTMLInputElement | null>) => void
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void
}

interface ToolActionState {
  isReady: boolean // actionsの準備状態
  isDbReady: boolean // DBの準備状態
  files: ToolFile[]
  fileSets: string[]
  fileSetInfo: FileSetInfo[]
  currentFileSet: string
  isCameraOpen: boolean
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
  isWebViewOpen: false,
  webUrl: "",
  error: null,
  pendingSaves: [],
  syncStatus: "idle",
}

const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const notify = () => {
  listeners.forEach((l) => l())
}

/**
 * cameraStoreの表示用データを更新
 */
const updateCameraStoreImages = () => {
  if (typeof window === "undefined") return
  cameraActions.setCapturedImages(
    state.files
      .filter((f) => !!f.url)
      .map((f) => ({
        url: f.url!,
        idbKey: f.idbKey,
        dbId: f.id,
        isPending: f.isPending,
      })),
  )
}

const getSnapshot = () => state

/**
 * プレビューURLのリソース解放
 */
const revokeUrls = (files: ToolFile[], setInfos: FileSetInfo[] = []) => {
  files.forEach((f) => {
    if (f.url) URL.revokeObjectURL(f.url)
  })
  setInfos.forEach((s) => {
    if (s.latestImageUrl) URL.revokeObjectURL(s.latestImageUrl)
  })
}

/**
 * データの自動ロードとアクションの依存注入
 * DBの初期化をトリガーに実行される
 */
let isSyncing = false
async function syncData() {
  if (isSyncing) return
  isSyncing = true
  try {
    const db = await getDb()
    const idb = idbStore()

    // 蓄積された保存や最新状態の取得を、キューがなくなるまで繰り返す
    let hasProcessedQueue = true
    while (hasProcessedQueue) {
      hasProcessedQueue = false
      const sessionID = getSessionState()?.currentId || "default"

      // 1. セッション内の全ファイルセット情報を取得 (メタデータ: カウントと最新プレビュー)
      // PGlite (Postgres) の ARRAY_AGG を使用して最新の idbKey を取得
      const res = await db.execute(
        sql`SELECT 
           file_set as name, 
           COUNT(*)::int as count, 
           (ARRAY_AGG(idb_key ORDER BY created_at DESC))[1] as latest_idb_key 
         FROM ${capturedFiles} 
         WHERE ${capturedFiles.sessionId} = ${sessionID}
         GROUP BY file_set`,
      )

      // Zodにより実行時型安全性を確保。不正なデータは例外をスローして早期終了させる（AGENTS.md方針）
      const rawSetInfos: RawSetInfo[] = z.array(RawSetInfoSchema).parse(res.rows)
      const fileSetNameList = Array.from(new Set([...rawSetInfos.map((s) => s.name), state.currentFileSet])).sort()

      const fileSetInfo: FileSetInfo[] = await Promise.all(
        fileSetNameList.map(async (name) => {
          const info = rawSetInfos.find((s) => s.name === name)
          const idbKey = info?.latest_idb_key
          let latestImageUrl = null
          if (idbKey) {
            const blob = await idb.get(idbKey)
            if (blob) latestImageUrl = URL.createObjectURL(blob)
          }
          return {
            name,
            count: info?.count || 0,
            latestImageUrl,
          }
        }),
      )

      // 2. 現在のファイルセットのメタデータを取得
      const records = await db
        .select()
        .from(capturedFiles)
        .where(and(eq(capturedFiles.sessionId, sessionID), eq(capturedFiles.fileSet, state.currentFileSet)))
        .orderBy(desc(capturedFiles.createdAt))

      // 3. プレビューURLの生成と状態更新（既存URLを再利用してパフォーマンス向上）
      const newFiles: ToolFile[] = await Promise.all(
        records.map(async (r) => {
          const existingFile = state.files.find((f) => f.idbKey === r.idbKey)
          if (existingFile?.url) {
            return { ...r, url: existingFile.url } as ToolFile
          }
          const blob = await idb.get(r.idbKey)
          const url = blob ? URL.createObjectURL(blob) : null
          return { ...r, url } as ToolFile
        }),
      )

      // 重複を避けるため、DBにあるデータ（newFiles）のidbKeyセットを作成
      const dbIdbKeys = new Set(newFiles.map((f) => f.idbKey))

      // 現在のstate.filesから、まだDBに存在しない（pendingな）ファイルのみを抽出
      const pendingFiles = state.files.filter((f) => f.isPending && !dbIdbKeys.has(f.idbKey))

      // URLのリソース管理：消えるファイル（pendingでもない、newFilesでもない）のURLを解放
      const nextFiles = [...pendingFiles, ...newFiles]
      const nextIdbKeys = new Set(nextFiles.map((f) => f.idbKey))
      const filesToRevoke = state.files.filter((f) => !nextIdbKeys.has(f.idbKey))

      // 前回の fileSetInfo のUrlも解放対象
      revokeUrls(filesToRevoke, state.fileSetInfo)

      state = {
        ...state,
        files: nextFiles,
        fileSets: fileSetNameList,
        fileSetInfo,
        isDbReady: true, // DBの準備完了
        error: null,
      }
      notify()
      updateCameraStoreImages()

      // 4. バッファされた保存を処理
      if (state.pendingSaves.length > 0) {
        // 処理を開始する前にキューを空出しして多重実行を防止する
        const queue = [...state.pendingSaves]
        state = { ...state, pendingSaves: [], syncStatus: "syncing" }
        notify()

        try {
          for (const pending of queue) {
            const currentSessionID = getSessionState()?.currentId || "default"
            const fileName = pending.options?.fileName || `captured_${Date.now()}`
            const [inserted] = await db
              .insert(capturedFiles)
              .values({
                sessionId: currentSessionID,
                fileSet: state.currentFileSet,
                fileName,
                mimeType: pending.file.type,
                size: pending.file.size,
                idbKey: pending.id,
              })
              .returning()
            pending.resolve(inserted)
          }
          state = { ...state, syncStatus: "idle" }
          hasProcessedQueue = true // 挿入があったので、再度メタデータをリロードする
        } catch (error) {
          state = { ...state, syncStatus: "error" }
          queue.forEach((p) => p.reject(error))
        }
        notify()
      }
    }

    notify()
    // DB同期後にカメラストアの画像を更新
    updateCameraStoreImages()
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
  saveCapturedFile: async (file: Blob | File, options?: { fileName?: string }): Promise<SavedFileResult> => {
    const idb = idbStore()
    const idbKey = crypto.randomUUID()

    // バッファサイズ制限
    const MAX_BUFFER_SIZE = 50
    if (state.pendingSaves.length >= MAX_BUFFER_SIZE) {
      throw new Error("Buffer full, cannot save more files")
    }

    try {
      await idb.put(idbKey, file)

      // 共通の最適化UI更新: まずはpending状態で追加
      const tempUrl = URL.createObjectURL(file)
      const tempFile: ToolFile = {
        id: idbKey, // 一時的なIDとしてidbKeyを使用
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
      updateCameraStoreImages()

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

            // 状態を再同期（これにより pending が正規データに置き換わる）
            await syncData()
            return inserted
          } catch (e) {
            console.error("[ToolActionStore] Async save failed:", e)
            // エラー時はpendingから削除されるよう再読み込み
            await syncData()
            throw e
          }
        }

        void saveToDb() // バックグラウンドでDB保存を開始（待機しない）
        const result: SavedFileResult = {
          id: idbKey, // 即座に返す
          idbKey,
        }
        return result
      } else {
        // バッファに追加（すでに追加済みの tempFile はそのまま活かす）
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
      throw new Error("Failed to save captured file", { cause: error })
    }
  },

  /**
   * ファイルを削除する
   */
  deleteFile: async (idbKey: string, dbId: string): Promise<void> => {
    // 最適化UI更新: 即座に一覧から消す
    state = {
      ...state,
      files: state.files.filter((f) => f.idbKey !== idbKey),
    }
    notify()
    updateCameraStoreImages()

    const db = await getDb()
    const idb = idbStore()
    try {
      if (dbId && dbId !== idbKey) {
        await db.delete(capturedFiles).where(eq(capturedFiles.id, dbId))
      }
      await idb.remove(idbKey)
      await syncData()
    } catch (error) {
      console.error("[ToolActionStore] Delete failed:", error)
      await syncData() // 復旧のために再読み込み
      throw new Error("Failed to delete file", { cause: error })
    }
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
    state = {
      ...state,
      currentFileSet: fileSet,
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
export function useToolActionStore() {
  const store = useExternalStore({
    subscribe,
    getSnapshot,
    getServerSnapshot: getSnapshot,
  })
  return { ...store, ...actions }
}
