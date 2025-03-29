/**
 * パフォーマンス測定と資源管理のためのユーティリティ
 * 関数型アプローチによる実装
 */

// 型定義
export type MemorySnapshot = { timestamp: number; usage: number };
export type MemoryTrend = { trend: 'increasing' | 'decreasing' | 'stable'; changeRate: number; alert?: boolean };
export type OperationRecord = { duration?: number; memoryUsage?: number; timestamp?: number };
export type MemoryLeakReport = { detected: boolean; severity: 'low' | 'medium' | 'high'; details?: string };

/**
 * パフォーマンスモニターの状態を保持するストア
 */
export function createPerformanceMonitor(initialEnabled = false) {
  // 内部状態
  let enabled = initialEnabled;
  const gcTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const idleCallbacks = new Map<string, number>();
  let memorySnapshots: MemorySnapshot[] = [];
  let snapshotInterval: number | null = null;
  const MAX_SNAPSHOTS = 100;

  // 基本操作
  function setEnabled(isEnabled: boolean): void {
    enabled = isEnabled;
  }

  function isEnabled(): boolean {
    return enabled;
  }

  // 時間計測
  function startTimer(): number {
    return enabled && typeof performance !== 'undefined' ? performance.now() : 0;
  }

  function endTimer(startTime: number): number {
    return enabled && typeof performance !== 'undefined' ? performance.now() - startTime : 0;
  }

  // メモリ使用量
  function getMemoryUsage(): number | undefined {
    if (!enabled || typeof performance === 'undefined' || !('memory' in performance)) {
      return undefined;
    }
    return (performance as any).memory?.usedJSHeapSize;
  }

  function formatMemorySize(bytes: number | undefined): string {
    if (bytes === undefined) return 'unknown';
    if (bytes < 1024) return `${bytes} bytes`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  // スナップショット管理
  function takeMemorySnapshot(): void {
    if (!enabled) return;

    const memoryUsage = getMemoryUsage();
    if (memoryUsage) {
      memorySnapshots.push({
        timestamp: Date.now(),
        usage: memoryUsage
      });

      // スナップショット数を制限
      if (memorySnapshots.length > MAX_SNAPSHOTS) {
        compressSnapshots();
      }
    }
  }

  function compressSnapshots(): void {
    const compressSize = Math.floor(MAX_SNAPSHOTS / 2);
    if (memorySnapshots.length <= compressSize) return;

    const compressWindow = Math.min(10, Math.floor(compressSize / 5));
    const newSnapshots: MemorySnapshot[] = [];

    // 最新のスナップショットは残す
    const keepRecent = memorySnapshots.slice(-compressSize);

    // 古いスナップショットを圧縮
    for (let i = 0; i < memorySnapshots.length - compressSize; i += compressWindow) {
      const chunk = memorySnapshots.slice(i, i + compressWindow);
      if (chunk.length > 0) {
        // 各チャンクの平均を計算
        const avgUsage = chunk.reduce((sum, item) => sum + item.usage, 0) / chunk.length;
        const avgTimestamp = Math.floor(
          chunk.reduce((sum, item) => sum + item.timestamp, 0) / chunk.length
        );
        newSnapshots.push({ timestamp: avgTimestamp, usage: avgUsage });
      }
    }

    // 圧縮したスナップショットと最新のスナップショットを組み合わせる
    memorySnapshots = [...newSnapshots, ...keepRecent];
  }

  // 操作記録
  function recordOperation<T extends OperationRecord>(operation: T): T {
    if (!enabled) return operation;

    // メモリ使用量の記録
    if (!operation.memoryUsage) {
      operation.memoryUsage = getMemoryUsage();
    }

    // タイムスタンプが無ければ現在時刻を設定
    if (!operation.timestamp) {
      operation.timestamp = Date.now();
    }

    takeMemorySnapshot();

    return operation;
  }

  // メモリトラッキング
  function startMemoryTracking(intervalMs: number = 10000): void {
    if (!enabled || typeof window === 'undefined') return;

    stopMemoryTracking();

    snapshotInterval = window.setInterval(() => {
      takeMemorySnapshot();
    }, intervalMs);
  }

  function stopMemoryTracking(): void {
    if (snapshotInterval !== null && typeof clearInterval !== 'undefined') {
      clearInterval(snapshotInterval);
      snapshotInterval = null;
    }
  }

  // 分析関数
  function getMemoryHistory(): MemorySnapshot[] {
    return [...memorySnapshots];
  }

  function analyzeMemoryTrend(): MemoryTrend {
    if (memorySnapshots.length < 2) {
      return { trend: 'stable', changeRate: 0 };
    }

    // 長期間の傾向を検出するために複数のサンプルポイントを使用
    const samples = Math.min(20, Math.floor(memorySnapshots.length / 2));

    // 早期サンプルと最近のサンプルを比較
    const earlySnapshots = memorySnapshots.slice(0, samples);
    const recentSnapshots = memorySnapshots.slice(-samples);

    const avgEarly = earlySnapshots.reduce((sum, snap) => sum + snap.usage, 0) / earlySnapshots.length;
    const avgRecent = recentSnapshots.reduce((sum, snap) => sum + snap.usage, 0) / recentSnapshots.length;

    const changeRate = avgEarly === 0 ? 0 : (avgRecent - avgEarly) / avgEarly;

    // 傾向の判定（高い閾値は重要な変化のみを検出）
    if (changeRate > 0.2) {
      // メモリリークの可能性を警告
      const alert = changeRate > 0.5;
      return { trend: 'increasing', changeRate, alert };
    } else if (changeRate < -0.1) {
      return { trend: 'decreasing', changeRate };
    } else {
      return { trend: 'stable', changeRate };
    }
  }

  // ガベージコレクション管理
  function scheduleGC(id: string, callback: () => void, delayMs: number): void {
    if (!enabled) return;

    cancelGC(id);

    // requestIdleCallbackが利用可能なら使用
    if (typeof requestIdleCallback !== 'undefined') {
      const handle = requestIdleCallback(() => {
        // メモリが逼迫している場合は優先度を高くする
        const memoryTrend = analyzeMemoryTrend();
        if (memoryTrend.trend === 'increasing' && memoryTrend.changeRate > 0.3) {
          // メモリ圧迫時はすぐにGC実行
          callback();
        } else {
          // 時間余裕がある場合は通常のタイマーで実行
          const timer = setTimeout(() => {
            callback();
            gcTimers.delete(id);
          }, delayMs);

          gcTimers.set(id, timer);
        }
        idleCallbacks.delete(id);
      }, { timeout: delayMs });

      idleCallbacks.set(id, handle);
    } else if (typeof setTimeout !== 'undefined') {
      // requestIdleCallbackが利用できない環境ではsetTimeoutを使用
      const timer = setTimeout(() => {
        callback();
        gcTimers.delete(id);
      }, delayMs);

      gcTimers.set(id, timer);
    }
  }

  function runGCImmediately(id: string, callback: () => void): void {
    cancelGC(id);
    callback();
  }

  function cancelGC(id: string): void {
    // 通常のタイマーをキャンセル
    const existingTimer = gcTimers.get(id);
    if (existingTimer && typeof clearTimeout !== 'undefined') {
      clearTimeout(existingTimer);
      gcTimers.delete(id);
    }

    // IdleCallbackをキャンセル
    const idleCallback = idleCallbacks.get(id);
    if (idleCallback && typeof cancelIdleCallback !== 'undefined') {
      cancelIdleCallback(idleCallback);
      idleCallbacks.delete(id);
    }
  }

  function cancelAllGC(): void {
    // すべての通常タイマーをキャンセル
    if (typeof clearTimeout !== 'undefined') {
      gcTimers.forEach((timer) => {
        clearTimeout(timer);
      });
      gcTimers.clear();
    }

    // すべてのIdleCallbackをキャンセル
    if (typeof cancelIdleCallback !== 'undefined') {
      idleCallbacks.forEach((handle) => {
        cancelIdleCallback(handle);
      });
      idleCallbacks.clear();
    }
  }

  // 診断機能
  function getResourcesUsageSummary(): string {
    const memUsage = getMemoryUsage();
    const timerCount = gcTimers.size;
    const idleCallbackCount = idleCallbacks.size;
    const snapshotCount = memorySnapshots.length;

    return [
      `メモリ使用量: ${formatMemorySize(memUsage)}`,
      `アクティブタイマー: ${timerCount}`,
      `アイドルコールバック: ${idleCallbackCount}`,
      `スナップショット数: ${snapshotCount}`
    ].join(', ');
  }

  function detectMemoryLeaks(): MemoryLeakReport {
    if (memorySnapshots.length < 10) {
      return { detected: false, severity: 'low' };
    }

    const trend = analyzeMemoryTrend();

    if (trend.trend !== 'increasing' || trend.changeRate < 0.2) {
      return { detected: false, severity: 'low' };
    }

    // メモリ使用量の増加パターンを分析
    const chunks = 5; // 分析チャンク
    const snapsPerChunk = Math.floor(memorySnapshots.length / chunks);

    // 各チャンクの平均メモリ使用量を計算
    const chunkAverages: number[] = [];
    for (let i = 0; i < chunks; i++) {
      const start = i * snapsPerChunk;
      const end = (i + 1) * snapsPerChunk;
      const chunk = memorySnapshots.slice(start, end);
      const avgUsage = chunk.reduce((sum, snap) => sum + snap.usage, 0) / chunk.length;
      chunkAverages.push(avgUsage);
    }

    // 連続的な増加を確認（メモリリークの特徴）
    let consecutiveIncreases = 0;
    for (let i = 1; i < chunkAverages.length; i++) {
      if (chunkAverages[i] > chunkAverages[i - 1]) {
        consecutiveIncreases++;
      }
    }

    // 深刻度の判断
    if (consecutiveIncreases >= chunks - 1 && trend.changeRate > 0.5) {
      return {
        detected: true,
        severity: 'high',
        details: `連続的なメモリ増加が検出されました。増加率: ${(trend.changeRate * 100).toFixed(1)}%`
      };
    } else if (consecutiveIncreases >= chunks - 2 && trend.changeRate > 0.3) {
      return {
        detected: true,
        severity: 'medium',
        details: `メモリ増加の傾向が見られます。増加率: ${(trend.changeRate * 100).toFixed(1)}%`
      };
    } else if (trend.changeRate > 0.2) {
      return {
        detected: true,
        severity: 'low',
        details: `わずかなメモリ増加が検出されました。増加率: ${(trend.changeRate * 100).toFixed(1)}%`
      };
    }

    return { detected: false, severity: 'low' };
  }

  // リソース解放
  function dispose(): void {
    stopMemoryTracking();
    cancelAllGC();
    memorySnapshots = [];
  }

  // APIをまとめて返却
  return {
    // 基本設定
    setEnabled,
    isEnabled,
    
    // タイマー機能
    startTimer,
    endTimer,
    
    // メモリ監視
    getMemoryUsage,
    formatMemorySize,
    recordOperation,
    
    // スナップショット
    takeMemorySnapshot,
    startMemoryTracking,
    stopMemoryTracking,
    getMemoryHistory,
    
    // 分析
    analyzeMemoryTrend,
    detectMemoryLeaks,
    getResourcesUsageSummary,
    
    // GC管理
    scheduleGC,
    cancelGC,
    cancelAllGC,
    runGCImmediately,
    
    // クリーンアップ
    dispose
  };
}

// 簡単に使えるシングルトンインスタンス（オプショナル）
export const perfMonitor = createPerformanceMonitor(false);

// 独立した関数としても利用可能な主要機能
export const measureTime = (fn: () => any, enabled = true): { result: any, duration: number } => {
  if (!enabled) return { result: fn(), duration: 0 };
  
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;
  
  return { result, duration };
};