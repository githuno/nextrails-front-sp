"use client"

import { useCallback, useState } from "react"

export interface FlickGestureConfig {
  total: number
  distance: number
  startAngle: number
  sweepAngle: number
  threshold?: number
}

export interface FlickGestureResult {
  isDragging: boolean
  flickIndex: number | null
  handleTouchStart: (e: React.TouchEvent) => void
  handleTouchMove: (e: React.TouchEvent) => void
  handleTouchEnd: (onExecute?: (index: number) => void) => void
  reset: () => void
}

/**
 * フリックジェスチャーを処理するカスタムフック。
 * FABやFlickInputなど、角度ベースの選択UIで共有。
 */
export function useFlickGesture(
  config: FlickGestureConfig,
  onExpandedChange?: (expanded: boolean) => void,
): FlickGestureResult {
  const [isDragging, setIsDragging] = useState(false)
  const [flickIndex, setFlickIndex] = useState<number | null>(null)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const { total, startAngle, sweepAngle, threshold = 50 } = config
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    setStartPos({ x: touch.clientX, y: touch.clientY })
    setFlickIndex(null)
    setIsDragging(true)
  }, [])

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0]
      const dx = touch.clientX - startPos.x
      const dy = touch.clientY - startPos.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > threshold) {
        onExpandedChange?.(true)
        // 角度を度数で計算
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI
        if (total === 0) return
        const step = total > 1 ? sweepAngle / (total - 1) : 0
        let normalizedAngle = angle
        if (normalizedAngle > 0 && startAngle < 0) {
          normalizedAngle -= 360
        }
        let closestIndex = -1
        let minDiff = Infinity
        for (let i = 0; i < total; i++) {
          const itemAngle = startAngle + i * step
          const diff = Math.abs(normalizedAngle - itemAngle)
          if (diff < minDiff) {
            minDiff = diff
            closestIndex = i
          }
        }
        // 選択が意図的であることを確実にするために角度許容範囲を狭くする（30度）
        if (minDiff < 30) {
          setFlickIndex(closestIndex)
        } else {
          setFlickIndex(null)
        }
      } else {
        setFlickIndex(null)
      }
    },
    [startPos, threshold, total, startAngle, sweepAngle, onExpandedChange],
  )
  const handleTouchEnd = useCallback(
    (onExecute?: (index: number) => void) => {
      if (flickIndex !== null) {
        onExecute?.(flickIndex)
      }
      setIsDragging(false)
      setFlickIndex(null)
    },
    [flickIndex],
  )
  const reset = useCallback(() => {
    setIsDragging(false)
    setFlickIndex(null)
  }, [])
  return {
    isDragging,
    flickIndex,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    reset,
  }
}
