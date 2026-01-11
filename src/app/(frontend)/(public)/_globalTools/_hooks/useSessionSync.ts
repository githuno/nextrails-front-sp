import { usePathname, useSearchParams } from "next/navigation"
import { useMemo } from "react"
import { useExternalStore } from "./atom/useExternalStore"
import { useIsClient } from "./atom/useIsClient"

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
        memoryState = JSON.parse(e.newValue)
        emitChange()
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

export const useSessionSync = (): string => {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const urlSid: string | null = searchParams.get("sid")
  const state: SessionState = useExternalStore(sessionStore)
  const isClient: boolean = useIsClient()

  /**
   * ループ防止と安定性のための、このクライアントセッションでの「新規発行用」ID。
   * URLやlocalStorageの両方に有効なIDがない場合、または未知のIDが入力された場合のみ使用される。
   */
  const fallbackId = useMemo(() => globalThis.crypto.randomUUID(), [])

  // サーバーサイドおよびクライアント初期化前は、現在のStoreの値をベースにする
  // (SSR時は INITIAL_STATE.currentId = "" が返る)
  let activeSid: string = state.currentId || ""

  if (isClient) {
    let finalSid = ""

    if (urlSid) {
      // URLにsidが指定されている場合
      if (isValidUUID(urlSid) && state.ids.includes(urlSid)) {
        // 既知のUUIDであればそれを採用（セッション切り替え）
        finalSid = urlSid
      } else {
        // 無効な形式、または未知のセッションIDが入力された場合
        // 要件：localStorageに保存されていない値が入力されたら新規生成したUUIDで置き換える
        finalSid = fallbackId
      }
    } else {
      // URLにsidがない場合
      if (state.currentId) {
        // 既存のセッションがあれば継続
        finalSid = state.currentId
      } else {
        // localStorageに値が存在しない場合 -> 新規発行
        finalSid = fallbackId
      }
    }

    activeSid = finalSid

    // クライアントサイドでの同期（非同期）
    if (urlSid !== activeSid || state.currentId !== activeSid) {
      Promise.resolve().then(() => {
        // 1. Storeの同期（persistNewId 相当の処理も含めて syncFromUrl で行う）
        actions.syncFromUrl(activeSid)

        // 2. URLの同期
        const currentParams = new URLSearchParams(window.location.search)
        if (currentParams.get("sid") !== activeSid) {
          currentParams.set("sid", activeSid)
          window.history.replaceState(null, "", `${pathname}?${currentParams.toString()}`)
        }
      })
    }
  }

  return activeSid
}
