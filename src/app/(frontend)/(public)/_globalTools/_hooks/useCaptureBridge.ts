import { useCallback, useMemo, useSyncExternalStore } from "react"

/**
 * BridgeData
 * ツールからブリッジを流れるデータの統一形式
 */
export type BridgeData =
  | { type: "image"; blob: Blob; url: string }
  | { type: "video"; blob: Blob; url: string }
  | { type: "audio"; blob: Blob; url: string }
  | { type: "qr"; data: string }
  | { type: "file"; files: File[] }

/**
 * CaptureTarget
 * ページ側でメディアを待ち受けるコンポーネントの定義
 */
export type CaptureTarget = {
  id: string
  label: string
  /** 受け入れ可能なデータ型のリスト。未指定なら全て受け入れる */
  accepts?: Array<BridgeData["type"]>
  /** トーストのボタンが押された時に実行される任意の処理 (Canvas描画, API送信など) */
  onApply: (data: BridgeData) => void | Promise<void>
}

interface CaptureBridgeState {
  targets: CaptureTarget[]
  activeTargetId: string | null
}

let state: CaptureBridgeState = {
  targets: [],
  activeTargetId: null,
}

const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const notify = () => listeners.forEach((l) => l())

export const captureBridge = {
  getSnapshot: () => state,
  getServerSnapshot: () => state,

  /**
   * ターゲット（入力欄、Canvas、API連携コンポーネントなど）を登録する
   */
  register: (target: CaptureTarget) => {
    const exists = state.targets.find((t) => t.id === target.id)
    let targetsChanged = false
    if (exists) {
      if (
        exists.label !== target.label ||
        exists.onApply !== target.onApply ||
        JSON.stringify(exists.accepts) !== JSON.stringify(target.accepts)
      ) {
        state = {
          ...state,
          targets: state.targets.map((t) => (t.id === target.id ? target : t)),
        }
        targetsChanged = true
      }
    } else {
      state = {
        ...state,
        targets: [...state.targets, target],
      }
      targetsChanged = true
    }

    // 登録されたものをアクティブにする（既にアクティブなら通知をスキップ）
    if (state.activeTargetId !== target.id) {
      state = {
        ...state,
        activeTargetId: target.id,
      }
      notify()
    } else if (targetsChanged) {
      notify()
    }
  },

  /**
   * ターゲットの登録を解除する
   */
  unregister: (id: string) => {
    const exists = state.targets.find((t) => t.id === id)
    if (!exists) return

    state = {
      ...state,
      targets: state.targets.filter((t) => t.id !== id),
      activeTargetId: state.activeTargetId === id ? null : state.activeTargetId,
    }
    notify()
  },

  /**
   * 特定のターゲットを「今メディアを受け取りたいもの」としてアクティブにする
   */
  setActive: (id: string) => {
    if (state.activeTargetId === id) return
    state = {
      ...state,
      activeTargetId: id,
    }
    notify()
  },

  /**
   * 特定のデータ型を受け入れ可能なアクティブターゲットを取得
   */
  getActiveTargetFor: (type: BridgeData["type"]) => {
    const target = state.targets.find((t) => t.id === state.activeTargetId)
    if (!target) return null
    if (target.accepts && !target.accepts.includes(type)) return null
    return target
  },

  /**
   * テスト用に状態をリセットする
   */
  _internal_reset: () => {
    state = {
      targets: [],
      activeTargetId: null,
    }
    notify()
  },
}

export function useCaptureTarget(target: CaptureTarget | null) {
  const bridgeState = useSyncExternalStore(subscribe, captureBridge.getSnapshot, captureBridge.getServerSnapshot)

  const register = useCallback(() => {
    if (target) captureBridge.register(target)
  }, [target])

  const unregister = useCallback(() => {
    if (target) captureBridge.unregister(target.id)
  }, [target])

  const setActive = useCallback(() => {
    if (target) captureBridge.setActive(target.id)
  }, [target])

  const isActive = target ? bridgeState.activeTargetId === target.id : false

  return useMemo(
    () => ({
      isActive,
      register,
      unregister,
      setActive,
    }),
    [isActive, register, unregister, setActive],
  )
}
