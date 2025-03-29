import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { createUndoStack, UndoableAction, UndoStackOptions, UndoStack, UndoStackState } from '@/utils/undo';

/**
 * フックの戻り値の拡張型定義
 */
interface UseUndoResult<T> {
  // 基本的な状態と操作
  state: T;
  setState: (newState: T | ((prevState: T) => T)) => void;
  updateState: (partialState: Partial<T>) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clear: () => void;
  
  // 拡張機能
  history: Array<{ index: number; label: string }>;
  historyState: UndoStackState;
  undoTo: (index: number) => void;
  undoUntil: (label: string) => void;
  
  // バッチ処理とアクション作成
  batch: (fn: () => void, label?: string) => void;
  createAction: <R>(doFn: () => R, undoFn: () => void, label?: string) => UndoableAction<T>;
  
  // 高度な操作用
  getRawHistory: () => { past: UndoableAction<T>[]; future: UndoableAction<T>[] };
  rebuild: (newInitialState?: T) => void;
  
  // パフォーマンス最適化のためのメモ化された値
  stack: UndoStack<T>;
}

/**
 * フックの拡張オプション型定義
 */
interface UseUndoOptions extends UndoStackOptions {
  /** 履歴の最大数 */
  historyLimit?: number;
  /** キーボードショートカットを有効にするか */
  enableKeyboardShortcuts?: boolean;
  /** 状態が変更されたときに呼び出されるコールバック */
  onStateChange?: (newState: any) => void;
  /** 履歴の変更時に呼び出されるコールバック */
  onHistoryChange?: (history: Array<{ index: number; label: string }>) => void;
  /** Ctrl+Z/Ctrl+Y のカスタムキーマッピング */
  keyboardShortcuts?: {
    undo?: string[];
    redo?: string[];
  };
}

/**
 * 状態の一部だけを更新するヘルパー関数
 */
function mergeState<T extends Record<string, any>>(currentState: T, updates: Partial<T>): T {
  return { ...currentState, ...updates };
}

/**
 * 強化されたUndoフック
 * 強力なアンドゥ/リドゥ機能を提供し、パフォーマンスと使いやすさを向上させた実装
 */
function useUndo<T>(initialState: T, options: UseUndoOptions = {}): UseUndoResult<T> {
  const {
    historyLimit,
    enableKeyboardShortcuts = false,
    onStateChange,
    onHistoryChange,
    keyboardShortcuts,
    ...stackOptions
  } = options;

  // アンドゥスタックの作成（mutableなrefオブジェクト）
  const undoStackRef = useRef<UndoStack<T>>(createUndoStack<T>({
    maxHistory: historyLimit,
    ...stackOptions
  }));
  
  // 状態管理
  const [state, setInternalState] = useState<T>(
    // 初期状態をディープクローンする - undo.ts内の実装を使用
    () => {
      // 直接初期値を変更されるのを防ぐためクローン
      const stack = undoStackRef.current;
      // ヘルパーメソッドとしてundoStack内のcreateActionのcloneArgsを使用
      const action = stack.createAction(() => initialState, () => initialState, '初期状態');
      return action.do();
    }
  );
  
  // 履歴状態の管理
  const [historyState, setHistoryState] = useState<UndoStackState>(undoStackRef.current.state);
  
  // バッチ処理のための一時保存配列
  const batchActionsRef = useRef<UndoableAction<T>[]>([]);
  const isBatchingRef = useRef(false);
  
  // 完全なスタックを公開（メモ化）
  const stack = useMemo(() => undoStackRef.current, []);

  // 状態が変更されたときのコールバックと履歴の更新
  useEffect(() => {
    if (onStateChange) {
      onStateChange(state);
    }
    
    // 履歴状態を更新
    const newHistoryState = undoStackRef.current.state;
    setHistoryState(newHistoryState);
    
    if (onHistoryChange) {
      onHistoryChange(undoStackRef.current.history);
    }
  }, [state, onStateChange, onHistoryChange]);

  /**
   * 新しい状態を設定する（強化版）
   * ここが記事の思想を最も反映: ステートの変更操作そのものをアクションとして保存
   */
  const setState = useCallback((newState: T | ((prevState: T) => T)) => {
    // undoStackの内部実装を使ってクローン
    const action: UndoableAction<T> = undoStackRef.current.createAction(
      () => {
        // doFn: 新しい状態を計算して適用
        const computeNewState = typeof newState === 'function'
          ? (newState as ((prevState: T) => T))(state)
          : newState;
          
        setInternalState(computeNewState);
        return computeNewState;
      },
      () => {
        // undoFn: 前の状態に戻す
        setInternalState(state);
        return state;
      },
      'setState'
    );
    
    // バッチ処理中ならバッチに追加、そうでなければ即時実行
    if (isBatchingRef.current) {
      batchActionsRef.current.push(action);
      action.do(); // 状態を更新するが履歴には記録しない
      return;
    }
    
    // 即時実行してスタックに追加
    undoStackRef.current.pushAction(action);
    setHistoryState(undoStackRef.current.state);
  }, [state]);

  /**
   * 状態の一部だけを更新する（オブジェクト型の状態用）
   */
  const updateState = useCallback((partialState: Partial<T>) => {
    setState(prevState => {
      if (typeof prevState === 'object' && prevState !== null) {
        return mergeState(prevState as any, partialState) as T;
      }
      return prevState;
    });
  }, [setState]);

  /**
   * アンドゥ処理
   */
  const undo = useCallback(() => {
    const newState = undoStackRef.current.undo();
    if (newState !== undefined) {
      // 新しい状態をセットするだけで、履歴には記録しない
      setInternalState(newState);
      setHistoryState(undoStackRef.current.state);
    }
  }, []);

  /**
   * リドゥ処理
   */
  const redo = useCallback(() => {
    const newState = undoStackRef.current.redo();
    if (newState !== undefined) {
      setInternalState(newState);
      setHistoryState(undoStackRef.current.state);
    }
  }, []);

  /**
   * 特定のインデックスまでアンドゥ
   */
  const undoTo = useCallback((index: number) => {
    const newState = undoStackRef.current.undoTo(index);
    if (newState !== undefined) {
      setInternalState(newState);
      setHistoryState(undoStackRef.current.state);
    }
  }, []);

  /**
   * 特定のラベルまでアンドゥ
   */
  const undoUntil = useCallback((label: string) => {
    const newState = undoStackRef.current.undoUntil(label);
    if (newState !== undefined) {
      setInternalState(newState);
      setHistoryState(undoStackRef.current.state);
    }
  }, []);

  /**
   * 履歴をクリア
   */
  const clear = useCallback(() => {
    undoStackRef.current.clear();
    setHistoryState(undoStackRef.current.state);
    return true;
  }, []);

  /**
   * リビルド処理 - 履歴スタックを保持したまま初期状態を変更
   */
  const rebuild = useCallback((newInitialState?: T) => {
    const stateToUse = newInitialState ?? initialState;
    undoStackRef.current.rebuild(stateToUse, setInternalState);
    setHistoryState(undoStackRef.current.state);
  }, [initialState]);

  /**
   * 生の履歴データを取得（高度なカスタム操作用）
   */
  const getRawHistory = useCallback(() => {
    return undoStackRef.current._getRawHistory();
  }, []);

  /**
   * アンドゥ可能なアクションを作成
   * 現在の状態をキャプチャして、アクション実行後も同じ結果を返すことを保証
   */
  const createAction = useCallback(<R,>(doFn: () => R, undoFn: () => void, label?: string): UndoableAction<T> => {
    // 記事のアイデアを踏襲: アクションを実行する関数とロールバックする関数を保存
    // そして状態はアクション内でキャプチャする
    return undoStackRef.current.createAction(
      () => {
        doFn();
        return state; // 現在の状態を返す
      },
      () => {
        undoFn();
        return state; // 元の状態を返す
      },
      label
    );
  }, [state]);

  /**
   * バッチ処理を実行
   * 複数のアクションをまとめて1つのアンドゥステップとして記録
   */
  const batch = useCallback((fn: () => void, label?: string): void => {
    isBatchingRef.current = true;
    batchActionsRef.current = [];
    
    try {
      // バッチ内のアクションを実行
      fn();
      
      // バッチをアンドゥスタックに追加（バッチ内に操作があった場合のみ）
      if (batchActionsRef.current.length > 0) {
        undoStackRef.current.batch(batchActionsRef.current, label || 'batch');
        setHistoryState(undoStackRef.current.state);
      }
    } finally {
      // エラーが発生しても必ずバッチモードをリセット
      isBatchingRef.current = false;
      batchActionsRef.current = [];
    }
  }, []);

  // キーボードショートカットの設定
  useEffect(() => {
    if (!enableKeyboardShortcuts) return;
    
    // カスタムまたはデフォルトのキーバインド
    const undoKeys = keyboardShortcuts?.undo || ['z'];
    const redoKeys = keyboardShortcuts?.redo || ['y', 'Z'];
    
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModifier = e.ctrlKey || e.metaKey;
      if (!isModifier) return;
      
      // アンドゥキーの処理（例: Ctrl+Z）
      if (undoKeys.includes(e.key) && !e.shiftKey && undoStackRef.current.canUndo) {
        e.preventDefault();
        undo();
        return;
      }
      
      // リドゥキーの処理（例: Ctrl+Y または Ctrl+Shift+Z）
      if ((redoKeys.includes(e.key) || (e.key === 'z' && e.shiftKey)) && undoStackRef.current.canRedo) {
        e.preventDefault();
        redo();
        return;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboardShortcuts, undo, redo, keyboardShortcuts?.undo, keyboardShortcuts?.redo]);

  return {
    // 基本的な状態と操作
    state,
    setState,
    updateState,
    undo,
    redo,
    canUndo: undoStackRef.current.canUndo,
    canRedo: undoStackRef.current.canRedo,
    clear,
    
    // 拡張機能
    history: undoStackRef.current.history,
    historyState,
    undoTo,
    undoUntil,
    
    // バッチ処理とアクション作成
    batch,
    createAction,
    
    // 高度な操作用
    getRawHistory,
    rebuild,
    
    // パフォーマンス最適化のためのメモ化された値
    stack
  };
}

export default useUndo;
export type { UseUndoResult, UseUndoOptions, UndoableAction, UndoStackOptions, UndoStackState };
