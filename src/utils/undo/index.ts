/**
 * アンドゥ/リドゥシステムのエントリーポイント
 * 
 * 使いやすいAPIを提供し、内部実装の詳細を隠蔽します。
 * ユーザーはこのモジュールをインポートして使用します。
 */

import { createUndoStack } from './core';
export * from './types';
export { createUndoStack };

// プラグインのエクスポート
export { 
  createHistoryPersistencePlugin, 
  createActionTrackerPlugin, 
  createDebugPlugin 
} from './plugins';

// 便利な関数のエクスポート
export {
  estimateActionSize,
  estimateTotalMemoryUsage
} from './memoryManager';

/**
 * シンプルな使用例:
 * 
 * ```ts
 * import { createUndoStack } from '@/utils/undo';
 * 
 * const stack = createUndoStack({
 *   debug: true,
 *   compress: true,
 *   performanceMonitoring: true
 * });
 * 
 * // アクションの追加
 * stack.push(
 *   () => ({ text: 'Hello' }),  // do関数
 *   () => ({ text: '' }),       // undo関数
 *   'テキストを追加'            // ラベル
 * );
 * 
 * // 操作を元に戻す
 * stack.undo();
 * 
 * // やり直す
 * stack.redo();
 * ```
 * 
 * 高度な使用例:
 * 
 * ```ts
 * import { createUndoStack, createHistoryPersistencePlugin, createActionTrackerPlugin } from '@/utils/undo';
 * import { objUt } from '@/utils/objectUtils';
 * 
 * // プラグインの設定
 * const persistencePlugin = createHistoryPersistencePlugin('my-editor-history', {
 *   storageType: 'localStorage',
 *   maxItems: 50,
 *   throttleMs: 2000,
 *   immutable: true,
 *   selectivePaths: ['document.content', 'document.metadata']
 * });
 * 
 * const trackerPlugin = createActionTrackerPlugin({
 *   onTrack: (actionType, label, timestamp, details) => {
 *     console.log(`[${new Date(timestamp).toISOString()}] ${actionType}: ${label}`, details);
 *   }
 * });
 * 
 * // メモリ最適化を活用したアンドゥスタックの作成
 * const stack = createUndoStack({
 *   debug: true,
 *   memoryEfficient: true,
 *   compress: true,
 *   performanceMonitoring: true,
 *   memoryBasedLimit: true,
 *   maxMemorySize: 100, // 最大100MB
 *   plugins: [persistencePlugin, trackerPlugin]
 * });
 * 
 * // 差分ベースのアクションを作成（メモリ効率が良い）
 * const prevState = { document: { content: "元の内容", metadata: { modified: false } } };
 * const nextState = { document: { content: "更新された内容", metadata: { modified: true } } };
 * 
 * const diffAction = stack.createDiffAction(
 *   prevState,
 *   nextState,
 *   'コンテンツ更新'
 * );
 * 
 * stack.pushAction(diffAction);
 * 
 * // バッチ処理（複数の操作を1つのアンドゥステップとしてグループ化）
 * const batchActions = [
 *   stack.createAction(
 *     () => ({ title: '新しいタイトル' }),
 *     () => ({ title: '古いタイトル' }),
 *     'タイトル変更'
 *   ),
 *   stack.createAction(
 *     () => ({ author: 'Alice' }),
 *     () => ({ author: 'Bob' }),
 *     '著者変更'
 *   )
 * ];
 * 
 * stack.batch(batchActions, '文書のメタデータ更新');
 * 
 * // メモリ使用状況の監視
 * const memoryUsage = stack.getMemoryUsage();
 * console.log(`使用メモリ: ${(memoryUsage.estimatedBytes / (1024 * 1024)).toFixed(2)}MB`);
 * console.log(`最大のアクション: ${memoryUsage.largestAction?.label} (${(memoryUsage.largestAction?.size || 0) / 1024}KB)`);
 * 
 * // 特定のラベルまでアンドゥ
 * stack.undoUntil('コンテンツ更新');
 * 
 * // 履歴を再構築（初期状態を変更）
 * const newInitialState = { document: { content: "", metadata: { modified: false } } };
 * stack.rebuild(newInitialState, (state) => {
 *   // 外部状態の更新処理
 *   updateEditorContent(state);
 * });
 * ```
 */