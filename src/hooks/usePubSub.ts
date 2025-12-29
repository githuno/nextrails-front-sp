import { EventMap, pubSub } from "@/utils/pubsub"
import { useCallback, useEffect, useRef, useState } from "react"

/** INFO: コンテキストベースのAPIの追加必要性について
 * 以下のような場合にコンテキストベースのAPI追加の検討が有効ですが、現時点では追加の有用性はありません。
 * 
 * アプリケーション全体でのイベント管理が必要な場合
 * -- 大規模なアプリケーションで、コンポーネントツリー全体での一元的なPubSub管理が必要な場合
 * -- 特に深くネストされたコンポーネントからのイベント発行/購読が頻繁に行われる場合
 * 
 * コンポーネント間での購読状態の共有が必要な場合
 * -- 複数のコンポーネントが同じ購読セットを共有する必要がある場合
 * -- 例: ページ内の複数のウィジェットがすべて同じイベントセットを監視する場合
 * 
 * 特定の機能領域でのみPubSubを使用したい場合
 * -- アプリケーションの特定の領域でのみPubSubパターンを適用したい場合、その範囲を明示的に示せる

/**
 * PubSubイベントを簡単に購読・自動解除するためのカスタムフック
 */
export function usePubSub() {
  const subscriptionsRef = useRef<Array<() => void>>([])

  // コンポーネントがアンマウントされるときに購読を全て解除
  useEffect(() => {
    return () => {
      subscriptionsRef.current.forEach((unsubscribe) => unsubscribe())
      subscriptionsRef.current = []
    }
  }, [])

  /**
   * 既存の購読をクリアせずに単一イベントを購読する
   */
  const subscribeOne = useCallback(<K extends keyof EventMap>(event: K, callback: (data: EventMap[K]) => void) => {
    const unsubscribe = pubSub.on(event, callback)
    subscriptionsRef.current.push(unsubscribe)
    return unsubscribe
  }, [])

  /**
   * イベントを購読する（単数または複数）
   * @param clearExisting 既存の購読をクリアするかどうか（デフォルトはfalse）
   */
  const subscribe = useCallback(
    (
      eventOrSubscriptions: keyof EventMap | Array<{ event: keyof EventMap; callback: (data: any) => void }>,
      callbackOrUndefined?: (data: any) => void,
      clearExisting = false,
    ) => {
      // オプションで既存の購読をクリア
      if (clearExisting) {
        subscriptionsRef.current.forEach((unsub) => unsub())
        subscriptionsRef.current = []
      }

      // 配列の場合（複数購読）
      if (Array.isArray(eventOrSubscriptions)) {
        const unsubscribes = eventOrSubscriptions.map(({ event, callback }) => {
          const unsubscribe = pubSub.on(event, callback)
          subscriptionsRef.current.push(unsubscribe)
          return unsubscribe
        })

        // 一括解除するための関数を返す
        return () => unsubscribes.forEach((unsub) => unsub())
      }
      // 単一イベントの場合
      else if (callbackOrUndefined) {
        const event = eventOrSubscriptions as keyof EventMap
        const callback = callbackOrUndefined

        return subscribeOne(event, callback)
      }
    },
    [subscribeOne],
  )

  /**
   * すべての購読を解除する
   */
  const unsubscribeAll = useCallback(() => {
    subscriptionsRef.current.forEach((unsub) => unsub())
    subscriptionsRef.current = []
  }, [])

  /**
   * イベントを発行する
   */
  const publish = useCallback(<K extends keyof EventMap>(event: K, data: EventMap[K]) => {
    pubSub.emit(event, data)
  }, [])

  /**
   * イベント発生を待機する
   * @returns Promise<EventMap[K]>
   */
  const waitFor = useCallback(<K extends keyof EventMap>(event: K, timeout?: number) => {
    return pubSub.waitFor(event, timeout)
  }, [])

  /**
   * イベント待機の状態を管理する拡張機能
   */
  const useWaitForWithState = <K extends keyof EventMap>(
    event: K,
    onEvent: (data: EventMap[K]) => void,
    timeout?: number,
  ) => {
    const [state, setState] = useState({
      isWaiting: false,
      error: null as Error | null,
    })

    const abortControllerRef = useRef<AbortController | null>(null)

    const startWaiting = useCallback(() => {
      if (state.isWaiting) return

      setState({ isWaiting: true, error: null })

      abortControllerRef.current = new AbortController()
      const signal = abortControllerRef.current.signal

      const checkAbort = () => {
        if (signal.aborted) {
          throw new Error("Aborted")
        }
      }

      waitFor(event, timeout)
        .then((data) => {
          checkAbort()
          setState({ isWaiting: false, error: null })
          onEvent(data)
        })
        .catch((error) => {
          if (signal.aborted) return
          setState({ isWaiting: false, error })
        })
    }, [event, onEvent, timeout, state.isWaiting])

    const cancel = useCallback(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
        setState({ isWaiting: false, error: null })
      }
    }, [])

    useEffect(() => {
      startWaiting()

      return () => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort()
        }
      }
    }, [startWaiting])

    return {
      isWaiting: state.isWaiting,
      error: state.error,
      cancel,
    }
  }

  return {
    subscribe,
    subscribeOne,
    unsubscribeAll,
    publish,
    waitFor,
    useWaitForWithState,
  }
}
/* 
// useWaitForWithStateの使用例
const { isWaiting, error, cancel } = useWaitForWithState('eventName', (data) => {
  console.log('Received data:', data);
}, 5000); // 5秒のタイムアウト

if (isWaiting) {
  console.log('Waiting for event...');
}
if (error) {
  console.error('Error:', error);
}
cancel(); // 待機をキャンセル

// これで、useWaitForWithStateを使ってイベントを待機し、状態を管理することができます。
 */
