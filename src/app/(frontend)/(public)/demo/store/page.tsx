"use client"

import { Point, useStore } from "@/hooks/useStore"
import React, { useState } from "react"

// ポイントを表示するコンポーネント
const PointsComponent: React.FC = () => {
  const { points, isLoading, message, addPoint } = useStore()

  const handleAddPoint = () => {
    const newPoint: Point = {
      x: Math.floor(Math.random() * 100),
      y: Math.floor(Math.random() * 100),
    }
    addPoint(newPoint)
  }

  return (
    <div className="rounded-lg border p-4 shadow-md">
      <h3 className="mb-2 text-lg font-semibold">ポイント管理</h3>

      <div className="mb-4">
        <p className="mb-1">
          状態:{" "}
          <span className={isLoading ? "text-yellow-500" : "text-green-500"}>
            {isLoading ? "ロード中..." : "準備完了"}
          </span>
        </p>
        <p className="mb-3">
          メッセージ: <span className="italic">{message}</span>
        </p>

        <button
          onClick={handleAddPoint}
          disabled={isLoading}
          className={`rounded px-4 py-2 ${
            isLoading ? "cursor-not-allowed bg-gray-300" : "bg-blue-500 text-white hover:bg-blue-600"
          }`}
        >
          ランダムなポイントを追加
        </button>
      </div>

      <div>
        <h4 className="mb-2 font-medium">ポイント一覧：</h4>
        {points.length === 0 || !Array.isArray(points) ? (
          <p className="text-gray-500 italic">ポイントがありません</p>
        ) : (
          <ul className="list-disc pl-5">
            {points.map((point, index) => (
              <li key={index} className="mb-1">
                X: {point.x}, Y: {point.y}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// 複数のコンポーネント間での状態共有をデモするコンポーネント
const MessageDisplay: React.FC = () => {
  const { message, setMessage } = useStore()
  const [inputValue, setInputValue] = useState("")

  const handleUpdateMessage = () => {
    if (inputValue.trim()) {
      setMessage(inputValue)
      setInputValue("")
    }
  }

  return (
    <div className="mt-4 rounded-lg border p-4 shadow-md">
      <h3 className="mb-2 text-lg font-semibold">メッセージ管理</h3>
      <p className="mb-2">
        現在のメッセージ: <span className="font-medium">{message}</span>
      </p>

      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="新しいメッセージを入力"
          className="flex-1 rounded border px-2 py-1"
        />
        <button onClick={handleUpdateMessage} className="rounded bg-green-500 px-3 py-1 text-white hover:bg-green-600">
          更新
        </button>
      </div>
      <p className="mt-2 text-sm text-gray-500">このメッセージはPointsComponentと共有されています</p>
    </div>
  )
}

// メインページコンポーネント
export default function StoreDemo() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">ストア状態管理デモ</h1>
      <p className="mb-6">
        このデモページでは、PubSubパターンを使用した状態管理システムを紹介します。
        zustandやimmerのような外部ライブラリを使わずに、カスタムフックとPubSubで実装しています。
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <PointsComponent />
        </div>
        <div>
          <MessageDisplay />
          <div className="mt-4 rounded-lg border p-4 shadow-md">
            <h3 className="mb-2 text-lg font-semibold">実装の特徴</h3>
            <ul className="list-disc pl-5">
              <li>コンポーネント間で状態を共有</li>
              <li>イミュータブルな状態更新</li>
              <li>非同期処理の統合</li>
              <li>型安全な実装</li>
              <li>デバッグしやすい設計</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
