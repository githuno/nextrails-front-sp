"use client";

import React, { useState, useEffect, useRef } from "react";
import { useJobWorker, JobResult } from "@/hooks/useJobWorker";

export default function AdvancedJobWorkerDemo() {
  const [input, setInput] = useState<string>("35");
  const [calculationType, setCalculationType] = useState<string>("fibonacci");
  const [output, setOutput] = useState<string[]>([]);
  const [progress, setProgress] = useState<number>(0);
  const [customMessage, setCustomMessage] =
    useState<string>('{ "type": "PING" }');
  const [workerStatus, setWorkerStatus] = useState<
    "ノンアクティブ" | "アクティブ"
  >("ノンアクティブ");
  const [workerLifecycle, setWorkerLifecycle] = useState<{
    created: number;
    terminated: number;
    recreated: number;
  }>({
    created: 0,
    terminated: 0,
    recreated: 0,
  });

  // 結果履歴を保存
  const [resultHistory, setResultHistory] = useState<JobResult[]>([]);

  // 実行中のジョブのIDを追跡
  const currentJobIdRef = useRef<string | null>(null);
  // Workerの状態を追跡するための参照
  const workerRef = useRef<Worker | null>(null);
  // Workerの作成状態を追跡
  const workerCreatedRef = useRef<boolean>(false);
  // Worker ID追跡用の参照
  const lastWorkerIdRef = useRef<string | null>(null);

  // ジョブワーカーフックを使用 - 上級者向けオプションを全て使用可能に
  const {
    // 主要API
    executeJob,
    abortJob,

    // 状態
    isRunning,
    lastResult,
    terminateAfterJob, // 現在の設定を取得
    setTerminateAfterJob, // 設定を更新

    // 上級者向けAPI
    getWorker,
    sendDirectMessage, // 低レベルAPIのためジョブ終了後もworkerは終了されません
    getWorkerRef,
    terminateWorker,
  } = useJobWorker({
    scriptUrl: "/workers/generic-worker.js",
    debug: true,
    terminateAfterJob: true, // デフォルト値を設定：ジョブ後にWorkerを終了
    globalTimeout: 60000, // 1分のタイムアウト
    maxWorkerLifetime: 10 * 60 * 1000, // 10分
  });

  // ログ関数
  const log = (message: string) => {
    setOutput((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] ${message}`,
    ]);
  };

  // terminateAfterJobの変更をログに記録
  useEffect(() => {
    log(
      `Workerライフサイクル設定を変更: ${
        terminateAfterJob ? "ジョブ後に終了" : "ジョブ間で再利用"
      }`
    );
  }, [terminateAfterJob]);

  // コンポーネントマウント時に既存Workerをチェック
  useEffect(() => {
    // 初回のみ実行
    const checkInitialWorker = async () => {
      // getWorkerRefを使用して作成せずに現在のWorkerを確認
      const worker = getWorkerRef();

      if (worker) {
        // 既存Workerが見つかった場合
        workerRef.current = worker;
        workerCreatedRef.current = true;
        log("既存のWorkerを検出しました");

        // IDを取得
        try {
          const response = await sendDirectMessage({ type: "GET_ID" });
          if (response?.workerId) {
            lastWorkerIdRef.current = response.workerId;
            log(`Worker ID: ${response.workerId}`);

            // 既存のWorkerをカウント
            setWorkerLifecycle((prev) => ({
              ...prev,
              created: prev.created + 1,
            }));
          }
        } catch (e) {
          // エラー無視
        }
      }
    };

    checkInitialWorker();

    // コンポーネントのクリーンアップ時にWorkerをチェック
    return () => {
      if (workerRef.current) {
        log("コンポーネントアンマウント時にWorkerがまだ存在しています");
      }
    };
  }, [getWorkerRef, sendDirectMessage]);

  // Worker生成イベントを監視 - カスタムイベントを使用
  useEffect(() => {
    // Worker created
    const handleWorkerCreated = (event: Event) => {
      // 正しいWorker参照の取得方法
      const worker = getWorkerRef();
      if (worker) {
        workerCreatedRef.current = true;
        workerRef.current = worker;

        setWorkerLifecycle((prev) => ({
          ...prev,
          created: prev.created + 1,
        }));

        log("Workerが作成されました");

        // IDを確認
        setTimeout(async () => {
          try {
            const response = await sendDirectMessage({ type: "GET_ID" });
            if (response?.workerId) {
              lastWorkerIdRef.current = response.workerId;
              log(`新しいWorker ID: ${response.workerId}`);
            }
          } catch (e) {
            // エラー無視
          }
        }, 100);
      }
    };

    // Worker終了イベントを監視
    const handleWorkerTerminated = (event: Event) => {
      const customEvent = event as CustomEvent;
      const terminationSource = customEvent.detail?.source || "auto";

      // 参照が既に更新済みでないことを確認
      if (workerCreatedRef.current) {
        workerCreatedRef.current = false;
        workerRef.current = null;

        setWorkerLifecycle((prev) => ({
          ...prev,
          terminated: prev.terminated + 1,
        }));

        log(`Workerが終了しました (終了元: ${terminationSource})`);
      } else {
        log(
          `Worker終了イベントを受信しましたが、既に処理済みです (終了元: ${terminationSource})`
        );
      }
    };

    // カスタムイベントを登録
    window.addEventListener("worker:created", handleWorkerCreated);
    window.addEventListener("worker:terminated", handleWorkerTerminated);

    return () => {
      window.removeEventListener("worker:created", handleWorkerCreated);
      window.removeEventListener("worker:terminated", handleWorkerTerminated);
    };
  }, [getWorkerRef, sendDirectMessage]);

  // 再作成カウンター - Workerが作成されたときにIDを確認
  useEffect(() => {
    // 新しいWorkerが作成されたときにのみ実行
    if (workerLifecycle.created > 0 && workerLifecycle.terminated > 0) {
      const checkNewWorkerId = async () => {
        const worker = getWorkerRef();
        if (!worker) return;

        try {
          const response = await sendDirectMessage({ type: "GET_ID" });
          const newWorkerId = response?.workerId;

          // 前回のIDと異なる場合は再作成としてカウント
          if (
            newWorkerId &&
            lastWorkerIdRef.current &&
            newWorkerId !== lastWorkerIdRef.current
          ) {
            setWorkerLifecycle((prev) => ({
              ...prev,
              recreated: prev.recreated + 1,
            }));

            log(`Workerが再作成されました (新ID: ${newWorkerId})`);
          }

          // 新しいIDを記録
          if (newWorkerId) {
            lastWorkerIdRef.current = newWorkerId;
          }
        } catch (e) {
          // エラーを無視
        }
      };

      checkNewWorkerId();
    }
  }, [
    workerLifecycle.created,
    workerLifecycle.terminated,
    getWorkerRef,
    sendDirectMessage,
  ]);

  // Workerの状態確認 - getWorkerRefを使って作成を避ける
  useEffect(() => {
    let isMounted = true;
    let lastWorkerState: string | null = null;

    const checkWorkerStatus = () => {
      if (!isMounted) return;

      // getWorkerRefを使用して作成せずに状態のみチェック
      const currentWorker = getWorkerRef();
      const isWorkerActive = currentWorker !== null;
      const currentState = isWorkerActive ? "アクティブ" : "ノンアクティブ";

      // 状態が変わった場合のみ更新
      if (currentState !== lastWorkerState) {
        lastWorkerState = currentState;
        setWorkerStatus(currentState);

        // Workerが終了した場合
        if (currentState === "ノンアクティブ" && workerRef.current) {
          workerRef.current = null;
          workerCreatedRef.current = false;
        }
      }
    };

    // 初回チェック
    checkWorkerStatus();

    // 1秒ごとに確認
    const interval = setInterval(checkWorkerStatus, 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [getWorkerRef]);

  // 計算ジョブの実行
  const handleCalculate = async () => {
    try {
      let n = parseInt(input);

      if (calculationType === "delayDemo") {
        // 特別な進捗デモモード
        n = Math.min(50, Math.max(5, n || 20)); // 5～50の範囲に制限
        log(`進捗デモ開始: ${n}ステップ`);
      } else {
        if (isNaN(n) || n < 0) {
          log("有効な正の整数を入力してください");
          return;
        }
        log(`計算開始: ${calculationType}(${n})`);
      }

      setProgress(0);

      // ジョブID生成 - トラッキング用
      const jobId = `calc_${calculationType}_${n}_${Date.now()}`;
      currentJobIdRef.current = jobId;

      // ジョブを実行 - カスタムオプション
      const result = await executeJob({
        payload: {
          type: calculationType,
          n,
          delay: 200, // 進捗デモモード用の遅延設定
        },
        enableProgress: true,
        debug: true,
        id: jobId,
        retries: 2, // 2回のリトライ
        retryDelay: 1000, // 1秒待機してリトライ
        timeout: 30000, // 30秒タイムアウト
      });

      // 結果の処理
      if (result.status === "completed") {
        log(`計算結果: ${result.data} (${result.duration.toFixed(1)}ms)`);

        // 結果履歴に追加
        setResultHistory((prev) => [...prev, result]);
      } else {
        log(`計算エラー: ${result.error?.message}`);
      }

      // 完了時にジョブIDをクリア
      currentJobIdRef.current = null;
    } catch (error) {
      log(
        `エラー発生: ${error instanceof Error ? error.message : String(error)}`
      );
      currentJobIdRef.current = null;
    }
  };

  // 現在のジョブを中止
  const handleAbortCurrentJob = () => {
    if (currentJobIdRef.current) {
      const success = abortJob(currentJobIdRef.current);
      if (success) {
        log(`ジョブ ${currentJobIdRef.current} を中止しました`);
      } else {
        log(`ジョブ ${currentJobIdRef.current} の中止に失敗しました`);
      }
      currentJobIdRef.current = null;
    } else {
      log("中止するジョブがありません");
    }
  };

  // 全てのジョブを中止
  const handleAbortAllJobs = () => {
    const aborted = abortJob();
    if (aborted) {
      log("全てのジョブを中止しました");
    } else {
      log("中止するジョブがありません");
    }
    currentJobIdRef.current = null;
  };

  // Workerを手動で初期化
  const handleInitWorker = () => {
    // getWorker()で明示的に初期化
    const worker = getWorker();
    if (worker) {
      log("Workerを明示的に初期化しました");
      // イベント発行はgetWorker内で行われる
    } else {
      log("Workerの初期化に失敗しました");
    }
  };

  // Workerを手動で終了
  const handleTerminateWorker = () => {
    terminateWorker();
    workerRef.current = null;
    workerCreatedRef.current = false;
    lastWorkerIdRef.current = null;
    log("Workerを手動で終了しました");
  };

  // カスタムメッセージを直接送信
  const handleSendCustomMessage = async () => {
    try {
      let messageObj;
      try {
        messageObj = JSON.parse(customMessage);
      } catch (e) {
        log("有効なJSONを入力してください");
        return;
      }

      // Workerがなければ初期化
      if (!getWorkerRef()) {
        log("Workerが存在しないため初期化します");
        getWorker();
      }

      log(`カスタムメッセージを送信: ${customMessage}`);
      const response = await sendDirectMessage(messageObj, 5000);
      log(`応答を受信: ${JSON.stringify(response)}`);
    } catch (error) {
      log(
        `メッセージ送信エラー: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  };

  // 進捗状況の監視
  useEffect(() => {
    if (lastResult) {
      setProgress(lastResult.progress);
    }
  }, [lastResult]);

  // Workerライフサイクルカウントの整合性確認ボタンを追加
  const checkLifecycleConsistency = () => {
    const activeWorkers = workerStatus === "アクティブ" ? 1 : 0;
    const expected = workerLifecycle.created;
    const actual = workerLifecycle.terminated + activeWorkers;

    log(`Worker数整合性チェック:
  - 作成回数: ${workerLifecycle.created}
  - 終了回数: ${workerLifecycle.terminated}
  - 活性状態: ${activeWorkers}
  - 再作成回数: ${workerLifecycle.recreated}
  - 期待値 (作成 = 終了 + 活性): ${expected} = ${actual} (${
      expected === actual ? "一致" : "不一致"
    })
  `);

    // カウントをリセット（オプション）
    if (expected !== actual && !getWorkerRef()) {
      setWorkerLifecycle({
        created: activeWorkers,
        terminated: 0,
        recreated: 0,
      });
      log("カウンターをリセットしました");
    }
  };

  return (
    <div className="p-10 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Web Worker デモ</h1>
      <p className="text-gray-600 mb-4">
        すべてのジョブワーカー機能を使った高度なデモ（ライフサイクル管理、ジョブ実行、低レベルAPI）
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* ジョブ実行パネル */}
        <div className="border p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-3">ジョブ実行</h2>
          <p className="text-gray-600 text-xs mb-4">
            ※このデモでは意図的に計算を遅くしています（進捗バー確認用）
          </p>

          <div className="grid grid-cols-2 gap-6">
            <div className="mb-4">
              <label className="block mb-2">計算タイプ:</label>
              <select
                value={calculationType}
                onChange={(e) => setCalculationType(e.target.value)}
                className="w-full p-2 border rounded h-10"
                disabled={isRunning}
              >
                <option value="fibonacci">フィボナッチ数列</option>
                <option value="factorial">階乗</option>
                <option value="prime">素数判定</option>
                <option value="delayDemo">進捗デモ（計算なし）</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block mb-2">
                {calculationType === "delayDemo" ? "ステップ数:" : "数値:"}
              </label>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full p-2 border rounded h-10"
                disabled={isRunning}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 mb-4">
            <button
              onClick={handleAbortCurrentJob}
              disabled={!isRunning}
              className="flex-grow px-4 py-2 bg-red-600 text-white rounded disabled:bg-gray-400"
            >
              ジョブを中止
            </button>
            <button
              onClick={handleCalculate}
              disabled={isRunning}
              className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
            >
              {isRunning ? "実行中..." : "実行開始"}
            </button>
          </div>

          {isRunning && (
            <div className="mb-4">
              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-200 ease-in-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600">{progress}% 完了</p>
            </div>
          )}

          {lastResult && (
            <div
              className={`p-3 rounded mb-4 ${
                lastResult.status === "completed"
                  ? "bg-green-100"
                  : lastResult.status === "error"
                  ? "bg-red-100"
                  : "bg-yellow-100"
              }`}
            >
              <p>
                <strong>状態:</strong> {lastResult.status}
              </p>
              {lastResult.data !== null && (
                <p>
                  <strong>結果:</strong> {String(lastResult.data)}
                </p>
              )}
              {lastResult.error && (
                <p>
                  <strong>エラー:</strong> {lastResult.error.message}
                </p>
              )}
              <p>
                <strong>処理時間:</strong> {lastResult.duration.toFixed(1)}ms
              </p>
            </div>
          )}

          <div className="mb-4 p-2 bg-gray-100 rounded">
            <h4 className="text-sm font-medium">現在のWorker状態</h4>
            <div className="flex justify-between text-xs mt-1">
              <span>Worker ID:</span>
              <span className="font-mono">
                {workerStatus === "アクティブ"
                  ? lastWorkerIdRef.current || "取得中..."
                  : "未初期化"}
              </span>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span>状態:</span>
              <span
                className={
                  workerStatus === "アクティブ"
                    ? "text-green-600"
                    : "text-red-600"
                }
              >
                {workerStatus}
              </span>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span>再利用設定:</span>
              <span>{terminateAfterJob ? "ジョブ後に終了" : "再利用する"}</span>
            </div>
          </div>

          <div className="mb-4 p-3 border border-gray-200 rounded bg-gray-50">
            <h3 className="font-semibold mb-2 text-sm">
              Workerライフサイクル設定
            </h3>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={terminateAfterJob}
                onChange={(e) => setTerminateAfterJob(e.target.checked)}
                className="mr-2"
              />
              <span>ジョブ完了後にWorkerを終了</span>
            </label>
            <p className="text-xs text-gray-500 mt-1">
              {terminateAfterJob
                ? "現在の設定: 各ジョブの実行後、Workerは自動的に終了します。次のジョブ実行時に再作成されます。"
                : "現在の設定: Workerを再利用します。複数のジョブで同じWorkerインスタンスを使用します。"}
            </p>
            <p className="text-gray-800 text-xs">
              ※ 作成回数 = 終了回数 + アクティブなWorker数
            </p>

            <div className="mt-2 text-xs">
              <div className="flex justify-between">
                <span>作成回数:</span>
                <span className="font-mono">{workerLifecycle.created}</span>
              </div>
              <div className="flex justify-between">
                <span>終了回数:</span>
                <span className="font-mono">{workerLifecycle.terminated}</span>
              </div>
              <div className="flex justify-between">
                <span>再作成回数:</span>
                <span className="font-mono">{workerLifecycle.recreated}</span>
              </div>
            </div>
            <button
              onClick={checkLifecycleConsistency}
              className="mt-2 px-3 py-1 bg-purple-200 text-purple-800 rounded text-xs"
            >
              カウント整合性確認
            </button>
          </div>
        </div>

        {/* 上級者向け制御パネル */}
        <div className="border p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-3">上級者向け制御</h2>

          <div className="mb-4">
            <div className="grid grid-cols-3 items-center mb-3">
              <div className="flex flex-col text-center">
                <p className="text-xs">Worker状態</p>
                <p
                  className={
                    workerStatus === "アクティブ"
                      ? "text-green-600 font-bold"
                      : "text-red-600 font-bold"
                  }
                >
                  {workerStatus}
                </p>
              </div>
              <span className="col-span-2 text-xs text-gray-500">
                {workerStatus === "ノンアクティブ"
                  ? "Workerはまだ初期化されていません"
                  : `ID: ${lastWorkerIdRef.current || "不明"}`}
              </span>
            </div>

            <div className="flex space-x-2 mb-4">
              <button
                onClick={handleInitWorker}
                disabled={workerStatus === "アクティブ"}
                className="px-3 py-2 bg-green-600 text-white text-sm rounded disabled:bg-gray-400"
              >
                Worker初期化
              </button>

              <button
                onClick={handleTerminateWorker}
                disabled={workerStatus !== "アクティブ"}
                className="px-3 py-2 bg-red-600 text-white text-sm rounded disabled:bg-gray-400"
              >
                Worker終了
              </button>

              <button
                onClick={handleAbortAllJobs}
                className="px-3 py-2 bg-yellow-600 text-white text-sm rounded"
              >
                全ジョブ中止
              </button>
            </div>
          </div>

          <div className="mb-4">
            <label className="block mb-2">カスタムメッセージ:</label>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="w-full p-2 border rounded font-mono text-sm"
              rows={4}
            />
            <button
              onClick={handleSendCustomMessage}
              className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded"
            >
              メッセージ送信
            </button>
            <p className="text-xs text-gray-500 mt-1">
              ※Workerが存在しない場合は自動的に初期化されます
            </p>
            <p className="text-xs text-gray-500 mt-1">
              ※低レベルAPIを使用するためジョブ終了後もworkerは自動終了されません
            </p>
          </div>

          <div className="mb-4">
            <h3 className="font-semibold mb-2">サンプルメッセージ:</h3>
            <div className="space-y-1">
              <button
                onClick={() => setCustomMessage('{ "type": "PING" }')}
                className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded mr-2"
              >
                PING
              </button>
              <button
                onClick={() => setCustomMessage('{ "type": "GET_ID" }')}
                className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded mr-2"
              >
                Get Worker ID
              </button>
              <button
                onClick={() =>
                  setCustomMessage(
                    '{ "type": "JOB", "payload": { "type": "delayDemo", "n": 5 }, "jobId": "manual-job-1", "debug": true }'
                  )
                }
                className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded"
              >
                手動ジョブ
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ログパネル */}
      <div className="border rounded-lg p-4 mb-6">
        <h2 className="text-xl font-semibold mb-3">実行ログ</h2>
        <div className="bg-gray-100 p-3 rounded h-64 overflow-y-auto font-mono text-sm">
          {output.length === 0 ? (
            <p className="text-gray-500">ログはまだありません</p>
          ) : (
            output.map((message, index) => (
              <div key={index} className="mb-1">
                {message}
              </div>
            ))
          )}
        </div>
        <button
          onClick={() => setOutput([])}
          className="mt-2 px-3 py-1 bg-gray-200 text-gray-800 rounded text-sm"
        >
          ログをクリア
        </button>
      </div>

      {/* 結果履歴パネル */}
      <div className="border p-4 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-3">結果履歴</h2>

        {resultHistory.length === 0 ? (
          <p className="text-gray-500">履歴はまだありません</p>
        ) : (
          <div className="max-h-64 overflow-y-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 text-left">ID</th>
                  <th className="p-2 text-left">状態</th>
                  <th className="p-2 text-left">結果</th>
                  <th className="p-2 text-left">時間(ms)</th>
                </tr>
              </thead>
              <tbody>
                {resultHistory.map((result, index) => (
                  <tr
                    key={index}
                    className={index % 2 === 0 ? "bg-gray-50" : ""}
                  >
                    <td className="p-2">
                      {result.id?.split("_").slice(0, 2).join("_")}
                    </td>
                    <td className="p-2">{result.status}</td>
                    <td className="p-2 max-w-md truncate">
                      {result.data !== null ? String(result.data) : "N/A"}
                    </td>
                    <td className="p-2">{result.duration.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              onClick={() => setResultHistory([])}
              className="mt-2 px-3 py-1 bg-gray-200 text-gray-800 rounded text-sm"
            >
              履歴をクリア
            </button>
          </div>
        )}
      </div>

      {/* デバッグ情報 */}
      <div className="mt-4 border-t pt-4 text-xs text-gray-500">
        <p>
          このデモでは、useJobWorkerフックの全ての機能を試すことができます：
        </p>
        <ul className="list-disc ml-5 mt-1">
          <li>executeJob: ジョブを実行し結果を待機</li>
          <li>abortJob: 特定のジョブまたは全ジョブを中止</li>
          <li>sendDirectMessage: 低レベル通信</li>
          <li>getWorker: Worker参照の取得と作成</li>
          <li>getWorkerRef: Worker参照のみ安全に取得（作成なし）</li>
          <li>terminateWorker: Workerの明示的終了</li>
        </ul>
      </div>

      {/* シンプルなデモページへのリンク */}
      <div className="mt-6">
        <a
          href="/demo/jw/simple"
          className="text-blue-600 hover:underline text-sm"
        >
          シンプルなデモページへ
        </a>
        <p className="text-xs text-gray-500 mt-1">
          ※シンプルなデモでは、useJobWorkerフックの基本機能のみを使用しています。
          <br />
          上級者向けオプションは使用できません。
        </p>
      </div>
    </div>
  );
}
