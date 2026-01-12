import React, { ReactNode, useLayoutEffect, useRef, useState } from "react"

const PrevIcon = () => (
  <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
  </svg>
)

const NextIcon = () => (
  <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
  </svg>
)

interface CarouselProps {
  children: ReactNode
  index?: number | null
  className?: string
  containerClassName?: string
}

interface CarouselItemProps {
  children: ReactNode
  className?: string
}

/**
 * CSS View Timelines (Chrome 115+) を活用した軽量Carousel
 */
const CarouselRoot = ({ children, index = null, className = "", containerClassName = "" }: CarouselProps) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const isInitializedRef = useRef(false)
  const [opacity, setOpacity] = useState(0)
  const childItems = React.Children.toArray(children)

  // 初期ジャンプと index 変更の追跡（ここだけはJavaScript制御）
  useLayoutEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const performJump = () => {
      if (index === null) {
        if (!isInitializedRef.current) {
          isInitializedRef.current = true
          requestAnimationFrame(() => setOpacity(1))
        }
        return
      }
      const items = Array.from(container.querySelectorAll("[data-carousel-item-wrapper]")) as HTMLElement[]
      const target = items[index]
      if (target && target.clientWidth > 0) {
        container.scrollTo({
          left: target.offsetLeft - items[0].offsetLeft,
          behavior: isInitializedRef.current ? "smooth" : ("instant" as ScrollBehavior),
        })
        if (!isInitializedRef.current) {
          isInitializedRef.current = true
          requestAnimationFrame(() => setOpacity(1))
        }
      } else {
        requestAnimationFrame(performJump)
      }
    }
    performJump()
  }, [index, childItems.length])

  // 手動スクロール処理
  const handleManualScroll = (direction: "left" | "right") => {
    const container = scrollRef.current
    if (!container) return
    const step = container.clientWidth
    container.scrollBy({ left: direction === "left" ? -step : step, behavior: "smooth" })
  }

  const timelines = childItems.map((_, i) => `--item-${i}`).join(", ")

  return (
    <div
      className={`group relative flex w-full min-w-0 flex-col ${className}`}
      style={{ timelineScope: timelines } as React.CSSProperties}
    >
      <style>{`
        @keyframes dot-sync {
          0.1%, 99.9% { 
            opacity: 1; 
            transform: scale(1.1); 
            background-color: white; 
            box-shadow: 0 0 4px white;
          }
        }
        .carousel-dot {
          opacity: 0.6;
          background-color: rgba(255, 255, 255, 0.6);
          transform: scale(1);
          transition: opacity 0.2s, transform 0.2s;
        }
        .carousel-prev-btn, .carousel-next-btn {
          opacity: 0; pointer-events: none; transition: opacity 0.2s;
        }
        /* スクロール可能な場合のみ、親のホバーに応じて表示 */
        @container carousel (scroll-state(scrollable: inline-start)) { 
          .group:hover .carousel-prev-btn { opacity: 1; pointer-events: auto; } 
        }
        @container carousel (scroll-state(scrollable: inline-end)) { 
          .group:hover .carousel-next-btn { opacity: 1; pointer-events: auto; } 
        }
        /* Fallback: scroll-state非対応ブラウザ(Chrome 125未満)ではホバーで常に表示 */
        @supports not (container-type: scroll-state) {
          .group:hover .carousel-prev-btn, .group:hover .carousel-next-btn {
            opacity: 0.6; pointer-events: auto;
          }
        }
      `}</style>

      <div
        ref={scrollRef}
        className="scrollbar-hide @container-[scroll-state] grid h-full snap-x snap-mandatory overflow-x-auto [container-name:carousel]"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {/* Layer 1: Items */}
        <div
          className={`col-start-1 row-start-1 flex ${index !== null ? "w-full" : "w-fit"} ${containerClassName} transition-opacity duration-300`}
          style={{ opacity }}
        >
          {React.Children.map(children, (child, idx) => {
            if (!child || !React.isValidElement(child)) return null

            // child が CarouselItem だった場合はその props を引き継ぐ
            const isCarouselItem = (child.type as React.ComponentType).displayName === "CarouselItem"
            const itemProps = isCarouselItem ? (child.props as CarouselItemProps) : null
            const customClassName = itemProps?.className ?? ""
            const content = itemProps ? itemProps.children : child

            return (
              <div
                key={idx}
                data-carousel-item-wrapper
                className={`relative h-full flex-none snap-start snap-always ${index !== null ? "w-full" : "w-auto"} ${customClassName}`}
                style={
                  {
                    viewTimelineName: `--item-${idx}`,
                    viewTimelineAxis: "inline",
                  } as React.CSSProperties
                }
              >
                {content}
              </div>
            )
          })}
        </div>

        {/* Layer 2: UI Overlays */}
        <div className="pointer-events-none sticky inset-0 z-30 col-start-1 row-start-1 flex h-full w-full items-center">
          <div className="pl-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleManualScroll("left")
              }}
              className="carousel-prev-btn rounded-full bg-black/30 p-2 shadow-lg hover:bg-black/60 active:scale-90"
            >
              <PrevIcon />
            </button>
          </div>

          <div className="ml-auto pr-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleManualScroll("right")
              }}
              className="carousel-next-btn rounded-full bg-black/30 p-2 shadow-lg hover:bg-black/60 active:scale-90"
            >
              <NextIcon />
            </button>
          </div>

          {/* Counter Section */}
          <div className="absolute inset-x-0 bottom-0 flex justify-center">
            <div className="pointer-events-auto flex items-center space-x-2 rounded-full bg-black/30 px-3 py-2 blur-[0.3px] backdrop-blur-sm">
              {childItems.length > 1 &&
                childItems.map((_, idx) => (
                  <div
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation()
                      const container = scrollRef.current
                      if (!container) return
                      const items = Array.from(
                        container.querySelectorAll("[data-carousel-item-wrapper]"),
                      ) as HTMLElement[]
                      container.scrollTo({ left: items[idx].offsetLeft - items[0].offsetLeft, behavior: "smooth" })
                    }}
                    className="carousel-dot h-1.5 w-1.5 cursor-pointer rounded-full"
                    style={
                      {
                        animationName: "dot-sync",
                        animationFillMode: "both",
                        animationTimeline: `--item-${idx}`,
                        viewTimelineAxis: "inline",
                      } as React.CSSProperties
                    }
                  />
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export const Carousel = Object.assign(CarouselRoot, {
  Item: ({ children }: CarouselItemProps) => {
    return <>{children}</>
  },
})
