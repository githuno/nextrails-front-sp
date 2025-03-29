import { 
  UndoStackPlugin, 
  PluginEventName, 
  PluginEventHandlers,
  UndoStack,
  UndoDebugger
} from './types';

/**
 * プラグインの依存関係を検証
 */
export function validatePluginDependencies<T>(
  plugins: UndoStackPlugin<T>[],
  logger: UndoDebugger
): boolean {
  const pluginNames = new Set(plugins.map(p => p.name));
  let valid = true;
  
  for (const plugin of plugins) {
    if (plugin.dependencies) {
      for (const depName of plugin.dependencies) {
        if (!pluginNames.has(depName)) {
          logger.warn(`プラグイン "${plugin.name}" の依存 "${depName}" が見つかりません`);
          valid = false;
        }
      }
    }
  }
  
  return valid;
}

/**
 * 依存関係に基づいてプラグインをソート
 */
export function sortPluginsByDependencyOrder<T>(
  plugins: UndoStackPlugin<T>[]
): UndoStackPlugin<T>[] {
  const nameToPlugin = new Map<string, UndoStackPlugin<T>>();
  plugins.forEach(p => nameToPlugin.set(p.name, p));
  
  // 出力順序
  const result: UndoStackPlugin<T>[] = [];
  // 処理済みプラグイン
  const visited = new Set<string>();
  // 現在の探索パス（循環依存検出用）
  const visiting = new Set<string>();
  
  function visit(plugin: UndoStackPlugin<T>) {
    if (visited.has(plugin.name)) return;
    if (visiting.has(plugin.name)) {
      throw new Error(`プラグインの循環依存が検出されました: ${plugin.name}`);
    }
    
    visiting.add(plugin.name);
    
    // 依存プラグインを先に処理
    if (plugin.dependencies) {
      for (const depName of plugin.dependencies) {
        const depPlugin = nameToPlugin.get(depName);
        if (depPlugin) {
          visit(depPlugin);
        }
      }
    }
    
    visiting.delete(plugin.name);
    visited.add(plugin.name);
    result.push(plugin);
  }
  
  // すべてのプラグインを処理
  plugins.forEach(plugin => {
    if (!visited.has(plugin.name)) {
      visit(plugin);
    }
  });
  
  return result;
}

/**
 * プラグインイベントの事前チェックとリスナーマップの構築
 * パフォーマンス改善のために、リスナーを持つイベントのみを事前に特定
 */
export function buildPluginEventMap<T>(plugins: UndoStackPlugin<T>[]): Record<PluginEventName, boolean> {
  const eventMap: Record<PluginEventName, boolean> = {
    init: false,
    actionPush: false,
    undo: false,
    redo: false,
    clear: false,
    gc: false,
    memoryWarning: false
  };
  
  // 各イベントについて、リスナーがあるかどうかを確認
  for (const plugin of plugins) {
    if (plugin.onInit) eventMap.init = true;
    if (plugin.onActionPush) eventMap.actionPush = true;
    if (plugin.onUndo) eventMap.undo = true;
    if (plugin.onRedo) eventMap.redo = true;
    if (plugin.onClear) eventMap.clear = true;
    if (plugin.onGC) eventMap.gc = true;
    if (plugin.onMemoryWarning) eventMap.memoryWarning = true;
    
    // 一度trueになったら変わらないので、すべてtrueなら早期終了
    if (Object.values(eventMap).every(v => v)) break;
  }
  
  return eventMap;
}

/**
 * イベント発行の統一関数（型安全版）
 */
export function emitPluginEvent<T, E extends PluginEventName>(
  event: E,
  plugins: UndoStackPlugin<T>[],
  logger: UndoDebugger,
  eventMap: Record<PluginEventName, boolean>,
  ...args: Parameters<PluginEventHandlers<T>[E]>
): void {
  // イベントに対するリスナーがなければ早期終了
  if (!eventMap[event]) return;
  
  // 優先度順にソート
  const sortedPlugins = [...plugins].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  
  // イベント名からメソッド名を生成
  const methodName = `on${event.charAt(0).toUpperCase() + event.slice(1)}` as const;
  
  for (const plugin of sortedPlugins) {
    try {
      const method = plugin[methodName as keyof typeof plugin];
      
      if (typeof method === 'function') {
        // 型キャストせずに実行
        (method as Function).apply(plugin, args);
      }
    } catch (error) {
      logger.error(`プラグイン ${plugin.name} の ${event} 処理でエラー:`, error);
      plugin.onError?.(error, methodName);
    }
  }
}

/**
 * 特定のイベントを処理できるプラグインが存在するかチェック
 */
export function hasPluginForEvent<T>(
  event: PluginEventName, 
  plugins: UndoStackPlugin<T>[]
): boolean {
  const methodName = `on${event.charAt(0).toUpperCase() + event.slice(1)}`;
  return plugins.some(plugin => typeof plugin[methodName as keyof typeof plugin] === 'function');
}