"use client"

import { useUrlState } from "@/hooks/useUrlState"
import Link from "next/link"
import { useState } from "react"

export function SimpleUrlState() {
  // 1. 最もシンプルな使用法（デフォルト値のみ）
  const [count, setCount] = useUrlState<number>(0)

  // 2. キーを指定したシンプルな使用法
  const [text, setText] = useUrlState<string>("textParam", "初期テキスト")

  // 3. ブール値（toggle機能付き）
  const [isEnabled, setIsEnabled] = useUrlState<boolean>("enabled", false)

  // 一般的なステート（URL同期なし）
  const [localCounter, setLocalCounter] = useState(0)

  return (
    <>
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* 数値カウンター */}
        <div className="rounded-lg border p-4 shadow-sm">
          <h2 className="mb-3 text-xl font-semibold">数値カウンター（キーの自動生成）</h2>
          <div className="mb-4 flex items-center justify-center space-x-4">
            <button onClick={() => setCount(count - 1)} className="rounded bg-gray-200 px-4 py-2 hover:bg-gray-300">
              -
            </button>
            <span className="text-2xl font-bold">{count}</span>
            <button onClick={() => setCount(count + 1)} className="rounded bg-gray-200 px-4 py-2 hover:bg-gray-300">
              +
            </button>
          </div>
          <div className="text-sm text-gray-500">
            <p>
              URLパラメータ: <code>?urlState_xxxxxx={count}</code>
            </p>
            <p>※自動生成されたキー名が使用されます</p>
          </div>
        </div>

        {/* テキスト入力 */}
        <div className="rounded-lg border p-4 shadow-sm">
          <h2 className="mb-3 text-xl font-semibold">テキスト入力</h2>
          <div className="mb-4">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full rounded border p-2"
              placeholder="テキストを入力"
            />
          </div>
          <div className="text-sm text-gray-500">
            <p>
              URLパラメータ: <code>?textParam={text}</code>
            </p>
            <p>※指定したキー名が使用されます</p>
          </div>
        </div>

        {/* 切り替えスイッチ */}
        <div className="rounded-lg border p-4 shadow-sm">
          <h2 className="mb-3 text-xl font-semibold">切り替えスイッチ</h2>
          <div className="mb-4 flex items-center space-x-4">
            <div className="flex items-center">
              <button
                onClick={() => setIsEnabled.toggle()}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  isEnabled ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <span className="ml-2">{isEnabled ? "有効" : "無効"}</span>
            </div>
            <button
              onClick={() => setIsEnabled(isEnabled ? false : true)}
              className={`px-2 py-1 text-xs ${
                isEnabled ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
              } rounded`}
            >
              {isEnabled ? "無効化" : "有効化"}
            </button>
          </div>
          <div className="text-sm text-gray-500">
            <p>
              URLパラメータ: <code>?enabled={isEnabled.toString()}</code>
            </p>
            <p>
              ※ブール値には<code>toggle()</code>メソッドが利用可能
            </p>
          </div>
        </div>

        {/* 非同期の状態 */}
        <div className="rounded-lg border bg-slate-400/10 p-4 shadow-sm">
          <h2 className="mb-3 text-xl font-semibold">通常のuseState</h2>
          <div className="mb-4 flex items-center justify-center space-x-4">
            <button
              onClick={() => setLocalCounter(localCounter - 1)}
              className="rounded bg-gray-200 px-4 py-2 hover:bg-gray-300"
            >
              -
            </button>
            <span className="text-2xl font-bold">{localCounter}</span>
            <button
              onClick={() => setLocalCounter(localCounter + 1)}
              className="rounded bg-gray-200 px-4 py-2 hover:bg-gray-300"
            >
              +
            </button>
          </div>
          <div className="text-sm text-gray-500">
            <p>URLパラメータに保存されません</p>
            <p>ページリロード時に初期値に戻ります</p>
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-center space-x-4">
        <button
          onClick={() => window.location.reload()}
          className="rounded bg-indigo-500 px-4 py-2 text-white hover:bg-indigo-600"
        >
          ページをリロード
        </button>
        <Link href="/demo" className="rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-600">
          デモ一覧に戻る
        </Link>
      </div>
    </>
  )
}
