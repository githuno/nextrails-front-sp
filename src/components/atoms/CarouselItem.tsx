import { type ReactNode } from "react";

interface CarouselItemProps {
  children: ReactNode;
  className?: string;
}

const CarouselItem = ({ children, className = "" }: CarouselItemProps) => {
  return <div className={`snap-start flex-none ${className} `}>{children}</div>;
};

export { CarouselItem };
