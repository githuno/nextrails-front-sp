import { pubSub } from "@/utils/pubsub"
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react"
import { JobOptions, JobResult, JobState, JobStatus } from "./utils/job"

export type WorkerMode = "local" | "remote"

// オプション
export interface WorkerOptions {
  scriptUrl: string
  mode: WorkerMode
  debug?: boolean
  terminateAfterJob?: boolean
  globalTimeout?: number
  maxWorkerLifetime?: number
  apiEndpoint?: string
  credentials?: RequestCredentials
  onStateChange?: (state: WorkerState) => void
}

// ======== Reducer の状態と Action 定義 ========
interface WorkerState {
  isRunning: boolean
  lastResult: JobResult | null
  pendingJobs: JobState[]
  worker: Worker | null
  error: Error | null
  activeJobId: string | null
  progress: number
  workerCreatedAt: number
  workerId: string | null
  terminateAfterJob: boolean // 追加: 終了設定を状態に含める
}

type WorkerAction =
  | { type: "INIT_WORKER"; worker: Worker }
  | { type: "WORKER_ID_SET"; id: string }
  | { type: "TERMINATE_WORKER"; source?: string }
  | { type: "JOB_START"; jobId: string }
  | { type: "JOB_PROGRESS"; progress: number; details?: any }
  | { type: "JOB_COMPLETE"; result: JobResult }
  | { type: "JOB_ERROR"; error: Error; jobId: string; duration: number }
  | { type: "JOB_ABORT"; jobId: string; reason?: string }
  | { type: "UPDATE_PENDING_JOBS"; jobs: JobState[] }
  | { type: "UPDATE_TERMINATE_SETTING"; value: boolean } // 追加: 終了設定更新アクション
  | { type: "RESET" }

// 初期状態
const initialWorkerState: WorkerState = {
  isRunning: false,
  lastResult: null,
  pendingJobs: [],
  worker: null,
  error: null,
  activeJobId: null,
  progress: 0,
  workerCreatedAt: 0,
  workerId: null,
  terminateAfterJob: false, // 追加: 終了設定の初期値
}

// ======== Reducer 関数 ========
function workerReducer(state: WorkerState, action: WorkerAction): WorkerState {
  switch (action.type) {
    case "INIT_WORKER":
      return {
        ...state,
        worker: action.worker,
        workerCreatedAt: Date.now(),
        error: null,
      }

    case "WORKER_ID_SET":
      return {
        ...state,
        workerId: action.id,
      }

    case "TERMINATE_WORKER":
      return {
        ...state,
        worker: null,
        workerId: null,
        workerCreatedAt: 0,
      }

    case "JOB_START":
      return {
        ...state,
        isRunning: true,
        activeJobId: action.jobId,
        progress: 0,
        error: null,
      }

    case "JOB_PROGRESS":
      return {
        ...state,
        progress: action.progress,
      }

    case "JOB_COMPLETE":
      return {
        ...state,
        isRunning: false,
        lastResult: action.result,
        activeJobId: null,
        progress: 100,
      }

    case "JOB_ERROR":
      return {
        ...state,
        isRunning: false,
        error: action.error,
        activeJobId: null,
        lastResult: {
          data: null,
          error: action.error,
          duration: action.duration,
          progress: 0,
          status: "failed",
          jobId: action.jobId,
        },
      }

    case "JOB_ABORT":
      return {
        ...state,
        isRunning: false,
        activeJobId: null,
        lastResult: state.lastResult ? { ...state.lastResult, status: "aborted" } : null,
      }

    case "UPDATE_PENDING_JOBS":
      return {
        ...state,
        pendingJobs: action.jobs,
      }

    case "UPDATE_TERMINATE_SETTING":
      return {
        ...state,
        terminateAfterJob: action.value,
      }

    case "RESET":
      return {
        ...initialWorkerState,
      }

    default:
      return state
  }
}

// ======== Storage Helper ========
const jobStorage = {
  saveJob(key: string, job: JobState): void {
    if (typeof window === "undefined") return
    try {
      localStorage.setItem(`job_${key}`, JSON.stringify(job))
    } catch (e) {
      console.error("Failed to save job:", e)
    }
  },

  getJob(key: string): JobState | null {
    if (typeof window === "undefined") return null
    try {
      const data = localStorage.getItem(`job_${key}`)
      return data ? JSON.parse(data) : null
    } catch (e) {
      return null
    }
  },

  removeJob(key: string): void {
    if (typeof window === "undefined") return
    localStorage.removeItem(`job_${key}`)
  },

  getAllJobs(prefix: string = "job_"): JobState[] {
    if (typeof window === "undefined") return []

    const jobs: JobState[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(prefix)) {
        try {
          const data = localStorage.getItem(key)
          if (data) {
            const job = JSON.parse(data)
            jobs.push(job)
          }
        } catch (e) {
          // Skip invalid entries
        }
      }
    }
    return jobs
  },
}

// ======== Hook Main Implementation ========
export function useWebWorker<ResultType = any, PayloadType = any>(options: WorkerOptions) {
  // ステート管理
  const [state, dispatch] = useReducer(workerReducer, {
    ...initialWorkerState,
    terminateAfterJob: options.terminateAfterJob || false, // 初期値をオプションから設定
  })

  // Refs
  const workerRef = useRef<Worker | null>(null)
  const optionsRef = useRef<WorkerOptions>({ ...options })
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map())
  const messageHandlersRef = useRef<Map<string, (event: MessageEvent) => void>>(new Map())
  const eventListenersRef = useRef<Map<string, () => void>>(new Map())

  // メモリリーク防止のため、変更されたオプションを反映
  useEffect(() => {
    optionsRef.current = {
      ...options,
      terminateAfterJob: state.terminateAfterJob, // 状態から値を取得
    }
  }, [options, state.terminateAfterJob])

  // デバッグログ関数
  const log = useCallback((message: string, ...args: any[]): void => {
    if (!optionsRef.current.debug) return

    console.log(`[Worker:${optionsRef.current.mode}] ${message}`, ...args)
  }, [])

  // ユニークなジョブIDを生成
  const generateJobId = useCallback((prefix: string = "job"): string => {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }, [])

  // レスポンスとリクエストの照合 - 前方宣言
  const isMatchingResponse = useCallback((message: any, response: any): boolean => {
    // メッセージにタイプがない場合は単純に最初の応答を受け入れる
    if (!message || typeof message !== "object" || !("type" in message)) {
      return true
    }

    // レスポンスタイプがない場合はマッチしない
    if (!response || typeof response !== "object" || !("type" in response)) {
      return false
    }

    const requestType = message.type as string
    const responseType = response.type as string

    // 標準的なレスポンスパターンをチェック
    switch (requestType) {
      case "PING":
        return responseType === "PONG"
      case "GET_ID":
        return responseType === "ID_RESPONSE"
      case "CONFIG":
        return responseType === "CONFIG_UPDATED"
      case "JOB":
        return responseType === "RESULT" || responseType === "ERROR" || responseType === "PROGRESS"
      default:
        // それ以外のパターンをチェック
        return (
          responseType === requestType ||
          responseType === `${requestType}_RESULT` ||
          responseType === `${requestType}_RESPONSE`
        )
    }
  }, [])

  // Workerを終了
  const terminateWorker = useCallback((): void => {
    const worker = workerRef.current
    if (!worker) return

    log("Terminating worker")

    // 最初にWorker参照をクリア - これにより二重ライフサイクルイベントが防止される
    const currentWorker = workerRef.current
    workerRef.current = null

    // 実際のWorker終了処理
    if (currentWorker) {
      currentWorker.terminate()
    }

    // Worker終了イベントを発行 - 実際の終了後にイベントを発行
    try {
      pubSub.emit("worker:terminated", {
        source: "manual",
        mode: optionsRef.current.mode,
      })
    } catch (e) {
      console.error("Failed to emit worker:terminated event:", e)
    }

    // アクティブなイベントリスナーとメッセージハンドラをクリーンアップ
    eventListenersRef.current.forEach((unsubscribe) => unsubscribe())
    eventListenersRef.current.clear()
    messageHandlersRef.current.clear()

    dispatch({ type: "TERMINATE_WORKER", source: "manual" })
  }, [log])

  // Worker関連の関数型定義
  type InitWorkerFunction = () => Worker | null
  type GetWorkerFunction = () => Worker | null
  type SendDirectMessageFunction = <T extends object = any, R = any>(message: T, timeout?: number) => Promise<R | null>

  // Worker初期化関数の前方宣言
  let initWorkerImpl: InitWorkerFunction
  let getWorkerImpl: GetWorkerFunction
  let sendDirectMessageImpl: SendDirectMessageFunction

  // 実装の初期化
  initWorkerImpl = () => {
    // 既存のWorkerをチェック
    if (workerRef.current) {
      // Workerが古すぎる場合は終了
      if (
        state.workerCreatedAt > 0 &&
        Date.now() - state.workerCreatedAt > (optionsRef.current.maxWorkerLifetime || 30 * 60 * 1000)
      ) {
        log("Worker lifetime exceeded, recreating")
        terminateWorker()
      } else {
        // 既存のWorkerを返す
        return workerRef.current
      }
    }

    try {
      log(`Creating new worker: ${optionsRef.current.scriptUrl}`)

      // Worker作成
      const worker = new Worker(optionsRef.current.scriptUrl, {
        type: "module",
        credentials: optionsRef.current.credentials || "same-origin",
      })

      // エラーハンドラ
      worker.onerror = (event) => {
        console.error("Worker error:", event)
      }

      // Workerを保存
      workerRef.current = worker
      // Worker オブジェクトに terminateAfterJob プロパティを追加
      ;(worker as any).terminateAfterJob = state.terminateAfterJob

      // Workerの初期化
      dispatch({ type: "INIT_WORKER", worker })

      // Worker作成イベントを発行
      pubSub.emit("worker:created", {
        worker: worker,
        mode: optionsRef.current.mode,
      })

      // WorkerIDを取得
      setTimeout(() => {
        sendDirectMessage({ type: "GET_ID" })
          .then((response: any) => {
            if (response?.workerId) {
              dispatch({ type: "WORKER_ID_SET", id: response.workerId })
            }
          })
          .catch(() => {})
      }, 100)

      // リモートモード時の追加設定
      if (optionsRef.current.mode === "remote" && optionsRef.current.apiEndpoint) {
        sendDirectMessage({
          type: "CONFIG",
          payload: {
            apiBaseUrl: optionsRef.current.apiEndpoint,
            defaultOptions: {
              headers: {
                "Content-Type": "application/json",
              },
              credentials: optionsRef.current.credentials || "same-origin",
            },
          },
        }).catch(console.error)
      }

      return worker
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      log("Failed to create Worker:", error)
      return null
    }
  }

  getWorkerImpl = () => {
    // すでにWorkerがある場合はそれを返す
    if (workerRef.current) {
      return workerRef.current
    }

    // terminateAfterJob=falseの場合はWorkerを自動生成しない（明示的なinitWorkerのみで作成）
    if (!state.terminateAfterJob) {
      return null
    }

    // terminateAfterJob=trueの場合は新しいWorkerを作成
    return initWorkerImpl()
  }

  sendDirectMessageImpl = async <T extends object = any, R = any>(message: T, timeout = 5000): Promise<R | null> => {
    const worker = getWorker()
    if (!worker) return null

    return new Promise<R | null>((resolve) => {
      // 応答タイムアウト処理
      const timeoutId = setTimeout(() => {
        messageHandlersRef.current.delete(`direct_${Date.now()}`)
        log(`Message timed out after ${timeout}ms`, message)
        resolve(null)
      }, timeout)

      // 応答ハンドラ
      const handleMessage = (event: MessageEvent) => {
        // レスポンスログ
        if (optionsRef.current.debug) {
          log("Received response:", event.data)
        }

        // メッセージ型に基づいた判定
        const isResponseToDirectMsg = isMatchingResponse(message, event.data)

        if (isResponseToDirectMsg) {
          clearTimeout(timeoutId)
          messageHandlersRef.current.delete(`direct_${Date.now()}`)
          resolve(event.data as R)
          worker.removeEventListener("message", handleMessage)
        }
      }

      // メッセージハンドラを登録
      const handlerId = `direct_${Date.now()}`
      messageHandlersRef.current.set(handlerId, handleMessage)
      worker.addEventListener("message", handleMessage)

      // メッセージを送信
      if (optionsRef.current.debug) {
        log("Sending direct message:", message)
      }
      worker.postMessage(message)
    })
  }

  // Worker初期化
  const initWorker = useCallback<InitWorkerFunction>(() => {
    return initWorkerImpl()
  }, [initWorkerImpl])

  // Worker取得
  const getWorker = useCallback<GetWorkerFunction>(() => {
    return getWorkerImpl()
  }, [getWorkerImpl])

  // 直接メッセージ送信
  const sendDirectMessage = useCallback<SendDirectMessageFunction>(
    async (message, timeout = 5000) => {
      return sendDirectMessageImpl(message, timeout)
    },
    [sendDirectMessageImpl],
  )

  // ローカルジョブの実行
  const executeLocalJob = useCallback(
    async <T = ResultType, P = PayloadType>(jobOptions: JobOptions<P>): Promise<JobResult<T>> => {
      const {
        payload,
        jobId = generateJobId("local"),
        timeout = optionsRef.current.globalTimeout || 30000,
        enableProgress = true,
        retries = 1,
        retryDelay = 500,
        debug = optionsRef.current.debug,
        persistState = false,
        onProgress,
        metadata = {},
      } = jobOptions

      // ジョブ開始処理
      dispatch({ type: "JOB_START", jobId })
      log(`Starting local job: ${jobId}`)

      // 開始時のpubSubイベント発行
      pubSub.emit("worker:job:start", {
        jobId,
        mode: "local",
        payload,
      })

      // 永続化対応
      if (persistState) {
        const jobState: JobState = {
          jobId,
          status: "pending",
          progress: 0,
          startTime: Date.now(),
          lastUpdated: Date.now(),
          metadata: {
            ...metadata,
            mode: "local",
          },
        }

        jobStorage.saveJob(jobId, jobState)
      }

      const startTime = performance.now()
      let currentAttempt = 0
      let lastError: Error | null = null

      // リトライループ
      while (currentAttempt <= retries) {
        currentAttempt++

        try {
          // Worker取得
          const worker = getWorker()
          if (!worker) {
            throw new Error("Worker initialization failed")
          }

          // 進捗状態の更新
          if (persistState) {
            const updatedState: JobState = {
              ...jobStorage.getJob(jobId)!,
              status: "running",
              lastUpdated: Date.now(),
            }
            jobStorage.saveJob(jobId, updatedState)
          }

          // 新しいAbortController
          const abortController = new AbortController()
          abortControllersRef.current.set(jobId, abortController)

          // 結果をPromiseで包む
          const result = await new Promise<T>((resolve, reject) => {
            // タイムアウト処理
            const timeoutId = setTimeout(() => {
              reject(new Error(`Job timeout after ${timeout}ms`))
            }, timeout)

            // メッセージハンドラ
            const handleMessage = (event: MessageEvent) => {
              const { type, payload: responsePayload, jobId: responseJobId } = event.data || {}

              // このジョブ用のメッセージかを確認
              if (responseJobId && responseJobId !== jobId) return

              if (type === "RESULT") {
                clearTimeout(timeoutId)
                cleanup()
                resolve(responsePayload as T)
              } else if (type === "ERROR") {
                clearTimeout(timeoutId)
                cleanup()
                reject(new Error(responsePayload?.message || "Worker error"))
              } else if (type === "PROGRESS" && enableProgress) {
                const percent = responsePayload?.percent || 0
                dispatch({ type: "JOB_PROGRESS", progress: percent })

                if (onProgress) {
                  onProgress(percent)
                }

                // 進捗イベント発行
                pubSub.emit("worker:job:progress", {
                  jobId,
                  progress: percent,
                  details: responsePayload,
                })

                if (persistState) {
                  const storedJob = jobStorage.getJob(jobId)
                  if (storedJob) {
                    jobStorage.saveJob(jobId, {
                      ...storedJob,
                      progress: percent,
                      lastUpdated: Date.now(),
                    })
                  }
                }
              }
            }

            // クリーンアップ関数
            const cleanup = () => {
              worker.removeEventListener("message", handleMessage)
              abortControllersRef.current.delete(jobId)
            }

            // 中止ハンドラ
            abortController.signal.addEventListener("abort", () => {
              clearTimeout(timeoutId)
              cleanup()
              reject(new Error("Job aborted"))
            })

            // メッセージハンドラを登録
            worker.addEventListener("message", handleMessage)

            // ジョブメッセージを送信
            worker.postMessage({
              type: "JOB",
              payload,
              jobId,
              debug,
            })
          })

          // 成功時の処理
          const endTime = performance.now()
          const duration = endTime - startTime

          log(`Local job ${jobId} completed in ${duration.toFixed(1)}ms`)

          // 永続化対応
          if (persistState) {
            jobStorage.saveJob(jobId, {
              jobId,
              status: "completed",
              progress: 100,
              startTime: Date.now() - duration,
              lastUpdated: Date.now(),
              result,
              metadata: {
                ...metadata,
                mode: "local",
                duration,
              },
            })
          }

          // 結果オブジェクト
          const finalResult: JobResult<T> = {
            data: result,
            error: null,
            duration,
            progress: 100,
            status: "completed",
            jobId,
            metadata: persistState ? metadata : undefined,
          }

          // 完了イベント発行 (終了前に発行)
          pubSub.emit("worker:job:complete", {
            jobId,
            result: finalResult,
            duration,
          })

          dispatch({ type: "JOB_COMPLETE", result: finalResult })

          // Worker終了処理 - 完了イベント後に実行
          if (state.terminateAfterJob) {
            // 自動終了イベントを発行
            log("Auto-terminating worker after job completion")
            terminateWorker()
          }

          return finalResult
        } catch (err) {
          // エラー処理
          lastError = err instanceof Error ? err : new Error(String(err))

          log(`Local job ${jobId} failed on attempt ${currentAttempt}/${retries + 1}:`, lastError)

          // エラーイベント発行
          pubSub.emit("worker:job:error", {
            jobId,
            error: lastError,
            duration: performance.now() - startTime,
          })

          // 最後のリトライでなければ再試行
          if (currentAttempt <= retries) {
            log(`Retrying job ${jobId} in ${retryDelay}ms`)
            await new Promise((resolve) => setTimeout(resolve, retryDelay))
          }
        }
      }

      // すべてのリトライが失敗
      const errorDuration = performance.now() - startTime

      // 永続化対応
      if (persistState) {
        jobStorage.saveJob(jobId, {
          jobId,
          status: "failed",
          progress: 0,
          startTime: Date.now() - errorDuration,
          lastUpdated: Date.now(),
          error: lastError || new Error("Unknown error"),
          metadata: {
            ...metadata,
            mode: "local",
            duration: errorDuration,
          },
        })
      }

      // エラー結果
      const errorResult: JobResult<T> = {
        data: null,
        error: lastError,
        duration: errorDuration,
        progress: 0,
        status: "failed",
        jobId,
        metadata: persistState ? metadata : undefined,
      }

      dispatch({
        type: "JOB_ERROR",
        error: lastError || new Error("Unknown error"),
        jobId,
        duration: errorDuration,
      })

      return errorResult
    },
    [generateJobId, getWorker, log, terminateWorker, state.terminateAfterJob],
  )

  // リモートジョブの実行
  const executeRemoteJob = useCallback(
    async <T = ResultType, P = PayloadType>(jobOptions: JobOptions<P>): Promise<JobResult<T>> => {
      if (optionsRef.current.mode !== "remote") {
        throw new Error("Cannot execute remote job in local mode")
      }

      const {
        payload,
        jobId = generateJobId("remote"),
        timeout = optionsRef.current.globalTimeout || 120000,
        enableProgress = true,
        retries = 2,
        retryDelay = 1000,
        persistState = true,
        onProgress,
        metadata = {},
      } = jobOptions

      // ジョブ開始処理
      dispatch({ type: "JOB_START", jobId })
      log(`Starting remote job: ${jobId}`)

      // 開始イベント発行
      pubSub.emit("worker:job:start", {
        jobId,
        mode: "remote",
        payload,
      })

      // 永続化対応
      if (persistState) {
        const jobState: JobState = {
          jobId,
          status: "pending",
          progress: 0,
          startTime: Date.now(),
          lastUpdated: Date.now(),
          metadata: {
            ...metadata,
            mode: "remote",
            apiEndpoint: optionsRef.current.apiEndpoint,
          },
        }

        jobStorage.saveJob(jobId, jobState)
      }

      // 実行開始時間
      const startTime = performance.now()
      let lastError: Error | null = null
      let currentAttempt = 0

      // リトライループを実装
      while (currentAttempt <= retries) {
        currentAttempt++
        log(`Remote job attempt ${currentAttempt}/${retries + 1}`)

        try {
          // Worker取得
          const worker = getWorker()
          if (!worker) {
            throw new Error("Worker initialization failed")
          }

          // 実行前にCONFIGメッセージを送信して確実に設定
          if (currentAttempt === 1) {
            try {
              const configResult = await sendDirectMessage(
                {
                  type: "CONFIG",
                  payload: {
                    apiBaseUrl: optionsRef.current.apiEndpoint,
                    defaultOptions: {
                      headers: {
                        "Content-Type": "application/json",
                      },
                      credentials: optionsRef.current.credentials || "same-origin",
                    },
                  },
                },
                5000,
              )

              if (!configResult) {
                log("Worker configuration timed out, retry might be needed")
              }
            } catch (configErr) {
              log("Worker configuration error:", configErr)
              // 設定エラーは無視して処理を継続
            }
          }

          // AbortController
          const abortController = new AbortController()
          abortControllersRef.current.set(jobId, abortController)

          // グローバルタイムアウト設定 - どんな場合でもこの時間が経過したらタイムアウト
          let globalTimeoutId: number | undefined

          try {
            // 結果をPromiseで包む
            const result = await Promise.race([
              new Promise<T>((resolve, reject) => {
                // メッセージハンドラ
                const handleMessage = (event: MessageEvent) => {
                  const { type, payload: responsePayload, jobId: responseJobId } = event.data || {}

                  // このジョブ用のメッセージかを確認
                  if (responseJobId && responseJobId !== jobId) return

                  if (type === "RESULT") {
                    cleanup()
                    resolve(responsePayload as T)
                  } else if (type === "ERROR") {
                    cleanup()
                    reject(new Error(responsePayload?.message || "Remote job error"))
                  } else if (type === "PROGRESS" && enableProgress) {
                    const percent = responsePayload?.percent || 0
                    dispatch({
                      type: "JOB_PROGRESS",
                      progress: percent,
                      details: responsePayload,
                    })

                    // 進捗イベント発行
                    pubSub.emit("worker:job:progress", {
                      jobId,
                      progress: percent,
                      details: responsePayload,
                    })

                    if (onProgress) {
                      onProgress(percent)
                    }

                    if (persistState) {
                      const storedJob = jobStorage.getJob(jobId)
                      if (storedJob) {
                        jobStorage.saveJob(jobId, {
                          ...storedJob,
                          progress: percent,
                          lastUpdated: Date.now(),
                        })
                      }
                    }
                  }
                }

                // クリーンアップ関数
                const cleanup = () => {
                  if (globalTimeoutId) clearTimeout(globalTimeoutId)
                  worker.removeEventListener("message", handleMessage)
                  abortControllersRef.current.delete(jobId)
                }

                // 中止ハンドラ
                abortController.signal.addEventListener("abort", () => {
                  cleanup()
                  reject(new Error("Remote job aborted"))
                })

                // メッセージハンドラを登録
                worker.addEventListener("message", handleMessage)

                // リモートジョブメッセージを送信
                worker.postMessage({
                  type: "API_JOB",
                  payload,
                  jobId,
                  debug: optionsRef.current.debug,
                })
              }),
              new Promise<never>((_, reject) => {
                globalTimeoutId = window.setTimeout(() => {
                  log(`Global timeout reached for job ${jobId} after ${timeout}ms`)
                  abortController.abort()
                  reject(new Error(`Remote job timeout after ${timeout}ms`))
                }, timeout)
              }),
            ])

            // 成功時の処理
            const endTime = performance.now()
            const duration = endTime - startTime

            log(`Remote job ${jobId} completed in ${duration.toFixed(1)}ms`)

            // 永続化対応
            if (persistState) {
              jobStorage.saveJob(jobId, {
                jobId,
                status: "completed",
                progress: 100,
                startTime: Date.now() - duration,
                lastUpdated: Date.now(),
                result,
                metadata: {
                  ...metadata,
                  mode: "remote",
                  apiEndpoint: optionsRef.current.apiEndpoint,
                  duration,
                },
              })
            }

            // 結果オブジェクト
            const finalResult: JobResult<T> = {
              data: result,
              error: null,
              duration,
              progress: 100,
              status: "completed",
              jobId,
              metadata: persistState ? metadata : undefined,
            }

            dispatch({ type: "JOB_COMPLETE", result: finalResult })

            // 完了イベント発行
            pubSub.emit("worker:job:complete", {
              jobId,
              result: finalResult,
              duration,
            })

            // 成功したのでループを終了
            return finalResult
          } finally {
            // タイムアウトがまだ動いている場合はクリア
            if (globalTimeoutId) clearTimeout(globalTimeoutId)
          }
        } catch (err) {
          // エラー処理
          lastError = err instanceof Error ? err : new Error(String(err))
          log(`Remote job ${jobId} failed on attempt ${currentAttempt}/${retries + 1}: ${lastError.message}`)

          // 最後のリトライでなければ再試行
          if (currentAttempt <= retries) {
            log(`Retrying job ${jobId} in ${retryDelay}ms`)
            await new Promise((resolve) => setTimeout(resolve, retryDelay))

            // Workerを再作成する
            terminateWorker()
            await new Promise((resolve) => setTimeout(resolve, 100)) // 少し待ってから
            initWorker()
            await new Promise((resolve) => setTimeout(resolve, 100)) // Workerの初期化待ち
          }
        }
      }

      // すべてのリトライが失敗した場合
      const errorDuration = performance.now() - startTime

      log(`All ${retries + 1} attempts failed for remote job ${jobId}`)

      // エラーイベント発行
      pubSub.emit("worker:job:error", {
        jobId,
        error: lastError || new Error("All retry attempts failed"),
        duration: errorDuration,
      })

      // 永続化対応
      if (persistState) {
        jobStorage.saveJob(jobId, {
          jobId,
          status: "failed",
          progress: 0,
          startTime: Date.now() - errorDuration,
          lastUpdated: Date.now(),
          error: lastError,
          metadata: {
            ...metadata,
            mode: "remote",
            apiEndpoint: optionsRef.current.apiEndpoint,
            duration: errorDuration,
          },
        })
      }

      // エラー結果
      const errorResult: JobResult<T> = {
        data: null,
        error: lastError,
        duration: errorDuration,
        progress: 0,
        status: "failed",
        jobId,
        metadata: persistState ? metadata : undefined,
      }

      // エラー状態を更新
      dispatch({
        type: "JOB_ERROR",
        error: lastError || new Error("Unknown error"),
        jobId,
        duration: errorDuration,
      })

      return errorResult
    },
    [generateJobId, getWorker, log, sendDirectMessage, terminateWorker, initWorker],
  )

  // ジョブ実行（統一インターフェース）
  const executeJob = useCallback(
    async <T = ResultType, P = PayloadType>(jobOptions: JobOptions<P>): Promise<JobResult<T>> => {
      // Workerが存在しない場合は明示的に初期化
      let worker = getWorker()
      if (!worker) {
        worker = initWorker()
      }
      if (!worker) {
        return {
          data: null,
          error: new Error("Worker initialization failed"),
          duration: 0,
          progress: 0,
          status: "failed",
          jobId: jobOptions.jobId || "failed_job",
        }
      }
      // モード別のジョブ実行
      return optionsRef.current.mode === "remote"
        ? executeRemoteJob<T, P>(jobOptions)
        : executeLocalJob<T, P>(jobOptions)
    },
    [getWorker, initWorker, executeRemoteJob, executeLocalJob],
  )

  // ジョブ中止
  const abortJob = useCallback(
    (jobId?: string): Promise<boolean> => {
      if (jobId) {
        // 特定のジョブのみ中止
        log(`Aborting job ${jobId}`)

        const controller = abortControllersRef.current.get(jobId)
        if (controller) {
          controller.abort()
          abortControllersRef.current.delete(jobId)
          dispatch({ type: "JOB_ABORT", jobId, reason: "User abort" })

          // 中止イベント発行
          pubSub.emit("worker:job:abort", {
            jobId,
            reason: "User abort",
          })

          // 永続化状態の更新
          const jobData = jobStorage.getJob(jobId)
          if (jobData) {
            jobStorage.saveJob(jobId, {
              ...jobData,
              status: "aborted",
              lastUpdated: Date.now(),
              aborted: true,
            })
          }

          // リモートジョブの場合はリモート側も中止
          if (optionsRef.current.mode === "remote" && jobData?.metadata?.mode === "remote") {
            sendDirectMessage({
              type: "TERMINATE_REMOTE_JOB",
              payload: { jobId },
            }).catch(console.error)
          }

          return Promise.resolve(true)
        }

        return Promise.resolve(false)
      } else {
        // すべてのジョブを中止
        log("Aborting all jobs")
        let aborted = false

        abortControllersRef.current.forEach((controller, id) => {
          controller.abort()
          aborted = true

          // 中止イベント発行
          pubSub.emit("worker:job:abort", {
            jobId: id,
            reason: "Batch abort",
          })

          // 永続化状態の更新
          const jobData = jobStorage.getJob(id)
          if (jobData) {
            jobStorage.saveJob(id, {
              ...jobData,
              status: "aborted",
              lastUpdated: Date.now(),
              aborted: true,
            })
          }

          dispatch({ type: "JOB_ABORT", jobId: id, reason: "Batch abort" })
        })

        abortControllersRef.current.clear()

        return Promise.resolve(aborted)
      }
    },
    [log, sendDirectMessage],
  )

  // ジョブ状態の取得
  const getJobState = useCallback(
    async (jobId: string): Promise<JobState | null> => {
      // ローカルの状態を確認
      const localState = jobStorage.getJob(jobId)

      // リモートモードで、リモートジョブならAPIを使用して最新状態取得
      if (
        optionsRef.current.mode === "remote" &&
        localState?.metadata?.mode === "remote" &&
        (localState.status === "pending" || localState.status === "running")
      ) {
        try {
          const worker = getWorker()
          if (worker) {
            const status = await sendDirectMessage({
              type: "PREFLIGHT_CHECK",
              payload: { jobId },
            })

            if (status && status.exists) {
              // リモートからの状態で更新
              const updatedState = {
                ...localState,
                status: status.status as JobStatus,
                progress: status.progress || 0,
                lastUpdated: Date.now(),
              }

              if (status.error) {
                updatedState.error = new Error(status.error)
              }

              if (status.result) {
                updatedState.result = status.result
              }

              // 保存して返す
              jobStorage.saveJob(jobId, updatedState)
              return updatedState
            }
          }
        } catch (error) {
          log(`Error checking remote job status: ${jobId}`, error)
        }
      }

      return localState
    },
    [getWorker, log, sendDirectMessage],
  )

  // 保留中のジョブを復元
  const restorePendingJobs = useCallback(async (): Promise<JobState[]> => {
    if (typeof window === "undefined") return []

    const pendingJobs = jobStorage
      .getAllJobs()
      .filter(
        (job) =>
          (job.status === "pending" || job.status === "running") && job.metadata?.mode === optionsRef.current.mode,
      )

    if (pendingJobs.length > 0) {
      log(`Found ${pendingJobs.length} pending jobs`, pendingJobs)
      dispatch({ type: "UPDATE_PENDING_JOBS", jobs: pendingJobs })
    }

    return pendingJobs
  }, [log])

  // リモートジョブ固有の機能：リモートジョブの終了
  const terminateRemoteJob = useCallback(
    async (jobId: string): Promise<boolean> => {
      if (optionsRef.current.mode !== "remote") {
        return false
      }

      try {
        const worker = getWorker()
        if (!worker) return false

        const result = await sendDirectMessage({
          type: "TERMINATE_REMOTE_JOB",
          payload: { jobId },
        })

        if (result && result.success) {
          log(`Remote job terminated: ${jobId}`)

          // 中止イベント発行
          pubSub.emit("worker:job:abort", {
            jobId,
            reason: "Remote job terminated",
          })

          // ローカルの状態も更新
          const jobData = jobStorage.getJob(jobId)
          if (jobData) {
            jobStorage.saveJob(jobId, {
              ...jobData,
              status: "aborted",
              lastUpdated: Date.now(),
              aborted: true,
            })
          }

          return true
        }
        return false
      } catch (error) {
        log(`Error terminating remote job: ${jobId}`, error)
        return false
      }
    },
    [getWorker, log, sendDirectMessage],
  )

  // リモートジョブ固有の機能：リモートジョブのステータスチェック
  const checkRemoteJobStatus = useCallback(
    async (jobId: string) => {
      if (optionsRef.current.mode !== "remote") {
        return null
      }

      try {
        const worker = getWorker()
        if (!worker) return null

        return await sendDirectMessage({
          type: "PREFLIGHT_CHECK",
          payload: { jobId },
        })
      } catch (error) {
        log(`Error checking remote job status: ${jobId}`, error)
        return null
      }
    },
    [getWorker, log, sendDirectMessage],
  )

  // 自動終了設定の制御
  const setTerminateAfterJob = useCallback(
    (value: boolean) => {
      // Redux状態を更新
      dispatch({ type: "UPDATE_TERMINATE_SETTING", value })

      // オプションも更新
      optionsRef.current = {
        ...optionsRef.current,
        terminateAfterJob: value,
      }

      // Workerオブジェクトにも設定を反映
      if (workerRef.current) {
        ;(workerRef.current as any).terminateAfterJob = value
      }

      log(`Updated terminateAfterJob setting: ${value}`)

      // 設定変更イベントの発行
      pubSub.emit("worker:setting:changed", {
        setting: "terminateAfterJob",
        value,
      })
    },
    [log],
  )

  // リモートジョブの全体状態を取得する関数
  const getAllPendingJobs = useCallback(async (): Promise<JobState[]> => {
    if (optionsRef.current.mode !== "remote") {
      return []
    }

    try {
      // APIから取得を試みる
      let apiJobs: JobState[] = []
      try {
        const worker = getWorker()
        if (worker) {
          const response = await sendDirectMessage(
            {
              type: "PREFLIGHT_CHECK",
              payload: { jobId: "all" },
            },
            3000,
          )

          if (response?.type === "PREFLIGHT_RESULT" && Array.isArray(response.payload)) {
            apiJobs = response.payload
          }
        }
      } catch (error) {
        log(`Failed to get jobs from API worker: ${error}`)
      }

      // localStorageから取得
      const storageJobs = jobStorage
        .getAllJobs()
        .filter((job) => (job.status === "pending" || job.status === "running") && job.metadata?.mode === "remote")

      // 両方のリストをマージ（重複を除去）
      const mergedJobs: JobState[] = [...apiJobs]
      const apiJobIds = new Set(apiJobs.map((job) => job.jobId))

      for (const job of storageJobs) {
        if (!apiJobIds.has(job.jobId)) {
          mergedJobs.push(job)
        }
      }

      log(`Found ${mergedJobs.length} pending jobs (${apiJobs.length} from API, ${storageJobs.length} from storage)`)

      return mergedJobs
    } catch (error) {
      log(`Error retrieving pending jobs: ${error}`)
      return []
    }
  }, [getWorker, sendDirectMessage, log])

  // リソースクリーンアップ
  useEffect(() => {
    // コンポーネントのアンマウント時に使用する現在のコントローラーをキャプチャ
    const currentControllers = abortControllersRef.current

    return () => {
      // アクティブなすべてのジョブを中止
      currentControllers.forEach((controller) => {
        controller.abort()
      })

      // Workerを終了
      if (workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
      }
    }
  }, [])

  // 初期化後に保留中のジョブを復元（リモートモードのみ）
  useEffect(() => {
    if (optionsRef.current.mode === "remote") {
      restorePendingJobs().catch(console.error)
    }
  }, [restorePendingJobs])

  // 効率化のためにAPIオブジェクトをメモ化
  const api = useMemo(() => {
    const isRemoteMode = optionsRef.current.mode === "remote"

    const baseApi = {
      // 共通API
      executeJob,
      abortJob,
      getJobState,

      // 状態
      isRunning: state.isRunning,
      lastResult: state.lastResult,
      error: state.error,
      progress: state.progress,
      activeJobId: state.activeJobId,
      workerId: state.workerId,
      pendingJobs: isRemoteMode ? state.pendingJobs : [],
      getAllPendingJobs,

      // 設定
      terminateAfterJob: state.terminateAfterJob, // 状態から値を取得
      setTerminateAfterJob,

      // 低レベルAPI
      getWorker,
      initWorker,
      terminateWorker,
      sendDirectMessage,

      // モード情報
      mode: optionsRef.current.mode,
      isRemoteMode,
      isLocalMode: !isRemoteMode,
    }

    // モード別API
    if (isRemoteMode) {
      return {
        ...baseApi,
        executeRemoteJob,
        checkRemoteJobStatus,
        terminateRemoteJob,
        restorePendingJobs,
      }
    } else {
      return {
        ...baseApi,
        executeLocalJob,
      }
    }
  }, [
    abortJob,
    checkRemoteJobStatus,
    executeJob,
    executeLocalJob,
    executeRemoteJob,
    getJobState,
    getWorker,
    initWorker,
    restorePendingJobs,
    sendDirectMessage,
    setTerminateAfterJob,
    getAllPendingJobs,
    state.activeJobId,
    state.error,
    state.isRunning,
    state.lastResult,
    state.pendingJobs,
    state.progress,
    state.workerId,
    state.terminateAfterJob, // 状態のterminateAfterJobを依存配列に追加
    terminateRemoteJob,
    terminateWorker,
  ])

  return api
}

// エイリアス関数 - よりシンプルなAPI
export function useLocalWorker<ResultType = any, PayloadType = any>(options: Omit<WorkerOptions, "mode">) {
  return useWebWorker<ResultType, PayloadType>({
    ...options,
    mode: "local",
  })
}

export function useRemoteWorker<ResultType = any, PayloadType = any>(
  options: Omit<WorkerOptions, "mode"> & { apiEndpoint: string },
) {
  return useWebWorker<ResultType, PayloadType>({
    ...options,
    mode: "remote",
  })
}
