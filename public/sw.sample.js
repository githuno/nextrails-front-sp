// Service Worker for Camera Component

// キャッシュの名前
const CACHE_NAME = "camera-app-cache-v1"

// インストール時の処理
self.addEventListener("install", (event) => {
  console.log("Service Worker installing.")

  // キャッシュを開いて初期リソースを追加
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        // Next.jsではルートURLのみキャッシュするのが安全
        return cache.add("/").catch((err) => {
          console.error("キャッシュの追加に失敗しました:", err)
          // エラーが発生しても続行
          return Promise.resolve()
        })
      })
      .catch((err) => {
        console.error("Service Workerのインストール中にエラーが発生しました:", err)
      }),
  )

  // 待機中のService Workerを即座にアクティブにする
  self.skipWaiting()
})

// アクティベート時の処理
self.addEventListener("activate", (event) => {
  console.log("Service Worker activating.")

  // 古いキャッシュを削除
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log("Service Worker: Clearing old cache:", cacheName)
              return caches.delete(cacheName)
            }
            return Promise.resolve()
          }),
        )
      })
      .catch((err) => {
        console.error("Service Workerのアクティベート中にエラーが発生しました:", err)
      }),
  )

  // 制御していないクライアントも含めて即座に制御を開始
  return self.clients.claim()
})

// フェッチイベントの処理（オフライン対応）
self.addEventListener("fetch", (event) => {
  // APIリクエストはキャッシュしない
  if (event.request.url.includes("/api/")) {
    return
  }

  // GETリクエストのみキャッシュする
  if (event.request.method !== "GET") {
    return
  }

  // ネットワークファーストでリソースを取得
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 有効なレスポンスのみキャッシュする
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response
        }

        // レスポンスをクローンしてキャッシュに保存
        const responseClone = response.clone()
        caches
          .open(CACHE_NAME)
          .then((cache) => {
            cache.put(event.request, responseClone)
          })
          .catch((err) => {
            console.error("レスポンスのキャッシュに失敗しました:", err)
          })

        return response
      })
      .catch(() => {
        // オフラインの場合はキャッシュから取得
        return caches.match(event.request).then((response) => {
          return response || Promise.reject("キャッシュにリソースがありません")
        })
      }),
  )
})

// メッセージイベントの処理
self.addEventListener("message", (event) => {
  console.log("Service Worker received message:", event.data)

  if (event.data && event.data.type === "CHECK_IMAGESET_FILES") {
    const imageset = event.data.imageset

    // 画像セットの検証
    if (!imageset || !imageset.files) {
      sendMessageToClients({
        type: "ALERT_IMAGESET_FILES",
        message: "画像セットが見つかりません",
      })
      return
    }

    // 画像ファイル数の検証
    const validFiles = imageset.files.filter((file) => !file.deletedAt && file.id && file.key)

    if (validFiles.length === 0) {
      sendMessageToClients({
        type: "ALERT_IMAGESET_FILES",
        message: "有効な画像ファイルがありません",
      })
      return
    }

    if (validFiles.length < 3) {
      sendMessageToClients({
        type: "ALERT_IMAGESET_FILES",
        message: `現在${validFiles.length}枚の画像があります。最低3枚の画像をアップロードすることをお勧めします。`,
      })
      return
    }

    // 未同期ファイルのチェック
    const unsyncedFiles = validFiles.filter((file) => file.shouldPush)
    if (unsyncedFiles.length > 0) {
      sendMessageToClients({
        type: "ALERT_IMAGESET_FILES",
        message: `${unsyncedFiles.length}枚の画像がクラウドと同期されていません。同期を完了するには、DRAFTからSENTに変更してください。`,
      })
      return
    }

    // すべてが正常な場合
    sendMessageToClients({
      type: "ALERT_IMAGESET_FILES",
      message: `${validFiles.length}枚の画像が正常に処理されています。`,
    })
  }
})

// プッシュ通知の処理
self.addEventListener("push", (event) => {
  console.log("Push received:", event)

  if (!event.data) {
    console.warn("Push イベントにデータがありません")
    return
  }

  let data
  try {
    data = event.data.json()
  } catch (e) {
    console.error("Push データの解析に失敗しました:", e)
    data = {
      title: "カメラアプリ",
      body: "新しい通知があります",
    }
  }

  const options = {
    body: data.body || "カメラアプリからの通知です",
    icon: "/icons/camera-icon-192.png",
    badge: "/icons/badge-icon-96.png",
    data: {
      url: data.url || "/",
    },
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "カメラアプリ", options).catch((err) => {
      console.error("通知の表示に失敗しました:", err)
    }),
  )
})

// 通知クリック時の処理
self.addEventListener("notificationclick", (event) => {
  console.log("Notification clicked:", event)

  event.notification.close()

  // 通知がクリックされたときに特定のURLを開く
  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url).catch((err) => {
        console.error("新しいウィンドウを開けませんでした:", err)
      }),
    )
  }
})

// バックグラウンド同期の処理
self.addEventListener("sync", (event) => {
  console.log("Background sync:", event)

  if (event.tag === "sync-imageset") {
    event.waitUntil(
      syncImagesets().catch((err) => {
        console.error("同期処理中にエラーが発生しました:", err)
        return false
      }),
    )
  }
})

// すべてのクライアントにメッセージを送信する関数
function sendMessageToClients(message) {
  self.clients
    .matchAll()
    .then((clients) => {
      if (clients.length === 0) {
        console.log("送信先のクライアントが見つかりません")
        return
      }

      clients.forEach((client) => {
        client.postMessage(message).catch((err) => {
          console.error("メッセージの送信に失敗しました:", err, client.id)
        })
      })
    })
    .catch((err) => {
      console.error("クライアントの取得に失敗しました:", err)
    })
}

// 画像セットの同期処理を行う関数
async function syncImagesets() {
  try {
    // IndexedDBからの未同期データの取得とアップロード処理をここに実装
    // この処理は実際のIndexedDBとクラウドストレージの実装に依存します

    console.log("Successfully synced imagesets")

    // 同期成功の通知
    sendMessageToClients({
      type: "SYNC_COMPLETED",
      success: true,
      message: "画像の同期が完了しました",
    })

    return true
  } catch (error) {
    console.error("Failed to sync imagesets:", error)

    // 同期失敗の通知
    sendMessageToClients({
      type: "SYNC_COMPLETED",
      success: false,
      message: "画像の同期に失敗しました",
    })

    throw error // エラーを上位に伝播させる
  }
}

// Service Workerのエラーハンドリング
self.addEventListener("error", (event) => {
  console.error("Service Worker error:", event.error)
})

// Unhandled rejectionのハンドリング
self.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason)
})

console.log("Service Worker loaded")
