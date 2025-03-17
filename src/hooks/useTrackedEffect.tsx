import { useEffect, useRef, DependencyList } from "react"

/**
 * 依存配列の変更とメモリ使用量を追跡するカスタムReactフック
 *
 * @param effect どの依存関係が変更されたかの情報を受け取るエフェクトコールバック
 * @param dependencies 追跡する依存関係の配列
 * @param options 追加オプション（メモリ監視など）
 * 
 * 【使用例】
 * 1. 基本的な使用方法：
 *    useTrackedEffect(
 *      (changes) => {
 *        console.log('変更された依存関係:', changes);
 *      }, 
 *      [count, name]
 *    );
 * 
 * 2. 変更前後の値を利用する：
 *    useTrackedEffect(
 *      (changes) => {
 *        if (0 in changes) {  // countが変更された
 *          console.log(`count: ${changes[0].trackedFrom} -> ${changes[0].trackedTo}`);
 *        }
 *      }, 
 *      [count, name]
 *    );
 * 
 * 3. クリーンアップ関数を返す：
 *    useTrackedEffect(
 *      (changes) => {
 *        const timer = setTimeout(() => {}, 1000);
 *        return () => clearTimeout(timer);  // クリーンアップ関数
 *      }, 
 *      [count]
 *    );
 * 
 * 4. メモリ監視を有効化：
 *    useTrackedEffect(
 *      (changes) => {
 *        console.log('状態が変化しました:', changes);
 *      }, 
 *      [count, name],
 *      { monitorMemory: true }  // メモリ監視を有効化
 *    );
 * 
 * 5. メモリ監視の間隔とタグをカスタマイズ：
 *    useTrackedEffect(
 *      (changes) => {
 *        console.log('状態が変化しました:', changes);
 *      }, 
 *      [count, name],
 *      { 
 *        monitorMemory: true,
 *        monitorInterval: 10000,  // 10秒ごとに監視
 *        memoryTag: "UserProfile"  // タグ付け
 *      }
 *    );
 * 
 * 6. パフォーマンス問題のデバッグ：
 *    useTrackedEffect(
 *      (changes) => {
 *        if (1 in changes && changes[1].trackedTo.length > 1000) {
 *          console.warn('大量のデータが依存配列に含まれています！');
 *        }
 *      }, 
 *      [count, largeDataArray],
 *      { monitorMemory: true }
 *    );
 * 
 * 7. 複数のモジュールでメモリ使用状況を比較：
 *    // モジュールA
 *    useTrackedEffect(effectA, depsA, { monitorMemory: true, memoryTag: "ModuleA" });
 *    // モジュールB
 *    useTrackedEffect(effectB, depsB, { monitorMemory: true, memoryTag: "ModuleB" });
 */

// 変更された依存関係の情報を表す型
type ChangedDeps = {
  [key: number]: {
    trackedFrom: any;
    trackedTo: any;
  }
}

// エフェクト関数の型
type EffectCallback = (changedDeps: ChangedDeps) => void | (() => void);

// フックのオプション設定
interface TrackedEffectOptions {
  // メモリ監視を有効にするかどうか
  monitorMemory?: boolean;
  // メモリ監視の間隔（ミリ秒）
  monitorInterval?: number;
  // メモリ使用量のログタグ（識別用）
  memoryTag?: string;
}

const useTrackedEffect = (
  effect: EffectCallback, 
  dependencies: DependencyList,
  options?: TrackedEffectOptions
) => {
  const previousDependencies = useRef<DependencyList | null>(null);
  const defaultOptions = {
    monitorMemory: false,
    monitorInterval: 30000,
    memoryTag: "Component",
  };

  // オプションとデフォルト値をマージ
  const mergedOptions = { ...defaultOptions, ...options };

  // メモリ監視のエフェクト
  useEffect(() => {
    // 開発環境かつメモリ監視が有効な場合のみ実行
    if (process.env.NODE_ENV === "development" && mergedOptions.monitorMemory) {
      const memoryCheckInterval = setInterval(() => {
        // Chrome特有の拡張を持つパフォーマンスインターフェースを使用
        const perf = window.performance as any;
        if (perf && perf.memory) {
          console.log(
            `Memory usage [${mergedOptions.memoryTag}]:`,
            `${Math.round(perf.memory.usedJSHeapSize / 1024 / 1024)} MB / ` +
              `${Math.round(perf.memory.jsHeapSizeLimit / 1024 / 1024)} MB`
          );
        } else {
          console.log("Memory monitoring not supported in this browser");
        }
      }, mergedOptions.monitorInterval);

      return () => clearInterval(memoryCheckInterval);
    }
  }, [mergedOptions.monitorMemory, mergedOptions.monitorInterval, mergedOptions.memoryTag]);

  // メイン依存関係の追跡エフェクト
  useEffect(() => {
    // 初回レンダリングをスキップ
    if (previousDependencies.current) {
      // 依存関係の変更を追跡するオブジェクトを作成
      const changedDeps = dependencies.reduce<ChangedDeps>((acc, dep, index) => {
        // 現在の依存関係と前の依存関係を比較
        if (dep !== previousDependencies.current![index]) {
          acc[index] = {
            trackedFrom: previousDependencies.current![index],
            trackedTo: dep,
          }
        }
        return acc
      }, {})

      // 少なくとも1つの依存関係が変更された場合のみエフェクトを実行
      if (Object.keys(changedDeps).length > 0) {
        // 変更された依存関係の情報でエフェクトを呼び出す
        return effect(changedDeps)
      }
    }

    // 次のレンダリングのために前の依存関係を更新
    previousDependencies.current = dependencies;
    
    // クリーンアップ関数は不要なので返さない
  }, [...dependencies]); // 依存配列をスプレッド演算子で展開して配列リテラルにする
}

export default useTrackedEffect;