/**
 * アンドゥ/リドゥシステムのコア機能
 * - メモリ効率の高い状態管理
 * - パフォーマンスを意識した実装
 * - スマートなプラグインアーキテクチャ
 */

import { perfMonitor } from "@/utils/performanceMonitor";
import { objUt } from "@/utils/objectUtils";

import {
  UndoableAction,
  UndoStackOptions,
  UndoStack,
  UndoStackState,
  OperationRecord,
  MemoryUsage,
} from "./types";

import {
  validatePluginDependencies,
  sortPluginsByDependencyOrder,
  buildPluginEventMap,
  emitPluginEvent,
} from "./pluginSystem";

import { createDebugger, withPerformanceTracking } from "./performanceUtils";

import {
  estimateActionSize,
  estimateTotalMemoryUsage,
  trimHistoryBasedOnMemory,
  optimizeActionForStorage,
  enhancedGarbageCollection,
  getAdjustedGCInterval,
} from "./memoryManager";

/**
 * 強化されたアンドゥスタックを作成する関数
 * アプリケーション全体で使用可能な中核コンポーネント
 */
export function createUndoStack<T>(
  options: UndoStackOptions = {}
): UndoStack<T> {
  const {
    maxHistory,
    debug = false,
    compress = false,
    performanceMonitoring = false,
    memoryEfficient = true,
    plugins = [],
    gcInterval = 30000, // 30秒ごとにGC
    memoryThreshold,
    selectivePaths,
    memoryBasedLimit = false,
    maxMemorySize = 50,
    largeActionThreshold = 100,
  } = options;

  // パフォーマンスモニタリングの設定
  // getInstance()ではなく直接perfMonitorを使用
  const perfMonitorInstance = performanceMonitoring ? perfMonitor : undefined;

  if (perfMonitorInstance && performanceMonitoring) {
    perfMonitorInstance.setEnabled(true);
  }

  // ステート管理
  let past: UndoableAction<T>[] = [];
  let future: UndoableAction<T>[] = [];
  let isPerformingAction = false;
  let lastOperation: OperationRecord | undefined = undefined;
  let lastState: T | undefined;
  let totalMemoryLimitBytes = maxMemorySize * 1024 * 1024; // MB → バイト

  // デバッガー関数
  const logger = createDebugger(debug);
  // プラグインの依存関係を検証
  validatePluginDependencies(plugins, logger);

  // プラグインを依存関係に基づいてソート
  const sortedPlugins = sortPluginsByDependencyOrder(plugins);

  // イベントマップの構築（最適化）
  const pluginEventMap = buildPluginEventMap(sortedPlugins);

  /**
   * アクションを実行して結果を返す
   */
  const executeAction = <R>(actionFn: () => R, actionName: string): R => {
    try {
      isPerformingAction = true;

      // パフォーマンス監視（有効な場合のみ）
      const startTime = perfMonitorInstance?.startTimer() || 0;
      const result = actionFn();

      if (perfMonitorInstance && performanceMonitoring) {
        const duration = perfMonitorInstance.endTimer(startTime);
        logger.log(`${actionName} 実行完了 (${duration.toFixed(2)}ms)`);
      } else {
        logger.log(`${actionName} 実行完了`);
      }

      return result;
    } catch (error) {
      logger.error(`${actionName} エラー`, error);
      throw error;
    } finally {
      isPerformingAction = false;
    }
  };

  /**
   * アクションの圧縮を試行（同じラベルの連続アクションをまとめる）
   */
  const tryCompressAction = (action: UndoableAction<T>): boolean => {
    if (!compress || !action.label || past.length === 0) {
      return false;
    }

    const lastAction = past[past.length - 1];
    if (lastAction.label === action.label) {
      // 前回と同じラベルのアクションは圧縮の対象
      past[past.length - 1] = action;
      logger.log(`アクション圧縮: ${action.label}`);
      return true;
    }

    return false;
  };

  /**
   * ガベージコレクション - 未使用のメモリを解放
   */
  const garbageCollect = () => {
    if (past.length === 0 && future.length === 0) return;

    const startTime = perfMonitorInstance?.startTimer() || 0;
    logger.log("ガベージコレクション実行中...");

    // メモリ最適化の強化版を使用
    const {
      past: optimizedPast,
      future: optimizedFuture,
      freedBytes,
    } = enhancedGarbageCollection(past, future, {
      memoryEfficient,
      memoryBasedLimit,
      maxMemorySize,
      largeActionThreshold,
    });

    // 結果を反映
    past = optimizedPast;
    future = optimizedFuture;

    // アクションサイズを表示
    if (debug) {
      const memoryUsage = estimateTotalMemoryUsage(past, future);
      logger.log(
        `解放されたメモリ: ${(freedBytes / 1024 / 1024).toFixed(2)} MB`
      );
      logger.log(
        `現在のメモリ使用量: ${(
          memoryUsage.estimatedBytes /
          1024 /
          1024
        ).toFixed(2)} MB`
      );

      if (memoryUsage.largestAction) {
        logger.log(
          `最大のアクション: ${
            memoryUsage.largestAction.label || "unnamed"
          } (${(memoryUsage.largestAction.size / 1024).toFixed(2)} KB)`
        );
      }
    }

    // プラグインの実行（最適化: イベントリスナーがある場合のみ）
    if (pluginEventMap.gc) {
      emitPluginEvent("gc", sortedPlugins, logger, pluginEventMap, stack);
    }

    if (perfMonitorInstance) {
      lastOperation = {
        type: "clear",
        timestamp: Date.now(),
        duration: perfMonitorInstance.endTimer(startTime),
        memoryUsage: perfMonitorInstance.getMemoryUsage(),
        label: `GC (${(freedBytes / 1024).toFixed(2)}KB freed)`,
      };
    }

    logger.log("ガベージコレクション完了");
  };

  /**
   * GCタイマーの設定
   */
  // GCタイマーの設定
  const setupGCTimer = () => {
    if (perfMonitorInstance && performanceMonitoring) {
      // ガベージコレクションの頻度を履歴サイズに合わせて動的に調整
      const adjustedInterval = getAdjustedGCInterval(past.length, gcInterval);

      // 前回のタイマーをクリア（重複防止）
      if (perfMonitorInstance.cancelGC) {
        perfMonitorInstance.cancelGC("undoStackGC");
      }

      // 新しいガベージコレクションをスケジュール
      perfMonitorInstance.scheduleGC(
        "undoStackGC",
        garbageCollect,
        adjustedInterval
      );

      // メモリ使用量が高い場合は緊急ガベージコレクションを実行
      const memoryUsage = estimateTotalMemoryUsage(past, future);
      const memoryThresholdBytes = (memoryThreshold || 50) * 1024 * 1024;

      if (memoryUsage.estimatedBytes > memoryThresholdBytes) {
        // 10秒後に緊急GCを実行
        setTimeout(() => {
          logger.log("メモリしきい値を超過、緊急ガベージコレクションを実行");
          garbageCollect();
        }, 10000);
      }
    }
  };

  // GCタイマーを初期設定（パフォーマンスモニターが有効な場合）
  if (perfMonitorInstance) {
    setupGCTimer();
  }

  /**
   * アクションが差分ベースかどうかを判断
   */
  const isDiffAction = (action: UndoableAction<T>): boolean => {
    return (
      !!action.isMutation &&
      Array.isArray(action.targetPaths) &&
      action.targetPaths.length > 0
    );
  };

  /**
   * 選択的クローンを作成（セレクティブパスが設定されている場合）
   */
  const createSelectiveClone = (() => {
    // 最後にクローンした状態と結果をキャッシュ
    let cachedState: any = undefined;
    let cachedResult: any = undefined;
    let cachedPaths: string[] | undefined = undefined;

    return (state: T): T => {
      // 参照が同じなら前回の結果を返す
      if (
        state === cachedState &&
        (!selectivePaths || selectivePaths === cachedPaths)
      ) {
        return cachedResult;
      }

      if (!selectivePaths || selectivePaths.length === 0) {
        cachedState = state;
        cachedResult = state;
        cachedPaths = selectivePaths;
        return state;
      }

      // 新しいクローンを作成
      cachedState = state;
      cachedPaths = selectivePaths;
      cachedResult = objUt.selectiveDeepClone(
        state as Record<string, any>,
        selectivePaths
      ) as T;
      return cachedResult;
    };
  })();

  /**
   * メモリ使用量の監視とサイズ制限の適用
   */
  const enforceMemoryLimits = () => {
    if (!memoryBasedLimit) {
      // メモリベースの制限が有効でない場合は通常の履歴数制限を適用
      if (maxHistory !== undefined && past.length > maxHistory) {
        logger.log(`履歴上限(${maxHistory})を超えたため古い履歴を削除`);
        past = past.slice(-maxHistory);
      }
      return;
    }

    // メモリベースの制限を適用
    const memoryUsage = estimateTotalMemoryUsage(past, future);

    // メモリ使用量が閾値を超えている場合
    if (memoryUsage.estimatedBytes > totalMemoryLimitBytes) {
      logger.log(
        `メモリ使用量(${(memoryUsage.estimatedBytes / 1024 / 1024).toFixed(
          2
        )}MB)が上限を超えました。履歴を最適化します。`
      );
      past = trimHistoryBasedOnMemory(past, {
        memoryBasedLimit: true,
        maxMemorySize,
      });

      // メモリ警告を発行
      if (pluginEventMap.memoryWarning) {
        emitPluginEvent(
          "memoryWarning",
          sortedPlugins,
          logger,
          pluginEventMap,
          memoryUsage,
          stack
        );
      }
    }
  };

  // スタックオブジェクトの作成
  const stack: UndoStack<T> = {
    /**
     * 関数とクローン化する引数からアクションを作成
     */
    createAction(doFn, undoFn, label, ...args) {
      logger.log(`アクション作成: ${label || "unnamed"}`, { args });

      // 引数をディープクローン
      const clonedArgs = args.map((arg) => objUt.deepClone(arg));

      const action: UndoableAction<T> = {
        do: () => doFn(...clonedArgs),
        undo: () => undoFn(...clonedArgs),
        label,
        args: clonedArgs,
      };

      // メモリ使用量の推定
      estimateActionSize(action);

      return action;
    },

    /**
     * 直接関数を受け取り、実行してスタックに追加
     */
    push(doFn, undoFn, label, ...args) {
      // withPerformanceTracking関数を使用してパフォーマンス測定
      const { result, duration } = withPerformanceTracking(
        "push",
        () => {
          logger.log(`アクション追加: ${label || "unnamed"}`, { args });

          // 引数をディープクローン
          const clonedArgs = args.map((arg) => objUt.deepClone(arg));

          // 新しいアクションを実行
          const actionResult = doFn(...clonedArgs);

          // アクションオブジェクト作成
          const action: UndoableAction<T> = {
            do: () => doFn(...clonedArgs),
            undo: () => undoFn(...clonedArgs),
            label,
            args: clonedArgs,
          };

          // メモリ使用量を推定
          estimateActionSize(action);

          // 最新の状態を記録（差分計算用）
          lastState = actionResult;

          // プラグインの実行（最適化されたイベントチェック）
          if (pluginEventMap.actionPush) {
            emitPluginEvent(
              "actionPush",
              sortedPlugins,
              logger,
              pluginEventMap,
              action,
              stack
            );
          }

          // 圧縮を試行、失敗したら通常通り追加
          if (!compress || !tryCompressAction(action)) {
            past.push(action);
            // 履歴の制限を適用
            enforceMemoryLimits();
          }

          // Redoスタックをクリア
          if (future.length > 0) {
            logger.log("Redoスタックをクリア");
            future = [];
          }

          return actionResult;
        },
        "push",
        logger,
        performanceMonitoring,
        perfMonitorInstance,
        (op) => {
          lastOperation = op;
        },
        () => setupGCTimer(),
        { label }
      );

      return result;
    },

    /**
     * メモリ効率化された差分ベースのアクション作成（拡張版）
     */
    createDiffAction(prevState, nextState, label) {
      if (!memoryEfficient) {
        // 差分機能を使用しない場合、通常のアクションを作成
        return this.createAction(
          () => nextState,
          () => prevState,
          label || "state change"
        );
      }

      try {
        const { pathDiffs, diff, reverseDiff } = objUt.analyzeDiff(
          prevState,
          nextState
        );

        // パスベースの差分抽出を試みる（より詳細な差分情報を取得）
        const paths = Object.keys(pathDiffs);

        // 差分がない場合は何もしない
        if (paths.length === 0) {
          return this.createAction(
            () => nextState,
            () => prevState,
            `${label || "noop"} (no changes)`
          );
        }

        // 差分ベースのアクションを作成
        const action: UndoableAction<T> = {
          do: () => objUt.applyDiff(prevState, diff) as T,
          undo: () => objUt.applyDiff(nextState, reverseDiff) as T,
          label: `${label || "diff"} (${paths.length} changes)`,
          isMutation: true,
          targetPaths: paths,
        };

        logger.log(`差分ベースのアクション作成: ${action.label}`, {
          pathCount: paths.length,
          samplePaths: paths.slice(0, 3),
          detailedDiffs: debug ? pathDiffs : undefined,
        });

        // メモリサイズを推定
        estimateActionSize(action);

        return action;
      } catch (err: any) {
        // 差分計算に失敗した場合は完全な状態に切り替える
        logger.warn(
          `差分計算に失敗しました: ${err.message}。完全な状態を使用します。`
        );
        return this.createAction(
          () => nextState,
          () => prevState,
          `${label || "state change"} (full state)`
        );
      }
    },

    /**
     * アクションオブジェクトを直接追加
     */
    pushAction(action) {
      // withPerformanceTracking関数を使用してパフォーマンス測定
      const { result } = withPerformanceTracking(
        "push",
        () => {
          logger.log(`UndoableActionの追加: ${action.label || "unnamed"}`);

          // アクションのサイズを推定
          const actionSize = estimateActionSize(action);

          // 大きなアクションの場合は最適化
          const finalAction =
            actionSize > largeActionThreshold * 1024
              ? optimizeActionForStorage(action, { largeActionThreshold })
              : action;

          // 差分ベースのアクションかどうかをログに記録
          if (isDiffAction(finalAction)) {
            logger.log(
              `差分ベースのアクションを実行: ${
                finalAction.targetPaths?.length || 0
              }のパスが影響を受けます`
            );
          }

          // アクションを実行
          const result = executeAction(() => finalAction.do(), "doAction");

          // 最新の状態を記録
          lastState = result;

          // プラグインの実行
          if (pluginEventMap.actionPush) {
            emitPluginEvent(
              "actionPush",
              sortedPlugins,
              logger,
              pluginEventMap,
              finalAction,
              stack
            );
          }

          // 圧縮を試行、失敗したら通常通り追加
          if (!compress || !tryCompressAction(finalAction)) {
            past.push(finalAction);
            // 履歴の制限を適用
            enforceMemoryLimits();
          }

          // Redoスタックをクリア
          future = [];

          return result;
        },
        "pushAction",
        logger,
        performanceMonitoring,
        perfMonitorInstance,
        (op) => {
          lastOperation = op;
        },
        () => setupGCTimer(),
        { label: action.label, size: action.estimatedSize }
      );

      return result;
    },

    /**
     * 直前のアクションを元に戻す
     */
    undo() {
      if (!this.canUndo) {
        logger.log("アンドゥできるアクションがありません");
        return undefined;
      }

      const { result } = withPerformanceTracking(
        "undo",
        () => {
          const action = past.pop()!;
          logger.log(`アンドゥ実行: ${action.label || "unnamed"}`);

          // プラグインの実行（Undo前）
          if (pluginEventMap.undo) {
            emitPluginEvent(
              "undo",
              sortedPlugins,
              logger,
              pluginEventMap,
              action,
              stack
            );
          }

          // アクションを実行して状態を元に戻す
          const undoResult = action.undo();

          // 差分ベースのアクションの場合、強制的に新しいオブジェクトを生成する
          if (undoResult && typeof undoResult === "object") {
            // 必ず新しいオブジェクト参照を作成してからlastStateに格納
            lastState = isDiffAction(action)
              ? objUt.deepClone(undoResult)
              : undoResult;

            logger.log(`Undo後の状態:`, undoResult);
          } else {
            logger.error("Undo後の状態が不正です:", undoResult);
            lastState = undoResult; // それでも格納
          }

          // 将来スタックに移動（必ず新しいアクション配列を作成し参照を変える）
          future.unshift(action);

          return lastState;
        },
        "undoAction",
        logger,
        performanceMonitoring,
        perfMonitorInstance,
        (op) => {
          lastOperation = op;
        },
        () => setupGCTimer()
      );

      return result;
    },

    /**
     * 元に戻したアクションをやり直す
     */
    redo() {
      if (!this.canRedo) {
        logger.log("リドゥできるアクションがありません");
        return undefined;
      }

      const { result } = withPerformanceTracking(
        "redo",
        () => {
          const action = future.shift()!;
          logger.log(`リドゥ実行: ${action.label || "unnamed"}`);

          // プラグインの実行（Redo前）
          if (pluginEventMap.redo) {
            emitPluginEvent(
              "redo",
              sortedPlugins,
              logger,
              pluginEventMap,
              action,
              stack
            );
          }

          // アクションを実行
          const redoResult = action.do();

          // 必ず新しい参照を作成
          if (redoResult && typeof redoResult === "object") {
            lastState = isDiffAction(action)
              ? objUt.deepClone(redoResult)
              : redoResult;
          } else {
            lastState = redoResult;
          }

          // 履歴に戻す
          past.push(action);

          // 履歴の制限を適用
          enforceMemoryLimits();

          return lastState;
        },
        "redoAction",
        logger,
        performanceMonitoring,
        perfMonitorInstance,
        (op) => {
          lastOperation = op;
        },
        () => setupGCTimer()
      );

      return result;
    },

    /**
     * 複数のアクションをまとめて一つのアクションとしてスタックに追加
     */
    batch(actions, label) {
      if (actions.length === 0) {
        return undefined;
      }

      const { result } = withPerformanceTracking(
        "push",
        () => {
          logger.log(
            `バッチアクション作成: ${label || "batch"} (${actions.length}件)`
          );

          // バッチアクションを作成
          const batchAction: UndoableAction<T> = {
            do: () => {
              let result: T | undefined;
              for (const action of actions) {
                result = action.do();
              }
              return result!;
            },
            undo: () => {
              let result: T | undefined;
              // 逆順でアンドゥを実行
              for (let i = actions.length - 1; i >= 0; i--) {
                result = actions[i].undo();
              }
              return result!;
            },
            label,
            // バッチアクションのメタデータを設定
            metadata: {
              timestamp: Date.now(),
              compressed: false,
            },
          };

          // バッチのサイズを推定
          let totalSize = 0;
          for (const action of actions) {
            totalSize += estimateActionSize(action);
          }
          batchAction.estimatedSize = totalSize;

          return this.pushAction(batchAction);
        },
        "batchActions",
        logger,
        performanceMonitoring,
        perfMonitorInstance,
        (op) => {
          lastOperation = op;
        },
        () => setupGCTimer(),
        { label }
      );

      return result;
    },

    /**
     * タグ付けされた時点までアンドゥする
     */
    undoUntil(label) {
      if (!this.canUndo) {
        return undefined;
      }

      const { result } = withPerformanceTracking(
        "undo",
        () => {
          logger.log(`${label}までアンドゥ`);

          let result: T | undefined;
          let found = false;

          while (this.canUndo && !found) {
            const action = past[past.length - 1];
            result = this.undo();
            found = action.label === label;
          }

          return result;
        },
        "undoUntil",
        logger,
        performanceMonitoring,
        perfMonitorInstance,
        (op) => {
          lastOperation = op;
        },
        () => setupGCTimer(),
        { label: `undoUntil(${label})` }
      );

      return result;
    },

    /**
     * 指定されたインデックスまでアンドゥする
     */
    undoTo(index) {
      if (index < 0 || index >= past.length) {
        return undefined;
      }

      const { result } = withPerformanceTracking(
        "undo",
        () => {
          logger.log(`インデックス${index}までアンドゥ`);

          const actionsToUndo = past.length - index - 1;
          let result: T | undefined;

          for (let i = 0; i < actionsToUndo; i++) {
            result = this.undo();
          }

          return result;
        },
        "undoTo",
        logger,
        performanceMonitoring,
        perfMonitorInstance,
        (op) => {
          lastOperation = op;
        },
        () => setupGCTimer(),
        { label: `undoTo(${index})` }
      );

      return result;
    },

    /**
     * 現在の状態からすべてのアクションを再実行する
     */
    rebuild(initialState, setStateFn) {
      const { result } = withPerformanceTracking(
        "push",
        () => {
          logger.log("履歴の再構築を実行...");

          // 現在のスタック状態を保存
          const currentPast = [...past];
          const currentFuture = [...future];

          // スタックをクリア
          this.clear();

          // 初期状態を設定
          setStateFn(initialState);
          lastState = initialState;

          // 保存されたアクションを再実行
          let finalState: T = initialState;
          for (const action of currentPast) {
            try {
              // アクションを再度実行して結果を取得
              finalState = action.do();
              // スタックに追加（実行せずに）
              past.push(action);
            } catch (error) {
              logger.error("アクションの再実行中にエラー", error);
              // エラーが発生したアクションはスキップ
              continue;
            }
          }

          // 将来のアクションを復元
          future = currentFuture;

          logger.log("履歴の再構築完了", {
            past: past.length,
            future: future.length,
          });

          lastState = finalState;
          return finalState;
        },
        "rebuild",
        logger,
        performanceMonitoring,
        perfMonitorInstance,
        (op) => {
          lastOperation = op;
        },
        () => setupGCTimer()
      );

      return result;
    },

    /**
     * スタックをクリア（拡張版）
     */
    clear() {
      const { result } = withPerformanceTracking(
        "clear",
        () => {
          logger.log("履歴クリア");

          // メモリ効率のための明示的なクリーンアップ
          if (past.length > 0 || future.length > 0) {
            // 明示的にメモリを解放
            past.forEach((action) => {
              // 循環参照を断ち切る
              if (action.args) {
                action.args = [];
              }
            });

            future.forEach((action) => {
              if (action.args) {
                action.args = [];
              }
            });

            // プラグインの実行
            if (pluginEventMap.clear) {
              emitPluginEvent(
                "clear",
                sortedPlugins,
                logger,
                pluginEventMap,
                stack
              );
            }

            past = [];
            future = [];

            // 明示的なGCのトリガー
            if (perfMonitorInstance) {
              perfMonitorInstance.cancelGC("undoStackGC");
              garbageCollect();
            }
          }

          return true;
        },
        "clear",
        logger,
        performanceMonitoring,
        perfMonitorInstance,
        (op) => {
          lastOperation = op;
        }
      );

      return result;
    },

    /**
     * 現在の状態を取得
     */
    getCurrentState() {
      if (lastState === undefined) {
        logger.log("lastStateがundefinedです");
        return undefined;
      }

      logger.log("getCurrentState called, returning:", lastState);

      // selectivePathsがなければ単に参照を返す（メモ化関数は不要）
      if (!selectivePaths || selectivePaths.length === 0) {
        return lastState;
      }

      // 選択的パスがある場合のみクローン関数を使用
      return createSelectiveClone(lastState);
    },

    /**
     * アンドゥ可能かどうか
     */
    get canUndo() {
      return past.length > 0 && !isPerformingAction;
    },

    /**
     * リドゥ可能かどうか
     */
    get canRedo() {
      return future.length > 0 && !isPerformingAction;
    },

    /**
     * アンドゥ履歴のスナップショットを取得
     */
    get history() {
      return past.map((action, index) => ({
        index,
        label: action.label || `アクション ${index + 1}`,
      }));
    },

    /**
     * 現在の状態の情報を取得
     */
    get state(): UndoStackState {
      return {
        past: past.length,
        future: future.length,
        canUndo: this.canUndo,
        canRedo: this.canRedo,
        lastOperation,
      };
    },

    /**
     * 現在のメモリ使用量を推定
     */
    getMemoryUsage(): MemoryUsage {
      const usageInfo = estimateTotalMemoryUsage(past, future);

      return {
        ...usageInfo,
        lastOperation,
      };
    },

    /**
     * 生の履歴データにアクセス (高度な操作用)
     */
    _getRawHistory() {
      return {
        past: [...past],
        future: [...future],
      };
    },
  };

  // プラグインの初期化
  if (pluginEventMap.init) {
    emitPluginEvent("init", sortedPlugins, logger, pluginEventMap, stack);
  }

  return stack;
}
