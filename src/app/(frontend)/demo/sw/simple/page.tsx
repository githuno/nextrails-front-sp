"use client";
import React, { useState, useEffect } from "react";
import { useServiceWorker } from "@/hooks/useWorkerService";

/**
 * useServiceWorkerの基本的な使用例
 *
 * このコンポーネントは:
 * 1. ServiceWorkerの登録と状態の表示
 * 2. 簡単なメッセージの送受信
 * 3. 購読によるイベント通知の受信
 */
const SimpleServiceWorkerDemo = () => {
  // メッセージの状態
  const [message, setMessage] = useState<string>("");
  const [response, setResponse] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [cacheInfo, setCacheInfo] = useState<{
    count: number;
    name: string;
  } | null>(null);

  // useServiceWorkerフックの初期化（基本的な機能のみ使用）
  const {
    isSupported,
    isRegistered,
    register,
    sendMessage,
    subscribeToMessage,
  } = useServiceWorker();

  // ログ表示用関数
  const addLog = (text: string) => {
    setLogs((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()} - ${text}`,
    ]);
  };

  // ServiceWorkerを登録する
  const handleRegister = async () => {
    try {
      addLog("Service Workerを登録中...");

      const registration = await register({
        path: "/sw.js",
        debug: true,
      });

      if (registration) {
        addLog("Service Worker登録成功！");
      } else {
        addLog("Service Worker登録失敗");
      }
    } catch (error) {
      addLog(
        `エラー: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  // メッセージを送信する
  const handleSendMessage = async () => {
    if (!isRegistered) {
      addLog("Service Workerが登録されていません");
      return;
    }

    try {
      addLog(`メッセージを送信: "${message}"`);

      // ECHOメッセージを送信して応答を待つ
      const result = await sendMessage<{ text: string }, { result: string }>({
        type: "ECHO",
        payload: { text: message },
      });

      if (result) {
        setResponse(result.result);
        addLog(`応答を受信: "${result.result}"`);
      } else {
        addLog("応答がありませんでした");
      }
    } catch (error) {
      addLog(
        `エラー: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  const checkCache = async () => {
    if (!isRegistered) {
      addLog("Service Workerが登録されていません");
      return;
    }

    try {
      addLog("キャッシュ情報を確認中...");
      const result = await sendMessage<null, { cacheInfo: any }>({
        type: "GET_CACHE_INFO",
      });

      if (result?.cacheInfo) {
        setCacheInfo({
          count: result.cacheInfo.totalCaches,
          name: result.cacheInfo.details[0]?.name || "不明",
        });
        addLog(`${result.cacheInfo.totalCaches}個のキャッシュが見つかりました`);
      } else {
        setCacheInfo(null);
        addLog("キャッシュはありません");
      }
    } catch (error) {
      addLog(
        `エラー: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  // キャッシュ更新メッセージの購読
  useEffect(() => {
    if (isRegistered) {
      // CACHE_UPDATEDイベントを購読
      const unsubscribe = subscribeToMessage("CACHE_UPDATED", (data: any) => {
        addLog(`キャッシュ更新通知: ${JSON.stringify(data)}`);
      });

      return unsubscribe; // クリーンアップ時に購読解除
    }
  }, [isRegistered, subscribeToMessage]);

  return (
    <div className="flex flex-col p-8 max-w-2xl mx-auto items-center">
      <h1 className="text-2xl font-bold mb-6">Service Worker シンプルデモ</h1>
      {/* サポート状態と登録状態 */}
      <div className="w-full p-4 bg-gray-50 rounded-lg border mb-6">
        <h2 className="text-lg font-medium mb-2">ステータス</h2>
        <div className="flex items-center space-x-2">
          <span className="text-sm">Service Worker:</span>
          <span
            className={`px-2 py-1 rounded text-xs ${
              isSupported
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {isSupported ? "サポート" : "未サポート"}
          </span>

          <span className="text-sm ml-4">登録状態:</span>
          <span
            className={`px-2 py-1 rounded text-xs ${
              isRegistered
                ? "bg-green-100 text-green-800"
                : "bg-yellow-100 text-yellow-800"
            }`}
          >
            {isRegistered ? "登録済み" : "未登録"}
          </span>
        </div>

        {!isRegistered && (
          <button
            onClick={handleRegister}
            disabled={!isSupported || isRegistered}
            className="mt-3 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
          >
            Service Workerを登録
          </button>
        )}
      </div>
      {/* メッセージ送信フォーム */}
      <div className="w-full p-4 bg-gray-50 rounded-lg border mb-6">
        <h2 className="text-lg font-medium mb-2">メッセージ送信</h2>
        <div className="flex mb-3">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="メッセージを入力"
            className="flex-grow p-2 border rounded-l"
          />
          <button
            onClick={handleSendMessage}
            disabled={!isRegistered || !message}
            className="px-4 py-2 bg-green-500 text-white rounded-r hover:bg-green-600 disabled:bg-gray-300"
          >
            送信
          </button>
        </div>

        {response && (
          <div className="p-3 bg-blue-50 border border-blue-100 rounded">
            <p className="text-sm font-medium">応答:</p>
            <p className="text-sm">{response}</p>
          </div>
        )}
      </div>
      {/* ログ表示 */}
      <div className="w-full p-4 bg-gray-50 rounded-lg border mb-6">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-medium">ログ</h2>
          <button
            onClick={() => setLogs([])}
            className="text-xs px-2 py-1 bg-gray-200 rounded"
          >
            クリア
          </button>
        </div>
        <div className="bg-white border rounded p-2 h-48 overflow-y-auto">
          {logs.length === 0 ? (
            <p className="text-gray-400 text-sm">ログはありません</p>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="text-xs mb-1 font-mono">
                {log}
              </div>
            ))
          )}
        </div>
      </div>
      {/* キャッシュ情報表示 */}
      <div className="w-full p-4 bg-gray-50 rounded-lg border">
        <h2 className="text-lg font-medium mb-2">キャッシュステータス</h2>

        <div className="flex items-center space-x-2 mb-2">
          <span className="text-sm">キャッシュ:</span>
          {cacheInfo === null ? (
            <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">
              確認されていません
            </span>
          ) : cacheInfo.count > 0 ? (
            <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">
              {cacheInfo.count}件（{cacheInfo.name}）
            </span>
          ) : (
            <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">
              なし
            </span>
          )}
        </div>

        <div className="flex space-x-2">
          <button
            onClick={checkCache}
            disabled={!isRegistered}
            className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
          >
            キャッシュを確認
          </button>

          <button
            onClick={async () => {
              if (!isRegistered) return;
              addLog("デモキャッシュアイテムを追加中...");
              await sendMessage({
                type: "CACHE_DEMO_ITEM",
                payload: {
                  url: window.location.origin + `/demo-item-${Date.now()}.html`,
                  cacheName: "demo-cache-v1",
                },
              });
              addLog("キャッシュアイテムを追加しました");
              checkCache();
            }}
            disabled={!isRegistered}
            className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300"
          >
            アイテム追加
          </button>

          <button
            onClick={async () => {
              if (!isRegistered) return;
              addLog("キャッシュをクリア中...");
              const result = await sendMessage<
                { cacheName: string },
                { success: boolean }
              >({
                type: "CACHE_UPDATED",
                payload: { cleared: true, cacheName: "demo-cache-v1" },
              });
              addLog(
                result?.success
                  ? "キャッシュクリア成功"
                  : "キャッシュクリア失敗"
              );
              checkCache();
            }}
            disabled={
              !isRegistered || (cacheInfo !== null && cacheInfo.count === 0)
            }
            className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-300"
          >
            キャッシュクリア
          </button>
        </div>
      </div>
      {/* 詳細デモへのリンク */}
      <div className="mt-8">
        <a href="/demo/sw" className="text-blue-500 hover:underline">
          詳細デモページへ
        </a>
        <p className="text-xs text-gray-500 mt-1">
          ※詳細デモでは、useServiceWorkerの全機能を体験できます
        </p>
      </div>
    </div>
  );
};

export default SimpleServiceWorkerDemo;
