"use client"

import { useDnd } from "@/hooks/useDnd"
import Link from "next/link"
import React from "react"

const SimpleDndDemo: React.FC = () => {
  // 基本的なドラッグ可能なボックス
  const { ref, position, isDragging } = useDnd({
    initialPosition: { x: 100, y: 100 },
  })

  return (
    <div className="mx-auto max-w-4xl p-8">
      {/* ヘッダー */}
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">シンプルなドラッグ＆ドロップ</h1>
        <Link href="/demo/dnd" className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600">
          高度なデモへ
        </Link>
      </div>

      {/* 説明 */}
      <div className="mb-8 rounded-lg border bg-gray-50 p-4">
        <p className="text-gray-600">
          このデモでは、useDndフックの基本的な機能のみを使用しています。
          青いボックスをドラッグして動かしてみてください。
        </p>
      </div>

      {/* ドラッグエリア */}
      <div className="relative rounded-lg border bg-gray-100" style={{ height: "400px" }}>
        <div
          ref={ref as React.RefObject<HTMLDivElement>} // 型をHTMLDivElementにキャスト
          className="absolute flex items-center justify-center rounded-lg shadow-lg transition-colors select-none"
          style={{
            width: 100,
            height: 100,
            transform: `translate(${position.x}px, ${position.y}px)`,
            backgroundColor: isDragging ? "rgba(59, 130, 246, 0.8)" : "rgba(59, 130, 246, 0.6)",
            cursor: isDragging ? "grabbing" : "grab",
          }}
        >
          <div className="text-center font-bold text-white">
            <div className="text-sm">ドラッグ</div>
            <div className="mt-1 text-xs">
              {Math.round(position.x)}, {Math.round(position.y)}
            </div>
          </div>
        </div>
      </div>

      {/* 座標表示 */}
      <div className="mt-4 rounded-lg border bg-gray-50 p-4">
        <h2 className="mb-2 text-lg font-semibold">現在の位置</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-gray-600">X座標:</span>
            <span className="ml-2 font-mono">{Math.round(position.x)}px</span>
          </div>
          <div>
            <span className="text-gray-600">Y座標:</span>
            <span className="ml-2 font-mono">{Math.round(position.y)}px</span>
          </div>
        </div>
      </div>

      {/* コードサンプル */}
      <div className="mt-8">
        <h2 className="mb-2 text-lg font-semibold">使用コード</h2>
        <pre className="overflow-x-auto rounded-lg bg-gray-800 p-4 text-sm text-white">
          {`const { ref, position, isDragging } = useDnd({
  initialPosition: { x: 100, y: 100 }
});

return (
  <div
    ref={ref}
    style={{
      transform: \`translate(\${position.x}px, \${position.y}px)\`,
      cursor: isDragging ? "grabbing" : "grab",
      // ... other styles
    }}
  >
    ドラッグ可能な要素
  </div>
);`}
        </pre>
      </div>

      {/* フッター */}
      <div className="mt-8 border-t pt-4">
        <Link href="/demo" className="text-blue-500 hover:underline">
          ← デモ一覧に戻る
        </Link>
      </div>
    </div>
  )
}

export default SimpleDndDemo
