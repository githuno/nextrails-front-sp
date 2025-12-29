import { objUt } from "@/utils/objectUtils"

/**
 * ジョブステータス
 */
export type JobStatus = "idle" | "pending" | "running" | "completed" | "failed" | "aborted"

/**
 * ジョブ識別情報
 */
export interface JobIdentifier {
  jobId: string
  type?: string
}

/**
 * ジョブ状態
 */
export interface JobState<T = any> extends JobIdentifier {
  status: JobStatus
  progress: number
  startTime: number
  lastUpdated: number
  error?: Error | string | null
  result?: T
  metadata?: Record<string, any>
  aborted?: boolean
  retries?: number
  maxRetries?: number
}

/**
 * ジョブオプション
 */
export interface JobOptions<P = any> {
  payload: P
  jobId?: string
  type?: string
  timeout?: number
  retries?: number
  retryDelay?: number
  enableProgress?: boolean
  debug?: boolean
  metadata?: Record<string, any>
  persistState?: boolean
  onProgress?: (progress: number, state?: JobState) => void
  // 追加: 転送するオブジェクトのリスト
  transferables?: Transferable[]
}

/**
 * ジョブ実行結果
 */
export interface JobResult<T = any> {
  data: T | null
  error: Error | null
  duration: number
  progress: number
  status: JobStatus
  jobId: string
  timestamp?: number
  type?: string
  metadata?: Record<string, any>
  aborted?: boolean
}

/**
 * ジョブストレージインターフェース
 */
export interface JobStateStorage {
  /**
   * ジョブ状態を保存
   */
  saveState(jobId: string, state: JobState): Promise<boolean>

  /**
   * ジョブ状態を取得
   */
  getState(jobId: string): Promise<JobState | null>

  /**
   * ジョブ状態を削除
   */
  removeState(jobId: string): Promise<boolean>

  /**
   * 全ジョブを取得
   */
  getAllJobs(): Promise<JobState[]>

  /**
   * 特定の状態のジョブを取得
   */
  getJobsByStatus(status: JobStatus | JobStatus[]): Promise<JobState[]>

  /**
   * 全ジョブをクリア
   */
  clear(): Promise<boolean>
}

/**
 * ローカルストレージを使用したジョブストレージ実装
 */
export class LocalStorageJobStateStorage implements JobStateStorage {
  private readonly keyPrefix: string
  private isServer: boolean

  constructor(keyPrefix = "job_state_") {
    this.keyPrefix = keyPrefix
    // サーバー環境かどうかを判定
    this.isServer = typeof window === "undefined" || typeof localStorage === "undefined"
  }

  async saveState(jobId: string, state: JobState): Promise<boolean> {
    if (this.isServer) return false

    try {
      const key = `${this.keyPrefix}${jobId}`
      localStorage.setItem(
        key,
        JSON.stringify({
          ...state,
          // エラーオブジェクトの保存対応
          error: state.error instanceof Error ? { message: state.error.message, name: state.error.name } : state.error,
        }),
      )
      return true
    } catch (error) {
      console.error("ジョブ状態保存エラー:", error)
      return false
    }
  }

  async getState(jobId: string): Promise<JobState | null> {
    if (this.isServer) return null

    try {
      const key = `${this.keyPrefix}${jobId}`
      const data = localStorage.getItem(key)
      if (!data) return null

      const state = JSON.parse(data) as JobState

      // エラー文字列をError型に変換
      if (state.error && typeof state.error === "object" && "message" in state.error) {
        const errorData = state.error as { message: string; name?: string }
        const error = new Error(errorData.message)
        if (errorData.name) error.name = errorData.name
        state.error = error
      }

      return state
    } catch (error) {
      console.error("ジョブ状態取得エラー:", error)
      return null
    }
  }

  async removeState(jobId: string): Promise<boolean> {
    if (this.isServer) return false

    try {
      const key = `${this.keyPrefix}${jobId}`
      localStorage.removeItem(key)
      return true
    } catch (error) {
      console.error("ジョブ状態削除エラー:", error)
      return false
    }
  }

  async getAllJobs(): Promise<JobState[]> {
    if (this.isServer) return []
    const jobs: JobState[] = []

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith(this.keyPrefix)) {
          const jobState = await this.getState(key.substring(this.keyPrefix.length))
          if (jobState) jobs.push(jobState)
        }
      }
    } catch (error) {
      console.error("全ジョブ取得エラー:", error)
    }

    return jobs
  }

  async getJobsByStatus(status: JobStatus | JobStatus[]): Promise<JobState[]> {
    if (this.isServer) return []

    const allJobs = await this.getAllJobs()
    const statusArray = Array.isArray(status) ? status : [status]

    return allJobs.filter((job) => statusArray.includes(job.status))
  }

  async clear(): Promise<boolean> {
    if (this.isServer) return false

    try {
      const keys: string[] = []

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith(this.keyPrefix)) {
          keys.push(key)
        }
      }

      keys.forEach((key) => localStorage.removeItem(key))
      return true
    } catch (error) {
      console.error("ジョブストレージクリアエラー:", error)
      return false
    }
  }
}

/**
 * イベントエミッターインターフェース
 */
export interface JobEventEmitter {
  on<T = any>(event: string, callback: (data: T) => void): () => void
  emit<T = any>(event: string, data: T): void
  off(event: string, callback?: Function): void
}

/**
 * シンプルなイベントエミッター実装
 */
export class SimpleEventEmitter implements JobEventEmitter {
  private listeners: Map<string, Set<Function>> = new Map()

  on<T = any>(event: string, callback: (data: T) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }

    this.listeners.get(event)!.add(callback)

    return () => this.off(event, callback)
  }

  emit<T = any>(event: string, data: T): void {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.forEach((callback) => {
        try {
          callback(data)
        } catch (error) {
          console.error(`Error in event listener for "${event}":`, error)
        }
      })
    }
  }

  off(event: string, callback?: Function): void {
    if (!callback) {
      // イベントのリスナーをすべて削除
      this.listeners.delete(event)
      return
    }

    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.delete(callback)
      if (eventListeners.size === 0) {
        this.listeners.delete(event)
      }
    }
  }
}

/**
 * ジョブに関連するイベント
 */
export type JobEvent =
  | "job:created"
  | "job:started"
  | "job:progress"
  | "job:completed"
  | "job:failed"
  | "job:aborted"
  | "job:state-changed"
  | "storage:changed"

/**
 * ジョブ進捗イベントデータ
 */
export interface JobProgressEvent extends JobIdentifier {
  progress: number
  state: JobState
}

/**
 * ジョブサービス構成オプション
 */
export interface JobServiceOptions {
  debug?: boolean
  storageProvider?: JobStateStorage
  eventEmitter?: JobEventEmitter
  enablePersistence?: boolean
  autoCleanupCompletedJobs?: boolean
  completedJobRetentionTime?: number // ミリ秒
  autoloadPendingJobs?: boolean
}

/**
 * ジョブサービスクラス
 * ジョブの生成、監視、状態管理の中心的機能を提供
 */
export class JobService {
  private static instance: JobService

  private storage: JobStateStorage
  private events: JobEventEmitter
  private options: Required<JobServiceOptions>
  private trackedJobs: Map<string, JobState> = new Map()
  private cleanupTimers: Map<string, number> = new Map()
  private initialized = false

  // デフォルトオプション
  private static defaultOptions: Required<JobServiceOptions> = {
    debug: false,
    storageProvider: new LocalStorageJobStateStorage(),
    eventEmitter: new SimpleEventEmitter(),
    enablePersistence: true,
    autoCleanupCompletedJobs: true,
    completedJobRetentionTime: 24 * 60 * 60 * 1000, // 24時間
    autoloadPendingJobs: true,
  }

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(options?: JobServiceOptions): JobService {
    if (!JobService.instance) {
      JobService.instance = new JobService(options)
    }
    return JobService.instance
  }

  /**
   * 新しいインスタンスを作成（テスト用）
   */
  public static createInstance(options?: JobServiceOptions): JobService {
    return new JobService(options)
  }

  /**
   * コンストラクタ
   */
  private constructor(options?: JobServiceOptions) {
    this.options = { ...JobService.defaultOptions, ...options }
    this.storage = this.options.storageProvider
    this.events = this.options.eventEmitter

    // SSR環境では自動ロードをスキップ
    if (typeof window !== "undefined" && this.options.autoloadPendingJobs) {
      this.loadPendingJobs().catch(console.error)
    }
  }

  /**
   * デバッグログ
   */
  private log(message: string, ...args: any[]): void {
    if (this.options.debug) {
      console.log(`[JobService] ${message}`, ...args)
    }
  }

  /**
   * サービスの初期化
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return

    this.log("Initializing JobService")

    if (this.options.autoloadPendingJobs) {
      await this.loadPendingJobs()
    }

    this.initialized = true
  }

  /**
   * 新しいジョブを作成
   */
  public createJob<P = any>(options: JobOptions<P>): JobIdentifier {
    const jobId = options.jobId || `job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    const type = options.type || "generic"

    const jobState: JobState = {
      jobId,
      type,
      status: "idle",
      progress: 0,
      startTime: Date.now(),
      lastUpdated: Date.now(),
      metadata: options.metadata || {},
      retries: 0,
      maxRetries: options.retries || 0,
    }

    // ジョブをトラッキング
    this.trackedJobs.set(jobId, jobState)

    // イベント発行
    this.events.emit("job:created", { jobId, type })

    this.log(`Created job: ${jobId} (${type})`, options)

    return { jobId, type }
  }

  /**
   * ジョブ状態を更新
   */
  public async updateJobState(jobId: string, updates: Partial<JobState>): Promise<JobState> {
    const currentState = this.trackedJobs.get(jobId)

    if (!currentState) {
      throw new Error(`Job not found: ${jobId}`)
    }

    // 状態を更新
    const newState: JobState = {
      ...currentState,
      ...updates,
      lastUpdated: Date.now(),
    }

    // 進捗が100%になった場合、自動的にステータスを完了に設定
    if (updates.progress === 100 && newState.status === "running") {
      newState.status = "completed"
    }

    // トラッキング更新
    this.trackedJobs.set(jobId, newState)

    // 永続化
    if (this.options.enablePersistence) {
      await this.storage.saveState(jobId, newState)
    }

    // イベント発行
    this.events.emit("job:state-changed", { jobId, state: newState })

    // ステータス変更時に特定イベントを発行
    if (updates.status) {
      switch (updates.status) {
        case "running":
          this.events.emit("job:started", { jobId, state: newState })
          break
        case "completed":
          this.events.emit("job:completed", { jobId, state: newState })

          // 完了ジョブの自動クリーンアップ
          if (this.options.autoCleanupCompletedJobs) {
            this.scheduleJobCleanup(jobId)
          }
          break
        case "failed":
          this.events.emit("job:failed", { jobId, state: newState })
          break
        case "aborted":
          this.events.emit("job:aborted", { jobId, state: newState })
          break
      }
    }

    // 進捗更新時にイベント発行
    if (updates.progress !== undefined) {
      this.events.emit<JobProgressEvent>("job:progress", {
        jobId,
        type: newState.type,
        progress: updates.progress,
        state: newState,
      })
    }

    this.log(`Updated job state: ${jobId}`, updates)

    return newState
  }

  /**
   * ジョブ進捗を更新
   */
  public async updateProgress(jobId: string, progress: number): Promise<JobState> {
    return this.updateJobState(jobId, { progress })
  }

  /**
   * ジョブを開始
   */
  public async startJob(jobId: string): Promise<JobState> {
    return this.updateJobState(jobId, {
      status: "running",
      startTime: Date.now(),
    })
  }

  /**
   * ジョブ完了を設定
   */
  public async completeJob<T = any>(jobId: string, result: T): Promise<JobState> {
    return this.updateJobState(jobId, {
      status: "completed",
      progress: 100,
      result,
    })
  }

  /**
   * ジョブ失敗を設定
   */
  public async failJob(jobId: string, error: Error | string): Promise<JobState> {
    return this.updateJobState(jobId, {
      status: "failed",
      error,
    })
  }

  /**
   * ジョブの中止
   */
  public async abortJob(jobId: string, reason?: string): Promise<JobState> {
    return this.updateJobState(jobId, {
      status: "aborted",
      aborted: true,
      error: reason ? new Error(reason) : null,
    })
  }

  /**
   * ジョブの管理を削除
   */
  public async removeJob(jobId: string): Promise<boolean> {
    this.trackedJobs.delete(jobId)

    // クリーンアップタイマーをクリア
    if (this.cleanupTimers.has(jobId)) {
      clearTimeout(this.cleanupTimers.get(jobId))
      this.cleanupTimers.delete(jobId)
    }

    // 永続化されていれば削除
    if (this.options.enablePersistence) {
      return this.storage.removeState(jobId)
    }

    return true
  }

  /**
   * ジョブ状態を取得
   */
  public async getJobState(jobId: string): Promise<JobState | null> {
    // メモリ内で追跡中のジョブを優先
    if (this.trackedJobs.has(jobId)) {
      return objUt.deepClone(this.trackedJobs.get(jobId)!)
      // objUt.deepCloneを使用しない場合
      // return { ...this.trackedJobs.get(jobId)! };
    }

    // 永続化ストレージから取得
    if (this.options.enablePersistence) {
      const state = await this.storage.getState(jobId)
      if (state) {
        // 復元されたジョブを追跡対象に追加
        this.trackedJobs.set(jobId, state)
        // return objUt.deepClone(state);
        // objUt.deepCloneを使用しない場合
        return { ...state }
      }
    }

    return null
  }

  /**
   * 現在追跡中の全ジョブを取得
   */
  public getTrackedJobs(): JobState[] {
    return Array.from(this.trackedJobs.values()).map((job) => objUt.deepClone(job))
    // objUt.deepCloneを使用しない場合
    // return Array.from(this.trackedJobs.values()).map(job => ({ ...job }));
  }

  /**
   * 保留中/実行中のジョブをロード
   */
  public async loadPendingJobs(options?: {
    keyPrefix?: string
    filter?: (job: JobState) => boolean
  }): Promise<JobState[]> {
    if (!this.options.enablePersistence) {
      return []
    }

    let pendingJobs: JobState[]

    // カスタムキープレフィックスが指定された場合
    if (options?.keyPrefix) {
      const customStorage = new LocalStorageJobStateStorage(options.keyPrefix)
      const pendingStatuses: JobStatus[] = ["pending", "running"]
      pendingJobs = await customStorage.getJobsByStatus(pendingStatuses)
    } else {
      // 通常のロード
      const pendingStatuses: JobStatus[] = ["pending", "running"]
      pendingJobs = await this.storage.getJobsByStatus(pendingStatuses)
    }

    // フィルター適用
    if (options?.filter) {
      pendingJobs = pendingJobs.filter(options.filter)
    }

    this.log(`Found ${pendingJobs.length} pending jobs`, pendingJobs)

    // メモリ内の追跡対象に追加
    pendingJobs.forEach((job) => {
      this.trackedJobs.set(job.jobId, job)
    })

    return pendingJobs
  }

  /**
   * 完了ジョブの自動クリーンアップをスケジュール
   */
  private scheduleJobCleanup(jobId: string): void {
    // 既存のタイマーをクリア
    if (this.cleanupTimers.has(jobId)) {
      clearTimeout(this.cleanupTimers.get(jobId))
    }

    // 新しいタイマーを設定
    const timerId = window.setTimeout(() => {
      this.removeJob(jobId).catch(console.error)
      this.cleanupTimers.delete(jobId)
    }, this.options.completedJobRetentionTime)

    this.cleanupTimers.set(jobId, timerId)
  }

  /**
   * イベントリスナーを追加
   */
  public on<T = any>(event: JobEvent, callback: (data: T) => void): () => void {
    return this.events.on(event, callback)
  }

  /**
   * イベントリスナーを削除
   */
  public off(event: JobEvent, callback?: Function): void {
    this.events.off(event, callback)
  }

  /**
   * 全てのリソースをクリーンアップ
   */
  public async dispose(): Promise<void> {
    // クリーンアップタイマーをすべて解除
    this.cleanupTimers.forEach((timerId) => {
      clearTimeout(timerId)
    })
    this.cleanupTimers.clear()

    // 追跡ジョブをクリア
    this.trackedJobs.clear()

    this.log("JobService disposed")
  }
}

// デフォルトインスタンスをエクスポート
export const jobService = JobService.getInstance()

// ユーティリティ関数
export function createJobId(prefix = "job"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

// ジョブ結果型ヘルパー
export function createJobResult<T>(state: JobState, duration: number): JobResult<T> {
  return {
    data: (state.result as T) || null,
    error: state.error instanceof Error ? state.error : state.error ? new Error(String(state.error)) : null,
    duration,
    progress: state.progress,
    status: state.status,
    jobId: state.jobId,
    type: state.type,
    metadata: state.metadata,
    aborted: state.aborted,
  }
}

export default jobService
