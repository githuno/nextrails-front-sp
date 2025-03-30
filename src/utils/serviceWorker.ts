import { pubSub } from "./pubsub";

// ========== 型定義 ==========

export type ServiceWorkerMessageType =
  | "CHECK_IMAGESET_FILES"
  | "ALERT_IMAGESET_FILES"
  | "CACHE_UPDATED"
  | "SW_UPDATED"
  | "SW_ERROR"
  | "SYNC_REQUEST"
  | "SYNC_COMPLETE"
  | "ECHO"
  | "PING"
  | "GET_CACHE_INFO"
  | "CACHE_DEMO_ITEM";

export interface ServiceWorkerMessage<T = any> {
  type: ServiceWorkerMessageType;
  payload?: T & { cleared?: boolean };
}

export interface ServiceWorkerOptions {
  path?: string;
  scope?: string;
  updateViaCache?: ServiceWorkerUpdateViaCache;
  type?: WorkerType;
  immediate?: boolean;
  debug?: boolean;
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onError?: (error: Error) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  context?: string;
}

export interface ServiceWorkerState {
  registration: ServiceWorkerRegistration | null;
  controller: ServiceWorker | null;
  isSupported: boolean;
  isRegistered: boolean;
  isUpdating: boolean;
  isError: boolean;
  error: Error | null;
}

// pubSubイベントの拡張
declare module '@/utils/pubsub' {
  interface EventMap {
    'sw:state-changed': Partial<ServiceWorkerState>;
    'sw:registration-changed': ServiceWorkerRegistration | null;
    'sw:controller-changed': ServiceWorker | null;
    'sw:update-waiting': { registration: ServiceWorkerRegistration };
    'sw:error': Error;
    // Service Workerメッセージをマップ
    'sw:CHECK_IMAGESET_FILES': any;
    'sw:ALERT_IMAGESET_FILES': any;
    'sw:CACHE_UPDATED': any;
    'sw:SW_UPDATED': any;
    'sw:SW_ERROR': any;
    'sw:SYNC_REQUEST': any;
    'sw:SYNC_COMPLETE': any;
    'sw:ECHO': any;
    'sw:PING': any;
    'sw:GET_CACHE_INFO': any;
    'sw:CACHE_DEMO_ITEM': any;
  }
}

// ========== デフォルト設定 ==========
const defaultOptions: ServiceWorkerOptions = {
  path: "/sw.js",
  scope: "/",
  updateViaCache: "none",
  type: "module",
  immediate: true,
  debug: false,
};

// ========== シングルトンインスタンス ==========
let instance: {
  state: ServiceWorkerState;
  messageHandlers: Map<string, Set<(data: any) => void>>;
  initialized: boolean;
  options: ServiceWorkerOptions;
  updateCheckIntervalId: number | null;
  initialRegistrationAttempted: boolean;
  messageListenerRegistered: boolean;
  controllerChangeRegistered: boolean;
} | null = null;

/**
 * シングルトンインスタンスを取得または初期化
 */
function getInstance(): typeof instance {
  if (!instance) {
    // ブラウザ環境チェック
    const isBrowser = typeof window !== "undefined" && typeof navigator !== "undefined";
    const isSupported = isBrowser && "serviceWorker" in navigator && "ServiceWorkerRegistration" in window;

    instance = {
      state: {
        registration: null,
        controller: null,
        isSupported,
        isRegistered: false,
        isUpdating: false,
        isError: false,
        error: null,
      },
      messageHandlers: new Map(),
      initialized: false,
      options: { ...defaultOptions },
      updateCheckIntervalId: null,
      initialRegistrationAttempted: false,
      messageListenerRegistered: false,
      controllerChangeRegistered: false,
    };
  }
  
  return instance;
}

/**
 * デバッグログ出力関数
 */
export function logDebug(message: string, ...args: any[]): void {
  const inst = getInstance();
  if (inst?.options.debug) {
    console.log(`[ServiceWorker] ${message}`, ...args);
  }
}

/**
 * 状態更新を通知する関数
 */
export function updateState(newState: Partial<ServiceWorkerState>): void {
  const inst = getInstance();
  if (!inst) return;

  // 状態を更新
  inst.state = { ...inst.state, ...newState };

  // イベント発行
  pubSub.emit('sw:state-changed', newState);
  
  // 特定のプロパティ変更イベントも発行
  if (newState.registration !== undefined) {
    pubSub.emit('sw:registration-changed', newState.registration);
  }
  
  if (newState.controller !== undefined) {
    pubSub.emit('sw:controller-changed', newState.controller);
  }
  
  if (newState.error !== undefined && newState.error !== null) {
    pubSub.emit('sw:error', newState.error);
  }
}

/**
 * エラー処理関数
 */
export function handleError(err: Error): void {
  const inst = getInstance();
  if (!inst) return;

  const error = err instanceof Error ? err : new Error(String(err));
  
  updateState({
    isError: true,
    error
  });
  
  // エラーコールバックを実行
  if (inst.options.onError) {
    inst.options.onError(error);
  }
  
  logDebug("Error:", error);
}

// ========== コア機能の実装 ==========

/**
 * Service Workerの登録を確認
 */
export async function checkRegistration(scope?: string): Promise<ServiceWorkerRegistration | null> {
  try {
    if (typeof navigator === "undefined" || !navigator.serviceWorker) return null;
    
    const registration = await navigator.serviceWorker.getRegistration(scope);
    return registration ?? null;
  } catch (err) {
    handleError(err instanceof Error ? err : new Error(String(err)));
    return null;
  }
}

/**
 * Service Workerを登録
 */
export async function register(registerOptions?: ServiceWorkerOptions): Promise<ServiceWorkerRegistration | null> {
  const inst = getInstance();
  if (!inst) return null;
  
  // サポートチェック
  if (!inst.state.isSupported) {
    logDebug("Service Worker is not supported in this browser");
    return null;
  }
  
  // 既に登録済みの場合
  if (inst.state.registration) {
    return inst.state.registration;
  }
  
  const mergedOptions = { ...inst.options, ...registerOptions };
  inst.options = mergedOptions;
  
  try {
    updateState({ isError: false, error: null });
    
    logDebug("Registering Service Worker...", mergedOptions);
    
    const reg = await navigator.serviceWorker.register(mergedOptions.path!, {
      scope: mergedOptions.scope,
      updateViaCache: mergedOptions.updateViaCache,
      type: mergedOptions.type,
    });
    
    updateState({
      registration: reg,
      isRegistered: true,
    });
    
    // Active ServiceWorkerを追跡
    const activeWorker = reg.active || reg.installing || reg.waiting;
    if (activeWorker) {
      updateState({ controller: activeWorker });
      
      // statechangeイベントでコントローラーの状態を追跡
      activeWorker.addEventListener("statechange", () => {
        logDebug("Service Worker state changed:", activeWorker.state);
        
        if (activeWorker.state === "activated") {
          updateState({ controller: navigator.serviceWorker.controller });
        }
      });
    }
    
    // 更新処理を設定
    reg.addEventListener("updatefound", () => {
      logDebug("Service Worker update found");
      updateState({ isUpdating: true });
      
      const newWorker = reg.installing;
      if (newWorker) {
        newWorker.addEventListener("statechange", () => {
          logDebug("New Service Worker state:", newWorker.state);
          
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            logDebug("New Service Worker installed and waiting");
            
            pubSub.emit("sw:update-waiting", { registration: reg });
            
            if (mergedOptions.onUpdate) {
              mergedOptions.onUpdate(reg);
            }
          } else if (newWorker.state === "activated") {
            updateState({ 
              isUpdating: false,
              controller: newWorker
            });
            logDebug("New Service Worker activated");
          }
        });
      }
    });
    
    if (mergedOptions.onSuccess) {
      mergedOptions.onSuccess(reg);
    }
    
    logDebug("Service Worker registered successfully:", reg);
    
    // リスナーのセットアップ
    setupServiceWorkerListeners();
    
    return reg;
  } catch (err) {
    handleError(err instanceof Error ? err : new Error(String(err)));
    return null;
  }
}

/**
 * Service Workerを登録解除
 */
export async function unregister(): Promise<boolean> {
  const inst = getInstance();
  if (!inst || !inst.state.registration) return false;
  
  try {
    const success = await inst.state.registration.unregister();
    if (success) {
      updateState({
        registration: null,
        isRegistered: false,
        controller: null
      });
      logDebug("Service Worker unregistered successfully");
    }
    return success;
  } catch (err) {
    handleError(err instanceof Error ? err : new Error(String(err)));
    return false;
  }
}

/**
 * Service Workerを更新
 */
export async function update(): Promise<boolean> {
  const inst = getInstance();
  if (!inst || !inst.state.registration) return false;
  
  try {
    logDebug("Checking for Service Worker updates...");
    updateState({ isUpdating: true });
    
    await inst.state.registration.update();
    
    logDebug("Service Worker update check completed");
    const hasWaiting = !!inst.state.registration.waiting;
    
    updateState({ isUpdating: false });
    return hasWaiting; // 待機中のSWがあればtrueを返す
  } catch (err) {
    handleError(err instanceof Error ? err : new Error(String(err)));
    updateState({ isUpdating: false });
    return false;
  }
}

/**
 * 更新を確認
 */
export async function checkForUpdates(): Promise<boolean> {
  const inst = getInstance();
  if (!inst || !inst.state.registration) return false;
  
  try {
    const hasWaiting = !!inst.state.registration.waiting;
    if (!hasWaiting) {
      await update();
    }
    return !!inst.state.registration.waiting;
  } catch (err) {
    handleError(err instanceof Error ? err : new Error(String(err)));
    return false;
  }
}

/**
 * skipWaiting処理を実行
 */
export async function skipWaiting(): Promise<void> {
  const inst = getInstance();
  if (!inst || !inst.state.registration || !inst.state.registration.waiting) return;
  
  logDebug("Sending skipWaiting message to waiting worker");
  
  // skipWaitingメッセージを送信
  inst.state.registration.waiting.postMessage({ type: "SKIP_WAITING" });
  
  // 新しいSWが有効になるようにブラウザを再読み込み
  if (typeof window !== "undefined") {
    window.location.reload();
  }
}

/**
 * Service Workerにメッセージを送信
 */
export async function sendMessage<T = any, R = any>(message: ServiceWorkerMessage<T>): Promise<R | null> {
  const inst = getInstance();
  if (!inst || !inst.state.registration || !navigator.serviceWorker.controller) {
    logDebug("Cannot send message - no active service worker", message);
    return null;
  }
  
  return new Promise<R | null>((resolve) => {
    const messageChannel = new MessageChannel();
    
    // レスポンス受信用のポート設定
    messageChannel.port1.onmessage = (event) => {
      resolve(event.data);
    };
    
    logDebug("Sending message to ServiceWorker:", message);
    
    // メッセージをServiceWorkerに送信
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(message, [
        messageChannel.port2,
      ]);
    } else {
      logDebug("No active service worker controller to send the message");
    }
    
    // タイムアウト設定
    setTimeout(() => {
      resolve(null);
    }, 3000);
  });
}

/**
 * Service Workerからのメッセージを購読
 */
export function subscribeToMessage<T = any>(
  type: ServiceWorkerMessageType, 
  callback: (data: T) => void
): () => void {
  const inst = getInstance();
  if (!inst) return () => {};
  
  // 指定されたタイプのハンドラセットを取得または作成
  if (!inst.messageHandlers.has(type)) {
    inst.messageHandlers.set(type, new Set());
  }
  
  // ハンドラを追加
  const handlers = inst.messageHandlers.get(type)!;
  handlers.add(callback);
  
  logDebug(`Subscribed to ${type} messages`);
  
  // クリーンアップ用の関数を返す
  return () => {
    const handlers = inst.messageHandlers.get(type);
    if (handlers) {
      handlers.delete(callback);
      if (handlers.size === 0) {
        inst.messageHandlers.delete(type);
      }
    }
  };
}

/**
 * キャッシュをクリア
 */
export async function clearCache(cacheName?: string): Promise<boolean> {
  try {
    if (typeof caches === 'undefined') {
      logDebug("Cache API not available");
      return false;
    }
    
    if (cacheName) {
      // 特定のキャッシュのみ削除
      await caches.delete(cacheName);
      logDebug(`Cache '${cacheName}' cleared`);
    } else {
      // 全キャッシュのキーを取得
      const cacheKeys = await caches.keys();
      
      // 全キャッシュを削除
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));
      logDebug("All caches cleared");
    }
    
    // SWにキャッシュクリアを通知
    if (navigator.serviceWorker?.controller) {
      await sendMessage({
        type: "CACHE_UPDATED",
        payload: { cleared: true, cacheName },
      });
    }
    
    return true;
  } catch (err) {
    handleError(err instanceof Error ? err : new Error(String(err)));
    return false;
  }
}

/**
 * Service Workerからのメッセージを処理
 */
function handleMessage(event: MessageEvent): void {
  const inst = getInstance();
  if (!inst) return;
  
  const message = event.data as ServiceWorkerMessage;
  
  if (!message || !message.type) {
    return;
  }
  
  logDebug("Received message from ServiceWorker:", message);
  
  // 特定タイプのハンドラーを実行
  const handlers = inst.messageHandlers.get(message.type);
  if (handlers) {
    handlers.forEach((handler) => {
      try {
        handler(message.payload);
      } catch (err) {
        console.error(`Error in message handler for ${message.type}:`, err);
      }
    });
  }
  
  // pubSubを使用してメッセージをブロードキャスト
  pubSub.emit(`sw:${message.type}`, message.payload);
}

/**
 * 定期更新チェック設定
 */
function setupUpdateCheck(): void {
  const inst = getInstance();
  if (!inst || inst.updateCheckIntervalId) return;
  
  // 6時間ごとに更新をチェック
  inst.updateCheckIntervalId = window.setInterval(() => {
    if (inst.state.isRegistered && !inst.state.isUpdating) {
      update();
    }
  }, 6 * 60 * 60 * 1000);
  
  // 初回の更新チェック
  if (inst.state.isRegistered && !inst.state.isUpdating) {
    update().catch(err => console.error("初回更新チェックエラー:", err));
  }
}

/**
 * Service Worker監視セットアップ
 */
function setupServiceWorkerListeners(): void {
  const inst = getInstance();
  if (!inst) return;
  
  // メッセージイベントリスナー設定
  if (!inst.messageListenerRegistered && typeof navigator !== 'undefined') {
    const messageListener = (event: MessageEvent) => handleMessage(event);
    navigator.serviceWorker.addEventListener("message", messageListener);
    inst.messageListenerRegistered = true;
  }
  
  // controllerchange イベント購読
  if (!inst.controllerChangeRegistered && typeof navigator !== 'undefined') {
    const controllerChangeHandler = () => {
      logDebug("Service Worker controller changed", navigator.serviceWorker.controller);
      updateState({ controller: navigator.serviceWorker.controller });
      
      // コントローラーが変更された場合は登録情報を確認
      checkRegistration(inst.options.scope).then((reg) => {
        if (reg) {
          updateState({
            registration: reg,
            isRegistered: true,
          });
        }
      });
    };
    
    navigator.serviceWorker.addEventListener("controllerchange", controllerChangeHandler);
    inst.controllerChangeRegistered = true;
  }
  
  // 定期更新チェックセットアップ
  setupUpdateCheck();
}

/**
 * Service Workerを初期化
 */
export async function init(options: ServiceWorkerOptions = {}): Promise<void> {
  const inst = getInstance();
  if (!inst || inst.initialized) return;
  
  // オプションをマージ
  inst.options = { ...inst.options, ...options };
  
  // サポートチェック
  if (!inst.state.isSupported) {
    logDebug("Service Worker is not supported in this browser");
    return;
  }
  
  // 既存登録を確認
  if (!inst.state.registration) {
    const reg = await checkRegistration(inst.options.scope);
    if (reg) {
      updateState({
        registration: reg,
        isRegistered: true,
        controller: navigator?.serviceWorker?.controller || null,
      });
      
      // リスナー設定
      setupServiceWorkerListeners();
    }
  }
  
  inst.initialized = true;
  
  // 自動登録が有効なら登録
  if (inst.options.immediate && !inst.state.registration && !inst.initialRegistrationAttempted) {
    inst.initialRegistrationAttempted = true;
    register().catch(err => console.error("Service Worker登録エラー:", err));
  }
}

/**
 * 現在のServiceWorker状態を取得
 */
export function getState(): ServiceWorkerState {
  const inst = getInstance();
  return inst ? { ...inst.state } : {
    registration: null,
    controller: null,
    isSupported: false,
    isRegistered: false,
    isUpdating: false,
    isError: false,
    error: null,
  };
}

/**
 * テスト用インスタンス取得関数
 */
export function __getInstanceForTesting() {
  return getInstance();
}

// 自動初期化（ブラウザ環境のみ）
if (typeof window !== 'undefined') {
  init().catch(console.error);
}

// モジュールとしてAPIを公開
export const serviceWorker = {
  init,
  register,
  unregister,
  update,
  checkForUpdates,
  skipWaiting,
  sendMessage,
  subscribeToMessage,
  clearCache,
  getState,
};

export default serviceWorker;