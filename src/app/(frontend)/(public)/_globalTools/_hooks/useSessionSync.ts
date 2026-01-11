import { usePathname, useSearchParams } from "next/navigation"
import { useRef } from "react"
import { useExternalStore } from "./atom/useExternalStore"

const STORAGE_KEY = "ftb-session-id"
const INITIAL_STATE: SessionState = { ids: [], currentId: "" }

type SessionState = {
  ids: string[]
  currentId: string
}

// Helper: UUID check
const isValidUUID = (id: string | null): boolean => {
  return !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

// メモリ上のキャッシュ（SSOTの実体）
let memoryState: SessionState = INITIAL_STATE
let isInitialized = false
const listeners = new Set<() => void>()

// State変更通知
const emitChange = () => {
  listeners.forEach((l) => l())
}

const actions = {
  _loadLatest: (): SessionState => {
    if (typeof window === "undefined") return INITIAL_STATE
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed.ids) && typeof parsed.currentId === "string") {
          return parsed
        }
      }
    } catch {
      /* ignore */
    }
    return INITIAL_STATE
  },

  init: () => {
    if (isInitialized || typeof window === "undefined") return
    memoryState = actions._loadLatest()
    isInitialized = true
  },

  /**
   * ストアの現在状態を取得する（シングルトンアクセス用）
   */
  getState: () => {
    if (!isInitialized) actions.init()
    return memoryState
  },

  syncFromUrl: (urlSid: string) => {
    const current = actions._loadLatest()
    if (current.ids.includes(urlSid) && current.currentId === urlSid) {
      if (memoryState !== current) {
        memoryState = current
        emitChange()
      }
      return
    }
    const newIds = current.ids.includes(urlSid) ? current.ids : [...current.ids, urlSid]
    memoryState = { ids: newIds, currentId: urlSid }
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryState))
    }
    emitChange()
  },

  // Stateを更新せずに永続化だけ行う（レンダリングループ防止用）
  persistNewId: (newSid: string) => {
    const current = actions._loadLatest()
    // 既に保存済みなら何もしない
    if (current.ids.includes(newSid) && current.currentId === newSid) return
    const newState = {
      ids: [...current.ids, newSid],
      currentId: newSid,
    }
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState))
    }
    // ここで emitChange() は呼ばない！
    // 呼ぶとレンダリング中に再レンダリングを誘発する。
    // 次回のマウントやイベントで自然に同期されるのを待つか、
    // URL書き換え後の再レンダリングで actions.syncFromUrl が呼ばれて同期される。
    memoryState = newState
  },
}

export const getSessionState = () => actions.getState()

export const sessionStore = {
  subscribe: (callback: () => void) => {
    listeners.add(callback)
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          memoryState = JSON.parse(e.newValue)
          emitChange()
        } catch {}
      }
    }
    if (typeof window !== "undefined") {
      window.addEventListener("storage", onStorage)
    }
    return () => {
      listeners.delete(callback)
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", onStorage)
      }
    }
  },
  getSnapshot: () => {
    if (!isInitialized) actions.init()
    return memoryState
  },
  getServerSnapshot: () => INITIAL_STATE,
}

export const useSessionSync = () => {
  // const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const urlSid = searchParams.get("sid")
  const state = useExternalStore(sessionStore)
  const tempSidRef = useRef<string | null>(null) // レンダリング中に生成した一時IDを保持するRef

  if (typeof window !== "undefined") {
    // Case A: URL is VALID (UUID)
    if (isValidUUID(urlSid)) {
      // URLが正常なら、一時IDはクリア
      if (tempSidRef.current) tempSidRef.current = null
      // Store同期（必要な場合のみ）
      if (state.currentId !== urlSid) {
        // ここでのState更新は許容される（条件付きであり、収束するため）
        actions.syncFromUrl(urlSid!)
      }
      return urlSid!
    } else {
      // Case B: URL is INVALID or MISSING
      let targetSid = ""
      if (!urlSid && state.currentId) {
        // URLが空で、かつStoreに有効なIDがある場合のみフォールバック
        targetSid = state.currentId
      } else {
        // Create NEW ID
        // レンダリング毎に再生成しないようRefを使う
        if (!tempSidRef.current) {
          tempSidRef.current = globalThis.crypto.randomUUID()
          // ここでState更新（emitChange）を含む actions.createNew() を呼ぶと無限ループする
          // なので、静かに永続化だけしておく
          actions.persistNewId(tempSidRef.current)
        }
        targetSid = tempSidRef.current!
      }
      // URL書き換え（非同期）
      if (urlSid !== targetSid) {
        Promise.resolve().then(() => {
          const params = new URLSearchParams(window.location.search)
          params.set("sid", targetSid)
          window.history.replaceState(null, "", `${pathname}?${params.toString()}`)
          // URL書き換え完了後、念のためState同期（まだなら）
          // このタイミングなら再レンダリング誘発してもOK（次のサイクルになるため）
          actions.syncFromUrl(targetSid)
        })
      }
      return targetSid
    }
  }
  return state.currentId || ""
}
