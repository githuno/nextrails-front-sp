// 現在処理中のジョブID
let currentJobId = null
let isDebugMode = false

// Worker ID
const workerId = `api-worker-${Date.now()}-${Math.floor(Math.random() * 10000)}`

// デフォルトのAPIエンドポイント
let apiBaseUrl = "/api/jobs"

// ジョブストレージ - リモートAPIがない環境でもジョブを追跡するためのインメモリ状態
const jobStore = new Map()

// リクエストオプションのデフォルト値
const defaultFetchOptions = {
  headers: {
    "Content-Type": "application/json",
  },
  credentials: "same-origin",
}

// デバッグログ関数
function log(...args) {
  if (isDebugMode) {
    console.log(`[ApiWorker]`, ...args)
  }
}

// 進捗報告関数
function reportProgress(percent, details = {}) {
  self.postMessage({
    type: "PROGRESS",
    payload: { percent, ...details },
    jobId: currentJobId,
  })
}

// 結果送信関数
function sendResult(result) {
  self.postMessage({
    type: "RESULT",
    payload: result,
    jobId: currentJobId,
  })
}

// エラー送信関数
function sendError(error) {
  self.postMessage({
    type: "ERROR",
    payload: { message: error.message, name: error.name },
    jobId: currentJobId,
  })
}

// モックAPIジョブの作成
function createMockApiJob(jobData, jobId) {
  const job = {
    jobId,
    status: "pending",
    progress: 0,
    startTime: Date.now(),
    lastUpdated: Date.now(),
    result: null,
    error: null,
    payload: jobData,
    metadata: {
      mode: "remote",
      type: jobData.type,
    },
  }

  // ジョブを保存
  jobStore.set(jobId, job)

  // localStorageにも保存して永続化
  try {
    localStorage.setItem(`job_${jobId}`, JSON.stringify(job))
    log(`ジョブをlocalStorageに保存: ${jobId}`)
  } catch (e) {
    log(`ジョブ保存エラー: ${e.message}`)
  }

  log(`モックAPIジョブを作成: ${jobId}`)

  return job
}

// モックジョブの進捗を更新
function updateMockJobProgress(jobId, progress) {
  const job = jobStore.get(jobId)
  if (job) {
    job.progress = progress
    job.lastUpdated = Date.now()
    job.status = progress >= 100 ? "completed" : "running"

    if (progress >= 100) {
      // 完了時に結果を設定
      job.result = `API モックジョブ完了 (${job.payload.type}:${job.payload.n})`
    }

    // localStorageにも更新を保存
    try {
      localStorage.setItem(`job_${jobId}`, JSON.stringify(job))
    } catch (_) {
      // エラー無視
    }
  }
}

// モックジョブの失敗を設定
function failMockJob(jobId, error) {
  const job = jobStore.get(jobId)
  if (job) {
    job.status = "failed"
    job.error = error.message || String(error)
    job.lastUpdated = Date.now()

    // localStorageにも更新を保存
    try {
      localStorage.setItem(`job_${jobId}`, JSON.stringify(job))
    } catch (_) {
      // エラー無視
    }
  }
}

// モックジョブの実行をシミュレート
async function simulateMockJobExecution(jobId, pollInterval = 500) {
  const job = jobStore.get(jobId)
  if (!job) return

  // 非同期処理のシミュレーション
  job.status = "running"

  // localStorageに状態を更新
  try {
    localStorage.setItem(`job_${jobId}`, JSON.stringify(job))
  } catch (_) {
    // エラー無視
  }

  const steps = job.payload.n || 10
  const delay = Math.max(200, pollInterval)

  try {
    // 進捗をシミュレート
    for (let i = 0; i <= steps; i++) {
      const progress = Math.min(100, Math.floor((i / steps) * 100))
      updateMockJobProgress(jobId, progress)

      // デモ用に少し待機
      await new Promise((resolve) => setTimeout(resolve, delay))
    }

    // 完了を確定
    updateMockJobProgress(jobId, 100)
    log(`モックジョブ完了: ${jobId}`)
  } catch (e) {
    failMockJob(jobId, e)
    log(`モックジョブ失敗: ${jobId} - ${e.message}`)
  }
}

// ジョブ状態のチェック関数 - 修正
async function checkJobStatus(jobId) {
  // 'all'の場合は保留中のすべてのジョブを返す
  if (jobId === "all") {
    const pendingJobs = []

    // インメモリストアからジョブを取得
    jobStore.forEach((job, id) => {
      if (job.status === "pending" || job.status === "running") {
        pendingJobs.push(job)
      }
    })

    // localStorageからもジョブを検索（バックアップ）
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith("job_")) {
          try {
            const jobData = JSON.parse(localStorage.getItem(key))
            if (
              (jobData.status === "pending" || jobData.status === "running") &&
              !pendingJobs.some((job) => job.jobId === jobData.jobId)
            ) {
              pendingJobs.push(jobData)
              // インメモリストアにも追加
              jobStore.set(jobData.jobId, jobData)
            }
          } catch (e) {
            // 無効なJSONは無視
          }
        }
      }
    } catch (e) {
      log(`localStorageからのジョブ読み込みエラー: ${e.message}`)
    }

    log(`保留中ジョブ: ${pendingJobs.length}件`)
    // 重要: 空配列または全ジョブを返す（nullではない）
    return pendingJobs
  }

  // 特定のジョブを取得
  const job = jobStore.get(jobId)
  if (job) {
    return job
  }

  // メモリに見つからなければlocalStorageを確認
  try {
    const stored = localStorage.getItem(`job_${jobId}`)
    if (stored) {
      const jobData = JSON.parse(stored)
      // インメモリにも追加
      jobStore.set(jobId, jobData)
      return jobData
    }
  } catch (e) {
    log(`ジョブ取得エラー: ${e.message}`)
  }

  // 特定ジョブが見つからない場合
  return { exists: false, error: "ジョブが見つかりません" }
}

// ジョブ終了リクエスト関数
async function terminateJob(jobId) {
  // ローカルに保存されたジョブを終了
  const job = jobStore.get(jobId)
  if (job) {
    job.status = "aborted"
    job.lastUpdated = Date.now()

    // localStorageにも更新を保存
    try {
      localStorage.setItem(`job_${jobId}`, JSON.stringify(job))
    } catch (e) {
      // エラー無視
    }

    log(`ジョブを中止: ${jobId}`)
    return { success: true }
  }

  // 実際のAPIも呼び出す場合はここで実装
  log(`ジョブ終了リクエスト: ${jobId} (モックAPIのみ)`)
  return { success: false, error: "ジョブが見つかりません" }
}

// モックAPIジョブ実行関数
async function executeRemoteJob(jobData, options) {
  try {
    // 進捗初期化
    reportProgress(0)

    // モックジョブIDはリクエストのものを使用
    const mockJobId = currentJobId

    // モックAPIジョブを作成
    const job = createMockApiJob(jobData, mockJobId)
    log(`モックAPIジョブ作成: ${mockJobId}`)

    // 非同期でジョブの実行をシミュレート
    simulateMockJobExecution(mockJobId, options?.pollInterval)

    // ポーリングをシミュレート
    let completed = false
    let result = null
    let pollInterval = options?.pollInterval || 1000
    let lastProgress = 0

    // ジョブが完了するまでポーリング
    while (!completed) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval))

      // ジョブ状態を確認
      const status = await checkJobStatus(mockJobId)

      if (!status || status.error) {
        throw new Error(status?.error || "ジョブが存在しません")
      }

      // 進捗報告（変化があれば）
      if (status.progress !== lastProgress) {
        lastProgress = status.progress
        reportProgress(status.progress, status)
      }

      // 完了チェック
      if (status.status === "completed" || status.status === "failed" || status.status === "aborted") {
        completed = true

        if (status.status === "completed") {
          reportProgress(100)
          result = status.result
        } else if (status.status === "failed") {
          throw new Error(status.error || "ジョブが失敗しました")
        } else {
          throw new Error("ジョブが中止されました")
        }
      }
    }

    return result
  } catch (error) {
    log(`リモートジョブエラー: ${error.message}`)
    throw error
  }
}

// メッセージハンドラ
self.addEventListener("message", async (event) => {
  const { type, payload, jobId, debug, config } = event.data || {}

  // デバッグモード設定
  isDebugMode = debug === true
  log("メッセージ受信:", event.data)

  // 設定メッセージを処理（APIエンドポイントなどの設定）
  if (type === "CONFIG") {
    if (payload?.apiBaseUrl) {
      apiBaseUrl = payload.apiBaseUrl
      log(`APIエンドポイントを設定: ${apiBaseUrl}`)
    }

    if (payload?.defaultOptions) {
      Object.assign(defaultFetchOptions, payload.defaultOptions)
      log(`デフォルトオプションを設定`, defaultFetchOptions)
    }

    self.postMessage({
      type: "CONFIG_UPDATED",
      payload: {
        apiBaseUrl,
        defaultOptions: defaultFetchOptions,
      },
    })
    return
  }

  // プリフライトチェック - 既存ジョブの確認
  if (type === "PREFLIGHT_CHECK") {
    const targetJobId = payload?.jobId || "all"
    const status = await checkJobStatus(targetJobId)

    self.postMessage({
      type: "PREFLIGHT_RESULT",
      payload: status,
      jobId: targetJobId,
    })
    return
  }

  // 既存ジョブの終了リクエスト
  if (type === "TERMINATE_REMOTE_JOB") {
    const targetJobId = payload?.jobId
    const result = await terminateJob(targetJobId)

    self.postMessage({
      type: "TERMINATE_RESULT",
      payload: result,
      jobId: targetJobId,
    })
    return
  }

  // APIジョブ実行リクエスト
  if (type === "API_JOB") {
    // 実行中のジョブがある場合はエラー
    if (currentJobId) {
      sendError(new Error("別のジョブが実行中です"))
      return
    }

    currentJobId = jobId

    try {
      // ジョブを直接localStorageに永続化して表示されるようにする
      const mockJob = {
        jobId,
        status: "pending",
        progress: 0,
        startTime: Date.now(),
        lastUpdated: Date.now(),
        metadata: {
          mode: "remote",
          calculationType: payload.type,
          apiEndpoint: apiBaseUrl,
        },
      }

      // localStorageに直接保存（UIからアクセスできるように）
      try {
        localStorage.setItem(`job_${jobId}`, JSON.stringify(mockJob))
        log(`ジョブをlocalStorageに保存: ${jobId}`)
      } catch (e) {
        log(`ジョブ保存エラー: ${e.message}`)
      }

      // モックデータベースにジョブを追加
      jobStore.set(jobId, mockJob)

      // 結果を送信前に進捗更新
      reportProgress(0, { status: "pending" })

      // 非同期でジョブ実行を開始（メインスレッドをブロックしない）
      setTimeout(() => {
        executeRemoteJob(payload, payload.options)
          .then((result) => {
            sendResult(result)
          })
          .catch((error) => {
            sendError(error)
          })
          .finally(() => {
            currentJobId = null
          })
      }, 10)

      // ジョブ受付応答を即座に返す
      self.postMessage({
        type: "JOB_ACCEPTED",
        payload: {
          jobId,
          status: "pending",
          message: "ジョブを受け付けました",
        },
        jobId,
      })
    } catch (error) {
      sendError(error)
      currentJobId = null
    }
    return
  }

  // Worker ID取得リクエスト
  if (type === "GET_ID") {
    self.postMessage({
      type: "ID_RESPONSE",
      workerId,
    })
    return
  }

  // PINGリクエスト
  if (type === "PING") {
    self.postMessage({
      type: "PONG",
      payload: { time: Date.now(), workerId },
      jobId,
    })
    return
  }

  // その他の未知のリクエスト
  log(`未知のメッセージタイプ: ${type}`)
})

// 初期化完了メッセージ
log(`API Worker初期化完了 (ID: ${workerId})`)
