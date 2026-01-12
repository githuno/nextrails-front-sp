"use client"

import { Toaster, toast, toastStore } from "@/components/atoms/Toast"
import { useSyncExternalStore } from "react"

export default function ToastDemoPage() {
  const { expanded } = useSyncExternalStore(toastStore.subscribe, toastStore.getSnapshot, toastStore.getServerSnapshot)

  const handlePromise = () => {
    toast.promise(
      new Promise<{ name: string }>((resolve, reject) => {
        setTimeout(
          () => (Math.random() > 0.3 ? resolve({ name: "Demo User" }) : reject(new Error("Network Fail"))),
          2000,
        )
      }),
      {
        loading: "Saving profile...",
        success: (data) => `Welcome, ${data.name}!`,
        error: (err: unknown) => `Oops: ${err instanceof Error ? err.message : "Unknown error"}`,
      },
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50 px-6 py-12 font-sans text-neutral-900 md:px-12">
      <div className="mx-auto max-w-3xl space-y-16">
        <header className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[12px] font-bold tracking-widest text-emerald-600 uppercase">
            React 19 + Tailwind 4
          </div>
          <h1 className="text-5xl font-black tracking-tight text-neutral-950 sm:text-6xl">
            <span className="text-emerald-500">Toast System</span>
          </h1>
          <p className="max-w-xl text-xl leading-relaxed text-neutral-600">
            状態管理、動的スタック、自動管理タイマーを備える
            <br />
            ポータブルな通知システム
          </p>
        </header>

        {/* --- NEW: Stacking Logic Explained --- */}
        <section className="space-y-6 rounded-3xl border-2 border-dashed border-emerald-200 bg-emerald-50/30 p-8">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-sm font-bold tracking-widest text-emerald-600 uppercase">
              Stack Logic Monitor
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-600 uppercase">現在のモード:</span>
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase ${expanded ? "bg-emerald-500 text-white" : "bg-neutral-200 text-neutral-600"}`}
              >
                {expanded ? "List (Expanded)" : "Stack (Collapsed)"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-neutral-900">1. Collapsed (Stack)</h3>
              <p className="text-xs leading-relaxed font-medium text-neutral-500">
                デフォルト状態。トーストは同じ位置に軽いオフセット (10px) とスケール (5%) で重ねられ、奥行きを示す。
              </p>
              <code className="block rounded-lg border border-emerald-100 bg-white p-2 text-[10px] text-emerald-700 shadow-sm">
                transform: translateY(index * -10px) scale(1 - index * 0.05)
              </code>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-neutral-900">2. Expanded (List)</h3>
              <p className="text-xs leading-relaxed font-medium text-neutral-500">
                <span className="font-bold text-neutral-900">ホバー</span> または{" "}
                <span className="font-bold text-neutral-900">タッチ</span>{" "}
                でトリガー。下のトーストの実高さに基づいて上へシフト。
              </p>
              <code className="block rounded-lg border border-emerald-100 bg-white p-2 text-[10px] text-emerald-700 shadow-sm">
                transform: translateY(前の高さの合計 * -1)
              </code>
            </div>
          </div>

          <div className="flex gap-2 border-t border-emerald-100 pt-6">
            <button
              type="button"
              onMouseEnter={() => toastStore.setExpanded(true)}
              onMouseLeave={() => toastStore.setExpanded(false)}
              className="flex-1 rounded-xl border border-emerald-200 bg-white py-3 text-xs font-bold text-emerald-700 shadow-sm transition-all hover:bg-emerald-50 active:scale-95"
            >
              Hover to Peek List Mode
            </button>
            <button
              type="button"
              onClick={() => toastStore.setExpanded(!expanded)}
              className="flex-1 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-lg shadow-emerald-200 transition-all hover:bg-emerald-700 active:scale-95"
            >
              {expanded ? "Collapse Toasts" : "Expand Permanently"}
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="space-y-8 rounded-3xl border border-neutral-200 bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <h2 className="font-mono text-lg font-bold tracking-tight text-neutral-400 uppercase">Interactive Lab</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() =>
                  toast.success("Success", {
                    description: "クラスター間でデータが同期されました",
                  })
                }
                className="flex h-12 items-center justify-center rounded-xl bg-neutral-900 font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Success
              </button>
              <button
                type="button"
                onClick={() =>
                  toast.error("System Fault", {
                    description: "/dev/sdc1 への書き込み権限が拒否されました。",
                  })
                }
                className="flex h-12 scale-[1.02] items-center justify-center rounded-xl border border-neutral-200 font-semibold transition-all hover:bg-neutral-50 active:scale-[0.98]"
              >
                Error
              </button>
              <button
                type="button"
                onClick={handlePromise}
                className="col-span-2 flex h-12 scale-[1.02] items-center justify-center rounded-xl bg-emerald-500 font-bold text-white shadow-lg shadow-emerald-200 transition-all hover:bg-emerald-600 active:scale-[0.98]"
              >
                Promise API を実行
              </button>
              <button
                type="button"
                onClick={() =>
                  toast("Stack Me!", {
                    duration: Infinity,
                    description: "複数回押して重なりを確認。",
                  })
                }
                className="col-span-2 flex h-12 scale-[1.02] items-center justify-center rounded-xl border border-neutral-200 font-semibold transition-all hover:bg-neutral-50 active:scale-[0.98]"
              >
                Infinite Stack
              </button>
            </div>

            <div className="border-t border-neutral-100 pt-4">
              <button
                type="button"
                onClick={() => toast.dismissAll()}
                className="w-full text-sm font-medium text-neutral-400 transition-colors hover:text-red-500"
              >
                すべてのアクティブ通知をクリア
              </button>
            </div>
          </div>

          <div className="flex flex-col justify-center space-y-8">
            <h2 className="font-mono text-lg font-bold tracking-tight text-neutral-400 uppercase">Physical Logic</h2>
            <ul className="cursor-default space-y-5">
              {[
                {
                  title: "Mobile Swipe",
                  desc: "タッチデバイスで右にスワイプして個別の通知を解除。",
                  icon: "M13 5l7 7-7 7M5 5l7 7-7 7",
                },
                {
                  title: "Focus Smart Pause",
                  desc: "タブが非表示またはウィンドウがぼやけたときにタイマーが自動停止。",
                  icon: "M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z",
                },
                {
                  title: "Portal Architecture",
                  desc: "body ルートでレンダリング。親のレイアウトオーバーフローや z-index に影響されない。",
                  icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
                },
                {
                  title: "Keyboard Zen",
                  desc: "<kbd class='mx-1 bg-neutral-100 border rounded px-1 text-[10px]'>Esc</kbd> を押してすべてのトーストを瞬時に消去。",
                  icon: "M15 7L9 13l-3-3",
                },
              ].map((f, i) => (
                <li key={i} className="group flex gap-4">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d={f.icon} />
                    </svg>
                  </div>
                  <div>
                    <h4 className="leading-none font-bold text-neutral-900">{f.title}</h4>
                    <p className="mt-1 text-sm leading-tight font-medium text-neutral-500">{f.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <footer className="border-t border-neutral-200 py-12 text-center">
          <p className="text-sm font-bold tracking-[0.2em] text-neutral-400 uppercase">Hono Toast Demo</p>
        </footer>
      </div>

      <Toaster />
    </div>
  )
}
