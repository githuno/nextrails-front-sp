// "use client"
// import { JobResult, JobState, pubSub } from "@/hooks/useWorker"
// import { useWebWorker } from "@/hooks/useWorker/useWebWorker3"
// import { useEffect, useRef, useState } from "react"

// export default function AdvancedWorkerJobDemo() {
//   // 入力値とUI状態の管理
//   const [input, setInput] = useState<string>("35")
//   const [mode, setMode] = useState<"local" | "remote">("local")
//   const [calculationType, setCalculationType] = useState<string>("fibonacci")
//   const [output, setOutput] = useState<string[]>([])
//   const [progress, setProgress] = useState<number>(0)
//   const [customMessage, setCustomMessage] = useState<string>('{ "type": "PING" }')
//   const [workerStatus, setWorkerStatus] = useState<"ノンアクティブ" | "アクティブ">("ノンアクティブ")
//   const [pendingJobs, setPendingJobs] = useState<JobState[]>([])

//   // Workerのライフサイクル追跡
//   const [workerLifecycle, setWorkerLifecycle] = useState<{
//     created: number
//     terminated: number
//     reused: number
//   }>({
//     created: 0,
//     terminated: 0,
//     reused: 0,
//   })

//   // 結果履歴
//   const [resultHistory, setResultHistory] = useState<JobResult[]>([])

//   // 実行中のジョブトラッキング
//   const jobIdRef = useRef<string | null>(null)
//   const workerIdRef = useRef<string | null>(null)
//   // リモートジョブの前回長さを追跡するためのref
//   const previousPendingJobsLengthRef = useRef<number>(0)
//   // pendingJobsの最新値を参照するためのref
//   const pendingJobsRef = useRef<JobState[]>([])
//   // アクティブフラグの参照 (追加)
//   const isActiveRef = useRef<boolean>(true)
//   // getJobState関数の参照 (追加)
//   const getJobStateRef = useRef<any>(null)

//   // ローカル/リモードに応じたWorkerの設定
//   const workerOptions =
//     mode === "local"
//       ? {
//           scriptUrl: "/workers/generic-worker.js",
//           debug: true,
//           terminateAfterJob: false,
//           globalTimeout: 60000,
//           maxWorkerLifetime: 10 * 60 * 1000,
//           mode: "local" as const,
//           credentials: undefined,
//         }
//       : {
//           scriptUrl: "/workers/api-worker.js",
//           debug: true,
//           apiEndpoint: "https://httpstat.us/200?sleep=3000", // デモ用エンドポイント（実際のAPIに変更する）
//           terminateAfterJob: false,
//           globalTimeout: 30000,
//           mode: "remote" as const,
//           credentials: "same-origin" as RequestCredentials,
//         }

//   // Workerの初期化と利用
//   const {
//     // 基本API
//     executeJob,
//     abortJob,
//     getJobState,

//     // 状態
//     isRunning,
//     lastResult,
//     pendingJobs: hookPendingJobs,
//     getAllPendingJobs,

//     // 設定
//     terminateAfterJob,
//     setTerminateAfterJob,

//     // 低レベルAPI
//     getWorker,
//     initWorker,
//     terminateWorker,
//     sendDirectMessage,

//     // モード情報
//     mode: workerMode,
//     isRemoteMode,

//     // Worker情報
//     workerId,
//   } = useWebWorker(workerOptions)

//   const checkRemoteJobStatus = isRemoteMode ? getJobState : undefined
//   const terminateRemoteJob = isRemoteMode ? abortJob : undefined

//   // PubSubイベントを使ってカウンターを更新する関数
//   const setupPubSubListeners = () => {
//     // Workerイベントのサブスクライブ
//     const unsubscribeCreated = pubSub.on("worker:created", (data) => {
//       console.log("Worker created event received:", data)
//       setWorkerLifecycle((prev) => ({
//         ...prev,
//         created: prev.created + 1,
//       }))
//       log(`Workerが作成されました (モード: ${data.mode})`)

//       // Worker IDを取得
//       setTimeout(async () => {
//         if (sendDirectMessage) {
//           try {
//             const response = await sendDirectMessage({ type: "GET_ID" })
//             if (response?.workerId) {
//               workerIdRef.current = response.workerId
//               log(`Worker ID: ${response.workerId}`)
//             }
//           } catch (e) {
//             // エラー無視
//           }
//         }
//       }, 100)
//     })

//     const unsubscribeTerminated = pubSub.on("worker:terminated", (data) => {
//       console.log("Worker terminated event received:", data)
//       setWorkerLifecycle((prev) => ({
//         ...prev,
//         terminated: prev.terminated + 1,
//       }))
//       log(`Workerが終了しました (ソース: ${data.source || "不明"})`)
//       workerIdRef.current = null
//     })

//     const unsubscribeJobStart = pubSub.on("worker:job:start", (data) => {
//       log(`ジョブ開始: ${data.jobId} (モード: ${data.mode})`)
//       jobIdRef.current = data.jobId
//     })

//     const unsubscribeJobComplete = pubSub.on("worker:job:complete", (data) => {
//       log(`ジョブ完了: ${data.jobId} (所要時間: ${data.duration.toFixed(1)}ms)`)

//       // 結果を記録
//       if (data.result) {
//         setResultHistory((prev) => [data.result, ...prev].slice(0, 10))
//       }

//       jobIdRef.current = null

//       // Worker再利用カウントを更新（ジョブ完了後もWorkerが存在する場合）
//       if (getWorker()) {
//         setWorkerLifecycle((prev) => ({
//           ...prev,
//           reused: prev.reused + 1,
//         }))
//       }
//     })

//     const unsubscribeJobError = pubSub.on("worker:job:error", (data) => {
//       log(`ジョブエラー: ${data.jobId} - ${data.error.message}`)
//       jobIdRef.current = null
//     })

//     const unsubscribeJobAbort = pubSub.on("worker:job:abort", (data) => {
//       log(`ジョブ中止: ${data.jobId} ${data.reason ? `(理由: ${data.reason})` : ""}`)
//       jobIdRef.current = null
//     })

//     return () => {
//       unsubscribeCreated()
//       unsubscribeTerminated()
//       unsubscribeJobStart()
//       unsubscribeJobComplete()
//       unsubscribeJobError()
//       unsubscribeJobAbort()
//     }
//   }

//   // ログ関数
//   const log = (message: string) => {
//     setOutput((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
//   }

//   // Worker IDの状態を更新
//   useEffect(() => {
//     if (workerId) {
//       workerIdRef.current = workerId
//       log(`Worker ID設定: ${workerId}`)
//     }
//   }, [workerId])

//   // モード切替時の処理
//   useEffect(() => {
//     log(`モードを ${mode} に切り替えました`)

//     // モード切替時のWorker処理
//     const worker = getWorker()
//     if (worker) {
//       // 実行中のジョブがある場合は警告のみ表示
//       if (isRunning || (hookPendingJobs && hookPendingJobs.length > 0)) {
//         log("警告: 実行中のジョブがある状態でモードを切り替えました")
//         log("※ジョブの実行は継続されますが、UI状態が更新されない場合があります")
//       } else {
//         // 実行中のジョブがない場合は安全に終了
//         log("モード切替: 既存のWorkerを終了します")
//         terminateWorker()
//       }
//     }

//     // リモートモードの場合は保留中のジョブを確認
//     if (mode === "remote") {
//       log("リモートモード: 保留中のジョブを確認します")

//       // 一度だけ取得を実行して画面を更新
//       const fetchJobsOnce = async () => {
//         try {
//           // Worker初期化を確実に行う
//           if (!getWorker()) {
//             initWorker()
//             // Worker初期化を待機
//             await new Promise((resolve) => setTimeout(resolve, 300))
//           }

//           const jobs = await getAllPendingJobs()
//           if (jobs && jobs.length > 0) {
//             setPendingJobs(jobs)
//             log(`${jobs.length}件の保留中のジョブを検出しました`)
//           } else {
//             log("保留中のジョブはありません")
//             setPendingJobs([])
//           }
//         } catch (err: any) {
//           log(`ジョブ状態確認エラー: ${err.message || String(err)}`)
//         }
//       }

//       // モード切替時に一度だけ実行
//       fetchJobsOnce()
//     }
//   }, [
//     mode,
//     // terminateWorker,
//     // getWorker,
//     // initWorker,
//     // getAllPendingJobs,
//     // isRunning,
//     // hookPendingJobs,
//   ])

//   // リモートジョブを定期的に更新するための追加処理
//   useEffect(() => {
//     // リモートモードでのみ有効
//     if (mode !== "remote") return

//     // 常に最新のgetJobState関数で参照を更新
//     getJobStateRef.current = getJobState

//     // マウント時にアクティブフラグを設定
//     isActiveRef.current = true

//     const updateRemoteJobs = async () => {
//       // すでにアンマウント済みなら何もしない
//       if (!isActiveRef.current) return

//       try {
//         const getJobStateFn = getJobStateRef.current
//         if (!getJobStateFn) return

//         const result = await getJobStateFn("all")

//         // アンマウント後なら状態更新しない
//         if (!isActiveRef.current) return

//         // 結果が配列の場合のみ処理
//         if (Array.isArray(result)) {
//           // ジョブ数の変化検出とログ
//           const currentLength = previousPendingJobsLengthRef.current
//           if (result.length !== currentLength) {
//             if (result.length > 0) {
//               log(`保留中ジョブが更新されました: ${result.length}件`)
//             } else if (currentLength > 0) {
//               log("保留中のジョブがなくなりました")
//             }
//             previousPendingJobsLengthRef.current = result.length
//           }

//           // 現在の状態と新しい状態を比較（深い比較）
//           const currentJobs = pendingJobsRef.current || []
//           const currentIds = new Set(currentJobs.map((job) => job.jobId))
//           const newIds = new Set(result.map((job) => job.jobId))

//           // IDセットが異なる場合のみ更新（順序に依存しない比較）
//           let needsUpdate = currentIds.size !== newIds.size

//           if (!needsUpdate) {
//             // すべてのIDが同じか確認
//             currentIds.forEach((id) => {
//               if (!newIds.has(id)) {
//                 needsUpdate = true
//               }
//             })
//           }

//           if (needsUpdate) {
//             pendingJobsRef.current = [...result]
//             setPendingJobs(result)
//           }
//         }
//       } catch (err) {
//         console.error("ジョブ更新エラー:", err)
//       }
//     }

//     // 初回実行
//     updateRemoteJobs()

//     // 3秒ごとに更新
//     const interval = setInterval(updateRemoteJobs, 3000)

//     // クリーンアップ
//     return () => {
//       isActiveRef.current = false // アンマウント時にフラグを変更
//       clearInterval(interval)
//     }
//   }, [getJobState, mode])

//   // Workerのライフサイクルを監視
//   useEffect(() => {
//     // 過去のイベントが重複していないか確認
//     pubSub.clearNamespace("worker:")

//     console.log("Setting up pubsub listeners, current lifecycle:", workerLifecycle)

//     const cleanup = setupPubSubListeners()
//     return () => {
//       cleanup()
//       // コンポーネントのアンマウント時にもイベントハンドラを解除
//       pubSub.clearNamespace("worker:")
//     }
//   }, [setupPubSubListeners, workerLifecycle])

//   // // Workerの状態確認を定期的に実行
//   // useEffect(() => {
//   //   const checkWorkerStatus = () => {
//   //     const worker = getWorker();
//   //     const newStatus = worker ? "アクティブ" : "ノンアクティブ";

//   //     setWorkerStatus((prev) => {
//   //       if (prev !== newStatus && newStatus === "アクティブ") {
//   //         // Workerが新たにアクティブになった場合にIDを取得
//   //         if (sendDirectMessage) {
//   //           sendDirectMessage({ type: "GET_ID" })
//   //             .then((response) => {
//   //               if (response?.workerId) {
//   //                 workerIdRef.current = response.workerId;
//   //                 log(`新しいWorker ID: ${response.workerId}`);
//   //               }
//   //             })
//   //             .catch(() => {
//   //               /* エラー無視 */
//   //             });
//   //         }
//   //       }
//   //       return newStatus;
//   //     });
//   //   };

//   //   // 初回チェック
//   //   checkWorkerStatus();

//   //   // 定期的にチェック
//   //   const interval = setInterval(checkWorkerStatus, 1000);
//   //   return () => clearInterval(interval);
//   // }, [getWorker, sendDirectMessage]);

//   // 進捗状況の監視
//   useEffect(() => {
//     if (lastResult) {
//       setProgress(lastResult.progress)
//     }
//   }, [lastResult])

//   // ジョブ実行関数
//   const handleExecuteJob = async () => {
//     try {
//       let n = parseInt(input)

//       if (isNaN(n) || n < 0) {
//         log("有効な数値を入力してください")
//         return
//       }

//       if (calculationType === "delayDemo") {
//         n = Math.min(50, Math.max(5, n)) // 5～50の範囲に制限
//         log(`進捗デモ開始: ${n}ステップ`)
//       } else {
//         log(`計算開始: ${calculationType}(${n})`)
//       }

//       setProgress(0)

//       // ジョブオプション
//       const jobOptions = {
//         payload: {
//           type: calculationType,
//           n,
//           delay: 200, // 進捗をより見やすくするための遅延
//         },
//         enableProgress: true,
//         debug: true,
//         persistState: true,
//         jobId: `${mode}_${calculationType}_${n}_${Date.now()}`,
//         onProgress: (prog: number) => {
//           setProgress(prog)
//         },
//         metadata: {
//           demoMetadata: true,
//           calculationType,
//           inputValue: n,
//           timestamp: Date.now(),
//         },
//       }

//       // ジョブを実行
//       const result = await executeJob(jobOptions)

//       // 結果の処理
//       if (result.status === "completed") {
//         log(`計算結果: ${result.data} (${result.duration.toFixed(1)}ms)`)

//         // 結果履歴に追加 - タイムスタンプで並べる
//         setResultHistory((prev) => {
//           const newHistory = [...prev, { ...result, timestamp: Date.now() }]
//           // タイムスタンプでソート（降順 - 新しいものから）
//           return newHistory.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 10)
//         })
//       } else if (result.error) {
//         log(`計算エラー: ${result.error.message}`)
//       }
//     } catch (error) {
//       log(`エラー発生: ${error instanceof Error ? error.message : String(error)}`)
//     }
//   }

//   // ジョブ中止処理
//   const handleAbortJob = () => {
//     if (jobIdRef.current) {
//       log(`ジョブ中止リクエスト: ${jobIdRef.current}`)
//       abortJob(jobIdRef.current).then((success) => {
//         log(success ? `ジョブ ${jobIdRef.current} を中止しました` : `ジョブ ${jobIdRef.current} の中止に失敗しました`)
//       })
//     } else {
//       log("中止するジョブがありません")
//     }
//   }

//   // リモートジョブ終了処理
//   const handleTerminateRemoteJob = async (jobId: string) => {
//     if (!terminateRemoteJob) {
//       log("リモートジョブの終了機能はリモートモードでのみ使用できます")
//       return
//     }

//     try {
//       log(`リモートジョブ終了リクエスト: ${jobId}`)
//       const success = await terminateRemoteJob(jobId)
//       log(success ? `リモートジョブ ${jobId} を終了しました` : `リモートジョブ ${jobId} の終了に失敗しました`)
//     } catch (error) {
//       log(`リモートジョブ終了エラー: ${error instanceof Error ? error.message : String(error)}`)
//     }
//   }

//   // カスタムメッセージ送信
//   const handleSendCustomMessage = async () => {
//     try {
//       let messageObj
//       try {
//         messageObj = JSON.parse(customMessage)
//       } catch (e) {
//         log("有効なJSONを入力してください")
//         return
//       }

//       // Workerが存在しない場合に明示的に初期化
//       if (!getWorker()) {
//         log("Workerが存在しないため明示的に初期化します")
//         const worker = initWorker()

//         if (!worker) {
//           log("Workerの初期化に失敗しました")
//           return
//         }

//         // Workerの初期化を待つ
//         await new Promise((resolve) => setTimeout(resolve, 300))
//       }

//       log(`カスタムメッセージを送信: ${customMessage}`)
//       const response = await sendDirectMessage(messageObj, messageObj.type === "API_JOB" ? 15000 : 5000)

//       if (response) {
//         log(`応答: ${JSON.stringify(response)}`)

//         // APIジョブで応答が成功した場合、保留中のジョブを更新
//         if (messageObj.type === "API_JOB" && (response.type === "JOB_ACCEPTED" || response.type === "PROGRESS")) {
//           // ジョブ一覧を再取得（ビジネスロジック側の責務）
//           setTimeout(async () => {
//             const jobs = await getAllPendingJobs()
//             if (jobs.length > 0) {
//               log(`${jobs.length}件の保留中ジョブを取得しました`)
//             }
//           }, 500)
//         }
//       } else {
//         log("メッセージのタイムアウトまたは応答なし")
//       }
//     } catch (error) {
//       log(`メッセージ送信エラー: ${error instanceof Error ? error.message : String(error)}`)
//     }
//   }

//   // Worker初期化
//   const handleInitWorker = async () => {
//     try {
//       log("Workerを明示的に初期化します...")
//       const worker = initWorker() // getWorkerではなくinitWorkerを使用
//       if (worker) {
//         log("Workerを初期化しました")

//         // IDを取得
//         try {
//           const response = await sendDirectMessage({ type: "GET_ID" })
//           if (response?.workerId) {
//             workerIdRef.current = response.workerId
//             log(`Worker ID: ${response.workerId}`)
//           }
//         } catch (e) {
//           log(`ID取得エラー: ${e instanceof Error ? e.message : String(e)}`)
//         }
//       } else {
//         log("Workerの初期化に失敗しました")
//       }
//     } catch (error) {
//       log(`Worker初期化エラー: ${error instanceof Error ? error.message : String(error)}`)
//     }
//   }

//   // ジョブ状態確認
//   const handleCheckJobStatus = async (jobId: string) => {
//     try {
//       log(`ジョブ状態確認: ${jobId}`)
//       const state = await getJobState(jobId)

//       if (state) {
//         log(`ジョブ状態: ${state.status}, 進捗: ${state.progress}%`)
//         log(`詳細: ${JSON.stringify(state)}`)
//       } else {
//         log(`ジョブ ${jobId} は存在しないか、アクセスできません`)
//       }
//     } catch (error) {
//       log(`ジョブ状態確認エラー: ${error instanceof Error ? error.message : String(error)}`)
//     }
//   }

//   // Workerの強制的な再作成によりID変更を確認
//   const handleForceWorkerRecreation = () => {
//     if (getWorker()) {
//       log("Workerを終了して新しいWorkerを作成します")
//       terminateWorker() // 既存のWorkerを終了

//       // 少し待ってから明示的にWorkerを初期化
//       setTimeout(() => {
//         initWorker() // getWorkerではなくinitWorkerを使用
//       }, 100)
//     } else {
//       // 存在しない場合は明示的に初期化
//       initWorker()
//       log("新しいWorkerを作成しました")
//     }
//   }

//   // カウンター整合性チェック
//   const handleCheckCounters = () => {
//     const activeWorkers = workerStatus === "アクティブ" ? 1 : 0
//     const expected = workerLifecycle.created
//     const actual = workerLifecycle.terminated + activeWorkers

//     // 各行を個別のログエントリとして追加
//     log(`カウンター整合性チェック結果:`)
//     log(`- 作成数: ${workerLifecycle.created}`)
//     log(`- 終了数: ${workerLifecycle.terminated}`)
//     log(`- 再利用数: ${workerLifecycle.reused}`)
//     log(`- 現在のWorker: ${activeWorkers ? "あり" : "なし"}`)
//     log(`- 期待値: 作成(${expected}) = 終了(${workerLifecycle.terminated}) + 現在(${activeWorkers})`)
//     log(`- 検証結果: ${expected === actual ? "✓ 一致" : "✗ 不一致"}`)

//     console.log("検証結果:", expected === actual ? "✓ 一致" : "✗ 不一致") // デバッグ用コンソール出力も追加
//   }

//   // UIレンダリング
//   return (
//     <div className="mx-auto max-w-6xl p-8">
//       <h1 className="mb-4 text-2xl font-bold">Web Worker デモ (v3)</h1>
//       <p className="mb-6 text-gray-600">
//         高度なWorker管理機能を使った統合デモ（ローカル・リモートジョブ、ライフサイクル管理）
//       </p>

//       <div className="mb-6 flex flex-col gap-4 md:flex-row">
//         {/* 左パネル */}
//         <div className="min-w-0 flex-1">
//           {/* ジョブ実行 */}
//           <div className="mb-6 rounded-lg border bg-white p-4 shadow-sm">
//             <h2 className="mb-3 text-xl font-semibold">ジョブ実行</h2>
//             {/* モード選択 */}
//             <div className="mb-4">
//               <h3 className="mb-2 font-medium">モード選択:</h3>
//               <div className="flex space-x-3">
//                 <label className="flex items-center">
//                   <input
//                     type="radio"
//                     name="mode"
//                     value="local"
//                     checked={mode === "local"}
//                     onChange={() => setMode("local")}
//                     className="mr-1"
//                   />
//                   ローカル
//                 </label>
//                 <label className="flex items-center">
//                   <input
//                     type="radio"
//                     name="mode"
//                     value="remote"
//                     checked={mode === "remote"}
//                     onChange={() => setMode("remote")}
//                     className="mr-1"
//                   />
//                   リモート
//                 </label>
//               </div>
//               <p className="mt-1 text-xs text-gray-500">
//                 {mode === "local"
//                   ? "※ローカルモード: 計算はブラウザ内で実行されます"
//                   : "※リモートモード: 計算はバックエンドAPIで実行されます"}
//               </p>
//             </div>

//             {/* 計算タイプとパラメータ */}
//             <div className="mb-4">
//               <h3 className="mb-2 font-medium">計算設定:</h3>
//               <div className="mb-3 grid grid-cols-2 gap-3">
//                 <div>
//                   <label className="mb-1 block text-sm">計算タイプ:</label>
//                   <select
//                     value={calculationType}
//                     onChange={(e) => setCalculationType(e.target.value)}
//                     className="w-full rounded border p-2"
//                   >
//                     <option value="fibonacci">フィボナッチ数</option>
//                     <option value="factorial">階乗</option>
//                     <option value="prime">素数判定</option>
//                     <option value="delayDemo">進捗デモ</option>
//                   </select>
//                 </div>
//                 <div>
//                   <label className="mb-1 block text-sm">値:</label>
//                   <input
//                     type="number"
//                     value={input}
//                     onChange={(e) => setInput(e.target.value)}
//                     className="w-full rounded border p-2"
//                   />
//                 </div>
//               </div>
//             </div>

//             {/* 実行ボタン */}
//             <div className="mb-4 flex space-x-2">
//               <button
//                 onClick={handleExecuteJob}
//                 disabled={isRunning}
//                 className="flex-1 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400"
//               >
//                 {isRunning ? "実行中..." : "実行開始"}
//               </button>
//               <button
//                 onClick={handleAbortJob}
//                 disabled={!isRunning}
//                 className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:bg-gray-400"
//               >
//                 中止
//               </button>
//             </div>

//             {/* 進捗バー */}
//             {isRunning && (
//               <div className="mb-4">
//                 <div className="mb-1 flex justify-between text-xs">
//                   <span>進捗状況</span>
//                   <span>{progress}%</span>
//                 </div>
//                 <div className="h-2 w-full rounded-full bg-gray-200">
//                   <div
//                     className="h-2 rounded-full bg-blue-600 transition-all duration-100"
//                     style={{ width: `${progress}%` }}
//                   />
//                 </div>
//               </div>
//             )}

//             {/* 最新の結果 */}
//             {lastResult && (
//               <div
//                 className={`mb-4 rounded p-3 ${
//                   lastResult.status === "completed"
//                     ? "border border-green-200 bg-green-100"
//                     : lastResult.status === "failed"
//                       ? "border border-red-200 bg-red-100"
//                       : "border border-yellow-200 bg-yellow-100"
//                 }`}
//               >
//                 <h3 className="mb-1 font-medium">最新の結果:</h3>
//                 <div className="truncate text-sm">
//                   <p>
//                     <span className="font-medium">状態:</span> {lastResult.status}
//                   </p>
//                   {lastResult.data !== null && (
//                     <p>
//                       <span className="font-medium">結果:</span> {String(lastResult.data)}
//                     </p>
//                   )}
//                   {lastResult.error && (
//                     <p>
//                       <span className="font-medium">エラー:</span> {lastResult.error.message}
//                     </p>
//                   )}
//                   <p>
//                     <span className="font-medium">所要時間:</span> {lastResult.duration.toFixed(1)}ms
//                   </p>
//                   <p>
//                     <span className="font-medium">ジョブID:</span> {lastResult.jobId}
//                   </p>
//                 </div>
//               </div>
//             )}
//           </div>

//           {/* ログパネル */}
//           <div className="mb-6 rounded-lg border bg-white p-4 shadow-sm">
//             <div className="mb-3 flex items-center justify-between">
//               <h2 className="text-xl font-semibold">実行ログ</h2>
//               <button
//                 onClick={() => setOutput([])}
//                 className="rounded bg-gray-200 px-3 py-1 text-sm text-gray-700 hover:bg-gray-300"
//               >
//                 クリア
//               </button>
//             </div>
//             <div className="h-64 overflow-y-auto rounded border bg-gray-50 p-3 font-mono text-sm">
//               {output.length === 0 ? (
//                 <p className="text-gray-400">ログはまだありません</p>
//               ) : (
//                 output.map((message, index) => (
//                   <div key={index} className="mb-1 text-xs">
//                     {message}
//                   </div>
//                 ))
//               )}
//             </div>
//           </div>
//         </div>

//         {/* 右パネル: Worker制御 */}
//         <div className="min-w-0 flex-1 rounded-lg border bg-white p-4 shadow-sm">
//           <h2 className="mb-3 text-xl font-semibold">Worker制御</h2>

//           {/* Worker状態 */}
//           <div className="mb-4 rounded border bg-gray-50 p-3">
//             <h3 className="mb-2 font-medium">Worker状態:</h3>
//             <div className="grid grid-cols-2 gap-y-2 text-sm">
//               <div>Worker状態:</div>
//               <div className={workerStatus === "アクティブ" ? "font-medium text-green-600" : "text-red-600"}>
//                 {workerStatus}
//               </div>

//               <div>Worker ID:</div>
//               <div className="break-all font-mono text-xs">{workerIdRef.current || workerId || "なし"}</div>

//               <div>モード:</div>
//               <div>{workerMode}</div>

//               <div>終了設定:</div>
//               <div>{terminateAfterJob ? "ジョブ後に終了" : "終了しない"}</div>

//               <div>保留中ジョブ:</div>
//               <div>
//                 {hookPendingJobs?.length || 0}件
//                 {hookPendingJobs && hookPendingJobs.length > 0 && (
//                   <button
//                     onClick={() => log(`保留中ジョブID: ${hookPendingJobs.map((j) => j.jobId).join(", ")}`)}
//                     className="ml-2 text-xs text-blue-600 hover:underline"
//                   >
//                     詳細
//                   </button>
//                 )}
//               </div>
//             </div>
//           </div>

//           {/* Worker制御ボタン */}
//           <div className="mb-4">
//             <h3 className="mb-2 font-medium">Worker操作:</h3>
//             <div className="flex flex-wrap gap-2">
//               <button
//                 onClick={handleInitWorker}
//                 disabled={workerStatus === "アクティブ"}
//                 className="rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:bg-gray-300"
//               >
//                 Worker初期化
//               </button>
//               <button
//                 onClick={terminateWorker}
//                 disabled={workerStatus !== "アクティブ"}
//                 className="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:bg-gray-300"
//               >
//                 Worker終了
//               </button>
//               <button
//                 onClick={handleForceWorkerRecreation}
//                 className="rounded bg-purple-600 px-3 py-1.5 text-sm text-white hover:bg-purple-700"
//               >
//                 Worker再作成
//               </button>
//               <button
//                 onClick={handleCheckCounters}
//                 className="rounded bg-gray-600 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
//               >
//                 カウンター検証
//               </button>
//             </div>
//           </div>

//           {/* Workerライフサイクル設定 */}
//           <div className="mb-4">
//             <h3 className="mb-2 font-medium">ライフサイクル設定:</h3>
//             <label className="mb-2 flex items-center">
//               <input
//                 type="checkbox"
//                 checked={terminateAfterJob}
//                 onChange={(e) => setTerminateAfterJob(e.target.checked)}
//                 className="mr-2"
//               />
//               <span>ジョブ完了後にWorkerを終了する</span>
//             </label>
//             <p className="text-xs text-gray-500">
//               {terminateAfterJob
//                 ? "現在の設定: ジョブ完了後にWorkerは自動的に終了します。次回実行時に新しいWorkerが作成されます。"
//                 : "現在の設定: Workerは維持され、複数のジョブで再利用されます。メモリ効率は低下しますが、初期化コストが節約されます。"}
//             </p>
//           </div>

//           {/* ライフサイクル統計 */}
//           <div className="mb-4 rounded border bg-gray-50 p-3">
//             <h3 className="mb-2 font-medium">ライフサイクル統計:</h3>
//             <div className="grid grid-cols-2 gap-y-1 text-sm">
//               <div>作成回数:</div>
//               <div className="font-mono">{workerLifecycle.created}</div>

//               <div>終了回数:</div>
//               <div className="font-mono">{workerLifecycle.terminated}</div>

//               <div>再利用回数:</div>
//               <div className="font-mono">{workerLifecycle.reused}</div>
//             </div>
//           </div>

//           {/* カスタムメッセージ送信 */}
//           <div className="mb-4">
//             <h3 className="mb-2 font-medium">カスタムメッセージ:</h3>

//             {/* テンプレート選択ボタン */}
//             <div className="mb-3 flex flex-wrap gap-2">
//               <button
//                 onClick={() => setCustomMessage('{ "type": "PING" }')}
//                 className="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200"
//               >
//                 PING
//               </button>
//               <button
//                 onClick={() => setCustomMessage('{ "type": "GET_ID" }')}
//                 className="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200"
//               >
//                 ID取得
//               </button>
//               <button
//                 onClick={() => setCustomMessage('{ "type": "CONFIG", "payload": { "debug": true } }')}
//                 className="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200"
//               >
//                 設定更新
//               </button>
//               {isRemoteMode && (
//                 <>
//                   <button
//                     onClick={() =>
//                       setCustomMessage(
//                         JSON.stringify(
//                           {
//                             type: "API_JOB",
//                             payload: { type: "delayDemo", n: 5 },
//                             jobId: `api_${Date.now()}`,
//                             options: { pollInterval: 500 },
//                           },
//                           null,
//                           2,
//                         ),
//                       )
//                     }
//                     className="rounded bg-blue-100 px-2 py-1 text-xs hover:bg-blue-200"
//                   >
//                     APIジョブ
//                   </button>
//                   <button
//                     onClick={() =>
//                       setCustomMessage(
//                         JSON.stringify(
//                           {
//                             type: "PREFLIGHT_CHECK",
//                             payload: { jobId: jobIdRef.current || "all" },
//                           },
//                           null,
//                           2,
//                         ),
//                       )
//                     }
//                     className="rounded bg-blue-100 px-2 py-1 text-xs hover:bg-blue-200"
//                   >
//                     ジョブ確認
//                   </button>
//                 </>
//               )}
//             </div>

//             <textarea
//               value={customMessage}
//               onChange={(e) => setCustomMessage(e.target.value)}
//               className="mb-2 w-full rounded border p-2 font-mono text-sm"
//               rows={3}
//             />

//             <div className="mb-2 text-xs text-gray-500">
//               <p>※メッセージはWorkerに直接送信されます。有効なJSON形式である必要があります。</p>
//               <p>
//                 ※Workerの状態:{" "}
//                 <span className={workerStatus === "アクティブ" ? "font-medium text-green-600" : "text-red-600"}>
//                   {workerStatus}
//                 </span>
//               </p>
//             </div>

//             <button
//               onClick={handleSendCustomMessage}
//               className="w-full rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:bg-gray-400"
//               disabled={workerStatus !== "アクティブ"}
//             >
//               メッセージ送信 {workerStatus !== "アクティブ" && "（Workerが必要です）"}
//             </button>
//           </div>
//         </div>
//       </div>

//       {/* 結果履歴 */}
//       {resultHistory.length > 0 && (
//         <div className="mb-6 rounded-lg border bg-white p-4 shadow-sm">
//           <div className="mb-3 flex items-center justify-between">
//             <h2 className="text-xl font-semibold">結果履歴</h2>
//             <button
//               onClick={() => setResultHistory([])}
//               className="rounded bg-gray-200 px-3 py-1 text-sm text-gray-700 hover:bg-gray-300"
//             >
//               クリア
//             </button>
//           </div>
//           <div className="overflow-x-auto">
//             <table className="min-w-full">
//               <thead className="border-b bg-gray-50">
//                 <tr>
//                   <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">ジョブID</th>
//                   <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">ステータス</th>
//                   <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">タイプ</th>
//                   <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">結果</th>
//                   <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">時間(ms)</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {resultHistory.map((result, index) => (
//                   <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
//                     <td className="px-3 py-2 font-mono text-xs">{result.jobId.slice(-8)}</td>
//                     <td className="px-3 py-2 text-xs">
//                       <span
//                         className={`rounded-full px-2 py-0.5 text-xs ${
//                           result.status === "completed"
//                             ? "bg-green-100 text-green-800"
//                             : result.status === "failed"
//                               ? "bg-red-100 text-red-800"
//                               : "bg-yellow-100 text-yellow-800"
//                         }`}
//                       >
//                         {result.status}
//                       </span>
//                     </td>
//                     <td className="px-3 py-2 text-xs">{result.metadata?.calculationType || "-"}</td>
//                     <td className="px-3 py-2 font-mono text-xs">
//                       {result.data !== null
//                         ? String(result.data).slice(0, 20)
//                         : result.error
//                           ? result.error.message.slice(0, 20)
//                           : "-"}
//                     </td>
//                     <td className="px-3 py-2 text-xs">{result.duration.toFixed(1)}</td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         </div>
//       )}

//       {/* リモートジョブ情報パネル（リモートモードのみ） */}
//       {mode === "remote" && (
//         <div className="mb-6 rounded-lg border bg-white p-4 shadow-sm">
//           <h2 className="mb-3 text-xl font-semibold">保留中のリモートジョブ ({pendingJobs.length}件)</h2>
//           <p className="mb-3 text-sm text-gray-600">
//             これらのジョブは
//             <code className="mx-1 rounded bg-gray-100 px-1">hookPendingJobs</code>
//             から取得されたリモート実行中または保留中のジョブです。リモートモードで実行されたジョブは、
//             ページの再読み込み後も状態が維持されます。
//           </p>

//           {pendingJobs.length === 0 ? (
//             <div>
//               <p className="mb-4 text-sm text-gray-500">現在、保留中または実行中のリモートジョブはありません</p>
//               <button
//                 onClick={async () => {
//                   if (!getWorker()) {
//                     log("Workerを初期化します")
//                     initWorker()

//                     // Workerが初期化されるまで少し待機
//                     await new Promise((resolve) => setTimeout(resolve, 100))
//                   }

//                   // テストジョブ用のメッセージを作成
//                   const jobId = `api_test_${Date.now()}`
//                   const apiJobMsg = {
//                     type: "API_JOB",
//                     payload: {
//                       type: "delayDemo",
//                       n: 10,
//                     },
//                     jobId: jobId,
//                     options: { pollInterval: 500 },
//                   }

//                   try {
//                     log(`APIジョブ送信: ${jobId}`)

//                     // localStorageにも直接ジョブを保存（表示のバックアップとして）
//                     try {
//                       const testJob = {
//                         jobId,
//                         status: "pending",
//                         progress: 0,
//                         startTime: Date.now(),
//                         lastUpdated: Date.now(),
//                         metadata: {
//                           mode: "remote",
//                           calculationType: "delayDemo",
//                         },
//                       }
//                       localStorage.setItem(`job_${jobId}`, JSON.stringify(testJob))
//                     } catch (e) {}

//                     const response = await sendDirectMessage(apiJobMsg)
//                     log(`API応答: ${JSON.stringify(response)}`)

//                     // 強制的にジョブ一覧を更新
//                     if (checkRemoteJobStatus) {
//                       setTimeout(async () => {
//                         const jobs = await checkRemoteJobStatus("all")
//                         if (Array.isArray(jobs) && jobs.length > 0) {
//                           setPendingJobs(jobs)
//                           log(`${jobs.length}件のジョブを更新しました`)
//                         }
//                       }, 500)
//                     }
//                   } catch (error) {
//                     log(`エラー: ${error instanceof Error ? error.message : String(error)}`)
//                   }
//                 }}
//                 className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
//               >
//                 テストリモートジョブ作成
//               </button>
//             </div>
//           ) : (
//             <div className="overflow-x-auto">
//               <table className="min-w-full">
//                 <thead className="border-b bg-gray-50">
//                   <tr>
//                     <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">ジョブID</th>
//                     <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">状態</th>
//                     <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">進捗</th>
//                     <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">開始時間</th>
//                     <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">操作</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {pendingJobs.map((job, index) => (
//                     <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
//                       <td className="px-3 py-2 font-mono text-xs">
//                         {job.jobId}
//                         <div className="mt-1 text-xs text-gray-500">
//                           タイプ: {job.metadata?.calculationType || job.type || "不明"}
//                         </div>
//                       </td>
//                       <td className="px-3 py-2 text-xs">
//                         <span
//                           className={`rounded-full px-2 py-0.5 text-xs ${
//                             job.status === "completed"
//                               ? "bg-green-100 text-green-800"
//                               : job.status === "failed"
//                                 ? "bg-red-100 text-red-800"
//                                 : job.status === "running"
//                                   ? "bg-blue-100 text-blue-800"
//                                   : "bg-yellow-100 text-yellow-800"
//                           }`}
//                         >
//                           {job.status}
//                         </span>
//                       </td>
//                       <td className="px-3 py-2 text-xs">
//                         <div className="mb-1 h-1.5 w-full rounded-full bg-gray-200">
//                           <div className="h-1.5 rounded-full bg-blue-600" style={{ width: `${job.progress}%` }} />
//                         </div>
//                         {job.progress}%
//                       </td>
//                       <td className="px-3 py-2 text-xs">
//                         {new Date(job.startTime).toLocaleString()}
//                         <div className="mt-1 text-xs text-gray-500">
//                           最終更新: {new Date(job.lastUpdated).toLocaleTimeString()}
//                         </div>
//                       </td>
//                       <td className="space-x-2 px-3 py-2 text-xs">
//                         <button
//                           onClick={() => handleCheckJobStatus(job.jobId)}
//                           className="rounded bg-blue-100 px-2 py-1 text-blue-700 hover:bg-blue-200"
//                         >
//                           確認
//                         </button>
//                         <button
//                           onClick={() => handleTerminateRemoteJob(job.jobId)}
//                           className="rounded bg-red-100 px-2 py-1 text-red-700 hover:bg-red-200"
//                         >
//                           終了
//                         </button>
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           )}
//         </div>
//       )}

//       {/* APIリファレンス */}
//       <div className="rounded-lg border bg-white p-4 shadow-sm">
//         <h2 className="mb-3 text-xl font-semibold">useWebWorker APIリファレンス</h2>
//         <div className="mb-4">
//           <h3 className="mb-2 font-medium">主要API:</h3>
//           <ul className="list-disc space-y-1 pl-5 text-sm">
//             <li>
//               <code className="rounded bg-gray-100 px-1 py-0.5">executeJob</code> - ジョブを実行し結果を待機
//             </li>
//             <li>
//               <code className="rounded bg-gray-100 px-1 py-0.5">abortJob</code> - 特定のジョブまたは全ジョブを中止
//             </li>
//             <li>
//               <code className="rounded bg-gray-100 px-1 py-0.5">getJobState</code> - ジョブ状態を確認
//             </li>
//           </ul>
//         </div>
//         <div className="mb-4">
//           <h3 className="mb-2 font-medium">状態・設定:</h3>
//           <ul className="list-disc space-y-1 pl-5 text-sm">
//             <li>
//               <code className="rounded bg-gray-100 px-1 py-0.5">isRunning</code> - 現在ジョブが実行中かどうか
//             </li>
//             <li>
//               <code className="rounded bg-gray-100 px-1 py-0.5">lastResult</code> - 最後のジョブ実行結果
//             </li>
//             <li>
//               <code className="rounded bg-gray-100 px-1 py-0.5">terminateAfterJob</code> -
//               ジョブ完了後にWorker終了するか
//             </li>
//             <li>
//               <code className="rounded bg-gray-100 px-1 py-0.5">setTerminateAfterJob</code> - 終了設定を変更
//             </li>
//           </ul>
//         </div>
//         <div>
//           <h3 className="mb-2 font-medium">低レベルAPI:</h3>
//           <ul className="list-disc space-y-1 pl-5 text-sm">
//             <li>
//               <code className="rounded bg-gray-100 px-1 py-0.5">getWorker</code> - Worker参照を取得（なければ作成）
//             </li>
//             <li>
//               <code className="rounded bg-gray-100 px-1 py-0.5">terminateWorker</code> - Workerを明示的に終了
//             </li>
//             <li>
//               <code className="rounded bg-gray-100 px-1 py-0.5">sendDirectMessage</code> - 低レベル通信メッセージ
//             </li>
//             <li>
//               <code className="rounded bg-gray-100 px-1 py-0.5">isLocalMode/isRemoteMode</code> - 現在のモード確認
//             </li>
//           </ul>
//         </div>
//       </div>
//     </div>
//   )
// }
