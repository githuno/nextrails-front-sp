"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import {
  serviceWorker,
  type ServiceWorkerOptions,
  type ServiceWorkerMessage,
  type ServiceWorkerState,
  type ServiceWorkerMessageType,
} from "@/utils/serviceWorker";
import { pubSub } from "@/utils/pubsub";
import { useToast } from "./useToast";
import { useErrorBoundary } from "./useErrorBoundary";

// Context型の定義（コア機能にReact固有の機能を追加）
export interface ServiceWorkerContextType extends ServiceWorkerState {
  // コア機能のAPIをそのまま継承
  register: (
    options?: ServiceWorkerOptions
  ) => Promise<ServiceWorkerRegistration | null>;
  unregister: () => Promise<boolean>;
  update: () => Promise<boolean>;
  sendMessage: <T = any, R = any>(
    message: ServiceWorkerMessage<T>
  ) => Promise<R | null>;
  subscribeToMessage: <T = any>(
    type: ServiceWorkerMessageType,
    callback: (data: T) => void
  ) => () => void;
  checkForUpdates: () => Promise<boolean>;
  skipWaiting: () => Promise<void>;
  clearCache: (cacheName?: string) => Promise<boolean>;

  // React固有の追加機能
  showUpdatePrompt: () => void;
}

// デフォルトのContextオブジェクト（型安全のためnullではなく適切なデフォルト値を提供）
const defaultContext: ServiceWorkerContextType = {
  // 状態
  registration: null,
  controller: null,
  isSupported: false,
  isRegistered: false,
  isUpdating: false,
  isError: false,
  error: null,

  // ダミー関数（実際のContextでは上書きされる）
  register: async () => null,
  unregister: async () => false,
  update: async () => false,
  sendMessage: async () => null,
  subscribeToMessage: () => () => {},
  checkForUpdates: async () => false,
  skipWaiting: async () => {},
  clearCache: async () => false,
  showUpdatePrompt: () => {},
};

// ServiceWorkerContextの作成
const ServiceWorkerContext =
  createContext<ServiceWorkerContextType>(defaultContext);

/**
 * WorkerServiceProviderコンポーネント
 *
 * ServiceWorkerの機能をContext経由で提供し、表示や通知などのUI関連機能も担当します。
 */
export function WorkerServiceProvider({
  children,
  options = {},
  autoPromptUpdates = true,
}: {
  children: React.ReactNode;
  options?: ServiceWorkerOptions;
  autoPromptUpdates?: boolean;
}) {
  const { showToast } = useToast();
  const { handleError } = useErrorBoundary();

  // serviceWorker.tsの現在の状態をReactステートに同期
  const [state, setState] = useState<ServiceWorkerState>(
    serviceWorker.getState()
  );

  // 更新プロンプトを表示する関数
  const showUpdatePrompt = useCallback(() => {
    if (state.registration?.waiting) {
      showToast("アプリの新しいバージョンがインストールされました", {
        type: "info",
        duration: 10000,
        action: {
          label: "更新",
          onClick: () => serviceWorker.skipWaiting(),
        },
      });
    }
  }, [state.registration, showToast]);

  // pubSubイベントの購読と状態更新
  useEffect(() => {
    // SSR対策
    if (typeof window === "undefined") return;

    // serviceWorkerの初期化
    serviceWorker
      .init(options)
      .catch((e) => console.error("Service Worker初期化エラー:", e));

    // 状態変更のサブスクライブ
    const unsubscribeState = pubSub.on("sw:state-changed", (newState) => {
      setState((prev) => ({ ...prev, ...newState }));
    });

    // エラー処理
    const unsubscribeError = pubSub.on("sw:error", (error) => {
      handleError(error);
    });

    // 更新待機の通知
    const unsubscribeUpdateWaiting = pubSub.on(
      "sw:update-waiting",
      ({ registration }) => {
        if (autoPromptUpdates) {
          showToast("アプリの新しいバージョンがインストールされました", {
            type: "info",
            duration: 10000,
            action: {
              label: "更新",
              onClick: () => serviceWorker.skipWaiting(),
            },
          });
        }
      }
    );

    // Service Workerメッセージ固有の処理
    const unsubscribeSWUpdated = pubSub.on("sw:SW_UPDATED", () => {
      showToast("アプリケーションの新しいバージョンが利用可能です", {
        type: "info",
        duration: 10000,
        action: {
          label: "確認",
          onClick: () => serviceWorker.checkForUpdates(),
        },
      });
    });

    return () => {
      unsubscribeState();
      unsubscribeError();
      unsubscribeUpdateWaiting();
      unsubscribeSWUpdated();
    };
  }, [options, handleError, showToast, autoPromptUpdates]);

  // コンテキスト値の作成
  const contextValue = {
    // 現在の状態
    ...state,

    // コアAPI関数（serviceWorkerから直接使用）
    register: serviceWorker.register,
    unregister: serviceWorker.unregister,
    update: serviceWorker.update,
    sendMessage: serviceWorker.sendMessage,
    subscribeToMessage: serviceWorker.subscribeToMessage,
    checkForUpdates: serviceWorker.checkForUpdates,
    skipWaiting: serviceWorker.skipWaiting,
    clearCache: serviceWorker.clearCache,

    // React固有の追加機能
    showUpdatePrompt,
  };

  return (
    <ServiceWorkerContext.Provider value={contextValue}>
      {children}
    </ServiceWorkerContext.Provider>
  );
}

/**
 * useServiceWorker フック
 *
 * ServiceWorkerの機能にアクセスするためのカスタムフック。
 * ContextがProvidedされている場合はContextからの値を返し、
 * そうでない場合はserviceWorkerモジュールを直接使用します。
 */
export function useServiceWorker(): ServiceWorkerContextType {
  // Contextを試みる
  const context = useContext(ServiceWorkerContext);
  const isContextAvailable = Object.keys(context).length > 0;

  const { showToast } = useToast();
  const { handleError } = useErrorBoundary();

  // 現在のステート
  const [directState, setDirectState] = useState<ServiceWorkerState>(
    serviceWorker.getState()
  );

  // Context以外のケース用の更新プロンプト
  const showDirectUpdatePrompt = useCallback(() => {
    if (directState.registration?.waiting) {
      showToast("アプリの新しいバージョンがインストールされました", {
        type: "info",
        duration: 10000,
        action: {
          label: "更新",
          onClick: () => serviceWorker.skipWaiting(),
        },
      });
    }
  }, [directState.registration, showToast]);

  // Contextが利用できない場合は、直接serviceWorkerモジュールを使用
  useEffect(() => {
    if (isContextAvailable) return;

    // SSR対策
    if (typeof window === "undefined") return;

    // serviceWorkerの初期化
    serviceWorker
      .init()
      .catch((e) => console.error("Service Worker初期化エラー:", e));

    // 状態変更のサブスクライブ
    const unsubscribeState = pubSub.on("sw:state-changed", (newState) => {
      setDirectState((prev) => ({ ...prev, ...newState }));
    });

    // エラー処理
    const unsubscribeError = pubSub.on("sw:error", (error) => {
      handleError(error);
    });

    // 更新待機の通知
    const unsubscribeUpdateWaiting = pubSub.on("sw:update-waiting", () => {
      showDirectUpdatePrompt();
    });

    return () => {
      unsubscribeState();
      unsubscribeError();
      unsubscribeUpdateWaiting();
    };
  }, [isContextAvailable, handleError, showDirectUpdatePrompt]);

  // Contextが提供されている場合はそれを返し、そうでなければdirect版を返す
  if (isContextAvailable) {
    return context;
  }

  // direct版（Context Provider無しでも使用可能）
  return {
    ...directState,
    register: serviceWorker.register,
    unregister: serviceWorker.unregister,
    update: serviceWorker.update,
    sendMessage: serviceWorker.sendMessage,
    subscribeToMessage: serviceWorker.subscribeToMessage,
    checkForUpdates: serviceWorker.checkForUpdates,
    skipWaiting: serviceWorker.skipWaiting,
    clearCache: serviceWorker.clearCache,
    showUpdatePrompt: showDirectUpdatePrompt,
  };
}

/**
 * 更新チェックメソッド (外部からアクセス可能)
 * useServiceWorkerフックを使わずに直接更新を確認したい場合に使用
 */
export function checkForServiceWorkerUpdates(): Promise<boolean> {
  return serviceWorker.checkForUpdates();
}

// 型エクスポート（再エクスポート）
export type {
  ServiceWorkerOptions,
  ServiceWorkerMessage,
  ServiceWorkerMessageType,
  ServiceWorkerState,
} from "@/utils/serviceWorker";

// =============================================================================
/**
 * # ServiceWorkerの統合管理システム
 *
 * このモジュールは、コアServiceWorker機能（serviceWorker.ts）とReactコンポーネントを
 * シームレスに統合するための2つのアプローチを提供します。
 *
 * ## 使用方法の選択ガイド
 *
 * ### 1. ServiceWorkerProviderでラップして使う場合
 * ```tsx
 * // アプリのルートコンポーネントで
 * <ServiceWorkerProvider options={{ debug: true }}>
 *   <App />
 * </ServiceWorkerProvider>
 *
 * // 子コンポーネントで
 * function ChildComponent() {
 *   const { sendMessage, isUpdating } = useServiceWorker();
 *   // ...
 * }
 * ```
 *
 * #### このアプローチの推奨ケース:
 * - 大規模アプリケーション（明示的な依存関係の追跡が重要）
 * - 複数のServiceWorker設定が必要な場合（異なるスコープごとに別々のProviderを使用）
 * - テストが重要なプロジェクト（モック化が容易）
 * - チーム開発（依存関係が視覚的に明確）
 *
 * #### 利点:
 * - 依存関係の明示性が高い
 * - 複数設定の共存が可能
 * - テスト時の分離性が優れている
 * - UIロジックを一元管理できる
 *
 * ### 2. 直接useServiceWorkerを呼び出す場合
 * ```tsx
 * // どのコンポーネントでも
 * function AnyComponent() {
 *   const { sendMessage, isUpdating } = useServiceWorker();
 *   // ...
 * }
 * ```
 *
 * #### このアプローチの推奨ケース:
 * - 小〜中規模プロジェクト
 * - シンプルさと使いやすさが優先される場合
 * - ServiceWorkerが全アプリケーションで統一設定の場合
 * - 深くネストしたコンポーネントからのアクセスが多い場合
 *
 * #### 利点:
 * - ボイラープレートが少ない
 * - どこからでもアクセス可能
 * - シンプルで使いやすい
 * - 一貫した状態管理
 *
 * ### 3. ハイブリッドアプローチ（推奨）
 * ```tsx
 * // ルートでProviderを使用
 * <ServiceWorkerProvider options={{ debug: true }}>
 *   <App />
 * </ServiceWorkerProvider>
 *
 * // 任意のコンポーネントでフックを使用（Providerの有無を気にしない）
 * const { sendMessage } = useServiceWorker();
 *
 * // 非Reactコードで直接コア関数にアクセス
 * import { serviceWorker } from '@/utils/serviceWorker';
 * serviceWorker.sendMessage({...});
 * ```
 *
 * #### 利点:
 * - 柔軟性が最大（両方の長所を活かせる）
 * - コンポーネント外での利用も容易
 * - 段階的な導入が可能
 *
 * ### 4. 複数のServiceWorkerを異なる設定で使用する場合
 *
 * 以下のようなシナリオで複数のServiceWorkerが必要になる場合があります：
 * - 機能ごとに独立したキャッシュ戦略が必要な場合
 * - 異なるスコープのServiceWorkerが必要な場合（例：/api/、/assets/など）
 * - マイクロフロントエンドアーキテクチャを採用している場合
 *
 * #### マルチProviderパターン
 * ```tsx
 * // メインアプリケーション
 * <ServiceWorkerProvider options={{ path: '/main-sw.js', scope: '/' }}>
 *   <App>
 *     { 分析機能用の独立したServiceWorker }
 *     <ServiceWorkerProvider options={{ path: '/analytics-sw.js', scope: '/analytics/' }}>
 *       <AnalyticsModule />
 *     </ServiceWorkerProvider>
 *
 *     { オフライン機能用の別のServiceWorker }
 *     <ServiceWorkerProvider options={{ path: '/offline-sw.js', scope: '/offline/' }}>
 *       <OfflineModule />
 *     </ServiceWorkerProvider>
 *   </App>
 * </ServiceWorkerProvider>
 * ```
 *
 * #### コンテキスト識別とカスタムインスタンス作成
 * ```tsx
 * // 名前付きProviderを作成
 * const MainServiceWorkerContext = createContext<ServiceWorkerContextType>(defaultContext);
 * const AnalyticsServiceWorkerContext = createContext<ServiceWorkerContextType>(defaultContext);
 *
 * // カスタムProviderとフック
 * export function AnalyticsServiceWorkerProvider({ children, options = {} }) {
 *   // 実装はServiceWorkerProviderと同様...
 *   return (
 *     <AnalyticsServiceWorkerContext.Provider value={contextValue}>
 *       {children}
 *     </AnalyticsServiceWorkerContext.Provider>
 *   );
 * }
 *
 * // 特定のコンテキスト用のカスタムフック
 * export function useAnalyticsServiceWorker() {
 *   return useContext(AnalyticsServiceWorkerContext);
 * }
 * ```
 *
 * #### マルチServiceWorker利用の注意点
 * - 各ServiceWorkerのスコープは重複しないよう設計する
 * - リソース競合を避けるため、各ServiceWorkerの責務を明確に分離する
 * - キャッシュ名は一意にして衝突を避ける
 * - ネットワークリクエストの処理優先順位に注意する
 * - 複数のServiceWorkerが同時に更新通知を出さないよう制御する
 *
 * #### 実装例：ファイル管理と分析の分離
 * ```tsx
 * // ファイル管理モジュール
 * function FileManager() {
 *   // ファイル管理用ServiceWorkerのコンテキストを使用
 *   const { sendMessage } = useFileServiceWorker();
 *
 *   return <FileList onSync={() => sendMessage({ type: 'SYNC_FILES' })} />;
 * }
 *
 * // 分析モジュール
 * function Analytics() {
 *   // 分析用ServiceWorkerのコンテキストを使用
 *   const { sendMessage } = useAnalyticsServiceWorker();
 *
 *   return <DashboardView onCollect={() => sendMessage({ type: 'COLLECT_METRICS' })} />;
 * }
 * ```
 *
 * ## 重要なポイント
 *
 * 1. **SSRとの互換性**
 *    両方のアプローチでSSR対応済み（window/navigator存在チェック）
 *
 * 2. **コード分割**
 *    - コア機能: serviceWorker.ts（React非依存）
 *    - UI層: useServiceWorker.tsx（Reactフック・コンポーネント）
 *
 * 3. **初期化は自動的**
 *    フックが呼び出された時点で自動初期化（明示的初期化も可能）
 *
 * 4. **一貫したAPI**
 *    Providerの有無に関わらず同じインターフェイスでアクセス可能
 *
 * 5. **エラー処理**
 *    統合されたエラー処理システム（useErrorBoundaryと連携）
 *
 * 6. **通知システム**
 *    ServiceWorkerの更新などのイベントを自動的に通知（useToastと連携）
 *
 * ## ベストプラクティス
 *
 * - 大規模アプリ: まずProviderをルートに設置し、必要に応じて直接アクセス
 * - 小規模アプリ: 直接useServiceWorkerを使用（シンプルさ優先）
 * - マイクロフロントエンド: 各フロントエンドにProviderを設置（独立設定）
 * - パフォーマンス重視: Context更新が多い場合は直接アクセスを検討
 * - 複数のServiceWorker: 機能やスコープごとに専用のProviderを作成
 */

/**
 * # 複数のServiceWorker管理システム
 *
 * 機能ごとに独立したServiceWorkerを使用する場合のためのヘルパー関数群です。
 * 異なるスコープ、キャッシュ戦略、機能セットを持つServiceWorkerを簡単に作成できます。
 */

// =============================================================================
// appendix: ここからは、複数のServiceWorkerを管理するためのヘルパー関数群です。
// =============================================================================
/**
 * 新しいServiceWorkerコンテキストを作成するファクトリ関数
 *
 * @param name コンテキスト名（デバッグやロギングに使用）
 * @param defaultOptions デフォルトのServiceWorker設定オプション
 * @returns カスタムServiceWorkerフックとプロバイダー
 *
 * @example
 * // analytics用のServiceWorkerコンテキストを作成
 * const {
 *   ServiceWorkerProvider: AnalyticsServiceWorkerProvider,
 *   useServiceWorker: useAnalyticsServiceWorker
 * } = createServiceWorkerContext('analytics', {
 *   path: '/analytics-sw.js',
 *   scope: '/analytics/'
 * });
 */
export function createServiceWorkerContext(
  name: string,
  defaultOptions: ServiceWorkerOptions = {}
) {
  // 固有の名前付きコンテキストを作成
  const CustomServiceWorkerContext =
    createContext<ServiceWorkerContextType>(defaultContext);

  // pubSubイベントプレフィックスを作成（複数のSWでのイベント区別のため）
  const eventPrefix = `sw:${name}:`;

  // 将来的に複数ServiceWorkerインスタンスを分離したい場合は、
  // serviceWorker.tsをファクトリパターンに変更、pubSubイベントの分離、
  // createServiceWorkerContextを修正する必要があります。
  // 現状でも「論理的な分離」によるマルチサービスワーカー運用は可能ですが、
  // 真に独立した制御はできません。

  // スコープベースでのブラウザの自動振り分けを活用し、
  // UIレイヤーでコンテキスト情報を付加することで、現在の設計でも多くの場合は十分な分離が可能です
  // const api = createServiceWorkerContext('api', { path: '/api-sw.js', scope: '/api/' });
  // const assets = createServiceWorkerContext('assets', { path: '/assets-sw.js', scope: '/assets/' });

  /**
   * カスタムServiceWorkerプロバイダーコンポーネント
   */
  function CustomServiceWorkerProvider({
    children,
    options = {},
    autoPromptUpdates = true,
  }: {
    children: React.ReactNode;
    options?: ServiceWorkerOptions;
    autoPromptUpdates?: boolean;
  }) {
    const { showToast } = useToast();
    const { handleError } = useErrorBoundary();

    // オプションをマージ
    const mergedOptions = { ...defaultOptions, ...options };

    // serviceWorker.tsの現在の状態をReactステートに同期
    const [state, setState] = useState<ServiceWorkerState>(
      serviceWorker.getState()
    );

    // 更新プロンプトを表示する関数
    const showUpdatePrompt = useCallback(() => {
      if (state.registration?.waiting) {
        showToast(`${name}: アプリの新しいバージョンがインストールされました`, {
          type: "info",
          duration: 10000,
          action: {
            label: "更新",
            onClick: () => serviceWorker.skipWaiting(),
          },
        });
      }
    }, [state.registration]);

    // pubSubイベントの購読と状態更新
    useEffect(() => {
      // SSR対策
      if (typeof window === "undefined") return;

      // serviceWorkerの初期化
      serviceWorker
        .init(mergedOptions)
        .catch((e) => console.error(`${name} Service Worker初期化エラー:`, e));

      // 状態変更のサブスクライブ - コンテキスト固有のイベント名で購読
      const unsubscribeState = pubSub.on("sw:state-changed", (newState) => {
        setState((prev) => ({ ...prev, ...newState }));
        // コンテキスト固有のイベントも発行
        pubSub.emit(`${eventPrefix}state-changed` as any, newState);
      });

      // エラー処理 - コンテキスト固有のエラーイベントも発行
      const unsubscribeError = pubSub.on("sw:error", (error) => {
        handleError(error);
        // コンテキスト固有のイベントも発行
        pubSub.emit(`${eventPrefix}error` as any, error);
      });

      // 更新待機の通知
      const unsubscribeUpdateWaiting = pubSub.on(
        "sw:update-waiting",
        ({ registration }) => {
          if (autoPromptUpdates) {
            showToast(
              `${name}: アプリの新しいバージョンがインストールされました`,
              {
                type: "info",
                duration: 10000,
                action: {
                  label: "更新",
                  onClick: () => serviceWorker.skipWaiting(),
                },
              }
            );
          }
          // コンテキスト固有のイベントも発行
          pubSub.emit(`${eventPrefix}update-waiting` as any, { registration });
        }
      );

      // Service Workerメッセージ固有の処理も拡張
      const unsubscribeSWUpdated = pubSub.on("sw:SW_UPDATED", (data) => {
        if (autoPromptUpdates) {
          showToast(
            `${name}: アプリケーションの新しいバージョンが利用可能です`,
            {
              type: "info",
              duration: 10000,
              action: {
                label: "確認",
                onClick: () => serviceWorker.checkForUpdates(),
              },
            }
          );
        }
        // コンテキスト固有のイベントも発行
        pubSub.emit(`${eventPrefix}SW_UPDATED` as any, data);
      });

      return () => {
        unsubscribeState();
        unsubscribeError();
        unsubscribeUpdateWaiting();
        unsubscribeSWUpdated();
      };
    }, [mergedOptions, handleError, showToast, autoPromptUpdates]);

    // メッセージ送信ラッパー - コンテキスト名をメッセージに追加
    const sendContextMessage = useCallback(
      <T = any, R = any>(message: ServiceWorkerMessage<T>) => {
        // コンテキスト情報を追加したメッセージを作成
        const contextMessage = {
          ...message,
          context: name, // コンテキスト名を追加
        };
        return serviceWorker.sendMessage<T, R>(contextMessage);
      },
      []
    );

    // メッセージ購読ラッパー - コンテキスト固有のイベントを優先
    const subscribeToContextMessage = useCallback(
      <T = any,>(
        type: ServiceWorkerMessageType,
        callback: (data: T) => void
      ) => {
        // コンテキスト固有のイベントとグローバルイベントの両方を購読
        const contextUnsubscribe = pubSub.on(
          `${eventPrefix}${type}` as any,
          callback
        );
        const globalUnsubscribe = pubSub.on(
          `sw:${type}` as any,
          (data: any) => {
            // コンテキスト名が一致する場合またはコンテキスト情報がない場合のみコールバック実行
            if (!data?.context || data.context === name) {
              callback(data);
            }
          }
        );

        // 両方の購読を解除する関数を返す
        return () => {
          contextUnsubscribe();
          globalUnsubscribe();
        };
      },
      []
    );

    // コンテキスト値の作成
    const contextValue = {
      // 現在の状態
      ...state,

      // コアAPI関数 - コンテキスト情報付きの拡張版
      register: (options?: ServiceWorkerOptions) =>
        serviceWorker.register({ ...mergedOptions, ...options, context: name }),
      unregister: serviceWorker.unregister,
      update: serviceWorker.update,
      // コンテキスト固有の拡張版メッセージング関数を使用
      sendMessage: sendContextMessage,
      subscribeToMessage: subscribeToContextMessage,
      checkForUpdates: serviceWorker.checkForUpdates,
      skipWaiting: serviceWorker.skipWaiting,
      clearCache: (cacheName?: string) =>
        serviceWorker.clearCache(
          cacheName ? `${name}-${cacheName}` : undefined
        ),

      // React固有の追加機能
      showUpdatePrompt,
    };

    return (
      <CustomServiceWorkerContext.Provider value={contextValue}>
        {children}
      </CustomServiceWorkerContext.Provider>
    );
  }

  /**
   * カスタムServiceWorkerフック
   * 独自のServiceWorkerコンテキストにアクセスするフック
   */
  function useCustomServiceWorker(): ServiceWorkerContextType {
    const context = useContext(CustomServiceWorkerContext);
    const defaultServiceWorker = useServiceWorker(); // 常に呼び出す

    if (context === defaultContext) {
      console.warn(
        `${name}ServiceWorkerProvider が見つかりません。デフォルト実装を使用します。`
      );
      return defaultServiceWorker;
    }

    return context;
  }

  return {
    ServiceWorkerProvider: CustomServiceWorkerProvider,
    useServiceWorker: useCustomServiceWorker,
    contextName: name,
    eventPrefix, // イベントプレフィックスも公開
  };
}
/**
 * マルチServiceWorkerシステムの使用例
 *
 * @example
 * // メインアプリケーション用ServiceWorker
 * const {
 *   ServiceWorkerProvider: MainServiceWorkerProvider,
 *   useServiceWorker: useMainServiceWorker
 * } = createServiceWorkerContext('main', {
 *   path: '/main-sw.js',
 *   scope: '/'
 * });
 *
 * // 分析機能用ServiceWorker
 * const {
 *   ServiceWorkerProvider: AnalyticsServiceWorkerProvider,
 *   useServiceWorker: useAnalyticsServiceWorker
 * } = createServiceWorkerContext('analytics', {
 *   path: '/analytics-sw.js',
 *   scope: '/analytics/'
 * });
 *
 * // オフライン機能用ServiceWorker
 * const {
 *   ServiceWorkerProvider: OfflineServiceWorkerProvider,
 *   useServiceWorker: useOfflineServiceWorker
 * } = createServiceWorkerContext('offline', {
 *   path: '/offline-sw.js',
 *   scope: '/offline/'
 * });
 *
 * // アプリケーションでの使用
 * function App() {
 *   return (
 *     <MainServiceWorkerProvider>
 *       <Layout>
 *         <MainContent />
 *
 *         <AnalyticsServiceWorkerProvider>
 *           <AnalyticsModule />
 *         </AnalyticsServiceWorkerProvider>
 *
 *         <OfflineServiceWorkerProvider>
 *           <OfflineModule />
 *         </OfflineServiceWorkerProvider>
 *       </Layout>
 *     </MainServiceWorkerProvider>
 *   );
 * }
 *
 * // 各コンポーネントでの使用
 * function AnalyticsModule() {
 *   // 分析専用のServiceWorkerを使用
 *   const { sendMessage } = useAnalyticsServiceWorker();
 *
 *   const collectData = () => {
 *     sendMessage({ type: 'COLLECT_ANALYTICS_DATA' });
 *   };
 *
 *   return <button onClick={collectData}>分析データを収集</button>;
 * }
 *
 * function OfflineModule() {
 *   // オフライン機能専用のServiceWorkerを使用
 *   const { sendMessage } = useOfflineServiceWorker();
 *
 *   const syncData = () => {
 *     sendMessage({ type: 'SYNC_OFFLINE_DATA' });
 *   };
 *
 *   return <button onClick={syncData}>オフラインデータを同期</button>;
 * }
 */

/**
 * ## 複数ServiceWorker利用時の注意点
 *
 * ### 1. スコープの分離
 * 各ServiceWorkerのスコープは重複しないよう設計してください。
 *
 * ```typescript
 * // メインServiceWorker (全体スコープ)
 * const main = createServiceWorkerContext('main', { path: '/sw.js', scope: '/' });
 *
 * // APIキャッシュ専用ServiceWorker
 * const api = createServiceWorkerContext('api', { path: '/api-sw.js', scope: '/api/' });
 *
 * // 静的アセット専用ServiceWorker
 * const assets = createServiceWorkerContext('assets', { path: '/assets-sw.js', scope: '/assets/' });
 * ```
 *
 * ### 2. キャッシュ設計
 * 各ServiceWorkerが使用するキャッシュ名は一意になるようプレフィックスを付けてください。
 *
 * ```javascript
 * // sw-main.js
 * const CACHE_NAME = 'main-cache-v1';
 *
 * // sw-api.js
 * const CACHE_NAME = 'api-cache-v1';
 *
 * // sw-assets.js
 * const CACHE_NAME = 'assets-cache-v1';
 * ```
 *
 * ### 3. 更新通知の制御
 * 複数のServiceWorkerからの更新通知が同時に表示されないよう制御が必要です。
 *
 * ```tsx
 * <MainServiceWorkerProvider autoPromptUpdates={true}>
 *   <ApiServiceWorkerProvider autoPromptUpdates={false}>
 *     <AssetsServiceWorkerProvider autoPromptUpdates={false}>
 *       <App />
 *     </AssetsServiceWorkerProvider>
 *   </ApiServiceWorkerProvider>
 * </MainServiceWorkerProvider>
 * ```
 *
 * ### 4. ネットワークリクエスト処理の優先順位
 * 複数のServiceWorkerが同じURLパターンにマッチする場合、
 * ブラウザは最も具体的なスコープを持つServiceWorkerを使用します。
 * スコープ設計時はこの挙動を考慮してください。
 *
 * ### 5. リソース消費
 * 複数のServiceWorkerはブラウザのリソースを消費します。
 * 必要な機能分離のためだけに使用し、過度な分割は避けてください。
 */
