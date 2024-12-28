import React from "react"

// ListGroupItem コンポーネントのプロパティ型を定義
interface ListGroupItemProps {
  children: React.ReactNode // 子要素
  active?: boolean // アクティブ状態かどうか
  onClick?: () => void
}

// ListGroupItem コンポーネントの定義
const ListGroupItem: React.FC<ListGroupItemProps> = ({ children, active, onClick }) => {
  return (
    <li
      className={`relative flex flex-col items-start justify-center self-stretch border-b border-b-[#CFD5DD] p-4 ${active ? "bg-blue-500 text-white" : "cursor-pointer bg-white"}`}
      onClick={onClick}
    >
      {children}
    </li>
  )
}

// ListGroup コンポーネントのプロパティ型を定義
interface ListGroupProps {
  children: React.ReactNode // 子要素
}

// ListGroup コンポーネントの定義
const ListGroup: React.FC<ListGroupProps> = ({ children }) => {
  return (
    <ul className="flex flex-col items-start self-stretch overflow-auto rounded border-x border-t border-[#CFD5DD]">
      {children}
    </ul>
  )
}

export { ListGroup, ListGroupItem }
