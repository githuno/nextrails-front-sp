/**
 * アンドゥ可能なアクションのインターフェース
 * do: アクションを実行する関数
 * undo: アクションを元に戻す関数
 * label: (オプション) アクションの説明ラベル
 * args: (オプション) アクションに関連する引数のコレクション
 */
export interface UndoableAction<T> {
  do: () => T
  undo: () => T
  label?: string
  args?: any[]
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
}

/**
 * アンドゥスタックの状態情報
 */
export interface UndoStackState {
  past: number
  future: number
  canUndo: boolean
  canRedo: boolean
  lastOperation?: {
    type: "push" | "undo" | "redo" | "clear"
    timestamp: number
    duration?: number
  }
}

/**
 * 強化されたアンドゥスタックを作成する関数
 */
export function createUndoStack<T>(options: UndoStackOptions = {}): UndoStack<T> {
  const { maxHistory, debug, compress = false, performanceMonitoring = false } = options
  let past: UndoableAction<T>[] = []
  let future: UndoableAction<T>[] = []
  let isPerformingAction = false
  let lastOperation: UndoStackState["lastOperation"]

  /**
   * デバッグログを出力
   */
  const log = (message: string, ...args: any[]): void => {
    if (debug) {
      console.log(`[UndoStack] ${message}`, ...args)
    }
  }

  /**
   * パフォーマンス測定開始
   */
  const startPerformanceTimer = (): number => {
    return performanceMonitoring ? performance.now() : 0
  }

  /**
   * パフォーマンス測定終了
   */
  const endPerformanceTimer = (
    startTime: number,
    operationType: NonNullable<UndoStackState["lastOperation"]>["type"],
  ): void => {
    if (performanceMonitoring) {
      const duration = performance.now() - startTime
      lastOperation = {
        type: operationType,
        timestamp: Date.now(),
        duration,
      }

      if (duration > 16) {
        // 1フレームの時間(約16.7ms)を超えたら警告
        log(`パフォーマンス警告: ${operationType} 操作が ${duration.toFixed(2)}ms かかりました`)
      }
    }
  }

  /**
   * アクションの実行と結果の処理を行う
   */
  const executeAction = <R>(actionFn: () => R, actionName: string): R => {
    try {
      isPerformingAction = true
      const startTime = startPerformanceTimer()
      const result = actionFn()
      if (performanceMonitoring) {
        const endTime = performance.now()
        log(`${actionName} 実行完了 (${(endTime - startTime).toFixed(2)}ms)`, result)
      } else {
        log(`${actionName} 実行完了`, result)
      }
      return result
    } catch (error) {
      log(`${actionName} エラー`, error)
      throw error
    } finally {
      isPerformingAction = false
    }
  }

  /**
   * アクションの圧縮を試行（同じラベルの連続アクションをまとめる）
   */
  const tryCompressAction = (action: UndoableAction<T>): boolean => {
    if (!compress || !action.label || past.length === 0) {
      return false
    }

    const lastAction = past[past.length - 1]
    if (lastAction.label === action.label) {
      // 前回と同じラベルのアクションは圧縮の対象
      // 最新のアクションのみを保持し、以前のアクションを置き換え
      past[past.length - 1] = action
      log(`アクション圧縮: ${action.label}`)
      return true
    }

    return false
  }

  /**
   * クローン作成ヘルパー - structuredCloneが使える環境では利用
   */
  const deepClone = <D>(data: D): D => {
    if (typeof window !== "undefined" && "structuredClone" in window) {
      return window.structuredClone(data)
    }

    if (data === null || typeof data !== "object") {
      return data
    }

    if (Array.isArray(data)) {
      return data.map(deepClone) as any
    }

    const result: any = {}
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        result[key] = deepClone((data as any)[key])
      }
    }

    return result as D
  }

  return {
    /**
     * 関数とクローン化する引数からアクションを作成
     * @param doFn 実行する関数
     * @param undoFn 元に戻す関数
     * @param label オプションのラベル
     * @param args クローン化する引数
     */
    createAction(
      doFn: (...args: any[]) => T,
      undoFn: (...args: any[]) => T,
      label?: string,
      ...args: any[]
    ): UndoableAction<T> {
      log(`アクション作成: ${label || "unnamed"}`, { args })

      // 引数をディープクローン
      const clonedArgs = args.map(deepClone)

      return {
        do: () => doFn(...clonedArgs),
        undo: () => undoFn(...clonedArgs),
        label,
        args: clonedArgs,
      }
    },

    /**
     * 直接関数を受け取り、実行してスタックに追加
     */
    push(doFn: (...args: any[]) => T, undoFn: (...args: any[]) => T, label?: string, ...args: any[]): T {
      const startTime = startPerformanceTimer()
      log(`アクション追加: ${label || "unnamed"}`, { args })

      // 引数をディープクローン
      const clonedArgs = args.map(deepClone)

      // 新しいアクションの実行
      const result = executeAction(() => doFn(...clonedArgs), "doAction")

      // アクションオブジェクト作成
      const action: UndoableAction<T> = {
        do: () => doFn(...clonedArgs),
        undo: () => undoFn(...clonedArgs),
        label,
        args: clonedArgs,
      }

      // 圧縮を試行、失敗したら通常通り追加
      if (!compress || !tryCompressAction(action)) {
        past.push(action)

        // 履歴の上限を設定している場合は古い履歴を削除
        if (maxHistory !== undefined && past.length > maxHistory) {
          log(`履歴上限(${maxHistory})を超えたため古い履歴を削除`)
          past = past.slice(-maxHistory)
        }
      }

      // Redoスタックをクリア
      if (future.length > 0) {
        log("Redoスタックをクリア")
        future = []
      }

      endPerformanceTimer(startTime, "push")
      return result
    },

    /**
     * アクションオブジェクトを直接追加
     */
    pushAction(action: UndoableAction<T>): T {
      const startTime = startPerformanceTimer()
      log(`UndoableActionの追加: ${action.label || "unnamed"}`)

      // アクションを実行
      const result = executeAction(() => action.do(), "doAction")

      // 圧縮を試行、失敗したら通常通り追加
      if (!compress || !tryCompressAction(action)) {
        past.push(action)

        // 履歴の上限を設定している場合は古い履歴を削除
        if (maxHistory !== undefined && past.length > maxHistory) {
          log(`履歴上限(${maxHistory})を超えたため古い履歴を削除`)
          past = past.slice(-maxHistory)
        }
      }

      // Redoスタックをクリア
      future = []

      endPerformanceTimer(startTime, "push")
      return result
    },

    /**
     * 直前のアクションを元に戻す
     */
    undo(): T | undefined {
      if (!this.canUndo) {
        log("アンドゥできるアクションがありません")
        return undefined
      }

      const startTime = startPerformanceTimer()
      const action = past.pop()!
      log(`アンドゥ実行: ${action.label || "unnamed"}`)
      const result = executeAction(() => action.undo(), "undoAction")
      future.unshift(action)

      endPerformanceTimer(startTime, "undo")
      return result
    },

    /**
     * 元に戻したアクションをやり直す
     */
    redo(): T | undefined {
      if (!this.canRedo) {
        log("リドゥできるアクションがありません")
        return undefined
      }

      const startTime = startPerformanceTimer()
      const action = future.shift()!
      log(`リドゥ実行: ${action.label || "unnamed"}`)
      const result = executeAction(() => action.do(), "redoAction")
      past.push(action)

      endPerformanceTimer(startTime, "redo")
      return result
    },

    /**
     * 複数のアクションをまとめて一つのアクションとしてスタックに追加
     */
    batch(actions: UndoableAction<T>[], label?: string): T | undefined {
      if (actions.length === 0) {
        return undefined
      }

      const startTime = startPerformanceTimer()
      log(`バッチアクション作成: ${label || "batch"} (${actions.length}件)`)

      // バッチアクションを作成
      const batchAction: UndoableAction<T> = {
        do: () => {
          let result: T | undefined
          for (const action of actions) {
            result = action.do()
          }
          return result!
        },
        undo: () => {
          let result: T | undefined
          // 逆順でアンドゥを実行
          for (let i = actions.length - 1; i >= 0; i--) {
            result = actions[i].undo()
          }
          return result!
        },
        label,
      }

      const result = this.pushAction(batchAction)
      endPerformanceTimer(startTime, "push")
      return result
    },

    /**
     * タグ付けされた時点までアンドゥする
     */
    undoUntil(label: string): T | undefined {
      if (!this.canUndo) {
        return undefined
      }

      const startTime = startPerformanceTimer()
      log(`${label}までアンドゥ`)

      let result: T | undefined
      let found = false

      while (this.canUndo && !found) {
        const action = past[past.length - 1]
        result = this.undo()
        found = action.label === label
      }

      endPerformanceTimer(startTime, "undo")
      return result
    },

    /**
     * 指定されたインデックスまでアンドゥする
     * (参考記事の「version history」的な使い方に対応)
     */
    undoTo(index: number): T | undefined {
      if (index < 0 || index >= past.length) {
        return undefined
      }

      const startTime = startPerformanceTimer()
      log(`インデックス${index}までアンドゥ`)

      const actionsToUndo = past.length - index - 1
      let result: T | undefined

      for (let i = 0; i < actionsToUndo; i++) {
        result = this.undo()
      }

      endPerformanceTimer(startTime, "undo")
      return result
    },

    /**
     * 現在の状態からすべてのアクションを再実行する
     * (パフォーマンス問題を解決するための再構築ユーティリティ)
     */
    rebuild(initialState: T, setStateFn: (state: T) => void): T {
      log("履歴の再構築を実行...")

      // 現在のスタック状態を保存
      const currentPast = [...past]
      const currentFuture = [...future]

      // スタックをクリア
      this.clear()

      // 初期状態を設定
      setStateFn(initialState)

      // 保存されたアクションを再実行
      let finalState: T = initialState
      for (const action of currentPast) {
        // アクションを再度実行して結果を取得
        finalState = action.do()
        // スタックに追加（実行せずに）
        past.push(action)
      }

      // 将来のアクションを復元
      future = currentFuture

      log("履歴の再構築完了", { past: past.length, future: future.length })
      return finalState
    },

    /**
     * スタックをクリア
     */
    clear(): boolean {
      const startTime = startPerformanceTimer()
      log("履歴クリア")
      past = []
      future = []
      endPerformanceTimer(startTime, "clear")
      return true
    },

    /**
     * アンドゥ可能かどうか
     */
    get canUndo(): boolean {
      return past.length > 0 && !isPerformingAction
    },

    /**
     * リドゥ可能かどうか
     */
    get canRedo(): boolean {
      return future.length > 0 && !isPerformingAction
    },

    /**
     * アンドゥ履歴のスナップショットを取得
     */
    get history(): Array<{ index: number; label: string }> {
      return past.map((action, index) => ({
        index,
        label: action.label || `アクション ${index + 1}`,
      }))
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
      }
    },

    /**
     * 生の履歴データにアクセス (高度な操作用)
     */
    _getRawHistory(): {
      past: UndoableAction<T>[]
      future: UndoableAction<T>[]
    } {
      return {
        past: [...past],
        future: [...future],
      }
    },
  }
}

// 追加のタイプ定義
export interface UndoStack<T> {
  createAction: (
    doFn: (...args: any[]) => T,
    undoFn: (...args: any[]) => T,
    label?: string,
    ...args: any[]
  ) => UndoableAction<T>
  push: (doFn: (...args: any[]) => T, undoFn: (...args: any[]) => T, label?: string, ...args: any[]) => T
  pushAction: (action: UndoableAction<T>) => T
  undo: () => T | undefined
  redo: () => T | undefined
  batch: (actions: UndoableAction<T>[], label?: string) => T | undefined
  undoUntil: (label: string) => T | undefined
  undoTo: (index: number) => T | undefined
  rebuild: (initialState: T, setStateFn: (state: T) => void) => T
  clear: () => boolean
  readonly canUndo: boolean
  readonly canRedo: boolean
  readonly history: Array<{ index: number; label: string }>
  readonly state: UndoStackState
  _getRawHistory: () => {
    past: UndoableAction<T>[]
    future: UndoableAction<T>[]
  }
}
