/**
 * アンドゥ/リドゥシステムの型定義
 */

/**
 * アンドゥ可能なアクションのインターフェース
 */
export interface UndoableAction<T> {
  do: () => T
  undo: () => T
  label?: string
  args?: any[]
  // メモリ最適化のために追加されたプロパティ
  isMutation?: boolean // 完全な状態ではなく差分のみを扱うかどうか
  targetPaths?: string[] // ミューテーション時に影響を受けるパス
  // メモリ使用量の推定値（バイト単位）
  estimatedSize?: number
  // 最適化用のメタデータ
  metadata?: {
    timestamp: number
    compressed?: boolean
    hash?: string
  }
}

/**
 * アンドゥ・リドゥの状態を管理するためのオプション
 */
export interface UndoStackOptions {
  /** 保存する最大履歴数 (デフォルト: 無制限) */
  maxHistory?: number
  /** デバッグモードを有効にするか */
  debug?: boolean
  /** 連続した同じ種類のアクションを圧縮するか */
  compress?: boolean
  /** パフォーマンスモニタリングを有効にするか */
  performanceMonitoring?: boolean
  /** メモリ効率モードを有効にするか（差分ベースの状態保存） */
  memoryEfficient?: boolean
  /** プラグインのリスト */
  plugins?: UndoStackPlugin<any>[]
  /** ガベージコレクションの間隔（ミリ秒） */
  gcInterval?: number
  /** メモリ使用量監視のための閾値 (MB) */
  memoryThreshold?: number
  /** 特定のパスのみを保存する場合の設定 */
  selectivePaths?: string[]
  /** 状態がイミュータブルかどうか */
  immutable?: boolean
  /** メモリベースの履歴数制限を有効にするかどうか */
  memoryBasedLimit?: boolean
  /** メモリベースで保持する最大サイズ (MB、デフォルト: 50) */
  maxMemorySize?: number
  /** 大きなアクションデータの分離閾値 (KB、デフォルト: 100) */
  largeActionThreshold?: number
}

/**
 * アンドゥスタックの状態情報
 */
export interface UndoStackState {
  past: number
  future: number
  canUndo: boolean
  canRedo: boolean
  lastOperation?: OperationRecord
}

/**
 * 操作記録の型
 */
export interface OperationRecord {
  type: "push" | "undo" | "redo" | "clear"
  timestamp: number
  duration?: number
  memoryUsage?: number
  /** アクションのラベル */
  label?: string
  /** アクションサイズの推定値（バイト） */
  actionSize?: number
}

/**
 * プラグインインターフェース
 */
export interface UndoStackPlugin<T> {
  name: string
  priority?: number
  dependencies?: string[]
  onInit?: (stack: UndoStack<T>) => void
  onActionPush?: (action: UndoableAction<T>, stack: UndoStack<T>) => void
  onUndo?: (action: UndoableAction<T>, stack: UndoStack<T>) => void
  onRedo?: (action: UndoableAction<T>, stack: UndoStack<T>) => void
  onClear?: (stack: UndoStack<T>) => void
  onGC?: (stack: UndoStack<T>) => void
  onStateChange?: (newState: T) => void
  onError?: (error: any, methodName: string) => void
  onMemoryWarning?: (usage: MemoryUsage) => void
  _getDebugData?: () => { events: any[]; metrics: any }
}

/**
 * メモリ使用状況の型
 */
export interface MemoryUsage {
  pastSize: number
  futureSize: number
  estimatedBytes: number
  actionCount: number
  averageActionSize: number
  largestAction?: {
    size: number
    label?: string
  }
  lastOperation?: OperationRecord
}

/**
 * UndoStackのインターフェース
 */
export interface UndoStack<T> {
  createAction: (
    doFn: (...args: any[]) => T,
    undoFn: (...args: any[]) => T,
    label?: string,
    ...args: any[]
  ) => UndoableAction<T>
  createDiffAction: (prevState: T, nextState: T, label?: string) => UndoableAction<T>
  push: (doFn: (...args: any[]) => T, undoFn: (...args: any[]) => T, label?: string, ...args: any[]) => T
  pushAction: (action: UndoableAction<T>) => T
  undo: () => T | undefined
  redo: () => T | undefined
  batch: (actions: UndoableAction<T>[], label?: string) => T | undefined
  undoUntil: (label: string) => T | undefined
  undoTo: (index: number) => T | undefined
  rebuild: (initialState: T, setStateFn: (state: T) => void) => T
  clear: () => boolean
  getMemoryUsage: () => MemoryUsage
  getCurrentState: () => T | undefined
  readonly canUndo: boolean
  readonly canRedo: boolean
  readonly history: Array<{ index: number; label: string }>
  readonly state: UndoStackState
  _getRawHistory: () => {
    past: UndoableAction<T>[]
    future: UndoableAction<T>[]
  }
}

// プラグインイベントの型を定義
export type PluginEventName = "init" | "actionPush" | "undo" | "redo" | "clear" | "gc" | "memoryWarning"

// プラグインイベントハンドラの型を定義
export interface PluginEventHandlers<T> {
  init: (stack: UndoStack<T>) => void
  actionPush: (action: UndoableAction<T>, stack: UndoStack<T>) => void
  undo: (action: UndoableAction<T>, stack: UndoStack<T>) => void
  redo: (action: UndoableAction<T>, stack: UndoStack<T>) => void
  clear: (stack: UndoStack<T>) => void
  gc: (stack: UndoStack<T>) => void
  memoryWarning: (usage: MemoryUsage, stack: UndoStack<T>) => void
}

// デバッガーインターフェース
export interface UndoDebugger {
  log: (message: string, ...args: any[]) => void
  warn: (message: string, ...args: any[]) => void
  error: (message: string, ...args: any[]) => void
}
