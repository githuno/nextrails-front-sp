// https://marmelab.com/blog/2025/05/09/client-side-react-rocks.html
import { createContext, HTMLAttributes, ReactNode, useContext } from "react"

// コンテキスト定義
type TableContextType = {
  selectedIds: string[]
  onSelect: (id: string) => void
}

const TableContext = createContext<TableContextType | undefined>(undefined)

// ヘッドレスなルートコンポーネント
type TableRootProps = {
  children: ReactNode
  selectedIds: string[]
  onSelect: (id: string) => void
  className?: string
} & Omit<HTMLAttributes<HTMLTableElement>, "onClick" | "onSelect">

export const TableRoot = ({ children, selectedIds, onSelect, className, ...props }: TableRootProps) => (
  <TableContext.Provider value={{ selectedIds, onSelect }}>
    <table className={`min-w-full divide-y divide-gray-200 ${className || ""}`} {...props}>
      {children}
    </table>
  </TableContext.Provider>
)

// ヘッダーコンポーネント
type HeaderProps = HTMLAttributes<HTMLTableSectionElement> & {
  children: ReactNode
}

export const TableHeader = ({ children, className, ...props }: HeaderProps) => (
  <thead className={`bg-gray-50 ${className || ""}`} {...props}>
    <tr>{children}</tr>
  </thead>
)

// ヘッダーセルコンポーネント
type HeaderCellProps = HTMLAttributes<HTMLTableCellElement> & {
  children: ReactNode
  align?: "left" | "center" | "right"
  onClick?: () => void
}

export const TableHeaderCell = ({ children, align = "left", onClick, className, ...props }: HeaderCellProps) => (
  <th
    scope="col"
    className={`px-6 py-3 text-${align} text-xs font-medium tracking-wider text-gray-500 uppercase ${onClick ? "cursor-pointer hover:bg-gray-100" : ""} ${className || ""} `}
    onClick={onClick}
    {...props}
  >
    {children}
  </th>
)

// ボディコンポーネント
type BodyProps = HTMLAttributes<HTMLTableSectionElement> & {
  children: ReactNode
}

export const TableBody = ({ children, className, ...props }: BodyProps) => (
  <tbody className={`divide-y divide-gray-200 bg-white ${className || ""}`} {...props}>
    {children}
  </tbody>
)

// 行コンポーネント
type RowProps = HTMLAttributes<HTMLTableRowElement> & {
  id: string
  children: ReactNode
}

export const TableRow = ({ id, children, className, ...props }: RowProps) => {
  const context = useContext(TableContext)
  if (!context) throw new Error("TableRow must be used within Table")

  const { selectedIds, onSelect } = context
  const isSelected = selectedIds.includes(id)

  return (
    <tr onClick={() => onSelect(id)} className={`${isSelected ? "bg-blue-50" : ""} ${className || ""}`} {...props}>
      {children}
    </tr>
  )
}

// セルコンポーネント
type CellProps = HTMLAttributes<HTMLTableCellElement> & {
  children: ReactNode
  align?: "left" | "center" | "right"
}

export const TableCell = ({ children, align = "left", className, ...props }: CellProps) => (
  <td className={`px-6 py-4 whitespace-nowrap text-${align} ${className || ""}`} {...props}>
    {children}
  </td>
)

// エクスポート
export const Table = {
  Root: TableRoot,
  Header: TableHeader,
  HeaderCell: TableHeaderCell,
  Body: TableBody,
  Row: TableRow,
  Cell: TableCell,
}
