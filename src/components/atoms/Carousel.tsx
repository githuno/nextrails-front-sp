import React, { ReactNode, useEffect, useRef, useState } from "react"
import { NextIcon, PrevIcon } from "../Icons"

interface CarouselProps {
  children: ReactNode
  index?: number | null
  className?: string
  containerClassName?: string
  navigationClassName?: string
  autoScrollTop?: boolean
  id?: string
}

const Carousel = ({
  children,
  index = null,
  className = "",
  containerClassName = "",
  navigationClassName = "",
  autoScrollTop = false,
  id,
}: CarouselProps) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  // TODO: scroll-stateで改善可能か？ https://developer.chrome.com/blog/css-scroll-state-queries?hl=ja
  const [hasOverflow, setHasOverflow] = useState(true)
  // Counterのための状態変数-------------------------------------↓
  const [currentIndex, setCurrentIndex] = useState(0)
  const [visibleItems, setVisibleItems] = useState(1)
  // Counterのための状態変数-------------------------------------↑

  // 子要素のはみだしチェック TODO: 画像拡大時に正しく効いていなさそう
  useEffect(() => {
    const checkOverflow = () => {
      if (scrollRef.current) {
        const hasHorizontalOverflow = scrollRef.current.scrollWidth > scrollRef.current.clientWidth
        setHasOverflow(hasHorizontalOverflow)

        // Counterのための計算-------------------------------------↓
        // 可視アイテム数の計算
        const firstChild = scrollRef.current.firstChild as HTMLElement | null
        if (firstChild) {
          const visibleItemsCount = Math.floor(scrollRef.current.clientWidth / firstChild.clientWidth)
          if (visibleItemsCount > 0) {
            setVisibleItems(visibleItemsCount)
          } else {
            console.warn("Carousel: visibleItemsCount is less than 1")
            setVisibleItems(1)
          }
        }
        // Counterのための計算-------------------------------------↑
      }
    }

    checkOverflow()
    window.addEventListener("resize", checkOverflow)
    return () => window.removeEventListener("resize", checkOverflow)
  }, [children])

  // indexが指定されている場合はその位置へスクロール
  useEffect(() => {
    if (index !== null && scrollRef.current) {
      const firstChild = scrollRef.current.firstChild as HTMLElement | null
      if (firstChild) {
        scrollRef.current.scrollLeft = firstChild.clientWidth * index
      }
    }

    const currentRef = scrollRef.current

    return () => {
      if (currentRef) {
        currentRef.scrollLeft = 0
      }
    }
  }, [index])

  // 子要素変更時に先頭にスクロール
  useEffect(() => {
    if (scrollRef.current && autoScrollTop) {
      scrollRef.current.scrollLeft = 0
    }
  }, [autoScrollTop, children])

  // Counterのためのエフェクト-------------------------------------↓
  // スクロール位置の監視
  useEffect(() => {
    const handleScroll = () => {
      if (scrollRef.current) {
        const firstChild = scrollRef.current.firstChild as HTMLElement | null
        if (firstChild) {
          const currentIndex = Math.round(scrollRef.current.scrollLeft / firstChild.clientWidth)
          setCurrentIndex(currentIndex)
        }
      }
    }

    // 現在のscrollRef.currentの値をキャプチャ
    const currentRef = scrollRef.current

    if (currentRef) {
      currentRef.addEventListener("scroll", handleScroll)
    }

    return () => {
      // キャプチャした値を使用
      if (currentRef) {
        currentRef.removeEventListener("scroll", handleScroll)
      }
    }
  }, [children])
  // Counterのためのエフェクト-------------------------------------↑

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return

    const container = scrollRef.current
    const scrollMax = container.scrollWidth - container.clientWidth
    const currentScroll = container.scrollLeft
    const isNearStart = currentScroll <= container.clientWidth * 0.1 // 先頭から10%以内
    const isNearEnd = currentScroll >= scrollMax - container.clientWidth * 0.1 // 末尾から10%以内

    if (direction === "left") {
      if (isNearStart) {
        // 先頭付近なら最後尾へジャンプ
        container.scrollTo({ left: scrollMax, behavior: "smooth" })
      } else {
        // それ以外は1ページ分戻る
        container.scrollBy({
          left: -container.clientWidth,
          behavior: "smooth",
        })
      }
    } else {
      if (isNearEnd) {
        // 最後尾付近なら先頭へジャンプ
        container.scrollTo({ left: 0, behavior: "smooth" })
      } else {
        // それ以外は1ページ分進む
        container.scrollBy({ left: container.clientWidth, behavior: "smooth" })
      }
    }
  }

  return (
    <div className={`group relative max-w-full min-w-0 ${className}`}>
      <div
        ref={scrollRef}
        className={`scrollbar-hide flex snap-x snap-mandatory overflow-x-auto scroll-smooth ${containerClassName} `}
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {React.Children.map(children, (child) => (
          <div className="shrink-0 snap-start snap-always">{child}</div>
        ))}
      </div>

      {hasOverflow && (
        <div
          className={`pointer-events-none absolute top-1/2 flex w-full -translate-y-1/2 justify-between ${navigationClassName} `}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              scroll("left")
            }}
            className="pointer-events-auto rounded-full bg-black/30 p-2 opacity-0 shadow transition-colors duration-200 group-hover:opacity-100 hover:bg-black/60"
            aria-label="Previous slide"
          >
            <PrevIcon className="h-6 w-6" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              scroll("right")
            }}
            className="pointer-events-auto rounded-full bg-black/30 p-2 opacity-0 shadow transition-colors duration-200 group-hover:opacity-100 hover:bg-black/60"
            aria-label="Next slide"
          >
            <NextIcon className="h-6 w-6" />
          </button>
        </div>
      )}

      {/* Counterの表示-------------------------------------↓*/}
      <div className="py-1">
        <Counter
          totalItems={React.Children.count(children)}
          visibleItems={visibleItems}
          currentIndex={currentIndex}
          containerRef={scrollRef}
          id={id}
        />
      </div>
      {/* Counterの表示-------------------------------------↑*/}
    </div>
  )
}

export { Carousel }

interface CounterProps {
  totalItems: number
  visibleItems: number
  currentIndex: number
  containerRef?: React.RefObject<HTMLDivElement | null>
  id?: string
}

const Counter = ({ totalItems, visibleItems, currentIndex, containerRef, id }: CounterProps) => {
  const circles = Array.from({ length: totalItems }, (_, index) => (
    <div
      key={id ? id + index : index}
      className={`mx-1 h-2 w-2 cursor-pointer rounded-full ${
        index >= currentIndex && index < currentIndex + visibleItems ? "bg-blue-400" : "bg-gray-400"
      }`}
      onClick={() => {
        // クリックでスクロール
        if (containerRef) {
          const container = containerRef.current
          if (container) {
            const firstChild = container.firstChild as HTMLElement | null
            if (firstChild) {
              container.scrollTo({
                left: firstChild.clientWidth * index,
                behavior: "smooth",
              })
            }
          }
        }
      }}
    />
  ))

  return <div className="mt-2 flex justify-center">{circles}</div>
}
