"use client"

import React, { useCallback, useEffect, useState } from "react"
import youtubeClient from "./client"
import { PlaylistDetail, PlaylistItem } from "./constants"

interface PlaylistDrawerProps {
  isOpen: boolean
  onClose: () => void
  onVideoSelect: (videoId: string, currentTime?: number) => void
}

const PlaylistDrawer: React.FC<PlaylistDrawerProps> = ({ isOpen, onClose, onVideoSelect }) => {
  // お気に入りプレイリスト更新のトリガー用state
  const [playlistUpdateTrigger, setPlaylistUpdateTrigger] = useState<number>(0)

  // youtubeClient の変更を監視
  useEffect(() => {
    return youtubeClient.subscribe(() => {
      setPlaylistUpdateTrigger((prev) => prev + 1)
    })
  }, [])

  // プレイリスト詳細情報
  const [playlistDetails, setPlaylistDetails] = useState<PlaylistDetail[]>([])
  // 選択中のプレイリスト
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null)
  // プレイリストの動画一覧
  const [playlistVideos, setPlaylistVideos] = useState<PlaylistItem[]>([])
  // ロード状態
  const [isLoading, setIsLoading] = useState<boolean>(false)
  // エラー状態
  const [error, setError] = useState<string | null>(null)

  // お気に入りプレイリストの詳細情報を読み込む
  const loadPlaylistDetails = useCallback(async () => {
    try {
      const favoritePlaylists = youtubeClient.getFavoritePlaylists()
      if (favoritePlaylists.length === 0) {
        setPlaylistDetails([])
        return
      }

      setIsLoading(true)
      setError(null)

      const details = await youtubeClient.getPlaylistDetails(favoritePlaylists)
      setPlaylistDetails(details || [])
    } catch (err) {
      console.error("お気に入りプレイリスト情報の取得に失敗しました:", err)
      setError("プレイリスト情報の取得に失敗しました")
    } finally {
      setIsLoading(false)
    }
  }, [])

  // ドロワーが開かれたときにデータを再読み込み
  useEffect(() => {
    if (isOpen) {
      loadPlaylistDetails()
    } else {
      // ドロワーが閉じられたら選択をリセット
      setSelectedPlaylist(null)
      setPlaylistVideos([])
    }
  }, [isOpen, loadPlaylistDetails, playlistUpdateTrigger])

  // プレイリストのお気に入りを削除する関数
  const removeFromFavorites = useCallback((event: React.MouseEvent, playlistId: string) => {
    event.stopPropagation() // クリックイベントの伝播を停止

    if (window.confirm("このプレイリストをお気に入りから削除しますか？")) {
      try {
        youtubeClient.toggleFavoritePlaylist(playlistId)
      } catch (error) {
        console.error("お気に入りからの削除に失敗しました:", error)
      }
    }
  }, [])

  // すべてのお気に入りを削除
  const clearAllFavorites = useCallback(() => {
    if (window.confirm("すべてのお気に入りプレイリストを削除しますか？")) {
      youtubeClient.clearFavoritePlaylists()
    }
  }, [])

  // プレイリスト選択時の処理
  const handlePlaylistSelect = useCallback(
    async (playlistId: string) => {
      if (selectedPlaylist === playlistId) {
        setSelectedPlaylist(null)
        setPlaylistVideos([])
        return
      }

      setSelectedPlaylist(playlistId)
      setIsLoading(true)
      setError(null)
      setPlaylistVideos([])

      try {
        const { items } = await youtubeClient.getPlaylistItems(playlistId)
        setPlaylistVideos(items || [])
      } catch (err) {
        console.error("プレイリスト動画の取得に失敗しました:", err)
        setError("プレイリスト動画の取得に失敗しました")
      } finally {
        setIsLoading(false)
      }
    },
    [selectedPlaylist],
  )

  // 動画選択時の処理
  const handleVideoSelect = useCallback(
    (videoId: string) => {
      onVideoSelect(videoId)
      onClose()
    },
    [onVideoSelect, onClose],
  )

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
          <h3 className="text-lg font-medium">お気に入りプレイリスト ({playlistDetails.length}件)</h3>
          <button
            onClick={clearAllFavorites}
            className="rounded bg-red-500 px-3 py-1 text-sm text-white hover:bg-red-600"
            disabled={playlistDetails.length === 0}
          >
            すべて削除
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
            </div>
          ) : error ? (
            <div className="rounded bg-red-100 p-3 text-sm text-red-700">{error}</div>
          ) : playlistDetails.length === 0 ? (
            <p className="py-8 text-center text-gray-500">お気に入りプレイリストがありません</p>
          ) : (
            <div className="space-y-4">
              {playlistDetails.map((playlist) => (
                <div key={playlist.id} className="rounded-lg border p-3">
                  <div
                    className="flex cursor-pointer items-start justify-between"
                    onClick={() => handlePlaylistSelect(playlist.id)}
                  >
                    <div className="flex-1">
                      <h4 className="line-clamp-2 text-sm font-medium">{playlist.snippet.title}</h4>
                      <p className="mt-1 text-xs text-gray-600">{playlist.snippet.channelTitle}</p>
                      <p className="mt-1 text-xs text-gray-500">{playlist.contentDetails.itemCount} 動画</p>
                    </div>
                    <button
                      onClick={(e) => removeFromFavorites(e, playlist.id)}
                      className="ml-2 text-red-500 hover:text-red-700"
                      aria-label="お気に入りから削除"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* 選択中のプレイリストの動画一覧 */}
                  {selectedPlaylist === playlist.id && (
                    <div className="mt-3 space-y-2">
                      {playlistVideos.map((item, index) => (
                        <div
                          key={item.id}
                          className="flex cursor-pointer items-center space-x-3 rounded p-2 hover:bg-gray-50"
                          onClick={() => handleVideoSelect(item.contentDetails.videoId)}
                        >
                          <span className="w-6 text-xs text-gray-500">{index + 1}</span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{item.snippet.title}</p>
                            <p className="truncate text-xs text-gray-600">{item.snippet.channelTitle}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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

export default PlaylistDrawer
