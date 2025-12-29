import { perfMonitor } from "./performanceMonitor"
import { OperationRecord, UndoDebugger } from "./types"

/**
 * パフォーマンス測定をラップする汎用関数
 */
export function withPerformanceTracking<R>(
  operationType: "push" | "undo" | "redo" | "clear",
  actionFn: () => R,
  actionName: string,
  logger: UndoDebugger,
  performanceMonitoring: boolean,
  perfMonitorInstance: typeof perfMonitor | undefined,
  setLastOperation?: (op: OperationRecord) => void,
  triggerGC?: () => void,
  additionalInfo?: { label?: string; size?: number },
): { result: R; duration?: number } {
  const startTime = perfMonitorInstance?.startTimer() || 0
  logger.log(`${actionName} 開始...`)

  try {
    const result = actionFn()

    const duration = perfMonitorInstance ? perfMonitorInstance.endTimer(startTime) : undefined

    if (perfMonitorInstance && performanceMonitoring && setLastOperation) {
      const operation: OperationRecord = {
        type: operationType,
        timestamp: Date.now(),
        duration,
        label: additionalInfo?.label,
        actionSize: additionalInfo?.size,
      }

      // メモリ使用量の記録
      if (typeof perfMonitorInstance.getMemoryUsage === "function") {
        operation.memoryUsage = perfMonitorInstance.getMemoryUsage()
      }

      setLastOperation(operation)
      logger.log(`${actionName} 完了 (${duration?.toFixed(2)}ms)`)

      // GCタイマーを管理
      if (operationType !== "clear" && triggerGC) {
        triggerGC()
      }
    } else if (setLastOperation) {
      setLastOperation({
        type: operationType,
        timestamp: Date.now(),
        label: additionalInfo?.label,
      })
      logger.log(`${actionName} 完了`)
    }

    return { result, duration }
  } catch (error) {
    logger.error(`${actionName} エラー`, error)
    throw error // エラーを再スローして、呼び出し元で処理できるようにする
  }
}

/**
 * デバッガーオブジェクトを作成
 */
export function createDebugger(enabled: boolean): UndoDebugger {
  if (!enabled) {
    // デバッグが無効の場合は空の関数を返す（ノーオペレーション）
    return {
      log: () => {},
      warn: () => {},
      error: () => {},
    }
  }

  return {
    log: (message: string, ...args: any[]) => console.log(`[UndoStack] ${message}`, ...args),
    warn: (message: string, ...args: any[]) => console.warn(`[UndoStack] ${message}`, ...args),
    error: (message: string, ...args: any[]) => console.error(`[UndoStack] ${message}`, ...args),
  }
}
