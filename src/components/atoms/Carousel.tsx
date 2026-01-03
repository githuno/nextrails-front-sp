import React, { ReactNode, useCallback, useLayoutEffect, useRef, useState } from "react"
import { NextIcon, PrevIcon } from "../Icons"

interface CarouselMetrics {
  step: number
  visibleCount: number
  scrollMax: number
}

interface CarouselProps {
  children: ReactNode
  index?: number | null
  className?: string
  containerClassName?: string
}

// TODO: scroll-stateで改善可能か？ https://developer.chrome.com/blog/css-scroll-state-queries?hl=ja

const Carousel = ({ children, index = null, className = "", containerClassName = "" }: CarouselProps) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [metrics, setMetrics] = useState<CarouselMetrics | null>(null)
  const [currentIndex, setCurrentIndex] = useState(index ?? 0)
  // 初期化完了フラグ（フラッシュ防止用）
  const [isInitialized, setIsInitialized] = useState(false)
  // プロパティ変更時の同期
  const [prevIndex, setPrevIndex] = useState<number | null>(index)
  if (index !== prevIndex) {
    setPrevIndex(index)
    setCurrentIndex(index ?? 0)
    setIsInitialized(false) // indexが変わったら再度初期化待ちにする
  }

  const getMetrics = useCallback((): CarouselMetrics | null => {
    const container = scrollRef.current
    if (!container) return null
    const items = Array.from(container.children) as HTMLElement[]
    if (items.length === 0) return null
    const first = items[0]
    const step = items.length > 1 ? items[1].offsetLeft - first.offsetLeft : first.clientWidth
    if (step <= 0) return null
    return {
      step,
      visibleCount: Math.max(1, Math.round(container.clientWidth / step)),
      scrollMax: container.scrollWidth - container.clientWidth,
    }
  }, [])

  // サイズ確定検知とイベント監視
  useLayoutEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const update = () => {
      const m = getMetrics()
      if (m) setMetrics(m)
    }
    const observer = new ResizeObserver(update)
    observer.observe(container)
    Array.from(container.children).forEach((child) => observer.observe(child))
    const handleScroll = () => {
      const m = getMetrics()
      if (m) {
        setCurrentIndex(Math.round(container.scrollLeft / m.step))
      }
    }
    container.addEventListener("scroll", handleScroll, { passive: true })
    update()
    return () => {
      observer.disconnect()
      container.removeEventListener("scroll", handleScroll)
    }
  }, [getMetrics, children])

  // 初期位置へのジャンプ
  useLayoutEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const performJump = () => {
      if (index === null) {
        setIsInitialized(true)
        return
      }
      const items = Array.from(container.children) as HTMLElement[]
      if (items.length === 0) return
      const first = items[0]
      const step = items.length > 1 ? items[1].offsetLeft - first.offsetLeft : first.clientWidth
      if (step > 0) {
        // 描画前に物理的に位置をセット
        container.scrollTo({ left: step * index, behavior: "instant" as ScrollBehavior })
        setIsInitialized(true)
      } else {
        // まだDOMのサイズが出ていない場合は次フレームで再試行
        requestAnimationFrame(performJump)
      }
    }
    performJump()
  }, [index, children])

  const scroll = (direction: "left" | "right") => {
    const container = scrollRef.current
    if (!container || !metrics) return
    const pageSize = metrics.step * Math.max(1, metrics.visibleCount)
    if (direction === "left") {
      if (container.scrollLeft <= 10) {
        container.scrollTo({ left: metrics.scrollMax, behavior: "smooth" })
      } else {
        container.scrollBy({ left: -pageSize, behavior: "smooth" })
      }
    } else {
      if (container.scrollLeft >= metrics.scrollMax - 10) {
        container.scrollTo({ left: 0, behavior: "smooth" })
      } else {
        container.scrollBy({ left: pageSize, behavior: "smooth" })
      }
    }
  }

  const childItems = React.Children.toArray(children)
  const hasOverflow = (metrics?.scrollMax ?? 0) > 5
  const visibleItems = metrics?.visibleCount ?? 1
  const itemWrapperClassName =
    index !== null
      ? "h-full min-w-full shrink-0 snap-start snap-always"
      : "h-full min-w-0 shrink-0 snap-start snap-always"

  return (
    <div className={`group relative flex h-full w-full max-w-full min-w-0 flex-col ${className}`}>
      <div
        ref={scrollRef}
        // ジャンプが完了するまで opacity-0 にすることで1枚目のチラつきを排除
        className={`scrollbar-hide flex snap-x snap-mandatory overflow-x-auto ${containerClassName} ${isInitialized ? "opacity-100" : "opacity-0"} transition-opacity duration-0`}
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {childItems.map((child, idx) => (
          <div key={idx} className={itemWrapperClassName}>
            {child}
          </div>
        ))}
      </div>

      {hasOverflow && isInitialized && (
        <div className="pointer-events-none absolute top-1/2 z-30 flex w-full -translate-y-1/2 justify-between px-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              scroll("left")
            }}
            className="pointer-events-auto rounded-full bg-black/30 p-2 text-white opacity-0 shadow transition-colors duration-0 group-hover:opacity-100 hover:bg-black/60"
          >
            <PrevIcon className="h-6 w-6" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              scroll("right")
            }}
            className="pointer-events-auto rounded-full bg-black/30 p-2 text-white opacity-0 shadow transition-colors duration-0 group-hover:opacity-100 hover:bg-black/60"
          >
            <NextIcon className="h-6 w-6" />
          </button>
        </div>
      )}

      <div className="absolute bottom-0 left-1/2 z-20 -translate-x-1/2 transform">
        <Counter
          totalItems={childItems.length}
          visibleItems={visibleItems}
          currentIndex={currentIndex}
          containerRef={scrollRef}
          step={metrics?.step ?? 0}
        />
      </div>
    </div>
  )
}

export { Carousel }

interface CounterProps {
  totalItems: number
  visibleItems: number
  currentIndex: number
  containerRef?: React.RefObject<HTMLDivElement | null>
  step: number
}

const Counter = ({ totalItems, visibleItems, currentIndex, containerRef, step }: CounterProps) => {
  if (totalItems <= visibleItems) return null

  return (
    <div className="rounded-full bg-black/50 px-3 py-2 backdrop-blur-sm">
      <div className="flex justify-center space-x-2">
        {Array.from({ length: totalItems }, (_, index) => (
          <div
            key={index}
            onClick={() => {
              const container = containerRef?.current
              if (container && step > 0) {
                container.scrollTo({
                  left: step * index,
                  behavior: "smooth",
                })
              }
            }}
            className={`h-1.5 w-1.5 cursor-pointer rounded-full transition-all duration-0 ${
              index >= currentIndex && index < currentIndex + visibleItems
                ? "scale-110 bg-white shadow-lg"
                : "bg-white/40 hover:bg-white/60"
            }`}
          />
        ))}
      </div>
    </div>
  )
}
