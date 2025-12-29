import { NextResponse } from "next/server"

// ジョブの状態を定義
interface JobStatus {
  id: string
  status: "pending" | "running" | "completed" | "failed"
  progress: number
  startTime: number
  message: string
  result?: any
  error?: string
}

// ジョブストア（実際の実装ではRedisやDBを使用）
const jobStore = new Map<string, JobStatus>()

// ジョブ作成・開始用のPOSTエンドポイント
export async function POST() {
  // ジョブIDを生成
  // const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const jobId = "job-1"

  // ジョブの初期状態を保存
  const initialStatus: JobStatus = {
    id: jobId,
    status: "pending",
    progress: 0,
    startTime: Date.now(),
    message: "ジョブを開始します",
  }
  // ジョブストアに保存
  // 実際の実装では、ここでRedisやDBに保存する
  jobStore.set(jobId, initialStatus)

  // 非同期でジョブを実行（実際のバックグラウンドジョブ処理を模倣）
  simulateHeavyJob(jobId)

  return NextResponse.json({
    success: true,
    jobId,
  })
}

/**
 * 重い処理を模擬実行する関数
 */
async function simulateHeavyJob(jobId: string) {
  const steps = 5 // 全体のステップ数
  const stepDuration = 1000 // 各ステップの所要時間（15秒）

  try {
    // ジョブを開始
    jobStore.set(jobId, {
      ...jobStore.get(jobId)!,
      status: "running",
      message: "処理を開始しました",
    })

    // 各ステップを実行
    for (let i = 1; i <= steps; i++) {
      await new Promise((resolve) => setTimeout(resolve, stepDuration))

      // 進捗を更新
      const progress = Math.floor((i / steps) * 100)
      jobStore.set(jobId, {
        ...jobStore.get(jobId)!,
        progress,
        message: `ステップ ${i}/${steps} を完了しました (${progress}%)`,
      })
    }

    // ジョブ完了
    jobStore.set(jobId, {
      ...jobStore.get(jobId)!,
      status: "completed",
      progress: 100,
      message: "処理が完了しました",
      result: {
        processedAt: new Date().toISOString(),
        duration: Date.now() - jobStore.get(jobId)!.startTime,
      },
    })
  } catch (error) {
    // エラー発生時
    jobStore.set(jobId, {
      ...jobStore.get(jobId)!,
      status: "failed",
      message: "エラーが発生しました",
      error: error instanceof Error ? error.message : "不明なエラー",
    })
  }
}

// SSE進捗監視用のGETエンドポイント
export async function GET(request: Request) {
  const url = new URL(request.url)
  const jobId = url.searchParams.get("jobId")

  if (!jobId || !jobStore.has(jobId)) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      const sendStatus = () => {
        const status = jobStore.get(jobId)
        if (status) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(status)}\n\n`))
        }
      }

      // 初回データ送信
      sendStatus()

      const intervalId = setInterval(() => {
        const status = jobStore.get(jobId)
        if (!status || ["completed", "failed"].includes(status.status)) {
          clearInterval(intervalId)
          if (status) {
            sendStatus()
          }
          controller.close()
          return
        }
        sendStatus()
      }, 1000) // 1秒ごとに進捗を送信

      return () => clearInterval(intervalId)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
