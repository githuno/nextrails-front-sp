"use client"

import { useSSE } from "@/hooks/useSSE"
import Link from "next/link"
import { useCallback, useMemo, useState } from "react"

interface JobStatus {
  id: string
  status: "pending" | "running" | "completed" | "failed"
  progress: number
  startTime: number
  message: string
  result?: any
  error?: string
}

export default function JobMonitorPage() {
  const [jobId, setJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // エラーハンドラ
  const handleError = useCallback((err: Error) => {
    console.error("SSE Error:", err)
    setError("ジョブの監視に失敗しました: " + err.message)
  }, [])

  // SSE接続のセットアップ
  const {
    data: status,
    status: connectionStatus,
    error: sseError,
  } = useSSE<JobStatus>(
    jobId ? `/api/demo/sse/job?jobId=${jobId}` : null,
    useMemo(
      () => ({
        enabled: !!jobId,
        onError: handleError,
        onConnected: () => {
          setError(null)
        },
        onCompleted: () => {
          console.log("ジョブが完了しました")
          // 完了時にjobIdをクリア
          setJobId(null)
        },
      }),
      [jobId, handleError],
    ),
  )

  // ジョブを開始する関数
  const startJob = useCallback(async () => {
    try {
      setError(null)

      const response = await fetch("/api/demo/sse/job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) {
        throw new Error("ジョブの開始に失敗しました")
      }

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error)
      }

      setJobId(data.jobId)
    } catch (err) {
      console.error("Failed to start job:", err)
      setError(err instanceof Error ? err.message : "ジョブの開始に失敗しました")
      setJobId(null)
    }
  }, [])

  // 接続状態メッセージ
  const connectionMessage = useMemo(() => {
    return connectionStatus === "connecting" ? "接続中..." : connectionStatus === "error" ? "接続エラー" : ""
  }, [connectionStatus])

  // ジョブIDを取得する関数
  const handleGetJobId = useCallback(() => {
    setError(null)
    setJobId("job-1")
  }, [])

  // ステータス表示
  const statusDisplay = useMemo(() => {
    if (!status) return null

    const jobError = status.error && status.status === "failed" ? status.error : null

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="font-medium">ジョブID: {status.id}</div>
          <div
            className={`rounded px-2 py-1 text-sm ${
              status.status === "completed"
                ? "bg-green-100 text-green-800"
                : status.status === "failed"
                  ? "bg-red-100 text-red-800"
                  : "bg-yellow-100 text-yellow-800"
            }`}
          >
            {status.status === "completed"
              ? "完了"
              : status.status === "failed"
                ? "エラー"
                : status.status === "running"
                  ? "実行中"
                  : "待機中"}
          </div>
        </div>

        {/* 進捗バー */}
        <div className="relative pt-1">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <span className="inline-block rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800 uppercase">
                進捗
              </span>
            </div>
            <div className="text-right">
              <span className="inline-block text-xs font-semibold text-blue-800">{status.progress}%</span>
            </div>
          </div>
          <div className="mb-4 flex h-2 overflow-hidden rounded bg-blue-100 text-xs">
            <div
              style={{ width: `${status.progress}%` }}
              className="flex flex-col justify-center bg-blue-500 text-center whitespace-nowrap text-white shadow-none transition-all duration-500"
            />
          </div>
        </div>

        <div className="text-sm text-gray-600">{status.message}</div>

        {status.result && (
          <div className="mt-4 rounded bg-green-50 p-3">
            <h3 className="mb-2 font-medium text-green-800">処理結果</h3>
            <pre className="rounded bg-white p-2 text-sm">{JSON.stringify(status.result, null, 2)}</pre>
          </div>
        )}

        {jobError && (
          <div className="mt-4 rounded bg-red-50 p-3">
            <h3 className="mb-2 font-medium text-red-800">エラー詳細</h3>
            <div className="text-sm text-red-600">{jobError}</div>
          </div>
        )}
      </div>
    )
  }, [status])

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">重いジョブの進捗モニター</h1>
        <Link href="/demo/sse" className="rounded-md bg-blue-100 px-3 py-1 text-sm text-blue-800 hover:bg-blue-200">
          SSEデモページへ
        </Link>
      </div>

      <div className="mb-4">
        <button onClick={handleGetJobId} className="rounded-md bg-green-500 px-4 py-2 text-white hover:bg-green-600">
          ジョブIDを取得
        </button>
      </div>

      {connectionMessage && (
        <div
          className={`mb-4 rounded p-3 ${
            connectionStatus === "connecting" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
          }`}
        >
          {connectionMessage}
        </div>
      )}

      <div className="rounded-lg bg-white p-6 shadow-md">
        <div className="mb-6">
          <button
            onClick={startJob}
            disabled={!!jobId && status?.status === "running"}
            className={`rounded-md px-4 py-2 ${
              jobId && status?.status === "running"
                ? "cursor-not-allowed bg-gray-300"
                : "bg-blue-500 text-white hover:bg-blue-600"
            }`}
          >
            {jobId && status?.status === "running" ? "処理実行中..." : "重い処理を開始"}
          </button>
        </div>

        {/* エラー表示の条件を改善 */}
        {error && connectionStatus !== "connected" && (
          <div className="mb-4 rounded bg-red-100 p-3 text-red-700">{error}</div>
        )}

        {statusDisplay}
      </div>
    </div>
  )
}
