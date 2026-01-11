import { desc, eq } from "drizzle-orm"
import { useCameraActions } from "../camera/cameraStore"
import { useExternalStore } from "./atom/useExternalStore"
import { capturedFiles } from "./db/pgliteSchema"
import { useIdbStore } from "./db/useIdbStore"
import { getDb, subscribe as subscribePglite } from "./db/usePgliteStore"
import { getSessionState, sessionStore } from "./useSessionSync"

/**
 * 型定義
 */
export interface ToolFile {
  id: string
  sessionId: string
  fileName: string
  mimeType: string
  size: number
  idbKey: string
  createdAt: Date
  url: string | null
}

interface ToolActionState {
  isReady: boolean
  files: ToolFile[]
  isCameraOpen: boolean
  isWebViewOpen: boolean
  webUrl: string
  error: Error | null
}

/**
 * シングルトンとしてのStore実装
 * Reactの外で状態を保持し、副作用（データロードやアクション注入）を中央管理する
 */
let state: ToolActionState = {
  isReady: false,
  files: [],
  isCameraOpen: false,
  isWebViewOpen: false,
  webUrl: "",
  error: null,
}

const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
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
const revokeUrls = (files: ToolFile[]) => {
  files.forEach((f) => {
    if (f.url) URL.revokeObjectURL(f.url)
  })
}

/**
 * データの自動ロードとアクションの依存注入
 * DBの初期化をトリガーに実行される
 */
const syncData = async () => {
  try {
    const db = await getDb()
    const idb = useIdbStore()
    const cameraActions = useCameraActions()
    const sessionID = getSessionState()?.currentId
    // 1. メタデータの取得
    const records = await db
      .select()
      .from(capturedFiles)
      .where(sessionID ? eq(capturedFiles.sessionId, sessionID) : undefined)
      .orderBy(desc(capturedFiles.createdAt))

    // 2. プレビューURLの生成と状態更新
    const newFiles: ToolFile[] = await Promise.all(
      records.map(async (r) => {
        const blob = await idb.get(r.idbKey)
        const url = blob ? URL.createObjectURL(blob) : null
        return { ...r, url } as ToolFile
      }),
    )

    // 古いURLを解放して更新
    revokeUrls(state.files)
    state = {
      ...state,
      files: newFiles,
      isReady: true,
      error: null,
    }

    // 3. CameraStoreへのアクション自動注入
    cameraActions.setCapturedImages(
      newFiles.filter((f) => !!f.url).map((f) => ({ url: f.url!, idbKey: f.idbKey, dbId: f.id })),
    )
    cameraActions.setExternalActions({
      saveCapturedFile: actions.saveCapturedFile,
      getFileWithUrl: actions.getFileWithUrl,
      deleteFile: actions.deleteFile,
    })
    cameraActions.setInitialized(true)

    notify()
  } catch (err) {
    console.error("[ToolActionStore] syncData error:", err)
    state = {
      ...state,
      error: err instanceof Error ? err : new Error(String(err)),
    }
    notify()
  }
}

if (typeof window !== "undefined") {
  // PGliteの準備が整ったら自動で同期を開始
  subscribePglite(() => {
    if (!state.isReady) syncData()
  })

  // セッションが変更された場合も再同期する
  sessionStore.subscribe(() => {
    syncData()
  })

  // 初期化キック: すでに準備ができている場合も同期を開始するようにする
  const initStore = async () => {
    try {
      const db = await getDb()
      if (db && !state.isReady) {
        await syncData()
      }
    } catch (err) {
      console.error("[ToolActionStore] Initial DB kick failed:", err)
    }
  }

  initStore()
}

/**
 * 外から呼び出すアクション
 */
export const actions = {
  /**
   * 撮影・選択されたファイルを保存する
   */
  saveCapturedFile: async (file: Blob | File, options?: { fileName?: string }) => {
    const db = await getDb()
    const idb = useIdbStore()
    const sessionID = getSessionState()?.currentId || "default"

    const idbKey = crypto.randomUUID()
    const fileName = options?.fileName || `captured_${Date.now()}`

    try {
      await idb.put(idbKey, file)
      const [inserted] = await db
        .insert(capturedFiles)
        .values({
          sessionId: sessionID,
          fileName,
          mimeType: file.type,
          size: file.size,
          idbKey,
        })
        .returning()

      // 状態を再同期（または部分更新）
      await syncData()
      return inserted
    } catch (error) {
      await idb.remove(idbKey).catch(() => {})
      throw new Error("Failed to save captured file", { cause: error })
    }
  },

  /**
   * ファイルを削除する
   */
  deleteFile: async (idbKey: string, dbId: string) => {
    const db = await getDb()
    const idb = useIdbStore()
    try {
      await idb.remove(idbKey)
      await db.delete(capturedFiles).where(eq(capturedFiles.id, dbId))
      await syncData()
    } catch (error) {
      throw new Error("Failed to delete file", { cause: error })
    }
  },

  /**
   * IDBからBlobのURLを取得するのみ
   */
  getFileWithUrl: async (idbKey: string) => {
    const idb = useIdbStore()
    const blob = await idb.get(idbKey)
    return blob ? URL.createObjectURL(blob) : null
  },

  /**
   * スキャンの処理
   */
  handleScan: (data: string) => {
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
   * UI状態のリセット
   */
  closeWebView: () => {
    state = {
      ...state,
      isWebViewOpen: false,
      webUrl: "",
    }
    notify()
  },

  setCameraOpen: (isOpen: boolean) => {
    state = {
      ...state,
      isCameraOpen: isOpen,
    }
    notify()
  },

  /**
   * ファイル選択時の処理（UIから渡されたFile集を直接保存）
   */
  addFiles: (files: FileList | File[]) => {
    Array.from(files).forEach((file) => {
      actions.saveCapturedFile(file)
    })
  },
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
