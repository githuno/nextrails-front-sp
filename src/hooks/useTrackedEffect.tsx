import { useEffect, useRef, DependencyList } from "react"

/**
 * 依存配列の変更を追跡するカスタムReactフック
 *
 * @param effect どの依存関係が変更されたかの情報を受け取るエフェクトコールバック
 * @param dependencies 追跡する依存関係の配列
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

const useTrackedEffect = (effect: EffectCallback, dependencies: DependencyList) => {
  const previousDependencies = useRef<DependencyList | null>(null);

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

export default useTrackedEffect

// import { useEffect, useRef } from 'react';

// /**
//  * A custom React hook that tracks which dependencies changed between renders
//  * 
//  * @param {Function} effect - Effect callback that receives information about changed dependencies
//  * @param {Array} dependencies - Array of dependencies to track
//  */
// const useTrackedEffect = (effect, dependencies) => {
//   const previousDependencies = useRef(dependencies);
  
//   useEffect(() => {
//     // Skip first render
//     if (previousDependencies.current) {
//       // Create an object to track which dependencies changed
//       const changedDeps = dependencies.reduce((acc, dep, index) => {
//         // Compare current dependency with previous one
//         if (dep !== previousDependencies.current[index]) {
//           acc[index] = {
//             from: previousDependencies.current[index],
//             to: dep
//           };
//         }
//         return acc;
//       }, {});
      
//       // Only run effect if at least one dependency changed
//       if (Object.keys(changedDeps).length > 0) {
//         // Call the effect with changed dependencies info
//         return effect(changedDeps);
//       }
//     }
    
//     // Update previous dependencies for next render
//     previousDependencies.current = dependencies;
    
//     // Return cleanup function from effect (if any)
//     return () => {
//       if (effect.cleanup && typeof effect.cleanup === 'function') {
//         effect.cleanup();
//       }
//     };
//   }, dependencies);
// };

// export default useTrackedEffect;