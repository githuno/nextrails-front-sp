"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { usePubSub } from "@/hooks/usePubSub";
import Link from "next/link";
import React from "react";

// 接続状態を表す型
type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

// イベントデータの型
interface EventData {
  type: string;
  timestamp: number;
  source?: string;
  data?: any;
  initial?: boolean;
  [key: string]: any;
}

// 接続時間を表示する独立したコンポーネント
const ConnectionTimer = ({
  connectionTime,
}: {
  connectionTime: number | null;
}) => {
  const [elapsedTime, setElapsedTime] = useState<string | null>(null);

  useEffect(() => {
    if (!connectionTime) {
      setElapsedTime(null);
      return;
    }

    // 初回計算
    updateElapsedTime();
    // 1秒ごとに更新
    const intervalId = setInterval(updateElapsedTime, 1000);
    // クリーンアップ関数
    return () => clearInterval(intervalId);

    function updateElapsedTime() {
      const duration = connectionTime
        ? Math.floor((Date.now() - connectionTime) / 1000)
        : 0;
      let formattedTime: string;
      if (duration < 60) {
        formattedTime = `${duration}秒`;
      } else if (duration < 3600) {
        formattedTime = `${Math.floor(duration / 60)}分 ${duration % 60}秒`;
      } else {
        formattedTime = `${Math.floor(duration / 3600)}時間 ${Math.floor(
          (duration % 3600) / 60
        )}分`;
      }
      setElapsedTime(formattedTime);
    }
  }, [connectionTime]);

  if (!connectionTime || !elapsedTime) return null;

  return <span>接続時間: {elapsedTime}</span>;
};

// 最新イベントを表示するメモ化コンポーネント
const LastEventCard = React.memo(
  ({
    event,
    getEventBadgeClasses,
  }: {
    event: EventData | null;
    getEventBadgeClasses: (type: string) => string;
  }) => {
    if (!event) {
      return (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center text-gray-500 dark:text-gray-400 italic">
          イベントを受信していません
        </div>
      );
    }

    return (
      <div
        className={`bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 ${
          event.initial ? "opacity-70" : ""
        }`}
      >
        <div className="flex justify-between items-center mb-2">
          <span
            className={`text-sm px-2 py-0.5 rounded-full font-medium ${getEventBadgeClasses(
              event.type
            )}`}
          >
            {event.type}
          </span>
          <span className="text-sm font-mono text-gray-500 dark:text-gray-400">
            {new Date(event.timestamp).toLocaleTimeString()}
          </span>
        </div>

        {event.source && (
          <div className="text-xs mb-2 text-gray-500 dark:text-gray-400">
            ソース: <span className="font-medium">{event.source}</span>
            {event.initial && (
              <span className="ml-2 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 px-1 py-0.5 rounded text-xs">
                過去のイベント
              </span>
            )}
          </div>
        )}

        <div className="mt-2 bg-gray-100 dark:bg-gray-700 p-2 rounded-md overflow-x-auto">
          <pre className="text-xs text-gray-800 dark:text-gray-200">
            {JSON.stringify(event, null, 2)}
          </pre>
        </div>
      </div>
    );
  }
);
// 表示名を追加
LastEventCard.displayName = "LastEventCard";

// イベント履歴を表示するメモ化コンポーネント
const EventHistoryList = React.memo(
  ({
    events,
    getEventBadgeClasses,
  }: {
    events: EventData[];
    getEventBadgeClasses: (type: string) => string;
  }) => {
    if (events.length === 0) {
      return (
        <div className="p-4 text-center text-gray-500 dark:text-gray-400 italic">
          履歴はありません
        </div>
      );
    }

    return (
      <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
        {events.map((event, index) => (
          <div
            key={`${event.type}-${event.timestamp}-${index}`}
            className={`p-3 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors ${
              event.initial ? "opacity-70 bg-gray-50 dark:bg-gray-800/50" : ""
            }`}
          >
            <div className="flex justify-between items-center">
              <span
                className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getEventBadgeClasses(
                  event.type
                )}`}
              >
                {event.type}
              </span>
              <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>
            </div>

            <div className="mt-1 text-xs text-gray-600 dark:text-gray-300 flex gap-2">
              {event.source && (
                <span className="bg-gray-100 dark:bg-gray-700 px-1 rounded">
                  ソース: {event.source}
                </span>
              )}

              {event.initial && (
                <span className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 px-1 rounded">
                  過去のイベント
                </span>
              )}

              {/* 特定のイベントタイプに対する追加情報 */}
              {event.type === "user:login" && event.data?.userId && (
                <span className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-1 rounded">
                  ユーザーID: {event.data.userId}
                </span>
              )}

              {event.type === "ui:theme:changed" && event.data?.theme && (
                <span className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 px-1 rounded">
                  テーマ: {event.data.theme}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }
);
// 表示名を追加
EventHistoryList.displayName = "EventHistoryList";

export default function Page() {
  // 接続状態を管理
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  // 接続試行回数
  const [retryCount, setRetryCount] = useState(0);
  // 最後に受信したイベント
  const [lastEvent, setLastEvent] = useState<EventData | null>(null);
  // 受信したイベントの履歴
  const [eventHistory, setEventHistory] = useState<EventData[]>([]);
  // EventSourceの参照
  const eventSourceRef = useRef<EventSource | null>(null);
  // 接続時間を記録
  const [connectionTime, setConnectionTime] = useState<number | null>(null);
  // 手動で接続解除したかを追跡
  const [manuallyDisconnected, setManuallyDisconnected] = useState(false);
  // ハートビートだけを履歴に含めるかの設定
  const [showHeartbeats, setShowHeartbeats] = useState(false);
  // pubSubフックを使用
  const { publish } = usePubSub();

  // イベントタイプに基づいたバッジの色をメモ化
  const getEventBadgeClasses = useCallback((type: string) => {
    if (type === "heartbeat")
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    if (type === "update")
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    if (type.includes("user:"))
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    if (type.includes("ui:"))
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
    if (type.includes("error"))
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    if (type.includes("data:"))
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    if (type.includes("manual:"))
      return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
    return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200";
  }, []);

  // 状態に応じたクラス名をメモ化
  const statusClasses = useMemo(() => {
    switch (status) {
      case "connected":
        return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-200 dark:border-green-800";
      case "connecting":
        return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-800";
      case "error":
        return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700";
    }
  }, [status]);

  // 接続状態を示すアイコンをメモ化
  const StatusIcon = useMemo(() => {
    switch (status) {
      case "connected":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-green-500"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        );
      case "connecting":
        return (
          <svg
            className="animate-spin h-5 w-5 text-yellow-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        );
      case "error":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-red-500"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        );
      default:
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-gray-500"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z"
              clipRule="evenodd"
            />
          </svg>
        );
    }
  }, [status]);

  // SSE接続を確立する関数をメモ化 - 完全な実装に修正
  const connectToSSE = useCallback(() => {
    if (eventSourceRef.current) {
      // 既存の接続がある場合は閉じる
      eventSourceRef.current.close();
    }

    setStatus("connecting");
    setManuallyDisconnected(false);

    // 新しいEventSourceを作成
    const eventSource = new EventSource("/api/demo/sse");
    eventSourceRef.current = eventSource;

    // 接続開始
    eventSource.onopen = () => {
      setStatus("connected");
      setConnectionTime(Date.now());
      setRetryCount(0);
    };

    // メッセージ受信時の処理
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as EventData;

        // ハートビートでない場合、または表示設定がオンの場合のみ処理
        if (data.type !== "heartbeat" || showHeartbeats) {
          // イベントデータを更新
          setLastEvent(data);

          // 履歴に追加（最新20件を保持）
          setEventHistory((prev) => [data, ...prev].slice(0, 20));

          // PubSubにイベントを流す（ハートビート以外）
          if (data.type !== "heartbeat") {
            const eventName = `server:${data.type}`;
            // publish関数を使用
            publish(eventName as any, data);

            // グローバルSSEイベントも発行
            publish("server:event" as any, data);
          }
        }
      } catch (error) {
        console.error("イベントの解析に失敗しました:", error);
      }
    };

    // エラー発生時の処理
    eventSource.onerror = (error) => {
      console.error("SSE接続エラー:", error);
      setStatus("error");

      // 手動切断でない場合は再接続を試みる
      if (!manuallyDisconnected) {
        eventSource.close();
        eventSourceRef.current = null;

        // 再接続回数を増やす
        setRetryCount((prev) => prev + 1);

        // 最大5回まで再接続を試みる（指数バックオフ）
        if (retryCount < 5) {
          const timeout = Math.min(1000 * Math.pow(2, retryCount), 30000);

          console.log(
            `${timeout}ms後に再接続を試みます...(試行: ${retryCount + 1}/5)`
          );

          setTimeout(() => {
            if (!manuallyDisconnected) {
              connectToSSE();
            }
          }, timeout);
        } else {
          console.log(
            "再接続の最大試行回数に達しました。手動で接続してください。"
          );
        }
      }
    };
  }, [retryCount, manuallyDisconnected, showHeartbeats, publish]);

  // 接続を手動で切断する関数をメモ化
  const disconnectSSE = useCallback(() => {
    setManuallyDisconnected(true);

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setStatus("disconnected");
      setConnectionTime(null);
    }
  }, []);

  // 履歴をクリアする関数をメモ化
  const clearHistory = useCallback(() => {
    setEventHistory([]);
    setLastEvent(null);
  }, []);

  // useEffectの修正 - コンポーネントマウント時のみ接続し、manuallyDisconnectedは初期マウント後に監視
  useEffect(() => {
    // 初回マウント時のみ接続を試みる（コンポーネントのマウント時）
    connectToSSE();

    // クリーンアップ時に接続を閉じる
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 依存配列を空にし、初回マウント時のみ実行

  // 手動切断状態を監視する別のuseEffect
  useEffect(() => {
    // マウント直後は何もしない（初期接続は上のuseEffectで処理）
    if (manuallyDisconnected) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    }
  }, [manuallyDisconnected]);

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-6 border-b pb-2">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
          サーバー送信イベント (SSE) デモ
        </h1>
        <Link
          href="/demo/pubsub"
          className="text-sm bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800 px-3 py-1 rounded-md transition-colors"
        >
          PubSubページへ
        </Link>
      </div>

      {/* 接続ステータスカード */}
      <div
        className={`mb-6 p-4 border rounded-lg flex items-start justify-between ${statusClasses}`}
      >
        <div className="flex items-center">
          {StatusIcon}
          <div className="ml-3">
            <h2 className="font-semibold">
              {status === "connected" && "接続中"}
              {status === "connecting" && "接続試行中..."}
              {status === "disconnected" && "切断済み"}
              {status === "error" && "接続エラー"}
            </h2>
            <div className="text-sm mt-1">
              {status === "connected" && (
                <ConnectionTimer connectionTime={connectionTime} />
              )}
              {status === "connecting" && (
                <span>再接続試行: {retryCount}/5</span>
              )}
              {status === "error" && (
                <span>接続に失敗しました。再接続を試みています...</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {status === "connected" && (
            <button
              onClick={disconnectSSE}
              className="px-3 py-1 text-sm bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-800 rounded-md transition-colors"
            >
              切断
            </button>
          )}

          {(status === "disconnected" ||
            (status === "error" && retryCount >= 5)) && (
            <button
              onClick={connectToSSE}
              className="px-3 py-1 text-sm bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800 rounded-md transition-colors"
            >
              接続
            </button>
          )}

          <button
            onClick={clearHistory}
            className="px-3 py-1 text-sm bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
          >
            履歴クリア
          </button>
        </div>
      </div>

      {/* フィルタオプション */}
      <div className="mb-4 flex items-center">
        <label className="inline-flex items-center text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={showHeartbeats}
            onChange={() => setShowHeartbeats(!showHeartbeats)}
            className="form-checkbox h-4 w-4 text-blue-600 transition duration-150 ease-in-out"
          />
          <span className="ml-2">ハートビートを表示</span>
        </label>
      </div>

      {/* 最新イベント情報 */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-2 flex items-center">
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
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          最新イベント
        </h2>

        <LastEventCard
          event={lastEvent}
          getEventBadgeClasses={getEventBadgeClasses}
        />
      </div>

      {/* イベント履歴 */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2 text-purple-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            イベント履歴
          </h2>

          <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
            {eventHistory.length}件のイベント
          </span>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <EventHistoryList
            events={eventHistory}
            getEventBadgeClasses={getEventBadgeClasses}
          />
        </div>
      </div>

      {/* PubSub情報 */}
      <div className="mt-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-lg">
        <h2 className="text-sm font-semibold text-indigo-800 dark:text-indigo-200 mb-2 flex items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 mr-1"
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
          PubSub連携情報
        </h2>
        <p className="text-xs text-indigo-700 dark:text-indigo-300">
          受信したSSEイベントは
          <code className="bg-indigo-100 dark:bg-indigo-800 px-1 py-0.5 rounded">
            publish(&apos;server:event&apos;, data)
          </code>
          および
          <code className="bg-indigo-100 dark:bg-indigo-800 px-1 py-0.5 rounded">
            publish(&apos;server:イベント名&apos;, data)
          </code>
          を通じてPubSubシステムに送信されます。
        </p>
        <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">
          例: PubSubページでのログインイベントは
          <code className="bg-indigo-100 dark:bg-indigo-800 px-1 py-0.5 rounded">
            server:user:login
          </code>
          として受信できます。
        </p>
      </div>
    </div>
  );
}
