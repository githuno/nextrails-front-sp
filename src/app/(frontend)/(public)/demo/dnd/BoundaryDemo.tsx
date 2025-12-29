import { DragBoundaries, useDnd } from "@/hooks/useDnd"
import React, { useCallback, useEffect, useMemo, useState } from "react"

interface MetricsUpdater {
  onDragStart: () => void
  onDragEnd: () => void
}

interface BoundaryDemoProps {
  containerRef: React.RefObject<HTMLDivElement | null>
  useRaf: boolean
  debounceMs: number
  selectedConstraint: string
  metricsUpdater: MetricsUpdater
}

const BOUNDARY_DEBUG = false // デバッグログを無効化

const BoundaryDemoComponent = ({
  containerRef,
  useRaf, // 親から渡された値を使用
  debounceMs, // 親から渡された値を使用
  selectedConstraint,
  metricsUpdater,
}: BoundaryDemoProps) => {
  const boxSize = 100 // ボックスのサイズを固定値で定義

  // 機能を切り替えるトグル（有効/無効）
  const [isDragEnabled, setIsDragEnabled] = useState(true)
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

  // 現在の制約に基づいて境界を計算（ref を参照しない）
  const boundaries = useMemo((): DragBoundaries | undefined => {
    if (selectedConstraint === "parent" && containerSize) {
      return {
        minX: 0,
        maxX: containerSize.width - boxSize,
        minY: 0,
        maxY: containerSize.height - boxSize,
      }
    } else if (selectedConstraint === "window") {
      return {
        minX: 0,
        maxX: window.innerWidth - boxSize,
        minY: 0,
        maxY: window.innerHeight - boxSize,
      }
    } else if (selectedConstraint === "custom") {
      return { minX: 50, maxX: 600, minY: 50, maxY: 400 }
    }
    return undefined
  }, [selectedConstraint, boxSize, containerSize])

  // useDndフックの使用 - 親からの設定を使用
  const { ref, position, isDragging, enable, disable, setPosition } = useDnd<HTMLDivElement>({
    initialPosition: { x: 100, y: 100 },
    enabled: isDragEnabled,
    useRaf, // 親から渡されたパラメータを使用
    debounceMs: debounceMs > 0 ? debounceMs : undefined, // SingleBoxDemoと同じ方法
    boundaries,
    onDragStart: () => {
      if (BOUNDARY_DEBUG) {
        console.log("ドラッグ開始:", position, "境界:", boundaries)
      }
      metricsUpdater.onDragStart()
    },
    onDrag: () => {
      // デバッグログを最小限に
    },
    onDragEnd: () => {
      if (BOUNDARY_DEBUG) {
        console.log("ドラッグ終了:", position, "境界:", boundaries)
      }
      metricsUpdater.onDragEnd()
    },
  })

  // 境界制約変更と同時に初期位置も修正
  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectedConstraint === "custom") {
        setPosition({ x: 100, y: 100 })
      } else if (selectedConstraint === "parent" && containerRef.current) {
        const centerX = (containerRef.current.clientWidth - boxSize) / 2
        const centerY = (containerRef.current.clientHeight - boxSize) / 2
        setPosition({ x: centerX, y: centerY })
      }
    }, 50)

    return () => clearTimeout(timer)
  }, [selectedConstraint, setPosition, boxSize, containerRef])

  // 手動位置リセット
  const resetPosition = useCallback(() => {
    setPosition({ x: 100, y: 100 })
  }, [setPosition])

  // ランダム移動
  const moveRandomly = useCallback(() => {
    if (containerRef.current) {
      const maxX = containerRef.current.clientWidth - boxSize
      const maxY = containerRef.current.clientHeight - boxSize

      const randX = boundaries
        ? Math.min(Math.max(Math.random() * maxX, boundaries.minX || 0), boundaries.maxX || maxX)
        : Math.random() * maxX

      const randY = boundaries
        ? Math.min(Math.max(Math.random() * maxY, boundaries.minY || 0), boundaries.maxY || maxY)
        : Math.random() * maxY

      setPosition({ x: randX, y: randY })
    }
  }, [containerRef, setPosition, boundaries, boxSize])

  // 機能を切り替え
  const toggleDragEnabled = useCallback(() => {
    if (isDragEnabled) {
      disable()
    } else {
      enable()
    }
    setIsDragEnabled(!isDragEnabled)
  }, [isDragEnabled, enable, disable])

  return (
    <div className="relative h-full overflow-visible">
      {/* 現在の境界情報を表示（デバッグ用） */}
      {BOUNDARY_DEBUG && (
        <div className="absolute top-2 left-2 z-50 max-w-[300px] rounded bg-white/80 p-2 text-xs">
          <p>制約: {selectedConstraint}</p>
          <p>境界: {boundaries ? JSON.stringify(boundaries) : "なし"}</p>
          <p>
            位置: {Math.round(position.x)}, {Math.round(position.y)}
          </p>
        </div>
      )}

      {/* ドラッグ可能なボックス */}
      <div
        ref={ref as React.RefObject<HTMLDivElement>}
        className={`absolute flex items-center justify-center rounded-lg shadow-lg transition-colors select-none ${isDragging ? "shadow-xl" : ""}`}
        style={{
          width: boxSize,
          height: boxSize,
          transform: `translate(${position.x}px, ${position.y}px)`,
          backgroundColor: isDragging ? "rgba(59, 130, 246, 0.8)" : "rgba(59, 130, 246, 0.6)",
          cursor: isDragEnabled ? (isDragging ? "grabbing" : "grab") : "not-allowed",
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

      {/* ボタン類 */}
      <div className="absolute bottom-4 left-4 z-50 flex space-x-2">
        <button
          onClick={toggleDragEnabled}
          className={`rounded px-3 py-1 text-xs ${
            isDragEnabled
              ? "bg-red-100 text-red-700 hover:bg-red-200"
              : "bg-green-100 text-green-700 hover:bg-green-200"
          }`}
        >
          {isDragEnabled ? "無効化" : "有効化"}
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

export const BoundaryDemo = React.memo(BoundaryDemoComponent)
