import { type ReactNode } from "react"

interface CarouselItemProps {
  children: ReactNode
  className?: string
}

const CarouselItem = ({ children, className = "" }: CarouselItemProps) => {
  return <div className={`relative h-full w-full snap-start ${className}`}>{children}</div>
}

export { CarouselItem }
