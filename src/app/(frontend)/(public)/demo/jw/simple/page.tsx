"use client"
import { useWebWorker } from "@/hooks/useWorker"
import { useState } from "react"

/**
 * useWebWorkerの基本的な使用例
 *
 * このコンポーネントは:
 * 1. 指定したWEBワーカーを使って数値の計算を行う
 * 2. ボタンクリックで計算を実行する
 * 3. 進捗状況と結果を表示する
 */
const SimpleJobWorkerDemo = () => {
  // 計算結果を格納する状態
  const [result, setResult] = useState<number | null>(null)

  // useWebWorkerフックの初期化（基本的な設定のみ）
  const { executeJob, isRunning, lastResult } = useWebWorker({
    // ワーカースクリプトのパス
    scriptUrl: "/workers/generic-worker.js",
    // デバッグログを有効化（開発時のみ）
    debug: true,
    // ジョブ後にワーカーを保持（複数回の計算を効率的に行うため）
    terminateAfterJob: false,
  })

  // 計算実行ボタンのクリックハンドラー
  const handleCalculate = async () => {
    // 実行前に状態をリセット
    setResult(null)

    try {
      console.log("計算開始...")

      // 正しいパラメータ名でワーカーに送信（`a` ではなく `n`）
      const jobResult = await executeJob({
        payload: {
          type: "fibonacci",
          n: 40, // 80は大きすぎるので40に変更（計算が速くなります）
        },
        enableProgress: true,
      })

      console.log("計算完了:", jobResult)

      // ワーカーが直接結果を返すので、data自体が結果値になります
      if (jobResult.data !== null) {
        setResult(jobResult.data)
      } else {
        console.error("計算結果がありません")
      }
    } catch (error) {
      console.error("計算エラー:", error)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center pt-[120px]">
      <h2 className="text-xl font-bold">シンプルなワーカー計算</h2>
      <div className="mt-2 text-gray-600">フィボナッチ数列 n=40 の計算</div>

      <button
        onClick={handleCalculate}
        disabled={isRunning}
        className={`mt-4 rounded p-2 px-4 text-white ${isRunning ? "bg-gray-400" : "bg-blue-500 hover:bg-blue-700"}`}
      >
        {isRunning ? "計算中..." : "計算実行"}
      </button>

      {/* 進捗バー */}
      {isRunning && (
        <div className="mt-4 w-64">
          <div className="mb-1 text-center">進捗: {lastResult?.progress || 0}%</div>
          <div className="h-2.5 w-full rounded-full bg-gray-200">
            <div
              className="h-2.5 rounded-full bg-blue-600 transition-all duration-300"
              style={{ width: `${lastResult?.progress || 0}%` }}
            />
          </div>
        </div>
      )}

      {/* 結果表示 */}
      {result !== null && (
        <div className="mt-4 max-w-md rounded border border-green-200 bg-green-50 p-4">
          <p className="font-medium">
            計算結果: <span className="text-green-700">{result.toLocaleString()}</span>
          </p>
          {lastResult && <p className="mt-1 text-sm text-gray-500">処理時間: {lastResult.duration.toFixed(0)}ms</p>}
        </div>
      )}

      {/* エラー表示 */}
      {lastResult?.error && (
        <div className="mt-4 rounded border border-red-200 bg-red-50 p-4">
          <p className="text-red-700">エラー: {lastResult.error.message}</p>
        </div>
      )}

      {/* デバッグ情報 - 開発時のみ表示 */}
      {process.env.NODE_ENV === "development" && lastResult && (
        <div className="mt-8 rounded border border-gray-300 bg-gray-100 p-2 text-xs">
          <pre>{JSON.stringify(lastResult, null, 2)}</pre>
        </div>
      )}

      {/* 高機能ページへのリンク */}
      <div className="mt-6">
        <a href="/demo/jw" className="text-sm text-blue-600 hover:underline">
          詳細機能のデモページへ
        </a>
        <p className="mt-1 text-xs text-gray-500">
          ※詳細デモでは、useWebWorkerフックの全機能を体験できます。
          <br />
          進捗の監視や、エラー処理、ワーカーの管理などが含まれています。
          <br />
          さらに、ワーカーの状態を監視するためのカスタムフックも提供しています。
          <br />
          これにより、ワーカーの状態を簡単に管理できます。
          <br />
        </p>
      </div>
    </div>
  )
}

export default SimpleJobWorkerDemo
