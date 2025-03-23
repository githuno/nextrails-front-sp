/* --注意--
このコードは、PubSubパターンを使用してイベント駆動型のアプリケーションを構築するためのものです。

以下のセキュリティガイドラインに従ってください：
- イベント名は一意で、アプリケーション全体で一貫性を持たせる
- イベントデータは型安全で、予期しないデータが渡されないように、必要な情報だけを含むようにする
 
信頼境界を明確にする：
- クライアント側の入力は常に信頼できないものとして扱う
- 重要な検証はすべてサーバーサイドで行う

権限分離：
- pubSub.on('server:event')で受信したイベントは表示目的のみに使用
- 重要なアクションはサーバーAPIを直接呼び出す

最小権限の原則：
- イベントごとに必要最小限の情報だけを公開
- 認証済みユーザーにも、自分に関連するイベントだけを受信させる

暗号化とプライバシー：
- 機密データを含むイベントはSSEで送信しない
- ユーザー識別情報は必要最小限に留める
*/

/**
 * 型システムを活用した高度なイベント管理システム
 * - 型安全なイベント発行・購読
 * - 階層構造イベントとパターンマッチング
 * - 非同期イベント処理サポート
 * - デバッグモードとイベント監視
 */

// イベント名と型の関連付け - アプリケーション全体のイベント定義
export interface EventMap {
  // 基本的なイベント
  "app:initialized": { timestamp: number };
  "app:error": { message: string; code?: number; stack?: string };
  //     // ユーザー関連
  //     "user:login": { userId: string; timestamp: number };
  //     "user:logout": { userId: string; timestamp: number };
  //     "user:preferences:changed": { userId: string; preferences: Record<string, unknown> };

  //     // データ関連
  //     "data:loaded": { source: string; items: Array<{ id: number; name: string }> };

  //     // UI関連
  //     "ui:modal:open": { id: string; data?: { message: string } };
  //     "ui:modal:close": { id: string };
  //     "ui:theme:changed": { theme: "light" | "dark" | "system" };

  // カスタムイベント用のフォールバック型
  [event: string]: any;
}

// イベントコールバックの型
export type EventCallback<T = unknown> = (data: T) => void | Promise<void>;

// デバッグ関連の型
interface PubSubDebugInfo {
  timestamp: number;
  event: string;
  data: unknown;
  subscribersCount: number;
}

// PubSubのオプション
interface PubSubOptions {
  debug?: boolean;
  bufferSize?: number;
  allowWildcards?: boolean;
}

class PubSubManager {
  private events: Record<string, Set<EventCallback<any>>> = {};
  private debug: boolean;
  private eventHistory: PubSubDebugInfo[] = [];
  private maxBufferSize: number;
  private allowWildcards: boolean;
  private wildcardSubscriptions: Map<string, Set<EventCallback<any>>> =
    new Map();
  private subscriptionTimes: Map<string, Map<EventCallback<any>, number>> =
    new Map();
  // コンストラクタ
  constructor(options: PubSubOptions = {}) {
    this.debug = options.debug || false;
    this.maxBufferSize = options.bufferSize || 100;
    this.allowWildcards = options.allowWildcards || true;
  }

  /**
   * イベントの購読を登録します。
   *
   * @template K - イベント名の型（EventMapのキー）
   * @param event - イベント名またはワイルドカードパターン
   * @param callback - イベント発火時に実行される関数
   * @returns 購読解除のための関数
   *
   * @example
   * // 特定のイベントを購読
   * const unsubscribe = pubSub.on('user:login', (data) => {
   *   console.log(`User ${data.userId} logged in at ${new Date(data.timestamp)}`);
   * });
   *
   * // ワイルドカードパターンで購読
   * pubSub.on('user:*', (data) => {
   *   console.log('User event occurred:', data);
   * });
   *
   * // 購読解除
   * unsubscribe();
   */
  on<K extends keyof EventMap>(
    event: K,
    callback: EventCallback<EventMap[K]>
  ): () => void {
    if (!event) throw new Error("Event name is required");
    if (!callback) throw new Error("Callback is required");

    // ワイルドカードパターン処理
    if (this.allowWildcards && String(event).includes("*")) {
      const pattern = String(event);
      if (!this.wildcardSubscriptions.has(pattern)) {
        this.wildcardSubscriptions.set(pattern, new Set());
      }
      this.wildcardSubscriptions.get(pattern)!.add(callback);

      if (this.debug) {
        console.debug(`[PubSub] Subscribed to wildcard pattern: ${pattern}`);
      }

      // 解除関数を返す
      return () => {
        const subscribers = this.wildcardSubscriptions.get(pattern);
        if (subscribers) {
          subscribers.delete(callback);
          if (subscribers.size === 0) {
            this.wildcardSubscriptions.delete(pattern);
          }
        }
      };
    }

    // 通常のイベント購読
    if (!this.events[event as string]) {
      this.events[event as string] = new Set();
    }
    this.events[event as string].add(callback);

    if (this.debug) {
      console.debug(`[PubSub] Subscribed to event: ${String(event)}`);
    }

    // 購読時間を記録
    const eventStr = event as string;
    if (!this.subscriptionTimes.has(eventStr)) {
      this.subscriptionTimes.set(eventStr, new Map());
    }
    this.subscriptionTimes.get(eventStr)!.set(callback, Date.now());

    // 解除関数を拡張
    return () => {
      this.off(event, callback);
      // 解除時に購読時間情報も削除
      this.subscriptionTimes.get(eventStr)?.delete(callback);
    };
  }

  /**
   * イベント購読の解除を行います。
   *
   * @template K - イベント名の型
   * @param event - イベント名
   * @param callback - 解除するコールバック関数
   */
  off<K extends keyof EventMap>(
    event: K,
    callback: EventCallback<EventMap[K]>
  ): void {
    const eventStr = event as string;

    // ワイルドカードパターン処理
    if (this.allowWildcards && eventStr.includes("*")) {
      const pattern = eventStr;
      const subscribers = this.wildcardSubscriptions.get(pattern);
      if (subscribers) {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          this.wildcardSubscriptions.delete(pattern);
        }
      }
      return;
    }

    // 通常のイベント解除
    if (!this.events[eventStr]) {
      if (this.debug) {
        console.warn(
          `[PubSub] Attempted to remove callback for non-existing event: ${eventStr}`
        );
      }
      return;
    }

    this.events[eventStr].delete(callback);
    if (this.events[eventStr].size === 0) {
      delete this.events[eventStr];
    }

    if (this.debug) {
      console.debug(`[PubSub] Unsubscribed from event: ${eventStr}`);
    }
  }

  /**
   * イベントを発行し、登録されたすべてのコールバックを呼び出します。
   * 非同期コールバックもサポートしています。
   *
   * @template K - イベント名の型
   * @param event - 発行するイベント名
   * @param data - イベントと共に渡すデータ
   * @returns すべてのコールバックの実行が完了したときに解決するPromise
   *
   * @example
   * // 同期的なイベント発行
   * pubSub.emit('ui:theme:changed', { theme: 'dark' });
   *
   * // 非同期コールバックの完了を待つ
   * await pubSub.emit('data:loaded', { source: 'api', items: [] });
   * console.log('All event handlers have completed');
   */
  async emit<K extends keyof EventMap>(
    event: K,
    data: EventMap[K]
  ): Promise<void> {
    const eventStr = event as string;
    const promises: Promise<void>[] = [];
    let subscribersCount = 0;

    // デバッグ情報の記録
    if (this.debug) {
      this.recordEvent(eventStr, data);
    }

    // 通常のイベント処理
    if (this.events[eventStr]) {
      subscribersCount += this.events[eventStr].size;
      this.events[eventStr].forEach((callback) => {
        try {
          const result = callback(data);
          if (result instanceof Promise) {
            promises.push(result);
          }
        } catch (error) {
          console.error(
            `[PubSub] Error executing callback for event ${eventStr}:`,
            error
          );
        }
      });
    }

    // ワイルドカードパターン処理
    if (this.allowWildcards) {
      this.wildcardSubscriptions.forEach((subscribers, pattern) => {
        if (this.matchesWildcard(eventStr, pattern)) {
          subscribersCount += subscribers.size;
          subscribers.forEach((callback) => {
            try {
              const result = callback(data);
              if (result instanceof Promise) {
                promises.push(result);
              }
            } catch (error) {
              console.error(
                `[PubSub] Error executing wildcard callback (${pattern}) for event ${eventStr}:`,
                error
              );
            }
          });
        }
      });
    }

    // 購読者がいない場合の警告
    if (subscribersCount === 0 && this.debug) {
      console.warn(`[PubSub] No subscribers for event: ${eventStr}`);
    }

    // すべての非同期コールバックが完了するのを待つ
    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }

  /**
   * 一度だけイベントを購読する関数です。
   *
   * @template K - イベント名の型
   * @param event - イベント名
   * @param callback - 一度だけ実行される関数
   * @returns 購読解除のための関数（イベントが発火する前に解除したい場合）
   *
   * @example
   * // 次回のみユーザーログインを検知
   * const unsubscribe = pubSub.once('user:login', (data) => {
   *   console.log(`Welcome ${data.userId}!`);
   * });
   *
   * // 必要に応じて手動解除も可能
   * unsubscribe();
   */
  once<K extends keyof EventMap>(
    event: K,
    callback: EventCallback<EventMap[K]>
  ): () => void {
    // ワンタイム実行のラッパー関数
    const wrapper: EventCallback<EventMap[K]> = (data) => {
      // 先に購読解除してから実行（エラーが発生しても確実に解除される）
      unsubscribe();
      return callback(data);
    };

    // 購読と購読解除関数の取得
    const unsubscribe = this.on(event, wrapper);
    return unsubscribe;
  }

  /**
   * 特定のイベントパターンの発生を待機します。
   *
   * @template K - イベント名の型
   * @param event - 待機するイベント名
   * @param timeout - タイムアウト時間（ミリ秒）、0の場合はタイムアウトなし
   * @returns Promiseで解決されるイベントデータ
   *
   * @example
   * // ユーザーがログインするまで待機（最大5秒）
   * try {
   *   const userData = await pubSub.waitFor('user:login', 5000);
   *   console.log(`User ${userData.userId} logged in!`);
   * } catch (error) {
   *   console.log('Timed out waiting for login');
   * }
   */
  waitFor<K extends keyof EventMap>(
    event: K,
    timeout: number = 0
  ): Promise<EventMap[K]> {
    return new Promise((resolve, reject) => {
      let timeoutId: number | null = null;

      // イベント発生時の処理
      const unsubscribe = this.once(event, (data: EventMap[K]) => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }
        resolve(data);
      });

      // タイムアウト処理
      if (timeout > 0) {
        timeoutId = window.setTimeout(() => {
          unsubscribe();
          reject(new Error(`Timeout waiting for event: ${String(event)}`));
        }, timeout);
      }
    });
  }

  /**
   * 特定のコンポーネントやモジュールに関連するすべてのイベントを解除します。
   *
   * @param namespace - イベント名の接頭辞（例：'user:'）
   * @example
   * // ユーザー関連のすべてのイベント購読を解除
   * pubSub.clearNamespace('user:');
   */
  clearNamespace(namespace: string): void {
    // 通常のイベント購読を解除
    Object.keys(this.events).forEach((eventName) => {
      if (eventName.startsWith(namespace)) {
        delete this.events[eventName];
      }
    });

    // ワイルドカードイベント購読も解除
    if (this.allowWildcards) {
      this.wildcardSubscriptions.forEach((_, pattern) => {
        if (pattern.startsWith(namespace) || pattern === namespace + "*") {
          this.wildcardSubscriptions.delete(pattern);
        }
      });
    }
    // デバッグモードが有効な場合、解除したイベントをログに記録
    if (this.debug) {
      console.debug(
        `[PubSub] Cleared all subscriptions for namespace: ${namespace}`
      );
    }
    // イベント履歴もクリア
    this.eventHistory = this.eventHistory.filter(
      (eventInfo) => !eventInfo.event.startsWith(namespace)
    );
    // デバッグモードが有効な場合、クリアしたイベント履歴をログに記録
    if (this.debug) {
      console.debug(
        `[PubSub] Cleared all subscriptions in namespace: ${namespace}`
      );
    }
  }

  /**
   * PubSubの状態をリセットします（主にテスト用）
   */
  reset(): void {
    this.events = {};
    this.eventHistory = [];
    this.wildcardSubscriptions.clear();

    if (this.debug) {
      console.debug("[PubSub] Reset completed");
    }
  }

  /**
   * イベント履歴を取得します（デバッグモードが有効な場合のみ）
   */
  getEventHistory(): PubSubDebugInfo[] {
    if (!this.debug) {
      console.warn("[PubSub] Event history is only available in debug mode");
      return [];
    }
    return [...this.eventHistory];
  }

  /**
   * 最新のイベントを取得します（デバッグモードが有効な場合のみ）
   * @param count - 取得するイベント数
   */
  getRecentEvents(count: number = 10): PubSubDebugInfo[] {
    if (!this.debug) {
      return [];
    }
    return this.eventHistory.slice(-count);
  }

  /**
   * メモリリークの可能性があるリスナーを検出します（デバッグモードが有効な場合のみ）
   * @param thresholdMs - リークと見なす閾値（ミリ秒）
   */
  detectPotentialLeaks(
    thresholdMs: number = 3600000
  ): Array<{ event: string; duration: number }> {
    if (!this.debug) return [];

    const now = Date.now();
    const potentialLeaks: Array<{ event: string; duration: number }> = [];

    this.subscriptionTimes.forEach((callbacks, event) => {
      callbacks.forEach((timestamp, callback) => {
        const duration = now - timestamp;
        if (duration > thresholdMs) {
          potentialLeaks.push({ event, duration });
          console.warn(
            `[PubSub] Potential memory leak: event "${event}" has been subscribed for ${duration}ms`
          );
        }
      });
    });

    return potentialLeaks;
  }

  /**
   * 現在のサブスクライバー数を取得します。
   */
  getSubscribersCount(): Record<string, number> {
    const counts: Record<string, number> = {};

    // 通常のイベント
    Object.entries(this.events).forEach(([event, subscribers]) => {
      counts[event] = subscribers.size;
    });

    // ワイルドカードイベント
    if (this.allowWildcards) {
      this.wildcardSubscriptions.forEach((subscribers, pattern) => {
        counts[`[wildcard] ${pattern}`] = subscribers.size;
      });
    }

    return counts;
  }

  // ワイルドカードパターンとイベント名のマッチングを行う
  private matchesWildcard(eventName: string, pattern: string): boolean {
    if (!pattern.includes("*")) {
      return eventName === pattern;
    }

    const regexPattern = pattern
      .replace(/\./g, "\\.") // ドットをエスケープ
      .replace(/\*/g, ".*"); // * を .* に置換

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(eventName);
  }

  // イベント履歴を記録（デバッグモード用）
  private recordEvent(event: string, data: unknown): void {
    if (!this.debug) return;

    const subscribersCount =
      (this.events[event]?.size || 0) + this.getWildcardSubscribersCount(event);

    this.eventHistory.push({
      timestamp: Date.now(),
      event,
      data,
      subscribersCount,
    });

    // バッファサイズを制限
    if (this.eventHistory.length > this.maxBufferSize) {
      this.eventHistory = this.eventHistory.slice(-this.maxBufferSize);
    }
  }

  // 特定のイベントに一致するワイルドカードサブスクライバーの数を取得
  private getWildcardSubscribersCount(event: string): number {
    if (!this.allowWildcards) return 0;

    let count = 0;
    this.wildcardSubscriptions.forEach((subscribers, pattern) => {
      if (this.matchesWildcard(event, pattern)) {
        count += subscribers.size;
      }
    });

    return count;
  }
}

// デフォルトのインスタンスをエクスポート
export const pubSub = new PubSubManager({
  debug: process.env.NODE_ENV === "development",
});

// テスト用のインスタンス生成関数
export function createPubSub(options?: PubSubOptions): PubSubManager {
  return new PubSubManager(options);
}
