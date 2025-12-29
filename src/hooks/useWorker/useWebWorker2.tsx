"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { JobResult, JobState } from "./utils/job"
import { pubSub } from "./utils/pubsub"
import { WorkerManager, WorkerManagerOptions } from "./utils/webWorker"

export { type JobResult, type JobState }
/**
 * 統合Web Workerフック - ローカル計算とリモートジョブの両方をサポート
 */
export function useWebWorker<ResultType = any, PayloadType = any>(options: WorkerManagerOptions) {
  // ステート
  const [isRunning, setIsRunning] = useState<boolean>(false)
  const [lastResult, setLastResult] = useState<JobResult<ResultType> | null>(null)
  const [pendingJobs, setPendingJobs] = useState<JobState[]>([])

  // WorkerManagerのインスタンスを作成・保持
  const managerRef = useRef<WorkerManager | null>(null)

  // 初回のペンディングジョブロード状態を追跡
  const initialLoadDoneRef = useRef<boolean>(false)

  // 初期化
  useEffect(() => {
    // 二重初期化を防止
    if (managerRef.current) return

    // WorkerManagerを作成
    managerRef.current = new WorkerManager(options)

    // PubSubイベントを購読して状態を更新
    const unsubscribeJobStart = pubSub.on("worker:job:start", () => {
      setIsRunning(true)
    })

    const unsubscribeJobComplete = pubSub.on("worker:job:complete", (data) => {
      setLastResult(data.result)
      setIsRunning(false)
    })

    const unsubscribeJobError = pubSub.on("worker:job:error", (data) => {
      setLastResult({
        data: null,
        error: data.error,
        duration: data.duration,
        progress: 0,
        status: "failed",
        jobId: data.jobId,
      })
      setIsRunning(false)
    })

    const unsubscribeStateChange = pubSub.on("worker:state:change", (data) => {
      setIsRunning(data.isRunning)
    })

    // リモートモードのみ: 保留中のジョブを復元（ブラウザ環境かつ初回のみ）
    if (
      typeof window !== "undefined" &&
      options.mode === "remote" &&
      options.autoRestorePendingJobs &&
      !initialLoadDoneRef.current
    ) {
      initialLoadDoneRef.current = true // 初回ロード済みとマーク
      managerRef.current
        .restorePendingJobs()
        .then((jobs) => {
          if (jobs && jobs.length > 0) {
            setPendingJobs(jobs)
          }
        })
        .catch(console.error)
    }

    // クリーンアップ
    return () => {
      unsubscribeJobStart()
      unsubscribeJobComplete()
      unsubscribeJobError()
      unsubscribeStateChange()

      // 終了時にWorkerManagerを破棄
      if (managerRef.current) {
        managerRef.current.dispose()
        managerRef.current = null
      }
    }
  }, [options.mode, options.autoRestorePendingJobs, options]) // 関連する依存関係を追加

  // ジョブ実行
  const executeJob = useCallback(async (jobOptions: any): Promise<JobResult<ResultType>> => {
    if (!managerRef.current) {
      throw new Error("WorkerManager not initialized")
    }

    const result = await managerRef.current.executeJob<ResultType, PayloadType>(jobOptions)
    setLastResult(result as JobResult<ResultType>)
    return result as JobResult<ResultType>
  }, [])

  // その他の関数はすべてWorkerManagerに委譲する

  // Worker取得
  const getWorker = useCallback(async () => {
    return managerRef.current?.getWorker() || null
  }, [])

  // Worker参照取得
  const getWorkerRef = useCallback(() => {
    return managerRef.current?.getWorkerRef() || null
  }, [])

  // Worker終了
  const terminateWorker = useCallback(() => {
    managerRef.current?.terminateWorker()
  }, [])

  // ジョブ中止
  const abortJob = useCallback(async (jobId?: string) => {
    return managerRef.current?.abortJob(jobId) || false
  }, [])

  // ジョブ状態取得
  const getJobState = useCallback(async (jobId: string) => {
    return managerRef.current?.getJobState(jobId) || null
  }, [])

  // 自動終了設定
  const setTerminateAfterJob = useCallback((value: boolean) => {
    managerRef.current?.setTerminateAfterJob(value)
  }, [])

  // メッセージ送信
  const sendDirectMessage = useCallback(
    async <T extends object = any, R = any>(message: T, timeout = 5000): Promise<R | null> => {
      if (!managerRef.current) {
        throw new Error("WorkerManager not initialized")
      }
      return managerRef.current.sendDirectMessage<T, R>(message, timeout)
    },
    [],
  )

  // ペンディングジョブの手動更新 - 無限ループを防ぐ
  const restorePendingJobs = useCallback(async () => {
    if (!managerRef.current) {
      return []
    }

    try {
      const jobs = await managerRef.current.restorePendingJobs()
      if (jobs && jobs.length > 0) {
        setPendingJobs(jobs)
      }
      return jobs
    } catch (error) {
      console.error("Failed to restore pending jobs:", error)
      return []
    }
  }, [])

  // リモートモード専用関数
  const isRemoteMode = options.mode === "remote"

  return {
    // 共通API
    executeJob,
    abortJob,
    getJobState,

    // 状態
    isRunning,
    lastResult,
    pendingJobs: isRemoteMode ? pendingJobs : [],

    // 設定
    terminateAfterJob: options.terminateAfterJob,
    setTerminateAfterJob,

    // 低レベルAPI
    getWorker,
    getWorkerRef,
    terminateWorker,
    sendDirectMessage,

    // モード情報
    mode: options.mode,
    isRemoteMode,
    isLocalMode: !isRemoteMode,

    // リモートモード専用API (タイプセーフに)
    ...(isRemoteMode
      ? {
          executeRemoteJob: executeJob,
          checkRemoteJobStatus: (jobId: string) => managerRef.current?.checkRemoteJobStatus(jobId) || null,
          terminateRemoteJob: (jobId: string) => managerRef.current?.terminateRemoteJob(jobId) || false,
          restorePendingJobs, // 修正したバージョンを使用
        }
      : {
          executeLocalJob: executeJob,
        }),
  }
}

// エイリアスアプローチによるシンプルなAPI提供は変更なし
// export const useLocalJob = async <ResultType = any, PayloadType = any>(
//   options: Omit<WorkerManagerOptions, "mode">
// ): Promise<ReturnType<typeof useWebWorker<ResultType, PayloadType>>> =>
//   useWebWorker<ResultType, PayloadType>({ ...options, mode: "local" });

// export const useRemoteJob = async <ResultType = any, PayloadType = any>(
//   options: Omit<WorkerManagerOptions, "mode">
// ): Promise<ReturnType<typeof useWebWorker<ResultType, PayloadType>>> =>
//   useWebWorker<ResultType, PayloadType>({ ...options, mode: "remote" });
