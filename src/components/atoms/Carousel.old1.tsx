import React, { ReactNode, useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react"

// TODO: publicにアイコンコンポーネントを移動する
const PrevIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    className="h-4 w-4 text-white"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
  </svg>
)

const NextIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    className="h-4 w-4 text-white"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
  </svg>
)

interface CarouselMetrics {
  scrollMax: number
  itemOffsets: number[]
  viewportWidth: number
}

interface CarouselProps {
  children: ReactNode
  index?: number | null
  className?: string
  containerClassName?: string
}

type CarouselCounterState = Readonly<{
  currentIndex: number
  visibleItems: number
}>

interface CarouselCounterStore {
  getSnapshot: () => CarouselCounterState
  subscribe: (listener: () => void) => () => void
  setSnapshot: (next: CarouselCounterState) => void
}

// TODO: scroll-stateで改善可能か？ https://developer.chrome.com/blog/css-scroll-state-queries?hl=ja

const Carousel = ({ children, index = null, className = "", containerClassName = "" }: CarouselProps) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollRafIdRef = useRef<number | null>(null)
  const [metrics, setMetrics] = useState<CarouselMetrics | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  const counterStoreRef = useRef<CarouselCounterStore | null>(null)
  if (!counterStoreRef.current) {
    let snapshot: CarouselCounterState = { currentIndex: index ?? 0, visibleItems: 1 }
    const listeners = new Set<() => void>()
    counterStoreRef.current = {
      getSnapshot: () => snapshot,
      subscribe: (listener) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
      setSnapshot: (next) => {
        if (next.currentIndex === snapshot.currentIndex && next.visibleItems === snapshot.visibleItems) return
        snapshot = next
        listeners.forEach((l) => l())
      },
    }
  }
  const counterStore = counterStoreRef.current

  // index 変更はレイアウト後に同期
  useLayoutEffect(() => {
    counterStore.setSnapshot({
      currentIndex: index ?? 0,
      visibleItems: index !== null ? 1 : counterStore.getSnapshot().visibleItems,
    })
    setIsInitialized(false)
  }, [index, counterStore])

  const getMetrics = useCallback((): CarouselMetrics | null => {
    const container = scrollRef.current
    if (!container) return null
    const items = Array.from(container.children) as HTMLElement[]
    if (items.length === 0) return null
    return {
      scrollMax: container.scrollWidth - container.clientWidth,
      itemOffsets: items.map((item) => item.offsetLeft - items[0].offsetLeft),
      viewportWidth: container.clientWidth,
    }
  }, [])

  const updateStateFromScroll = useCallback(() => {
    const container = scrollRef.current
    if (!container) return
    const items = Array.from(container.children) as HTMLElement[]
    if (items.length === 0) return

    const scrollLeft = container.scrollLeft
    const viewportWidth = container.clientWidth

    // index 指定時は単純に scrollLeft / viewportWidth で currentIndex を計算
    if (index !== null) {
      const nextIndex = Math.min(items.length - 1, Math.max(0, Math.round(scrollLeft / Math.max(1, viewportWidth))))
      counterStore.setSnapshot({ currentIndex: nextIndex, visibleItems: 1 })
      return
    }

    let activeIdx = 0
    let minDistance = Infinity
    items.forEach((item, idx) => {
      const distance = Math.abs(item.offsetLeft - items[0].offsetLeft - scrollLeft)
      if (distance < minDistance) {
        minDistance = distance
        activeIdx = idx
      }
    })
    let visibleCount = 0
    items.forEach((item) => {
      const itemStart = item.offsetLeft - items[0].offsetLeft
      const itemEnd = itemStart + item.clientWidth
      const visibleWidth = Math.min(itemEnd, scrollLeft + viewportWidth) - Math.max(itemStart, scrollLeft)
      if (visibleWidth > item.clientWidth * 0.5) {
        visibleCount++
      }
    })
    counterStore.setSnapshot({ currentIndex: activeIdx, visibleItems: Math.max(1, visibleCount) })
  }, [index, counterStore])

  const scheduleUpdateStateFromScroll = useCallback(() => {
    if (scrollRafIdRef.current !== null) return
    scrollRafIdRef.current = requestAnimationFrame(() => {
      scrollRafIdRef.current = null
      updateStateFromScroll()
    })
  }, [updateStateFromScroll])

  // 初期化とイベント監視
  useLayoutEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const handleUpdate = () => {
      const m = getMetrics()
      if (m) setMetrics(m)
      updateStateFromScroll()
    }
    const observer = new ResizeObserver(handleUpdate)
    observer.observe(container)
    Array.from(container.children).forEach((child) => observer.observe(child))
    const handleScroll = () => scheduleUpdateStateFromScroll()
    container.addEventListener("scroll", handleScroll, { passive: true })

    // 即座に初期計算を実行
    handleUpdate()
    return () => {
      observer.disconnect()
      container.removeEventListener("scroll", handleScroll)
      if (scrollRafIdRef.current !== null) {
        cancelAnimationFrame(scrollRafIdRef.current)
        scrollRafIdRef.current = null
      }
    }
  }, [getMetrics, updateStateFromScroll, scheduleUpdateStateFromScroll, children])

  // 決定的な初期ジャンプ（フラッシュと遅延の完全排除）
  useLayoutEffect(() => {
    const container = scrollRef.current
    if (!container || isInitialized) return
    const performJump = () => {
      if (index === null) {
        setIsInitialized(true)
        return
      }
      const items = Array.from(container.children) as HTMLElement[]
      if (items.length === 0) return
      // ステートを介さずDOMから直接座標を取得してジャンプ
      const targetOffset = items[index]?.offsetLeft - (items[0]?.offsetLeft || 0)
      // アイテムの幅が確定していることを確認（0pxなら次フレームへ）
      if (items[0]?.clientWidth > 0) {
        container.scrollTo({ left: targetOffset, behavior: "instant" as ScrollBehavior })
        // スクロール完了後にステートを更新し、表示を開始
        updateStateFromScroll()
        setIsInitialized(true)
      } else {
        // まだDOMのサイズが出ていない場合は次フレームで再試行
        requestAnimationFrame(performJump)
      }
    }
    performJump()
  }, [index, children, isInitialized, updateStateFromScroll])

  const scroll = (direction: "left" | "right") => {
    const container = scrollRef.current
    if (!container || !metrics) return
    const { currentIndex, visibleItems } = counterStore.getSnapshot()
    if (direction === "left") {
      if (container.scrollLeft <= 10) {
        container.scrollTo({ left: metrics.scrollMax, behavior: "smooth" })
      } else {
        const targetIdx = Math.max(0, currentIndex - visibleItems)
        container.scrollTo({ left: metrics.itemOffsets[targetIdx], behavior: "smooth" })
      }
    } else {
      if (container.scrollLeft >= metrics.scrollMax - 10) {
        container.scrollTo({ left: 0, behavior: "smooth" })
      } else {
        const targetIdx = Math.min(metrics.itemOffsets.length - 1, currentIndex + visibleItems)
        container.scrollTo({ left: metrics.itemOffsets[targetIdx], behavior: "smooth" })
      }
    }
  }

  const childItems = React.Children.toArray(children)
  const hasOverflow = (metrics?.scrollMax ?? 0) > 5
  const itemWrapperClassName =
    index !== null
      ? "h-full min-w-full shrink-0 snap-start snap-always"
      : "h-full min-w-0 shrink-0 snap-start snap-always"

  return (
    <div className={`group relative flex h-full w-full max-w-full min-w-0 flex-col ${className}`}>
      <div
        ref={scrollRef}
        // ジャンプが完了するまで opacity-0 & transition-none にすることでチラつきを完全に封鎖
        className={`scrollbar-hide flex snap-x snap-mandatory overflow-x-auto ${containerClassName} ${isInitialized ? "opacity-100" : "opacity-0 transition-none"}`}
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
          store={counterStore}
          containerRef={scrollRef}
          itemOffsets={metrics?.itemOffsets ?? []}
        />
      </div>
    </div>
  )
}

const CarouselItem = ({ children, className = "" }: CarouselItemProps) => {
  return <div className={`relative h-full w-full snap-start ${className}`}>{children}</div>
}

export { Carousel, CarouselItem }

interface CounterProps {
  totalItems: number
  store: CarouselCounterStore
  containerRef?: React.RefObject<HTMLDivElement | null>
  itemOffsets: number[]
}

const Counter = ({ totalItems, store, containerRef, itemOffsets }: CounterProps) => {
  const { currentIndex, visibleItems } = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  if (totalItems <= visibleItems) return null

  return (
    <div className="rounded-full bg-black/50 px-3 py-2 backdrop-blur-sm">
      <div className="flex justify-center space-x-2">
        {Array.from({ length: totalItems }, (_, index) => (
          <div
            key={index}
            onClick={() => {
              const container = containerRef?.current
              const targetOffset = itemOffsets[index]
              if (container && targetOffset !== undefined) {
                container.scrollTo({
                  left: targetOffset,
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

interface CarouselItemProps {
  children: ReactNode
  className?: string
}
