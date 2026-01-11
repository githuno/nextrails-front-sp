"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import youtubeClient from "./client"
import { HistoryItem, formatDuration, formatWatchedDate, formatWatchedTime } from "./constants"

interface HistoryDrawerProps {
  isOpen: boolean
  onClose: () => void
  onVideoSelect: (videoId: string, currentTime?: number) => void
}

const HistoryDrawer: React.FC<HistoryDrawerProps> = ({ isOpen, onClose, onVideoSelect }) => {
  // 履歴更新のトリガー用state
  const [, setHistoryUpdateTrigger] = useState<number>(0)

  // ドロワーが開かれたときにデータを再読み込み
  useEffect(() => {
    if (isOpen) {
      queueMicrotask(() => {
        setHistoryUpdateTrigger((prev) => prev + 1)
      })
    }
  }, [isOpen])

  // 履歴を削除する関数
  const removeFromHistory = useCallback((event: React.MouseEvent, videoId: string) => {
    event.stopPropagation() // クリックイベントの伝播を停止

    if (window.confirm("この動画を履歴から削除しますか？")) {
      try {
        youtubeClient.removeFromHistory(videoId)
        setHistoryUpdateTrigger((prev) => prev + 1)
      } catch (error) {
        console.error("履歴からの削除に失敗しました:", error)
      }
    }
  }, [])

  // 履歴データを取得して日付ごとに整理
  const historyData = useMemo(() => {
    if (!isOpen) {
      return { byDate: {}, sortedDates: [], total: 0 }
    }

    const history = youtubeClient.getHistory()

    // 日付ごとにグループ化
    const byDate = history.reduce((acc: { [date: string]: HistoryItem[] }, item) => {
      const dateKey = formatWatchedDate(item.watchedAt)

      if (!acc[dateKey]) {
        acc[dateKey] = []
      }

      acc[dateKey].push(item)
      return acc
    }, {})

    // 日付を新しい順にソート
    const sortedDates = Object.keys(byDate).sort((a, b) => {
      const dateA = new Date(byDate[a][0].watchedAt)
      const dateB = new Date(byDate[b][0].watchedAt)
      return dateB.getTime() - dateA.getTime()
    })

    return {
      byDate,
      sortedDates,
      total: history.length,
    }
  }, [isOpen])

  const handleVideoSelect = (videoId: string, currentTime?: number) => {
    onVideoSelect(videoId, currentTime)
    onClose() // 動画選択後にドロワーを閉じる
  }

  return (
    <div className={`fixed inset-0 z-40 ${isOpen ? "visible" : "invisible"}`}>
      {/* オーバーレイ */}
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-300 ${isOpen ? "opacity-50" : "opacity-0"}`}
        onClick={onClose}
      />

      {/* ドロワー本体 */}
      <div
        className={`absolute top-0 right-0 bottom-0 w-full transform bg-white shadow-xl transition-transform duration-300 sm:w-96 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        } flex flex-col`}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b bg-gray-50 p-4">
          <h3 className="text-lg font-medium">視聴履歴 ({historyData.total}件)</h3>
          <button
            onClick={() => {
              if (window.confirm("すべての視聴履歴を削除しますか？")) {
                youtubeClient.clearHistory()
                setHistoryUpdateTrigger((prev) => prev + 1)
              }
            }}
            className="rounded bg-red-500 px-3 py-1 text-sm text-white hover:bg-red-600"
          >
            履歴を削除
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-4">
          {historyData.total === 0 ? (
            <p className="py-8 text-center text-gray-500">視聴履歴がありません</p>
          ) : (
            historyData.sortedDates.map((date) => (
              <div key={date} className="mb-6">
                <h4 className="sticky top-0 mb-2 bg-white py-1 text-sm font-semibold text-gray-600">{date}</h4>
                <div className="space-y-2">
                  {/* 履歴アイテムの表示部分 */}
                  {historyData.byDate[date].map((item) => (
                    <div
                      key={`${item.videoId}-${item.watchedAt}`}
                      onClick={() => handleVideoSelect(item.videoId, item.currentTime)}
                      className="relative flex cursor-pointer rounded-lg border border-gray-200 p-3 hover:bg-gray-50"
                    >
                      {/* サムネイル */}
                      <div className="mr-3 h-14 w-20 shrink-0">
                        <img src={item.thumbnailUrl} alt={item.title} className="h-full w-full rounded object-cover" />
                      </div>

                      {/* 情報 */}
                      <div className="grow pr-6">
                        <div className="line-clamp-2 text-sm font-medium">{item.title}</div>
                        <div className="mt-1 flex justify-between text-xs text-gray-600">
                          <span>{item.channelTitle}</span>
                          <span>{formatWatchedTime(item.watchedAt)}</span>
                        </div>

                        {/* 再生位置表示 */}
                        {item.currentTime && item.duration && (
                          <div className="mt-1">
                            <div className="h-1 w-full rounded-full bg-gray-200">
                              <div
                                className="h-1 rounded-full bg-red-500"
                                style={{
                                  width: `${Math.min((item.currentTime / item.duration) * 100, 100)}%`,
                                }}
                              />
                            </div>
                            <div className="mt-0.5 text-right text-xs text-gray-500">
                              {(() => {
                                const current = formatDuration(`PT${Math.floor(item.currentTime)}S`)
                                const total = formatDuration(`PT${Math.floor(item.duration)}S`)
                                return `${current} / ${total}`
                              })()}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 削除ボタン */}
                      <button
                        onClick={(e) => removeFromHistory(e, item.videoId)}
                        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500"
                        title="履歴から削除"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* フッター - 閉じるボタン */}
        <div className="border-t bg-gray-50 p-4">
          <button onClick={onClose} className="w-full rounded bg-gray-200 py-2 text-sm text-gray-700 hover:bg-gray-300">
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}

export default HistoryDrawer
