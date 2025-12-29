"use client"

import MultiInputFTB from "@/components/MultiInputFTB"
import Link from "next/link"
import { useState } from "react"

export default function DemoIndex() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const demos = [
    {
      category: "サーバー送信イベント (SSE)",
      items: [
        {
          name: "SSE（useSSE） デモ",
          path: "/demo/sse",
          description:
            "サーバー送信イベント（SSE）を使ったリアルタイム通信のデモページです。PubSubと連携した機能も実装しています。",
        },
        {
          name: "SSE（ピュア関数） デモ",
          path: "/demo/sse/pure",
          description: "サーバー送信イベントの基本的な動作を示すシンプルなデモページです。",
        },
      ],
    },
    {
      category: "PubSub",
      items: [
        {
          name: "PubSub（カスタムフック） デモ",
          path: "/demo/pubsub",
          description: "イベント駆動型アプリケーションを構築するためのPubSubパターンのデモページです。",
        },
        {
          name: "PubSub デモ",
          path: "/demo/pubsub/pure",
          description: "PubSubパターンの基本的な使い方を示すシンプルなデモページです。",
        },
      ],
    },
    {
      category: "Web Worker",
      items: [
        {
          name: "Worker Job デモ",
          path: "/demo/jw",
          description: "Web Workerを使った重い処理をバックグラウンドで実行するためのデモページです。",
        },
        {
          name: "Worker Job シンプルデモ",
          path: "/demo/jw/simple",
          description: "Web Workerの基本的な使い方を示すシンプルなデモページです。",
        },
      ],
    },
    {
      category: "Service Worker",
      items: [
        {
          name: "Service Worker 詳細デモ",
          path: "/demo/sw",
          description:
            "Service Workerの全機能を体験できる高度なデモページです。キャッシュ管理、メッセージング、更新チェックなどの機能を提供します。",
        },
        {
          name: "Service Worker シンプルデモ",
          path: "/demo/sw/simple",
          description: "Service Workerの基本的な使い方を示すシンプルなデモページです。初めて使う方にお勧めです。",
        },
      ],
    },
    {
      category: "Undo/Redo",
      items: [
        {
          name: "Undo/Redo デモ",
          path: "/demo/undo",
          description:
            "Undo/Redo機能を実装したデモページです。ユーザーの操作履歴を管理し、元に戻す・やり直す機能を提供します。",
        },
      ],
    },
    {
      category: "URLと状態の同期",
      items: [
        {
          name: "useUrlState デモ",
          path: "/demo/url",
          description:
            "Reactの状態をURLパラメータと同期させるためのカスタムフックです。ページをリロードしたり共有したりしても状態が保持されます。",
        },
        {
          name: "useUrlState シンプルデモ",
          path: "/demo/url/simple",
          description: "useUrlStateの基本的な使い方を示すシンプルなデモページです。初めて使う方にお勧めです。",
        },
      ],
    },
  ]

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-8 text-center text-3xl font-bold">カスタムフック デモページ</h1>

      <MultiInputFTB className="p-2" />

      <div className="grid gap-8">
        {demos.map((category) => (
          <div
            key={category.category}
            className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <button
              onClick={() => setActiveCategory(activeCategory === category.category ? null : category.category)}
              className="flex w-full items-center justify-between bg-gray-100 p-4 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
            >
              <h2 className="text-xl font-semibold">{category.category}</h2>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-5 w-5 transition-transform ${activeCategory === category.category ? "rotate-180" : ""}`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {activeCategory === category.category && (
              <div className="space-y-4 p-4">
                {category.items.map((item) => (
                  <div key={item.path} className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                    <Link
                      href={item.path}
                      className="text-lg font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      {item.name}
                    </Link>
                    <p className="mt-2 text-gray-600 dark:text-gray-300">{item.description}</p>
                    <div className="mt-3">
                      <Link
                        href={item.path}
                        className="inline-flex items-center rounded-md bg-blue-100 px-3 py-1.5 text-sm text-blue-700 transition-colors hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800"
                      >
                        デモを見る
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="ml-1 h-4 w-4"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-lg border border-blue-100 bg-blue-50 p-6 dark:border-blue-800 dark:bg-blue-900/20">
        <h2 className="mb-2 flex items-center text-xl font-semibold">
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
          デモページについて
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          これらのデモページは、様々なカスタムフックのフロントエンド機能を紹介しています。
          各デモには実用的なコード例が含まれており、実際のプロジェクトで活用できます。
          また、ほとんどのデモには詳細版とシンプル版の2種類が用意されており、目的に応じて参照できます。
        </p>
      </div>
    </div>
  )
}
