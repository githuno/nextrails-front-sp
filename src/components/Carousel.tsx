import React, { ReactNode, useEffect, useRef, useState } from "react";
import { PrevIcon, NextIcon } from "./Icons";

interface CarouselProps {
  children: ReactNode;
  index?: number | null;
  className?: string;
  containerClassName?: string;
  navigationClassName?: string;
  autoScrollTop?: boolean;
  id?: string;
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(true);
  // Counterのための状態変数-------------------------------------↓
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleItems, setVisibleItems] = useState(1);
  // Counterのための状態変数-------------------------------------↑

  // 子要素のはみだしチェック TODO: 画像拡大時に正しく効いていなさそう
  useEffect(() => {
    const checkOverflow = () => {
      if (scrollRef.current) {
        const hasHorizontalOverflow =
          scrollRef.current.scrollWidth > scrollRef.current.clientWidth;
        setHasOverflow(hasHorizontalOverflow);

        // Counterのための計算-------------------------------------↓
        // 可視アイテム数の計算
        const firstChild = scrollRef.current.firstChild as HTMLElement | null;
        if (firstChild) {
          const visibleItemsCount = Math.floor(
            scrollRef.current.clientWidth / firstChild.clientWidth
          );
          if (visibleItemsCount > 0) {
            setVisibleItems(visibleItemsCount);
          } else {
            console.warn("Carousel: visibleItemsCount is less than 1");
            setVisibleItems(1);
          }
        }
        // Counterのための計算-------------------------------------↑
      }
    };

    checkOverflow();
    window.addEventListener("resize", checkOverflow);
    return () => window.removeEventListener("resize", checkOverflow);
  }, [children]);

  // indexが指定されている場合はその位置へスクロール
  useEffect(() => {
    if (index !== null && scrollRef.current) {
      const firstChild = scrollRef.current.firstChild as HTMLElement | null;
      if (firstChild) {
        scrollRef.current.scrollLeft = firstChild.clientWidth * index;
      }
    }
  }, [index]);

  // 子要素変更時に先頭にスクロール
  useEffect(() => {
    if (scrollRef.current && autoScrollTop) {
      scrollRef.current.scrollLeft = 0;
    }
  }, [autoScrollTop, children]);

  // Counterのためのエフェクト-------------------------------------↓
  // スクロール位置の監視
  useEffect(() => {
    const handleScroll = () => {
      if (scrollRef.current) {
        const firstChild = scrollRef.current.firstChild as HTMLElement | null;
        if (firstChild) {
          const currentIndex = Math.round(
            scrollRef.current.scrollLeft / firstChild.clientWidth
          );
          setCurrentIndex(currentIndex);
        }
      }
    };

    if (scrollRef.current) {
      scrollRef.current.addEventListener("scroll", handleScroll);
    }

    return () => {
      if (scrollRef.current) {
        scrollRef.current.removeEventListener("scroll", handleScroll);
      }
    };
  }, [children]);
  // Counterのためのエフェクト-------------------------------------↑

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;

    const container = scrollRef.current;
    const scrollMax = container.scrollWidth - container.clientWidth;
    const currentScroll = container.scrollLeft;
    const isNearStart = currentScroll <= container.clientWidth * 0.1; // 先頭から10%以内
    const isNearEnd = currentScroll >= scrollMax - container.clientWidth * 0.1; // 末尾から10%以内

    if (direction === "left") {
      if (isNearStart) {
        // 先頭付近なら最後尾へジャンプ
        container.scrollTo({ left: scrollMax, behavior: "smooth" });
      } else {
        // それ以外は1ページ分戻る
        container.scrollBy({
          left: -container.clientWidth,
          behavior: "smooth",
        });
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
          flex overflow-x-auto scrollbar-hide
          scroll-smooth snap-x snap-mandatory
          ${containerClassName}
        `}
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
          className={`
          absolute top-1/2 -translate-y-1/2 w-full
          flex justify-between pointer-events-none
          ${navigationClassName}
        `}
        >
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
            <NextIcon className="w-6 h-6" />
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
  );
};

export { Carousel };

interface CounterProps {
  totalItems: number;
  visibleItems: number;
  currentIndex: number;
  containerRef?: React.RefObject<HTMLDivElement>;
  id?: string;
}

const Counter = ({
  totalItems,
  visibleItems,
  currentIndex,
  containerRef,
  id,
}: CounterProps) => {
  const circles = Array.from({ length: totalItems }, (_, index) => (
    <div
      key={id ? id + index : index}
      className={`w-2 h-2 rounded-full mx-1 cursor-pointer ${
        index >= currentIndex && index < currentIndex + visibleItems
          ? "bg-blue-400"
          : "bg-gray-400"
      }`}
      onClick={() => {
        // クリックでスクロール
        if (containerRef) {
          const container = containerRef.current;
          if (container) {
            const firstChild = container.firstChild as HTMLElement | null;
            if (firstChild) {
              container.scrollTo({
                left: firstChild.clientWidth * index,
                behavior: "smooth",
              });
            }
          }
        }
      }}
    />
  ));

  return <div className="flex justify-center mt-2">{circles}</div>;
};
