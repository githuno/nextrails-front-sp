import { toast } from "@/components/atoms/Toast"
import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { z } from "zod"
import { cameraActions, type CameraExternalActions } from "../camera/cameraStore"
import { microphoneActions, type MicrophoneExternalActions } from "../microphone/microphoneStore"
import { useExternalStore } from "./atoms/useExternalStore"
import { files as filesTable, type ToolFileRecord } from "./db/pgliteSchema"
import { idbStore } from "./db/useIdbStore"
import { getDb, subscribe as subscribePglite } from "./db/usePgliteStore"
import { captureBridge, type BridgeData } from "./useCaptureBridge"
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
  fileSet: string
  category: string | null
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

export interface SavedToolFileResult {
  idbKey: string
  id: string
}

interface RawSetInfo {
  name: string
  count: number
  latest_idb_key: string | null
}

interface PendingSave {
  id: string
  file: Blob | File
  options?: { fileName?: string; category?: string }
  resolve: (value: SavedToolFileResult) => void
  reject: (reason?: unknown) => void
}

/**
 * アクションの型定義
 */
export interface ToolActions extends Required<CameraExternalActions & MicrophoneExternalActions> {
  addPreview: (url: string, category?: string) => string
  handleScan: (data: string) => void
  switchFileSet: (fileSet: string) => void
  closeWebView: () => void
  setActiveTool: (tool: "camera" | "microphone" | null) => void
  addFiles: (files: FileList | File[], category?: string) => void
  handleSelect: (fileInputRef: React.RefObject<HTMLInputElement | null>) => void
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>, category?: string) => void
  deleteFiles: (items: { idbKey: string; id: string }[]) => Promise<void>
  playAudio: () => void
  stopAudio: () => void
  setAudioUrl: (url: string | null) => void
}

export interface ToolActionState {
  isReady: boolean // actionsの準備状態
  isDbReady: boolean // DBの準備状態
  files: ToolFile[]
  cameraFiles: ToolFile[]
  audioFiles: ToolFile[]
  fileSets: string[]
  fileSetInfo: FileSetInfo[]
  currentFileSet: string
  activeTool: "camera" | "microphone" | null
  isWebViewOpen: boolean
  webUrl: string
  error: Error | null
  pendingSaves: PendingSave[]
  syncStatus: "idle" | "buffering" | "syncing" | "error"
}

const initialState: ToolActionState = {
  isReady: false,
  isDbReady: false, // DBの準備状態
  files: [],
  cameraFiles: [],
  audioFiles: [],
  fileSets: ["Default"],
  fileSetInfo: [],
  currentFileSet: "Default",
  activeTool: null,
  isWebViewOpen: false,
  webUrl: "",
  error: null,
  pendingSaves: [],
  syncStatus: "idle",
}

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

type SyncOptions = {
  hydrateUrls?: boolean
}

export type ToolActionStoreInstance = {
  actions: ToolActions
  getState: () => ToolActionState
  subscribe: (listener: () => void) => () => void
  syncData: (options?: SyncOptions) => Promise<void>
  start: () => void
  dispose: () => void
}

export function createToolActionStore(options?: { autoStart?: boolean }): ToolActionStoreInstance {
  let state: ToolActionState = { ...initialState }
  const listeners = new Set<() => void>()
  let disposed = false
  const subscribe = (listener: () => void): (() => void) => {
    if (disposed) return () => {}
    listeners.add(listener)
    return () => listeners.delete(listener)
  }
  const notify = () => {
    if (disposed) return
    listeners.forEach((l) => l())
  }
  const getState = () => state
  let currentAbortController: AbortController | null = null
  let needsSync = false
  let activeSyncPromise: Promise<void> | null = null
  const runSyncData = async (syncOptions: SyncOptions): Promise<void> => {
    if (currentAbortController) currentAbortController.abort()
    currentAbortController = new AbortController()
    const signal = currentAbortController.signal
    const isTeardownLikeError = (error: unknown): boolean => {
      if (disposed) return true
      if (signal.aborted) return true
      const message = error instanceof Error ? error.message : String(error)
      return message.includes("BroadcastChannel") && message.includes("closed")
    }
    try {
      const idb = idbStore()
      let shouldSync = true
      while (shouldSync && !signal.aborted && !disposed) {
        shouldSync = false
        needsSync = false
        const db = await getDb(signal)
        if (signal.aborted || disposed) break
        const initialSessionID = getSessionState()?.currentId || "default"
        const initialFileSet = state.currentFileSet
        // 0. バッファされた保存を処理
        if (state.pendingSaves.length > 0) {
          const queue = [...state.pendingSaves]
          state = { ...state, pendingSaves: [], syncStatus: "syncing" }
          notify()
          try {
            for (const pending of queue) {
              if (signal.aborted || disposed) break
              const fileName = pending.options?.fileName || `file_${Date.now()}`
              const category = pending.options?.category || null
              const [inserted] = await db
                .insert(filesTable)
                .values({
                  sessionId: initialSessionID,
                  fileSet: initialFileSet,
                  category,
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
        if (signal.aborted || disposed) break
        // 1. セッション内の全ファイルセット情報を取得
        let rawSetInfos: RawSetInfo[] = []
        try {
          const res = await db
            .select({
              name: filesTable.fileSet,
              count: sql<number>`count(*)::int`,
              latest_idb_key: sql<
                string | null
              >`(array_agg(${filesTable.idbKey} order by ${filesTable.createdAt} desc))[1]`,
            })
            .from(filesTable)
            .where(eq(filesTable.sessionId, initialSessionID))
            .groupBy(filesTable.fileSet)
          if (signal.aborted || disposed) break
          rawSetInfos = z.array(RawSetInfoSchema).parse(res)
        } catch (error) {
          const BasicSetInfoSchema = z.object({ name: z.string(), count: z.number() })
          const basicRes = await db
            .select({
              name: filesTable.fileSet,
              count: sql<number>`count(*)::int`,
            })
            .from(filesTable)
            .where(eq(filesTable.sessionId, initialSessionID))
            .groupBy(filesTable.fileSet)
          const basicInfos = z.array(BasicSetInfoSchema).parse(basicRes)
          rawSetInfos = await Promise.all(
            basicInfos.map(async (info) => {
              if (signal.aborted || disposed) {
                return { name: info.name, count: info.count, latest_idb_key: null }
              }
              const [latest] = await db
                .select({ idbKey: filesTable.idbKey })
                .from(filesTable)
                .where(and(eq(filesTable.sessionId, initialSessionID), eq(filesTable.fileSet, info.name)))
                .orderBy(desc(filesTable.createdAt))
                .limit(1)
              return {
                name: info.name,
                count: info.count,
                latest_idb_key: latest?.idbKey ?? null,
              }
            }),
          )
          console.warn("[ToolActionStore] fileSet aggregation fallback used:", error)
        }
        const fileSetNameList = Array.from(new Set([...rawSetInfos.map((s) => s.name), state.currentFileSet])).sort()
        const existingSetInfoMap = new Map(state.fileSetInfo.map((s) => [s.name, s]))
        const fileSetInfo: FileSetInfo[] = await Promise.all(
          fileSetNameList.map(async (name) => {
            const info = rawSetInfos.find((s) => s.name === name)
            const latestIdbKey = info?.latest_idb_key || null
            const existing = existingSetInfoMap.get(name)
            if (existing && existing.latestIdbKey === latestIdbKey && existing.count === (info?.count || 0)) {
              return existing
            }
            let latestImageUrl = null
            if (syncOptions.hydrateUrls !== false && latestIdbKey) {
              const blob = await idb.get(latestIdbKey)
              if (blob) latestImageUrl = URL.createObjectURL(blob)
            }
            return {
              name,
              count: info?.count || 0,
              latestImageUrl,
              latestIdbKey,
            }
          }),
        )
        if (signal.aborted || disposed) break
        // 2. データを取得
        const baseFilter = and(eq(filesTable.sessionId, initialSessionID), eq(filesTable.fileSet, state.currentFileSet))
        const [allRecords, cameraRecords, audioRecords] = await Promise.all([
          db.select().from(filesTable).where(baseFilter).orderBy(desc(filesTable.createdAt)),
          db
            .select()
            .from(filesTable)
            .where(and(baseFilter, eq(filesTable.category, "camera")))
            .orderBy(desc(filesTable.createdAt)),
          db
            .select()
            .from(filesTable)
            .where(and(baseFilter, eq(filesTable.category, "microphone")))
            .orderBy(desc(filesTable.createdAt)),
        ])
        // 3. 状態更新
        const existingFileMap = new Map(state.files.map((f) => [f.idbKey, f]))
        const processRecords = (records: ToolFileRecord[]): ToolFile[] => {
          return records.map((r) => {
            const existingFile = existingFileMap.get(r.idbKey)
            return {
              ...r,
              url: existingFile?.url || null,
            } as ToolFile
          })
        }
        const newFiles = processRecords(allRecords)
        const nextCameraFiles = processRecords(cameraRecords)
        const nextAudioFiles = processRecords(audioRecords)
        const dbIdbKeys = new Set(newFiles.map((f) => f.idbKey))
        const pendingFiles = state.files.filter((f) => f.isPending && !dbIdbKeys.has(f.idbKey))
        const nextFiles = [...pendingFiles, ...newFiles]
        const nextIdbKeys = new Set(nextFiles.map((f) => f.idbKey))
        const filesToRevoke = state.files.filter((f) => !nextIdbKeys.has(f.idbKey))
        const setsToRevoke = state.fileSetInfo.filter((s) => {
          const next = fileSetInfo.find((ns) => ns.name === s.name)
          return !next || (next.latestImageUrl !== s.latestImageUrl && s.latestImageUrl?.startsWith("blob:"))
        })
        revokeUrls(filesToRevoke, setsToRevoke)
        state = {
          ...state,
          files: nextFiles,
          cameraFiles: nextCameraFiles,
          audioFiles: nextAudioFiles,
          fileSets: fileSetNameList,
          fileSetInfo,
          isDbReady: true,
          error: null,
        }
        notify()
        // 4. 未取得のURLをバックグラウンドでロード
        if (syncOptions.hydrateUrls !== false) {
          const filesWithoutUrl = nextFiles.filter((f) => !f.url)
          if (filesWithoutUrl.length > 0) {
            const CHUNK_SIZE = 5
            for (let i = 0; i < filesWithoutUrl.length; i += CHUNK_SIZE) {
              if (signal.aborted || disposed) break
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
                files: state.files.map((f) => updatedMap.get(f.idbKey) || f),
                cameraFiles: state.cameraFiles.map((f) => updatedMap.get(f.idbKey) || f),
                audioFiles: state.audioFiles.map((f) => updatedMap.get(f.idbKey) || f),
              }
              notify()
              if (needsSync) break
            }
          }
        }
        const latestSessionID = getSessionState()?.currentId || "default"
        if (needsSync || latestSessionID !== initialSessionID || state.currentFileSet !== initialFileSet) {
          shouldSync = true
        }
      }
      notify()
    } catch (err) {
      if (!isTeardownLikeError(err)) {
        console.error("[ToolActionStore] syncData error:", err)
        state = {
          ...state,
          error: err instanceof Error ? err : new Error(String(err)),
        }
        notify()
      }
    }
  }

  async function syncData(options: SyncOptions = {}): Promise<void> {
    const merged: SyncOptions = { hydrateUrls: options.hydrateUrls ?? true }
    if (disposed) return
    if (activeSyncPromise) {
      needsSync = true
      return activeSyncPromise
    }
    activeSyncPromise = runSyncData(merged).finally(() => {
      activeSyncPromise = null
    })
    return activeSyncPromise
  }

  /**
   * 外から呼び出すアクション
   */
  const actions: ToolActions = {
    /**
     * 撮影・選択されたファイルを保存する
     */
    saveFile: async (
      file: Blob | File,
      options?: { fileName?: string; idbKey?: string; category?: string },
    ): Promise<SavedToolFileResult> => {
      const idb = idbStore()
      const idbKey = options?.idbKey || crypto.randomUUID()
      const category = options?.category || null
      // 1. 最適化UI更新
      // すでに addPreview で追加されている場合はスキップまたは更新
      const existingIndex = state.files.findIndex((f) => f.idbKey === idbKey)
      if (existingIndex === -1) {
        const tempUrl = URL.createObjectURL(file)
        const tempFile: ToolFile = {
          id: idbKey,
          sessionId: getSessionState()?.currentId || "default",
          fileSet: state.currentFileSet,
          category,
          fileName: options?.fileName || `file_${Date.now()}`,
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
          cameraFiles: category === "camera" ? [tempFile, ...state.cameraFiles] : state.cameraFiles,
          audioFiles: category === "microphone" ? [tempFile, ...state.audioFiles] : state.audioFiles,
        }
        notify()
      } else {
        // 既存のプレビューがあればフラグ等を維持しつつURLだけBlob URLに差し替え
        const oldFile = state.files[existingIndex]
        const tempUrl = URL.createObjectURL(file)
        // 重要：以前のURLがBlob URL（DataURL等ではない）ならメモリリーク防止のために解放
        if (oldFile.url?.startsWith("blob:")) URL.revokeObjectURL(oldFile.url)

        const updateFile = (f: ToolFile) =>
          f.idbKey === idbKey ? { ...f, url: tempUrl, size: file.size, isPending: true } : f
        state = {
          ...state,
          files: state.files.map(updateFile),
          cameraFiles: state.cameraFiles.map(updateFile),
          audioFiles: state.audioFiles.map(updateFile),
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
        const saveToDb = async () => {
          try {
            const db = await getDb()
            const sessionID = getSessionState()?.currentId || "default"
            const fileName = options?.fileName || `file_${Date.now()}`
            const [inserted] = await db
              .insert(filesTable)
              .values({
                sessionId: sessionID,
                fileSet: state.currentFileSet,
                category,
                fileName,
                mimeType: file.type,
                size: file.size,
                idbKey,
              })
              .returning()
            // ここで即座に「保存確定」を反映し、syncData の完了を待たない
            // （syncData が環境依存で遅延/失敗しても saveFile 自体は成功として返す）
            const applySaved = (f: ToolFile): ToolFile =>
              f.idbKey === inserted.idbKey
                ? {
                    ...f,
                    id: inserted.id,
                    sessionId: inserted.sessionId,
                    fileSet: inserted.fileSet,
                    category: inserted.category,
                    fileName: inserted.fileName,
                    mimeType: inserted.mimeType,
                    size: inserted.size,
                    createdAt: inserted.createdAt,
                    isPending: false,
                  }
                : f
            state = {
              ...state,
              files: state.files.map(applySaved),
              cameraFiles: state.cameraFiles.map(applySaved),
              audioFiles: state.audioFiles.map(applySaved),
            }
            notify()

            // 後追いで整合性を取る（fileSets / fileSetInfo / url hydration 等）
            void syncData()

            // ブリッジ経由でトーストを表示
            const type = category === "microphone" ? "audio" : "image"
            const target = captureBridge.getActiveTargetFor(type)
            const label = type === "audio" ? "録音" : "写真"
            toast.success(`${label}を保存しました`, {
              description: options?.fileName,
              action: target
                ? {
                    label: `${target.label}に適用`,
                    onClick: () => {
                      return idb.get(idbKey).then((blob) => {
                        if (blob) {
                          const url = URL.createObjectURL(blob)
                          target.onApply({ type, blob, url } as BridgeData)
                        }
                      })
                    },
                  }
                : undefined,
            })
            return inserted
          } catch (e) {
            console.error("[ToolActionStore] Async save failed:", e)
            void syncData()
            throw e
          }
        }
        // DB準備状態に依存せず、常に実DBへ保存して結果を返す
        return saveToDb().then((inserted) => ({ id: inserted.id, idbKey: inserted.idbKey }))
      } catch (error) {
        await idb.remove(idbKey).catch(() => {})
        const filterOut = (f: ToolFile) => f.idbKey !== idbKey
        state = {
          ...state,
          files: state.files.filter(filterOut),
          cameraFiles: state.cameraFiles.filter(filterOut),
          audioFiles: state.audioFiles.filter(filterOut),
        }
        notify()
        throw new Error("Failed to save file", { cause: error })
      }
    },

    /**
     * プレビュー（DataURL）を即座にUIに反映する
     */
    addPreview: (url: string, category?: string): string => {
      const tempId = crypto.randomUUID()
      const tempFile: ToolFile = {
        id: tempId,
        sessionId: getSessionState()?.currentId || "default",
        fileSet: state.currentFileSet,
        category: category || null,
        fileName: `loading_${Date.now()}`,
        mimeType: category === "microphone" ? "audio/mp3" : "image/jpeg",
        size: 0,
        idbKey: tempId,
        createdAt: new Date(),
        url: url, // DataURL
        isPending: true,
      }
      state = {
        ...state,
        files: [tempFile, ...state.files],
        cameraFiles: category === "camera" ? [tempFile, ...state.cameraFiles] : state.cameraFiles,
        audioFiles: category === "microphone" ? [tempFile, ...state.audioFiles] : state.audioFiles,
      }
      notify()
      return tempId
    },

    /**
     * ファイル選択時の処理
     */
    addFiles: (files: FileList | File[], category?: string): void => {
      Array.from(files).forEach((file) => {
        actions.saveFile(file, { category })
      })
    },

    /**
     * ファイル変更時の処理
     */
    handleFileChange: (event: React.ChangeEvent<HTMLInputElement>, category?: string): void => {
      const files = event.target.files
      if (!files || files.length === 0) return
      actions.addFiles(files, category)
      event.target.value = ""
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
      const filterOut = (f: ToolFile) => !idbKeysToRemove.has(f.idbKey)
      // 1. 最適化UI更新: 即座にメモリから消して再描画
      state = {
        ...state,
        files: state.files.filter(filterOut),
        cameraFiles: state.cameraFiles.filter(filterOut),
        audioFiles: state.audioFiles.filter(filterOut),
      }
      notify()
      // 2. バックグラウンドで残りの処理を行う
      const processDeletion = async () => {
        const db = await getDb()
        const idb = idbStore()
        try {
          const validDbIds = items.map((i) => i.id).filter((id) => id && id.length > 10)
          if (validDbIds.length > 0) {
            await db.delete(filesTable).where(inArray(filesTable.id, validDbIds))
          }
          await Promise.all(items.map((item) => idb.remove(item.idbKey)))
          void syncData()
        } catch (error) {
          console.error("[ToolActionStore] Background delete failed:", error)
          void syncData()
        }
      }
      return processDeletion()
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
      const target = captureBridge.getActiveTargetFor("qr")
      toast.success("QRコードを検出しました", {
        description: data.length > 30 ? data.slice(0, 30) + "..." : data,
        action: target
          ? {
              label: `${target.label}に適用`,
              onClick: () => {
                target.onApply({ type: "qr", data })
              },
            }
          : undefined,
      })
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
      revokeUrls(state.files, state.fileSetInfo)
      state = {
        ...state,
        currentFileSet: fileSet,
        files: [],
        cameraFiles: [],
        audioFiles: [],
      }
      notify()
      void syncData()
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

    setActiveTool: (tool: "camera" | "microphone" | null): void => {
      state = {
        ...state,
        activeTool: tool,
      }
      notify()
    },

    /**
     * ファイル選択ダイアログを開く
     */
    handleSelect: (fileInputRef: React.RefObject<HTMLInputElement | null>): void => {
      fileInputRef?.current?.click()
    },

    playAudio: () => {
      microphoneActions.playAudio()
    },

    stopAudio: () => {
      microphoneActions.stopAudio()
    },

    setAudioUrl: (url: string | null) => {
      microphoneActions.setAudioUrl(url)
    },
  }

  let unsubPglite: (() => void) | null = null
  let unsubSession: (() => void) | null = null

  const start = () => {
    if (disposed) return
    if (typeof window === "undefined") return
    // PGliteの準備が整う前でも、基本的なアクションは登録しておく
    cameraActions.setExternalActions({
      saveFile: (file, opts) => actions.saveFile(file, { ...opts, category: "camera" }),
      getFileWithUrl: actions.getFileWithUrl,
      deleteFile: actions.deleteFile,
      addPreview: (url) => actions.addPreview(url, "camera"),
    })
    microphoneActions.setExternalActions({
      saveFile: (file, opts) => actions.saveFile(file, { ...opts, category: "microphone" }),
      getFileWithUrl: actions.getFileWithUrl,
      deleteFile: actions.deleteFile,
    })
    state = { ...state, isReady: true }
    notify()

    if (!unsubPglite) {
      unsubPglite = subscribePglite(() => {
        if (!state.isDbReady) void syncData()
      })
    }
    if (!unsubSession) {
      unsubSession = sessionStore.subscribe(() => {
        void syncData()
      })
    }

    // 初期同期キック: DB がすでに準備済みでも取りこぼさない
    void getDb()
      .then(() => {
        if (!state.isDbReady) return syncData()
      })
      .catch((err) => {
        console.error("[ToolActionStore] Initial DB kick failed:", err)
      })
  }

  const dispose = () => {
    if (disposed) return
    disposed = true
    try {
      revokeUrls(state.files, state.fileSetInfo)
    } catch {
      /* noop */
    }
    if (currentAbortController) {
      currentAbortController.abort()
      currentAbortController = null
    }
    try {
      unsubPglite?.()
    } catch {
      /* noop */
    }
    unsubPglite = null
    try {
      unsubSession?.()
    } catch {
      /* noop */
    }
    unsubSession = null
    listeners.clear()
  }

  if (options?.autoStart) start()

  return { actions, getState, subscribe, syncData, start, dispose }
}

const singleton = createToolActionStore({ autoStart: typeof window !== "undefined" })

export const actions: ToolActions = singleton.actions

/**
 * UIから利用するHook
 */
export function useToolActionStore<T = ToolActionState & ToolActions>(
  selector?: (state: ToolActionState & ToolActions) => T,
): T {
  const storeState: ToolActionState = useExternalStore({
    subscribe: singleton.subscribe,
    getSnapshot: singleton.getState,
    getServerSnapshot: singleton.getState,
  })
  const full: ToolActionState & ToolActions = { ...storeState, ...singleton.actions }
  return selector ? selector(full) : (full as unknown as T)
}
