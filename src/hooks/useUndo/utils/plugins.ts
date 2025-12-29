/**
 * アンドゥ/リドゥシステムのプラグイン実装
 *
 * このモジュールには、アンドゥスタックを拡張するための様々なプラグインが含まれています。
 * - 履歴永続化プラグイン (LocalStorage/SessionStorageを使用)
 * - アクション追跡プラグイン (分析やログ記録用)
 * - デバッグ/分析プラグイン (パフォーマンスやメモリ使用量の監視)
 */
import { objUt } from "@/utils/objectUtils"
import { estimateActionSize } from "./memoryManager"
import { MemoryUsage, UndoStackPlugin, UndoableAction } from "./types"

/**
 * 履歴永続化プラグインを作成する
 * ブラウザのLocalStorageを使用して履歴を保存・復元する
 *
 * @param key 保存に使用するストレージキー
 * @param options プラグインオプション
 */
export function createHistoryPersistencePlugin<T>(
  key: string,
  options: {
    /** 使用するストレージタイプ */
    storageType?: "localStorage" | "sessionStorage"
    /** 保存する最大アイテム数 */
    maxItems?: number
    /** シリアライザー関数 */
    serializer?: (data: any) => string
    /** デシリアライザー関数 */
    deserializer?: (data: string) => any
    /** 復元時のコールバック */
    onLoad?: (restoredState: T | null) => void
    /** 保存頻度制限（ミリ秒） */
    throttleMs?: number
    /** イミュータブルデータを使用するか */
    immutable?: boolean
    /** 選択的に保存するパスのリスト */
    selectivePaths?: string[]
    /** ハッシュ計算アルゴリズム */
    hashAlgorithm?: "simple" | "full"
  } = {},
): UndoStackPlugin<T> {
  const {
    storageType = "localStorage",
    maxItems = 100,
    serializer = JSON.stringify,
    deserializer = JSON.parse,
    onLoad,
    throttleMs = 1000,
    immutable = false,
    selectivePaths,
    hashAlgorithm = "simple",
  } = options

  // 使用するストレージの取得
  const storage =
    typeof window !== "undefined"
      ? storageType === "localStorage"
        ? window.localStorage
        : window.sessionStorage
      : null

  // 最後の保存状態と時間を追跡
  let lastSavedState: T | null = null
  let lastSaveTime = 0
  let pendingSave: ReturnType<typeof setTimeout> | null = null
  let lastStateHash: string | null = null

  // 変更検知用のハッシュマップ
  const stateHashMap = new Map<string, any>()

  /**
   * 永続化されたデータを読み込む
   */
  const loadPersistedData = (): {
    state: T | null
    actions: UndoableAction<T>[]
  } | null => {
    try {
      if (!storage) return null

      const savedData = storage.getItem(key)
      if (!savedData) return null

      const parsed = deserializer(savedData)
      if (!parsed || !parsed.state) return null

      return {
        state: parsed.state,
        actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      }
    } catch (err) {
      console.error("履歴の読み込み中にエラーが発生しました:", err)
      return null
    }
  }

  /**
   * 保存処理をスロットリング
   */
  const throttledSaveData = (state: T) => {
    const now = Date.now()

    // 前回の保存から指定時間経過していない場合は保存をスケジュール
    if (now - lastSaveTime < throttleMs) {
      if (pendingSave) clearTimeout(pendingSave)

      pendingSave = setTimeout(() => {
        saveData(state)
        pendingSave = null
      }, throttleMs)
      return
    }

    // すぐに保存
    saveData(state)
  }

  /**
   * 状態変更時の保存処理
   */
  const saveData = (state: T) => {
    try {
      if (!storage) return

      // 状態のハッシュを計算（簡易版）
      const currentHash = hashAlgorithm === "simple" ? objUt.computeStateHash(state) : JSON.stringify(state)

      // ハッシュが同じなら保存しない（変更がない）
      if (currentHash === lastStateHash) return

      lastStateHash = currentHash
      lastSaveTime = Date.now()

      // イミュータブルなら参照をそのまま保存、そうでなければクローン
      if (immutable) {
        lastSavedState = state
      } else if (selectivePaths && selectivePaths.length > 0) {
        // 選択的クローン
        lastSavedState = objUt.selectiveDeepClone(state as Record<string, any>, selectivePaths) as T
      } else {
        // 完全クローン
        lastSavedState = objUt.deepClone(state)
      }

      // ストレージに保存（アクションは最大数まで）
      const dataToStore = {
        state: lastSavedState,
        timestamp: Date.now(),
      }

      storage.setItem(key, serializer(dataToStore))
    } catch (err) {
      console.error("履歴の保存中にエラーが発生しました:", err)
    }
  }

  // 初期データのロード
  const initialData = storage ? loadPersistedData() : null

  // onLoadコールバックがあれば呼び出し（非同期で）
  if (initialData && onLoad) {
    setTimeout(() => {
      onLoad(initialData.state)
    }, 0)
  }

  return {
    name: "HistoryPersistence",
    priority: 10, // 高い優先度で実行

    // アクションがプッシュされたとき
    onActionPush: (_action, stack) => {
      const currentState = stack.getCurrentState()
      if (currentState) {
        throttledSaveData(currentState)
      }
    },

    // 状態が変更されたとき
    onStateChange: (newState: T) => {
      if (!newState) {
        lastSavedState = null
        return
      }

      throttledSaveData(newState)
    },

    // クリア時の処理
    onClear: () => {
      try {
        if (pendingSave) {
          clearTimeout(pendingSave)
          pendingSave = null
        }

        if (storage) {
          storage.removeItem(key)
        }

        lastSavedState = null
        lastStateHash = null
        stateHashMap.clear()
      } catch (err) {
        console.error("履歴の削除中にエラーが発生しました:", err)
      }
    },

    // エラーハンドリング
    onError: (error, methodName) => {
      console.warn(`HistoryPersistence plugin error in ${methodName}:`, error)

      // 致命的なエラーの場合はストレージをクリア
      if (methodName === "onActionPush" || methodName === "onStateChange") {
        try {
          if (storage) {
            storage.removeItem(key)
          }
        } catch (e) {
          // ストレージへのアクセスにも問題がある場合は何もしない
        }
      }
    },

    // メモリ警告処理
    onMemoryWarning: (usage: MemoryUsage) => {
      // メモリ警告時はより積極的に保存（現在の状態を簡易形式で保存）
      if (lastSavedState && usage.estimatedBytes > 50 * 1024 * 1024) {
        try {
          if (storage) {
            // 最低限のデータだけ保存
            const minimalData = {
              state: lastSavedState,
              timestamp: Date.now(),
              warning: true,
            }
            storage.setItem(`${key}_backup`, serializer(minimalData))
          }
        } catch (err) {
          // エラーが発生してもメイン機能には影響させない
          console.warn("バックアップ保存中にエラー:", err)
        }
      }
    },
  }
}

/**
 * アクション追跡プラグイン - 分析目的などで操作を追跡
 */
export function createActionTrackerPlugin<T>(
  options: {
    /** 追跡イベント発生時のコールバック */
    onTrack?: (
      actionType: string,
      actionLabel: string | undefined,
      timestamp: number,
      details?: { size?: number; duration?: number },
    ) => void
    /** 履歴を保持するか */
    keepHistory?: boolean
    /** 保持する履歴の最大数 */
    maxHistory?: number
    /** 重複イベントのフィルタリング */
    filterDuplicates?: boolean
  } = {},
): UndoStackPlugin<T> {
  const { onTrack, keepHistory = false, maxHistory = 100, filterDuplicates = true } = options

  // 履歴の記録（有効な場合のみ）
  const history: Array<{
    type: string
    label?: string
    timestamp: number
    details?: Record<string, any>
  }> = []

  // 直前のイベントを記録（重複フィルタリング用）
  let lastEvent: {
    type: string
    label?: string
    timestamp: number
  } | null = null

  // イベント記録関数
  const trackEvent = (type: string, label?: string, details?: Record<string, any>) => {
    const timestamp = Date.now()

    // 重複フィルタリング
    if (filterDuplicates && lastEvent) {
      // 同じタイプ、同じラベル、かつ500ms以内の場合は記録しない
      if (lastEvent.type === type && lastEvent.label === label && timestamp - lastEvent.timestamp < 500) {
        return
      }
    }

    // 最新のイベント情報を更新
    lastEvent = { type, label, timestamp }

    // コールバック呼び出し
    if (onTrack) {
      onTrack(type, label, timestamp, details)
    }

    // 履歴保存（有効な場合のみ）
    if (keepHistory) {
      history.push({ type, label, timestamp, details })

      // 履歴数制限
      if (history.length > maxHistory) {
        history.shift()
      }
    }
  }

  // イベント履歴の取得
  const getHistory = () => [...history]

  return {
    name: "ActionTracker",
    priority: 5,

    onActionPush: (action) => {
      trackEvent("push", action.label, {
        size: action.estimatedSize,
        mutation: action.isMutation,
        paths: action.targetPaths?.length,
      })
    },

    onUndo: (action) => {
      trackEvent("undo", action.label, {
        size: action.estimatedSize,
      })
    },

    onRedo: (action) => {
      trackEvent("redo", action.label, {
        size: action.estimatedSize,
      })
    },

    onClear: () => {
      trackEvent("clear", "全履歴を削除")

      // 履歴をクリア（保持する設定でも、clearイベント時は履歴もクリア）
      history.length = 0
      lastEvent = null
    },

    onGC: () => {
      trackEvent("gc", "ガベージコレクション")
    },

    _getDebugData: () => ({
      events: getHistory(),
      metrics: {
        totalEvents: history.length,
        lastEvent,
      },
    }),
  }
}

/**
 * デバッグ/分析情報収集プラグイン（拡張版）
 */
export function createDebugPlugin<T>(
  options: {
    /** コンソールログを出力するか */
    enableConsole?: boolean
    /** 保持する最大イベント数 */
    maxEvents?: number
    /** メトリクス通知コールバック */
    onMetrics?: (metrics: {
      actionCount: number
      undoCount: number
      redoCount: number
      avgActionsPerBatch: number
      mostFrequentAction?: string
      metrics: Record<string, number>
      memoryUsage?: {
        total: number
        average: number
        peak: number
      }
    }) => void
    /** メモリ使用量監視間隔 (ms) */
    memoryCheckInterval?: number
    /** 定期メトリクス通知間隔 (ms) */
    metricsInterval?: number
  } = {},
): UndoStackPlugin<T> {
  const {
    enableConsole = true,
    maxEvents = 100,
    onMetrics,
    memoryCheckInterval = 10000,
    metricsInterval = 60000,
  } = options

  type EventType = "push" | "undo" | "redo" | "clear" | "gc" | "memoryWarning" | "error"

  // 各種メトリクス
  let events: {
    type: EventType
    label?: string
    timestamp: number
    details?: any
  }[] = []
  let actionCount = 0
  let undoCount = 0
  let redoCount = 0
  let actionLabels: Record<string, number> = {}

  // メモリ使用状況の追跡
  const memoryStats = {
    measurements: [] as number[],
    total: 0,
    average: 0,
    peak: 0,
    samples: 0,
  }

  // タイマーの参照
  let metricsTimer: ReturnType<typeof setInterval> | null = null
  let memoryTimer: ReturnType<typeof setInterval> | null = null

  // 定期的なメトリクス計算と通知
  const calculateMetrics = () => {
    // ラベルの集計で最も頻度が高いものを特定
    let mostFrequentAction: string | undefined
    let maxCount = 0

    for (const [label, count] of Object.entries(actionLabels)) {
      if (count > maxCount) {
        maxCount = count
        mostFrequentAction = label
      }
    }

    // バッチ処理の平均サイズを計算
    const batchActions = events.filter((e) => e.type === "push" && e.details?.batch)
    const avgActionsPerBatch =
      batchActions.length > 0
        ? batchActions.reduce((sum, item) => sum + (item.details?.batchSize || 1), 0) / batchActions.length
        : 0

    // メモリ使用量の計算
    const memoryUsage =
      memoryStats.samples > 0
        ? {
            total: memoryStats.total,
            average: memoryStats.average,
            peak: memoryStats.peak,
          }
        : undefined

    const metrics = {
      actionCount,
      undoCount,
      redoCount,
      avgActionsPerBatch,
      mostFrequentAction,
      metrics: { ...actionLabels },
      memoryUsage,
    }

    if (onMetrics) {
      onMetrics(metrics)
    }

    if (enableConsole) {
      console.log("[UndoDebug] メトリクス:", metrics)
    }

    return metrics
  }

  // メモリ使用状況のサンプリング
  const sampleMemoryUsage = () => {
    try {
      if (typeof performance !== "undefined" && "memory" in performance) {
        const mem = (performance as any).memory?.usedJSHeapSize

        if (typeof mem === "number") {
          // メモリ統計を更新
          memoryStats.measurements.push(mem)
          memoryStats.total += mem
          memoryStats.samples++
          memoryStats.average = memoryStats.total / memoryStats.samples
          memoryStats.peak = Math.max(memoryStats.peak, mem)

          // 測定数を制限
          if (memoryStats.measurements.length > maxEvents) {
            const removed = memoryStats.measurements.shift() || 0
            memoryStats.total -= removed
            memoryStats.average = memoryStats.total / memoryStats.measurements.length
          }

          if (enableConsole && memoryStats.samples % 10 === 0) {
            const formatted = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2) + " MB"
            console.log(
              `[UndoDebug] メモリ使用量: ${formatted(mem)} ` +
                `(平均: ${formatted(memoryStats.average)}, ピーク: ${formatted(memoryStats.peak)})`,
            )
          }
        }
      }
    } catch (e) {
      // メモリ測定中のエラーは無視
    }
  }

  // イベントの記録
  const recordEvent = (type: EventType, label?: string, details?: any) => {
    events.push({
      type,
      label,
      timestamp: Date.now(),
      details,
    })

    // 最大イベント数を超えたら古いものを削除
    if (events.length > maxEvents) {
      events = events.slice(-maxEvents)
    }

    // ラベルの出現回数をカウント
    if (label) {
      actionLabels[label] = (actionLabels[label] || 0) + 1
    }

    // コンソールにログを出力
    if (enableConsole) {
      const labelInfo = label ? ` "${label}"` : ""
      const detailsInfo = details ? ` ${JSON.stringify(details)}` : ""
      console.log(`[UndoDebug] ${type}${labelInfo}${detailsInfo} @ ${new Date().toISOString()}`)
    }
  }

  // タイマーの設定と解除
  const setupTimers = () => {
    // すでに設定されていたら何もしない
    if (metricsTimer !== null || memoryTimer !== null) return

    // メトリクス通知タイマー
    if (metricsInterval > 0 && onMetrics) {
      metricsTimer = setInterval(calculateMetrics, metricsInterval)
    }

    // メモリ使用量監視タイマー
    if (memoryCheckInterval > 0) {
      memoryTimer = setInterval(sampleMemoryUsage, memoryCheckInterval)

      // 最初のサンプリングを即時実行
      sampleMemoryUsage()
    }
  }

  const cleanupTimers = () => {
    if (metricsTimer !== null) {
      clearInterval(metricsTimer)
      metricsTimer = null
    }

    if (memoryTimer !== null) {
      clearInterval(memoryTimer)
      memoryTimer = null
    }
  }

  return {
    name: "DebugPlugin",
    priority: -10, // 低い優先度（他のプラグインの後に実行）

    onInit: (stack) => {
      setupTimers()

      if (enableConsole) {
        console.log("[UndoDebug] 初期化完了", {
          canUndo: stack.canUndo,
          canRedo: stack.canRedo,
        })
      }
    },

    onActionPush: (action, stack) => {
      actionCount++
      recordEvent("push", action.label, {
        isMutation: action.isMutation,
        pathCount: action.targetPaths?.length,
        size: estimateActionSize(action),
        historySize: stack.state.past,
      })
    },

    onUndo: (action) => {
      undoCount++
      recordEvent("undo", action.label, {
        size: estimateActionSize(action),
      })
    },

    onRedo: (action) => {
      redoCount++
      recordEvent("redo", action.label, {
        size: estimateActionSize(action),
      })
    },

    onClear: () => {
      recordEvent("clear")

      // 新しいデバッグセッションを開始
      events = []
      actionCount = 0
      undoCount = 0
      redoCount = 0
      actionLabels = {}
    },

    onGC: (stack) => {
      recordEvent("gc", undefined, {
        pastSize: stack.state.past,
        futureSize: stack.state.future,
      })

      // GCのタイミングでメトリクスを計算して通知
      calculateMetrics()
    },

    onMemoryWarning: (usage) => {
      recordEvent("memoryWarning", undefined, {
        estimatedBytes: usage.estimatedBytes,
        actionCount: usage.actionCount,
      })

      // 緊急でメトリクスを計算
      calculateMetrics()
    },

    onError: (error, methodName) => {
      recordEvent("error", methodName, {
        message: error.message,
        stack: error.stack,
      })
    },

    _getDebugData: () => {
      return {
        events: [...events],
        metrics: calculateMetrics(),
        memory: {
          ...memoryStats,
          measurements: [...memoryStats.measurements],
        },
      }
    },
  }
}
