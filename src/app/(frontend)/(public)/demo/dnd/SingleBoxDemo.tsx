import { useDnd } from "@/hooks/useDnd"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"

interface MetricsUpdater {
  onDragStart: () => void
  onDragEnd: () => void
}
// メモ化されたSingleBoxDemoコンポーネント
const SingleBoxDemoComponent = ({
  containerRef,
  useRaf,
  debounceMs,
  selectedConstraint,
  metricsUpdater,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>
  useRaf: boolean
  debounceMs: number
  selectedConstraint: string
  metricsUpdater: MetricsUpdater
}) => {
  const renderUpdatedRef = useRef(false)
  const [boxEnabled, setBoxEnabled] = useState(true)
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null)

  // containerRef の値を state に保存
  useEffect(() => {
    const updateContainerSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    }

    updateContainerSize()

    window.addEventListener("resize", updateContainerSize)
    return () => {
      window.removeEventListener("resize", updateContainerSize)
    }
  }, [containerRef])

  // 境界制約を計算（ref を参照しない）
  const boundaries = useMemo<any>(() => {
    if (selectedConstraint === "parent" && containerSize) {
      return {
        minX: 0,
        maxX: containerSize.width - 100,
        minY: 0,
        maxY: containerSize.height - 100,
      }
    } else if (selectedConstraint === "window") {
      return {
        minX: 0,
        maxX: window.innerWidth - 100,
        minY: 0,
        maxY: window.innerHeight - 100,
      }
    } else if (selectedConstraint === "custom") {
      return { minX: 50, maxX: 500, minY: 50, maxY: 300 }
    }
    return undefined
  }, [selectedConstraint, containerSize])

  // useDndフックの使用 - refを取得して使用する
  const { ref, position, isDragging, enable, disable, setPosition } = useDnd<HTMLDivElement>({
    initialPosition: { x: 100, y: 100 },
    enabled: boxEnabled,
    useRaf,
    debounceMs: debounceMs > 0 ? debounceMs : undefined,
    boundaries,
    onDragStart: metricsUpdater.onDragStart,
    onDragEnd: metricsUpdater.onDragEnd,
  })

  // レンダリングカウント - useEffectに移動して1回だけカウント
  useEffect(() => {
    if (!renderUpdatedRef.current) {
      // renderCountRef.current++; // 外部参照をpropsで渡す
      renderUpdatedRef.current = true
    }
  }, [])

  // デバッグ用のuseEffect
  useEffect(() => {
    console.log("%c[SingleBoxDemo] Render", "color: blue")
    console.log("isDragging:", isDragging)
    console.log("position:", position)
    console.log("boxEnabled:", boxEnabled)

    // ドラッグ開始時のコントローラー状態を確認
    const checkControllerRef = () => {
      if (ref.current) {
        console.log("%c[Debug] Current transform:", "color: green", ref.current.style.transform)
      }
    }

    // 5ms後に実行して、DOMの更新を確認
    setTimeout(checkControllerRef, 5)
  }, [isDragging, position, boxEnabled, ref])

  // 手動位置設定
  const resetPosition = useCallback(() => {
    setPosition({ x: 100, y: 100 })
  }, [setPosition])

  const moveRandomly = useCallback(() => {
    if (containerRef.current) {
      const maxX = containerRef.current.clientWidth - 100
      const maxY = containerRef.current.clientHeight - 100
      setPosition({
        x: Math.random() * maxX,
        y: Math.random() * maxY,
      })
    }
  }, [containerRef, setPosition])

  return (
    <div className="relative h-full">
      <div
        ref={ref as React.RefObject<HTMLDivElement>}
        className={`absolute flex items-center justify-center rounded-lg shadow-lg transition-colors select-none ${isDragging ? "shadow-xl" : ""}`}
        style={{
          width: 100,
          height: 100,
          transform: `translate(${position.x}px, ${position.y}px)`,
          backgroundColor: isDragging ? "rgba(59, 130, 246, 0.8)" : "rgba(59, 130, 246, 0.6)",
          cursor: boxEnabled ? (isDragging ? "grabbing" : "grab") : "not-allowed",
          zIndex: isDragging ? 50 : 10,
        }}
      >
        <div className="text-center font-bold text-white">
          <div>ドラッグ</div>
          <div className="mt-1 text-xs">
            {Math.round(position.x)}, {Math.round(position.y)}
          </div>
        </div>
      </div>

      {/* ボタン類 - 操作を追加 */}
      <div className="absolute bottom-4 left-4 flex space-x-2">
        <button
          onClick={() => {
            if (boxEnabled) {
              disable()
            } else {
              enable()
            }
            setBoxEnabled(!boxEnabled)
          }}
          className={`rounded px-3 py-1 text-xs ${
            boxEnabled ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-green-100 text-green-700 hover:bg-green-200"
          }`}
        >
          {boxEnabled ? "無効化" : "有効化"}
        </button>
        <button
          onClick={resetPosition}
          className="rounded bg-gray-100 px-3 py-1 text-xs text-gray-700 hover:bg-gray-200"
        >
          リセット
        </button>
        <button
          onClick={moveRandomly}
          className="rounded bg-purple-100 px-3 py-1 text-xs text-purple-700 hover:bg-purple-200"
        >
          ランダム移動
        </button>
      </div>
    </div>
  )
}

export const SingleBoxDemo = React.memo(SingleBoxDemoComponent)
