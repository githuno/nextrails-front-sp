"use client"

import { Modal } from "@/components/atoms"
import { useActionState, useState, useTransition } from "react"

// 1. Legacy: 手動でローディング状態を管理
function ModalComponentLegacy() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleOpenModal = async () => {
    setIsLoading(true)
    // 非同期の準備処理（カメラチェック等をシミュレート）
    await new Promise((resolve) => setTimeout(resolve, 2000))

    setIsModalOpen(true)
    setIsLoading(false)
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      <button
        onClick={handleOpenModal}
        disabled={isLoading}
        className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isLoading ? "準備中..." : "モーダルを開く"}
      </button>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <div className="p-4">
          <h3 className="mb-2 text-lg font-semibold">Legacy Modal</h3>
          <p>手動で isLoading を管理しています。</p>
          <button
            onClick={() => setIsModalOpen(false)}
            className="mt-4 rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-700"
          >
            閉じる
          </button>
        </div>
      </Modal>
      <p className="text-xs font-bold text-red-500">× 2秒待たないと開かない</p>
    </div>
  )
}

// 2. useTransition: 非同期関数を直接 startTransition に渡す (React 19.2+)
function ModalComponentWithTransition() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleOpenModal = () => {
    // 1. まずモーダルを即座に開く（楽観的/先行的なUI更新）
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        setIsModalOpen(true)
      })
    } else {
      setIsModalOpen(true)
    }

    // 2. その後、バックグラウンドで重い処理を開始する
    startTransition(async () => {
      // 非同期の準備処理（カメラチェック、データフェッチ等）
      await new Promise((resolve) => setTimeout(resolve, 2000))
      // 完了後の状態更新（メッセージ変更など）
    })
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      <button onClick={handleOpenModal} className="rounded bg-green-500 px-4 py-2 text-white hover:bg-green-700">
        モーダルを開く
      </button>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <div className="p-4" style={{ viewTransitionName: "modal-content" }}>
          <h3 className="mb-2 text-lg font-semibold">useTransition Modal</h3>
          <p>{isPending ? "準備中（カメラ起動など）..." : "準備完了！"}</p>
          {isPending && (
            <div className="mt-2 flex items-center space-x-2 text-sm text-gray-500">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-green-500" />
              <span>バックグラウンドで処理中...</span>
            </div>
          )}
          <button
            onClick={() => setIsModalOpen(false)}
            className="mt-4 rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-700"
          >
            閉じる
          </button>
        </div>
      </Modal>
      <p className="text-xs font-bold text-green-600">◎ 即座に開き、中で待つ</p>
    </div>
  )
}

// 3. Action Props: form action に非同期関数を渡す
function ModalComponentWithActionProps() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Action function
  const openAction = async () => {
    // 1. まずモーダルを即座に開く
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        setIsModalOpen(true)
      })
    } else {
      setIsModalOpen(true)
    }

    // 2. その後、重い処理を実行
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  const [, submitAction, isPending] = useActionState(async () => {
    await openAction()
    return null
  }, null)

  return (
    <div className="flex flex-col items-center space-y-4">
      <form action={submitAction}>
        <button type="submit" className="rounded bg-purple-500 px-4 py-2 text-white hover:bg-purple-700">
          モーダルを開く
        </button>
      </form>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <div className="p-4" style={{ viewTransitionName: "modal-content" }}>
          <h3 className="mb-2 text-lg font-semibold">Action Props Modal</h3>
          <p>{isPending ? "準備中（Action実行中）..." : "準備完了！"}</p>
          {isPending && (
            <div className="mt-2 flex items-center space-x-2 text-sm text-gray-500">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-purple-500" />
              <span>Actionの完了を待機中...</span>
            </div>
          )}
          <button
            onClick={() => setIsModalOpen(false)}
            className="mt-4 rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-700"
          >
            閉じる
          </button>
        </div>
      </Modal>
      <p className="text-xs font-bold text-purple-600">◎ 宣言的なAction管理 + 即時応答</p>
    </div>
  )
}

export default function UseTransitionDemoPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-12">
      <h1 className="mb-8 text-4xl font-bold">React 19.2 Async Shift Demo</h1>

      <div className="mb-12 max-w-4xl text-center">
        <p className="text-lg text-gray-700">
          React 19.2 では、非同期処理を <strong>startTransition</strong> や <strong>Action Props</strong>{" "}
          に直接渡せるようになり、 手動のローディング状態管理が不要になりました。
        </p>
      </div>

      <div className="grid w-full max-w-7xl grid-cols-1 gap-8 md:grid-cols-3">
        {/* Legacy */}
        <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-bold text-gray-800">1. Legacy (Manual)</h2>
          <p className="mb-6 text-center text-sm text-gray-600">
            useState で isLoading を定義し、try-finally で制御する従来の手法。
          </p>
          <div className="flex flex-1 items-center justify-center">
            <ModalComponentLegacy />
          </div>
        </div>

        {/* useTransition */}
        <div className="flex flex-col items-center rounded-xl border border-green-200 bg-green-50 p-6 shadow-sm">
          <div className="mb-2 flex items-center space-x-2">
            <h2 className="text-xl font-bold text-green-800">2. useTransition</h2>
            <span className="rounded-full bg-green-200 px-2 py-0.5 text-[10px] font-bold text-green-700">
              + View Transition
            </span>
          </div>
          <p className="mb-6 text-center text-sm text-gray-600">
            startTransition に async 関数を渡し、isPending で UI を制御。 さらに View Transitions API
            でアニメーションを付与。
          </p>
          <div className="flex flex-1 items-center justify-center">
            <ModalComponentWithTransition />
          </div>
        </div>

        {/* Action Props */}
        <div className="flex flex-col items-center rounded-xl border border-purple-200 bg-purple-50 p-6 shadow-sm">
          <div className="mb-2 flex items-center space-x-2">
            <h2 className="text-xl font-bold text-purple-800">3. Action Props</h2>
            <span className="rounded-full bg-purple-200 px-2 py-0.5 text-[10px] font-bold text-purple-700">
              + View Transition
            </span>
          </div>
          <p className="mb-6 text-center text-sm text-gray-600">
            form の action プロパティに非同期関数を渡し、useActionState で状態管理。 Action内でも View Transition
            を適用。
          </p>
          <div className="flex flex-1 items-center justify-center">
            <ModalComponentWithActionProps />
          </div>
        </div>
      </div>

      <div className="mt-12 grid w-full max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-3 font-bold text-gray-800">View Transition なし (Legacy)</h3>
          <ul className="list-disc space-y-2 pl-5 text-sm text-gray-600">
            <li>状態が変わった瞬間に要素がパッと切り替わる。</li>
            <li>DOMの更新が即座に反映されるため、視覚的な連続性がない。</li>
            <li>ブラウザのデフォルトの挙動。</li>
          </ul>
        </div>
        <div className="rounded-lg border border-green-100 bg-green-50 p-6 shadow-sm">
          <h3 className="mb-3 font-bold text-green-800">View Transition あり (useTransition)</h3>
          <ul className="list-disc space-y-2 pl-5 text-sm text-gray-600">
            <li>新旧の状態でスクリーンショットを撮り、その間をクロスフェード等で補完する。</li>
            <li>
              <code>document.startViewTransition()</code> を使うことで、CSSのみで滑らかな遷移を実現。
            </li>
            <li>
              React 19の <code>useTransition</code> と組み合わせることで、非同期処理の完了に合わせた自然な演出が可能。
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-12 rounded-lg bg-gray-100 p-6 text-center">
        <p className="text-sm text-gray-600">
          ※ 各ボタンをクリックすると 2秒間の擬似的な非同期処理（カメラチェック等）が走ります。
          <br />
          <strong>useTransition</strong> と <strong>Action Props</strong> では、React
          が非同期処理のライフサイクルを自動的に追跡します。
        </p>
      </div>
    </main>
  )
}
