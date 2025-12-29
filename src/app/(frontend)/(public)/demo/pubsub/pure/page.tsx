"use client"

import { pubSub } from "@/utils/pubsub"
import { useCallback, useEffect, useRef, useState } from "react"

/**
 * ユーザー認証状態を監視するコンポーネント
 */
function UserAuthMonitor() {
  const [lastLogin, setLastLogin] = useState<string | null>(null)

  // アンマウント時にイベント購読を解除するための参照
  const unsubscribeRefs = useRef<(() => void)[]>([])

  // コンポーネントのマウント時にイベント購読を設定
  useEffect(() => {
    // ログインイベント発生時に実行されるコールバックを登録して、監視
    const loginUnsubscribe = pubSub.on("user:login", (data: { userId: string; timestamp: number }) => {
      setLastLogin(new Date(data.timestamp).toLocaleString())
      console.log(`User ${data.userId} logged in!`)
    })

    // ログアウトイベント発生時に実行されるコールバックを1回だけ登録
    const logoutUnsubscribe = pubSub.once("user:logout", (data: { userId: string; timestamp: number }) => {
      console.log(`User ${data.userId} logged out. See you next time!`)
    })

    // 購読解除関数を保存
    unsubscribeRefs.current = [loginUnsubscribe, logoutUnsubscribe]

    // クリーンアップ関数：コンポーネントのアンマウント時に実行される
    return () => {
      unsubscribeRefs.current.forEach((unsubscribe) => unsubscribe())
    }
  }, []) // 空の依存配列でマウント時のみ実行

  return (
    <div className="rounded-lg bg-white p-6 shadow-md transition-all duration-300 dark:bg-gray-800">
      <h3 className="mb-4 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-800 dark:border-gray-700 dark:text-white">
        認証監視
      </h3>
      {lastLogin ? (
        <p className="text-gray-700 dark:text-gray-300">
          <span className="font-medium">最終ログイン:</span>
          <span className="ml-2 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800 dark:bg-blue-900 dark:text-blue-100">
            {lastLogin}
          </span>
        </p>
      ) : (
        <p className="text-gray-500 italic dark:text-gray-400">ログイン情報はまだありません</p>
      )}
    </div>
  )
}

/**
 * テーマ設定コンポーネント
 */
function ThemeSelector() {
  // テーマデータの状態
  const [themeData, setThemeData] = useState<{
    theme: "light" | "dark" | "system"
  }>({
    theme: "system",
  })

  // アンマウント時にイベント購読を解除するための参照
  const unsubscribeRef = useRef<() => void | null>(null)

  // コンポーネントのマウント時にイベントの現在状態を監視
  useEffect(() => {
    // テーマ変更イベントの監視
    const unsubscribe = pubSub.on("ui:theme:changed", (data: { theme: "light" | "dark" | "system" }) => {
      setThemeData(data)
    })

    // 購読解除関数を保存
    unsubscribeRef.current = unsubscribe

    // クリーンアップ関数
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
    }
  }, [])

  const handleThemeChange = (theme: "light" | "dark" | "system") => {
    // テーマ変更イベントを発行
    pubSub.emit("ui:theme:changed", { theme })
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow-md transition-all duration-300 dark:bg-gray-800">
      <h3 className="mb-4 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-800 dark:border-gray-700 dark:text-white">
        テーマ設定
      </h3>
      <p className="mb-4 text-gray-700 dark:text-gray-300">
        現在のテーマ:
        <span
          className={`ml-2 rounded-full px-3 py-1 text-sm font-medium ${
            themeData?.theme === "light"
              ? "bg-yellow-100 text-yellow-800"
              : themeData?.theme === "dark"
                ? "bg-indigo-100 text-indigo-800"
                : "bg-green-100 text-green-800"
          }`}
        >
          {themeData?.theme === "light" ? "ライト" : themeData?.theme === "dark" ? "ダーク" : "システム"}
        </span>
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => handleThemeChange("light")}
          className={`rounded-md px-4 py-2 transition-all duration-200 ${
            themeData?.theme === "light"
              ? "bg-yellow-500 text-white shadow-md"
              : "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-100 dark:hover:bg-yellow-800"
          }`}
        >
          <span className="flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mr-1 h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            ライト
          </span>
        </button>
        <button
          onClick={() => handleThemeChange("dark")}
          className={`rounded-md px-4 py-2 transition-all duration-200 ${
            themeData?.theme === "dark"
              ? "bg-indigo-500 text-white shadow-md"
              : "bg-indigo-100 text-indigo-800 hover:bg-indigo-200 dark:bg-indigo-900 dark:text-indigo-100 dark:hover:bg-indigo-800"
          }`}
        >
          <span className="flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mr-1 h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
              />
            </svg>
            ダーク
          </span>
        </button>
        <button
          onClick={() => handleThemeChange("system")}
          className={`rounded-md px-4 py-2 transition-all duration-200 ${
            themeData?.theme === "system"
              ? "bg-green-500 text-white shadow-md"
              : "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-100 dark:hover:bg-green-800"
          }`}
        >
          <span className="flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mr-1 h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            システム
          </span>
        </button>
      </div>
    </div>
  )
}

/**
 * データ読み込みとモーダル制御の例
 */
function DataLoadingExample() {
  // 状態管理
  const [isLoading, setIsLoading] = useState(false)
  const [isWaiting, setIsWaiting] = useState(false)

  // 型定義を明示的に導入
  type LoadedData = {
    source: string
    items: Array<{ id: number; name: string }>
  }

  // 自前のデータ状態管理
  const [loadedData, setLoadedData] = useState<LoadedData | null>(null)
  const [loadError, setLoadError] = useState<Error | null>(null)

  // タイムアウト処理用の参照
  const timeoutRef = useRef<number | null>(null)
  const unsubscribeRef = useRef<() => void | null>(null)

  // データ読み込み関数
  const handleLoadData = async () => {
    setIsLoading(true)
    setIsWaiting(true)
    // 既存データをクリア
    setLoadedData(null)
    // エラーをリセット
    setLoadError(null)

    // 前回のタイムアウトとイベントリスナーをクリア
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    if (unsubscribeRef.current) {
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }

    // データ読み込み開始のモーダルを表示
    pubSub.emit("ui:modal:open", {
      id: "loading-modal",
      data: { message: "データを読み込んでいます..." },
    })

    try {
      // タイムアウト処理を設定
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutRef.current = window.setTimeout(() => {
          reject(new Error("データ読み込みがタイムアウトしました"))
        }, 3000) // 3秒でタイムアウト
      })

      // データロード処理を設定
      const dataPromise = new Promise<LoadedData>((resolve) => {
        // イベントリスナーを設定
        const unsubscribe = pubSub.once("data:loaded", (data: LoadedData) => {
          resolve(data)
        })

        unsubscribeRef.current = unsubscribe

        // 並行してデータロードをシミュレート
        setTimeout(() => {
          const data: LoadedData = {
            source: "api",
            items: [
              { id: 1, name: "商品A" },
              { id: 2, name: "商品B" },
              { id: 3, name: "商品C" },
            ],
          }
          // イベントを発行
          pubSub.emit("data:loaded", data)
        }, 2000) // 2秒後にデータを読み込む
      })

      // Promise.raceでタイムアウトとデータロードを競争させる
      const data = await Promise.race([dataPromise, timeoutPromise])

      // タイムアウトのクリア
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }

      // データを設定
      setLoadedData(data)
      setIsWaiting(false)

      // モーダルを閉じる
      pubSub.emit("ui:modal:close", { id: "loading-modal" })

      // 成功モーダルを表示
      pubSub.emit("ui:modal:open", {
        id: "success-modal",
        data: {
          message: `${data.items.length}件のデータを読み込みました`,
        },
      })
    } catch (error) {
      // エラー処理
      console.error("Data loading failed:", error)
      setLoadError(error instanceof Error ? error : new Error(String(error)))
      setIsWaiting(false)
      // エラーイベントを発行
      pubSub.emit("app:error", {
        message: "データ読み込みがタイムアウトしました",
        code: 408,
      })
    } finally {
      setIsLoading(false)
    }
  }

  // リセット関数
  const reset = () => {
    setLoadedData(null)
    setLoadError(null)

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    if (unsubscribeRef.current) {
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }
  }

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
    }
  }, [])

  return (
    <div className="rounded-lg bg-white p-6 shadow-md transition-all duration-300 dark:bg-gray-800">
      <h3 className="mb-4 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-800 dark:border-gray-700 dark:text-white">
        データ読み込み
      </h3>

      <button
        onClick={handleLoadData}
        disabled={isLoading || isWaiting}
        className={`mb-4 w-full rounded-md px-4 py-2 font-medium transition-all duration-200 ${
          isLoading || isWaiting
            ? "cursor-not-allowed bg-gray-300 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
            : "bg-blue-500 text-white shadow-sm hover:bg-blue-600 hover:shadow-md"
        }`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center">
            <svg
              className="mr-3 -ml-1 h-5 w-5 animate-spin text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            読み込み中...
          </span>
        ) : (
          <span className="flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mr-2 h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            データを読み込む
          </span>
        )}
      </button>

      {/* タイムアウト状態の表示 */}
      {isWaiting && (
        <div className="mb-4 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
          データ待機中...
        </div>
      )}

      {loadedData && (
        <div className="animate-fadeIn mt-4 rounded-md bg-blue-50 p-4 dark:bg-blue-900/30">
          {/* データの表示部分を更新 */}
          <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {loadedData.items.map((item) => (
              <div key={item.id} className="rounded bg-white p-3 shadow-sm dark:bg-gray-700">
                <div className="text-sm text-gray-500 dark:text-gray-400">ID: {item.id}</div>
                <div className="font-medium">{item.name}</div>
              </div>
            ))}
          </div>
          <button
            onClick={reset}
            className="rounded bg-red-100 px-3 py-1 text-sm text-red-800 transition-colors duration-200 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-800"
          >
            リセット
          </button>
        </div>
      )}

      {loadError && (
        <div className="mt-4 flex items-start rounded-md bg-red-50 p-4 text-red-700 dark:bg-red-900/30 dark:text-red-300">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mt-0.5 mr-2 h-5 w-5 shrink-0"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <p className="font-medium">エラー</p>
            <p className="mt-1 text-sm">{loadError.message}</p>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * すべてのアプリケーションイベントを監視する例
 */
function UserEventsMonitor() {
  const [events, setEvents] = useState<Array<{ name: string; time: string }>>([])

  // イベント購読を保持する参照
  const unsubscribeRefs = useRef<(() => void)[]>([])

  // イベントを追加する共通関数
  const addEvent = useCallback((eventName: string) => {
    setEvents((prev) => [
      {
        name: eventName,
        time: new Date().toLocaleTimeString(),
      },
      ...prev.slice(0, 9), // 最新10件のみ保持
    ])
  }, [])

  // コンポーネントのマウント時にイベント購読を設定
  useEffect(() => {
    // 監視対象のイベントとそのハンドラーを定義
    const eventHandlers: [string, (_data: any) => void][] = [
      [
        "user:login",
        (data: { userId: string; timestamp: number }) => {
          addEvent("user:login")
          console.log("Login event received:", data)
        },
      ],
      [
        "user:logout",
        (data: { userId: string; timestamp: number }) => {
          addEvent("user:logout")
          console.log("Logout event received:", data)
        },
      ],
      [
        "user:preferences:changed",
        (data: { userId: string; preferences: any }) => {
          addEvent("user:preferences:changed")
          console.log("Preferences changed event received:", data)
        },
      ],
      [
        "app:error",
        (data: { message: string; code?: number; stack?: string }) => {
          addEvent("app:error")
          console.log("Error event received:", data)
        },
      ],
      [
        "ui:theme:changed",
        (data: { theme: "light" | "dark" | "system" }) => {
          addEvent("ui:theme:changed")
          console.log("Theme changed event received:", data)
        },
      ],
      [
        "data:loaded",
        (data: { source: string; items: any[] }) => {
          addEvent("data:loaded")
          console.log("Data loaded event received:", data)
        },
      ],
    ]

    // 各イベントに対してハンドラーを登録
    const unsubscribes = eventHandlers.map(([event, handler]) =>
      // pubSub.onメソッドを使用してイベントを購読
      pubSub.on(event as any, handler),
    )

    // 購読解除関数を保存
    unsubscribeRefs.current = unsubscribes

    // クリーンアップ関数
    return () => {
      unsubscribeRefs.current.forEach((unsubscribe) => unsubscribe())
    }
  }, [addEvent]) // addEventに依存

  return (
    <div className="rounded-lg bg-white p-6 shadow-md transition-all duration-300 dark:bg-gray-800">
      <h3 className="mb-4 flex items-center border-b border-gray-200 pb-2 text-lg font-semibold text-gray-800 dark:border-gray-700 dark:text-white">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="mr-2 h-5 w-5 text-blue-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        イベント監視
      </h3>
      {events.length === 0 ? (
        <div className="rounded-md bg-gray-50 p-4 text-center text-gray-500 italic dark:bg-gray-700 dark:text-gray-400">
          イベントはまだありません
        </div>
      ) : (
        <ul className="custom-scrollbar max-h-60 space-y-2 overflow-y-auto pr-2">
          {events.map((event, i) => (
            <li
              key={i}
              className={`flex justify-between rounded-md p-2 ${
                i === 0 ? "animate-pulse bg-blue-50 dark:bg-blue-900/30" : "bg-gray-50 dark:bg-gray-700"
              }`}
            >
              <span className="font-mono text-sm text-gray-500 dark:text-gray-400">{event.time}</span>
              <span
                className={`rounded px-2 py-0.5 text-sm font-medium ${
                  event.name.includes("login")
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                    : event.name.includes("logout")
                      ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                      : event.name.includes("error")
                        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                        : event.name.includes("theme")
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                }`}
              >
                {event.name}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ...existing code...

/**
 * イベント待機（waitFor）の使用例
 */
function AsyncEventWaiter() {
  const [status, setStatus] = useState<"idle" | "waiting" | "success" | "error">("idle")
  const [waitResult, setWaitResult] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const handleWaitForEvent = async () => {
    setStatus("waiting")
    setWaitResult(null)

    // 前回の処理がある場合は中止
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // 新しいAbortControllerを作成
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    try {
      // Promise.raceを使用してAbortSignalとイベント待機を競争させる
      await Promise.race([
        // 非同期でイベントを待機
        (async () => {
          try {
            // 任意のイベントが発生するのを最大10秒間待機
            const data = await pubSub.waitFor("user:login", 10000)
            if (signal.aborted) return

            setStatus("success")
            setWaitResult(`ユーザーID: ${data.userId}が${new Date(data.timestamp).toLocaleString()}にログインしました`)
          } catch (error) {
            if (signal.aborted) return
            throw error
          }
        })(),

        // AbortSignalの監視
        new Promise((_, reject) => {
          signal.addEventListener("abort", () => {
            reject(new Error("操作が中止されました"))
          })
        }),
      ])
    } catch (error) {
      if (!signal.aborted) {
        setStatus("error")
        setWaitResult(error instanceof Error ? error.message : String(error))
      }
    }
  }

  // 処理をキャンセル
  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setStatus("idle")
      setWaitResult("待機がキャンセルされました")
    }
  }

  // コンポーネントのクリーンアップ
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return (
    <div className="rounded-lg bg-white p-6 shadow-md transition-all duration-300 dark:bg-gray-800">
      <h3 className="mb-4 flex items-center border-b border-gray-200 pb-2 text-lg font-semibold text-gray-800 dark:border-gray-700 dark:text-white">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="mr-2 h-5 w-5 text-purple-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        イベント待機 (waitFor)
      </h3>

      <div className="mb-4">
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
          <code>waitFor</code>
          メソッドを使うと、特定のイベントが発生するまで非同期に待機できます。
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleWaitForEvent}
            disabled={status === "waiting"}
            className={`flex items-center rounded-md px-4 py-2 transition-all duration-200 ${
              status === "waiting"
                ? "cursor-not-allowed bg-gray-300 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                : "bg-purple-500 text-white hover:bg-purple-600"
            }`}
          >
            {status === "waiting" ? (
              <>
                <svg
                  className="mr-2 -ml-1 h-4 w-4 animate-spin text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                ログイン待機中...
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="mr-2 h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                ログインイベント待機
              </>
            )}
          </button>

          {status === "waiting" && (
            <button
              onClick={handleCancel}
              className="rounded-md bg-red-100 px-4 py-2 text-red-800 transition-all duration-200 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-800"
            >
              キャンセル
            </button>
          )}
        </div>
      </div>

      {/* 結果表示エリア */}
      {waitResult && (
        <div
          className={`mt-3 rounded-md p-3 text-sm ${
            status === "success"
              ? "bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-200"
              : status === "error"
                ? "bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200"
                : "bg-gray-50 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
          }`}
        >
          {waitResult}
        </div>
      )}

      <div className="mt-4 rounded bg-gray-50 p-2 text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-400">
        注: ログインボタンをクリックすると、このコンポーネントは待機状態から完了状態に変わります
      </div>
    </div>
  )
}

/**
 * イベント名前空間管理（clearNamespace）の使用例
 */
function EventNamespaceManager() {
  const [userEvents, setUserEvents] = useState<boolean>(true)
  const [uiEvents, setUiEvents] = useState<boolean>(true)
  const [subscribers, setSubscribers] = useState<Record<string, number>>(() => pubSub.getSubscribersCount())

  // サブスクライバー情報を取得する関数
  const updateSubscribers = useCallback(() => {
    queueMicrotask(() => {
      const counts = pubSub.getSubscribersCount()
      setSubscribers(counts)
    })
  }, [])

  // コンポーネントマウント時にサブスクライバー情報を取得
  useEffect(() => {
    // ダミーイベント購読を追加（表示用）
    const dummyHandlers = [
      pubSub.on("user:profile:updated", () => {}),
      pubSub.on("user:settings:viewed", () => {}),
      pubSub.on("ui:sidebar:toggled", () => {}),
      pubSub.on("ui:modal:animated", () => {}),
    ]

    // イベント発生時にサブスクライバー数を更新
    const eventMonitor = pubSub.on("*", () => {
      updateSubscribers()
    })

    return () => {
      // 全てのダミーイベント購読を解除
      dummyHandlers.forEach((unsub) => unsub())
      eventMonitor()
    }
  }, [updateSubscribers])

  // 名前空間のイベント購読を解除
  const clearUserNamespace = () => {
    pubSub.clearNamespace("user:")
    setUserEvents(false)
    updateSubscribers()
  }

  const clearUiNamespace = () => {
    pubSub.clearNamespace("ui:")
    setUiEvents(false)
    updateSubscribers()
  }

  // 名前空間の購読を再設定
  const restoreUserNamespace = () => {
    // 新しいダミーイベント購読を設定
    pubSub.on("user:profile:updated", () => {})
    pubSub.on("user:settings:viewed", () => {})
    pubSub.on("user:login", () => {})
    pubSub.on("user:logout", () => {})
    setUserEvents(true)
    updateSubscribers()
  }

  const restoreUiNamespace = () => {
    // 新しいダミーイベント購読を設定
    pubSub.on("ui:sidebar:toggled", () => {})
    pubSub.on("ui:modal:animated", () => {})
    pubSub.on("ui:theme:changed", () => {})
    setUiEvents(true)
    updateSubscribers()
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow-md transition-all duration-300 dark:bg-gray-800">
      <h3 className="mb-4 flex items-center border-b border-gray-200 pb-2 text-lg font-semibold text-gray-800 dark:border-gray-700 dark:text-white">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="mr-2 h-5 w-5 text-indigo-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
        名前空間管理 (clearNamespace)
      </h3>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-md border p-3 dark:border-gray-700">
          <h4 className="mb-2 flex items-center font-medium text-gray-800 dark:text-white">
            <span className="mr-2 h-3 w-3 rounded-full bg-blue-500"></span>
            ユーザー名前空間
          </h4>

          <div className="mb-3 flex gap-2">
            {userEvents ? (
              <button
                onClick={clearUserNamespace}
                className="rounded bg-red-100 px-3 py-1.5 text-sm text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-800"
              >
                user:名前空間をクリア
              </button>
            ) : (
              <button
                onClick={restoreUserNamespace}
                className="rounded bg-green-100 px-3 py-1.5 text-sm text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-800"
              >
                user:名前空間を復元
              </button>
            )}
          </div>

          <div className="rounded bg-gray-50 p-2 text-xs dark:bg-gray-700">
            状態: {userEvents ? "アクティブ" : "クリア済み"}
          </div>
        </div>

        <div className="rounded-md border p-3 dark:border-gray-700">
          <h4 className="mb-2 flex items-center font-medium text-gray-800 dark:text-white">
            <span className="mr-2 h-3 w-3 rounded-full bg-purple-500"></span>
            UI名前空間
          </h4>

          <div className="mb-3 flex gap-2">
            {uiEvents ? (
              <button
                onClick={clearUiNamespace}
                className="rounded bg-red-100 px-3 py-1.5 text-sm text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-800"
              >
                ui:名前空間をクリア
              </button>
            ) : (
              <button
                onClick={restoreUiNamespace}
                className="rounded bg-green-100 px-3 py-1.5 text-sm text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-800"
              >
                ui:名前空間を復元
              </button>
            )}
          </div>

          <div className="rounded bg-gray-50 p-2 text-xs dark:bg-gray-700">
            状態: {uiEvents ? "アクティブ" : "クリア済み"}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <h4 className="mb-2 font-medium text-gray-800 dark:text-white">現在のサブスクライバー:</h4>
        <div className="max-h-36 overflow-y-auto rounded-md bg-gray-50 p-3 text-sm dark:bg-gray-700">
          {Object.keys(subscribers).length > 0 ? (
            <ul className="space-y-1">
              {Object.entries(subscribers).map(([event, count]) => (
                <li key={event} className="flex justify-between">
                  <span
                    className={`font-mono ${
                      event.startsWith("user")
                        ? "text-blue-600 dark:text-blue-400"
                        : event.startsWith("ui")
                          ? "text-purple-600 dark:text-purple-400"
                          : event.startsWith("[wildcard]")
                            ? "text-green-600 dark:text-green-400"
                            : "text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {event}
                  </span>
                  <span className="rounded-full bg-gray-200 px-2 text-xs dark:bg-gray-600">{count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-gray-500 italic dark:text-gray-400">サブスクライバーが存在しません</p>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * イベント履歴の表示（getRecentEvents/getEventHistory）
 */
function EventHistoryViewer() {
  const [recentEvents, setRecentEvents] = useState<
    Array<{
      timestamp: number
      event: string
      data: any
      subscribersCount: number
    }>
  >([])

  const [isHistoryEnabled, setIsHistoryEnabled] = useState(false)

  // デバッグモードの切り替え機能
  const toggleDebugMode = () => {
    // 注: 実際のアプリでは環境変数をランタイムで変更する方法はないため、
    // これはデモ用の簡易的な実装です
    setIsHistoryEnabled((prev) => !prev)

    // ダミーのイベント履歴を生成
    if (!isHistoryEnabled) {
      setRecentEvents([
        {
          timestamp: Date.now() - 5000,
          event: "app:initialized",
          data: { timestamp: Date.now() - 5000 },
          subscribersCount: 3,
        },
        {
          timestamp: Date.now() - 4000,
          event: "user:login",
          data: { userId: "user123", timestamp: Date.now() - 4000 },
          subscribersCount: 2,
        },
        {
          timestamp: Date.now() - 3000,
          event: "ui:theme:changed",
          data: { theme: "dark" },
          subscribersCount: 1,
        },
        {
          timestamp: Date.now() - 2000,
          event: "data:loaded",
          data: { source: "api", items: [{ id: 1, name: "商品A" }] },
          subscribersCount: 2,
        },
      ])
    } else {
      setRecentEvents([])
    }
  }

  // 最新イベントを取得
  const refreshEvents = () => {
    if (isHistoryEnabled) {
      // 実際のアプリでは以下のようになりますが、デモ用に静的データを使用します
      // const events = pubSub.getRecentEvents(10);
      // setRecentEvents(events);

      // ダミーデータに新しいイベントを追加
      const newEvent = {
        timestamp: Date.now(),
        event: ["user:login", "ui:theme:changed", "data:loaded", "app:error"][Math.floor(Math.random() * 4)],
        data: { timestamp: Date.now() },
        subscribersCount: Math.floor(Math.random() * 5) + 1,
      }

      setRecentEvents((prev) => [newEvent, ...prev.slice(0, 9)])
    }
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow-md transition-all duration-300 dark:bg-gray-800">
      <h3 className="mb-4 flex items-center border-b border-gray-200 pb-2 text-lg font-semibold text-gray-800 dark:border-gray-700 dark:text-white">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="mr-2 h-5 w-5 text-green-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
        </svg>
        イベント履歴 (getRecentEvents)
      </h3>

      <div className="mb-4 flex gap-2">
        <button
          onClick={toggleDebugMode}
          className={`rounded-md px-4 py-2 text-sm transition-colors duration-200 ${
            isHistoryEnabled
              ? "bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-800"
              : "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-800"
          }`}
        >
          {isHistoryEnabled ? "デバッグモード無効化" : "デバッグモード有効化"}
        </button>

        <button
          onClick={refreshEvents}
          disabled={!isHistoryEnabled}
          className={`rounded-md px-4 py-2 text-sm transition-colors duration-200 ${
            !isHistoryEnabled
              ? "cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500"
              : "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800"
          }`}
        >
          履歴を更新
        </button>
      </div>

      {isHistoryEnabled ? (
        <div className="overflow-hidden rounded-md border dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-300">
                  時間
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-300">
                  イベント
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-300">
                  購読数
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {recentEvents.map((event, index) => (
                <tr key={index} className={index === 0 ? "bg-blue-50 dark:bg-blue-900/20" : ""}>
                  <td className="px-4 py-2 font-mono text-sm text-gray-500 dark:text-gray-400">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-sm font-medium ${
                        event.event.includes("login")
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : event.event.includes("theme")
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                            : event.event.includes("error")
                              ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                      }`}
                    >
                      {event.event}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 dark:bg-gray-700">
                      {event.subscribersCount}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {recentEvents.length === 0 && (
            <div className="py-8 text-center text-gray-500 italic dark:text-gray-400">イベント履歴はありません</div>
          )}
        </div>
      ) : (
        <div className="rounded-md bg-gray-50 p-4 text-center dark:bg-gray-700">
          <p className="mb-2 text-gray-600 dark:text-gray-300">デバッグモードが無効です</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            履歴を表示するには、デバッグモードを有効にしてください
          </p>
        </div>
      )}

      <div className="mt-4 rounded bg-gray-50 p-2 text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-400">
        注: 実際のアプリケーションでは、<code>getRecentEvents</code>と<code>getEventHistory</code>
        メソッドはデバッグモードが有効な場合のみ機能します。
      </div>
    </div>
  )
}

/**
 * ワイルドカードパターンの使用例
 */
function WildcardSubscriptionDemo() {
  const [notifications, setNotifications] = useState<
    Array<{
      id: string
      message: string
      type: string
      time: string
    }>
  >([])

  // ワイルドカード購読の状態
  const [userWildcardActive, setUserWildcardActive] = useState(false)
  const [uiWildcardActive, setUiWildcardActive] = useState(false)

  // ワイルドカード購読への参照
  const userWildcardRef = useRef<(() => void) | null>(null)
  const uiWildcardRef = useRef<(() => void) | null>(null)

  // 通知を追加する関数
  const addNotification = useCallback((type: string, message: string) => {
    const id = `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`

    setNotifications((prev) => [
      {
        id,
        message,
        type,
        time: new Date().toLocaleTimeString(),
      },
      ...prev.slice(0, 9), // 最大10件まで
    ])
  }, [])

  // ユーザー関連イベントのワイルドカード購読を設定
  const subscribeToUserEvents = useCallback(() => {
    if (userWildcardRef.current) return

    // "user:"で始まるすべてのイベントを購読
    const unsubscribe = pubSub.on("user:*", (data: any) => {
      const eventName = data.eventName || "不明なユーザーイベント"
      addNotification("user", `ユーザーイベント「${eventName}」が発生しました`)
    })

    userWildcardRef.current = unsubscribe
    setUserWildcardActive(true)

    // テスト用に購読設定を通知
    addNotification("system", "user:*ワイルドカードリスナーが登録されました")
  }, [addNotification])

  // UI関連イベントのワイルドカード購読を設定
  const subscribeToUiEvents = useCallback(() => {
    if (uiWildcardRef.current) return

    // "ui:"で始まるすべてのイベントを購読
    const unsubscribe = pubSub.on("ui:*", (data: any) => {
      const eventName = data.eventName || "不明なUIイベント"
      addNotification("ui", `UIイベント「${eventName}」が発生しました`)
    })

    uiWildcardRef.current = unsubscribe
    setUiWildcardActive(true)

    // テスト用に購読設定を通知
    addNotification("system", "ui:*ワイルドカードリスナーが登録されました")
  }, [addNotification])

  // ユーザー関連イベントのワイルドカード購読を解除
  const unsubscribeFromUserEvents = useCallback(() => {
    if (userWildcardRef.current) {
      userWildcardRef.current()
      userWildcardRef.current = null
      setUserWildcardActive(false)

      // テスト用に購読解除を通知
      addNotification("system", "user:*ワイルドカードリスナーが解除されました")
    }
  }, [addNotification])

  // UI関連イベントのワイルドカード購読を解除
  const unsubscribeFromUiEvents = useCallback(() => {
    if (uiWildcardRef.current) {
      uiWildcardRef.current()
      uiWildcardRef.current = null
      setUiWildcardActive(false)

      // テスト用に購読解除を通知
      addNotification("system", "ui:*ワイルドカードリスナーが解除されました")
    }
  }, [addNotification])

  // ダミーのユーザーイベントを発生させる
  const triggerUserEvent = () => {
    const events = [
      {
        name: "user:profile:view",
        data: { userId: "user123", section: "profile" },
      },
      {
        name: "user:avatar:update",
        data: { userId: "user123", newAvatar: "avatar2.jpg" },
      },
      {
        name: "user:friends:added",
        data: { userId: "user123", friendId: "user456" },
      },
    ]

    const selectedEvent = events[Math.floor(Math.random() * events.length)]
    pubSub.emit(selectedEvent.name as any, {
      ...selectedEvent.data,
      eventName: selectedEvent.name,
      timestamp: Date.now(),
    })
  }

  // ダミーのUIイベントを発生させる
  const triggerUiEvent = () => {
    const events = [
      { name: "ui:panel:expand", data: { panelId: "sidebar", expanded: true } },
      {
        name: "ui:notification:show",
        data: { message: "新しい通知があります" },
      },
      {
        name: "ui:animation:complete",
        data: { elementId: "header", animation: "fade" },
      },
    ]

    const selectedEvent = events[Math.floor(Math.random() * events.length)]
    pubSub.emit(selectedEvent.name as any, {
      ...selectedEvent.data,
      eventName: selectedEvent.name,
      timestamp: Date.now(),
    })
  }

  // コンポーネントのクリーンアップ
  useEffect(() => {
    return () => {
      if (userWildcardRef.current) {
        userWildcardRef.current()
      }
      if (uiWildcardRef.current) {
        uiWildcardRef.current()
      }
    }
  }, [])

  return (
    <div className="rounded-lg bg-white p-6 shadow-md transition-all duration-300 dark:bg-gray-800">
      <h3 className="mb-4 flex items-center border-b border-gray-200 pb-2 text-lg font-semibold text-gray-800 dark:border-gray-700 dark:text-white">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="mr-2 h-5 w-5 text-amber-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
          />
        </svg>
        ワイルドカードパターン (*)
      </h3>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-md border p-3 dark:border-gray-700">
          <h4 className="mb-2 font-medium text-gray-800 dark:text-white">ユーザーイベント購読</h4>
          <div className="mb-3 flex flex-wrap gap-2">
            {userWildcardActive ? (
              <button
                onClick={unsubscribeFromUserEvents}
                className="rounded bg-red-100 px-3 py-1.5 text-sm text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-800"
              >
                購読解除
              </button>
            ) : (
              <button
                onClick={subscribeToUserEvents}
                className="rounded bg-blue-100 px-3 py-1.5 text-sm text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800"
              >
                ワイルドカード購読 (user:*)
              </button>
            )}

            <button
              onClick={triggerUserEvent}
              className="rounded bg-green-100 px-3 py-1.5 text-sm text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-800"
            >
              ランダムなユーザーイベント発生
            </button>
          </div>

          <div
            className={`inline-block rounded-full px-2 py-1 text-xs ${
              userWildcardActive
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
            }`}
          >
            {userWildcardActive ? "監視中" : "監視停止"}
          </div>
        </div>

        <div className="rounded-md border p-3 dark:border-gray-700">
          <h4 className="mb-2 font-medium text-gray-800 dark:text-white">UIイベント購読</h4>
          <div className="mb-3 flex flex-wrap gap-2">
            {uiWildcardActive ? (
              <button
                onClick={unsubscribeFromUiEvents}
                className="rounded bg-red-100 px-3 py-1.5 text-sm text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-800"
              >
                購読解除
              </button>
            ) : (
              <button
                onClick={subscribeToUiEvents}
                className="rounded bg-blue-100 px-3 py-1.5 text-sm text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800"
              >
                ワイルドカード購読 (ui:*)
              </button>
            )}

            <button
              onClick={triggerUiEvent}
              className="rounded bg-purple-100 px-3 py-1.5 text-sm text-purple-800 hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-200 dark:hover:bg-purple-800"
            >
              ランダムなUIイベント発生
            </button>
          </div>

          <div
            className={`inline-block rounded-full px-2 py-1 text-xs ${
              uiWildcardActive
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
            }`}
          >
            {uiWildcardActive ? "監視中" : "監視停止"}
          </div>
        </div>
      </div>

      <div className="rounded-md border p-3 dark:border-gray-700">
        <h4 className="mb-2 flex items-center font-medium text-gray-800 dark:text-white">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mr-1 h-4 w-4 text-blue-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          通知リスト
        </h4>

        <div className="custom-scrollbar max-h-60 overflow-y-auto pr-1">
          {notifications.length === 0 ? (
            <div className="py-4 text-center text-gray-500 italic dark:text-gray-400">通知はありません</div>
          ) : (
            <ul className="space-y-2">
              {notifications.map((notification) => (
                <li
                  key={notification.id}
                  className="rounded border border-gray-100 bg-white p-2 shadow-sm dark:border-gray-700 dark:bg-gray-700"
                >
                  <div className="flex items-start justify-between">
                    <span
                      className={`rounded-sm px-1.5 py-0.5 text-xs font-medium ${
                        notification.type === "user"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200"
                          : notification.type === "ui"
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200"
                      }`}
                    >
                      {notification.type}
                    </span>
                    <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{notification.time}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{notification.message}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-4 rounded bg-gray-50 p-2 text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-400">
        <p>ワイルドカード機能を使用すると、特定のパターンに一致するすべてのイベントを一度に購読できます。</p>
        <p className="mt-1">
          例: <code>user:*</code>は<code>user:login</code>、<code>user:logout</code>
          などすべてのユーザー関連イベントに一致します。
        </p>
      </div>
    </div>
  )
}
/**
 * サーバー連携コンポーネント - PubSubイベントをSSEサーバーに転送
 */
function ServerEventSync() {
  const [syncStatus, setSyncStatus] = useState<"idle" | "sending" | "success" | "error">("idle")
  const [lastSyncedEvent, setLastSyncedEvent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // サーバーにイベントを送信する関数
  const sendEventToServer = useCallback(async (eventName: string, eventData: any) => {
    setSyncStatus("sending")
    setError(null)

    try {
      const response = await fetch("/api/demo/sse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: eventName,
          data: eventData,
        }),
      })

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        setSyncStatus("success")
        setLastSyncedEvent(eventName)

        // 5秒後に状態をリセット
        setTimeout(() => {
          setSyncStatus("idle")
        }, 5000)
      } else {
        throw new Error(result.error || "Unknown error")
      }
    } catch (err) {
      setSyncStatus("error")
      setError(err instanceof Error ? err.message : String(err))

      // 5秒後に状態をリセット
      setTimeout(() => {
        setSyncStatus("idle")
      }, 5000)
    }
  }, [])

  // PubSubイベントを監視してサーバーに転送
  useEffect(() => {
    // 監視する重要なイベント
    const trackedEvents = [
      "user:login",
      "user:logout",
      "user:preferences:changed",
      "ui:theme:changed",
      "app:error",
      "data:loaded",
    ]

    // 各イベントにリスナーを設定
    const unsubscribers = trackedEvents.map((eventName) =>
      pubSub.on(eventName as any, (data: any) => {
        console.log(`Forwarding event to SSE server: ${eventName}`, data)
        sendEventToServer(eventName, data)
      }),
    )

    // クリーンアップ
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  }, [sendEventToServer])

  // ステータスアイコンを取得
  const getStatusIcon = () => {
    switch (syncStatus) {
      case "idle":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7h12m0 0l-4-4m4 4l-4 4m-4 6H4m0 0l4 4m-4-4l4-4"
            />
          </svg>
        )
      case "sending":
        return (
          <svg
            className="h-5 w-5 animate-spin text-blue-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        )
      case "success":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )
      case "error":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        )
    }
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow-md transition-all duration-300 dark:bg-gray-800">
      <h3 className="mb-4 flex items-center border-b border-gray-200 pb-2 text-lg font-semibold text-gray-800 dark:border-gray-700 dark:text-white">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="mr-2 h-5 w-5 text-blue-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
          />
        </svg>
        SSEサーバー連携
      </h3>

      <div
        className={`flex items-center justify-between rounded-md p-3 ${
          syncStatus === "idle"
            ? "bg-gray-50 dark:bg-gray-700"
            : syncStatus === "sending"
              ? "bg-blue-50 dark:bg-blue-900/30"
              : syncStatus === "success"
                ? "bg-green-50 dark:bg-green-900/30"
                : "bg-red-50 dark:bg-red-900/30"
        }`}
      >
        <div className="flex items-center">
          {getStatusIcon()}
          <div className="ml-3">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {syncStatus === "idle" && "待機中"}
              {syncStatus === "sending" && "サーバーに送信中..."}
              {syncStatus === "success" && "送信成功"}
              {syncStatus === "error" && "送信エラー"}
            </div>
            {lastSyncedEvent && syncStatus === "success" && (
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                最後に同期したイベント:{" "}
                <span className="rounded bg-gray-100 px-1 font-mono dark:bg-gray-600">{lastSyncedEvent}</span>
              </div>
            )}
            {error && <div className="mt-1 text-xs text-red-600 dark:text-red-400">エラー: {error}</div>}
          </div>
        </div>

        <div>
          <button
            onClick={() =>
              sendEventToServer("manual:test", {
                message: "テストイベント",
                timestamp: Date.now(),
              })
            }
            disabled={syncStatus === "sending"}
            className={`rounded px-3 py-1 text-xs ${
              syncStatus === "sending"
                ? "cursor-not-allowed bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                : "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800"
            }`}
          >
            テスト送信
          </button>
        </div>
      </div>

      <div className="mt-4 rounded bg-gray-50 p-2 text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-400">
        <p>このコンポーネントはPubSubイベントをSSEサーバーに転送し、SSEページで表示できるようにします</p>
        <p className="mt-1">
          監視対象: <code>user:login</code>, <code>user:logout</code>, <code>ui:theme:changed</code>など
        </p>
      </div>
    </div>
  )
}

/**
 * メインのデモアプリケーション
 */
export default function Page() {
  // アプリの初期化イベントを発行
  useEffect(() => {
    pubSub.emit("app:initialized", { timestamp: Date.now() })
  }, [])

  // ユーザーログインのシミュレーション
  const simulateLogin = () => {
    pubSub.emit("user:login", { userId: "user123", timestamp: Date.now() })
  }

  // ユーザーログアウトのシミュレーション
  const simulateLogout = () => {
    pubSub.emit("user:logout", { userId: "user123", timestamp: Date.now() })
  }

  // ユーザー設定変更のシミュレーション
  const simulatePreferencesChange = () => {
    pubSub.emit("user:preferences:changed", {
      userId: "user123",
      preferences: {
        notifications: true,
        language: "ja",
      },
    })
  }

  // アプリエラーのシミュレーション
  const simulateError = () => {
    pubSub.emit("app:error", {
      message: "Something went wrong",
      code: 500,
      stack: "Error: Something went wrong\n    at simulateError (PubSubExample.tsx:123)",
    })
  }

  return (
    <div className="mx-auto min-h-screen max-w-6xl bg-gray-50 px-4 py-8 dark:bg-gray-900">
      {/* ヘッダー部分 (既存) */}
      <div className="mb-8 rounded-lg bg-linear-to-r from-blue-500 to-purple-600 p-6 text-white shadow-lg">
        <h2 className="mb-2 flex items-center text-2xl font-bold md:text-3xl">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mr-3 h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          PubSub システムデモ
        </h2>
        <p className="text-sm text-blue-100 md:text-base">
          イベント駆動型アプリケーションの構築パターンを実演するリアルタイムデモです。
          各コンポーネントは独立して動作しながらイベントを通じて連携します。
        </p>
      </div>

      {/* サーバー連携セクション - 新規追加 */}
      <div className="mb-8">
        <h3 className="mb-4 flex items-center text-xl font-bold text-gray-800 dark:text-white">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mr-2 h-6 w-6 text-teal-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
            />
          </svg>
          サーバー連携機能
        </h3>

        <div className="mb-6 rounded-lg bg-linear-to-r from-teal-500 to-blue-600 p-4 text-white">
          <p className="text-sm">
            PubSubイベントをサーバーサイドに送信し、SSEを通じて他のクライアントと共有する機能です。
            <a href="/demo/sse/pure" className="ml-1 font-medium underline">
              SSEページ
            </a>
            で最新イベントを確認できます。
          </p>
        </div>

        <ServerEventSync />
      </div>

      {/* テストイベントボタン (既存) */}
      <div className="mb-8 rounded-lg bg-white p-6 shadow-md transition-all duration-300 dark:bg-gray-800">
        <h3 className="mb-4 flex items-center text-lg font-semibold text-gray-800 dark:text-white">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mr-2 h-6 w-6 text-blue-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
            />
          </svg>
          テストイベント
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button
            onClick={simulateLogin}
            className="flex items-center justify-center rounded-md bg-green-100 px-4 py-3 font-medium text-green-800 transition-colors duration-200 hover:bg-green-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mr-2 h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
              />
            </svg>
            ログインシミュレート
          </button>
          <button
            onClick={simulateLogout}
            className="flex items-center justify-center rounded-md bg-red-100 px-4 py-3 font-medium text-red-800 transition-colors duration-200 hover:bg-red-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mr-2 h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            ログアウトシミュレート
          </button>
          <button
            onClick={simulatePreferencesChange}
            className="flex items-center justify-center rounded-md bg-blue-100 px-4 py-3 font-medium text-blue-800 transition-colors duration-200 hover:bg-blue-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mr-2 h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            設定変更シミュレート
          </button>
          <button
            onClick={simulateError}
            className="flex items-center justify-center rounded-md bg-yellow-100 px-4 py-3 font-medium text-yellow-800 transition-colors duration-200 hover:bg-yellow-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mr-2 h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            エラーシミュレート
          </button>
        </div>
      </div>

      {/* 基本コンポーネント (既存) */}
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <UserAuthMonitor />
        <ThemeSelector />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <DataLoadingExample />
        <UserEventsMonitor />
      </div>

      {/* 高度なPubSub機能セクション (新規追加) */}
      <div className="mb-6">
        <h3 className="mb-4 flex items-center text-xl font-bold text-gray-800 dark:text-white">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mr-2 h-6 w-6 text-indigo-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          高度なPubSub機能
        </h3>

        <div className="mb-6 rounded-lg bg-linear-to-r from-indigo-500 to-purple-600 p-4 text-white">
          <p className="text-sm">
            以下のコンポーネントは、PubSubシステムの高度な機能（イベント待機、名前空間管理、ワイルドカードパターン、イベント履歴）を実演します。
          </p>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <AsyncEventWaiter />
          <EventNamespaceManager />
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <WildcardSubscriptionDemo />
          <EventHistoryViewer />
        </div>
      </div>

      {/* フッター部分 (既存) */}
      <div className="mt-12 pb-8 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>PubSubパターンを活用した効率的なコンポーネント間通信のデモ</p>
        <p className="mt-1">© {new Date().getFullYear()} Hono Sample App</p>
      </div>
    </div>
  )
}
