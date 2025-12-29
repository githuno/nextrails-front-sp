"use client"

import { useUrlState } from "@/hooks/useUrlState"
import Link from "next/link"
import { useCallback } from "react"
import { SimpleUrlState } from "./SimpleUrlState"

export default function SimpleUrlStateDemo() {
  // // 1. 最もシンプルな使用法（デフォルト値のみ）
  // const [count, setCount] = useUrlState<number>(0)
  // // const [count, setCount] = useUrlState<number>("count", 0);

  // // 2. キーを指定したシンプルな使用法
  // const [text, setText] = useUrlState<string>("textParam", "初期テキスト")

  // // 3. ブール値（toggle機能付き）
  // const [isEnabled, setIsEnabled] = useUrlState<boolean>("enabled", false)

  // // 一般的なステート（URL同期なし）
  // const [localCounter, setLocalCounter] = useState(0)

  // リンク先を修正（詳細デモへのパスを正しく設定）
  const detailDemoPath = "/demo/url"

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">useUrlState シンプルデモ</h1>
        <Link href={detailDemoPath} className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600">
          詳細デモへ
        </Link>
      </div>

      <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h2 className="mb-2 flex items-center text-lg font-semibold">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mr-2 h-5 w-5 text-blue-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          useUrlStateについて
        </h2>
        <p className="mb-2 text-sm">
          このフックを使うと、Reactの状態をURLクエリパラメータと同期させることができます。
          これにより、ページをリロードしたり共有したりしても状態が保持されます。
        </p>
        <p className="text-sm">
          このシンプルデモでは、基本的な使い方を示しています。詳細な設定や機能については
          <Link href={detailDemoPath} className="ml-1 text-blue-600 hover:underline">
            詳細デモ
          </Link>
          をご覧ください。
        </p>
      </div>

      {/* <Suspense fallback={<div className="text-center">Loading...</div>}> */}
      <SimpleUrlState />
      {/* </Suspense> */}
    </div>
  )
}

// 子コンポーネントとして分離
function MemoCounter() {
  const [memoCount, setMemoCount] = useUrlState<number>("memo", 0)

  // カウンター操作
  const countDecrement = useCallback(() => setMemoCount(memoCount - 1), [memoCount, setMemoCount])
  const countIncrement = useCallback(() => setMemoCount(memoCount + 1), [memoCount, setMemoCount])

  return (
    <div className="rounded-lg border p-4 shadow-sm">
      <h2 className="mb-3 text-xl font-semibold">メモ化した数値カウンター</h2>
      <div className="mb-4 flex items-center justify-center space-x-4">
        <button onClick={countDecrement} className="rounded bg-gray-200 px-4 py-2 hover:bg-gray-300">
          -
        </button>
        <span className="text-2xl font-bold">{memoCount}</span>
        <button onClick={countIncrement} className="rounded bg-gray-200 px-4 py-2 hover:bg-gray-300">
          +
        </button>
      </div>
      <div className="text-sm text-gray-500">
        <p>
          URLパラメータ: <code>?memo={memoCount}</code>
        </p>
      </div>
    </div>
  )
}
