"use client"
import { useServiceWorker } from "@/hooks/useWorker"
import React, { useCallback, useEffect, useMemo, useState } from "react"

interface AnimatedItem {
  name: string
  items: { url: string; isNew: boolean }[]
  isNew?: boolean
}

/**
 * useServiceWorkerの詳細デモページ
 */
export default function ServiceWorkerDemoPage() {
  // 状態
  const [logs, setLogs] = useState<string[]>([])
  const [message, setMessage] = useState<string>("")
  const [cacheName, setCacheName] = useState<string>("")
  const [activeTab, setActiveTab] = useState<string>("basic")

  // Service Workerフックの利用（すべての機能を取得）
  const {
    // 状態
    isSupported,
    isRegistered,
    isUpdating,
    isError,
    error,
    registration,
    controller,

    // メソッド
    register,
    unregister,
    update,
    sendMessage,
    subscribeToMessage,
    checkForUpdates,
    skipWaiting,
    clearCache,
  } = useServiceWorker()

  // ログメッセージを表示
  const logMessage = useCallback((message: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
  }, [])

  // Service Workerの登録
  const handleRegister = useCallback(async () => {
    try {
      logMessage("Service Workerを登録中...")
      const reg = await register({
        path: "/sw.js",
        immediate: true,
        debug: true,
      })

      if (reg) {
        logMessage("Service Worker登録成功!")
      } else {
        logMessage("Service Worker登録失敗")
      }
    } catch (error) {
      logMessage(`Service Worker登録エラー: ${error}`)
    }
  }, [register, logMessage])

  // Service Workerの登録解除
  const handleUnregister = useCallback(async () => {
    try {
      logMessage("Service Workerを登録解除中...")
      const success = await unregister()
      logMessage(success ? "登録解除成功!" : "登録解除失敗")
    } catch (error) {
      logMessage(`登録解除エラー: ${error}`)
    }
  }, [unregister, logMessage])

  // Service Workerの更新チェック
  const handleCheckUpdates = useCallback(async () => {
    try {
      logMessage("更新をチェック中...")
      const hasUpdate = await checkForUpdates()
      logMessage(hasUpdate ? "更新が見つかりました!" : "更新はありません")
    } catch (error) {
      logMessage(`更新チェックエラー: ${error}`)
    }
  }, [checkForUpdates, logMessage])

  // skipWaiting実行
  const handleSkipWaiting = useCallback(async () => {
    try {
      logMessage("待機中のService Workerをアクティブ化中...")
      await skipWaiting()
      logMessage("アクティブ化リクエスト送信済み（ページがリロードされます）")
    } catch (error) {
      logMessage(`アクティブ化エラー: ${error}`)
    }
  }, [skipWaiting, logMessage])

  // キャッシュステート
  const [cacheInfo, setCacheInfo] = useState<any>(null)
  const [isLoadingCache, setIsLoadingCache] = useState<boolean>(false)
  const [visualFeedback, setVisualFeedback] = useState<{
    type: "success" | "error" | "info"
    message: string
  } | null>(null)
  const CACHE_NAME = "demo-cache-v1" // Service Workerと同じキャッシュ名
  const [animatedItems, setAnimatedItems] = useState<AnimatedItem[]>([])

  // キャッシュ情報を取得する関数
  const fetchCacheInfo = useCallback(async () => {
    if (!isRegistered) return

    setIsLoadingCache(true)
    try {
      logMessage("キャッシュ情報を取得中...")
      const result = await sendMessage<null, { cacheInfo: any }>({
        type: "GET_CACHE_INFO",
      })

      if (result?.cacheInfo) {
        setCacheInfo(result.cacheInfo)
        logMessage(`${result.cacheInfo.totalCaches}個のキャッシュが見つかりました`)
      } else {
        setCacheInfo(null)
        logMessage("キャッシュ情報の取得に失敗しました")
      }
    } catch (error) {
      logMessage(`キャッシュ情報取得エラー: ${error}`)
    } finally {
      setIsLoadingCache(false)
    }
  }, [isRegistered, sendMessage, logMessage])

  // デモ用キャッシュアイテムを追加
  const handleAddDemoCache = useCallback(async () => {
    if (!isRegistered) return

    try {
      const urlToCache = `/demo-asset-${Date.now()}.html`
      logMessage(`デモキャッシュアイテムを追加中: ${urlToCache}`)

      setVisualFeedback({
        type: "info",
        message: "キャッシュアイテムを追加しています...",
      })

      const result = await sendMessage<{ url: string; cacheName: string }, any>({
        type: "CACHE_DEMO_ITEM",
        payload: {
          url: window.location.origin + urlToCache,
          cacheName: CACHE_NAME,
        },
      })

      if (result?.success) {
        logMessage("デモキャッシュアイテム追加成功")

        // アニメーション効果で成功をハイライト
        setVisualFeedback({
          type: "success",
          message: `キャッシュアイテムを追加しました: ${urlToCache}`,
        })

        // キャッシュ情報を更新
        await fetchCacheInfo()

        // 新しいアイテムを視覚的にハイライト
        if (cacheInfo?.details) {
          const targetCacheIndex = cacheInfo.details.findIndex(
            (c: CacheInfo["details"][number]) => c.name === CACHE_NAME,
          )

          if (targetCacheIndex >= 0) {
            const newAnimatedItems = [...animatedItems]
            if (!newAnimatedItems[targetCacheIndex]) {
              newAnimatedItems[targetCacheIndex] = {
                name: CACHE_NAME,
                items: [],
              }
            }

            // 最新のアイテムをハイライト
            newAnimatedItems[targetCacheIndex].items.unshift({
              url: urlToCache,
              isNew: true,
            })

            setAnimatedItems(newAnimatedItems)

            // ハイライトを一定時間後に解除
            setTimeout(() => {
              setAnimatedItems((prev) => {
                const updated = [...prev]
                if (updated[targetCacheIndex]) {
                  updated[targetCacheIndex].items = updated[targetCacheIndex].items.map((item) => ({
                    ...item,
                    isNew: false,
                  }))
                }
                return updated
              })
            }, 2000)
          }
        }
      } else {
        logMessage(`デモキャッシュアイテム追加失敗: ${result?.error || "不明なエラー"}`)
        setVisualFeedback({
          type: "error",
          message: `追加失敗: ${result?.error || "不明なエラー"}`,
        })
      }
    } catch (error) {
      logMessage(`キャッシュ追加エラー: ${error}`)
      setVisualFeedback({
        type: "error",
        message: `エラー: ${error instanceof Error ? error.message : String(error)}`,
      })
    }
  }, [isRegistered, sendMessage, logMessage, fetchCacheInfo, CACHE_NAME, cacheInfo, animatedItems])

  // キャッシュクリア処理の強化
  const handleClearCache = useCallback(async () => {
    try {
      const target = cacheName.trim() || undefined
      logMessage(`キャッシュをクリア中...${target ? `(${target})` : "(すべて)"}`)

      setVisualFeedback({
        type: "info",
        message: target ? `キャッシュ "${target}" をクリア中...` : "すべてのキャッシュをクリア中...",
      })

      // キャッシュ項目を「削除中」の視覚効果で表示
      setAnimatedItems((current) =>
        current.map((cache) => {
          if (!target || cache.name === target) {
            return {
              ...cache,
              isClearing: true,
              items: cache.items.map((item) => ({ ...item, isClearing: true })),
            }
          }
          return cache
        }),
      )

      // 削除アニメーション用の短い遅延
      await new Promise((resolve) => setTimeout(resolve, 600))

      // 実際のキャッシュクリア
      const success = await clearCache(target)

      if (success) {
        logMessage(`キャッシュクリア成功!`)
        setVisualFeedback({
          type: "success",
          message: target ? `キャッシュ "${target}" を削除しました` : "すべてのキャッシュを削除しました",
        })

        // クリア後の状態を表示するためにキャッシュ情報を更新
        setTimeout(() => {
          fetchCacheInfo()
          setCacheName("") // 入力フィールドをクリア
        }, 500)
      } else {
        logMessage("キャッシュクリア失敗")
        setVisualFeedback({
          type: "error",
          message: "キャッシュのクリアに失敗しました",
        })

        // クリア失敗したので「削除中」効果を解除
        setAnimatedItems((current) =>
          current.map((cache) => ({
            ...cache,
            isClearing: false,
            items: cache.items.map((item) => ({ ...item, isClearing: false })),
          })),
        )
      }
    } catch (error) {
      logMessage(`キャッシュクリアエラー: ${error}`)
      setVisualFeedback({
        type: "error",
        message: `エラー: ${error instanceof Error ? error.message : String(error)}`,
      })
    }
  }, [clearCache, cacheName, logMessage, fetchCacheInfo])

  // タブ変更時にキャッシュ情報を自動取得
  useEffect(() => {
    if (activeTab === "cache" && isRegistered) {
      fetchCacheInfo()
    }
  }, [activeTab, isRegistered, fetchCacheInfo])

  // フィードバック表示のクリア
  useEffect(() => {
    if (visualFeedback) {
      const timer = setTimeout(() => {
        setVisualFeedback(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [visualFeedback])

  // メッセージ送信
  const handleSendMessage = useCallback(async () => {
    try {
      if (!isRegistered) {
        logMessage("Service Workerが登録されていません")
        return
      }

      logMessage(`メッセージを送信: ${message}`)
      const response = await sendMessage<{ text: string }, { result: string }>({
        type: "ECHO",
        payload: { text: message },
      })

      logMessage(`応答受信: ${JSON.stringify(response)}`)
    } catch (error) {
      logMessage(`メッセージエラー: ${error}`)
    }
  }, [isRegistered, message, sendMessage, logMessage])

  // Service Workerのイベント購読
  useEffect(() => {
    if (isRegistered) {
      // 複数のイベントタイプを購読
      const subscriptions = [
        subscribeToMessage("CACHE_UPDATED", (data) => {
          logMessage(`キャッシュ更新通知: ${JSON.stringify(data)}`)
        }),
        subscribeToMessage("SW_UPDATED", () => {
          logMessage("Service Worker更新通知: 新しいバージョンが利用可能です")
        }),
        subscribeToMessage("SW_ERROR", (data) => {
          logMessage(`Service Workerエラー通知: ${JSON.stringify(data)}`)
        }),
      ]

      // すべての購読をクリーンアップ
      return () => subscriptions.forEach((unsubscribe) => unsubscribe())
    }
  }, [isRegistered, subscribeToMessage, logMessage])

  // エラー状態の監視
  useEffect(() => {
    if (isError && error) {
      logMessage(`Service Workerエラー: ${error.message}`)
    }
  }, [isError, error, logMessage])

  // ステータス情報をメモ化
  const statusInfo = useMemo(() => {
    return [
      {
        label: "サポート状態",
        value: isSupported ? "サポート" : "未サポート",
        status: isSupported ? "green" : "red",
      },
      {
        label: "登録状態",
        value: isRegistered ? "登録済み" : "未登録",
        status: isRegistered ? "green" : "yellow",
      },
      {
        label: "更新中",
        value: isUpdating ? "はい" : "いいえ",
        status: isUpdating ? "blue" : "gray",
      },
      {
        label: "エラー",
        value: isError ? "発生" : "なし",
        status: isError ? "red" : "green",
      },
      {
        label: "コントローラー",
        value: controller ? "アクティブ" : "なし",
        status: controller ? "green" : "yellow",
      },
    ]
  }, [isSupported, isRegistered, isUpdating, isError, controller])

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-6 text-2xl font-bold">Service Worker 詳細デモ</h1>
      {/* タブパネル */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex flex-wrap">
            <button
              onClick={() => setActiveTab("basic")}
              className={`mr-2 rounded-t-lg px-4 py-2 text-sm leading-5 font-medium ${
                activeTab === "basic" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              基本情報
            </button>
            <button
              onClick={() => setActiveTab("messaging")}
              className={`mr-2 rounded-t-lg px-4 py-2 text-sm leading-5 font-medium ${
                activeTab === "messaging"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              メッセージング
            </button>
            <button
              onClick={() => setActiveTab("cache")}
              className={`mr-2 rounded-t-lg px-4 py-2 text-sm leading-5 font-medium ${
                activeTab === "cache" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              キャッシュ操作
            </button>
            <button
              onClick={() => setActiveTab("advanced")}
              className={`mr-2 rounded-t-lg px-4 py-2 text-sm leading-5 font-medium ${
                activeTab === "advanced"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              高度な操作
            </button>
          </nav>
        </div>
      </div>
      {/* 基本情報パネル */}
      {activeTab === "basic" && (
        <div className="mb-6 rounded-lg border bg-white p-4">
          <h2 className="mb-4 text-xl font-semibold">基本情報</h2>

          <div className="mb-4">
            <h3 className="text-md mb-2 font-medium">ステータス</h3>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {statusInfo.map((item, index) => (
                <div key={index} className="flex items-center rounded bg-gray-50 p-2">
                  <span className="min-w-[120px] text-sm font-medium">{item.label}:</span>
                  <span
                    className={`ml-2 rounded px-2 py-1 text-xs ${
                      item.status === "green"
                        ? "bg-green-100 text-green-800"
                        : item.status === "red"
                          ? "bg-red-100 text-red-800"
                          : item.status === "yellow"
                            ? "bg-yellow-100 text-yellow-800"
                            : item.status === "blue"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <button
              onClick={handleRegister}
              disabled={!isSupported || isRegistered}
              className="rounded bg-blue-500 px-3 py-2 text-sm text-white hover:bg-blue-600 disabled:bg-gray-300"
            >
              登録
            </button>
            <button
              onClick={handleUnregister}
              disabled={!isRegistered}
              className="rounded bg-yellow-500 px-3 py-2 text-sm text-white hover:bg-yellow-600 disabled:bg-gray-300"
            >
              登録解除
            </button>
            <button
              onClick={handleCheckUpdates}
              disabled={!isRegistered}
              className="rounded bg-green-500 px-3 py-2 text-sm text-white hover:bg-green-600 disabled:bg-gray-300"
            >
              更新チェック
            </button>
          </div>

          {registration && (
            <div className="mt-4 rounded border bg-gray-50 p-3">
              <h3 className="text-md mb-2 font-medium">登録情報</h3>
              <div className="overflow-x-auto rounded bg-white p-2 font-mono text-xs">
                <pre>
                  {JSON.stringify(
                    {
                      scope: registration.scope,
                      active: !!registration.active,
                      waiting: !!registration.waiting,
                      installing: !!registration.installing,
                      updateViaCache: registration.updateViaCache,
                    },
                    null,
                    2,
                  )}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
      {/* メッセージングパネル */}
      {activeTab === "messaging" && (
        <div className="mb-6 rounded-lg border bg-white p-4">
          <h2 className="mb-4 text-xl font-semibold">メッセージング</h2>

          <div className="mb-4">
            <h3 className="text-md mb-2 font-medium">メッセージ送信</h3>
            <div className="mb-3 flex">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="メッセージ内容"
                className="flex-grow rounded-l border p-2"
              />
              <button
                onClick={handleSendMessage}
                disabled={!isRegistered || !message.trim()}
                className="rounded-r bg-green-500 px-4 py-2 text-white hover:bg-green-600 disabled:bg-gray-300"
              >
                送信
              </button>
            </div>
            <p className="text-sm text-gray-500">ECHOタイプのメッセージを送信して応答を受け取ります</p>
          </div>

          <div className="mb-4">
            <h3 className="text-md mb-2 font-medium">購読中のイベント</h3>
            <ul className="list-disc pl-5 text-sm">
              <li className="mb-1">CACHE_UPDATED - キャッシュの更新通知</li>
              <li className="mb-1">SW_UPDATED - Service Worker更新通知</li>
              <li className="mb-1">SW_ERROR - エラー通知</li>
            </ul>
            <p className="mt-2 text-sm text-gray-500">これらのイベントが発生すると、ログに表示されます</p>
          </div>
        </div>
      )}
      {/* キャッシュ操作パネル */}
      {activeTab === "cache" && (
        <div className="mb-6 rounded-lg border bg-white p-4">
          <h2 className="mb-4 text-xl font-semibold">キャッシュ操作</h2>

          {/* キャッシュ情報の表示（強化版） */}
          <div className="mb-6">
            <div className="mb-2">
              <h3 className="text-md font-medium">キャッシュ状態</h3>
            </div>

            <CacheStatusDisplay
              cacheInfo={cacheInfo}
              isLoading={isLoadingCache}
              onAddDemo={handleAddDemoCache}
              onRefresh={fetchCacheInfo}
              animatedItems={animatedItems}
              setAnimatedItems={setAnimatedItems}
            />

            {visualFeedback && (
              <div
                className={`mt-2 flex items-center rounded p-2 text-sm ${
                  visualFeedback.type === "success"
                    ? "bg-green-100 text-green-800"
                    : visualFeedback.type === "error"
                      ? "bg-red-100 text-red-800"
                      : "bg-blue-100 text-blue-800"
                }`}
              >
                <span className="mr-2">
                  {visualFeedback.type === "success" ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : visualFeedback.type === "error" ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </span>
                {visualFeedback.message}
              </div>
            )}
          </div>

          {/* キャッシュクリア操作 */}
          <div className="mb-4 border-t pt-4">
            <h3 className="text-md mb-2 font-medium">キャッシュクリア</h3>
            <div className="mb-3 flex">
              <input
                type="text"
                value={cacheName}
                onChange={(e) => setCacheName(e.target.value)}
                placeholder="キャッシュ名（空白ですべて）"
                className="flex-grow rounded-l border p-2"
                list="cache-suggestions"
              />
              <button
                onClick={handleClearCache}
                disabled={!isRegistered || (!cacheName && (!cacheInfo || cacheInfo.totalCaches === 0))}
                className={`rounded-r px-4 py-2 text-white transition-colors ${
                  !isRegistered || (!cacheName && (!cacheInfo || cacheInfo.totalCaches === 0))
                    ? "bg-gray-300"
                    : "bg-red-500 hover:bg-red-600"
                }`}
              >
                クリア
              </button>

              {/* キャッシュ名の候補リスト */}
              <datalist id="cache-suggestions">
                {cacheInfo?.details?.map((cache: CacheInfo["details"][number], index: number) => (
                  <option key={index} value={cache.name} />
                ))}
              </datalist>
            </div>

            <div className="rounded border border-yellow-200 bg-yellow-50 p-3">
              <h4 className="mb-1 flex items-center text-sm font-medium">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="mr-1 h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                キャッシュの動作について
              </h4>
              <p className="text-xs text-gray-700">
                Service Workerのキャッシュは、オフライン対応やパフォーマンス向上のために使用されます。
                このデモでは、キャッシュの追加と削除を行い、その効果を確認できます。
                「デモアイテム追加」ボタンでテスト用のキャッシュエントリを追加したり、
                「クリア」ボタンで特定またはすべてのキャッシュを削除できます。
              </p>
            </div>
          </div>
        </div>
      )}
      {/* 高度な操作パネル */}
      {activeTab === "advanced" && (
        <div className="mb-6 rounded-lg border bg-white p-4">
          <h2 className="mb-4 text-xl font-semibold">高度な操作</h2>

          <div className="mb-4">
            <h3 className="text-md mb-2 font-medium">待機中のServiceWorker制御</h3>
            <button
              onClick={handleSkipWaiting}
              disabled={!isRegistered || !registration?.waiting}
              className="rounded bg-purple-500 px-4 py-2 text-white hover:bg-purple-600 disabled:bg-gray-300"
            >
              skipWaiting実行
            </button>
            <p className="mt-2 text-sm text-gray-500">
              待機中のService Workerをアクティブ化します（ページがリロードされます）
            </p>
          </div>

          <div className="mb-4">
            <h3 className="text-md mb-2 font-medium">手動更新</h3>
            <button
              onClick={() => {
                logMessage("Service Worker更新処理を実行中...")
                update()
              }}
              disabled={!isRegistered}
              className="rounded bg-orange-500 px-4 py-2 text-white hover:bg-orange-600 disabled:bg-gray-300"
            >
              更新実行
            </button>
            <p className="mt-2 text-sm text-gray-500">Service Workerの手動更新をリクエストします</p>
          </div>

          <div className="rounded border border-yellow-200 bg-yellow-50 p-3">
            <p className="text-sm">
              <span className="font-medium">注意:</span> これらの操作は開発時またはトラブルシューティング時に使用します
            </p>
          </div>
        </div>
      )}
      {/* ログ表示 */}
      <div className="rounded-lg border bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">実行ログ</h2>
          <button
            onClick={() => setLogs([])}
            className="rounded bg-gray-200 px-3 py-1 text-sm text-gray-700 hover:bg-gray-300"
          >
            クリア
          </button>
        </div>
        <div className="h-64 overflow-y-auto rounded bg-gray-50 p-3 font-mono text-sm">
          {logs.length === 0 ? (
            <p className="text-gray-400">ログはまだありません</p>
          ) : (
            logs.map((message, index) => (
              <div key={index} className="mb-1 text-xs">
                {message}
              </div>
            ))
          )}
        </div>
      </div>
      {/* シンプルデモへのリンク */}
      <div className="mt-6 text-center">
        <a href="/demo/sw/simple" className="text-blue-500 hover:underline">
          シンプルデモページへ
        </a>
        <p className="mt-1 text-xs text-gray-500">※シンプルデモでは、基本的な使い方のみを紹介しています</p>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// キャッシュ状態表示コンポーネント (視覚的にわかりやすく)
interface CacheInfo {
  totalCaches: number
  totalItems: number
  details: {
    name: string
    size: number
    urls: string[]
    hasMore: boolean
  }[]
}

const CacheStatusDisplay = ({
  cacheInfo,
  isLoading,
  onAddDemo,
  onRefresh,
  animatedItems,
  setAnimatedItems,
}: {
  cacheInfo: CacheInfo | null
  isLoading: boolean
  onAddDemo: () => void
  onRefresh: () => void
  animatedItems: AnimatedItem[]
  setAnimatedItems: React.Dispatch<React.SetStateAction<AnimatedItem[]>>
}) => {
  // キャッシュの視覚表現
  interface AnimatedItem {
    name: string
    isNew: boolean
    items: { url: string; isNew: boolean }[]
  }

  // キャッシュ項目変更時のアニメーション処理
  useEffect(() => {
    if (!cacheInfo) return

    // 新しいアニメーション状態を設定
    setAnimatedItems(
      cacheInfo.details.map((cache) => ({
        name: cache.name,
        isNew: false,
        items: cache.urls.map((url) => ({
          url,
          isNew: false,
        })),
      })),
    )
  }, [cacheInfo, setAnimatedItems])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center rounded border bg-gray-50 p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500"></div>
        <span className="mt-2 text-sm text-gray-500">キャッシュ情報を読み込み中...</span>
      </div>
    )
  }

  if (!cacheInfo || cacheInfo.totalCaches === 0) {
    return (
      <div className="rounded border bg-gray-50 p-6 text-center">
        <div className="mb-4 text-5xl text-gray-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mx-auto h-20 w-20"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
            />
          </svg>
        </div>
        <p className="mb-4 text-gray-500">キャッシュが見つかりません</p>
        <div className="flex justify-center space-x-2">
          <button onClick={onAddDemo} className="rounded bg-green-500 px-4 py-2 text-sm text-white hover:bg-green-600">
            デモキャッシュを作成
          </button>
          <button onClick={onRefresh} className="rounded bg-blue-100 px-4 py-2 text-sm text-blue-800 hover:bg-blue-200">
            再読み込み
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded border bg-gray-50">
      <div className="border-b bg-gray-100 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center font-medium">
            <span className="mr-2">合計 {cacheInfo.totalCaches} キャッシュ</span>
            <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800">
              {cacheInfo.totalItems} アイテム
            </span>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={onAddDemo}
              className="rounded bg-green-500 px-3 py-1 text-xs text-white hover:bg-green-600"
            >
              デモアイテム追加
            </button>
            <button
              onClick={onRefresh}
              className="rounded bg-blue-100 px-3 py-1 text-xs text-blue-800 hover:bg-blue-200"
            >
              更新
            </button>
          </div>
        </div>
      </div>

      <div className="divide-y">
        {cacheInfo.details.map((cache, index) => (
          <div
            key={index}
            className={`p-3 transition-all duration-300 hover:bg-blue-50 ${
              animatedItems[index]?.isNew ? "bg-green-50" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">{cache.name}</h4>
              <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800">{cache.size} アイテム</span>
            </div>

            {cache.urls.length > 0 ? (
              <div className="mt-2 text-xs">
                <p className="mb-1 flex items-center text-gray-500">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="mr-1 h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14"
                    />
                  </svg>
                  キャッシュされたURL:
                </p>
                <ul className="space-y-1">
                  {cache.urls.map((url, i) => (
                    <li
                      key={i}
                      className={`truncate rounded p-1 text-gray-700 ${
                        animatedItems[index]?.items[i]?.isNew ? "bg-green-100" : ""
                      }`}
                    >
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {url.replace(window.location.origin, "")}
                      </a>
                    </li>
                  ))}
                </ul>
                {cache.hasMore && (
                  <p className="mt-1 text-gray-400 italic">他 {cache.size - 5} アイテムは省略されています...</p>
                )}
              </div>
            ) : (
              <p className="mt-1 text-xs text-gray-400">アイテムがありません</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
