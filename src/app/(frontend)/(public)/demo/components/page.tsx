"use client"

// https://www.notion.so/CSS-1fd565e97d7c81dd96d9e57a885ac9c6
// https://claude.ai/share/c7fdc36b-82db-40f8-9187-7f99e8568cbd

import { Table } from "@/components/atoms/Table"
import { useState } from "react"

type RowData = {
  id: string
  name: string
  age: string
  job: string
}

export default function Page() {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [rows, setRows] = useState<RowData[]>([
    { id: "1", name: "山田太郎", age: "30", job: "エンジニア" },
    { id: "2", name: "佐藤花子", age: "25", job: "デザイナー" },
    { id: "3", name: "山田太郎", age: "30", job: "エンジニア" },
    { id: "4", name: "佐藤花子", age: "25", job: "デザイナー" },
    { id: "5", name: "山田太郎", age: "30", job: "エンジニア" },
    { id: "6", name: "佐藤花子", age: "25", job: "デザイナー" },
    { id: "7", name: "山田太郎", age: "30", job: "エンジニア" },
    { id: "8", name: "佐藤花子", age: "25", job: "デザイナー" },
  ])
  const [sortKey, setSortKey] = useState<keyof Omit<RowData, "id"> | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>(null)

  const handleSelect = (id: string) => {
    setSelectedIds([id])
  }

  const handleCellChange = (id: string, field: keyof Omit<RowData, "id">, value: string) => {
    setRows(rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)))
  }

  const handleSort = (key: keyof Omit<RowData, "id">) => {
    if (sortKey === key) {
      if (sortDirection === "asc") {
        setSortDirection("desc")
      } else if (sortDirection === "desc") {
        setSortKey(null)
        setSortDirection(null)
      } else {
        setSortDirection("asc")
      }
    } else {
      setSortKey(key)
      setSortDirection("asc")
    }
  }

  const sortedRows = [...rows].sort((a, b) => {
    if (!sortKey || !sortDirection) return 0

    const aValue = a[sortKey]
    const bValue = b[sortKey]

    if (sortDirection === "asc") {
      return aValue.localeCompare(bValue)
    } else {
      return bValue.localeCompare(aValue)
    }
  })

  return (
    <div className="flex h-screen items-center justify-center">
      <Table.Root selectedIds={selectedIds} onSelect={handleSelect}>
        <Table.Header>
          <Table.HeaderCell onClick={() => handleSort("name")} className={sortKey === "name" ? "bg-gray-100" : ""}>
            <div className="flex items-center gap-2">
              名前
              {sortKey === "name" && <span className="text-gray-400">{sortDirection === "asc" ? "↑" : "↓"}</span>}
            </div>
          </Table.HeaderCell>
          <Table.HeaderCell onClick={() => handleSort("age")} className={sortKey === "age" ? "bg-gray-100" : ""}>
            <div className="flex items-center gap-2">
              年齢
              {sortKey === "age" && <span className="text-gray-400">{sortDirection === "asc" ? "↑" : "↓"}</span>}
            </div>
          </Table.HeaderCell>
          <Table.HeaderCell onClick={() => handleSort("job")} className={sortKey === "job" ? "bg-gray-100" : ""}>
            <div className="flex items-center gap-2">
              職業
              {sortKey === "job" && <span className="text-gray-400">{sortDirection === "asc" ? "↑" : "↓"}</span>}
            </div>
          </Table.HeaderCell>
        </Table.Header>
        <Table.Body className="[&:has(tr:focus-within)_tr:not(:focus-within)]:opacity-50 [&:has(tr:focus-within)_tr:not(:focus-within)]:blur-[1px] [&:has(tr:focus-within)_tr:not(:focus-within)]:saturate-[0.2]">
          {sortedRows.map((row) => (
            <Table.Row
              key={row.id}
              id={row.id}
              className={` ${selectedIds.includes(row.id) ? "bg-blue-50" : ""} focus-within:bg-blue-50 focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 focus-within:outline-none`}
              tabIndex={0}
            >
              <Table.Cell>
                <input
                  type="text"
                  value={row.name}
                  onChange={(e) => handleCellChange(row.id, "name", e.target.value)}
                  className="w-full bg-transparent focus:outline-none"
                />
              </Table.Cell>
              <Table.Cell>
                <input
                  type="number"
                  value={row.age}
                  onChange={(e) => handleCellChange(row.id, "age", e.target.value)}
                  className="w-full bg-transparent focus:outline-none"
                />
              </Table.Cell>
              <Table.Cell>
                <input
                  type="text"
                  value={row.job}
                  onChange={(e) => handleCellChange(row.id, "job", e.target.value)}
                  className="w-full bg-transparent focus:outline-none"
                />
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </div>
  )
}
