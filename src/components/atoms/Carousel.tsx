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
  marquee?: boolean // 自動無限ループモード
  marqueeSpeed?: number // 一周の秒数
  marqueeDirection?: "ltr" | "rtl"
  gap?: string // アイテム間の隙間
  columnWidth?: string // アイテムの幅
  fade?: boolean // 両端のフェードアウトを有効にするか
  circularButtons?: boolean // 循環スクロール時にボタンを端で非表示にするか
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
  circularButtons = true,
}: CarouselProps) => {
  const rootRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const isInitializedRef = useRef(false)
  const [opacity, setOpacity] = useState(0)
  const childItems = useMemo(() => React.Children.toArray(children), [children])

  // ドット用と端検知用の全てのタイムライン名を結合
  // CSS仕様（[ <dashed-ident> ]#）に従い、カンマ区切りで指定します。
  const timelines = useMemo(
    () => [...childItems.map((_, i) => `--item-${i}`), "--start-sentinel", "--end-sentinel"].join(", "),
    [childItems],
  )

  // マーキーモード用のアイテム複製
  const items = useMemo(() => {
    if (!marquee) return childItems
    return [...childItems, ...childItems] // 無限ループのために2倍にする
  }, [childItems, marquee])

  // 初期ジャンプと index 変更の追跡（ここだけはJavaScript制御）
  useLayoutEffect(() => {
    if (rootRef.current) {
      rootRef.current.style.setProperty("timeline-scope", timelines)
    }
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
  }, [index, childItems.length, marquee, timelines])

  const handleManualScroll = (direction: "left" | "right") => {
    const container = scrollRef.current
    if (!container) return
    const itemElements = Array.from(container.querySelectorAll("[data-carousel-item-wrapper]")) as HTMLElement[]
    const itemWidth = itemElements[0]?.clientWidth || 0
    const step = index !== null ? container.clientWidth : itemWidth || container.clientWidth
    const currentScroll = container.scrollLeft
    const currentIndex = Math.round(currentScroll / step)
    const maxIndex = childItems.length - 1
    // 左端（最初のアイテム）でprevボタンを押した場合、右端（最後のアイテム）へジャンプ
    if (direction === "left" && currentIndex === 0) {
      container.scrollTo({ left: maxIndex * step, behavior: "smooth" })
      return
    }
    // 右端（最後のアイテム）でnextボタンを押した場合、左端（最初のアイテム）へジャンプ
    if (direction === "right" && currentIndex === maxIndex) {
      container.scrollTo({ left: 0, behavior: "smooth" })
      return
    }
    // 通常のスクロール
    container.scrollBy({ left: direction === "left" ? -step : step, behavior: "smooth" })
  }

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
      className={`group relative flex w-full min-w-0 flex-col ${className}`}
      data-carousel-root
      data-circular-buttons={circularButtons}
      style={marqueeVars}
    >
      <style>{`
        @keyframes dot-sync {
          0.1%, 99.9% { 
            opacity: 1; transform: scale(1.1); background-color: white; box-shadow: 0 0 4px white;
          }
        }
        
        /* ボタンを表示する基本アニメーション */
        @keyframes btn-show {
          0% { opacity: 0; pointer-events: none; transform: translateX(-10px); }
          100% { opacity: 1; pointer-events: auto; transform: translateX(0); }
        }
        @keyframes btn-hide {
          0% { opacity: 1; pointer-events: auto; transform: translateX(0); }
          100% { opacity: 0; pointer-events: none; transform: translateX(10px); }
        }

        @keyframes carousel-marquee-rtl { to { translate: calc(var(--_scroller-calculated-width) * -1) 0; } }
        @keyframes carousel-marquee-ltr {
          from { translate: calc(var(--_scroller-calculated-width) * -1) 0; }
          to { translate: 0 0; }
        }

        .carousel-dot {
          opacity: 0.6; background-color: rgba(255, 255, 255, 0.4);
          transition: opacity 0.2s, transform 0.2s;
        }

        /* スクロール位置に基づく表示制御 */
        .carousel-ui-wrapper {
          opacity: 0; transition: opacity 0.3s ease;
        }
        .group:hover .carousel-ui-wrapper { opacity: 1; }
        [data-carousel-root][data-test-visible] .carousel-ui-wrapper { opacity: 1; }
        
        .carousel-prev-logic {
          opacity: 0;
          pointer-events: none;
          animation: btn-show 1s linear both;
          animation-timeline: --start-sentinel;
          animation-range: exit 0% exit 20%;
        }
        .carousel-next-logic {
          opacity: 1;
          pointer-events: auto;
          animation: btn-hide 1s linear both;
          animation-timeline: --end-sentinel;
          animation-range: entry 0% entry 20%;
        }

        /* circularButtons=false の場合、ボタンを常に表示 */
        [data-carousel-root][data-circular-buttons="false"] .carousel-prev-logic,
        [data-carousel-root][data-circular-buttons="false"] .carousel-next-logic {
          opacity: 1 !important;
          pointer-events: auto !important;
          animation: none !important;
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
      `}</style>

      {/* メイン・コンテンツエリア（可変） */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          data-carousel-scroll
          className={`scrollbar-hide grid h-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden ${marquee ? "snap-none overflow-hidden" : ""} ${fade ? "carousel-mask" : ""}`}
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}
        >
          {/* Layer 1: Items & Sentinels */}
          <div
            className={`relative col-start-1 row-start-1 flex min-h-full ${marquee ? "marquee-scroller w-fit" : index === null ? "w-fit justify-self-center" : "w-full justify-start"} ${containerClassName} transition-opacity duration-300`}
            style={{ opacity, gap: marquee ? undefined : gap } as React.CSSProperties}
          >
            {/* Sentinels: 端の検知用 */}
            {!marquee && (
              <div
                style={{ viewTimelineName: "--start-sentinel", viewTimelineAxis: "inline" } as React.CSSProperties}
                className="pointer-events-none h-full w-10 shrink-0 opacity-0"
              />
            )}

            {items.map((child, idx) => {
              if (!child || !React.isValidElement(child)) return null
              const isCarouselItem =
                (child.type as React.ComponentType & { displayName?: string }).displayName === "CarouselItem"
              const itemProps = isCarouselItem ? (child.props as CarouselItemProps) : null
              const customClassName = itemProps?.className ?? ""
              const content = itemProps ? itemProps.children : child
              const isDuplicate = idx >= childItems.length
              return (
                <div
                  key={idx}
                  data-carousel-item-wrapper
                  aria-hidden={isDuplicate ? "true" : undefined}
                  className={`relative flex-none snap-center snap-always ${index !== null ? "w-full" : "w-auto"} ${customClassName}`}
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

            {/* 末尾の番兵：コンテンツの最後の検知用 */}
            {!marquee && (
              <div
                style={
                  {
                    viewTimelineName: "--end-sentinel",
                    viewTimelineAxis: "inline",
                  } as React.CSSProperties
                }
                className="pointer-events-none h-full w-10 shrink-0 opacity-0"
              />
            )}
          </div>
        </div>

        {/* Layer 2: UI Buttons - マスクの外側 */}
        {!marquee && (
          <div className="pointer-events-none absolute inset-0 flex items-center">
            <div className="carousel-ui-wrapper flex w-full justify-between px-2">
              <button
                data-carousel-prev
                onClick={(e) => {
                  e.stopPropagation()
                  handleManualScroll("left")
                }}
                className={`carousel-prev-logic pointer-events-auto cursor-pointer rounded-full p-2 ${btnBgClass} active:scale-95`}
              >
                <PrevIcon />
              </button>
              <button
                data-carousel-next
                onClick={(e) => {
                  e.stopPropagation()
                  handleManualScroll("right")
                }}
                className={`carousel-next-logic pointer-events-auto cursor-pointer rounded-full p-2 ${btnBgClass} active:scale-95`}
              >
                <NextIcon />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Layer 3: Dots (スクローラーの外、下部に固定配置) */}
      {!marquee && childItems.length > 1 ? (
        <div className="relative flex justify-center py-0.5">
          <div
            className={`flex items-center space-x-1.5 rounded-full px-3 py-1 blur-[0.3px] backdrop-blur-sm transition-colors ${fade ? "bg-black/70" : "bg-black/30"}`}
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
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="h-1" />
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
