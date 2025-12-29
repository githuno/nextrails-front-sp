// グローバルイベントキューを保持
const eventQueue: Array<{
  type: string
  timestamp: number
  source: string
  data: any
}> = []

// イベント追加用のエンドポイント
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // 新しいイベントをキューに追加
    const newEvent = {
      type: body.type || "custom",
      timestamp: Date.now(),
      source: "client",
      data: body.data || {},
    }

    // キューの先頭に追加（最新のイベントが先頭）
    eventQueue.unshift(newEvent)

    // 最大100件までキューを保持
    if (eventQueue.length > 100) {
      eventQueue.pop()
    }

    return new Response(JSON.stringify({ success: true, event: newEvent }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    )
  }
}

// vercelデプロイにおける時間制限
// ：https://www.rasukarusan.com/entry/2023/12/23/104646
// ：https://vercel.com/docs/functions/limitations#max-duration
// ：https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config
export const runtime = "edge"

// SSEエンドポイント
export async function GET() {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      // イベントを送信する関数
      const sendEvent = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      // 接続時に過去のイベントを送信
      if (eventQueue.length > 0) {
        // 過去10件のイベントを送信（最新順）
        eventQueue.slice(0, 10).forEach((event) => {
          sendEvent({
            ...event,
            initial: true,
          })
        })
      }

      // 前回までに処理したイベント数を記録
      let processedCount = eventQueue.length

      // 定期的なハートビートと新規イベントのチェック
      const intervalId = setInterval(() => {
        // 新しいイベントがあれば送信（最新のものから順に）
        if (processedCount < eventQueue.length) {
          // 新しく追加されたイベントだけを取得（インデックス0からprocessedCountまで）
          const newEvents = eventQueue.slice(0, eventQueue.length - processedCount)

          // 新しいイベントを送信
          newEvents.forEach((event) => sendEvent(event))

          // 処理済みイベント数を更新
          processedCount = eventQueue.length
        }

        // ハートビート - 接続維持のためのダミーイベント
        sendEvent({
          type: "heartbeat",
          timestamp: Date.now(),
        })
      }, 5000)

      // クリーンアップ
      return () => {
        clearInterval(intervalId)
      }
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
