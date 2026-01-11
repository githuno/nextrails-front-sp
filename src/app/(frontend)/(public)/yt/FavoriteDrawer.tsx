"use client"

import React, { useCallback, useEffect, useState } from "react"
import youtubeClient from "./client"
import { formatDuration, VideoDetail } from "./constants"

interface FavoriteDrawerProps {
  isOpen: boolean
  onClose: () => void
  onVideoSelect: (videoId: string, currentTime?: number) => void
}

const FavoriteDrawer: React.FC<FavoriteDrawerProps> = ({ isOpen, onClose, onVideoSelect }) => {
  // お気に入り更新のトリガー用state
  const [favUpdateTrigger, setFavUpdateTrigger] = useState<number>(0)
  // 動画詳細情報
  const [videoDetails, setVideoDetails] = useState<VideoDetail[]>([])
  // ロード状態
  const [isLoading, setIsLoading] = useState<boolean>(false)
  // エラー状態
  const [error, setError] = useState<string | null>(null)

  // ドロワーが開かれたときにデータを再読み込み
  useEffect(() => {
    if (isOpen) {
      loadFavoriteDetails()
    }
  }, [isOpen, favUpdateTrigger])

  // お気に入りの詳細情報を読み込む
  const loadFavoriteDetails = useCallback(async () => {
    try {
      const favorites = youtubeClient.getFavorites()
      if (favorites.length === 0) {
        setVideoDetails([])
        return
      }

      setIsLoading(true)
      setError(null)

      const details = await youtubeClient.getVideoDetails(favorites)
      setVideoDetails(details || [])
    } catch (err) {
      console.error("お気に入り情報の取得に失敗しました:", err)
      setError("お気に入り情報の取得に失敗しました")
    } finally {
      setIsLoading(false)
    }
  }, [])

  // お気に入りを削除する関数
  const removeFromFavorites = useCallback((event: React.MouseEvent, videoId: string) => {
    event.stopPropagation() // クリックイベントの伝播を停止

    if (window.confirm("この動画をお気に入りから削除しますか？")) {
      try {
        youtubeClient.toggleFavorite(videoId)
        setFavUpdateTrigger((prev) => prev + 1)
      } catch (error) {
        console.error("お気に入りからの削除に失敗しました:", error)
      }
    }
  }, [])

  // すべてのお気に入りを削除
  const clearAllFavorites = useCallback(() => {
    if (window.confirm("すべてのお気に入りを削除しますか？")) {
      try {
        const favorites = youtubeClient.getFavorites()
        favorites.forEach((videoId) => {
          youtubeClient.toggleFavorite(videoId)
        })
        setFavUpdateTrigger((prev) => prev + 1)
      } catch (error) {
        console.error("お気に入りのクリアに失敗しました:", error)
      }
    }
  }, [])

  const handleVideoSelect = (videoId: string) => {
    onVideoSelect(videoId)
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
          <h3 className="text-lg font-medium">お気に入り ({videoDetails.length}件)</h3>
          <button
            onClick={clearAllFavorites}
            className="rounded bg-red-500 px-3 py-1 text-sm text-white hover:bg-red-600"
            disabled={videoDetails.length === 0}
          >
            すべて削除
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="py-8 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
              <p className="mt-2 text-gray-600">読み込み中...</p>
            </div>
          ) : error ? (
            <div className="rounded bg-red-100 p-3 text-red-700">{error}</div>
          ) : videoDetails.length === 0 ? (
            <p className="py-8 text-center text-gray-500">お気に入りがありません</p>
          ) : (
            <div className="space-y-3">
              {videoDetails.map((video) => (
                <div
                  key={video.id}
                  onClick={() => handleVideoSelect(video.id)}
                  className="relative flex cursor-pointer rounded-lg border border-gray-200 p-3 hover:bg-gray-50"
                >
                  {/* サムネイル */}
                  <div className="mr-3 h-14 w-20 shrink-0">
                    <img
                      src={video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url}
                      alt={video.snippet.title}
                      className="h-full w-full rounded object-cover"
                    />
                  </div>

                  {/* 情報 */}
                  <div className="grow pr-6">
                    <div className="line-clamp-2 text-sm font-medium">{video.snippet.title}</div>
                    <div className="mt-1 flex justify-between text-xs text-gray-600">
                      <span>{video.snippet.channelTitle}</span>
                      <span>{formatDuration(video.contentDetails.duration)}</span>
                    </div>

                    {/* 視聴回数 */}
                    <div className="mt-1 text-xs text-gray-500">
                      {parseInt(video.statistics.viewCount).toLocaleString()}
                      回視聴
                    </div>
                  </div>

                  {/* 削除ボタン */}
                  <button
                    onClick={(e) => removeFromFavorites(e, video.id)}
                    className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500"
                    title="お気に入りから削除"
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

export default FavoriteDrawer
