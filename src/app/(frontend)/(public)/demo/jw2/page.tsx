"use client"

import { JobResult, JobState } from "@/hooks/useWorker"
import { useWebWorker } from "@/hooks/useWorker/useWebWorker2"
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
  const [workerStatus, setWorkerStatus] = useState<"ノンアクティブ" | "アクティブ">("ノンアクティブ")
  const [pendingJobs, setPendingJobs] = useState<JobState[]>([])

  // Workerのライフサイクル追跡
  const [workerLifecycle, setWorkerLifecycle] = useState<{
    created: number
    terminated: number
    reused: number
  }>({
    created: 0,
    terminated: 0,
    reused: 0,
  })

  // 結果履歴
  const [resultHistory, setResultHistory] = useState<JobResult[]>([])

  // 実行中のジョブトラッキング
  const jobIdRef = useRef<string | null>(null)
  const workerIdRef = useRef<string | null>(null)
  const [workerId, setWorkerId] = useState<string | null>(null)

  // ローカル/リモードに応じたWorkerの設定
  const workerOptions = useMemo(
    () =>
      mode === "local"
        ? {
            scriptUrl: "/workers/generic-worker.js",
            debug: true,
            terminateAfterJob: false,
            globalTimeout: 60000,
            maxWorkerLifetime: 10 * 60 * 1000,
            mode: "local" as const,
            credentials: null,
            onProgress: null,
            onError: null,
          }
        : {
            scriptUrl: "/workers/api-worker.js",
            debug: true,
            apiEndpoint: "https://qiita.com/miyaken3381/items/1bc7530a211a507a19dc",
            terminateAfterJob: false,
            globalTimeout: 120000,
            defaultPollInterval: 500,
            autoRestorePendingJobs: true,
            mode: "remote" as const,
            credentials: null,
            onProgress: null,
            onError: null,
          },
    [mode],
  )

  // useWebWorkerフックの戻り値を分解
  const webWorkerResult = useWebWorker(workerOptions)
  const {
    // 基本API
    executeJob,
    abortJob,
    getJobState,

    // 状態
    isRunning,
    lastResult,
    pendingJobs: hookPendingJobs,

    // 設定
    terminateAfterJob,
    setTerminateAfterJob,

    // 低レベルAPI
    getWorker,
    getWorkerRef,
    terminateWorker,
    sendDirectMessage,

    // モード情報
    mode: workerMode,
    isRemoteMode,
    isLocalMode,
  } = webWorkerResult

  // 型安全にモード固有のAPIにアクセス
  const executeLocalJob = isLocalMode ? (webWorkerResult as any).executeLocalJob : undefined

  const executeRemoteJob = isRemoteMode ? (webWorkerResult as any).executeRemoteJob : undefined

  const checkRemoteJobStatus = isRemoteMode ? (webWorkerResult as any).checkRemoteJobStatus : undefined

  const terminateRemoteJob = isRemoteMode ? (webWorkerResult as any).terminateRemoteJob : undefined

  const restorePendingJobs = isRemoteMode ? (webWorkerResult as any).restorePendingJobs : undefined

  // ログ関数
  const log = useCallback((message: string) => {
    queueMicrotask(() => {
      setOutput((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
    })
  }, [])

  // モード切替時の処理
  useEffect(() => {
    log(`モードを ${mode} に切り替えました`)

    // モード切替時にWorkerをリセット
    if (getWorkerRef()) {
      terminateWorker()
    }

    // リモートモードの場合は保留中のジョブを復元
    if (mode === "remote" && restorePendingJobs) {
      restorePendingJobs().then((jobs: JobState[]) => {
        if (jobs && jobs.length > 0) {
          log(`${jobs.length}件の保留中ジョブを復元しました`)
        }
      })
    }
  }, [mode, terminateWorker, getWorkerRef, restorePendingJobs, log])

  // 保留中のジョブを監視
  useEffect(() => {
    if (hookPendingJobs?.length > 0) {
      queueMicrotask(() => setPendingJobs(hookPendingJobs))
    }
  }, [hookPendingJobs])

  // PubSubイベントのリスナー登録
  useEffect(() => {
    // Workerイベントのサブスクライブ
    const unsubscribeCreated = pubSub.on("worker:created", (data) => {
      setWorkerLifecycle((prev) => ({ ...prev, created: prev.created + 1 }))
      log(`Workerが作成されました (モード: ${data.mode})`)

      // Worker IDを取得
      setTimeout(async () => {
        try {
          const response = await sendDirectMessage({ type: "GET_ID" })
          if (response?.workerId) {
            workerIdRef.current = response.workerId
            setWorkerId(response.workerId)
            log(`Worker ID: ${response.workerId}`)
          }
        } catch (e) {
          // エラー無視
        }
      }, 100)
    })

    const unsubscribeTerminated = pubSub.on("worker:terminated", (data) => {
      setWorkerLifecycle((prev) => ({
        ...prev,
        terminated: prev.terminated + 1,
      }))
      log(`Workerが終了しました (ソース: ${data.source})`)
      workerIdRef.current = null
      setWorkerId(null)
    })

    const unsubscribeJobStart = pubSub.on("worker:job:start", (data) => {
      log(`ジョブ開始: ${data.jobId} (モード: ${data.mode})`)
      jobIdRef.current = data.jobId
    })

    const unsubscribeJobComplete = pubSub.on("worker:job:complete", (data) => {
      log(`ジョブ完了: ${data.jobId} (所要時間: ${data.duration.toFixed(1)}ms)`)
      jobIdRef.current = null
    })

    const unsubscribeJobError = pubSub.on("worker:job:error", (data) => {
      log(`ジョブエラー: ${data.jobId} - ${data.error.message}`)
      jobIdRef.current = null
    })

    const unsubscribeJobAbort = pubSub.on("worker:job:abort", (data) => {
      log(`ジョブ中止: ${data.jobId} ${data.reason ? `(理由: ${data.reason})` : ""}`)
      jobIdRef.current = null
    })

    // クリーンアップ
    return () => {
      unsubscribeCreated()
      unsubscribeTerminated()
      unsubscribeJobStart()
      unsubscribeJobComplete()
      unsubscribeJobError()
      unsubscribeJobAbort()
    }
  }, [sendDirectMessage])

  // Workerの状態チェック
  useEffect(() => {
    const checkWorkerStatus = () => {
      const worker = getWorkerRef()
      setWorkerStatus(worker ? "アクティブ" : "ノンアクティブ")
    }

    // 初回チェック
    checkWorkerStatus()

    // 定期的にチェック
    const interval = setInterval(checkWorkerStatus, 1000)
    return () => clearInterval(interval)
  }, [getWorkerRef])

  // 進捗状況の監視
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
        log("有効な正の整数を入力してください")
        return
      }

      if (calculationType === "delayDemo") {
        // 進捗デモモード
        n = Math.min(50, Math.max(5, n || 20))
        log(`進捗デモ開始: ${n}ステップ (モード: ${mode})`)
      } else {
        log(`計算開始: ${calculationType}(${n}) (モード: ${mode})`)
      }

      setProgress(0)

      // ジョブオプション
      const jobOptions = {
        payload: {
          type: calculationType,
          n,
          delay: 200, // 進捗デモモード用
        },
        enableProgress: true,
        debug: true,
        persistState: true,
        jobId: `${mode}_${calculationType}_${n}_${Date.now()}`,
        onProgress: (prog: number) => {
          setProgress(prog)
        },
        metadata: {
          demoMetadata: true,
          calculationType,
          inputValue: n,
        },
      }

      // リモートモード特有のオプション
      if (mode === "remote") {
        Object.assign(jobOptions, {
          jobType: calculationType,
          pollInterval: 500,
        })
      }

      // ジョブを実行
      const result = await executeJob(jobOptions)

      // 結果の処理
      if (result.status === "completed") {
        log(`計算結果: ${result.data} (${result.duration.toFixed(1)}ms)`)
        setResultHistory((prev) => [...prev, result])
      } else if (result.error) {
        log(`計算エラー: ${result.error.message}`)
      }
    } catch (error) {
      log(`エラー発生: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // ジョブ中止処理
  const handleAbortJob = () => {
    if (jobIdRef.current) {
      abortJob(jobIdRef.current).then((success) => {
        log(success ? `ジョブ ${jobIdRef.current} を中止しました` : `ジョブ ${jobIdRef.current} の中止に失敗しました`)
      })
    } else {
      log("中止するジョブがありません")
    }
  }

  // リモートジョブ終了処理
  const handleTerminateRemoteJob = async (jobId: string) => {
    if (!terminateRemoteJob) {
      log("リモートジョブの終了機能はリモートモードでのみ使用できます")
      return
    }

    try {
      const success = await terminateRemoteJob(jobId)
      log(success ? `リモートジョブ ${jobId} を終了しました` : `リモートジョブ ${jobId} の終了に失敗しました`)
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

      // Workerがなければ初期化
      if (!getWorkerRef()) {
        log("Workerを初期化します")
        await getWorker()
      }

      log(`カスタムメッセージを送信: ${customMessage}`)
      const response = await sendDirectMessage(messageObj, 5000)
      log(`応答: ${JSON.stringify(response)}`)
    } catch (error) {
      log(`メッセージ送信エラー: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Worker初期化
  const handleInitWorker = async () => {
    try {
      const worker = await getWorker()
      if (worker) {
        log("Workerを初期化しました")
      } else {
        log("Workerの初期化に失敗しました")
      }
    } catch (error) {
      log(`Worker初期化エラー: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // ジョブ状態確認
  const handleCheckJobStatus = async (jobId: string) => {
    try {
      const state = await getJobState(jobId)
      if (state) {
        log(`ジョブ状態: ${jobId} - ${state.status} (進捗: ${state.progress}%)`)
      } else {
        log(`ジョブ ${jobId} が見つかりません`)
      }
    } catch (error) {
      log(`ジョブ状態確認エラー: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // 以下、UIレンダリング部分は変更なし
  return (
    <div className="mx-auto max-w-6xl p-8">
      <h1 className="mb-4 text-3xl font-bold">useWorkerJob2 デモ</h1>
      <p className="mb-6 text-gray-600">ローカル計算とリモートAPIジョブの両方に対応した高機能Workerフックのデモ</p>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* 設定と実行パネル */}
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">ジョブ実行</h2>

          {/* モード選択 */}
          <div className="mb-4">
            <label className="mb-2 block">動作モード:</label>
            <div className="flex overflow-hidden rounded-md border">
              <button
                onClick={() => setMode("local")}
                className={`flex-1 py-2 ${mode === "local" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
              >
                ローカル
              </button>
              <button
                onClick={() => setMode("remote")}
                className={`flex-1 py-2 ${mode === "remote" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
              >
                リモート
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {mode === "local"
                ? "ローカルモード: 処理はブラウザ内のWorkerで実行されます"
                : "リモートモード: 処理はサーバー上で実行され、Workerはポーリングに使用されます"}
            </p>
          </div>

          {/* 計算設定 */}
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block">計算タイプ:</label>
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
              <label className="mb-2 block">数値:</label>
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
              {isRunning ? "実行中..." : "実行"}
            </button>
          </div>

          {/* 進捗バー */}
          {isRunning && (
            <div className="mb-4">
              <div className="mb-2 h-2.5 w-full rounded-full bg-gray-200">
                <div
                  className="h-2.5 rounded-full bg-blue-600 transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-right text-sm text-gray-600">{progress}%</p>
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
              <h3 className="mb-1 font-semibold">最新の結果</h3>
              <div className="text-sm">
                <p>
                  <span className="font-medium">状態:</span> {lastResult.status}
                </p>
                {lastResult.data !== null && (
                  <p>
                    <span className="font-medium">結果:</span> {String(lastResult.data)}
                  </p>
                )}
                {lastResult.error && (
                  <p>
                    <span className="font-medium">エラー:</span> {lastResult.error.message}
                  </p>
                )}
                <p>
                  <span className="font-medium">時間:</span> {lastResult.duration.toFixed(1)}ms
                </p>
                <p>
                  <span className="font-medium">ID:</span> {lastResult.jobId}
                </p>
              </div>
            </div>
          )}

          {/* Worker制御 */}
          <div className="mb-4 rounded-md border bg-gray-50 p-3">
            <h3 className="mb-2 font-semibold">Worker制御</h3>
            <div className="mb-2 flex justify-between text-sm">
              <span>状態:</span>
              <span className={workerStatus === "アクティブ" ? "text-green-600" : "text-red-600"}>{workerStatus}</span>
            </div>
            <div className="mb-3 flex justify-between text-sm">
              <span>ID:</span>
              <span className="font-mono text-xs">{workerId || "未初期化"}</span>
            </div>
            <div className="flex space-x-2">
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
        </div>

        {/* カスタムメッセージパネル */}
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">カスタムメッセージ</h2>

          <div className="mb-4">
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="w-full rounded border p-2 font-mono text-sm"
              rows={5}
            />
            <button onClick={handleSendCustomMessage} className="mt-2 rounded bg-indigo-600 px-4 py-2 text-white">
              送信
            </button>
          </div>

          <div className="mb-4">
            <h3 className="mb-2 font-semibold">サンプルメッセージ:</h3>
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                onClick={() => setCustomMessage('{ "type": "PING" }')}
                className="rounded bg-gray-200 px-2 py-1 text-xs hover:bg-gray-300"
              >
                PING
              </button>
              <button
                onClick={() => setCustomMessage('{ "type": "GET_ID" }')}
                className="rounded bg-gray-200 px-2 py-1 text-xs hover:bg-gray-300"
              >
                Get ID
              </button>
              {mode === "remote" && (
                <button
                  onClick={() => setCustomMessage('{ "type": "CONFIG", "payload": { "apiBaseUrl": "/api/jobs" } }')}
                  className="rounded bg-gray-200 px-2 py-1 text-xs hover:bg-gray-300"
                >
                  API設定
                </button>
              )}
            </div>

            <div className="mt-3 text-xs text-gray-600">
              <p>※低レベルAPIを使用するためカスタムメッセージはジョブIDを持ちません</p>
              <p>※メッセージ送信時にWorkerが存在しない場合は自動的に初期化されます</p>
            </div>
          </div>

          {/* ライフサイクル情報 */}
          <div className="rounded-md border bg-gray-50 p-3">
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

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* ログパネル */}
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">実行ログ</h2>
            <button onClick={() => setOutput([])} className="rounded bg-gray-200 px-3 py-1 text-sm text-gray-700">
              クリア
            </button>
          </div>
          <div className="h-64 overflow-y-auto rounded bg-gray-50 p-3 font-mono text-sm">
            {output.length === 0 ? (
              <p className="text-gray-500">ログはまだありません</p>
            ) : (
              output.map((message, index) => (
                <div key={index} className="mb-1">
                  {message}
                </div>
              ))
            )}
          </div>
        </div>

        {/* リモートジョブパネル */}
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">{mode === "remote" ? "保留中のリモートジョブ" : "結果履歴"}</h2>

          {mode === "remote" ? (
            <div>
              {pendingJobs.length === 0 ? (
                <p className="text-gray-500">保留中のジョブはありません</p>
              ) : (
                <div className="h-64 overflow-y-auto">
                  {pendingJobs.map((job) => (
                    <div key={job.jobId} className="border-b py-2 last:border-0">
                      <div className="flex items-center justify-between">
                        <div className="font-mono text-xs">{job.jobId}</div>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => handleCheckJobStatus(job.jobId)}
                            className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700"
                          >
                            状態確認
                          </button>
                          <button
                            onClick={() => handleTerminateRemoteJob(job.jobId)}
                            className="rounded bg-red-100 px-2 py-1 text-xs text-red-700"
                          >
                            終了
                          </button>
                        </div>
                      </div>
                      <div className="mt-1 flex justify-between text-xs">
                        <span>
                          状態: <span className="font-medium">{job.status}</span>
                        </span>
                        <span>
                          進捗: <span className="font-medium">{job.progress}%</span>
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-gray-200">
                        <div className="h-1.5 rounded-full bg-blue-600" style={{ width: `${job.progress}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {restorePendingJobs && (
                <button
                  onClick={() => restorePendingJobs()}
                  className="mt-3 rounded bg-indigo-100 px-3 py-1 text-sm text-indigo-700"
                >
                  保留ジョブの再確認
                </button>
              )}
            </div>
          ) : (
            <div>
              {resultHistory.length === 0 ? (
                <p className="text-gray-500">履歴はまだありません</p>
              ) : (
                <div className="h-64 overflow-y-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="p-2 text-left text-xs">タイプ</th>
                        <th className="p-2 text-left text-xs">結果</th>
                        <th className="p-2 text-left text-xs">時間(ms)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultHistory.map((result, index) => (
                        <tr key={index} className={index % 2 === 0 ? "bg-gray-50" : ""}>
                          <td className="p-2 text-xs">{result.jobId?.split("_")[1] || "-"}</td>
                          <td className="max-w-[150px] truncate p-2 text-xs">
                            {result.data !== null ? String(result.data) : "-"}
                          </td>
                          <td className="p-2 text-xs">{result.duration.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <button
                onClick={() => setResultHistory([])}
                className="mt-3 rounded bg-gray-200 px-3 py-1 text-sm text-gray-700"
              >
                履歴クリア
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 機能説明 */}
      <div className="mb-8 rounded-lg border bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-xl font-semibold">useWorkerJob2 の主な機能</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <h3 className="mb-2 font-semibold">基本機能</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>ローカルとリモートの両モードに対応した統合API</li>
              <li>ジョブの実行、中止、状態取得</li>
              <li>進捗状況のリアルタイム監視</li>
              <li>エラー処理とリトライメカニズム</li>
              <li>タイムアウト管理</li>
            </ul>
          </div>
          <div>
            <h3 className="mb-2 font-semibold">高度な機能</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>PubSubによるイベント駆動アーキテクチャ</li>
              <li>ジョブ状態の永続化とページ更新後の復元</li>
              <li>カスタムメッセージ送信によるWorker直接制御</li>
              <li>リモートジョブの状態確認と終了</li>
              <li>Workerのライフサイクル管理</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center text-sm text-gray-500">
        <a href="/demo/jw/simple" className="mr-4 text-blue-600 hover:underline">
          シンプルなデモページへ
        </a>
        <a href="/demo/jw" className="text-blue-600 hover:underline">
          ClassicバージョンのデモページへB
        </a>
      </div>
    </div>
  )
}
