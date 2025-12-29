import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createUndoStack } from "./utils/core"
import { perfMonitor } from "./utils/performanceMonitor"
import { createActionTrackerPlugin } from "./utils/plugins"
import { UndoableAction, UndoStack, UndoStackOptions, UndoStackState } from "./utils/types"

/**
 * フックの戻り値の型定義
 */
interface UseUndoResult<T> {
  // 基本的な状態と操作
  state: T
  setState: (newState: T | ((prevState: T) => T), options?: { label?: string; silent?: boolean }) => void
  updateState: (partialState: Partial<T>) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  clear: () => void

  // 拡張機能
  history: Array<{ index: number; label: string }>
  historyState: UndoStackState
  undoTo: (index: number) => void
  undoUntil: (label: string) => void

  // バッチ処理とアクション作成
  batch: (fnOrActions: (() => void) | UndoableAction<T>[], label?: string) => void
  createAction: <R>(doFn: () => R, undoFn: () => void, label?: string) => UndoableAction<T>
  createDiffAction: (prevState: T, nextState: T, label?: string) => UndoableAction<T>

  // 高度な操作用
  getRawHistory: () => {
    past: UndoableAction<T>[]
    future: UndoableAction<T>[]
  }
  rebuild: (newInitialState?: T) => void
  getMemoryUsage: () => {
    pastSize: number
    futureSize: number
    estimatedBytes: number
    actionCount: number
    averageActionSize: number
    largestAction?: { size: number; label?: string }
  }

  // パフォーマンス最適化のためのメモ化された値
  stack: UndoStack<T>
}

/**
 * フックのオプション型定義
 */
interface UseUndoOptions extends UndoStackOptions {
  /** 履歴の最大数 */
  historyLimit?: number
  /** キーボードショートカットを有効にするか */
  enableKeyboardShortcuts?: boolean
  /** 差分ベースの状態管理を使用するか（メモリ効率化） */
  useDiff?: boolean
  /** 状態が変更されたときに呼び出されるコールバック */
  onStateChange?: (newState: any) => void
  /** 履歴の変更時に呼び出されるコールバック */
  onHistoryChange?: (history: Array<{ index: number; label: string }>) => void
  /** 操作記録時のコールバック */
  onAction?: (actionType: "push" | "undo" | "redo", actionLabel?: string) => void
  /** Ctrl+Z/Ctrl+Y のカスタムキーマッピング */
  keyboardShortcuts?: {
    undo?: string[]
    redo?: string[]
  }
}

/**
 * 強化されたUndoフック
 *
 * @example
 * ```tsx
 * const {
 *   state, setState, undo, redo, canUndo, canRedo, history
 * } = useUndo({ count: 0 });
 *
 * return (
 *   <div>
 *     <p>Count: {state.count}</p>
 *     <button onClick={() => setState(prev => ({ count: prev.count + 1 }))}>
 *       Increment
 *     </button>
 *     <button onClick={undo} disabled={!canUndo}>Undo</button>
 *     <button onClick={redo} disabled={!canRedo}>Redo</button>
 *   </div>
 * );
 * ```
 */

const DEFAULT_OPTIONS = {
  useDiff: true,
  enableKeyboardShortcuts: false,
  historyLimit: 100,
  onStateChange: undefined,
  onHistoryChange: undefined,
  onAction: undefined,
  keyboardShortcuts: {
    undo: ["z"],
    redo: ["y", "Z"],
  },
  debug: false,
  memoryEfficient: true,
  compress: true,
  performanceMonitoring: true,
  memoryBasedLimit: true,
  maxMemorySize: 50,
  maxHistory: undefined,
  gcInterval: 1000,
  memoryThreshold: 50,
  selectivePaths: undefined,
  immutable: false,
  largeActionThreshold: 100,
  plugins: [],
}

function useEfficientUndo<T>(initialState: T, options: UseUndoOptions = {}): UseUndoResult<T> {
  // デフォルト設定とユーザー設定をマージ
  const resolvedOptions = useMemo(() => ({ ...DEFAULT_OPTIONS, ...options }), [options])
  const {
    historyLimit,
    enableKeyboardShortcuts,
    useDiff,
    onStateChange,
    onHistoryChange,
    onAction,
    keyboardShortcuts,
    ...stackOptions
  } = resolvedOptions

  // パフォーマンスモニターのインスタンス参照
  const perfMonitorInstance = stackOptions.performanceMonitoring ? perfMonitor : undefined

  // アクション追跡プラグインの設定（onActionが指定されている場合）
  const plugins = useMemo(() => {
    const pluginList = [...(stackOptions.plugins || [])]

    // onActionがある場合はアクション追跡プラグインを追加
    if (onAction) {
      pluginList.push(
        createActionTrackerPlugin({
          onTrack: (actionType, actionLabel) => {
            if (actionType === "push" || actionType === "undo" || actionType === "redo") {
              onAction(actionType as any, actionLabel)
            }
          },
        }),
      )
    }

    return pluginList
  }, [stackOptions.plugins, onAction])

  // アンドゥスタックの作成（memoでパフォーマンス向上）
  const undoStack = useMemo(
    () =>
      createUndoStack<T>({
        ...stackOptions, // 先にスプレッド構文で基本設定を展開
        maxHistory: historyLimit, // 明示的にオプションを上書き
        plugins, // プラグインを明示的に指定
      }),
    // 重要なオプションの変更時にスタックを再作成
    [historyLimit, plugins, stackOptions],
  )

  // undoStackへの参照を安定させるためにrefに保存
  const undoStackRef = useRef<UndoStack<T>>(undoStack)

  // 初期状態を設定済みかどうかのフラグ
  const initializedRef = useRef<boolean>(false)

  // シンプルな状態管理 - 初期値を直接セット
  const [state, setInternalState] = useState<T>(() => {
    if (stackOptions.debug) {
      console.log("[useUndo] 初期状態を作成", initialState)
    }

    // 初期状態を安全にクローンするためにスタックのヘルパー関数を使用
    try {
      const stack = undoStackRef.current
      const action = stack.createAction(
        () => initialState,
        () => initialState,
        "初期状態",
      )

      // 副作用: 初期アクションをプッシュ
      setTimeout(() => {
        if (!initializedRef.current) {
          initializedRef.current = true
          stack.pushAction(action)
          setHistoryState(stack.state)
        }
      }, 0)

      return action.do() // クローンされた初期値を返す
    } catch (err) {
      console.error("[useUndo] 初期値クローンエラー:", err)
      return initialState // 失敗したら元の値をそのまま使用
    }
  })

  // 履歴状態も単純に初期化
  const [historyState, setHistoryState] = useState<UndoStackState>(undoStack.state)

  // 初期化処理 - マウント時に一度だけ実行
  useEffect(() => {
    // 二重初期化防止
    if (initializedRef.current) return
    initializedRef.current = true

    if (stackOptions.debug) {
      console.log("[useUndo] 初期化処理を実行", {
        initialState,
        options: resolvedOptions,
      })
    }

    try {
      // 初期状態をスタックに登録
      const initialAction = undoStackRef.current.createAction(
        () => initialState,
        () => initialState,
        "初期状態",
      )

      // 初期アクションをプッシュ
      undoStackRef.current.pushAction(initialAction)

      // 履歴状態を更新
      setHistoryState(undoStackRef.current.state)
    } catch (err) {
      console.error("[useUndo] 初期化エラー:", err)
    }
  }, [initialState, resolvedOptions, stackOptions.debug])

  // バッチ処理のための一時保存配列
  const batchActionsRef = useRef<UndoableAction<T>[]>([])
  const isBatchingRef = useRef(false)

  // 状態変更通知のためのeffect
  useEffect(() => {
    if (onStateChange) {
      onStateChange(state)
    }

    // 履歴状態を更新
    const newHistoryState = undoStackRef.current.state
    setHistoryState(newHistoryState)

    if (onHistoryChange) {
      onHistoryChange(undoStackRef.current.history)
    }
  }, [state, onStateChange, onHistoryChange])

  /**
   * 新しい状態を設定する（拡張版）
   * @param newState 新しい状態または状態を更新する関数
   * @param options 追加オプション（ラベルとサイレントモード）
   */
  const setState = useCallback(
    (newState: T | ((prevState: T) => T), options?: { label?: string; silent?: boolean }) => {
      try {
        // 現在の状態をキャプチャ
        const prevState = state
        const label = options?.label || "setState"
        const effectiveLabel = options?.silent ? `${label} (silent)` : label

        // 新しい状態を計算
        const computedState = typeof newState === "function" ? (newState as (prevState: T) => T)(prevState) : newState

        // バッチ処理中ならバッチに追加
        if (isBatchingRef.current) {
          if (!options?.silent) {
            // アクションを作成して追加
            const action = useDiff
              ? undoStackRef.current.createDiffAction(prevState, computedState, effectiveLabel)
              : undoStackRef.current.createAction(
                  () => computedState,
                  () => prevState,
                  effectiveLabel,
                )

            batchActionsRef.current.push(action)
          }

          setInternalState(computedState)
          return
        }

        // サイレントモードの場合は履歴に追加しない
        if (options?.silent) {
          setInternalState(computedState)
          return
        }

        // 通常実行時: アクションを作成して履歴に追加
        const action = useDiff
          ? undoStackRef.current.createDiffAction(prevState, computedState, effectiveLabel)
          : undoStackRef.current.createAction(
              () => computedState,
              () => prevState,
              effectiveLabel,
            )

        undoStackRef.current.pushAction(action)
        setInternalState(computedState)
        setHistoryState(undoStackRef.current.state)
      } catch (err) {
        console.error("[useUndo] setState エラー:", err)
        // 最低限の回復処理：内部状態だけは安全に更新を試みる
        if (typeof newState === "function") {
          setInternalState((prev) => {
            try {
              return (newState as Function)(prev)
            } catch {
              return prev
            }
          })
        } else {
          setInternalState(newState)
        }
      }
    },
    [state, useDiff],
  )

  /**
   * 状態の一部だけを更新する（オブジェクト型の状態用）
   */
  const updateState = useCallback(
    (partialState: Partial<T>) => {
      setState((prevState) => {
        if (typeof prevState === "object" && prevState !== null) {
          return { ...(prevState as any), ...partialState } as T
        }
        return prevState
      })
    },
    [setState],
  )

  /**
   * アンドゥ処理
   */
  const undo = useCallback(() => {
    if (!undoStackRef.current.canUndo) return

    // 現在の状態をバックアップ（デバッグ用）
    const beforeState = state

    // undoを実行
    const result = undoStackRef.current.undo()

    // 必ず最新の状態を取得して更新
    const currentState = undoStackRef.current.getCurrentState()

    // デバッグログ
    if (stackOptions.debug) {
      console.log("[useUndo] Undo実行:", {
        historyLength: undoStackRef.current.state.past,
        beforeState,
        currentState,
        result,
      })
    }

    // 状態を確実に更新 - ここが重要
    setInternalState(currentState || initialState)
    setHistoryState(undoStackRef.current.state)
  }, [initialState, stackOptions.debug, state])

  /**
   * リドゥ処理
   */
  const redo = useCallback(() => {
    undoStackRef.current.redo()
    const currentState = undoStackRef.current.getCurrentState()

    // 必ず内部状態を更新
    setInternalState(currentState || initialState)
    setHistoryState(undoStackRef.current.state)
  }, [initialState])

  /**
   * 特定のインデックスまでアンドゥ
   */
  const undoTo = useCallback(
    (index: number) => {
      undoStackRef.current.undoTo(index)
      const currentState = undoStackRef.current.getCurrentState()

      // 状態取得後に必ず更新
      setInternalState(currentState || initialState)
      setHistoryState(undoStackRef.current.state)

      if (stackOptions.debug) {
        console.log("[useUndo] undoTo実行:", {
          index,
          newState: currentState,
          historyState: undoStackRef.current.state,
        })
      }
    },
    [initialState, stackOptions.debug],
  )

  /**
   * 特定のラベルまでアンドゥ
   */
  const undoUntil = useCallback(
    (label: string) => {
      undoStackRef.current.undoUntil(label)
      // 実際の状態を必ず取得・更新
      const currentState = undoStackRef.current.getCurrentState()
      setInternalState(currentState || initialState)
      setHistoryState(undoStackRef.current.state)
    },
    [initialState],
  )

  /**
   * 履歴をクリア
   */
  const clear = useCallback(() => {
    undoStackRef.current.clear()
    setHistoryState(undoStackRef.current.state)
    return true
  }, [])

  /**
   * リビルド処理 - 履歴スタックを保持したまま初期状態を変更
   */
  const rebuild = useCallback(
    (newInitialState?: T) => {
      const stateToUse = newInitialState ?? initialState
      undoStackRef.current.rebuild(stateToUse, (newState) => {
        setInternalState(newState)
      })
      setHistoryState(undoStackRef.current.state)
    },
    [initialState],
  )

  /**
   * 生の履歴データを取得
   */
  const getRawHistory = useCallback(() => {
    return undoStackRef.current._getRawHistory()
  }, [])

  /**
   * メモリ使用状況を取得
   */
  const getMemoryUsage = useCallback(() => {
    return undoStackRef.current.getMemoryUsage()
  }, [])

  /**
   * アンドゥ可能なアクションを作成
   */
  const createAction = useCallback(
    <R,>(doFn: () => R, undoFn: () => void, label?: string): UndoableAction<T> => {
      // doFnの実行結果を状態と連動させるためのラッパー
      return undoStackRef.current.createAction(
        () => {
          const result = doFn()
          return state
        },
        () => {
          undoFn()
          return state
        },
        label,
      )
    },
    [state],
  )

  /**
   * 差分ベースのアクションを作成
   */
  const createDiffAction = useCallback((prevState: T, nextState: T, label?: string): UndoableAction<T> => {
    return undoStackRef.current.createDiffAction(prevState, nextState, label)
  }, [])

  /**
   * バッチ処理を実行
   * 関数または直接アクション配列を受け取る拡張版
   */
  const batch = useCallback(
    (fnOrActions: (() => void) | UndoableAction<T>[], label?: string): void => {
      // 関数またはアクション配列かを判定
      if (typeof fnOrActions === "function") {
        // 関数バージョン
        if (stackOptions.debug) {
          console.log("[useUndo] バッチ処理開始:", label || "batch")
        }

        isBatchingRef.current = true
        batchActionsRef.current = []

        try {
          // バッチ内の関数を実行
          fnOrActions()

          // バッチをアンドゥスタックに追加（バッチ内に操作があった場合のみ）
          if (batchActionsRef.current.length > 0) {
            undoStackRef.current.batch(batchActionsRef.current, label || "batch")
            setHistoryState(undoStackRef.current.state)

            if (stackOptions.debug) {
              console.log("[useUndo] バッチ処理完了:", {
                label: label || "batch",
                actionsCount: batchActionsRef.current.length,
              })
            }
          } else if (stackOptions.debug) {
            console.log("[useUndo] バッチ処理: 変更なし")
          }
        } catch (err) {
          console.error("[useUndo] バッチ処理エラー:", err)
        } finally {
          isBatchingRef.current = false
          batchActionsRef.current = []
        }
      } else if (Array.isArray(fnOrActions)) {
        // アクション配列バージョン（そのまま維持）
        try {
          if (fnOrActions.length > 0) {
            if (stackOptions.debug) {
              console.log("[useUndo] 直接バッチ処理:", {
                label: label || "batch",
                actionsCount: fnOrActions.length,
              })
            }

            const result = undoStackRef.current.batch(fnOrActions, label || "batch")
            if (result !== undefined) {
              setInternalState(result)
              setHistoryState(undoStackRef.current.state)
            }
          }
        } catch (err) {
          console.error("[useUndo] 直接バッチ処理エラー:", err)
        }
      }
    },
    [stackOptions.debug],
  )

  // キーボードショートカットの設定
  useEffect(() => {
    // サーバーサイドでは実行しない
    if (typeof window === "undefined") return
    if (!enableKeyboardShortcuts) return

    // カスタムまたはデフォルトのキーバインド
    const undoKeys = keyboardShortcuts?.undo || ["z"]
    const redoKeys = keyboardShortcuts?.redo || ["y", "Z"]

    const handleKeyDown = (e: KeyboardEvent) => {
      // 入力要素でのキーボードショートカットは無視
      if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName || "")) {
        return
      }

      const isModifier = e.ctrlKey || e.metaKey
      if (!isModifier) return

      // アンドゥキーの処理（例: Ctrl+Z）
      if (undoKeys.includes(e.key) && !e.shiftKey && undoStackRef.current.canUndo) {
        e.preventDefault()
        undo()
        return
      }

      // リドゥキーの処理（例: Ctrl+Y または Ctrl+Shift+Z）
      if ((redoKeys.includes(e.key) || (e.key === "z" && e.shiftKey)) && undoStackRef.current.canRedo) {
        e.preventDefault()
        redo()
        return
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [enableKeyboardShortcuts, undo, redo, keyboardShortcuts?.undo, keyboardShortcuts?.redo])

  // コンポーネントのアンマウント時にクリーンアップする
  useEffect(() => {
    return () => {
      // パフォーマンスモニターのリソースを解放
      if (perfMonitorInstance && stackOptions.performanceMonitoring) {
        perfMonitorInstance.cancelGC("undoStackGC")
      }

      // メモリ関連リソースをクリア
      batchActionsRef.current = []

      if (stackOptions.debug) {
        console.log("[useUndo] クリーンアップ実行")
      }
    }
  }, [stackOptions.debug, stackOptions.performanceMonitoring, perfMonitorInstance])

  return {
    // 基本的な状態と操作
    state,
    setState,
    updateState,
    undo,
    redo,
    canUndo: historyState.canUndo,
    canRedo: historyState.canRedo,
    clear,

    // 拡張機能
    history: undoStackRef.current.history,
    historyState,
    undoTo,
    undoUntil,

    // バッチ処理とアクション作成
    batch,
    createAction,
    createDiffAction,

    // 高度な操作用
    getRawHistory,
    rebuild,
    getMemoryUsage,

    // パフォーマンス最適化のためのメモ化された値
    stack: undoStackRef.current,
  }
}

function useUndo<T>([state, setState]: [T, React.Dispatch<React.SetStateAction<T>>]) {
  const history = useRef([state])
  const [index, setIndex] = useState(0)
  const [currentState, setCurrentState] = useState(state)

  // indexの変更を監視してcurrentStateを更新
  useEffect(() => {
    setCurrentState(history.current[index])
  }, [index])

  function undo() {
    setIndex(Math.max(index - 1, 0))
  }
  function redo() {
    setIndex(Math.min(index + 1, history.current.length - 1))
  }
  function newSetState(nextState: T) {
    const nextIndex = index + 1
    history.current = history.current.slice(0, nextIndex)
    history.current[nextIndex] = nextState
    setIndex(nextIndex)
    setState(nextState)
  }

  return [currentState, newSetState, undo, redo]
}

export { useEfficientUndo, useUndo }
export type { UndoableAction, UndoStackOptions, UndoStackState, UseUndoOptions, UseUndoResult }
