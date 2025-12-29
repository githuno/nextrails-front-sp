import { objUt } from "@/utils/objectUtils"
import { MemoryUsage, UndoableAction, UndoStackOptions } from "./types"

/**
 * アクションのメモリサイズを推定
 * @param action アクション
 * @returns サイズ推定値（バイト）
 */
export function estimateActionSize<T>(action: UndoableAction<T>): number {
  // 既に推定値がある場合はそれを返す
  if (action.estimatedSize !== undefined) {
    return action.estimatedSize
  }

  let size = 0

  // 引数のサイズ推定
  if (action.args && Array.isArray(action.args)) {
    // JSON文字列化してサイズを概算（正確でなくても大丈夫）
    try {
      const argsJson = JSON.stringify(action.args)
      size += argsJson.length * 2 // UTF-16文字として概算
    } catch (e) {
      // 文字列化できない場合は概算
      size += 1000 * action.args.length
    }
  }

  // ラベルのサイズ
  if (action.label) {
    size += action.label.length * 2
  }

  // targetPathsのサイズ
  if (action.targetPaths && Array.isArray(action.targetPaths)) {
    size += action.targetPaths.reduce((sum, path) => sum + path.length * 2, 0)
  }

  // 関数のサイズは推定困難なため定数を加算
  size += 500 // do/undo関数の概算サイズ

  // 推定値をキャッシュ
  action.estimatedSize = size

  return size
}

/**
 * スタック全体のメモリ使用量を推定
 */
export function estimateTotalMemoryUsage<T>(past: UndoableAction<T>[], future: UndoableAction<T>[]): MemoryUsage {
  const pastSizes = past.map((action) => estimateActionSize(action))
  const futureSizes = future.map((action) => estimateActionSize(action))

  const totalPastSize = pastSizes.reduce((sum, size) => sum + size, 0)
  const totalFutureSize = futureSizes.reduce((sum, size) => sum + size, 0)
  const totalSize = totalPastSize + totalFutureSize

  // 最大のアクション
  let largestAction: { size: number; label?: string } | undefined

  if (past.length > 0 || future.length > 0) {
    const allActions = [...past, ...future]
    const allSizes = [...pastSizes, ...futureSizes]

    let maxSize = 0
    let maxIndex = -1

    for (let i = 0; i < allSizes.length; i++) {
      if (allSizes[i] > maxSize) {
        maxSize = allSizes[i]
        maxIndex = i
      }
    }

    if (maxIndex >= 0) {
      largestAction = {
        size: maxSize,
        label: allActions[maxIndex].label,
      }
    }
  }

  return {
    pastSize: past.length,
    futureSize: future.length,
    estimatedBytes: totalSize,
    actionCount: past.length + future.length,
    averageActionSize: past.length + future.length > 0 ? totalSize / (past.length + future.length) : 0,
    largestAction,
  }
}

/**
 * メモリベースの制限に基づいて履歴をトリミング
 */
export function trimHistoryBasedOnMemory<T>(past: UndoableAction<T>[], options: UndoStackOptions): UndoableAction<T>[] {
  if (!options.memoryBasedLimit || past.length === 0) {
    return past
  }

  const maxMemorySize = (options.maxMemorySize || 50) * 1024 * 1024 // MB → バイト

  // 現在のメモリ使用量を計算
  let totalSize = 0
  const actionSizes: number[] = []

  for (const action of past) {
    const size = estimateActionSize(action)
    actionSizes.push(size)
    totalSize += size
  }

  // メモリ制限を超えていなければそのまま返す
  if (totalSize <= maxMemorySize) {
    return past
  }

  // メモリ制限を超えている場合、古いアクションから削除
  const newPast = [...past]
  let currentSize = totalSize

  while (currentSize > maxMemorySize && newPast.length > 1) {
    const oldestActionSize = actionSizes.shift() || 0
    newPast.shift() // 最も古いアクションを削除
    currentSize -= oldestActionSize
  }

  return newPast
}

/**
 * 大きなアクションデータを分離して保存
 */
export function optimizeActionForStorage<T>(action: UndoableAction<T>, options: UndoStackOptions): UndoableAction<T> {
  const largeThreshold = (options.largeActionThreshold || 100) * 1024 // KB → バイト
  const actionSize = estimateActionSize(action)

  // サイズが閾値未満なら最適化不要
  if (actionSize < largeThreshold) {
    return action
  }

  // 大きなアクションのクローン
  const optimizedAction: UndoableAction<T> = {
    ...action,
    // 大きなデータは参照を保持するが、タイムスタンプで識別できるようにする
    metadata: {
      timestamp: Date.now(),
      hash: objUt.computeStateHash(action.args || {}),
      compressed: true,
    },
  }

  // argsが大きい場合は縮小版を保持
  if (action.args && Array.isArray(action.args) && action.args.length > 0) {
    // メタデータだけを残す（参照は保持）
    optimizedAction.args = action.args.map((arg) =>
      typeof arg === "object" && arg !== null ? { _type: typeof arg, _ref: true } : arg,
    )
  }

  return optimizedAction
}

/**
 * アクションのメモリ使用量を最適化
 * メモリ効率化のためにアクションを最適化
 */
function optimizeAction<T>(action: UndoableAction<T>): UndoableAction<T> {
  // 既に最適化済みなら何もしない
  if (action.metadata?.compressed) {
    return action
  }

  // 共通のラベル文字列をプールで管理（メモリ節約のため）
  const optimizedAction: UndoableAction<T> = {
    ...action,
    metadata: {
      ...(action.metadata || {}),
      compressed: true,
      timestamp: Date.now(),
    },
  }

  // ラベルを共通プールから取得（ラベル文字列の重複排除）
  if (action.label) {
    const pooledLabel = labelPool.get(action.label)
    if (pooledLabel) {
      optimizedAction.label = pooledLabel
    } else {
      labelPool.set(action.label, action.label)
    }
  }

  // 大きな引数はメタデータのみ保持
  if (action.args && action.args.length > 0) {
    // 参照のみを保持し、内容はハッシュ化
    optimizedAction.args = action.args.map((arg) => {
      if (arg && typeof arg === "object" && !Array.isArray(arg)) {
        // オブジェクトの参照情報のみ保持
        return {
          _optimized: true,
          _type: "object",
          _hash: objUt.computeStateHash(arg),
        }
      }
      return arg
    })
  }

  return optimizedAction
}

// ラベル文字列プール
const labelPool = new Map<string, string>()

/**
 * 履歴のメモリ使用量を監視・制限する拡張ガベージコレクション
 */
export function enhancedGarbageCollection<T>(
  past: UndoableAction<T>[],
  future: UndoableAction<T>[],
  options: UndoStackOptions,
): {
  past: UndoableAction<T>[]
  future: UndoableAction<T>[]
  freedBytes: number
} {
  // 現在のメモリ使用量を計算
  const beforeUsage = estimateTotalMemoryUsage(past, future)

  // 最適化アクション
  let optimizedPast = past
  let optimizedFuture = future

  // 1. 将来履歴の最適化 (使用頻度が低いため、より積極的に最適化)
  if (future.length > 0) {
    optimizedFuture = future.map((action) => optimizeAction(action))
  }

  // 2. メモリベースの制限とアクション数制限の両方を適用
  if (options.memoryBasedLimit) {
    // メモリ使用量に基づく削減
    optimizedPast = trimHistoryBasedOnMemory(
      past.map((action) => optimizeAction(action)),
      options,
    )
  } else if (options.maxHistory && past.length > options.maxHistory) {
    // 単純なアクション数の制限
    optimizedPast = past.slice(-options.maxHistory)
  }

  // 3. 定期的なメモリ最適化処理（履歴が長い場合のみ）
  if (past.length > 50) {
    // 確実に参照を切るための対策
    const longTermActions = past.slice(0, past.length - 20) // 直近20個以外
    const recentActions = past.slice(-20) // 直近20個

    // 古いアクションはより積極的に最適化
    const heavilyOptimizedPast = longTermActions.map((action) => {
      // より積極的にメモリ解放するための最適化戦略
      const optimized = optimizeAction(action)

      // 不要なデータを削除（do関数の実行結果用のクロージャを解放）
      if (optimized.args && optimized.args.length > 2) {
        // 必要最小限のデータだけ残す
        optimized.args = optimized.args.slice(0, 2)
      }

      return optimized
    })

    // 直近のアクションは標準レベルで最適化
    const standardOptimizedRecent = recentActions.map((action) => optimizeAction(action))

    // 結合
    optimizedPast = [...heavilyOptimizedPast, ...standardOptimizedRecent]
  }

  // 最適化後のメモリ使用量を計算
  const afterUsage = estimateTotalMemoryUsage(optimizedPast, optimizedFuture)
  const freedBytes = beforeUsage.estimatedBytes - afterUsage.estimatedBytes

  // ガベージコレクション効果が小さい場合は、より積極的な最適化を検討
  if (freedBytes < 1024 * 100 && past.length > 100) {
    // 100KB未満しか解放できない場合
    // より古いアクションをさらに削減
    optimizedPast = optimizedPast.slice(Math.floor(optimizedPast.length * 0.1)) // 最も古い10%を削除
  }

  return {
    past: optimizedPast,
    future: optimizedFuture,
    freedBytes,
  }
}

// ガベージコレクション実行間隔を履歴サイズに応じて調整する関数
export function getAdjustedGCInterval(pastLength: number, baseInterval: number): number {
  if (pastLength > 200) {
    return baseInterval * 0.5 // 履歴が非常に多い場合は頻度を上げる
  } else if (pastLength > 100) {
    return baseInterval * 0.75 // 履歴が多い場合も少し頻度を上げる
  } else if (pastLength < 20) {
    return baseInterval * 2 // 履歴が少ない場合は頻度を下げる
  }

  return baseInterval // デフォルトのままで問題ない場合
}
