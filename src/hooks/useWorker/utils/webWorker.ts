import { createJobId, createJobResult, JobResult, jobService, JobState } from "./job"
import { pubSub } from "./pubsub"

/**
 * ワーカータイプ定義
 */
export type WorkerMode = "local" | "remote"

/**
 * 基本的なジョブオプション
 */
export interface BaseJobOptions<P = any> {
  // ジョブパラメータ
  payload: P
  // タイムアウト時間 (ミリ秒)
  timeout?: number
  // 進捗報告を有効にする
  enableProgress?: boolean
  // デバッグログを有効にする
  debug?: boolean
  // リクエスト失敗時のリトライ回数
  retries?: number
  // リトライ時の待機時間 (ミリ秒)
  retryDelay?: number
  // ジョブID (指定しない場合は自動生成)
  jobId?: string
  // 状態を永続化するかどうか
  persistState?: boolean
  // 進捗状況のコールバック
  onProgress?: (progress: number, state?: Partial<JobState>) => void
  // 追加のメタデータ
  metadata?: Record<string, any>
}

/**
 * ローカルジョブのオプション
 */
export interface LocalJobOptions<P = any> extends BaseJobOptions<P> {
  // (ローカル固有のオプションが必要な場合、ここに追加)
}

/**
 * リモートジョブのオプション
 */
export interface RemoteJobOptions<P = any> extends BaseJobOptions<P> {
  // ジョブタイプ (バックエンド処理の識別に使用)
  jobType?: string
  // ポーリング間隔 (ミリ秒)
  pollInterval?: number
}

/**
 * WebWorkerManagerイベント定義
 */
export interface WorkerEvents {
  "worker:created": { worker: Worker; mode: "local" | "remote"; type?: string }
  "worker:terminated": {
    source: string
    mode: "local" | "remote"
    type?: string
  }
  "worker:job:start": { jobId: string; mode: "local" | "remote"; payload: any }
  "worker:job:progress": { jobId: string; progress: number; details?: any }
  "worker:job:complete": { jobId: string; result: any; duration: number }
  "worker:job:error": { jobId: string; error: Error; duration: number }
  "worker:job:abort": { jobId: string; reason?: string }
  "worker:state:change": { isRunning: boolean; jobId?: string }
}

// PubSubに型定義を追加
declare module "@/utils/pubsub" {
  interface EventMap extends WorkerEvents {}
}

/**
 * WebWorkerManagerオプション
 */
export interface WorkerManagerOptions {
  scriptUrl: string
  mode: "local" | "remote"
  workerType?: WorkerType
  debug?: boolean
  globalTimeout?: number
  terminateAfterJob?: boolean
  maxWorkerLifetime?: number
  apiEndpoint?: string
  defaultPollInterval?: number
  autoRestorePendingJobs?: boolean
  storageKeyPrefix?: string
  credentials: RequestCredentials | null
  onProgress: ((progress: number, jobId: string) => void) | null
  onError: ((error: Error, jobId: string) => void) | null
}

/**
 * Worker管理クラス - React非依存
 */
export class WorkerManager {
  private options: Required<WorkerManagerOptions>
  private worker: Worker | null = null
  private creationTime: number = 0
  private abortControllers: Map<string, AbortController> = new Map()
  private activeJobs: Set<string> = new Set()
  private configured: boolean = false
  private isRunning: boolean = false
  private lastResult: JobResult | null = null

  constructor(options: WorkerManagerOptions) {
    // デフォルト値を設定
    const isRemote = options.mode === "remote"
    this.options = {
      scriptUrl: options.scriptUrl,
      mode: options.mode,
      workerType: options.workerType || (isRemote ? "module" : "classic"),
      credentials: options.credentials,
      debug: options.debug || false,
      globalTimeout: options.globalTimeout || (isRemote ? 3 * 60 * 1000 : 30000),
      terminateAfterJob: options.terminateAfterJob ?? (isRemote ? false : true),
      maxWorkerLifetime: options.maxWorkerLifetime || (isRemote ? 30 * 60 * 1000 : 5 * 60 * 1000),
      apiEndpoint: options.apiEndpoint || "/api/jobs",
      defaultPollInterval: options.defaultPollInterval || 1000,
      autoRestorePendingJobs: options.autoRestorePendingJobs ?? true,
      storageKeyPrefix: options.storageKeyPrefix || (isRemote ? "remote_job_" : "local_job_"),
      onProgress: options.onProgress,
      onError: options.onError,
    }

    // 初期化時に前回の保留ジョブを復元
    if (typeof window !== "undefined" && isRemote && this.options.autoRestorePendingJobs) {
      this.restorePendingJobs()
    }
  }

  /**
   * デバッグログ
   */
  private log(message: string, ...args: any[]): void {
    if (this.options.debug) {
      console.log(`[${this.options.mode === "remote" ? "RemoteWorker" : "LocalWorker"}] ${message}`, ...args)
    }
  }

  /**
   * Workerが古いかチェック
   */
  private isWorkerTooOld(): boolean {
    return this.worker !== null && Date.now() - this.creationTime > this.options.maxWorkerLifetime
  }

  /**
   * Workerインスタンスを取得 (必要な場合は作成)
   */
  async getWorker(): Promise<Worker | null> {
    const isRemote = this.options.mode === "remote"

    // 既存Workerが古すぎる場合は破棄
    if (this.isWorkerTooOld()) {
      this.log("Worker lifetime exceeded, recreating")
      this.terminateWorker()
    }

    // 新しいWorkerを作成
    if (!this.worker) {
      try {
        this.log(`Creating new ${isRemote ? "API" : "local"} worker: ${this.options.scriptUrl}`)
        this.worker = new Worker(this.options.scriptUrl, {
          type: this.options.workerType,
          credentials: this.options.credentials ?? undefined,
        })
        this.creationTime = Date.now()

        if (isRemote) {
          this.configured = false
        }

        // 基本的なエラーハンドラ
        this.worker.onerror = (event) => {
          console.error(`${isRemote ? "API " : ""}Worker error:`, event)
          if (this.options.onError) {
            this.options.onError(new Error(`Worker error: ${event.message}`), "global")
          }
        }

        // Worker作成イベントを発行
        try {
          if (typeof window !== "undefined") {
            pubSub.emit("worker:created", {
              worker: this.worker,
              mode: this.options.mode,
              type: isRemote ? "api" : undefined,
            })
          }
        } catch (e) {
          console.error("Failed to dispatch worker creation event:", e)
        }
      } catch (err) {
        console.error(`Failed to create ${isRemote ? "API " : ""}Worker:`, err)
        return null
      }
    }

    // リモートモードで設定が必要な場合
    if (isRemote && !this.configured && this.worker) {
      await this.configureRemoteWorker(this.worker)
    }

    return this.worker
  }

  /**
   * Workerの参照のみを取得 (作成は行わない)
   */
  getWorkerRef(): Worker | null {
    return this.worker
  }

  /**
   * Workerを終了
   */
  terminateWorker(): void {
    if (this.worker) {
      this.log("Terminating worker")

      // Worker終了イベントを発行
      try {
        pubSub.emit("worker:terminated", {
          source: "manual",
          mode: this.options.mode,
          type: this.options.mode === "remote" ? "api" : undefined,
        })
      } catch (e) {
        console.error("Failed to dispatch worker termination event:", e)
      }

      this.worker.terminate()
      this.worker = null
      this.creationTime = 0

      if (this.options.mode === "remote") {
        this.configured = false
      }
    }
  }

  /**
   * リモートワーカーの初期設定
   */
  private async configureRemoteWorker(worker: Worker): Promise<boolean> {
    if (!worker || this.options.mode !== "remote") return false

    try {
      // APIエンドポイントと設定を送信
      const response = await this.sendDirectMessage(
        {
          type: "CONFIG",
          payload: {
            apiBaseUrl: this.options.apiEndpoint,
            defaultOptions: {
              headers: {
                "Content-Type": "application/json",
              },
              credentials: "include",
            },
          },
        },
        5000,
      )

      if (response && response.type === "CONFIG_UPDATED") {
        this.configured = true
        this.log("API Worker configured successfully")
        return true
      }

      return false
    } catch (err) {
      this.log("Failed to configure API Worker:", err)
      return false
    }
  }

  // 以下、その他の主要メソッド

  // 実行状態の取得
  isJobRunning(): boolean {
    return this.isRunning
  }

  // 最後の結果を取得
  getLastResult(): JobResult | null {
    return this.lastResult
  }

  // 自動終了設定の変更
  setTerminateAfterJob(value: boolean): void {
    this.options.terminateAfterJob = value
    this.log(`Updated terminateAfterJob setting to: ${value}`)
  }

  // ジョブ実行 (ローカル/リモートに応じて適切な実行メソッドを使用)
  async executeJob<ResultType = any, PayloadType = any>(jobOptions: any): Promise<JobResult<ResultType>> {
    const result =
      this.options.mode === "remote"
        ? await this.executeRemoteJob<ResultType, PayloadType>(jobOptions)
        : await this.executeLocalJob<ResultType, PayloadType>(jobOptions)

    this.lastResult = result
    return result
  }

  // ローカルジョブ実行
  private async executeLocalJob<ResultType = any, PayloadType = any>(
    jobOptions: LocalJobOptions<PayloadType>,
  ): Promise<JobResult<ResultType>> {
    const {
      payload,
      timeout = this.options.globalTimeout,
      enableProgress = true,
      debug: jobDebug = this.options.debug,
      retries = 1,
      retryDelay = 500,
      jobId = createJobId("local"),
      persistState = false,
      onProgress,
      metadata = {},
    } = jobOptions

    // ジョブ開始イベントを発行
    pubSub.emit("worker:state:change", { isRunning: true, jobId })
    pubSub.emit("worker:job:start", {
      jobId,
      mode: "local",
      payload,
    })

    // 永続化が有効な場合、JobServiceを使用
    if (persistState) {
      jobService.createJob({
        jobId,
        payload,
        type: "local",
        debug: jobDebug,
        enableProgress,
        metadata: {
          ...metadata,
          isRemote: false,
        },
        onProgress: onProgress ? (progress, state) => onProgress(progress, state) : undefined,
      })

      await jobService.updateJobState(jobId, {
        status: "pending",
        progress: 0,
      })
    }

    // 実行状態を更新
    this.isRunning = true
    let currentAttempt = 0
    let lastError: Error | null = null

    // タイムスタンプを記録
    const startTime = performance.now()

    // リトライを含めたジョブ実行ループ
    while (currentAttempt <= retries) {
      currentAttempt++

      try {
        this.log(`Starting local job ${jobId}, attempt ${currentAttempt}/${retries + 1}`)

        // 進行中の状態を更新
        if (persistState) {
          await jobService.updateJobState(jobId, {
            status: "running",
            progress: 0,
            startTime: Date.now(),
          })
        }

        // 新しいAbortControllerを作成
        const abortController = new AbortController()
        this.abortControllers.set(jobId, abortController)

        // Workerインスタンスを取得
        const worker = await this.getWorker()
        if (!worker) {
          throw new Error("Failed to create worker")
        }

        // 結果をPromiseで包む
        const result = await new Promise<ResultType>((resolve, reject) => {
          // タイムアウト処理
          const timeoutId = setTimeout(() => {
            reject(new Error(`Job timeout after ${timeout}ms`))
          }, timeout)

          // 進捗ハンドラを設定
          const progressHandler = this.setupProgressHandler(
            worker,
            jobId,
            enableProgress
              ? (progress: number) => {
                  // 進捗イベントを発行
                  pubSub.emit("worker:job:progress", {
                    jobId,
                    progress,
                  })

                  // 永続化が有効な場合、進捗を保存
                  if (persistState) {
                    jobService.updateProgress(jobId, progress).catch(() => {
                      // エラーは無視
                    })
                  }

                  // onProgressコールバックがあれば呼び出す
                  if (onProgress) {
                    onProgress(progress)
                  }
                }
              : undefined,
          )

          // 結果ハンドラ
          const handleMessage = (event: MessageEvent) => {
            const { type, payload: responsePayload, jobId: responseJobId } = event.data || {}

            // 対象のジョブIDのみ処理
            if (responseJobId && responseJobId !== jobId) return

            if (type === "RESULT") {
              // ジョブ完了
              clearTimeout(timeoutId)
              cleanup()
              resolve(responsePayload)
            } else if (type === "ERROR") {
              // エラー処理
              clearTimeout(timeoutId)
              cleanup()
              reject(new Error(responsePayload?.message || "Unknown worker error"))
            }
          }

          // クリーンアップ関数
          const cleanup = () => {
            worker.removeEventListener("message", handleMessage)
            worker.removeEventListener("message", progressHandler)
            this.abortControllers.delete(jobId)
          }

          // AbortSignal処理
          abortController.signal.addEventListener("abort", () => {
            clearTimeout(timeoutId)
            cleanup()
            reject(new Error("Job aborted"))
          })

          // メッセージハンドラを追加
          worker.addEventListener("message", handleMessage)
          worker.addEventListener("message", progressHandler)

          // ジョブメッセージを送信
          worker.postMessage({
            type: "JOB",
            payload,
            jobId,
            debug: jobDebug,
          })
        })

        // 成功した場合の処理
        const endTime = performance.now()
        const duration = endTime - startTime

        this.log(`Local job ${jobId} completed in ${duration.toFixed(1)}ms`)

        // 永続化が有効な場合、結果を保存
        if (persistState) {
          await jobService.completeJob(jobId, result)
        }

        const finalResult: JobResult<ResultType> = {
          data: result,
          error: null,
          duration,
          progress: 100,
          status: "completed",
          jobId,
          metadata: persistState ? metadata : undefined,
        }

        // 結果を保存
        this.lastResult = finalResult

        // 完了イベントを発行
        pubSub.emit("worker:job:complete", {
          jobId,
          result: finalResult,
          duration,
        })
        pubSub.emit("worker:state:change", { isRunning: false, jobId })

        // ジョブ後にWorkerを終了するオプション
        if (this.options.terminateAfterJob) {
          this.log(`Auto-terminating worker after job ${jobId} (terminateAfterJob=${this.options.terminateAfterJob})`)
          this.terminateWorker()
        }

        this.isRunning = false
        return finalResult
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))

        this.log(`Local job ${jobId} failed on attempt ${currentAttempt}/${retries + 1}:`, lastError)

        // 最後のリトライでなければ再試行
        if (currentAttempt <= retries) {
          this.log(`Retrying job ${jobId} in ${retryDelay}ms`)
          await new Promise((resolve) => setTimeout(resolve, retryDelay))
        }
      }
    }

    // すべてのリトライが失敗した場合
    const errorDuration = performance.now() - startTime

    // 永続化が有効な場合、エラーを保存
    if (persistState) {
      await jobService.failJob(jobId, lastError || new Error("Unknown error"))
    }

    const errorResult: JobResult<ResultType> = {
      data: null,
      error: lastError,
      duration: errorDuration,
      progress: 0,
      status: "failed",
      jobId,
      metadata: persistState ? metadata : undefined,
    }

    // 結果を保存
    this.lastResult = errorResult

    // エラーイベントを発行
    pubSub.emit("worker:job:error", {
      jobId,
      error: this.handleError(jobId, lastError || "Unknown error"),
      duration: errorDuration,
    })
    pubSub.emit("worker:state:change", { isRunning: false, jobId })

    this.isRunning = false
    return errorResult
  }

  // リモートジョブ実行
  private async executeRemoteJob<ResultType = any, PayloadType = any>(
    jobOptions: RemoteJobOptions<PayloadType>,
  ): Promise<JobResult<ResultType>> {
    if (this.options.mode !== "remote") {
      const errorResult: JobResult<ResultType> = {
        data: null,
        error: new Error("Cannot execute remote job in local mode"),
        duration: 0,
        progress: 0,
        status: "failed",
        jobId: "invalid",
      }

      // エラーイベントを発行
      pubSub.emit("worker:job:error", {
        jobId: "invalid",
        error: errorResult.error ?? new Error("Unknown error"),
        duration: 0,
      })

      return errorResult
    }

    const {
      payload,
      timeout = this.options.globalTimeout,
      enableProgress = true,
      debug: jobDebug = this.options.debug,
      retries = 2,
      retryDelay = 1000,
      jobId = createJobId("remote"),
      jobType = typeof payload === "object" && payload !== null ? (payload as any).type || "default" : "default",
      onProgress,
      pollInterval = this.options.defaultPollInterval,
      persistState = true,
      metadata = {},
    } = jobOptions

    // ジョブ開始イベントを発行
    pubSub.emit("worker:state:change", { isRunning: true, jobId })
    pubSub.emit("worker:job:start", {
      jobId,
      mode: "remote",
      payload,
    })

    // ジョブオブジェクトを作成してJobServiceに登録
    const { jobId: trackedJobId } = jobService.createJob({
      jobId,
      type: jobType,
      payload,
      debug: jobDebug,
      retries,
      retryDelay,
      enableProgress,
      persistState,
      metadata: {
        ...metadata,
        isRemote: true,
        apiEndpoint: this.options.apiEndpoint,
        pollInterval,
      },
      onProgress: onProgress ? (progress, state) => onProgress(progress, state) : undefined,
    })

    // アクティブなジョブとして記録
    this.activeJobs.add(trackedJobId)

    // 初期状態を更新
    await jobService.updateJobState(trackedJobId, {
      status: "pending",
      progress: 0,
    })

    // 実行状態を更新
    this.isRunning = true
    this.log(`Starting remote job ${trackedJobId} (${jobType})`)

    // 時間計測開始
    const startTime = performance.now()

    // 新しいAbortControllerを作成
    const abortController = new AbortController()
    this.abortControllers.set(trackedJobId, abortController)

    try {
      // 実行中のジョブを登録
      await jobService.updateJobState(trackedJobId, {
        status: "running",
        startTime: Date.now(),
      })

      // Workerインスタンスを取得
      const worker = await this.getWorker()
      if (!worker) {
        throw new Error("Failed to create API worker")
      }

      // 進捗ハンドラをセットアップ
      const progressHandler = this.setupProgressHandler(
        worker,
        trackedJobId,
        enableProgress
          ? (progress: number, details?: any) => {
              // 進捗イベントを発行
              pubSub.emit("worker:job:progress", {
                jobId: trackedJobId,
                progress,
                details,
              })

              // JobServiceを通じて状態を更新
              jobService.updateProgress(trackedJobId, progress).catch(() => {
                // エラーは無視
              })

              // カスタム進捗ハンドラがあれば呼び出す
              if (onProgress) {
                onProgress(progress, details)
              }
            }
          : undefined,
      )

      // メッセージハンドラを登録
      worker.addEventListener("message", progressHandler)

      // 結果をPromiseで包む
      const result = await new Promise<ResultType>((resolve, reject) => {
        // タイムアウト処理
        const timeoutId = setTimeout(() => {
          reject(new Error(`Remote job timeout after ${timeout}ms`))
        }, timeout)

        // 結果ハンドラ
        const handleMessage = (event: MessageEvent) => {
          const { type, payload: responsePayload, jobId: responseJobId } = event.data || {}

          // 対象のジョブIDのみ処理
          if (responseJobId && responseJobId !== trackedJobId) return

          if (type === "RESULT") {
            // ジョブ完了
            clearTimeout(timeoutId)
            cleanup()
            resolve(responsePayload)
          } else if (type === "ERROR") {
            // エラー処理
            clearTimeout(timeoutId)
            cleanup()
            reject(new Error(responsePayload?.message || "Unknown remote job error"))
          }
        }

        // クリーンアップ関数
        const cleanup = () => {
          worker.removeEventListener("message", handleMessage)
          worker.removeEventListener("message", progressHandler)
          this.abortControllers.delete(trackedJobId)
          this.activeJobs.delete(trackedJobId)
        }

        // AbortSignal処理
        abortController.signal.addEventListener("abort", () => {
          clearTimeout(timeoutId)
          cleanup()

          // リモートジョブも終了リクエスト
          this.terminateRemoteJob(trackedJobId).catch(() => {
            // エラーは無視、すでに成功したりタイムアウトしている可能性がある
          })

          reject(new Error("Remote job aborted"))
        })

        // メッセージハンドラを追加
        worker.addEventListener("message", handleMessage)

        // ジョブメッセージを送信
        worker.postMessage({
          type: "API_JOB",
          payload: {
            ...payload,
            jobId: trackedJobId,
            type: jobType,
            options: {
              pollInterval,
              ...metadata,
            },
          },
          jobId: trackedJobId,
          debug: jobDebug,
        })
      })

      // 成功した場合の処理
      const endTime = performance.now()
      const duration = endTime - startTime

      this.log(`Remote job ${trackedJobId} completed in ${duration.toFixed(1)}ms`)

      // JobServiceの状態を更新
      await jobService.completeJob(trackedJobId, result)

      // 結果オブジェクトを作成
      const finalState = await jobService.getJobState(trackedJobId)
      const finalResult = createJobResult<ResultType>(finalState!, duration)

      // 結果を保存
      this.lastResult = finalResult

      // 完了イベントを発行
      pubSub.emit("worker:job:complete", {
        jobId: trackedJobId,
        result: finalResult,
        duration,
      })
      pubSub.emit("worker:state:change", {
        isRunning: false,
        jobId: trackedJobId,
      })

      // ジョブ後にWorkerを終了するオプション
      if (this.options.terminateAfterJob) {
        this.log(
          `Auto-terminating worker after job ${trackedJobId} (terminateAfterJob=${this.options.terminateAfterJob})`,
        )
        this.terminateWorker()
      }

      this.isRunning = false
      return finalResult
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))

      this.log(`Remote job ${trackedJobId} failed:`, error)

      // ジョブ失敗を記録
      await jobService.failJob(trackedJobId, error)

      // 結果オブジェクトを作成
      const errorState = await jobService.getJobState(trackedJobId)
      const errorResult = createJobResult<ResultType>(errorState!, performance.now() - startTime)

      // 結果を保存
      this.lastResult = errorResult

      // エラーイベントを発行
      pubSub.emit("worker:job:error", {
        jobId: trackedJobId,
        error,
        duration: performance.now() - startTime,
      })
      pubSub.emit("worker:state:change", {
        isRunning: false,
        jobId: trackedJobId,
      })

      this.isRunning = false
      return errorResult
    } finally {
      // アクティブジョブから削除
      this.activeJobs.delete(trackedJobId)

      // AbortControllerを削除
      this.abortControllers.delete(trackedJobId)
    }
  }

  // ジョブ中止
  async abortJob(jobId?: string): Promise<boolean> {
    if (jobId) {
      // 特定のジョブのみ中止
      this.log(`Aborting job ${jobId}`)

      // ローカルのAbortControllerを処理
      const controller = this.abortControllers.get(jobId)
      if (controller) {
        controller.abort()

        // アボートイベントを発行
        pubSub.emit("worker:job:abort", {
          jobId,
          reason: "User aborted job",
        })
      }

      // リモートモードでリモートジョブの場合はサーバー側も終了
      if (this.options.mode === "remote") {
        const jobState = await jobService.getJobState(jobId)
        if (jobState?.metadata?.isRemote) {
          try {
            const terminated = await this.terminateRemoteJob(jobId)
            return terminated
          } catch (e) {
            this.log(`Error terminating remote job ${jobId}:`, e)
            return false
          }
        }
      }

      return controller !== undefined
    } else {
      // すべてのジョブを中止
      this.log("Aborting all jobs")
      let aborted = false

      // すべてのコントローラーを処理
      const abortPromises: Promise<void>[] = []

      this.abortControllers.forEach((controller, id) => {
        controller.abort()
        aborted = true

        // アボートイベントを発行
        abortPromises.push(
          pubSub.emit("worker:job:abort", {
            jobId: id,
            reason: "All jobs aborted",
          }),
        )
      })

      // リモートモードの場合、アクティブなリモートジョブも終了
      if (this.options.mode === "remote") {
        const activeJobIds = Array.from(this.activeJobs)
        for (const id of activeJobIds) {
          try {
            await this.terminateRemoteJob(id)
          } catch (e) {
            // エラーは無視
          }
        }
      }

      // すべてのアボートイベントが完了するのを待つ
      Promise.all(abortPromises).catch((e) => console.error("Error dispatching abort events:", e))

      return aborted
    }
  }

  // ジョブ状態確認
  async getJobState(jobId: string): Promise<JobState | null> {
    // ローカルジョブステートを確認
    const localState = await jobService.getJobState(jobId)

    // リモートの状態も確認
    if (this.options.mode === "remote" && localState?.metadata?.isRemote) {
      try {
        const remoteState = await this.checkRemoteJobStatus(jobId)

        // 状態が変更された場合は状態変更イベントを発行
        if (remoteState && (remoteState.status !== localState.status || remoteState.progress !== localState.progress)) {
          pubSub.emit("worker:state:change", {
            isRunning: remoteState.status === "running",
            jobId,
          })

          // 進捗が更新された場合
          if (remoteState.progress !== localState.progress) {
            pubSub.emit("worker:job:progress", {
              jobId,
              progress: remoteState.progress,
              details: remoteState,
            })
          }

          // 完了した場合
          if (remoteState.status === "completed" && localState.status !== "completed") {
            pubSub.emit("worker:job:complete", {
              jobId,
              result: remoteState.result,
              duration: remoteState.lastUpdated - remoteState.startTime,
            })
          }

          // エラーが発生した場合
          if (remoteState.status === "failed" && localState.status !== "failed") {
            pubSub.emit("worker:job:error", {
              jobId,
              error:
                remoteState.error instanceof Error
                  ? remoteState.error
                  : new Error(String(remoteState.error || "Unknown error")),
              duration: remoteState.lastUpdated - remoteState.startTime,
            })
          }
        }

        return remoteState || localState
      } catch (e) {
        this.log(`Error checking remote job ${jobId}:`, e)
        return localState
      }
    }

    return localState
  }

  // 中断ジョブの復元
  async restorePendingJobs(options?: { keyPrefix?: string; filter?: (job: JobState) => boolean }): Promise<JobState[]> {
    if (this.options.mode !== "remote") return []

    try {
      this.log("Checking for pending jobs...")

      // パラメータ準備
      const keyPrefix = options?.keyPrefix || this.options.storageKeyPrefix
      const filter =
        options?.filter ||
        ((job) => job.metadata?.isRemote === true && (job.status === "pending" || job.status === "running"))

      // ジョブ読み込み
      const pendingJobs = await jobService.loadPendingJobs({
        keyPrefix,
        filter,
      })

      if (pendingJobs.length > 0) {
        this.log(`Found ${pendingJobs.length} pending jobs`)

        // 復元イベントの発行
        for (const job of pendingJobs) {
          // 状態変更イベントの発行
          pubSub.emit("worker:state:change", {
            isRunning: job.status === "running",
            jobId: job.jobId,
          })

          // ジョブがまだ実行中の場合、現在の状態を確認
          if (job.status === "running" || job.status === "pending") {
            this.checkRemoteJobStatus(job.jobId).catch((err) => {
              this.log(`Error checking job ${job.jobId}: ${err.message}`)
            })
          }
        }
      }

      return pendingJobs
    } catch (error) {
      this.log("Error restoring pending jobs:", error)
      return []
    }
  }

  // リモートジョブ状態確認
  async checkRemoteJobStatus(jobId: string): Promise<JobState | null> {
    if (this.options.mode !== "remote") return null

    try {
      const worker = await this.getWorker()
      if (!worker) {
        throw new Error("Failed to create API worker")
      }

      this.log(`Checking status of remote job: ${jobId}`)

      const status = await this.sendDirectMessage({
        type: "PREFLIGHT_CHECK",
        payload: { jobId },
      })

      if (!status || !status.payload) {
        this.log(`No status found for job ${jobId}`)
        return null
      }

      const { payload } = status

      // ジョブが存在する場合、ステータスを更新
      if (payload.exists) {
        this.log(`Remote job ${jobId} exists:`, payload)

        // 前回の状態を取得
        const previousState = await jobService.getJobState(jobId)

        // JobService経由でジョブ状態を更新
        const updatedState = await jobService.updateJobState(jobId, {
          status: payload.status,
          progress: payload.progress || 0,
          result: payload.result,
          error: payload.error,
          lastUpdated: Date.now(),
        })

        // 状態に変更があった場合はイベントを発行
        if (previousState && (previousState.status !== payload.status || previousState.progress !== payload.progress)) {
          // 状態変更イベント
          pubSub.emit("worker:state:change", {
            isRunning: payload.status === "running",
            jobId,
          })

          // 進捗変更イベント
          if (previousState.progress !== payload.progress) {
            pubSub.emit("worker:job:progress", {
              jobId,
              progress: payload.progress || 0,
              details: {
                ...payload,
                remote: true,
              },
            })
          }

          // 完了イベント
          if (payload.status === "completed" && previousState.status !== "completed") {
            pubSub.emit("worker:job:complete", {
              jobId,
              result: payload.result,
              duration: (payload.lastUpdated || Date.now()) - (payload.startTime || 0),
            })
          }

          // エラーイベント
          if (payload.status === "failed" && previousState.status !== "failed") {
            pubSub.emit("worker:job:error", {
              jobId,
              error:
                payload.error instanceof Error
                  ? payload.error
                  : new Error(String(payload.error || "Unknown remote error")),
              duration: (payload.lastUpdated || Date.now()) - (payload.startTime || 0),
            })
          }

          // アボートイベント
          if (payload.status === "aborted" && previousState.status !== "aborted") {
            pubSub.emit("worker:job:abort", {
              jobId,
              reason: String(payload.error || "Job aborted remotely"),
            })
          }
        }

        return updatedState
      }

      this.log(`Remote job ${jobId} does not exist`)
      return null
    } catch (error) {
      this.log(`Error checking job status ${jobId}:`, error)
      return null
    }
  }

  // リモートジョブ終了
  async terminateRemoteJob(jobId: string): Promise<boolean> {
    if (this.options.mode !== "remote") return false

    try {
      const worker = await this.getWorker()
      if (!worker) {
        throw new Error("Failed to create API worker")
      }

      this.log(`Terminating remote job: ${jobId}`)

      // 終了リクエストを送信
      const response = await this.sendDirectMessage({
        type: "TERMINATE_REMOTE_JOB",
        payload: { jobId },
      })

      if (response && response.payload && response.payload.success) {
        this.log(`Successfully terminated remote job: ${jobId}`)

        // ローカルのジョブ状態も更新
        const updatedState = await jobService.updateJobState(jobId, {
          status: "aborted",
          aborted: true,
          error: "ユーザーによる終了",
          lastUpdated: Date.now(),
        })

        // 中止イベントを発行
        pubSub.emit("worker:job:abort", {
          jobId,
          reason: "User terminated remote job",
        })

        // 状態変更イベントを発行
        pubSub.emit("worker:state:change", {
          isRunning: false,
          jobId,
        })

        return true
      }

      this.log(`Failed to terminate remote job: ${jobId}`)
      return false
    } catch (error) {
      this.log(`Error terminating job ${jobId}:`, error)
      return false
    }
  }

  // メッセージ送信ユーティリティ
  async sendDirectMessage<T extends object = any, R = any>(message: T, timeout = 5000): Promise<R | null> {
    try {
      const worker = await this.getWorker()
      if (!worker) {
        this.log("Cannot send message - no worker available")
        return null
      }

      return new Promise<R | null>((resolve) => {
        // タイムアウト処理
        const timeoutId = setTimeout(() => {
          worker.removeEventListener("message", handleResponse)
          this.log(`Message timed out after ${timeout}ms`, message)
          resolve(null)
        }, timeout)

        // レスポンスハンドラ
        const handleResponse = (event: MessageEvent) => {
          const response = event.data

          // レスポンスのログ（デバッグ用）
          if (this.options.debug) {
            this.log("Received response:", response)
          }

          // メッセージタイプに基づいたレスポンスマッチング
          const isMatchingResponse = this.isMatchingResponse(message, response)

          if (isMatchingResponse) {
            clearTimeout(timeoutId)
            worker.removeEventListener("message", handleResponse)
            resolve(response as R)
          } else if (!("type" in message) || typeof message !== "object") {
            // メッセージにtypeがない場合は単純に最初の応答を受け取る
            clearTimeout(timeoutId)
            worker.removeEventListener("message", handleResponse)
            resolve(response as R)
          }
          // マッチしないレスポンスは無視（他のメッセージハンドラが処理）
        }

        // メッセージハンドラを登録
        worker.addEventListener("message", handleResponse)

        // メッセージを送信
        worker.postMessage(message)
        this.log("Direct message sent:", message)
      })
    } catch (err) {
      this.log("Error sending direct message:", err)

      // エラー情報をPubSubで発行
      pubSub.emit("worker:job:error", {
        jobId: "direct_message",
        error: this.handleError("direct_message", err instanceof Error ? err : new Error(String(err))),
        duration: 0,
      })

      return null
    }
  }

  /**
   * メッセージとレスポンスが対応しているかチェック
   * @private
   */
  private isMatchingResponse(message: any, response: any): boolean {
    // メッセージタイプがない場合は単純に応答
    if (!message || typeof message !== "object" || !("type" in message)) {
      return true
    }

    // レスポンスタイプがない場合はマッチしない
    if (!response || typeof response !== "object" || !("type" in response)) {
      return false
    }

    const requestType = message.type as string
    const responseType = response.type as string

    // 一般的なレスポンスパターンをチェック
    switch (requestType) {
      case "PING":
        return responseType === "PONG"
      case "GET_ID":
        return responseType === "ID_RESPONSE"
      case "CONFIG":
        return responseType === "CONFIG_UPDATED"
      case "PREFLIGHT_CHECK":
        return responseType === "PREFLIGHT_RESULT"
      case "TERMINATE_REMOTE_JOB":
        return responseType === "TERMINATE_RESULT"
      default:
        // 標準パターン確認
        return (
          responseType === requestType ||
          responseType === `${requestType}_RESULT` ||
          responseType === `${requestType}_RESPONSE`
        )
    }
  }

  // 進捗ハンドラのセットアップ
  setupProgressHandler(
    worker: Worker,
    jobId: string,
    onProgress?: (progress: number, details?: any) => void,
  ): (event: MessageEvent) => void {
    // Worker固有の初期設定や検証
    const workerType = worker.constructor.name
    const isSharedWorker = workerType === "SharedWorker"
    // 進捗メッセージ処理ハンドラを作成して返す
    return (event: MessageEvent) => {
      if (isSharedWorker) {
        // TODO: SharedWorker固有の処理（拡張用）
      } else {
        const data = event.data

        // 無効なメッセージ形式はスキップ
        if (!data || typeof data !== "object") return

        // ジョブIDが一致するかチェック
        if (data.jobId && data.jobId !== jobId) return

        // 進捗メッセージタイプかチェック
        if (data.type !== "PROGRESS") return

        const payload = data.payload || {}
        const progress =
          typeof payload.percent === "number"
            ? payload.percent
            : typeof payload.progress === "number"
              ? payload.progress
              : 0

        // 進捗イベントをグローバルに発行
        pubSub
          .emit("worker:job:progress", {
            jobId,
            progress,
            details: payload.details || payload,
          })
          .catch((e) => {
            // イベント発行エラーはログに記録するが処理は続行
            if (this.options.debug) {
              console.error("Error publishing progress event:", e)
            }
          })

        // グローバル進捗コールバック
        if (this.options.onProgress) {
          try {
            this.options.onProgress(progress, jobId)
          } catch (e) {
            // コールバックエラーは処理を続行
            console.error(`Error in global progress callback for job ${jobId}:`, e)
          }
        }

        // ジョブ固有の進捗コールバック
        if (onProgress) {
          try {
            // 詳細データをコールバックに渡す
            onProgress(progress, payload.details || payload)
          } catch (e) {
            // コールバックエラーは処理を続行
            console.error(`Error in job-specific progress callback for job ${jobId}:`, e)
          }
        }
      }
    }
  }

  // エラー処理
  private handleError(jobId: string, error: Error | string | null): Error {
    const normalizedError = error instanceof Error ? error : new Error(String(error || "Unknown error"))

    if (this.options.onError) {
      this.options.onError(normalizedError, jobId)
    }

    return normalizedError
  }

  // Workerの終了
  dispose(): void {
    // アクティブなジョブをすべて中止
    this.abortControllers.forEach((controller: AbortController) => {
      try {
        controller.abort()
      } catch (e) {
        // エラーを無視
      }
    })

    // Workerを終了
    this.terminateWorker()

    // マップやセットをクリア
    this.abortControllers.clear()
    this.activeJobs.clear()

    this.log("WorkerManager disposed")
  }
}
