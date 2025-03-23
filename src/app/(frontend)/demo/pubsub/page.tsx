"use client";

import React, { useState, useEffect, useCallback, useRef, use } from "react";
import { usePubSub } from "@/hooks/usePubSub";

/**
 * ユーザー認証状態を監視するコンポーネント
 */
function UserAuthMonitor() {
  const [lastLogin, setLastLogin] = useState<string | null>(null);
  const { subscribe } = usePubSub();

  // useEffectで一度だけ購読設定
  useEffect(() => {
    subscribe([
      {
        event: "user:login",
        callback: (data: { userId: string; timestamp: number }) => {
          setLastLogin(new Date(data.timestamp).toLocaleString());
          console.log(`User ${data.userId} logged in!`);
        },
      },
      {
        event: "user:logout",
        callback: (data: { userId: string; timestamp: number }) => {
          console.log(`User ${data.userId} logged out. See you next time!`);
        },
      },
    ]);
  }, [subscribe]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-all duration-300">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 border-b pb-2 border-gray-200 dark:border-gray-700">
        認証監視
      </h3>
      {lastLogin ? (
        <p className="text-gray-700 dark:text-gray-300">
          <span className="font-medium">最終ログイン:</span>
          <span className="ml-2 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 rounded-full text-sm">
            {lastLogin}
          </span>
        </p>
      ) : (
        <p className="text-gray-500 dark:text-gray-400 italic">
          ログイン情報はまだありません
        </p>
      )}
    </div>
  );
}

/**
 * テーマ設定コンポーネント
 */
function ThemeSelector() {
  // テーマデータの状態
  const [themeData, setThemeData] = useState<{
    theme: "light" | "dark" | "system";
  }>({
    theme: "system",
  });
  const { subscribe, publish } = usePubSub();

  useEffect(() => {
    subscribe(
      "ui:theme:changed",
      (data: { theme: "light" | "dark" | "system" }) => {
        setThemeData(data);
      }
    );
  }, [subscribe]);

  const handleThemeChange = (theme: "light" | "dark" | "system") => {
    // テーマ変更イベントを発行
    publish("ui:theme:changed", { theme });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-all duration-300">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 border-b pb-2 border-gray-200 dark:border-gray-700">
        テーマ設定
      </h3>
      <p className="text-gray-700 dark:text-gray-300 mb-4">
        現在のテーマ:
        <span
          className={`ml-2 px-3 py-1 rounded-full text-sm font-medium
          ${
            themeData?.theme === "light"
              ? "bg-yellow-100 text-yellow-800"
              : themeData?.theme === "dark"
              ? "bg-indigo-100 text-indigo-800"
              : "bg-green-100 text-green-800"
          }`}
        >
          {themeData?.theme === "light"
            ? "ライト"
            : themeData?.theme === "dark"
            ? "ダーク"
            : "システム"}
        </span>
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => handleThemeChange("light")}
          className={`px-4 py-2 rounded-md transition-all duration-200 
            ${
              themeData?.theme === "light"
                ? "bg-yellow-500 text-white shadow-md"
                : "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-100 dark:hover:bg-yellow-800"
            }`}
        >
          <span className="flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            ライト
          </span>
        </button>
        <button
          onClick={() => handleThemeChange("dark")}
          className={`px-4 py-2 rounded-md transition-all duration-200
            ${
              themeData?.theme === "dark"
                ? "bg-indigo-500 text-white shadow-md"
                : "bg-indigo-100 text-indigo-800 hover:bg-indigo-200 dark:bg-indigo-900 dark:text-indigo-100 dark:hover:bg-indigo-800"
            }`}
        >
          <span className="flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
              />
            </svg>
            ダーク
          </span>
        </button>
        <button
          onClick={() => handleThemeChange("system")}
          className={`px-4 py-2 rounded-md transition-all duration-200
            ${
              themeData?.theme === "system"
                ? "bg-green-500 text-white shadow-md"
                : "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-100 dark:hover:bg-green-800"
            }`}
        >
          <span className="flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            システム
          </span>
        </button>
      </div>
    </div>
  );
}

/**
 * データ読み込みとモーダル制御の例
 */
function DataLoadingExample() {
  // 状態管理
  const [isLoading, setIsLoading] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const { publish, waitFor } = usePubSub();

  // 型定義を明示的に導入
  type LoadedData = {
    source: string;
    items: Array<{ id: number; name: string }>;
  };

  // 自前のデータ状態管理
  const [loadedData, setLoadedData] = useState<LoadedData | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);

  // タイムアウト処理用の参照
  const timeoutRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // データ読み込み関数
  const handleLoadData = async () => {
    setIsLoading(true);
    setIsWaiting(true);
    // 既存データをクリア
    setLoadedData(null);
    // エラーをリセット
    setLoadError(null);

    // 前回のタイムアウトをクリア
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // 前回の処理がある場合は中止
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 新しいAbortControllerを作成
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    // データ読み込み開始のモーダルを表示
    publish("ui:modal:open", {
      id: "loading-modal",
      data: { message: "データを読み込んでいます..." },
    });

    try {
      // タイムアウト処理を設定
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutRef.current = window.setTimeout(() => {
          reject(new Error("データ読み込みがタイムアウトしました"));
        }, 3000); // 3秒でタイムアウト
      });

      // データロード処理を設定
      const dataPromise = (async () => {
        try {
          // 並行してデータロードをシミュレート
          setTimeout(() => {
            if (!signal.aborted) {
              const data: LoadedData = {
                source: "api",
                items: [
                  { id: 1, name: "商品A" },
                  { id: 2, name: "商品B" },
                  { id: 3, name: "商品C" },
                ],
              };
              // イベントを発行
              publish("data:loaded", data);
            }
          }, 2000); // 2秒後にデータを読み込む

          // イベント待機
          return await waitFor("data:loaded", 5000);
        } catch (error) {
          if (signal.aborted) return;
          throw error;
        }
      })();

      // Promise.raceでタイムアウトとデータロードを競争させる
      const data = await Promise.race([
        dataPromise,
        timeoutPromise,
        new Promise<never>((_, reject) => {
          signal.addEventListener("abort", () => {
            reject(new Error("操作が中止されました"));
          });
        }),
      ]);

      // タイムアウトのクリア
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // データを設定
      setLoadedData(data as LoadedData);
      setIsWaiting(false);

      // モーダルを閉じる
      publish("ui:modal:close", { id: "loading-modal" });

      // 成功モーダルを表示
      publish("ui:modal:open", {
        id: "success-modal",
        data: {
          message: `${
            (data as LoadedData).items.length
          }件のデータを読み込みました`,
        },
      });
    } catch (error) {
      // エラー処理
      console.error("Data loading failed:", error);
      setLoadError(error instanceof Error ? error : new Error(String(error)));
      setIsWaiting(false);
      // エラーイベントを発行
      publish("app:error", {
        message: "データ読み込みがタイムアウトしました",
        code: 408,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // リセット関数
  const reset = () => {
    setLoadedData(null);
    setLoadError(null);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-all duration-300">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 border-b pb-2 border-gray-200 dark:border-gray-700">
        データ読み込み
      </h3>

      <button
        onClick={handleLoadData}
        disabled={isLoading || isWaiting}
        className={`w-full mb-4 py-2 px-4 rounded-md font-medium transition-all duration-200 
          ${
            isLoading || isWaiting
              ? "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              : "bg-blue-500 hover:bg-blue-600 text-white shadow-sm hover:shadow-md"
          }`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center">
            <svg
              className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
            読み込み中...
          </span>
        ) : (
          <span className="flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            データを読み込む
          </span>
        )}
      </button>

      {/* タイムアウト状態の表示 */}
      {isWaiting && (
        <div className="bg-yellow-50 dark:bg-yellow-900/30 p-3 rounded-md mb-4 text-yellow-800 dark:text-yellow-200 text-sm">
          データ待機中...
        </div>
      )}

      {loadedData && (
        <div className="bg-blue-50 dark:bg-blue-900/30 rounded-md p-4 mt-4 animate-fadeIn">
          {/* データの表示部分を更新 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
            {loadedData.items.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-gray-700 p-3 rounded shadow-sm"
              >
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  ID: {item.id}
                </div>
                <div className="font-medium">{item.name}</div>
              </div>
            ))}
          </div>
          <button
            onClick={reset}
            className="text-sm px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 dark:bg-red-900 dark:hover:bg-red-800 dark:text-red-200 rounded transition-colors duration-200"
          >
            リセット
          </button>
        </div>
      )}

      {loadError && (
        <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 p-4 rounded-md mt-4 flex items-start">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <p className="font-medium">エラー</p>
            <p className="text-sm mt-1">{loadError.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * すべてのアプリケーションイベントを監視する例
 */
function UserEventsMonitor() {
  const [events, setEvents] = useState<Array<{ name: string; time: string }>>(
    []
  );
  const { subscribe } = usePubSub();

  // イベントを追加する共通関数
  const addEvent = useCallback((eventName: string) => {
    setEvents((prev) => [
      {
        name: eventName,
        time: new Date().toLocaleTimeString(),
      },
      ...prev.slice(0, 9), // 最新10件のみ保持
    ]);
  }, []);

  // コンポーネントのマウント時にイベント購読を設定
  useEffect(() => {
    subscribe([
      { event: "user:login", callback: () => addEvent("user:login") },
      { event: "user:logout", callback: () => addEvent("user:logout") },
      {
        event: "user:preferences:changed",
        callback: () => addEvent("user:preferences:changed"),
      },
      { event: "app:error", callback: () => addEvent("app:error") },
      {
        event: "ui:theme:changed",
        callback: () => addEvent("ui:theme:changed"),
      },
      { event: "data:loaded", callback: () => addEvent("data:loaded") },
    ]);
  }, [subscribe, addEvent]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-all duration-300">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 border-b pb-2 border-gray-200 dark:border-gray-700 flex items-center">
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
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        イベント監視
      </h3>
      {events.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md text-gray-500 dark:text-gray-400 text-center italic">
          イベントはまだありません
        </div>
      ) : (
        <ul className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
          {events.map((event, i) => (
            <li
              key={i}
              className={`flex justify-between p-2 rounded-md ${
                i === 0
                  ? "bg-blue-50 dark:bg-blue-900/30 animate-pulse"
                  : "bg-gray-50 dark:bg-gray-700"
              }`}
            >
              <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                {event.time}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-sm font-medium ${
                  event.name.includes("login")
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                    : event.name.includes("logout")
                    ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                    : event.name.includes("error")
                    ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                    : event.name.includes("theme")
                    ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                    : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                }`}
              >
                {event.name}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
/**
 * イベント待機（waitFor）の使用例
 */
function AsyncEventWaiter() {
  const [status, setStatus] = useState<
    "idle" | "waiting" | "success" | "error"
  >("idle");
  const [waitResult, setWaitResult] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { waitFor } = usePubSub();

  const handleWaitForEvent = async () => {
    setStatus("waiting");
    setWaitResult(null);

    // 前回の処理がある場合は中止
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 新しいAbortControllerを作成
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      // Promise.raceを使用してAbortSignalとイベント待機を競争させる
      await Promise.race([
        // 非同期でイベントを待機
        (async () => {
          try {
            // 任意のイベントが発生するのを最大10秒間待機
            const data = await waitFor("user:login", 10000);
            if (signal.aborted) return;

            setStatus("success");
            setWaitResult(
              `ユーザーID: ${data.userId}が${new Date(
                data.timestamp
              ).toLocaleString()}にログインしました`
            );
          } catch (error) {
            if (signal.aborted) return;
            throw error;
          }
        })(),

        // AbortSignalの監視
        new Promise((_, reject) => {
          signal.addEventListener("abort", () => {
            reject(new Error("操作が中止されました"));
          });
        }),
      ]);
    } catch (error) {
      if (!signal.aborted) {
        setStatus("error");
        setWaitResult(error instanceof Error ? error.message : String(error));
      }
    }
  };

  // 処理をキャンセル
  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setStatus("idle");
      setWaitResult("待機がキャンセルされました");
    }
  };

  // コンポーネントのクリーンアップ
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-all duration-300">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 border-b pb-2 border-gray-200 dark:border-gray-700 flex items-center">
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
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        イベント待機 (waitFor)
      </h3>

      <div className="mb-4">
        <p className="text-gray-600 dark:text-gray-300 text-sm mb-3">
          <code>waitFor</code>
          メソッドを使うと、特定のイベントが発生するまで非同期に待機できます。
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleWaitForEvent}
            disabled={status === "waiting"}
            className={`px-4 py-2 rounded-md transition-all duration-200 flex items-center
              ${
                status === "waiting"
                  ? "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                  : "bg-purple-500 hover:bg-purple-600 text-white"
              }`}
          >
            {status === "waiting" ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                ログイン待機中...
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                ログインイベント待機
              </>
            )}
          </button>

          {status === "waiting" && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 rounded-md bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-800 transition-all duration-200"
            >
              キャンセル
            </button>
          )}
        </div>
      </div>

      {/* 結果表示エリア */}
      {waitResult && (
        <div
          className={`p-3 rounded-md mt-3 text-sm
          ${
            status === "success"
              ? "bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200"
              : status === "error"
              ? "bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200"
              : "bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
          }`}
        >
          {waitResult}
        </div>
      )}

      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded">
        注:
        ログインボタンをクリックすると、このコンポーネントは待機状態から完了状態に変わります
      </div>
    </div>
  );
}

/**
 * イベント名前空間管理（clearNamespace）の使用例
 */
import { pubSub } from "@/utils/pubsub";
function EventNamespaceManager() {
  const [userEvents, setUserEvents] = useState<boolean>(true);
  const [uiEvents, setUiEvents] = useState<boolean>(true);
  const [subscribers, setSubscribers] = useState<Record<string, number>>({});
  const { subscribe } = usePubSub();

  // サブスクライバー情報を取得する関数
  const updateSubscribers = useCallback(() => {
    const counts = pubSub.getSubscribersCount();
    setSubscribers(counts);
  }, []);

  // コンポーネントマウント時にサブスクライバー情報を取得
  useEffect(() => {
    updateSubscribers();

    // ダミーイベント購読を追加（表示用）
    const dummyHandlers = [
      pubSub.on("user:profile:updated", () => {}),
      pubSub.on("user:settings:viewed", () => {}),
      pubSub.on("ui:sidebar:toggled", () => {}),
      pubSub.on("ui:modal:animated", () => {}),
    ];

    // イベント発生時にサブスクライバー数を更新
    const eventMonitor = pubSub.on("*", () => {
      updateSubscribers();
    });

    return () => {
      // 全てのダミーイベント購読を解除
      dummyHandlers.forEach((unsub) => unsub());
      eventMonitor();
    };
  }, [updateSubscribers]);

  // 名前空間のイベント購読を解除
  const clearUserNamespace = () => {
    pubSub.clearNamespace("user:");
    setUserEvents(false);
    updateSubscribers();
  };

  const clearUiNamespace = () => {
    pubSub.clearNamespace("ui:");
    setUiEvents(false);
    updateSubscribers();
  };

  // 名前空間の購読を再設定
  const restoreUserNamespace = () => {
    // 新しいダミーイベント購読を設定
    subscribe([
      { event: "user:profile:updated", callback: () => {} },
      { event: "user:settings:viewed", callback: () => {} },
      { event: "user:login", callback: () => {} },
      { event: "user:logout", callback: () => {} },
    ]);
    setUserEvents(true);
    updateSubscribers();
  };

  const restoreUiNamespace = () => {
    // 新しいダミーイベント購読を設定
    subscribe([
      { event: "ui:sidebar:toggled", callback: () => {} },
      { event: "ui:modal:animated", callback: () => {} },
      { event: "ui:theme:changed", callback: () => {} },
    ]);
    setUiEvents(true);
    updateSubscribers();
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-all duration-300">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 border-b pb-2 border-gray-200 dark:border-gray-700 flex items-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 mr-2 text-indigo-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
        名前空間管理 (clearNamespace)
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="border dark:border-gray-700 rounded-md p-3">
          <h4 className="font-medium text-gray-800 dark:text-white mb-2 flex items-center">
            <span className="w-3 h-3 rounded-full bg-blue-500 mr-2"></span>
            ユーザー名前空間
          </h4>

          <div className="flex gap-2 mb-3">
            {userEvents ? (
              <button
                onClick={clearUserNamespace}
                className="px-3 py-1.5 text-sm bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-800 rounded"
              >
                user:名前空間をクリア
              </button>
            ) : (
              <button
                onClick={restoreUserNamespace}
                className="px-3 py-1.5 text-sm bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-800 rounded"
              >
                user:名前空間を復元
              </button>
            )}
          </div>

          <div className="text-xs bg-gray-50 dark:bg-gray-700 p-2 rounded">
            状態: {userEvents ? "アクティブ" : "クリア済み"}
          </div>
        </div>

        <div className="border dark:border-gray-700 rounded-md p-3">
          <h4 className="font-medium text-gray-800 dark:text-white mb-2 flex items-center">
            <span className="w-3 h-3 rounded-full bg-purple-500 mr-2"></span>
            UI名前空間
          </h4>

          <div className="flex gap-2 mb-3">
            {uiEvents ? (
              <button
                onClick={clearUiNamespace}
                className="px-3 py-1.5 text-sm bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-800 rounded"
              >
                ui:名前空間をクリア
              </button>
            ) : (
              <button
                onClick={restoreUiNamespace}
                className="px-3 py-1.5 text-sm bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-800 rounded"
              >
                ui:名前空間を復元
              </button>
            )}
          </div>

          <div className="text-xs bg-gray-50 dark:bg-gray-700 p-2 rounded">
            状態: {uiEvents ? "アクティブ" : "クリア済み"}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <h4 className="font-medium text-gray-800 dark:text-white mb-2">
          現在のサブスクライバー:
        </h4>
        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-md max-h-36 overflow-y-auto text-sm">
          {Object.keys(subscribers).length > 0 ? (
            <ul className="space-y-1">
              {Object.entries(subscribers).map(([event, count]) => (
                <li key={event} className="flex justify-between">
                  <span
                    className={`font-mono ${
                      event.startsWith("user")
                        ? "text-blue-600 dark:text-blue-400"
                        : event.startsWith("ui")
                        ? "text-purple-600 dark:text-purple-400"
                        : event.startsWith("[wildcard]")
                        ? "text-green-600 dark:text-green-400"
                        : "text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {event}
                  </span>
                  <span className="bg-gray-200 dark:bg-gray-600 px-2 rounded-full text-xs">
                    {count}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 italic text-center">
              サブスクライバーが存在しません
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * イベント履歴の表示（getRecentEvents/getEventHistory）
 */
function EventHistoryViewer() {
  const [recentEvents, setRecentEvents] = useState<
    Array<{
      timestamp: number;
      event: string;
      data: any;
      subscribersCount: number;
    }>
  >([]);

  const [isHistoryEnabled, setIsHistoryEnabled] = useState(false);

  // デバッグモードの切り替え機能
  const toggleDebugMode = () => {
    // 注: 実際のアプリでは環境変数をランタイムで変更する方法はないため、
    // これはデモ用の簡易的な実装です
    setIsHistoryEnabled((prev) => !prev);

    // ダミーのイベント履歴を生成
    if (!isHistoryEnabled) {
      setRecentEvents([
        {
          timestamp: Date.now() - 5000,
          event: "app:initialized",
          data: { timestamp: Date.now() - 5000 },
          subscribersCount: 3,
        },
        {
          timestamp: Date.now() - 4000,
          event: "user:login",
          data: { userId: "user123", timestamp: Date.now() - 4000 },
          subscribersCount: 2,
        },
        {
          timestamp: Date.now() - 3000,
          event: "ui:theme:changed",
          data: { theme: "dark" },
          subscribersCount: 1,
        },
        {
          timestamp: Date.now() - 2000,
          event: "data:loaded",
          data: { source: "api", items: [{ id: 1, name: "商品A" }] },
          subscribersCount: 2,
        },
      ]);
    } else {
      setRecentEvents([]);
    }
  };

  // 最新イベントを取得
  const refreshEvents = () => {
    if (isHistoryEnabled) {
      // 実際のアプリでは以下のようになりますが、デモ用に静的データを使用します
      // const events = pubSub.getRecentEvents(10);
      // setRecentEvents(events);

      // ダミーデータに新しいイベントを追加
      const newEvent = {
        timestamp: Date.now(),
        event: ["user:login", "ui:theme:changed", "data:loaded", "app:error"][
          Math.floor(Math.random() * 4)
        ],
        data: { timestamp: Date.now() },
        subscribersCount: Math.floor(Math.random() * 5) + 1,
      };

      setRecentEvents((prev) => [newEvent, ...prev.slice(0, 9)]);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-all duration-300">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 border-b pb-2 border-gray-200 dark:border-gray-700 flex items-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 mr-2 text-green-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
        </svg>
        イベント履歴 (getRecentEvents)
      </h3>

      <div className="mb-4 flex gap-2">
        <button
          onClick={toggleDebugMode}
          className={`px-4 py-2 rounded-md transition-colors duration-200 text-sm
            ${
              isHistoryEnabled
                ? "bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-800"
                : "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-800"
            }`}
        >
          {isHistoryEnabled ? "デバッグモード無効化" : "デバッグモード有効化"}
        </button>

        <button
          onClick={refreshEvents}
          disabled={!isHistoryEnabled}
          className={`px-4 py-2 rounded-md transition-colors duration-200 text-sm
            ${
              !isHistoryEnabled
                ? "bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500"
                : "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800"
            }`}
        >
          履歴を更新
        </button>
      </div>

      {isHistoryEnabled ? (
        <div className="border dark:border-gray-700 rounded-md overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  時間
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  イベント
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  購読数
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {recentEvents.map((event, index) => (
                <tr
                  key={index}
                  className={
                    index === 0 ? "bg-blue-50 dark:bg-blue-900/20" : ""
                  }
                >
                  <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 font-mono">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-sm px-2 py-0.5 rounded-full font-medium
                      ${
                        event.event.includes("login")
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : event.event.includes("theme")
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                          : event.event.includes("error")
                          ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                      }`}
                    >
                      {event.event}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                      {event.subscribersCount}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {recentEvents.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400 italic">
              イベント履歴はありません
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md text-center">
          <p className="text-gray-600 dark:text-gray-300 mb-2">
            デバッグモードが無効です
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            履歴を表示するには、デバッグモードを有効にしてください
          </p>
        </div>
      )}

      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded">
        注: 実際のアプリケーションでは、<code>getRecentEvents</code>と
        <code>getEventHistory</code>
        メソッドはデバッグモードが有効な場合のみ機能します。
      </div>
    </div>
  );
}

/**
 * ワイルドカードパターンの使用例
 */
function WildcardSubscriptionDemo() {
  const [notifications, setNotifications] = useState<
    Array<{
      id: string;
      message: string;
      type: string;
      time: string;
    }>
  >([]);

  // ワイルドカード購読の状態
  const [userWildcardActive, setUserWildcardActive] = useState(false);
  const [uiWildcardActive, setUiWildcardActive] = useState(false);

  // ワイルドカード購読への参照
  const userWildcardRef = useRef<(() => void) | null>(null);
  const uiWildcardRef = useRef<(() => void) | null>(null);
  const { publish, subscribe } = usePubSub();

  // 通知を追加する関数
  const addNotification = useCallback((type: string, message: string) => {
    const id = `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    setNotifications((prev) => [
      {
        id,
        message,
        type,
        time: new Date().toLocaleTimeString(),
      },
      ...prev.slice(0, 9), // 最大10件まで
    ]);
  }, []);

  // ユーザー関連イベントのワイルドカード購読を設定
  const subscribeToUserEvents = useCallback(() => {
    if (userWildcardRef.current) return;

    // "user:"で始まるすべてのイベントを購読
    const unsubscribe = pubSub.on("user:*", (data: any) => {
      const eventName = data.eventName || "不明なユーザーイベント";
      addNotification("user", `ユーザーイベント「${eventName}」が発生しました`);
    });

    userWildcardRef.current = unsubscribe;
    setUserWildcardActive(true);

    // テスト用に購読設定を通知
    addNotification("system", "user:*ワイルドカードリスナーが登録されました");
  }, [addNotification]);

  // UI関連イベントのワイルドカード購読を設定
  const subscribeToUiEvents = useCallback(() => {
    if (uiWildcardRef.current) return;

    // "ui:"で始まるすべてのイベントを購読
    const unsubscribe = pubSub.on("ui:*", (data: any) => {
      const eventName = data.eventName || "不明なUIイベント";
      addNotification("ui", `UIイベント「${eventName}」が発生しました`);
    });

    uiWildcardRef.current = unsubscribe;
    setUiWildcardActive(true);

    // テスト用に購読設定を通知
    addNotification("system", "ui:*ワイルドカードリスナーが登録されました");
  }, [addNotification]);

  // ユーザー関連イベントのワイルドカード購読を解除
  const unsubscribeFromUserEvents = useCallback(() => {
    if (userWildcardRef.current) {
      userWildcardRef.current();
      userWildcardRef.current = null;
      setUserWildcardActive(false);

      // テスト用に購読解除を通知
      addNotification("system", "user:*ワイルドカードリスナーが解除されました");
    }
  }, [addNotification]);

  // UI関連イベントのワイルドカード購読を解除
  const unsubscribeFromUiEvents = useCallback(() => {
    if (uiWildcardRef.current) {
      uiWildcardRef.current();
      uiWildcardRef.current = null;
      setUiWildcardActive(false);

      // テスト用に購読解除を通知
      addNotification("system", "ui:*ワイルドカードリスナーが解除されました");
    }
  }, [addNotification]);

  // ダミーのユーザーイベントを発生させる
  const triggerUserEvent = () => {
    const events = [
      {
        name: "user:profile:view",
        data: { userId: "user123", section: "profile" },
      },
      {
        name: "user:avatar:update",
        data: { userId: "user123", newAvatar: "avatar2.jpg" },
      },
      {
        name: "user:friends:added",
        data: { userId: "user123", friendId: "user456" },
      },
    ];

    const selectedEvent = events[Math.floor(Math.random() * events.length)];
    publish(selectedEvent.name as any, {
      ...selectedEvent.data,
      eventName: selectedEvent.name,
      timestamp: Date.now(),
    });
  };

  // ダミーのUIイベントを発生させる
  const triggerUiEvent = () => {
    const events = [
      { name: "ui:panel:expand", data: { panelId: "sidebar", expanded: true } },
      {
        name: "ui:notification:show",
        data: { message: "新しい通知があります" },
      },
      {
        name: "ui:animation:complete",
        data: { elementId: "header", animation: "fade" },
      },
    ];

    const selectedEvent = events[Math.floor(Math.random() * events.length)];
    publish(selectedEvent.name as any, {
      ...selectedEvent.data,
      eventName: selectedEvent.name,
      timestamp: Date.now(),
    });
  };

  // コンポーネントのクリーンアップ
  useEffect(() => {
    return () => {
      if (userWildcardRef.current) {
        userWildcardRef.current();
      }
      if (uiWildcardRef.current) {
        uiWildcardRef.current();
      }
    };
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-all duration-300">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 border-b pb-2 border-gray-200 dark:border-gray-700 flex items-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 mr-2 text-amber-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
          />
        </svg>
        ワイルドカードパターン (*)
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="border dark:border-gray-700 rounded-md p-3">
          <h4 className="font-medium text-gray-800 dark:text-white mb-2">
            ユーザーイベント購読
          </h4>
          <div className="flex flex-wrap gap-2 mb-3">
            {userWildcardActive ? (
              <button
                onClick={unsubscribeFromUserEvents}
                className="px-3 py-1.5 text-sm bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-800 rounded"
              >
                購読解除
              </button>
            ) : (
              <button
                onClick={subscribeToUserEvents}
                className="px-3 py-1.5 text-sm bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800 rounded"
              >
                ワイルドカード購読 (user:*)
              </button>
            )}

            <button
              onClick={triggerUserEvent}
              className="px-3 py-1.5 text-sm bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-800 rounded"
            >
              ランダムなユーザーイベント発生
            </button>
          </div>

          <div
            className={`text-xs px-2 py-1 rounded-full inline-block 
            ${
              userWildcardActive
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
            }`}
          >
            {userWildcardActive ? "監視中" : "監視停止"}
          </div>
        </div>

        <div className="border dark:border-gray-700 rounded-md p-3">
          <h4 className="font-medium text-gray-800 dark:text-white mb-2">
            UIイベント購読
          </h4>
          <div className="flex flex-wrap gap-2 mb-3">
            {uiWildcardActive ? (
              <button
                onClick={unsubscribeFromUiEvents}
                className="px-3 py-1.5 text-sm bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-800 rounded"
              >
                購読解除
              </button>
            ) : (
              <button
                onClick={subscribeToUiEvents}
                className="px-3 py-1.5 text-sm bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800 rounded"
              >
                ワイルドカード購読 (ui:*)
              </button>
            )}

            <button
              onClick={triggerUiEvent}
              className="px-3 py-1.5 text-sm bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-200 dark:hover:bg-purple-800 rounded"
            >
              ランダムなUIイベント発生
            </button>
          </div>

          <div
            className={`text-xs px-2 py-1 rounded-full inline-block 
            ${
              uiWildcardActive
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
            }`}
          >
            {uiWildcardActive ? "監視中" : "監視停止"}
          </div>
        </div>
      </div>

      <div className="border dark:border-gray-700 rounded-md p-3">
        <h4 className="font-medium text-gray-800 dark:text-white mb-2 flex items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 mr-1 text-blue-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          通知リスト
        </h4>

        <div className="max-h-60 overflow-y-auto pr-1 custom-scrollbar">
          {notifications.length === 0 ? (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400 italic">
              通知はありません
            </div>
          ) : (
            <ul className="space-y-2">
              {notifications.map((notification) => (
                <li
                  key={notification.id}
                  className="border border-gray-100 dark:border-gray-700 rounded p-2 bg-white dark:bg-gray-700 shadow-sm"
                >
                  <div className="flex justify-between items-start">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-sm font-medium
                      ${
                        notification.type === "user"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200"
                          : notification.type === "ui"
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200"
                      }`}
                    >
                      {notification.type}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                      {notification.time}
                    </span>
                  </div>
                  <p className="text-sm mt-1 text-gray-700 dark:text-gray-300">
                    {notification.message}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded">
        <p>
          ワイルドカード機能を使用すると、特定のパターンに一致するすべてのイベントを一度に購読できます。
        </p>
        <p className="mt-1">
          例: <code>user:*</code>は<code>user:login</code>、
          <code>user:logout</code>などすべてのユーザー関連イベントに一致します。
        </p>
      </div>
    </div>
  );
}

/**
 * サーバー連携コンポーネント - PubSubイベントをSSEサーバーに転送
 */
function ServerEventSync() {
  const [syncStatus, setSyncStatus] = useState<
    "idle" | "sending" | "success" | "error"
  >("idle");
  const [lastSyncedEvent, setLastSyncedEvent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { subscribe, publish } = usePubSub();

  // サーバーにイベントを送信する関数
  const sendEventToServer = useCallback(
    async (eventName: string, eventData: any) => {
      setSyncStatus("sending");
      setError(null);

      try {
        const response = await fetch("/api/demo/sse", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: eventName,
            data: eventData,
          }),
        });

        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
          setSyncStatus("success");
          setLastSyncedEvent(eventName);

          // 5秒後に状態をリセット
          setTimeout(() => {
            setSyncStatus("idle");
          }, 5000);
        } else {
          throw new Error(result.error || "Unknown error");
        }
      } catch (err) {
        setSyncStatus("error");
        setError(err instanceof Error ? err.message : String(err));

        // 5秒後に状態をリセット
        setTimeout(() => {
          setSyncStatus("idle");
        }, 5000);
      }
    },
    []
  );

  // PubSubイベントを監視してサーバーに転送
  useEffect(() => {
    // 監視する重要なイベント
    const trackedEvents = [
      "user:login",
      "user:logout",
      "user:preferences:changed",
      "ui:theme:changed",
      "app:error",
      "data:loaded",
    ];

    // 各イベントのコールバックを設定
    const callbacks = trackedEvents.map((eventName) => ({
      event: eventName as string,
      callback: (data: any) => {
        console.log(`Forwarding event to SSE server: ${eventName}`, data);
        sendEventToServer(eventName, data);
      },
    }));

    // イベント購読を設定
    subscribe(callbacks);
  }, [subscribe, sendEventToServer]);

  // ステータスアイコンを取得
  const getStatusIcon = () => {
    switch (syncStatus) {
      case "idle":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7h12m0 0l-4-4m4 4l-4 4m-4 6H4m0 0l4 4m-4-4l4-4"
            />
          </svg>
        );
      case "sending":
        return (
          <svg
            className="animate-spin h-5 w-5 text-blue-500"
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
      case "success":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        );
      case "error":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
    }
  };

  // テスト送信関数
  const handleTestSend = () => {
    sendEventToServer("manual:test", {
      message: "テストイベント",
      timestamp: Date.now(),
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-all duration-300">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 border-b pb-2 border-gray-200 dark:border-gray-700 flex items-center">
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
            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
          />
        </svg>
        SSEサーバー連携
      </h3>

      <div
        className={`flex items-center justify-between p-3 rounded-md ${
          syncStatus === "idle"
            ? "bg-gray-50 dark:bg-gray-700"
            : syncStatus === "sending"
            ? "bg-blue-50 dark:bg-blue-900/30"
            : syncStatus === "success"
            ? "bg-green-50 dark:bg-green-900/30"
            : "bg-red-50 dark:bg-red-900/30"
        }`}
      >
        <div className="flex items-center">
          {getStatusIcon()}
          <div className="ml-3">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {syncStatus === "idle" && "待機中"}
              {syncStatus === "sending" && "サーバーに送信中..."}
              {syncStatus === "success" && "送信成功"}
              {syncStatus === "error" && "送信エラー"}
            </div>
            {lastSyncedEvent && syncStatus === "success" && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                最後に同期したイベント:{" "}
                <span className="font-mono bg-gray-100 dark:bg-gray-600 px-1 rounded">
                  {lastSyncedEvent}
                </span>
              </div>
            )}
            {error && (
              <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                エラー: {error}
              </div>
            )}
          </div>
        </div>

        <div>
          <button
            onClick={handleTestSend}
            disabled={syncStatus === "sending"}
            className={`text-xs px-3 py-1 rounded ${
              syncStatus === "sending"
                ? "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400 cursor-not-allowed"
                : "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800"
            }`}
          >
            テスト送信
          </button>
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded">
        <p>
          このコンポーネントはPubSubイベントをSSEサーバーに転送し、SSEページで表示できるようにします
        </p>
        <p className="mt-1">
          監視対象: <code>user:login</code>, <code>user:logout</code>,{" "}
          <code>ui:theme:changed</code>など
        </p>
      </div>
    </div>
  );
}

/**
 * メインのデモアプリケーション
 */
export default function Page() {
  const { publish } = usePubSub();

  // アプリの初期化イベントを発行
  useEffect(() => {
    publish("app:initialized", { timestamp: Date.now() });
  }, [publish]);

  // ユーザーログインのシミュレーション
  const simulateLogin = () => {
    publish("user:login", { userId: "user123", timestamp: Date.now() });
  };

  // ユーザーログアウトのシミュレーション
  const simulateLogout = () => {
    publish("user:logout", { userId: "user123", timestamp: Date.now() });
  };

  // ユーザー設定変更のシミュレーション
  const simulatePreferencesChange = () => {
    publish("user:preferences:changed", {
      userId: "user123",
      preferences: {
        notifications: true,
        language: "ja",
      },
    });
  };

  // アプリエラーのシミュレーション
  const simulateError = () => {
    publish("app:error", {
      message: "Something went wrong",
      code: 500,
      stack:
        "Error: Something went wrong\n    at simulateError (PubSubExample.tsx:123)",
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* ヘッダー部分 (既存) */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg shadow-lg p-6 mb-8">
        <h2 className="text-2xl md:text-3xl font-bold mb-2 flex items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 mr-3"
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
          PubSub システムデモ
        </h2>
        <p className="text-blue-100 text-sm md:text-base">
          イベント駆動型アプリケーションの構築パターンを実演するリアルタイムデモです。
          各コンポーネントは独立して動作しながらイベントを通じて連携します。
        </p>
      </div>

      {/* サーバー連携セクション - 新規追加 */}
      <div className="mb-8">
        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 mr-2 text-teal-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
            />
          </svg>
          サーバー連携機能
        </h3>

        <div className="bg-gradient-to-r from-teal-500 to-blue-600 text-white rounded-lg p-4 mb-6">
          <p className="text-sm">
            PubSubイベントをサーバーサイドに送信し、SSEを通じて他のクライアントと共有する機能です。
            <a href="/demo/sse" className="underline font-medium ml-1">
              SSEページ
            </a>
            で最新イベントを確認できます。
          </p>
        </div>

        <ServerEventSync />
      </div>

      {/* テストイベントボタン (既存) */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8 transition-all duration-300">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 mr-2 text-blue-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
            />
          </svg>
          テストイベント
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={simulateLogin}
            className="flex items-center justify-center bg-green-100 hover:bg-green-200 text-green-800 transition-colors duration-200 py-3 px-4 rounded-md font-medium"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
              />
            </svg>
            ログインシミュレート
          </button>
          <button
            onClick={simulateLogout}
            className="flex items-center justify-center bg-red-100 hover:bg-red-200 text-red-800 transition-colors duration-200 py-3 px-4 rounded-md font-medium"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            ログアウトシミュレート
          </button>
          <button
            onClick={simulatePreferencesChange}
            className="flex items-center justify-center bg-blue-100 hover:bg-blue-200 text-blue-800 transition-colors duration-200 py-3 px-4 rounded-md font-medium"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            設定変更シミュレート
          </button>
          <button
            onClick={simulateError}
            className="flex items-center justify-center bg-yellow-100 hover:bg-yellow-200 text-yellow-800 transition-colors duration-200 py-3 px-4 rounded-md font-medium"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            エラーシミュレート
          </button>
        </div>
      </div>

      {/* 基本コンポーネント (既存) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <UserAuthMonitor />
        <ThemeSelector />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <DataLoadingExample />
        <UserEventsMonitor />
      </div>

      {/* 高度なPubSub機能セクション (新規追加) */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 mr-2 text-indigo-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          高度なPubSub機能
        </h3>

        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg p-4 mb-6">
          <p className="text-sm">
            以下のコンポーネントは、PubSubシステムの高度な機能（イベント待機、名前空間管理、ワイルドカードパターン、イベント履歴）を実演します。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <AsyncEventWaiter />
          <EventNamespaceManager />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <WildcardSubscriptionDemo />
          <EventHistoryViewer />
        </div>
      </div>

      {/* フッター部分 (既存) */}
      <div className="text-center text-gray-500 dark:text-gray-400 text-sm mt-12 pb-8">
        <p>PubSubパターンを活用した効率的なコンポーネント間通信のデモ</p>
        <p className="mt-1">© {new Date().getFullYear()} Hono Sample App</p>
      </div>
    </div>
  );
}
