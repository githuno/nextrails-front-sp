import type { ReactNode } from "react"

interface CarouselItemProps {
  children: ReactNode
  className?: string
}

export function CarouselItem({ children, className = "" }: CarouselItemProps) {
  return (
    <div
      className={`
      snap-start flex-none
      first:pl-0 last:pr-0
      ${className}
    `}
    >
      {children}
    </div>
  )
}
