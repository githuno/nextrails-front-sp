"use client"

import React, { useCallback, useState } from "react"
import youtubeClient from "./client"
import { SearchItem, SearchParams, SearchResponse } from "./constants"

interface SearchProps {
  onVideoSelect: (video: SearchItem) => void
  onPlaylistSelect?: (playlist: SearchItem) => void
}

export default function Search({ onVideoSelect, onPlaylistSelect }: SearchProps) {
  const [searchTerm, setSearchTerm] = useState<string>("")
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined)
  const [videoDuration, setVideoDuration] = useState<"any" | "long" | "medium" | "short">("any")
  const [searchType, setSearchType] = useState<"video" | "playlist">("video")

  // 検索実行
  const handleSearch = useCallback(
    async (pageToken?: string) => {
      if (!searchTerm.trim()) return

      setIsLoading(true)
      setError(null)

      try {
        const params: SearchParams = {
          q: searchTerm,
          maxResults: 15,
          type: searchType,
          ...(searchType === "video" && { videoDuration }),
          pageToken,
        }

        const response = await youtubeClient.search(params)

        if (pageToken) {
          // ページングの場合は結果を追加
          setSearchResults((prev) => {
            if (!prev) return response
            return {
              ...response,
              items: [...prev.items, ...response.items],
            }
          })
        } else {
          // 新規検索の場合は結果を置き換え
          setSearchResults(response)
        }

        setNextPageToken(response.nextPageToken)
      } catch (err) {
        console.error("検索エラー:", err)
        setError("検索中にエラーが発生しました。もう一度お試しください。")
      } finally {
        setIsLoading(false)
      }
    },
    [searchTerm, videoDuration, searchType],
  )

  // もっと読み込む処理
  const loadMore = useCallback(() => {
    if (nextPageToken) {
      handleSearch(nextPageToken)
    }
  }, [nextPageToken, handleSearch])

  // 検索フォームの送信処理
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // 新規検索の場合はトークンをリセット
    setNextPageToken(undefined)
    handleSearch()
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="flex flex-col gap-2 px-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="YouTubeを検索..."
            className="flex-1 rounded border p-2 text-sm"
            required
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <select
              value={searchType}
              onChange={(e) => setSearchType(e.target.value as "video" | "playlist")}
              className="w-full rounded border bg-white p-2 text-sm sm:w-auto"
            >
              <option value="video">動画</option>
              <option value="playlist">プレイリスト</option>
            </select>
            {searchType === "video" && (
              <select
                value={videoDuration}
                onChange={(e) => setVideoDuration(e.target.value as "any" | "long" | "medium" | "short")}
                className="w-full rounded border bg-white p-2 text-sm sm:w-auto"
              >
                <option value="any">すべての長さ</option>
                <option value="short">短い（4分未満）</option>
                <option value="medium">中程度（4〜20分）</option>
                <option value="long">長い（20分超）</option>
              </select>
            )}
            <button
              type="submit"
              className="relative min-w-20 overflow-hidden rounded bg-transparent px-4 py-2 text-sm whitespace-nowrap text-white before:absolute before:-inset-1 before:-z-10 before:animate-[spin_4s_linear_infinite] before:rounded-[inherit] before:bg-[conic-gradient(from_0deg_at_50%_0%,#ffcc00,#00ff00,#00ffff,#fff,#fff,#fff)] before:content-[''] after:absolute after:inset-px after:-z-5 after:rounded-[inherit] after:bg-linear-to-br after:from-red-500 after:to-purple-600 after:content-[''] hover:before:animate-[spin_1.5s_linear_infinite] disabled:before:animate-none disabled:after:bg-linear-to-br disabled:after:from-gray-500 disabled:after:to-gray-600"
              disabled={isLoading}
            >
              {isLoading ? "検索中..." : "検索"}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div className="mb-3 rounded bg-red-100 p-2 text-xs text-red-700 sm:mb-4 sm:p-3 sm:text-sm">{error}</div>
      )}

      {searchResults && (
        <div className="space-y-3 sm:space-y-4">
          <h3 className="text-base font-medium sm:text-lg">
            {searchResults.pageInfo.totalResults.toLocaleString()} 件の検索結果
          </h3>

          <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-3">
            {/* <div className="columns-2 md:columns-4 gap-2 sm:gap-4"> */}
            {searchResults.items.map((item, index) => (
              <div
                key={`${item.id.videoId || item.id.playlistId}-${index}`}
                onClick={() => {
                  if (searchType === "playlist" && onPlaylistSelect) {
                    onPlaylistSelect(item)
                  } else {
                    onVideoSelect(item)
                  }
                }}
                className="cursor-pointer overflow-hidden rounded border bg-white shadow-sm transition-shadow [clip-path:circle(65%)] hover:shadow-md"
              >
                <div className="relative pb-[56.25%]">
                  <img
                    src={item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url}
                    alt={item.snippet.title}
                    className="absolute h-full w-full object-cover"
                  />
                </div>
                <div className="p-2 sm:p-3">
                  <h3 className="line-clamp-2 text-xs font-medium sm:text-sm">{item.snippet.title}</h3>
                  <p className="mt-1 text-xs text-gray-600">{item.snippet.channelTitle}</p>
                  {searchType === "playlist" && <p className="mt-1 text-xs text-purple-600">プレイリスト</p>}
                </div>
              </div>
            ))}
          </div>

          {nextPageToken && (
            <div className="mt-4 text-center sm:mt-6">
              <button
                onClick={loadMore}
                disabled={isLoading}
                className="rounded bg-gray-200 px-3 py-1 text-sm hover:bg-gray-300 sm:px-4 sm:py-2"
              >
                {isLoading ? "読み込み中..." : "もっと見る"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
