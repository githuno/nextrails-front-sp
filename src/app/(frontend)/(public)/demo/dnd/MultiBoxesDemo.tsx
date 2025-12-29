import { useDnd, UseDndOptions } from "@/hooks/useDnd"
import React, { useEffect, useMemo, useState } from "react"

interface BoxPosition {
  id: string
  x: number
  y: number
  color: string
  size: number
  constraints?: "parent" | "window" | "custom" | "none"
  useRaf?: boolean
  debounceMs?: number
}

// DraggableBoxコンポーネント
const DraggableBoxComponent = ({
  box,
  containerRef,
  showTrail,
  displayDebugInfo,
  onDragStart,
  onDrag,
  onDragEnd,
}: {
  box: BoxPosition
  containerRef: React.RefObject<HTMLDivElement | null>
  showTrail: boolean
  displayDebugInfo: boolean
  onDragStart: (pos: any) => void
  onDrag: (pos: any) => void
  onDragEnd: (pos: any) => void
}) => {
  const [trails, setTrails] = useState<{ x: number; y: number }[]>([])
  const [localIsDragging, setLocalIsDragging] = useState(false)
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
  const boundaries = useMemo(() => {
    if (box.constraints === "parent" && containerSize) {
      return {
        minX: 0,
        maxX: containerSize.width - box.size,
        minY: 0,
        maxY: containerSize.height - box.size,
      }
    } else if (box.constraints === "window") {
      return {
        minX: 0,
        maxX: window.innerWidth - box.size,
        minY: 0,
        maxY: window.innerHeight - box.size,
      }
    } else if (box.constraints === "custom") {
      return { minX: 50, maxX: 600, minY: 50, maxY: 400 }
    }
    return undefined
  }, [box.constraints, box.size, containerSize])

  // ドラッグオプション
  const options: UseDndOptions = {
    initialPosition: { x: box.x, y: box.y },
    boundaries,
    useRaf: box.useRaf,
    debounceMs: box.debounceMs,
    onDragStart: (_pos) => {
      setLocalIsDragging(true)
      onDragStart(_pos)
    },
    onDrag: (pos) => {
      onDrag(pos)
      if (showTrail) {
        setTrails((prev) => [...prev.slice(-19), { x: pos.x, y: pos.y }])
      }
    },
    onDragEnd: (_pos) => {
      setLocalIsDragging(false)
      onDragEnd(_pos)

      if (showTrail) {
        setTimeout(() => setTrails([]), 500)
      }
    },
  }

  // useDndフック
  const { ref, position, isDragging } = useDnd<HTMLDivElement>(options)

  // isDraggingの状態変化を監視して同期
  useEffect(() => {
    setLocalIsDragging(isDragging)
  }, [isDragging])

  return (
    <>
      {/* ドラッグの軌跡 */}
      {showTrail &&
        trails.map((point, index) => (
          <div
            key={`trail-${box.id}-${index}`}
            className="absolute rounded-full opacity-30"
            style={{
              width: box.size / 3,
              height: box.size / 3,
              backgroundColor: isDragging ? "red" : "gray",
              transform: `translate(${point.x + box.size / 3}px, ${point.y + box.size / 3}px)`,
              zIndex: 5,
              transition: "opacity 1s ease",
              opacity: (index / trails.length) * 0.3,
            }}
          />
        ))}

      {/* ドラッグ可能なボックス */}
      <div
        ref={ref as React.RefObject<HTMLDivElement>}
        className={`absolute flex items-center justify-center rounded-lg shadow-md transition-colors select-none`}
        style={{
          width: box.size,
          height: box.size,
          transform: `translate(${position.x}px, ${position.y}px)`,
          backgroundColor: isDragging ? "red" : "gray",
          // localIsDragging || isDragging
          //   ? box.color.replace(")", ", 0.9)")
          //   : box.color.replace(")", ", 0.7)"),
          cursor: localIsDragging || isDragging ? "grabbing" : "grab",
          zIndex: localIsDragging || isDragging ? 50 : 10,
          pointerEvents: "auto", // これが重要
        }}
      >
        <div className="text-center font-bold text-white">
          <div className="text-xs">ID: {box.id.split("-")[1]}</div>
          {displayDebugInfo && (
            <div className="mt-1 text-xs">
              <div>
                {Math.round(position.x)}, {Math.round(position.y)}
              </div>
              <div>{localIsDragging || isDragging ? "ドラッグ中" : ""}</div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export const DraggableBox = React.memo(DraggableBoxComponent)

// メイン複数ボックスコンポーネント
export const MultiBoxesDemoComponent = ({
  boxes,
  containerRef,
  showTrail,
  displayDebugInfo,
  onDragStart,
  onDrag,
  onDragEnd,
}: {
  boxes: BoxPosition[]
  containerRef: React.RefObject<HTMLDivElement | null>
  showTrail: boolean
  displayDebugInfo: boolean
  onDragStart: (pos: any) => void
  onDrag: (pos: any) => void
  onDragEnd: (pos: any) => void
}) => {
  useEffect(() => {
    console.log("%c[MultiBoxesDemo] Render", "color: green")
    console.log("Boxes count:", boxes.length)
  }, [boxes.length])

  return (
    <div className="relative h-full">
      {boxes.map((box) => (
        <DraggableBox
          key={box.id}
          box={box}
          containerRef={containerRef}
          showTrail={showTrail}
          displayDebugInfo={displayDebugInfo}
          onDragStart={onDragStart}
          onDrag={onDrag}
          onDragEnd={onDragEnd}
        />
      ))}
    </div>
  )
}

export const MultiBoxesDemo = React.memo(MultiBoxesDemoComponent)
