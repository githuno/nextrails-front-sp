import { type ReactNode } from "react"

interface CarouselItemProps {
  children: ReactNode
  className?: string
}

const CarouselItem = ({ children, className = "" }: CarouselItemProps) => {
  return (
    <div
      className={`flex-none snap-start ${className}`}
      style={{
        contentVisibility: "auto", // ブラウザがコンテンツの可視性を自動的に管理
        contain: "content", // コンテンツのサイズを制御
      }}
    >
      {children}
    </div>
  )
}

export { CarouselItem }
