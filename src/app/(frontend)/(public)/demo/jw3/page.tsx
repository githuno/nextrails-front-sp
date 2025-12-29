"use client"

import { useWebWorker } from "@/hooks/useWorker/useWebWorker3"
import { JobResult, JobState } from "@/hooks/useWorker/utils/job"
import { pubSub } from "@/utils/pubsub"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

export default function AdvancedWorkerJobDemo() {
  // 入力値とUI状態の管理
  const [input, setInput] = useState<string>("35")
  const [mode, setMode] = useState<"local" | "remote">("local")
  const [calculationType, setCalculationType] = useState<string>("fibonacci")
  const [output, setOutput] = useState<string[]>([])
  const [progress, setProgress] = useState<number>(0)
  const [customMessage, setCustomMessage] = useState<string>('{ "type": "PING" }')
  const [resultHistory, setResultHistory] = useState<JobResult[]>([])
  const [pendingJobs, setPendingJobs] = useState<JobState[]>([])

  // Worker状態表示用の追加ステート
  const [workerStatus, setWorkerStatus] = useState<"ノンアクティブ" | "アクティブ">("ノンアクティブ")
  const [workerLifecycle, setWorkerLifecycle] = useState<{
    created: number
    terminated: number
    reused: number
  }>({
    created: 0,
    terminated: 0,
    reused: 0,
  })

  // コンポーネントのマウント状態を追跡
  const isMountedRef = useRef(true)

  // ジョブIDと実行状態を追跡
  const currentJobIdRef = useRef<string | null>(null)
  const workerIdRef = useRef<string | null>(null)

  // ローカル/リモードに応じたWorkerの設定
  const workerOptions = useMemo(
    () => ({
      scriptUrl: mode === "local" ? "/workers/generic-worker.js" : "/workers/api-worker.js",
      mode,
      debug: true,
      terminateAfterJob: false,
      globalTimeout: mode === "local" ? 60000 : 30000,
      maxWorkerLifetime: 10 * 60 * 1000,
      apiEndpoint:
        // mode === "remote" ? "https://httpstat.us/200?sleep=3000" : undefined,
        mode === "remote" ? "api/jobs" : undefined,
      credentials: mode === "remote" ? ("same-origin" as RequestCredentials) : undefined,
    }),
    [mode],
  )

  // Workerの初期化と利用
  const {
    executeJob,
    abortJob,
    // getJobState,
    isRunning,
    lastResult,
    // pendingJobs: hookPendingJobs,
    getAllPendingJobs,
    terminateAfterJob,
    setTerminateAfterJob,
    getWorker,
    initWorker,
    terminateWorker,
    sendDirectMessage,
    workerId,
  } = useWebWorker(workerOptions)

  // ログ関数
  const log = useCallback((message: string) => {
    if (!isMountedRef.current) return
    queueMicrotask(() => {
      setOutput((prev) => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev].slice(0, 100)) // 最大100件まで保持
    })
  }, [])

  // ライフサイクル追跡の初期設定
  useEffect(() => {
    isMountedRef.current = true

    // クリーンアップ時に解除
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // workerId変更時の処理
  useEffect(() => {
    if (workerId) {
      workerIdRef.current = workerId
      log(`Worker ID: ${workerId}`)
    }
  }, [workerId])

  // モード変更時の処理
  useEffect(() => {
    log(`モードを ${mode} に切り替えました`)

    // モードを切り替えたらWorkerをリセット
    if (getWorker()) {
      terminateWorker()
      log("モード切替のためWorkerを終了しました")
    }

    // リモートモードに変更された場合、保留中のジョブを取得
    if (mode === "remote") {
      getAllPendingJobs()
        .then((jobs) => {
          if (isMountedRef.current && jobs?.length > 0) {
            queueMicrotask(() => setPendingJobs(jobs))
            log(`${jobs.length}件の保留中ジョブを検出しました`)
          }
        })
        .catch((err) => {
          log(`ジョブ状態確認エラー: ${err.message || String(err)}`)
        })
    } else {
      // ローカルモードに変更された場合は保留ジョブをクリア
      queueMicrotask(() => setPendingJobs([]))
    }
  }, [mode, getAllPendingJobs, getWorker, terminateWorker])

  // Workerの状態チェック
  useEffect(() => {
    const checkWorkerStatus = () => {
      const worker = getWorker()
      // Workerの状態を更新
      setWorkerStatus(worker ? "アクティブ" : "ノンアクティブ")
    }

    // 初回チェック
    checkWorkerStatus()

    // 定期的にチェック (1秒ごと)
    const interval = setInterval(checkWorkerStatus, 1000)

    // クリーンアップ
    return () => clearInterval(interval)
  }, [getWorker])

  // リモートモードでの保留ジョブの定期更新
  useEffect(() => {
    // 前回のイベントリスナーをクリーンアップ
    pubSub.clearNamespace("worker:")

    // Worker作成イベント
    const unsubscribeCreated = pubSub.on("worker:created", (data) => {
      setWorkerLifecycle((prev) => ({ ...prev, created: prev.created + 1 }))
      log(`Workerが作成されました (モード: ${data.mode})`)
    })

    // Worker終了イベント
    const unsubscribeTerminated = pubSub.on("worker:terminated", (data) => {
      setWorkerLifecycle((prev) => ({
        ...prev,
        terminated: prev.terminated + 1,
      }))
      log(`Workerが終了しました (ソース: ${data.source})`)
      workerIdRef.current = null
    })

    // Worker再利用イベントをリッスン
    const unsubscribeReused = pubSub.on("worker:reused", (data) => {
      setWorkerLifecycle((prev) => ({
        ...prev,
        reused: prev.reused + 1,
      }))
      log(`Workerが再利用されました (ジョブID: ${data.jobId || "不明"})`)
    })

    // ジョブ開始イベント
    const unsubJobStart = pubSub.on("worker:job:start", (data) => {
      currentJobIdRef.current = data.jobId
      log(`ジョブ開始: ${data.jobId} (モード: ${data.mode})`)

      // 初回以外のジョブ開始時にはWorkerが再利用されていると見なす
      if (workerIdRef.current && getWorker()) {
        // Workerが既に存在している場合は再利用イベントを発行
        pubSub.emit("worker:reused", {
          jobId: data.jobId,
          workerId: workerIdRef.current,
        })
      }
    })

    // ジョブ完了イベント
    const unsubJobComplete = pubSub.on("worker:job:complete", (data) => {
      log(`ジョブ完了: ${data.jobId} (所要時間: ${data.duration.toFixed(1)}ms)`)

      // 結果を履歴に追加
      if (data.result && isMountedRef.current) {
        setResultHistory((prev) => [data.result, ...prev].slice(0, 10))
      }

      currentJobIdRef.current = null

      // Worker再利用カウントを更新（ジョブ完了後もWorkerが存在する場合）
      if (getWorker() && !terminateAfterJob) {
        pubSub.emit("worker:reused", {
          source: "job-complete",
          jobId: data.jobId,
        })
      }
    })

    // ジョブエラーイベント
    const unsubJobError = pubSub.on("worker:job:error", (data) => {
      log(`ジョブエラー: ${data.jobId} - ${data.error.message}`)
      currentJobIdRef.current = null
    })

    // ジョブ中止イベント
    const unsubJobAbort = pubSub.on("worker:job:abort", (data) => {
      log(`ジョブ中止: ${data.jobId} ${data.reason ? `(理由: ${data.reason})` : ""}`)
      currentJobIdRef.current = null
    })

    // クリーンアップ関数を返す
    return () => {
      unsubscribeCreated()
      unsubscribeTerminated()
      unsubscribeReused()
      unsubJobStart()
      unsubJobComplete()
      unsubJobError()
      unsubJobAbort()
      pubSub.clearNamespace("worker:")
    }
  }, [getWorker, terminateAfterJob])

  // 最終結果に基づく進捗状況の更新
  useEffect(() => {
    if (lastResult) {
      queueMicrotask(() => setProgress(lastResult.progress))
    }
  }, [lastResult])

  // ジョブ実行関数
  const handleExecuteJob = async () => {
    try {
      let n = parseInt(input)

      if (isNaN(n) || n < 0) {
        log("有効な数値を入力してください")
        return
      }

      if (calculationType === "delayDemo") {
        n = Math.min(50, Math.max(5, n))
        log(`進捗デモ開始: ${n}ステップ`)
      } else {
        log(`計算開始: ${calculationType}(${n})`)
      }

      setProgress(0)

      // ジョブオプション
      const jobOptions = {
        payload: {
          type: calculationType,
          n,
          delay: 200, // 進捗をより見やすくするための遅延
        },
        enableProgress: true,
        persistState: true,
        jobId: `${mode}_${calculationType}_${n}_${Date.now()}`,
        onProgress: (prog: number) => {
          if (isMountedRef.current) {
            setProgress(prog)
          }
        },
        metadata: {
          calculationType,
          inputValue: n,
          timestamp: Date.now(),
          mode, // モード情報を追加
        },
        // リモートモード専用オプション
        ...(mode === "remote" && {
          messageType: "API_JOB", // APIワーカー用のメッセージタイプを明示的に指定
          pollInterval: 500, // ポーリング間隔
        }),
      }

      // ジョブを実行
      const result = await executeJob(jobOptions)

      // 結果の処理
      if (result.status === "completed") {
        log(`計算結果: ${result.data} (${result.duration.toFixed(1)}ms)`)
      } else if (result.error) {
        log(`計算エラー: ${result.error.message}`)
      }
    } catch (error) {
      log(`エラー発生: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // 現在のジョブを中止
  const handleAbortJob = () => {
    if (currentJobIdRef.current) {
      log(`ジョブ中止リクエスト: ${currentJobIdRef.current}`)
      abortJob(currentJobIdRef.current).then((success) => {
        log(
          success
            ? `ジョブ ${currentJobIdRef.current} を中止しました`
            : `ジョブ ${currentJobIdRef.current} の中止に失敗しました`,
        )
      })
    } else {
      log("中止するジョブがありません")
    }
  }

  // リモートジョブの終了
  const handleTerminateRemoteJob = async (jobId: string) => {
    try {
      log(`リモートジョブ終了リクエスト: ${jobId}`)
      const success = await abortJob(jobId)
      log(success ? `リモートジョブ ${jobId} を終了しました` : `リモートジョブ ${jobId} の終了に失敗しました`)

      // 成功したら保留中のジョブリストを更新
      if (success && mode === "remote") {
        getAllPendingJobs().then((jobs) => {
          if (isMountedRef.current) {
            setPendingJobs(jobs)
          }
        })
      }
    } catch (error) {
      log(`リモートジョブ終了エラー: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // カスタムメッセージ送信
  const handleSendCustomMessage = async () => {
    try {
      let messageObj
      try {
        messageObj = JSON.parse(customMessage)
      } catch (e) {
        log("有効なJSONを入力してください")
        return
      }

      // 既存のWorkerを取得
      const existingWorker = getWorker()

      // Workerを必要に応じて初期化
      const worker = existingWorker || initWorker()
      if (!worker) {
        log("Workerの初期化に失敗しました")
        return
      }

      // 既存のWorkerを再利用した場合
      if (existingWorker && workerIdRef.current) {
        pubSub.emit("worker:reused", {
          source: "custom-message",
          jobId: "message-" + Date.now(),
        })
      }

      log(`カスタムメッセージを送信: ${customMessage}`)
      const response = await sendDirectMessage(messageObj, 5000)

      if (response) {
        log(`応答: ${JSON.stringify(response)}`)
      } else {
        log("応答なし（タイムアウト）")
      }
    } catch (error) {
      log(`メッセージ送信エラー: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const handleInitWorker = async () => {
    try {
      // 既存のWorkerを確認
      const existingWorker = getWorker()

      // 新しいWorkerを初期化
      const worker = await (existingWorker || initWorker())

      if (worker) {
        log("Workerを初期化しました")

        // 既存のWorkerだった場合は再利用イベントを発行
        if (existingWorker && workerIdRef.current) {
          pubSub.emit("worker:reused", {
            source: "init-worker",
            jobId: "init-" + Date.now(),
          })
        }
      } else {
        log("Workerの初期化に失敗しました")
      }
    } catch (error) {
      log(`Worker初期化エラー: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-8">
      <h1 className="mb-4 text-2xl font-bold">Web Worker デモ (v3)</h1>
      <p className="mb-6 text-gray-600">
        高度なWorker管理機能を使った統合デモ（ローカル・リモートジョブ、ライフサイクル管理）
      </p>

      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* 実行パネル */}
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">ジョブ実行</h2>

          {/* モード切替 */}
          <div className="mb-4">
            <div className="mb-2 flex items-center">
              <span className="mr-2 font-medium">動作モード:</span>
              <div className="flex overflow-hidden rounded-md border">
                <button
                  className={`px-4 py-1 ${mode === "local" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
                  onClick={() => setMode("local")}
                  disabled={isRunning}
                >
                  ローカル
                </button>
                <button
                  className={`px-4 py-1 ${mode === "remote" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
                  onClick={() => setMode("remote")}
                  disabled={isRunning}
                >
                  リモート
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              {mode === "local"
                ? "ローカルモード: 計算はブラウザ内のWorkerで実行されます"
                : "リモートモード: ジョブはAPIサーバーに送信され、進捗をポーリングで取得します"}
            </p>
          </div>

          {/* 計算設定 */}
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block">計算タイプ:</label>
              <select
                value={calculationType}
                onChange={(e) => setCalculationType(e.target.value)}
                className="w-full rounded border p-2"
                disabled={isRunning}
              >
                <option value="fibonacci">フィボナッチ数列</option>
                <option value="factorial">階乗</option>
                <option value="prime">素数判定</option>
                <option value="delayDemo">進捗デモ</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block">入力値:</label>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full rounded border p-2"
                disabled={isRunning}
              />
            </div>
          </div>

          {/* アクション */}
          <div className="mb-4 flex justify-between">
            <button
              onClick={handleAbortJob}
              disabled={!isRunning}
              className="rounded bg-red-600 px-4 py-2 text-white disabled:bg-gray-400"
            >
              中止
            </button>
            <button
              onClick={handleExecuteJob}
              disabled={isRunning}
              className="rounded bg-blue-600 px-4 py-2 text-white disabled:bg-gray-400"
            >
              実行
            </button>
          </div>

          {/* 進捗バー */}
          {isRunning && (
            <div className="mb-4">
              <div className="h-2.5 w-full rounded-full bg-gray-200">
                <div className="h-2.5 rounded-full bg-blue-600" style={{ width: `${progress}%` }}></div>
              </div>
              <p className="mt-1 text-right text-sm text-gray-600">{progress}%</p>
            </div>
          )}

          {/* 結果表示 */}
          {lastResult && (
            <div
              className={`mb-4 rounded p-4 ${
                lastResult.status === "completed"
                  ? "border border-green-200 bg-green-50"
                  : lastResult.status === "failed"
                    ? "border border-red-200 bg-red-50"
                    : "border border-yellow-200 bg-yellow-50"
              }`}
            >
              <h3 className="mb-1 font-medium">実行結果:</h3>
              <div className="text-sm">
                <p>
                  <span className="font-medium">ステータス:</span> {lastResult.status}
                </p>
                <p>
                  <span className="font-medium">実行時間:</span> {lastResult.duration.toFixed(2)}ms
                </p>
                <p>
                  <span className="font-medium">結果:</span>{" "}
                  {lastResult.data !== null
                    ? String(lastResult.data)
                    : lastResult.error
                      ? `エラー: ${lastResult.error.message}`
                      : "なし"}
                </p>
              </div>
            </div>
          )}

          {/* 実行ログ */}
          <h2 className="mb-2 text-xl font-semibold">実行ログ</h2>
          <div className="h-[200px] overflow-y-auto rounded bg-gray-50 p-3 font-mono text-sm">
            {output.length === 0 ? (
              <p className="text-gray-500 italic">ログはまだありません</p>
            ) : (
              output.map((message, index) => (
                <div key={index} className="mb-1">
                  {message}
                </div>
              ))
            )}
          </div>
        </div>

        {/* メッセージとログパネル */}
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          {/* カスタムメッセージ送信 */}
          <div className="mb-4">
            <h3 className="mb-2 font-medium">カスタムメッセージ:</h3>

            {/* テンプレート選択ボタン */}
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                onClick={() => setCustomMessage('{ "type": "PING" }')}
                className="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200"
              >
                PING
              </button>
              <button
                onClick={() => setCustomMessage('{ "type": "GET_ID" }')}
                className="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200"
              >
                ID取得
              </button>
              <button
                onClick={() => setCustomMessage('{ "type": "CONFIG", "payload": { "debug": true } }')}
                className="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200"
              >
                設定更新
              </button>
              {mode === "remote" && (
                <>
                  <button
                    onClick={() =>
                      setCustomMessage(
                        JSON.stringify(
                          {
                            type: "API_JOB",
                            payload: { type: "delayDemo", n: 5 },
                            jobId: `api_${Date.now()}`,
                            options: { pollInterval: 500 },
                          },
                          null,
                          2,
                        ),
                      )
                    }
                    className="rounded bg-blue-100 px-2 py-1 text-xs hover:bg-blue-200"
                  >
                    APIジョブ
                  </button>
                  <button
                    onClick={() =>
                      setCustomMessage(
                        JSON.stringify(
                          {
                            type: "PREFLIGHT_CHECK",
                            payload: { jobId: "all" },
                          },
                          null,
                          2,
                        ),
                      )
                    }
                    className="rounded bg-blue-100 px-2 py-1 text-xs hover:bg-blue-200"
                  >
                    ジョブ確認
                  </button>
                </>
              )}
            </div>

            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="mb-2 w-full rounded border p-2 font-mono text-sm"
              rows={3}
            />

            <div className="mb-2 text-xs text-gray-500">
              <p>※メッセージはWorkerに直接送信されます。有効なJSON形式である必要があります。</p>
              <p>
                ※Workerの状態:{" "}
                <span className={workerStatus === "アクティブ" ? "font-medium text-green-600" : "text-red-600"}>
                  {workerStatus}
                </span>
              </p>
            </div>

            <button
              onClick={handleSendCustomMessage}
              className="w-full rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:bg-gray-400"
              disabled={workerStatus !== "アクティブ"}
            >
              メッセージ送信 {workerStatus !== "アクティブ" && "（Workerが必要です）"}
            </button>
          </div>

          {/* Worker制御 */}
          <div className="rounded-md border bg-gray-50 p-3">
            <h3 className="mb-2 font-semibold">Worker制御</h3>
            <div className="mb-2 flex justify-between text-sm">
              <span>ジョブ終了後にWorkerを破棄:</span>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={terminateAfterJob}
                  onChange={(e) => setTerminateAfterJob(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="peer h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-blue-600 peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
              </label>
            </div>
            <div className="mb-2 flex justify-between text-sm">
              <span>状態:</span>
              <span className={workerStatus === "アクティブ" ? "font-medium text-green-600" : "text-gray-500"}>
                {workerStatus}
              </span>
            </div>
            <div className="flex items-center text-sm">
              <span className="mr-2">Worker ID:</span>
              <code className="rounded bg-gray-200 px-2 py-0.5 text-xs">{workerId || "なし"}</code>
            </div>

            <div className="flex space-x-2 pt-2">
              <button onClick={handleInitWorker} className="rounded bg-green-600 px-3 py-1 text-sm text-white">
                初期化
              </button>
              <button
                onClick={() => terminateWorker()}
                disabled={workerStatus !== "アクティブ"}
                className="rounded bg-red-600 px-3 py-1 text-sm text-white disabled:bg-gray-400"
              >
                終了
              </button>
              <button
                onClick={() => setTerminateAfterJob(!terminateAfterJob)}
                className="rounded bg-gray-600 px-3 py-1 text-sm text-white"
              >
                {terminateAfterJob ? "再利用に変更" : "使い捨てに変更"}
              </button>
            </div>
          </div>
          {/* ライフサイクル情報 */}
          <div className="mb-3 rounded-md border bg-gray-50 p-3">
            <h3 className="mb-2 font-semibold">Workerライフサイクル</h3>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="rounded bg-blue-50 p-1 text-center">
                <div className="font-bold">{workerLifecycle.created}</div>
                <div className="text-xs text-gray-500">作成</div>
              </div>
              <div className="rounded bg-red-50 p-1 text-center">
                <div className="font-bold">{workerLifecycle.terminated}</div>
                <div className="text-xs text-gray-500">終了</div>
              </div>
              <div className="rounded bg-green-50 p-1 text-center">
                <div className="font-bold">{workerLifecycle.reused}</div>
                <div className="text-xs text-gray-500">再利用</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* リモートジョブ/結果履歴パネル */}
      <div className="mb-6 grid grid-cols-1 gap-6">
        {mode === "remote" && (
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-xl font-semibold">保留中のリモートジョブ ({pendingJobs.length}件)</h2>

            {pendingJobs.length === 0 ? (
              <p className="text-gray-500 italic">現在、保留中のジョブはありません</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full table-auto">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">ジョブID</th>
                      <th className="px-4 py-2 text-left">ステータス</th>
                      <th className="px-4 py-2 text-left">進捗</th>
                      <th className="px-4 py-2 text-left">開始時間</th>
                      <th className="px-4 py-2 text-left">アクション</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingJobs.map((job) => (
                      <tr key={job.jobId} className="border-t">
                        <td className="px-4 py-2">
                          <span className="font-mono text-xs">{job.jobId}</span>
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              job.status === "running"
                                ? "bg-blue-100 text-blue-800"
                                : job.status === "completed"
                                  ? "bg-green-100 text-green-800"
                                  : job.status === "failed"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {job.status}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="h-1.5 w-full max-w-[100px] rounded-full bg-gray-200">
                            <div
                              className={`h-1.5 rounded-full ${job.status === "failed" ? "bg-red-500" : "bg-blue-500"}`}
                              style={{ width: `${job.progress}%` }}
                            ></div>
                          </div>
                          <span className="pl-1 text-xs">{job.progress}%</span>
                        </td>
                        <td className="px-4 py-2">{new Date(job.startTime).toLocaleTimeString()}</td>
                        <td className="px-4 py-2">
                          <button
                            onClick={() => handleTerminateRemoteJob(job.jobId)}
                            className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200"
                          >
                            終了
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 結果履歴 */}
        {resultHistory.length > 0 && (
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-semibold">結果履歴</h2>
              <button
                onClick={() => setResultHistory([])}
                className="rounded bg-gray-200 px-3 py-1 text-sm text-gray-700"
              >
                クリア
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">タイプ</th>
                    <th className="px-4 py-2 text-left">結果</th>
                    <th className="px-4 py-2 text-left">所要時間</th>
                    <th className="px-4 py-2 text-left">ステータス</th>
                    <th className="px-4 py-2 text-left">ジョブID</th>
                  </tr>
                </thead>
                <tbody>
                  {resultHistory.map((result, index) => (
                    <tr key={index} className="border-t">
                      <td className="px-4 py-2">{result.metadata?.calculationType || "不明"}</td>
                      <td className="px-4 py-2 font-mono">
                        {result.data !== null
                          ? String(result.data).substring(0, 30)
                          : result.error
                            ? `エラー: ${result.error.message}`
                            : "N/A"}
                      </td>
                      <td className="px-4 py-2">{result.duration.toFixed(1)}ms</td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            result.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : result.status === "failed"
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {result.status}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span className="font-mono text-xs">{result.jobId}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* APIリファレンス */}
      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-xl font-semibold">useWebWorker APIリファレンス</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <h3 className="mb-2 font-semibold">基本機能</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>
                <code className="rounded bg-gray-100 px-1">executeJob</code> - ジョブの実行
              </li>
              <li>
                <code className="rounded bg-gray-100 px-1">abortJob</code> - ジョブの中止
              </li>
              <li>
                <code className="rounded bg-gray-100 px-1">getJobState</code> - ジョブの状態取得
              </li>
              <li>
                <code className="rounded bg-gray-100 px-1">isRunning</code> - 実行中かの状態
              </li>
              <li>
                <code className="rounded bg-gray-100 px-1">lastResult</code> - 最後の実行結果
              </li>
            </ul>
          </div>
          <div>
            <h3 className="mb-2 font-semibold">高度な機能</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>
                <code className="rounded bg-gray-100 px-1">terminateAfterJob</code> - ジョブ終了後のWorker破棄設定
              </li>
              <li>
                <code className="rounded bg-gray-100 px-1">getWorker/initWorker</code> - Workerの直接操作
              </li>
              <li>
                <code className="rounded bg-gray-100 px-1">sendDirectMessage</code> - 直接メッセージ送信
              </li>
              <li>
                <code className="rounded bg-gray-100 px-1">getAllPendingJobs</code> - 保留中ジョブ一覧取得
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
