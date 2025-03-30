'use client';
import { useState, useRef, useCallback, useEffect } from "react";

// ジョブ実行オプション
export interface JobOptions<P = any> {
  // ジョブパラメータ
  payload: P;
  // タイムアウト時間 (ミリ秒)
  timeout?: number;
  // 進捗報告を有効にする
  enableProgress?: boolean;
  // デバッグログを有効にする
  debug?: boolean;
  // Worker読み込み失敗時のリトライ回数
  retries?: number;
  // リトライ時の待機時間 (ミリ秒)
  retryDelay?: number;
  // ID (複数ジョブの識別に使用)
  id?: string;
  // 進捗状況のコールバック
  onProgress?: (progress: number) => void;
}

// ジョブ実行結果
export interface JobResult<R = any> {
  // 結果データ
  data: R | null;
  // エラー情報
  error: Error | null;
  // 実行時間(ミリ秒)
  duration: number;
  // 進捗状況 (0-100)
  progress: number;
  // ジョブのステータス
  status: "idle" | "running" | "completed" | "error";
  // ジョブID
  id?: string;
}

// useWorkerJobフックのオプション
export interface UseWorkerJobOptions {
  // Workerのスクリプトパス
  scriptUrl: string;
  // Worker種別
  type?: WorkerType;
  // 認証情報
  credentials?: RequestCredentials;
  // デバッグモード有効化
  debug?: boolean;
  // グローバルタイムアウト (ミリ秒)
  globalTimeout?: number;
  // ジョブ終了後にWorkerを破棄する(通常はtrue)
  terminateAfterJob?: boolean;
  // Workerの最大寿命 (ミリ秒)、これを超えると再作成
  maxWorkerLifetime?: number;
}

/**
 * ジョブベースのWeb Workerフック
 * 一時的な計算ジョブをWeb Workerで実行するための最適化された実装
 */
export function useWorkerJob<ResultType = any, PayloadType = any>(
  options: UseWorkerJobOptions
) {
  // デフォルト値の設定
  const {
    scriptUrl,
    type = "classic",
    credentials,
    debug = false,
    globalTimeout = 30000, // 30秒
    terminateAfterJob = true,
    maxWorkerLifetime = 5 * 60 * 1000, // 5分
  } = options;

  // ステート
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<JobResult<ResultType> | null>(
    null
  );

  // terminateAfterJob設定の動的変更を追跡
  const [autoTerminate, setAutoTerminate] =
    useState<boolean>(terminateAfterJob);

  // 参照を保存
  const workerRef = useRef<Worker | null>(null);
  const creationTimeRef = useRef<number>(0);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const progressHandlersRef = useRef<Map<string, (progress: number) => void>>(
    new Map()
  );

  // デバッグログ関数
  const log = useCallback(
    (message: string, ...args: any[]) => {
      if (debug) {
        console.log(`[JobWorker] ${message}`, ...args);
      }
    },
    [debug]
  );

  // Workerの参照だけを取得する安全な関数（作成は行わない）
  const getWorkerRef = useCallback(() => {
    return workerRef.current;
  }, []);

  // Workerインスタンスの取得(または作成)
  const getWorker = useCallback(() => {
    const now = Date.now();

    // 既存Workerが古すぎる場合は破棄
    if (
      workerRef.current &&
      now - creationTimeRef.current > maxWorkerLifetime
    ) {
      log("Worker lifetime exceeded, recreating");
      workerRef.current.terminate();
      workerRef.current = null;
    }

    // 新しいWorkerの作成
    if (!workerRef.current) {
      try {
        log(`Creating new worker: ${scriptUrl}`);
        workerRef.current = new Worker(scriptUrl, { type, credentials });
        creationTimeRef.current = now;

        // 基本的なエラーハンドラ
        workerRef.current.onerror = (event) => {
          console.error("Worker error:", event);
        };

        // Worker作成イベントを発行
        try {
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("worker:created", {
                detail: { worker: workerRef.current },
              })
            );
          }
        } catch (e) {
          console.error("Failed to dispatch worker:created event:", e);
        }
      } catch (err) {
        console.error("Failed to create Worker:", err);
        return null;
      }
    }

    return workerRef.current;
  }, [scriptUrl, type, credentials, maxWorkerLifetime, log]);

  // Workerの終了処理
  const terminateWorker = useCallback(() => {
    if (workerRef.current) {
      log("Terminating worker");
  
      // Worker終了前にイベントを発行（カスタムデータ追加）
      try {
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("worker:terminated", {
              detail: { source: "manual" }  // 手動終了元を記録
            })
          );
        }
      } catch (e) {
        console.error("Failed to dispatch worker:terminated event:", e);
      }
  
      workerRef.current.terminate();
      workerRef.current = null;
      creationTimeRef.current = 0;
    }
  }, [log]);

  // クリーンアップ処理
  useEffect(() => {
    return () => {
      // コンポーネントのアンマウント時にWorkerを終了
      terminateWorker();

      // すべての進行中のジョブを中止
      abortControllersRef.current.forEach((controller) => {
        try {
          controller.abort();
        } catch (e) {
          // エラーを無視
        }
      });
    };
  }, [terminateWorker]);

  /**
   * 実際のジョブ実行関数
   * Web Workerを使用して計算ジョブを実行し、結果を返す
   */
  const executeJob = useCallback(
    async (
      jobOptions: JobOptions<PayloadType>
    ): Promise<JobResult<ResultType>> => {
      const {
        payload,
        timeout = globalTimeout,
        enableProgress = true,
        debug: jobDebug = debug,
        retries = 1,
        retryDelay = 500,
        id = `job_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      } = jobOptions;

      // 初期結果を設定
      const initialResult: JobResult<ResultType> = {
        data: null,
        error: null,
        duration: 0,
        progress: 0,
        status: "idle",
        id,
      };

      let currentAttempt = 0;
      let lastError: Error | null = null;

      // リトライを含めたジョブ実行ループ
      while (currentAttempt <= retries) {
        currentAttempt++;

        try {
          // 実行状態を更新
          setIsRunning(true);
          log(`Starting job ${id}, attempt ${currentAttempt}/${retries + 1}`);

          // 結果を計測
          const startTime = performance.now();
          setLastResult({ ...initialResult, status: "running" });

          // 新しいAbortControllerを作成
          const abortController = new AbortController();
          abortControllersRef.current.set(id, abortController);

          // Workerインスタンスを取得
          const worker = getWorker();
          if (!worker) {
            throw new Error("Failed to create worker");
          }

          // 結果をPromiseで包む
          const result = await new Promise<ResultType>((resolve, reject) => {
            // タイムアウト処理
            const timeoutId = setTimeout(() => {
              reject(new Error(`Job timeout after ${timeout}ms`));
            }, timeout);

            // 進捗ハンドラをセットアップ
            let progressCallback: ((progress: number) => void) | null = null;

            if (enableProgress) {
              progressCallback = (progress: number) => {
                setLastResult((prev) => (prev ? { ...prev, progress } : null));
              };
              progressHandlersRef.current.set(id, progressCallback);
            }

            // メッセージハンドラ
            const handleMessage = (event: MessageEvent) => {
              const {
                type,
                payload: responsePayload,
                jobId,
              } = event.data || {};

              // 対象のジョブIDのみ処理
              if (jobId && jobId !== id) return;

              if (type === "RESULT") {
                // ジョブ完了
                clearTimeout(timeoutId);
                cleanup();
                resolve(responsePayload);
              } else if (type === "ERROR") {
                // エラー処理
                clearTimeout(timeoutId);
                cleanup();
                reject(
                  new Error(responsePayload?.message || "Unknown worker error")
                );
              } else if (type === "PROGRESS" && progressCallback) {
                // 進捗更新
                progressCallback(responsePayload?.percent || 0);
                
                // カスタム進捗ハンドラがあれば呼び出す（追加）
                if (jobOptions.onProgress) {
                  jobOptions.onProgress(responsePayload?.percent || 0);
                }
              }
            };

            // クリーンアップ関数
            const cleanup = () => {
              worker.removeEventListener("message", handleMessage);
              if (progressCallback) {
                progressHandlersRef.current.delete(id);
              }
              abortControllersRef.current.delete(id);
            };

            // AbortSignal処理
            abortController.signal.addEventListener("abort", () => {
              clearTimeout(timeoutId);
              cleanup();
              reject(new Error("Job aborted"));
            });

            // メッセージハンドラを追加
            worker.addEventListener("message", handleMessage);

            // ジョブメッセージを送信
            worker.postMessage({
              type: "JOB",
              payload,
              jobId: id,
              debug: jobDebug,
            });
          });

          // 成功した場合の処理
          const endTime = performance.now();
          const duration = endTime - startTime;

          log(`Job ${id} completed in ${duration.toFixed(1)}ms`);

          const finalResult: JobResult<ResultType> = {
            data: result,
            error: null,
            duration,
            progress: 100,
            status: "completed",
            id,
          };

          setLastResult(finalResult);

          // ジョブ後にWorkerを終了するオプション - 現在の設定を使用
          if (autoTerminate) {
            log(
              `Auto-terminating worker after job ${id} (terminateAfterJob=${autoTerminate})`
            );
            terminateWorker();
          }

          setIsRunning(false);
          return finalResult;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));

          log(`Job ${id} failed:`, lastError);

          // 最後のリトライでなければ再試行
          if (currentAttempt <= retries) {
            log(
              `Retrying job ${id} in ${retryDelay}ms (attempt ${currentAttempt}/${retries})`
            );
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
          }
        }
      }

      // すべてのリトライが失敗した場合
      const errorResult: JobResult<ResultType> = {
        data: null,
        error: lastError,
        duration: 0,
        progress: 0,
        status: "error",
        id,
      };

      setLastResult(errorResult);
      setIsRunning(false);

      return errorResult;
    },
    [
      getWorker,
      terminateWorker,
      globalTimeout,
      log,
      debug,
      autoTerminate,
      maxWorkerLifetime,
    ]
  );

  /**
   * ジョブを中止する関数
   */
  const abortJob = useCallback(
    (jobId?: string) => {
      if (jobId) {
        // 特定のジョブのみ中止
        const controller = abortControllersRef.current.get(jobId);
        if (controller) {
          log(`Aborting job ${jobId}`);
          controller.abort();
          return true;
        }
        return false;
      } else {
        // すべてのジョブを中止
        log("Aborting all jobs");
        let aborted = false;

        abortControllersRef.current.forEach((controller, id) => {
          controller.abort();
          aborted = true;
          log(`Aborted job ${id}`);
        });

        return aborted;
      }
    },
    [log]
  );

  // Utility: 直接Workerメッセージを送信してレスポンスを待つ単純な関数
  const sendDirectMessage = useCallback(
    async <T = any, R = any>(message: T, timeout = 5000): Promise<R | null> => {
      const worker = getWorker();
      if (!worker) return null;

      return new Promise<R | null>((resolve) => {
        const timeoutId = setTimeout(() => {
          worker.removeEventListener("message", handleResponse);
          resolve(null);
        }, timeout);

        const handleResponse = (event: MessageEvent) => {
          clearTimeout(timeoutId);
          worker.removeEventListener("message", handleResponse);
          resolve(event.data as R);
        };

        worker.addEventListener("message", handleResponse);
        worker.postMessage(message);
      });
    },
    [getWorker]
  );

  // 自動終了設定を動的に変更可能にする
  const setTerminateAfterJob = useCallback(
    (value: boolean) => {
      setAutoTerminate(value);
      log(`Updated terminateAfterJob setting to: ${value}`);
    },
    [log]
  );

  return {
    // 主要API
    executeJob,
    abortJob,
    sendDirectMessage,

    // 状態
    isRunning,
    lastResult,
    terminateAfterJob: autoTerminate, // 現在の設定を公開
    setTerminateAfterJob, // 設定を変更する関数を追加

    // 直接操作API (上級者向け)
    getWorker,
    getWorkerRef, // Worker参照のみを安全に取得（workerを作成しない）
    terminateWorker,
  };
}

// ユーティリティ型
export type JobWorkerOptions<P> = JobOptions<P>;
export type JobWorkerResult<R> = JobResult<R>;
