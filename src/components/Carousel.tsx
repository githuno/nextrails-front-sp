import React, { ReactNode, useEffect, useRef, useState } from "react";
import { PrevIcon, ForwardIcon } from "./Icons";

interface CarouselProps {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  navigationClassName?: string;
}

export function Carousel({
  children,
  className = "",
  containerClassName = "",
  navigationClassName = "",
}: CarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(true);

  // 子要素のはみだしチェック
  useEffect(() => {
    const checkOverflow = () => {
      if (scrollRef.current) {
        const hasHorizontalOverflow = scrollRef.current.scrollWidth > scrollRef.current.clientWidth;
        setHasOverflow(hasHorizontalOverflow);
      }
    };

    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [children]);

  // 子要素変更時に先頭にスクロール
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = 0;
    }
  }, [children]);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    
    const container = scrollRef.current;
    const scrollMax = container.scrollWidth - container.clientWidth;
    const currentScroll = container.scrollLeft;
    const isNearStart = currentScroll <= container.clientWidth * 0.1; // 先頭から10%以内
    const isNearEnd = currentScroll >= scrollMax - (container.clientWidth * 0.1); // 末尾から10%以内
    
    if (direction === "left") {
      if (isNearStart) {
        // 先頭付近なら最後尾へジャンプ
        container.scrollTo({ left: scrollMax, behavior: "smooth" });
      } else {
        // それ以外は1ページ分戻る
        container.scrollBy({ left: -container.clientWidth, behavior: "smooth" });
      }
    } else {
      if (isNearEnd) {
        // 最後尾付近なら先頭へジャンプ
        container.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        // それ以外は1ページ分進む
        container.scrollBy({ left: container.clientWidth, behavior: "smooth" });
      }
    }
  };

  return (
    <div className={`relative group min-w-0 max-w-full ${className}`}>
      <div
        ref={scrollRef}
        className={`
          flex gap-x-4 overflow-x-auto scrollbar-hide
          scroll-smooth snap-x snap-mandatory
          ${containerClassName}
        `}
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {React.Children.map(children, (child) => (
          <div className="shrink-0 snap-start snap-always">
            {child}
          </div>
        ))}
      </div>

      {hasOverflow && (
        <div className={`
          absolute top-1/2 -translate-y-1/2 w-full
          flex justify-between pointer-events-none
          ${navigationClassName}
        `}>
          <button
            onClick={() => scroll("left")}
            className="
              pointer-events-auto p-2 rounded-full
              bg-black/30 shadow hover:bg-black/60
              transition-colors duration-200
              opacity-0 group-hover:opacity-100
            "
            aria-label="Previous slide"
          >
            <PrevIcon className="w-6 h-6" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="
              pointer-events-auto p-2 rounded-full
              bg-black/30 shadow hover:bg-black/60
              transition-colors duration-200
              opacity-0 group-hover:opacity-100
            "
            aria-label="Next slide"
          >
            <ForwardIcon className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  );
}