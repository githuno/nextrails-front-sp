// APIリクエスト特化型Worker - バックエンドジョブ通信用

// 現在処理中のジョブID
let currentJobId = null
let isDebugMode = false

// Worker ID
const workerId = `api-worker-${Date.now()}-${Math.floor(Math.random() * 10000)}`

// デフォルトのAPIエンドポイント
let apiBaseUrl = "/api/jobs"

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

// APIリクエスト実行関数（リトライロジック付き）
async function makeRequest(url, options, retries = 3, retryDelay = 1000) {
  let lastError

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // リクエスト開始
      log(`APIリクエスト: ${options.method || "GET"} ${url} (試行: ${attempt + 1}/${retries + 1})`)

      // fetchで実行
      const response = await fetch(url, options)

      // レスポンスのステータスコードをチェック
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      // JSONレスポンスの場合のみパース
      const contentType = response.headers.get("content-type")
      if (contentType && contentType.includes("application/json")) {
        return await response.json()
      }

      return await response.text()
    } catch (error) {
      lastError = error
      log(`リクエスト失敗 (${attempt + 1}/${retries + 1}): ${error.message}`)

      // 最後のリトライでなければ待機して再試行
      if (attempt < retries) {
        log(`${retryDelay}ms後に再試行します...`)
        await new Promise((resolve) => setTimeout(resolve, retryDelay))
        // 指数バックオフ: 次回は2倍の時間待機
        retryDelay *= 2
      }
    }
  }

  // すべての試行が失敗した場合
  throw lastError
}

// ジョブ状態のチェック関数
async function checkJobStatus(jobId) {
  try {
    // API経由でジョブ状態を取得
    return await makeRequest(`${apiBaseUrl}/${jobId}/status`, {
      ...defaultFetchOptions,
      method: "GET",
    })
  } catch (error) {
    log(`ジョブ状態確認エラー: ${error.message}`)
    return { exists: false, error: error.message }
  }
}

// ジョブ終了リクエスト関数
async function terminateJob(jobId) {
  try {
    // API経由でジョブ終了を要求
    return await makeRequest(`${apiBaseUrl}/${jobId}/terminate`, {
      ...defaultFetchOptions,
      method: "POST",
    })
  } catch (error) {
    log(`ジョブ終了リクエストエラー: ${error.message}`)
    return { success: false, error: error.message }
  }
}

// ジョブ実行関数（APIを使用）
async function executeRemoteJob(jobData, options) {
  try {
    // 進捗初期化
    reportProgress(0)

    // リモートジョブ開始
    const result = await makeRequest(apiBaseUrl, {
      ...defaultFetchOptions,
      method: "POST",
      body: JSON.stringify(jobData),
    })

    log(`リモートジョブ開始: ${result.jobId}`)
    let completed = false
    let pollInterval = options?.pollInterval || 1000 // デフォルトは1秒ごとに確認

    // ジョブが完了するまでポーリング
    while (!completed) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval))

      const status = await checkJobStatus(result.jobId)

      if (status.error) {
        throw new Error(`ポーリングエラー: ${status.error}`)
      }

      // 進捗報告
      if (status.progress !== undefined) {
        reportProgress(status.progress, status)
      }

      // 完了チェック
      if (["completed", "failed"].includes(status.status)) {
        completed = true

        if (status.status === "completed") {
          reportProgress(100)
          return status.result
        } else {
          throw new Error(status.error || "ジョブが失敗しました")
        }
      }
    }
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
    const status = await checkJobStatus(payload.jobId)

    self.postMessage({
      type: "PREFLIGHT_RESULT",
      payload: status,
      jobId: payload.jobId,
    })
    return
  }

  // 既存ジョブの終了リクエスト
  if (type === "TERMINATE_REMOTE_JOB") {
    const result = await terminateJob(payload.jobId)

    self.postMessage({
      type: "TERMINATE_RESULT",
      payload: result,
      jobId: payload.jobId,
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
      const result = await executeRemoteJob(payload, payload.options)
      sendResult(result)
    } catch (error) {
      sendError(error)
    } finally {
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
      payload: { time: Date.now() },
      jobId,
    })
    return
  }

  // その他の未知のリクエスト
  log(`未知のメッセージタイプ: ${type}`)
})

// 初期化完了メッセージ
log(`API Worker初期化完了 (ID: ${workerId})`)
