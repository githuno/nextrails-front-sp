"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { HistoryItem, formatWatchedDate, formatWatchedTime, formatDuration } from "./constants";
import youtubeClient from "./client";

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onVideoSelect: (videoId: string) => void;
}

const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  onVideoSelect,
}) => {
  // 履歴更新のトリガー用state
  const [historyUpdateTrigger, setHistoryUpdateTrigger] = useState<number>(0);

  // ドロワーが開かれたときにデータを再読み込み
  useEffect(() => {
    if (isOpen) {
      setHistoryUpdateTrigger((prev) => prev + 1);
    }
  }, [isOpen]);

  // 履歴を削除する関数
  const removeFromHistory = useCallback(
    (event: React.MouseEvent, videoId: string) => {
      event.stopPropagation(); // クリックイベントの伝播を停止

      try {
        youtubeClient.removeFromHistory(videoId);
        setHistoryUpdateTrigger((prev) => prev + 1);
      } catch (error) {
        console.error("履歴からの削除に失敗しました:", error);
      }
    },
    []
  );

  // 履歴データを取得して日付ごとに整理
  const historyData = useMemo(() => {
    if (!isOpen) {
      return { byDate: {}, sortedDates: [], total: 0 };
    }

    const history = youtubeClient.getHistory();

    // 日付ごとにグループ化
    const byDate = history.reduce(
      (acc: { [date: string]: HistoryItem[] }, item) => {
        const dateKey = formatWatchedDate(item.watchedAt);

        if (!acc[dateKey]) {
          acc[dateKey] = [];
        }

        acc[dateKey].push(item);
        return acc;
      },
      {}
    );

    // 日付を新しい順にソート
    const sortedDates = Object.keys(byDate).sort((a, b) => {
      const dateA = new Date(byDate[a][0].watchedAt);
      const dateB = new Date(byDate[b][0].watchedAt);
      return dateB.getTime() - dateA.getTime();
    });

    return {
      byDate,
      sortedDates,
      total: history.length,
    };
  }, [isOpen, historyUpdateTrigger]);

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
            視聴履歴 ({historyData.total}件)
          </h3>
          <button
            onClick={() => {
              if (window.confirm("すべての視聴履歴を削除しますか？")) {
                youtubeClient.clearHistory();
                setHistoryUpdateTrigger((prev) => prev + 1);
              }
            }}
            className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
          >
            履歴を削除
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-4">
          {historyData.total === 0 ? (
            <p className="text-gray-500 text-center py-8">
              視聴履歴がありません
            </p>
          ) : (
            historyData.sortedDates.map((date) => (
              <div key={date} className="mb-6">
                <h4 className="text-sm font-semibold text-gray-600 mb-2 sticky top-0 bg-white py-1">
                  {date}
                </h4>
                <div className="space-y-2">
                  {/* 履歴アイテムの表示部分 */}
                  {historyData.byDate[date].map((item) => (
                    <div
                      key={`${item.videoId}-${item.watchedAt}`}
                      onClick={() => onVideoSelect(item.videoId)}
                      className="p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 flex relative"
                    >
                      {/* サムネイル */}
                      <div className="flex-shrink-0 w-20 h-14 mr-3">
                        <img
                          src={item.thumbnailUrl}
                          alt={item.title}
                          className="w-full h-full object-cover rounded"
                        />
                      </div>

                      {/* 情報 */}
                      <div className="flex-grow pr-6">
                        <div className="text-sm font-medium line-clamp-2">
                          {item.title}
                        </div>
                        <div className="text-xs text-gray-600 mt-1 flex justify-between">
                          <span>{item.channelTitle}</span>
                          <span>{formatWatchedTime(item.watchedAt)}</span>
                        </div>

                        {/* 再生位置表示 */}
                        {item.currentTime && item.duration && (
                          <div className="mt-1">
                            <div className="h-1 w-full bg-gray-200 rounded-full">
                              <div
                                className="h-1 bg-red-500 rounded-full"
                                style={{
                                  width: `${Math.min(
                                    (item.currentTime / item.duration) * 100,
                                    100
                                  )}%`,
                                }}
                              />
                            </div>
                            <div className="text-xs text-gray-500 text-right mt-0.5">
                              {formatDuration(
                                `PT${Math.floor(item.currentTime)}S`
                              )}{" "}
                              /{" "}
                              {formatDuration(
                                `PT${Math.floor(item.duration)}S`
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 削除ボタン */}
                      <button
                        onClick={(e) => removeFromHistory(e, item.videoId)}
                        className="absolute top-2 right-2 text-gray-400 hover:text-red-500 p-1"
                        title="履歴から削除"
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
            ))
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

export default HistoryDrawer;
