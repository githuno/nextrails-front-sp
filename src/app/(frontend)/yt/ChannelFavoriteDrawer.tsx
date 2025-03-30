"use client";

import React, { useState, useCallback, useEffect } from "react";
import { ChannelDetail, SearchItem } from "./constants";
import youtubeClient from "./client";

interface ChannelFavoriteDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onVideoSelect: (videoId: string) => void;
}

const ChannelFavoriteDrawer: React.FC<ChannelFavoriteDrawerProps> = ({
  isOpen,
  onClose,
  onVideoSelect,
}) => {
  // お気に入りチャンネル更新のトリガー用state
  const [updateTrigger, setUpdateTrigger] = useState<number>(0);
  // チャンネル詳細情報
  const [channelDetails, setChannelDetails] = useState<ChannelDetail[]>([]);
  // 選択中のチャンネル
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  // チャンネルの動画一覧
  const [channelVideos, setChannelVideos] = useState<SearchItem[]>([]);
  // ローディング状態
  const [isLoading, setIsLoading] = useState<boolean>(false);
  // エラー状態
  const [error, setError] = useState<string | null>(null);
  // 動画一覧の次ページトークン
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();

  // ドロワーが開かれたときにデータを再読み込み
  useEffect(() => {
    if (isOpen) {
      loadChannelDetails();
    } else {
      // ドロワーが閉じられたら選択をリセット
      setSelectedChannel(null);
      setChannelVideos([]);
    }
  }, [isOpen, updateTrigger]);

  // お気に入りチャンネルの詳細情報を読み込む
  const loadChannelDetails = useCallback(async () => {
    try {
      const favoriteChannels = youtubeClient.getFavoriteChannels();
      if (favoriteChannels.length === 0) {
        setChannelDetails([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      const details = await youtubeClient.getChannelDetails(favoriteChannels);
      setChannelDetails(details || []);
    } catch (err) {
      console.error("お気に入りチャンネル情報の取得に失敗しました:", err);
      setError("チャンネル情報の取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // チャンネルのお気に入りを削除する関数
  const removeFromFavorites = useCallback(
    (event: React.MouseEvent, channelId: string) => {
      event.stopPropagation(); // クリックイベントの伝播を停止

      try {
        youtubeClient.toggleFavoriteChannel(channelId);
        setUpdateTrigger((prev) => prev + 1);

        // 削除したチャンネルが選択中だった場合は選択を解除
        if (selectedChannel === channelId) {
          setSelectedChannel(null);
          setChannelVideos([]);
        }
      } catch (error) {
        console.error("お気に入りからの削除に失敗しました:", error);
      }
    },
    [selectedChannel]
  );

  // すべてのお気に入りを削除
  const clearAllFavorites = useCallback(() => {
    if (window.confirm("すべてのお気に入りチャンネルを削除しますか？")) {
      try {
        const favoriteChannels = youtubeClient.getFavoriteChannels();
        favoriteChannels.forEach((channelId) => {
          youtubeClient.toggleFavoriteChannel(channelId);
        });
        setUpdateTrigger((prev) => prev + 1);
        // 選択をリセット
        setSelectedChannel(null);
        setChannelVideos([]);
      } catch (error) {
        console.error("お気に入りのクリアに失敗しました:", error);
      }
    }
  }, []);

  // チャンネル選択時の処理
  const handleChannelSelect = useCallback(async (channelId: string) => {
    if (selectedChannel === channelId) {
      // 同じチャンネルを選択した場合は閉じる
      setSelectedChannel(null);
      setChannelVideos([]);
      return;
    }

    setSelectedChannel(channelId);
    setIsLoading(true);
    setError(null);
    setChannelVideos([]);
    setNextPageToken(undefined);

    try {
      const response = await youtubeClient.searchChannelVideos(channelId);
      setChannelVideos(response.items);
      setNextPageToken(response.nextPageToken);
    } catch (err) {
      console.error("チャンネル動画の取得に失敗しました:", err);
      setError("チャンネル動画の取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, [selectedChannel]);

  // もっと動画を読み込む
  const loadMoreVideos = useCallback(async () => {
    if (!selectedChannel || !nextPageToken) return;

    setIsLoading(true);

    try {
      const response = await youtubeClient.searchChannelVideos(
        selectedChannel,
        nextPageToken
      );
      setChannelVideos((prev) => [...prev, ...response.items]);
      setNextPageToken(response.nextPageToken);
    } catch (err) {
      console.error("追加の動画取得に失敗しました:", err);
      setError("動画の読み込みに失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, [selectedChannel, nextPageToken]);

  // 動画選択時の処理
  const handleVideoSelect = useCallback(
    (videoId: string) => {
      onVideoSelect(videoId);
      onClose();
    },
    [onVideoSelect, onClose]
  );

  // チャンネル登録者数のフォーマット
  const formatSubscriberCount = (count: string): string => {
    const num = parseInt(count);
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return count;
  };

  return (
    <div className={`fixed inset-0 z-40 ${isOpen ? "visible" : "invisible"}`}>
      {/* オーバーレイ */}
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-300 ${
          isOpen ? "opacity-50" : "opacity-0"
        }`}
        onClick={onClose}
      />

      {/* ドロワー本体 */}
      <div
        className={`absolute top-0 right-0 bottom-0 w-full sm:w-96 bg-white shadow-xl transform transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        } flex flex-col`}
      >
        {/* ヘッダー */}
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h3 className="text-lg font-medium">
            お気に入りチャンネル ({channelDetails.length}件)
          </h3>
          <button
            onClick={clearAllFavorites}
            className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
            disabled={channelDetails.length === 0}
          >
            すべて削除
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && !selectedChannel ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-red-500 border-t-transparent"></div>
              <p className="mt-2 text-gray-600">読み込み中...</p>
            </div>
          ) : error && !selectedChannel ? (
            <div className="p-3 m-4 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          ) : channelDetails.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              お気に入りチャンネルがありません
            </p>
          ) : (
            <div>
              {/* チャンネル一覧 */}
              <div className="p-4">
                <h4 className="text-sm font-medium text-gray-500 mb-2">
                  チャンネル一覧
                </h4>
                <div className="space-y-2">
                  {channelDetails.map((channel) => (
                    <div
                      key={channel.id}
                      onClick={() => handleChannelSelect(channel.id)}
                      className={`p-3 rounded-lg border cursor-pointer flex items-center relative ${
                        selectedChannel === channel.id
                          ? "border-red-500 bg-red-50"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {/* チャンネルアイコン */}
                      <div className="flex-shrink-0 w-10 h-10 mr-3">
                        <img
                          src={
                            channel.snippet.thumbnails.default?.url ||
                            channel.snippet.thumbnails.medium?.url
                          }
                          alt={channel.snippet.title}
                          className="w-full h-full object-cover rounded-full"
                        />
                      </div>

                      {/* チャンネル情報 */}
                      <div className="flex-grow pr-8">
                        <div className="font-medium text-sm">
                          {channel.snippet.title}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center mt-1">
                          <span className="mr-2">
                            {!channel.statistics.hiddenSubscriberCount &&
                              `${formatSubscriberCount(
                                channel.statistics.subscriberCount
                              )} チャンネル登録者`}
                          </span>
                          <span>{channel.statistics.videoCount}本の動画</span>
                        </div>
                      </div>

                      {/* 削除ボタン */}
                      <button
                        onClick={(e) => removeFromFavorites(e, channel.id)}
                        className="absolute top-2 right-2 text-gray-400 hover:text-red-500 p-1"
                        title="お気に入りから削除"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* チャンネル動画一覧 */}
              {selectedChannel && (
                <div className="border-t">
                  <div className="p-4">
                    <h4 className="text-sm font-medium text-gray-500 mb-2">
                      最近の動画
                    </h4>
                    {isLoading ? (
                      <div className="text-center py-4">
                        <div className="inline-block animate-spin rounded-full h-6 w-6 border-4 border-red-500 border-t-transparent"></div>
                        <p className="mt-1 text-sm text-gray-600">
                          読み込み中...
                        </p>
                      </div>
                    ) : error ? (
                      <div className="p-2 bg-red-100 text-red-700 rounded text-sm">
                        {error}
                      </div>
                    ) : channelVideos.length === 0 ? (
                      <p className="text-gray-500 text-center py-4 text-sm">
                        動画が見つかりませんでした
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {channelVideos.map((video) => (
                          <div
                            key={video.id.videoId}
                            onClick={() =>
                              handleVideoSelect(video.id.videoId || "")
                            }
                            className="p-2 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 flex"
                          >
                            {/* サムネイル */}
                            <div className="flex-shrink-0 w-20 h-12 mr-2">
                              <img
                                src={
                                  video.snippet.thumbnails.medium?.url ||
                                  video.snippet.thumbnails.default?.url
                                }
                                alt={video.snippet.title}
                                className="w-full h-full object-cover rounded"
                              />
                            </div>

                            {/* 情報 */}
                            <div className="flex-grow">
                              <p className="text-xs font-medium line-clamp-2">
                                {video.snippet.title}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(
                                  video.snippet.publishedAt
                                ).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        ))}

                        {/* もっと読み込むボタン */}
                        {nextPageToken && (
                          <div className="text-center pt-2 pb-4">
                            <button
                              onClick={loadMoreVideos}
                              disabled={isLoading}
                              className="px-4 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
                            >
                              {isLoading ? "読み込み中..." : "もっと見る"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* フッター - 閉じるボタン */}
        <div className="p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="w-full py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChannelFavoriteDrawer;