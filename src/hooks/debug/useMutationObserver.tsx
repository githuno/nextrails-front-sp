import { useCallback, useEffect, useMemo, useRef, useState } from "react"

// 参考：https://jsdev.space/mutation-observer-dom-tracking-guide/
// 観察される変異の種類を定義
type MutationType = "childList" | "addedNodes" | "removedNodes" | "attributes" | "characterData"

// 変更されたノードの詳細情報
export interface MutationDetail {
  type: MutationType
  target: Node
  nodeName?: string
  nodeType?: number
  nodeValue?: string | null
  attributeName?: string | null
  oldValue?: string | null
  addedNodes?: Node[]
  removedNodes?: Node[]
  timestamp: number
}

// フックのオプション
interface MutationObserverOptions {
  // MutationObserverの基本設定
  childList?: boolean
  attributes?: boolean
  characterData?: boolean
  subtree?: boolean
  attributeOldValue?: boolean
  characterDataOldValue?: boolean
  attributeFilter?: string[]

  // 拡張オプション
  targetSelector?: string // 特定のセレクタに一致する要素のみを監視
  debounceTime?: number // 変更イベントをデバウンスする時間（ms）
  maxMutations?: number // 保持する最大変更履歴数
  debug?: boolean // デバッグモード
  monitorPerformance?: boolean // パフォーマンスモニタリング
  memoryTag?: string // メモリ監視用のタグ
  // フィルタリングオプション
  mutationFilter?: (_mutation: MutationRecord) => boolean
}

// フックの戻り値
interface MutationObserverReturn {
  mutations: MutationDetail[] // 変更の履歴
  lastMutation: MutationDetail | null // 最後の変更
  isObserving: boolean // 観察中かどうか
  disconnect: () => void // 切断メソッド
  reconnect: () => void // 再接続メソッド
  reset: () => void // リセットメソッド
  takeSnapshot: () => MutationDetail[] // 現在の変更のスナップショットを取得
}

/**
 * DOM変更を監視するためのReactカスタムフック（改善版）
 *
 * @param targetRef 監視対象のDOM要素への参照
 * @param callback 変更が検出されたときに呼び出されるコールバック関数
 * @param options 監視のオプション設定
 * @param _callbackDependencies コールバックが依存する値の配列
 * @returns 変更履歴と制御メソッドを含むオブジェクト
 */
function useMutationObserver(
  targetRef: React.RefObject<Element> | Element | null,
  callback?: (_mutations: MutationDetail[], _observer: MutationObserver) => void,
  options: MutationObserverOptions = {},
  _callbackDependencies: unknown[] = [], // 明示的な依存配列
): MutationObserverReturn {
  // デフォルトオプションをマージ（変更なし）
  const mergedOptions = useMemo(() => {
    const defaultOptions: MutationObserverOptions = {
      childList: true,
      attributes: true,
      characterData: true,
      subtree: true,
      attributeOldValue: true,
      characterDataOldValue: true,
      debounceTime: 0,
      maxMutations: 100,
      debug: false,
      monitorPerformance: false,
      memoryTag: "MutationObserver",
    }
    return { ...defaultOptions, ...options }
  }, [options])

  // その他の状態管理（変更なし）
  const observerRef = useRef<MutationObserver | null>(null)
  const [mutations, setMutations] = useState<MutationDetail[]>([])
  const [isObserving, setIsObserving] = useState<boolean>(false)
  const timeoutRef = useRef<number | null>(null)
  const performanceRef = useRef<{ startTime: number; mutationCount: number }>({
    startTime: 0,
    mutationCount: 0,
  })

  // 変更の処理とフィルタリング
  const processMutations = useCallback(
    (mutationsList: MutationRecord[]) => {
      const processedMutations: MutationDetail[] = []

      mutationsList.forEach((mutation) => {
        // カスタムフィルターを適用
        if (mergedOptions.mutationFilter && !mergedOptions.mutationFilter(mutation)) {
          return
        }

        // targetSelectorが指定されている場合、一致する要素のみを処理
        if (
          mergedOptions.targetSelector &&
          mutation.target instanceof Element &&
          !mutation.target.matches(mergedOptions.targetSelector)
        ) {
          return
        }

        const timestamp = Date.now()

        // 変更タイプに基づいて処理
        if (mutation.type === "childList") {
          // 追加されたノード
          if (mutation.addedNodes.length > 0) {
            processedMutations.push({
              type: "addedNodes",
              target: mutation.target,
              nodeName: mutation.target.nodeName,
              nodeType: mutation.target.nodeType,
              addedNodes: Array.from(mutation.addedNodes),
              timestamp,
            })
          }

          // 削除されたノード
          if (mutation.removedNodes.length > 0) {
            processedMutations.push({
              type: "removedNodes",
              target: mutation.target,
              nodeName: mutation.target.nodeName,
              nodeType: mutation.target.nodeType,
              removedNodes: Array.from(mutation.removedNodes),
              timestamp,
            })
          }
        } else if (mutation.type === "attributes") {
          processedMutations.push({
            type: "attributes",
            target: mutation.target,
            nodeName: mutation.target.nodeName,
            nodeType: mutation.target.nodeType,
            attributeName: mutation.attributeName,
            oldValue: mutation.oldValue || null,
            timestamp,
          })
        } else if (mutation.type === "characterData") {
          processedMutations.push({
            type: "characterData",
            target: mutation.target,
            nodeName: mutation.target.nodeName,
            nodeType: mutation.target.nodeType,
            nodeValue: mutation.target.nodeValue,
            oldValue: mutation.oldValue || null,
            timestamp,
          })
        }
      })

      return processedMutations
    },
    [mergedOptions],
  )

  // callbackを依存配列に含めるのではなく、memoizedCallbackとして再実装
  const memoizedCallback = useCallback(
    (processedMutations: MutationDetail[], observer: MutationObserver) => {
      if (callback) {
        callback(processedMutations, observer)
      }
    },
    [callback],
  )

  // handleMutations の依存配列を更新
  const handleMutations = useCallback(
    (mutationsList: MutationRecord[], observer: MutationObserver) => {
      performanceRef.current.mutationCount += mutationsList.length

      if (mergedOptions.debug) {
        console.group("MutationObserver Detected Changes")
        console.log("Raw mutations:", mutationsList)
        console.groupEnd()
      }

      // 変更の処理
      const processedMutations = processMutations(mutationsList)
      if (processedMutations.length === 0) return

      // パフォーマンスモニタリング
      if (mergedOptions.monitorPerformance) {
        const now = performance.now()
        const elapsed = now - performanceRef.current.startTime
        if (elapsed > 1000) {
          console.log(`[${mergedOptions.memoryTag}] Performance: ${performanceRef.current.mutationCount} mutations/sec`)
          performanceRef.current.startTime = now
          performanceRef.current.mutationCount = 0
        }
      }

      // デバウンス処理
      if (mergedOptions.debounceTime && mergedOptions.debounceTime > 0) {
        if (timeoutRef.current !== null) {
          window.clearTimeout(timeoutRef.current)
        }

        timeoutRef.current = window.setTimeout(() => {
          setMutations((prev) => {
            const updatedMutations = [...prev, ...processedMutations].slice(-mergedOptions.maxMutations!)

            // コールバックを実行
            memoizedCallback(processedMutations, observer)

            return updatedMutations
          })

          timeoutRef.current = null
        }, mergedOptions.debounceTime)
      } else {
        // デバウンスなし
        setMutations((prev) => {
          const updatedMutations = [...prev, ...processedMutations].slice(-mergedOptions.maxMutations!)

          // コールバックを実行
          memoizedCallback(processedMutations, observer)

          return updatedMutations
        })
      }
    },
    [
      processMutations,
      memoizedCallback,
      mergedOptions.debounceTime,
      mergedOptions.maxMutations,
      mergedOptions.debug,
      mergedOptions.monitorPerformance,
      mergedOptions.memoryTag,
    ],
  )

  // 監視の開始と停止
  useEffect(() => {
    // 対象要素の取得
    const targetElement = targetRef instanceof Element ? targetRef : targetRef?.current || null

    if (!targetElement) {
      if (mergedOptions.debug) {
        console.warn("useMutationObserver: Target element not found")
      }
      return
    }

    // オブザーバーの設定
    const observerOptions: MutationObserverInit = {
      childList: mergedOptions.childList,
      attributes: mergedOptions.attributes,
      characterData: mergedOptions.characterData,
      subtree: mergedOptions.subtree,
      attributeOldValue: mergedOptions.attributeOldValue,
      characterDataOldValue: mergedOptions.characterDataOldValue,
      attributeFilter: mergedOptions.attributeFilter,
    }

    // オブザーバーの作成
    observerRef.current = new MutationObserver(handleMutations)
    observerRef.current.observe(targetElement, observerOptions)

    // 同期的なsetStateを避けるためにマイクロタスクを使用
    queueMicrotask(() => {
      if (observerRef.current) {
        setIsObserving(true)
      }
    })

    if (mergedOptions.debug) {
      console.log(`MutationObserver started observing:`, targetElement)
    }

    // パフォーマンスモニタリングの初期化
    if (mergedOptions.monitorPerformance) {
      performanceRef.current.startTime = performance.now()
      performanceRef.current.mutationCount = 0
    }

    // クリーンアップ
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
      }

      if (observerRef.current) {
        observerRef.current.disconnect()
        setIsObserving(false)

        if (mergedOptions.debug) {
          console.log("MutationObserver disconnected")
        }
      }
    }
  }, [
    targetRef,
    handleMutations,
    mergedOptions.childList,
    mergedOptions.attributes,
    mergedOptions.characterData,
    mergedOptions.subtree,
    mergedOptions.attributeOldValue,
    mergedOptions.characterDataOldValue,
    mergedOptions.attributeFilter,
    mergedOptions.debug,
    mergedOptions.monitorPerformance,
  ])

  // 制御メソッド
  const disconnect = useCallback(() => {
    if (observerRef.current) {
      observerRef.current.disconnect()
      setIsObserving(false)
    }
  }, [])

  const reconnect = useCallback(() => {
    const targetElement = targetRef instanceof Element ? targetRef : targetRef?.current || null

    if (targetElement && observerRef.current && !isObserving) {
      const observerOptions: MutationObserverInit = {
        childList: mergedOptions.childList,
        attributes: mergedOptions.attributes,
        characterData: mergedOptions.characterData,
        subtree: mergedOptions.subtree,
        attributeOldValue: mergedOptions.attributeOldValue,
        characterDataOldValue: mergedOptions.characterDataOldValue,
        attributeFilter: mergedOptions.attributeFilter,
      }

      observerRef.current.observe(targetElement, observerOptions)
      setIsObserving(true)
    }
  }, [
    targetRef,
    isObserving,
    mergedOptions.childList,
    mergedOptions.attributes,
    mergedOptions.characterData,
    mergedOptions.subtree,
    mergedOptions.attributeOldValue,
    mergedOptions.characterDataOldValue,
    mergedOptions.attributeFilter,
  ])

  const reset = useCallback(() => {
    setMutations([])
  }, [])

  const takeSnapshot = useCallback(() => {
    return [...mutations]
  }, [mutations])

  return {
    mutations,
    lastMutation: mutations.length > 0 ? mutations[mutations.length - 1] : null,
    isObserving,
    disconnect,
    reconnect,
    reset,
    takeSnapshot,
  }
}

export default useMutationObserver
