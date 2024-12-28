import Image from "next/image"
import { useState } from "react"

const ListMenuItem = ({
  icon,
  text,
  href,
  onClick,
}: {
  icon: string
  text: string
  href?: string
  onClick?: (e: React.MouseEvent) => void
}) => {
  return (
    <li onClick={onClick} className="flex items-center gap-2 self-stretch p-2 hover:bg-blue-500">
      <Image src={`/images/${icon}.svg`} alt={icon} width={24} height={24} />
      {href ? <a href={href}>{text}</a> : <span>{text}</span>}
    </li>
  )
}

const ListMenu = ({ children }: { children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div
      className="relative inline-block cursor-pointer"
      onMouseOver={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <div className={`rounded-sm p-1 ${isOpen ? "bg-gray-200" : ""}`}>
        <Image src={`/images/more_horiz.svg`} alt="more_horiz" width={24} height={24} />
      </div>
      {isOpen && (
        <ul className="absolute right-0 z-10 flex w-[224px] flex-col items-start self-stretch rounded bg-gray-900 text-white shadow-xl">
          {children}
        </ul>
      )}
    </div>
  )
}

export { ListMenu, ListMenuItem }
