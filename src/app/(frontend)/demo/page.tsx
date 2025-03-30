"use client";

import Link from "next/link";
import path from "path";
import { useState } from "react";

export default function DemoIndex() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const demos = [
    {
      category: "サーバー送信イベント (SSE)",
      items: [
        {
          name: "SSE デモ",
          path: "/demo/sse",
          description:
            "サーバー送信イベント（SSE）を使ったリアルタイム通信のデモページです。PubSubと連携した機能も実装しています。",
        },
        {
          name: "SSE シンプルデモ",
          path: "/demo/sse/pure",
          description:
            "サーバー送信イベントの基本的な動作を示すシンプルなデモページです。",
        },
      ],
    },
    {
      category: "PubSub",
      items: [
        {
          name: "PubSub デモ",
          path: "/demo/pubsub",
          description:
            "イベント駆動型アプリケーションを構築するためのPubSubパターンのデモページです。",
        },
        {
          name: "PubSub シンプルデモ",
          path: "/demo/pubsub/pure",
          description:
            "PubSubパターンの基本的な使い方を示すシンプルなデモページです。",
        },
      ],
    },
    {
      category: "Web Worker",
      items: [
        {
          name: "Worker Job デモ",
          path: "/demo/jw",
          description:
            "Web Workerを使った重い処理をバックグラウンドで実行するためのデモページです。",
        },
        {
          name: "Worker Job シンプルデモ",
          path: "/demo/jw/simple",
          description:
            "Web Workerの基本的な使い方を示すシンプルなデモページです。",
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
          description:
            "Service Workerの基本的な使い方を示すシンプルなデモページです。初めて使う方にお勧めです。",
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
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-8 text-center">カスタムフック デモページ</h1>

      <div className="grid gap-8">
        {demos.map((category) => (
          <div
            key={category.category}
            className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
          >
            <button
              onClick={() =>
                setActiveCategory(
                  activeCategory === category.category
                    ? null
                    : category.category
                )
              }
              className="w-full p-4 bg-gray-100 dark:bg-gray-800 flex justify-between items-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <h2 className="text-xl font-semibold">{category.category}</h2>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-5 w-5 transition-transform ${
                  activeCategory === category.category ? "rotate-180" : ""
                }`}
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
              <div className="p-4 space-y-4">
                {category.items.map((item) => (
                  <div
                    key={item.path}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <Link
                      href={item.path}
                      className="text-lg font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      {item.name}
                    </Link>
                    <p className="mt-2 text-gray-600 dark:text-gray-300">
                      {item.description}
                    </p>
                    <div className="mt-3">
                      <Link
                        href={item.path}
                        className="inline-flex items-center px-3 py-1.5 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800 transition-colors text-sm"
                      >
                        デモを見る
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 ml-1"
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

      <div className="mt-10 p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg">
        <h2 className="text-xl font-semibold mb-2 flex items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 mr-2 text-blue-500"
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
  );
}
