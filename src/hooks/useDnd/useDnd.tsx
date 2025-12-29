import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createDnd, DndController, DndOptions, Position } from "./utils/dnd"

export interface UseDndOptions extends DndOptions {
  /** コンポーネントのマウント時に自動的にドラッグを有効化するか */
  enabled?: boolean
  /** 初期位置 */
  initialPosition?: Position
  /** パフォーマンス最適化のためのdebounce遅延（ミリ秒） */
  debounceMs?: number
}

export interface UseDndResult {
  /** 要素に適用するref */
  ref: React.RefObject<HTMLElement | null>
  /** 現在の位置 */
  position: Position
  /** 位置を設定する関数 */
  setPosition: (position: Position) => void
  /** ドラッグ中かどうか */
  isDragging: boolean
  /** ドラッグを有効化 */
  enable: () => void
  /** ドラッグを無効化 */
  disable: () => void
}

/**
 * React用ドラッグアンドドロップフック
 *
 * @example
 * ```tsx
 * function DraggableBox() {
 *   const { ref, position, isDragging } = useDnd({
 *     onDragEnd: (pos) => console.log('Dragged to:', pos),
 *     boundaries: { minX: 0, minY: 0, maxX: 500, maxY: 500 }
 *   });
 *
 *   return (
 *     <div
 *       ref={ref as React.RefObject<HTMLDivElement>}
 *       style={{
 *         position: 'absolute',
 *         padding: '20px',
 *         background: isDragging ? 'lightblue' : 'lightgray',
 *         cursor: 'grab',
 *         userSelect: 'none'
 *       }}
 *     >
 *       Drag me! ({position.x.toFixed(0)}, {position.y.toFixed(0)})
 *     </div>
 *   );
 * }
 * ```
 */
export function useDnd<T extends HTMLElement = HTMLElement>(options: UseDndOptions = {}): UseDndResult {
  const { enabled = true, initialPosition = { x: 0, y: 0 }, onDragStart, onDrag, onDragEnd, ...restOptions } = options

  // DOM要素への参照
  const ref = useRef<T>(null)

  // コントローラーの参照を保持
  const controllerRef = useRef<DndController | null>(null)

  // 状態管理
  const [position, setPositionState] = useState<Position>(initialPosition)
  const [isDragging, setIsDragging] = useState<boolean>(false)

  // 前回の境界値を保持するためのref
  const prevBoundariesRef = useRef(restOptions.boundaries)

  // 位置を設定する関数
  const setPosition = useCallback((newPosition: Position) => {
    setPositionState(newPosition)
    if (controllerRef.current) {
      controllerRef.current.setPosition(newPosition)
    }
  }, [])

  // 拡張されたコールバック
  const enhancedOptions: DndOptions = useMemo(
    () => ({
      ...restOptions,
      onDragStart: (pos, event) => {
        setIsDragging(true)
        onDragStart?.(pos, event)
      },
      onDrag: (pos, event) => {
        setPositionState(pos)
        onDrag?.(pos, event)
      },
      onDragEnd: (pos, event) => {
        setIsDragging(false)
        setPositionState(pos)
        onDragEnd?.(pos, event)
      },
    }),
    [restOptions, onDragStart, onDrag, onDragEnd],
  )

  // ドラッグ有効化関数
  const enable = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.enableDrag()
    }
  }, [])

  // ドラッグ無効化関数
  const disable = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.disableDrag()
    }
  }, [])

  // コンポーネントマウント時の初期化
  useEffect(() => {
    const element = ref.current
    if (!element) return

    // 初期位置を設定
    element.style.transform = `translate(${initialPosition.x}px, ${initialPosition.y}px)`

    // コントローラーを作成
    controllerRef.current = createDnd(element, enhancedOptions)

    // 初期状態の設定
    if (!enabled && controllerRef.current) {
      controllerRef.current.disableDrag()
    }

    // クリーンアップ
    return () => {
      if (controllerRef.current) {
        controllerRef.current.cleanup()
        controllerRef.current = null
      }
    }
    // 初期化は意図的にマウント時のみ行う（依存配列は増やさない）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 境界値の変更を監視して、コントローラーを更新する新しいuseEffect
  useEffect(() => {
    // 参照比較で本当に変更があったかチェック（深い比較ではない）
    if (restOptions.boundaries !== prevBoundariesRef.current && controllerRef.current) {
      // 境界値が変更された場合のみ

      // コントローラーを境界値のみ更新する方法がないため、コントローラーを再作成
      const element = ref.current
      if (!element) return

      // オプションを更新して新しいコントローラーを用意
      const updatedOptions = {
        ...enhancedOptions,
        boundaries: restOptions.boundaries,
      }

      // ドラッグ中でなければコントローラーを再作成
      if (!isDragging) {
        // 現在のコントローラーをクリーンアップ
        controllerRef.current.cleanup()

        // 新しいコントローラーを作成
        controllerRef.current = createDnd(element, updatedOptions)

        // 有効/無効状態を維持
        if (!enabled && controllerRef.current) {
          controllerRef.current.disableDrag()
        }
      }

      // 更新された境界値を保存
      prevBoundariesRef.current = restOptions.boundaries
    }
  }, [restOptions.boundaries, enabled, isDragging, enhancedOptions])

  // enabledプロパティの変更を監視
  useEffect(() => {
    if (enabled) {
      enable()
    } else {
      disable()
    }
  }, [enabled, enable, disable])

  return {
    ref,
    position,
    setPosition,
    isDragging,
    enable,
    disable,
  }
}
