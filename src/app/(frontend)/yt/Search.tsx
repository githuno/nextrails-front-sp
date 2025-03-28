"use client";

import React, { useState, useCallback } from "react";
import youtubeClient from "./client";
import { SearchParams, SearchResponse, SearchItem } from "./constants";

interface SearchProps {
  onVideoSelect: (video: SearchItem) => void;
}

export default function Search({ onVideoSelect }: SearchProps) {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(
    null
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(
    undefined
  );
  const [videoDuration, setVideoDuration] = useState<
    "any" | "long" | "medium" | "short"
  >("any");

  // 検索実行
  const handleSearch = useCallback(
    async (pageToken?: string) => {
      if (!searchTerm.trim()) return;

      setIsLoading(true);
      setError(null);

      try {
        const params: SearchParams = {
          q: searchTerm,
          maxResults: 15,
          type: "video",
          videoDuration,
          pageToken,
        };

        const response = await youtubeClient.search(params);

        if (pageToken) {
          // ページングの場合は結果を追加
          setSearchResults((prev) => {
            if (!prev) return response;
            return {
              ...response,
              items: [...prev.items, ...response.items],
            };
          });
        } else {
          // 新規検索の場合は結果を置き換え
          setSearchResults(response);
        }

        setNextPageToken(response.nextPageToken);
      } catch (err) {
        console.error("検索エラー:", err);
        setError("検索中にエラーが発生しました。もう一度お試しください。");
      } finally {
        setIsLoading(false);
      }
    },
    [searchTerm, videoDuration]
  );

  // もっと読み込む処理
  const loadMore = useCallback(() => {
    if (nextPageToken) {
      handleSearch(nextPageToken);
    }
  }, [nextPageToken, handleSearch]);

  // 検索フォームの送信処理
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // 新規検索の場合はトークンをリセット
    setNextPageToken(undefined);
    handleSearch();
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="YouTubeを検索..."
            className="flex-1 p-2 border rounded text-sm"
            required
          />
          <div className="flex gap-2 justify-end">
            <select
              value={videoDuration}
              onChange={(e) => setVideoDuration(e.target.value as any)}
              className="flex-grow p-2 border rounded bg-white text-sm w-full sm:w-auto"
            >
              <option value="any">すべての長さ</option>
              <option value="short">短い（4分未満）</option>
              <option value="medium">中程度（4〜20分）</option>
              <option value="long">長い（20分超）</option>
            </select>
            <button
              type="submit"
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm whitespace-nowrap min-w-[80px]"
              disabled={isLoading}
            >
              {isLoading ? "検索中..." : "検索"}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div className="p-2 sm:p-3 mb-3 sm:mb-4 bg-red-100 text-red-700 rounded text-xs sm:text-sm">
          {error}
        </div>
      )}

      {searchResults && (
        <div className="space-y-3 sm:space-y-4">
          <h3 className="text-base sm:text-lg font-medium">
            {searchResults.pageInfo.totalResults.toLocaleString()} 件の検索結果
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-1 gap-2 sm:gap-4">
            {searchResults.items.map((video, index) => (
              <div
                key={`${video.id.videoId}-${index}`}
                onClick={() => onVideoSelect(video)}
                className="cursor-pointer bg-white border rounded overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="relative pb-[56.25%]">
                  <img
                    src={
                      video.snippet.thumbnails.medium?.url ||
                      video.snippet.thumbnails.default?.url
                    }
                    alt={video.snippet.title}
                    className="absolute w-full h-full object-cover"
                  />
                </div>
                <div className="p-2 sm:p-3">
                  <h3 className="font-medium line-clamp-2 text-xs sm:text-sm">
                    {video.snippet.title}
                  </h3>
                  <p className="text-gray-600 text-xs mt-1">
                    {video.snippet.channelTitle}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {nextPageToken && (
            <div className="text-center mt-4 sm:mt-6">
              <button
                onClick={loadMore}
                disabled={isLoading}
                className="px-3 sm:px-4 py-1 sm:py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
              >
                {isLoading ? "読み込み中..." : "もっと見る"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
