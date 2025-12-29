import { useCallback, useEffect, useMemo, useRef, useState } from "react"

// サーバーサイドかどうかを判定
const isServer = typeof window === "undefined"

/**
 * URLSearchParamsと互換性のあるカスタムフック
 * @returns URLSearchParamsオブジェクト
 */
export function useSearchParams(): URLSearchParams {
  // サーバーサイドではダミーのURLSearchParamsを返す
  const [searchParams, setSearchParams] = useState<URLSearchParams>(() => {
    return new URLSearchParams(isServer ? "" : window.location.search)
  })
  const mountedRef = useRef(false)

  useEffect(() => {
    if (!isServer) {
      // マウント時にフラグを設定
      mountedRef.current = true

      // 変更監視ハンドラー
      const handleUrlChange = () => {
        setSearchParams(new URLSearchParams(window.location.search))
      }

      // イベントリスナー設定
      window.addEventListener("popstate", handleUrlChange)
      window.addEventListener("navigationchange", handleUrlChange)

      // クリーンアップ
      return () => {
        window.removeEventListener("popstate", handleUrlChange)
        window.removeEventListener("navigationchange", handleUrlChange)
      }
    }
  }, [])

  return searchParams
}

/**
 * 現在のパス名を取得するカスタムフック
 * @returns 現在のパス名
 */
export function usePathname(): string {
  const [pathname, setPathname] = useState<string>(isServer ? "/" : window.location.pathname)
  const mountedRef = useRef(false)

  useEffect(() => {
    if (!isServer) {
      // マウント時にフラグを設定
      mountedRef.current = true

      const handleUrlChange = () => {
        setPathname(window.location.pathname)
      }

      window.addEventListener("popstate", handleUrlChange)
      window.addEventListener("navigationchange", handleUrlChange)

      return () => {
        window.removeEventListener("popstate", handleUrlChange)
        window.removeEventListener("navigationchange", handleUrlChange)
      }
    }
  }, [])

  return pathname
}

/**
 * ルーティング操作を提供するカスタムフック
 * @returns ルーターオブジェクト
 */
export function useRouter(): Router {
  // ナビゲーション変更を通知するカスタムイベント
  const notifyUrlChange = useCallback(() => {
    if (isServer) return
    window.dispatchEvent(new Event("navigationchange"))
  }, [])

  // 新しいURLに遷移
  const push = useCallback(
    (url: string, options: RouterOptions = {}) => {
      if (isServer) return

      const { scroll = true } = options

      // 前のURLパラメータを維持するために現在のURLとマージ
      // const currentUrl = new URL(window.location.href)
      const newUrl = new URL(url, window.location.origin)
      // const newParams = new URLSearchParams(newUrl.search)

      // 履歴スタックに追加 - フルURLを指定
      window.history.pushState({}, "", newUrl.toString())
      notifyUrlChange()

      // スクロール制御
      if (scroll) {
        window.scrollTo(0, 0)
      }
    },
    [notifyUrlChange],
  )

  // 履歴を置き換えて遷移
  const replace = useCallback(
    (url: string, options: RouterOptions = {}) => {
      if (isServer) return

      const { scroll = true } = options

      // 前のURLパラメータを維持するために現在のURLとマージ
      // const currentUrl = new URL(window.location.href)
      const newUrl = new URL(url, window.location.origin)
      // const newParams = new URLSearchParams(newUrl.search)

      // 履歴を置き換える - フルURLを指定
      window.history.replaceState({}, "", newUrl.toString())
      notifyUrlChange()

      // スクロール制御
      if (scroll) {
        window.scrollTo(0, 0)
      }
    },
    [notifyUrlChange],
  )

  // 他のメソッドは変更なし
  const back = useCallback(() => {
    if (isServer) return
    window.history.back()
  }, [])

  const forward = useCallback(() => {
    if (isServer) return
    window.history.forward()
  }, [])

  const refresh = useCallback(() => {
    if (isServer) return
    window.location.reload()
  }, [])

  return useMemo(
    () => ({
      push,
      replace,
      back,
      forward,
      refresh,
    }),
    [push, replace, back, forward, refresh],
  )
}

// インターフェース定義
interface RouterOptions {
  scroll?: boolean
  shallow?: boolean
}

interface Router {
  push: (url: string, options?: RouterOptions) => void
  replace: (url: string, options?: RouterOptions) => void
  back: () => void
  forward: () => void
  refresh: () => void
}
