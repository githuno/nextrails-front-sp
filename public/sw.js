// Service Worker実装

const CACHE_NAME = "demo-cache-v1";
const ASSETS_TO_CACHE = [
  "/",
  //   '/demo/worker', // Next.jsではルートURLのみキャッシュするのが安全
  //   '/workers/demo-worker.js'
];

// インストール時の処理
self.addEventListener("install", (event) => {
  console.log("[ServiceWorker] Install");

  // キャッシュの準備
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[ServiceWorker] Caching app shell");
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );

  // 即時有効化（古いバージョンを待たずに有効化）
  self.skipWaiting();
});

// 有効化時の処理
self.addEventListener("activate", (event) => {
  console.log("[ServiceWorker] Activate");

  // 古いキャッシュの削除
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[ServiceWorker] Removing old cache", key);
            return caches.delete(key);
          }
        })
      );
    })
  );

  // クライアントの制御を要求（即時反映）
  self.clients.claim();
});

// フェッチ時のキャッシュ制御
self.addEventListener("fetch", (event) => {
  // デモのため、キャッシュファーストの単純な戦略を使用
  event.respondWith(
    caches.match(event.request).then((response) => {
      // キャッシュがあればそれを返す
      if (response) {
        return response;
      }
      // キャッシュがなければネットワークから取得
      return fetch(event.request);
    })
  );
});

// メッセージ処理
self.addEventListener("message", (event) => {
  const message = event.data;
  console.log("[ServiceWorker] Message received:", message);

  if (message.type === "SKIP_WAITING") {
    // skipWaitingメッセージでワーカーを即座に有効化
    self.skipWaiting();
    return;
  }

  // メッセージチャンネルが存在する場合、処理結果を返信
  if (event.ports && event.ports[0]) {
    handleClientMessage(message, event.ports[0]);
  }
});

// キャッシュ情報取得関数
async function getCacheInfo() {
  try {
    // すべてのキャッシュキーを取得
    const cacheKeys = await caches.keys();
    const details = [];
    let totalUrls = 0;

    // 各キャッシュの情報を取得
    for (const cacheName of cacheKeys) {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();
      const urls = requests.map(req => req.url);
      
      // 最大5つのURLを表示（残りは省略）
      const displayUrls = urls.slice(0, 5);
      const hasMore = urls.length > 5;
      
      totalUrls += urls.length;
      
      details.push({
        name: cacheName,
        size: urls.length,
        urls: displayUrls,
        hasMore
      });
    }

    return {
      totalCaches: cacheKeys.length,
      totalItems: totalUrls,
      details
    };
  } catch (error) {
    console.error('[ServiceWorker] getCacheInfo error:', error);
    return {
      totalCaches: 0,
      totalItems: 0,
      details: [],
      error: error.message
    };
  }
}

// デモ用キャッシュアイテム追加関数
async function addDemoCacheItem(url, cacheName) {
  try {
    // デモ用のHTMLコンテンツ
    const demoContent = `
      <!DOCTYPE html>
      <html lang="ja">
        <meta charset="UTF-8">
        <head>
          <title>キャッシュデモコンテンツ</title>
        </head>
        <body>
          <h1>キャッシュデモコンテンツ</h1>
          <p>これはService Workerのキャッシュ機能デモ用のコンテンツです。</p>
          <p>生成時刻: ${new Date().toLocaleString()}</p>
          <p>URL: ${url}</p>
        </body>
      </html>
    `;

    // レスポンスの作成
    const response = new Response(demoContent, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-store',
        'X-Demo-Item': 'true',
        'Date': new Date().toUTCString()
      }
    });

    // キャッシュを開く
    const cache = await caches.open(cacheName);
    
    // キャッシュに追加
    await cache.put(url, response);
    
    return { success: true, url, cacheName };
  } catch (error) {
    console.error('[ServiceWorker] addDemoCacheItem error:', error);
    return { success: false, error: error.message };
  }
}

// クライアントからのメッセージ処理
function handleClientMessage(message, port) {
  switch (message.type) {
    case "ECHO":
      // エコーメッセージの処理
      const echoText = message.payload?.text || "";
      port.postMessage({
        result: `Service Worker Echo: ${echoText}`,
      });
      break;

    case "CACHE_UPDATED":
      // キャッシュの更新通知
      console.log("[ServiceWorker] Cache updated:", message.payload);

      // すべてのクライアントに通知
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: "CACHE_UPDATED",
            payload: {
              timestamp: new Date().toISOString(),
              ...message.payload,
            },
          });
        });
      });

      port.postMessage({ success: true });
      break;
      
    case "GET_CACHE_INFO":
      // キャッシュ情報を取得して返す
      console.log("[ServiceWorker] Getting cache info");
      
      getCacheInfo().then(cacheInfo => {
        port.postMessage({ cacheInfo });
      }).catch(error => {
        port.postMessage({ 
          error: `Failed to get cache info: ${error.message}` 
        });
      });
      break;
      
    case "CACHE_DEMO_ITEM":
      // デモ用キャッシュアイテムを追加
      console.log("[ServiceWorker] Adding demo cache item:", message.payload);
      
      if (!message.payload || !message.payload.url) {
        port.postMessage({ success: false, error: "URL is required" });
        return;
      }
      
      const { url, cacheName = CACHE_NAME } = message.payload;
      
      addDemoCacheItem(url, cacheName).then(result => {
        port.postMessage(result);
        
        // キャッシュ更新を通知
        if (result.success) {
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({
                type: "CACHE_UPDATED",
                payload: {
                  timestamp: new Date().toISOString(),
                  action: "add",
                  url,
                  cacheName
                }
              });
            });
          });
        }
      }).catch(error => {
        port.postMessage({ 
          success: false,
          error: `Failed to add demo item: ${error.message}`
        });
      });
      break;

    default:
      console.log("[ServiceWorker] Unknown message type:", message.type);
      port.postMessage({
        error: `Unknown message type: ${message.type}`,
      });
  }
}