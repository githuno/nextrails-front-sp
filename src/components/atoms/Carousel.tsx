import React, { ReactNode, useLayoutEffect, useMemo, useRef, useState } from "react"

/**
 * SVGを活用してテキストをグリッド幅に完全フィットさせる
 */
const FitText = ({ children, className = "" }: { children: ReactNode; className?: string }) => {
  const textRef = useRef<SVGTextElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  useLayoutEffect(() => {
    const textEl = textRef.current
    const svgEl = svgRef.current
    if (!textEl || !svgEl) return

    const updateViewBox = () => {
      const bbox = textEl.getBBox()
      if (bbox.width > 0 && bbox.height > 0) {
        svgEl.setAttribute("viewBox", `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`)
      }
    }

    // 初期計算
    updateViewBox()

    // テキスト変更やリサイズを監視
    const observer = new ResizeObserver(updateViewBox)
    observer.observe(textEl)

    return () => observer.disconnect()
  }, [children])

  return (
    <svg ref={svgRef} className={`h-auto w-full ${className}`} preserveAspectRatio="xMidYMid meet">
      <text
        ref={textRef}
        dominantBaseline="text-before-edge"
        className="fill-current font-bold"
        style={{ fontSize: "100px" }} // ベースサイズ（viewBoxでスケーリングされる）
      >
        {children}
      </text>
    </svg>
  )
}

const PrevIcon = ({ size = "h-4 w-4", color = "text-white" }: { size?: string; color?: string }) => (
  <div className={`relative ${size}`}>
    <span
      className={`absolute top-1/2 left-1/2 h-0.5 w-2 ${color.replace("text-", "bg-")} origin-left -translate-x-1/2 -translate-y-1/2 rotate-45 transform`}
    ></span>
    <span
      className={`absolute top-1/2 left-1/2 h-0.5 w-2 ${color.replace("text-", "bg-")} origin-left -translate-x-1/2 -translate-y-1/2 -rotate-45 transform`}
    ></span>
  </div>
)

const NextIcon = ({ size = "h-4 w-4", color = "text-white" }: { size?: string; color?: string }) => (
  <div className={`relative ${size}`}>
    <span
      className={`absolute top-1/2 left-1/2 h-0.5 w-2 ${color.replace("text-", "bg-")} origin-right -translate-x-1/2 -translate-y-1/2 -rotate-45 transform`}
    ></span>
    <span
      className={`absolute top-1/2 left-1/2 h-0.5 w-2 ${color.replace("text-", "bg-")} origin-right -translate-x-1/2 -translate-y-1/2 rotate-45 transform`}
    ></span>
  </div>
)

interface CarouselProps {
  children: ReactNode
  index?: number | null
  className?: string
  containerClassName?: string
  //洗練されたプロダクトのための新プロパティ
  marquee?: boolean // 自動無限ループモード
  marqueeSpeed?: number // 一周の秒数
  marqueeDirection?: "ltr" | "rtl"
  gap?: string // アイテム間の隙間
  columnWidth?: string // アイテムの幅
  fade?: boolean // 両端のフェードアウトを有効にするか
}

interface CarouselItemProps {
  children: ReactNode
  className?: string
}

/**
 * CSS View Timelines & Viewport Masks を活用した軽量・高性能Carousel
 */
const CarouselRoot = ({
  children,
  index = null,
  className = "",
  containerClassName = "",
  marquee = false,
  marqueeSpeed = 40,
  marqueeDirection = "rtl",
  gap = "1rem",
  columnWidth = "auto",
  fade = true,
}: CarouselProps) => {
  const rootRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const isInitializedRef = useRef(false)
  const [opacity, setOpacity] = useState(0)
  const childItems = React.Children.toArray(children)

  // スクロール状態の監視（JS Stateを使わず、DOM属性値で制御）
  useLayoutEffect(() => {
    if (marquee) return
    const el = scrollRef.current
    const root = rootRef.current
    if (!el || !root) return

    const update = () => {
      root.dataset.canScrollLeft = String(el.scrollLeft > 5)
      root.dataset.canScrollRight = String(el.scrollLeft < el.scrollWidth - el.clientWidth - 5)
    }

    el.addEventListener("scroll", update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(el)

    update()
    return () => {
      el.removeEventListener("scroll", update)
      observer.disconnect()
    }
  }, [childItems.length, marquee])

  // マーキーモード用のアイテム複製
  const items = useMemo(() => {
    if (!marquee) return childItems
    return [...childItems, ...childItems] // 無限ループのために2倍にする
  }, [childItems, marquee])

  // 初期ジャンプと index 変更の追跡（ここだけはJavaScript制御）
  useLayoutEffect(() => {
    if (marquee) {
      requestAnimationFrame(() => setOpacity(1))
      return
    }
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
      const itemElements = Array.from(container.querySelectorAll("[data-carousel-item-wrapper]")) as HTMLElement[]
      const target = itemElements[index]
      if (target && target.clientWidth > 0) {
        container.scrollTo({
          left: target.offsetLeft - itemElements[0].offsetLeft,
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
  }, [index, childItems.length, marquee])

  const handleManualScroll = (direction: "left" | "right") => {
    const container = scrollRef.current
    if (!container) return
    const step = container.clientWidth
    container.scrollBy({ left: direction === "left" ? -step : step, behavior: "smooth" })
  }

  const timelines = childItems.map((_, i) => `--item-${i}`).join(", ")

  // マーキーのアニメーション幅計算用の CSS Custom Properties
  const marqueeVars = {
    "--_column-count": childItems.length,
    "--_column-width": columnWidth === "auto" ? "max(15rem, 100cqi / 5)" : columnWidth,
    "--_column-gap": gap,
    "--_duration": `${marqueeSpeed}s`,
    "--_scroller-calculated-width": `calc(var(--_column-width) * var(--_column-count) + var(--_column-gap) * var(--_column-count))`,
    "--_animation-name": marqueeDirection === "ltr" ? "carousel-marquee-ltr" : "carousel-marquee-rtl",
  } as React.CSSProperties

  const btnBgClass = fade ? "bg-black/80 shadow-2xl ring-1 ring-white/10" : "bg-black/40 shadow-lg"

  return (
    <div
      ref={rootRef}
      className={`group relative flex w-full min-w-0 flex-col overflow-hidden ${className}`}
      style={{ ...marqueeVars, timelineScope: timelines } as React.CSSProperties}
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
        @keyframes carousel-marquee-rtl {
          to { translate: calc(var(--_scroller-calculated-width) * -1) 0; }
        }
        @keyframes carousel-marquee-ltr {
          from { translate: calc(var(--_scroller-calculated-width) * -1) 0; }
          to { translate: 0 0; }
        }
        .carousel-dot {
          opacity: 0.6;
          background-color: rgba(255, 255, 255, 0.6);
          transform: scale(1);
          transition: opacity 0.2s, transform 0.2s;
        }
        .carousel-prev-btn, .carousel-next-btn {
          opacity: 0; pointer-events: none; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .carousel-prev-btn { transform: translateX(-10px); }
        .carousel-next-btn { transform: translateX(10px); }
        
        /* JS Stateを使わず属性値でボタンを制御 */
        [data-can-scroll-left="true"].group:hover .carousel-prev-btn {
          opacity: 1; pointer-events: auto; transform: translateX(0);
        }
        [data-can-scroll-right="true"].group:hover .carousel-next-btn {
          opacity: 1; pointer-events: auto; transform: translateX(0);
        }

        .carousel-mask {
          mask-image: linear-gradient(to right, transparent, black 8%, black 92%, transparent);
        }

        .marquee-scroller {
          display: grid;
          grid-auto-columns: var(--_column-width);
          grid-auto-flow: column;
          column-gap: var(--_column-gap);
          animation: var(--_animation-name) var(--_duration) linear infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .marquee-scroller {
            animation: none;
            overflow-x: auto;
          }
        }
      `}</style>

      {/* 
          Image / Content Area Wrapper 
          Buttons are absolute within this area to avoid dots.
      */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          className={`scrollbar-hide grid h-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden ${marquee ? "snap-none overflow-hidden" : ""} ${fade ? "carousel-mask" : ""}`}
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {/* Layer 1: Items */}
          <div
            className={`col-start-1 row-start-1 flex min-h-full ${index === null ? "w-fit justify-center-safe justify-self-center" : "w-full"} ${containerClassName} transition-opacity duration-300 ${marquee ? "marquee-scroller" : ""}`}
            style={{ opacity, gap: marquee || index !== null ? undefined : gap } as React.CSSProperties}
          >
            {items.map((child, idx) => {
              if (!child || !React.isValidElement(child)) return null

              const isCarouselItem = (child.type as React.ComponentType).displayName === "CarouselItem"
              const itemProps = isCarouselItem ? (child.props as CarouselItemProps) : null
              const customClassName = itemProps?.className ?? ""
              const content = itemProps ? itemProps.children : child
              const isDuplicate = idx >= childItems.length

              return (
                <div
                  key={idx}
                  data-carousel-item-wrapper
                  aria-hidden={isDuplicate ? "true" : undefined}
                  className={`relative flex-none snap-start snap-always ${index !== null ? "w-full" : "w-auto"} ${customClassName}`}
                  style={
                    {
                      viewTimelineName: !isDuplicate ? `--item-${idx}` : undefined,
                      viewTimelineAxis: "inline",
                    } as React.CSSProperties
                  }
                >
                  {content}
                </div>
              )
            })}
          </div>
        </div>

        {/* Layer 2: UI Buttons Scoped to Scroll Area */}
        {!marquee && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center">
            <div className="pl-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleManualScroll("left")
                }}
                className={`carousel-prev-btn rounded-full p-2 ${btnBgClass} active:scale-90`}
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
                className={`carousel-next-btn rounded-full p-2 ${btnBgClass} active:scale-90`}
              >
                <NextIcon />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Layer 3: Counter Section (Flow below the image area) */}
      {!marquee && childItems.length > 1 && (
        <div className="flex justify-center py-1">
          <div
            className={`flex items-center space-x-1 rounded-full px-3 py-1 blur-[0.3px] backdrop-blur-sm transition-colors ${fade ? "bg-black/70" : "bg-black/30"}`}
          >
            {childItems.map((_, idx) => (
              <div
                key={idx}
                onClick={(e) => {
                  e.stopPropagation()
                  const container = scrollRef.current
                  if (!container) return
                  const itemElements = Array.from(
                    container.querySelectorAll("[data-carousel-item-wrapper]"),
                  ) as HTMLElement[]
                  container.scrollTo({
                    left: itemElements[idx].offsetLeft - itemElements[0].offsetLeft,
                    behavior: "smooth",
                  })
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
      )}
    </div>
  )
}

/**
 * 構成パーツの公開
 */
export const Carousel = Object.assign(CarouselRoot, {
  Item: Object.assign(({ children }: CarouselItemProps) => <>{children}</>, { displayName: "CarouselItem" }),
  FitText,
})
