// ArrayBuffer処理専用Worker

// 処理中フラグ
let isProcessing = false
// 現在のジョブID
let currentJobId = null
// デバッグモード
let isDebugMode = false

// デバッグログ関数
function log(...args) {
  if (isDebugMode) {
    console.log("[BufferWorker]", ...args)
  }
}

// 進捗報告関数
function reportProgress(percent) {
  self.postMessage({
    type: "PROGRESS",
    payload: { percent },
    jobId: currentJobId,
  })
}

// ジョブ結果送信関数
function sendResult(result, transferables = []) {
  self.postMessage(
    {
      type: "RESULT",
      payload: result,
      jobId: currentJobId,
    },
    transferables,
  )
}

// エラー送信関数
function sendError(error) {
  self.postMessage({
    type: "ERROR",
    payload: { message: error.message },
    jobId: currentJobId,
  })
}

// ArrayBuffer処理関数
async function processBuffer(buffer, options = {}) {
  // 進捗報告（開始）
  reportProgress(0)

  try {
    // 入力バッファをTypedArrayとして扱う
    const inputArray = new Float32Array(buffer)
    const totalItems = inputArray.length
    const chunkSize = Math.ceil(totalItems / 20) // 20ステップで処理

    log(`処理開始: ${totalItems.toLocaleString()}要素、${(buffer.byteLength / (1024 * 1024)).toFixed(2)}MB`)

    // 結果を格納する新しいバッファを作成
    const resultArray = new Float32Array(totalItems)

    // 各要素に処理を加える
    for (let i = 0; i < totalItems; i += chunkSize) {
      // このチャンクの終了位置
      const end = Math.min(i + chunkSize, totalItems)

      // 進捗報告
      const percent = Math.floor((i / totalItems) * 100)
      reportProgress(percent)

      // 各要素を処理（例：各値に1を足して2倍）
      for (let j = i; j < end; j++) {
        resultArray[j] = (inputArray[j] + 1) * 2
      }

      // 処理が見えるように遅延（オプション）
      if (options.slowMode) {
        await new Promise((r) => setTimeout(r, 50))
      }
    }

    // 完了報告
    reportProgress(100)
    log(`処理完了: ${totalItems.toLocaleString()}要素`)

    // 結果のバッファを返す（転送可能オブジェクトとして）
    return resultArray.buffer
  } catch (error) {
    log("処理エラー:", error)
    throw error
  }
}

// イメージデータ処理用（Canvas ImageDataの処理例）
async function processImageData(imageData, options = {}) {
  // 進捗報告（開始）
  reportProgress(0)

  try {
    // デバッグ: 受け取ったデータの情報を出力
    log(
      "画像データ受信:",
      JSON.stringify({
        width: imageData.width,
        height: imageData.height,
        hasData: !!imageData.data,
        dataType: imageData.data ? typeof imageData.data : "undefined",
      }),
    )

    // ImageDataのデータ配列にアクセス - 重要な修正
    // ブラウザから送信されたのはArrayBufferなのでそれを直接使用
    const data = new Uint8ClampedArray(imageData.data)
    const width = imageData.width
    const height = imageData.height
    const totalPixels = width * height

    // 最初の数ピクセルの値を確認
    if (data.length > 0) {
      log("元画像の最初のピクセル[RGBA]:", data[0], data[1], data[2], data[3])
    }

    log(`画像処理開始: ${width}x${height}ピクセル, データ長さ: ${data.length}`)

    // 結果用の新しいImageDataを作成
    const resultData = new Uint8ClampedArray(data.length)

    // 処理ステップ数
    const steps = 20
    const pixelsPerStep = Math.ceil(totalPixels / steps)

    // 画像エフェクト処理（例：ネガティブ効果）
    for (let step = 0; step < steps; step++) {
      // 処理範囲
      const startPixel = step * pixelsPerStep
      const endPixel = Math.min((step + 1) * pixelsPerStep, totalPixels)

      // 進捗報告
      reportProgress(Math.floor((step / steps) * 100))

      // 各ピクセルを処理
      for (let pixel = startPixel; pixel < endPixel; pixel++) {
        const i = pixel * 4 // RGBA各4バイト

        // ネガティブエフェクト（255から引く）
        resultData[i] = 255 - data[i] // R
        resultData[i + 1] = 255 - data[i + 1] // G
        resultData[i + 2] = 255 - data[i + 2] // B
        resultData[i + 3] = data[i + 3] // A（アルファは変更なし）
      }

      // 視覚化のための遅延
      if (options.slowMode) {
        await new Promise((r) => setTimeout(r, 100))
      }
    }

    // 処理後の最初のピクセルの値を確認
    if (resultData.length > 0) {
      log("処理後の最初のピクセル[RGBA]:", resultData[0], resultData[1], resultData[2], resultData[3])
    }

    // 完了報告
    reportProgress(100)
    log(`画像処理完了: 返却データサイズ ${resultData.buffer.byteLength} バイト`)

    // 新しいImageDataオブジェクト相当のデータを返す
    return {
      data: resultData.buffer,
      width,
      height,
    }
  } catch (error) {
    log("画像処理エラー:", error)
    throw error
  }
}

// メッセージイベントリスナー
// メッセージイベントリスナー
self.addEventListener("message", async (event) => {
  const { type, payload, jobId, debug } = event.data || {}

  // デバッグモード設定
  isDebugMode = debug === true
  log("メッセージ受信:", type, jobId)

  // ジョブ処理
  if (type === "JOB") {
    // 既存のジョブ処理中の場合はエラー
    if (isProcessing) {
      sendError(new Error("すでに処理中のジョブがあります"))
      return
    }

    // ジョブ処理開始
    isProcessing = true
    currentJobId = jobId

    try {
      let result
      let transferables = []

      // 処理タイプに応じた関数実行
      switch (payload.type) {
        case "processBuffer":
          result = await processBuffer(payload.buffer, payload)
          transferables.push(result) // 結果バッファを転送リストに追加
          break

        case "processImageData":
          result = await processImageData(payload.imageData, payload)
          transferables.push(result.data) // 画像データバッファを転送リストに追加
          break

        default:
          throw new Error(`未知の処理タイプ: ${payload.type}`)
      }

      // 結果を送信（転送可能オブジェクトリストを指定）
      sendResult(result, transferables)
    } catch (error) {
      sendError(error)
    } finally {
      // 状態リセット
      isProcessing = false
      currentJobId = null
    }
  }

  // PINGメッセージ
  else if (type === "PING") {
    self.postMessage({
      type: "PONG",
      payload: { time: Date.now() },
    })
  }
})

// Worker初期化完了
log("BufferWorker初期化完了")
