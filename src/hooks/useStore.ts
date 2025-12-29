// Must：汎用化してuseStateのように使えるようにする

import { objUt } from "@/utils/objectUtils"
import { pubSub } from "@/utils/pubsub"

// イベントマップ拡張（pubsub.tsのEventMapに追加する必要があります）
// EventMapインターフェースに以下の定義を追加してください
// "store:state:updated": { state: StoreState };
// "store:message:updated": { message: string };

// ストア型定義
export interface Point {
  // Pointの型定義（必要に応じて定義してください）
  x: number
  y: number
}

export interface StoreState {
  points: Point[]
  isLoading: boolean
  message: string
}

// 初期ストア状態
const initialState: StoreState = {
  points: [],
  isLoading: false,
  message: "",
}

// シングルトンストア状態
let storeState: StoreState = objUt.deepClone(initialState)

// ストア操作ユーティリティ
const storeUtils = {
  // 現在の状態を取得
  getState: (): StoreState => objUt.deepClone(storeState),

  // 状態を更新し、イベントを発行
  setState: (updater: (state: StoreState) => void) => {
    // 前の状態のコピーを保存
    const prevState = objUt.deepClone(storeState)

    // 状態を更新
    const nextState = objUt.deepClone(storeState)
    updater(nextState)
    storeState = nextState

    // 更新されたことを通知
    pubSub.emit("store:state:updated", { state: objUt.deepClone(storeState) })

    // 特定のフィールドが変更された場合、個別のイベントも発行
    if (prevState.message !== storeState.message) {
      pubSub.emit("store:message:updated", { message: storeState.message })
    }

    return storeState
  },

  // ストアをリセット
  resetStore: () => {
    storeState = objUt.deepClone(initialState)
    pubSub.emit("store:state:updated", { state: objUt.deepClone(storeState) })
  },
}

// カスタムフックの拡張
export function useStore() {
  const { subscribe, publish } = usePubSub()
  const [state, setState] = useState<StoreState>(storeUtils.getState())

  // ストア状態の変更を購読
  useEffect(() => {
    const unsubscribe = subscribe("store:state:updated", ({ state: newState }) => {
      setState(newState)
    })

    return unsubscribe
  }, [subscribe])

  // メッセージを設定する関数
  const setMessage = useCallback((message: string) => {
    storeUtils.setState((state) => {
      state.message = message
    })
  }, [])

  // 点を追加する関数
  const addPoint = useCallback(
    async (point: Point) => {
      const currentState = storeUtils.getState()

      if (!currentState.isLoading) {
        setMessage("Job completed after 3 seconds. You can click again.")
        setState({
          ...currentState,
          isLoading: true,
          message: "Job in progress...",
        })

        await new Promise((resolve) => {
          // 10秒間のジョブをエミュレート
          setTimeout(() => {
            resolve(undefined)
          }, 3000)
        }).then(() => {
          storeUtils.setState((state) => {
            state.points.push(point)
            setState({
              points: [...state.points, point],
              isLoading: false,
              message: state.message,
            })
          })
        })
      } else {
        setMessage("Not now, my friend. I'm busy.")
      }
    },
    [setMessage],
  )

  return {
    ...state,
    addPoint,
    setMessage,
  }
}

// 上記のすべての機能をインポートするため
import { usePubSub } from "@/hooks/usePubSub"
import { useCallback, useEffect, useState } from "react"
