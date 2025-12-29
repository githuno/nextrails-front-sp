"use client"

import Link from "next/link"
import React, { useEffect, useMemo, useRef, useState } from "react"
import { BoundaryDemo } from "./BoundaryDemo"
import { MultiBoxesDemo } from "./MultiBoxesDemo"
import { SingleBoxDemo } from "./SingleBoxDemo"

// パフォーマンスモニタリング用
interface PerformanceMetrics {
  frameRate: number
  framesCount: number
  dragStartTime: number | null
  renderCount: number
  lastDragTime: number | null
  dragDuration: number | null
}

interface BoxPosition {
  id: string
  x: number
  y: number
  color: string
  size: number
  constraints?: "parent" | "window" | "custom" | "none"
  useRaf?: boolean
  debounceMs?: number
}

interface MetricsUpdater {
  onDragStart: () => void
  onDragEnd: () => void
}

const DndDemo: React.FC = () => {
  // タブ管理
  const [activeTab, setActiveTab] = useState<string>("basic")
  const [activeTechTab, setActiveTechTab] = useState<string>("performance")

  // デモの状態管理
  const [boxes, setBoxes] = useState<BoxPosition[]>([])
  const [boxCount, setBoxCount] = useState<number>(1)
  const [useRaf, setUseRaf] = useState<boolean>(true)
  const [debounceMs, setDebounceMs] = useState<number>(0)
  const [displayDebugInfo, setDisplayDebugInfo] = useState<boolean>(false)
  const [showTrail, setShowTrail] = useState<boolean>(false)
  const [selectedConstraint, setSelectedConstraint] = useState<string>("parent")
  const containerRef = useRef<HTMLDivElement>(null)

  // パフォーマンス計測用
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    frameRate: 0,
    framesCount: 0,
    dragStartTime: null,
    renderCount: 0,
    lastDragTime: null,
    dragDuration: null,
  })

  // メトリクス更新コールバックをメモ化
  const metricsUpdater = useMemo<MetricsUpdater>(
    () => ({
      onDragStart: () => {
        setPerformanceMetrics((prev) => ({
          ...prev,
          dragStartTime: performance.now(),
          lastDragTime: null,
          dragDuration: null,
        }))
      },
      onDragEnd: () => {
        setPerformanceMetrics((prev) => ({
          ...prev,
          lastDragTime: performance.now(),
          dragDuration: prev.dragStartTime ? performance.now() - prev.dragStartTime : null,
        }))
      },
    }),
    [],
  )

  // コードスニペット
  const codeExamples = {
    basic: `// 基本的な使用方法
const { ref, position, isDragging } = useDnd();

// JSX内で使用
<div
  ref={ref}
  style={{
    transform: \`translate(\${position.x}px, \${position.y}px)\`,
    cursor: isDragging ? 'grabbing' : 'grab',
    backgroundColor: isDragging ? 'lightblue' : 'lightgray',
  }}
>
  ドラッグできる要素
</div>`,
    options: `// 詳細なオプションを指定
const { ref, position, isDragging } = useDnd({
  // 初期位置
  initialPosition: { x: 100, y: 100 },
  
  // ドラッグ境界の設定
  boundaries: { 
    minX: 0, 
    maxX: 500, 
    minY: 0, 
    maxY: 500 
  },
  
  // パフォーマンス最適化
  useRaf: true,         // requestAnimationFrameを使用
  debounceMs: 16,       // 16ms (約60fps) のデバウンス
  
  // コールバック関数
  onDragStart: (pos, event) => console.log('ドラッグ開始:', pos),
  onDrag: (pos, event) => console.log('ドラッグ中:', pos),
  onDragEnd: (pos, event) => console.log('ドラッグ終了:', pos),
  
  // コンポーネントマウント時に自動的にドラッグを有効化
  enabled: true,
});`,
    api: `// すべてのAPIにアクセス
const {
  // 基本的なプロパティ
  ref,              // 要素参照
  position,         // 現在の位置
  isDragging,       // ドラッグ中かどうか
  
  // 追加の操作
  setPosition,      // 位置を手動で設定
  enable,           // ドラッグを有効化
  disable,          // ドラッグを無効化
} = useDnd(options);

// 手動で位置を設定
setPosition({ x: 200, y: 300 });

// ドラッグ機能の有効/無効を切り替え
const toggleDrag = () => {
  if (isDragging) {
    disable();
  } else {
    enable();
  }
};`,
  }

  // デモ用にボックスを生成
  useEffect(() => {
    generateBoxes(boxCount)
  }, [boxCount])

  // Boxジェネレーター
  const generateBoxes = (count: number) => {
    const containerWidth = containerRef.current?.clientWidth || 800
    const containerHeight = containerRef.current?.clientHeight || 600

    const colors = [
      "rgba(239, 68, 68, 1)", // red
      "rgba(59, 130, 246, 1)", // blue
      "rgba(16, 185, 129, 1)", // green
      "rgba(245, 158, 11, 1)", // amber
      "rgba(139, 92, 246, 1)", // purple
      "rgba(236, 72, 153, 1)", // pink
    ]

    const constraints = ["parent", "window", "custom", "none"]

    const newBoxes: BoxPosition[] = []

    for (let i = 0; i < count; i++) {
      const size = Math.floor(Math.random() * 60) + 60 // 60-120px

      newBoxes.push({
        id: `box-${i}`,
        x: Math.random() * (containerWidth - size),
        y: Math.random() * (containerHeight - size),
        color: colors[i % colors.length],
        size,
        constraints: constraints[i % constraints.length] as any,
        useRaf: i % 2 === 0 ? true : false,
        debounceMs: i % 3 === 0 ? 16 : 0,
      })
    }

    setBoxes(newBoxes)
  }

  // スニペットエリア
  const SnippetAreaComponent: React.FC = () => {
    // ローカルの状態を使用して親コンポーネントの再レンダリングの影響を減らす
    const [localTechTab, setLocalTechTab] = useState<string>(activeTechTab)

    // 親コンポーネントのactiveTechTabが変更されたら同期する
    useEffect(() => {
      setLocalTechTab(activeTechTab)
    }, [])
    // }, [activeTechTab]);

    // ローカル状態の変更を親に反映
    const handleTabChange = (tab: string) => {
      setLocalTechTab(tab)
      setActiveTechTab(tab)
    }

    return (
      <div className="rounded-lg border bg-gray-50 p-4">
        <div className="mb-3 flex space-x-2 border-b">
          <button
            onClick={() => handleTabChange("performance")}
            className={`px-3 py-2 text-sm ${
              localTechTab === "performance" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500"
            }`}
          >
            パフォーマンス最適化
          </button>
          <button
            onClick={() => handleTabChange("code")}
            className={`px-3 py-2 text-sm ${
              localTechTab === "code" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500"
            }`}
          >
            コード例
          </button>
        </div>

        {localTechTab === "performance" ? (
          <div>
            <h3 className="mb-3 font-medium">パフォーマンス最適化</h3>

            <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded border bg-white p-3">
                <h4 className="mb-2 text-sm font-medium">リアルタイムメトリクス</h4>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>FPS:</span>
                    <span
                      className={`font-mono ${
                        performanceMetrics.frameRate > 50
                          ? "text-green-600"
                          : performanceMetrics.frameRate > 30
                            ? "text-yellow-600"
                            : "text-red-600"
                      }`}
                    >
                      {performanceMetrics.frameRate}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>ドラッグ時間:</span>
                    <span className="font-mono">
                      {performanceMetrics.dragDuration ? `${performanceMetrics.dragDuration.toFixed(1)}ms` : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>レンダリング回数:</span>
                    <span className="font-mono">{performanceMetrics.renderCount}</span>
                  </div>
                </div>
              </div>

              <div className="rounded border bg-white p-3">
                <h4 className="mb-2 text-sm font-medium">最適化テクニック</h4>
                <div className="space-y-2">
                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={useRaf}
                        onChange={(e) => setUseRaf(e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm">requestAnimationFrameを使用</span>
                    </label>
                    <p className="ml-5 text-xs text-gray-500">複数の更新をブラウザのレンダリングサイクルに同期</p>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm">デバウンス遅延:</label>
                    <div className="flex items-center">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={debounceMs}
                        onChange={(e) => setDebounceMs(parseInt(e.target.value))}
                        className="w-32"
                      />
                      <span className="ml-2 text-sm">{debounceMs}ms</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {debounceMs === 0
                        ? "デバウンスなし (すべての更新を処理)"
                        : `${debounceMs}msのデバウンス (更新頻度を制限)`}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded border border-yellow-100 bg-yellow-50 p-3 text-sm text-gray-600">
              <p className="mb-1">
                <strong>パフォーマンス最適化のヒント:</strong>
              </p>
              <ul className="list-disc space-y-1 pl-5 text-xs">
                <li>複数の要素を扱う場合は、requestAnimationFrame (useRaf) を有効にする</li>
                <li>高頻度の更新が必要ない場合は、デバウンス (debounceMs) を使用する</li>
                <li>多数の要素をドラッグする場合、DOM操作を減らすためにCSSトランスフォームを使用</li>
                <li>ドラッグ中は不要な要素の更新を避ける</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="h-[340px] overflow-y-auto">
            <h3 className="mb-3 font-medium">使用例:</h3>

            <div className="mb-4">
              <h4 className="mb-1 text-sm font-medium">基本的な使用方法</h4>
              <pre className="overflow-x-auto rounded bg-gray-800 p-3 text-xs text-white">{codeExamples.basic}</pre>
            </div>

            <div className="mb-4">
              <h4 className="mb-1 text-sm font-medium">詳細オプション</h4>
              <pre className="overflow-x-auto rounded bg-gray-800 p-3 text-xs text-white">{codeExamples.options}</pre>
            </div>

            <div>
              <h4 className="mb-1 text-sm font-medium">API活用</h4>
              <pre className="overflow-x-auto rounded bg-gray-800 p-3 text-xs text-white">{codeExamples.api}</pre>
            </div>
          </div>
        )}
      </div>
    )
  }
  const SnippetArea = React.memo(SnippetAreaComponent)

  // ドラッグイベントコールバック - メトリクス更新用
  const handleDragStart = useMemo(
    () => () => {
      metricsUpdater.onDragStart()
    },
    [metricsUpdater],
  )

  const handleDrag = useMemo(
    () => () => {
      // ドラッグ中は特に処理なし
    },
    [],
  )

  const handleDragEnd = useMemo(
    () => () => {
      metricsUpdater.onDragEnd()
    },
    [metricsUpdater],
  )

  // FPS計測用のフレームカウンター
  useEffect(() => {
    let frameCount = 0
    let lastTime = performance.now()
    let rafId: number

    const measureFrameRate = () => {
      const currentTime = performance.now()
      const elapsed = currentTime - lastTime

      if (elapsed >= 1000) {
        // 1秒ごとにFPSを計算
        setPerformanceMetrics((prev) => ({
          ...prev,
          frameRate: Math.round((frameCount * 1000) / elapsed),
          framesCount: frameCount,
        }))
        frameCount = 0
        lastTime = currentTime
      }

      frameCount++
      rafId = requestAnimationFrame(measureFrameRate)
    }

    measureFrameRate()

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [])

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Drag and Drop デモ</h1>
        <Link href="/demo" className="rounded bg-gray-100 px-4 py-2 transition hover:bg-gray-200">
          デモ一覧に戻る
        </Link>
      </div>

      {/* 説明セクション */}
      <div className="mb-8 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h2 className="mb-2 text-lg font-semibold">useDndフックについて</h2>
        <p className="mb-2">
          このカスタムフックを使用すると、ReactコンポーネントでドラッグアンドドロップUXを実装できます。
          ドラッグ可能な要素に高いパフォーマンス、良好なユーザー体験、型安全性を提供します。
        </p>
        <ul className="ml-5 list-disc text-sm">
          <li>任意の要素にドラッグ機能を追加</li>
          <li>境界制約や移動範囲の制限</li>
          <li>ドラッグイベントのライフサイクル操作</li>
          <li>パフォーマンス最適化 (requestAnimationFrame, デバウンス)</li>
        </ul>
      </div>

      {/* タブナビゲーション */}
      <div className="mb-4">
        <div className="border-b">
          <ul className="-mb-px flex flex-wrap">
            <li className="mr-2">
              <button
                onClick={() => setActiveTab("basic")}
                className={`inline-block px-4 py-2 text-sm font-medium ${
                  activeTab === "basic"
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "border-b-2 border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                基本デモ
              </button>
            </li>
            <li className="mr-2">
              <button
                onClick={() => setActiveTab("multi")}
                className={`inline-block px-4 py-2 text-sm font-medium ${
                  activeTab === "multi"
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "border-b-2 border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                複数要素
              </button>
            </li>
            <li className="mr-2">
              <button
                onClick={() => setActiveTab("settings")}
                className={`inline-block px-4 py-2 text-sm font-medium ${
                  activeTab === "settings"
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "border-b-2 border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                移動範囲
              </button>
            </li>
          </ul>
        </div>
      </div>

      {/* メインセクション */}
      <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-2">
        {/* ドラッグエリア */}
        <div
          ref={containerRef}
          className="relative overflow-hidden rounded-lg border bg-gray-50"
          style={{ height: "400px" }}
        >
          {activeTab === "basic" && (
            <SingleBoxDemo
              containerRef={containerRef}
              useRaf={useRaf}
              debounceMs={debounceMs}
              selectedConstraint={selectedConstraint}
              metricsUpdater={metricsUpdater}
            />
          )}
          {activeTab === "multi" && (
            <MultiBoxesDemo
              boxes={boxes}
              containerRef={containerRef}
              showTrail={showTrail}
              displayDebugInfo={displayDebugInfo}
              onDragStart={handleDragStart}
              onDrag={handleDrag}
              onDragEnd={handleDragEnd}
            />
          )}
          {activeTab === "settings" && (
            <BoundaryDemo
              containerRef={containerRef}
              useRaf={useRaf}
              debounceMs={debounceMs}
              selectedConstraint={selectedConstraint}
              metricsUpdater={metricsUpdater}
            />
          )}

          {/* カスタム範囲の境界線表示 */}
          {activeTab === "settings" && selectedConstraint === "custom" && (
            <div
              className="pointer-events-none absolute border-2 border-dashed border-red-500 opacity-70"
              style={{
                left: "50px",
                top: "50px",
                width: "450px",
                height: "250px",
                zIndex: 5,
              }}
            />
          )}
        </div>

        {/* 制御パネル */}
        {activeTab === "basic" ? (
          <SnippetArea />
        ) : activeTab === "multi" ? (
          <div className="rounded-lg border p-4">
            <h3 className="mb-3 font-medium">複数要素設定</h3>

            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium">ボックス数: {boxCount}</label>
              <input
                type="range"
                min="1"
                max="50"
                value={boxCount}
                onChange={(e) => setBoxCount(parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="mb-4 space-y-2">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="trail"
                  checked={showTrail}
                  onChange={(e) => setShowTrail(e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="trail" className="text-sm">
                  ドラッグ軌跡を表示
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="debug"
                  checked={displayDebugInfo}
                  onChange={(e) => setDisplayDebugInfo(e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="debug" className="text-sm">
                  デバッグ情報を表示
                </label>
              </div>
            </div>

            <button
              onClick={() => generateBoxes(boxCount)}
              className="w-full rounded bg-blue-500 py-2 text-white transition hover:bg-blue-600"
            >
              ボックスを再生成
            </button>

            <div className="mt-4">
              <h4 className="mb-2 text-sm font-medium">パフォーマンス設定</h4>
              <div className="space-y-2">
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={useRaf}
                      onChange={(e) => setUseRaf(e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm">requestAnimationFrameを使用</span>
                  </label>
                </div>

                <div>
                  <label className="mb-1 block text-sm">デバウンス遅延:</label>
                  <div className="flex items-center">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={debounceMs}
                      onChange={(e) => setDebounceMs(parseInt(e.target.value))}
                      className="w-32"
                    />
                    <span className="ml-2 text-sm">{debounceMs}ms</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded bg-gray-100 p-3 text-sm text-gray-700">
              <h4 className="mb-1 font-medium">統計情報</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>現在のFPS:</div>
                <div className="font-mono">{performanceMetrics.frameRate}</div>
                <div>ボックス数:</div>
                <div className="font-mono">{boxes.length}</div>
                <div>レンダリング回数:</div>
                <div className="font-mono">{performanceMetrics.renderCount}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border p-4">
            <h3 className="mb-3 font-medium">移動範囲設定</h3>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">境界制約:</label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="constraint"
                      value="parent"
                      checked={selectedConstraint === "parent"}
                      onChange={() => setSelectedConstraint("parent")}
                      className="mr-2"
                    />
                    <span className="text-sm">親要素内に制限</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="constraint"
                      value="window"
                      checked={selectedConstraint === "window"}
                      onChange={() => setSelectedConstraint("window")}
                      className="mr-2"
                    />
                    <span className="text-sm">ウィンドウ内に制限</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="constraint"
                      value="custom"
                      checked={selectedConstraint === "custom"}
                      onChange={() => setSelectedConstraint("custom")}
                      className="mr-2"
                    />
                    <span className="text-sm">カスタム範囲 (点線の枠内)</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="constraint"
                      value="none"
                      checked={selectedConstraint === "none"}
                      onChange={() => setSelectedConstraint("none")}
                      className="mr-2"
                    />
                    <span className="text-sm">制限なし</span>
                  </label>
                </div>
              </div>

              <div className="rounded border border-yellow-100 bg-yellow-50 p-3 text-sm">
                <h4 className="mb-1 font-medium">境界設定の実装例:</h4>
                <pre className="overflow-x-auto rounded bg-white p-2 text-xs">
                  {`// 親要素に制限
boundaries: { 
  minX: 0, 
  maxX: parentWidth - elementWidth, 
  minY: 0, 
  maxY: parentHeight - elementHeight 
}

// ウィンドウに制限
boundaries: { 
  minX: 0, 
  maxX: window.innerWidth - elementWidth, 
  minY: 0, 
  maxY: window.innerHeight - elementHeight 
}

// カスタム範囲
boundaries: { 
  minX: 50, 
  maxX: 500, 
  minY: 50, 
  maxY: 300 
}`}
                </pre>
              </div>

              <div className="rounded border border-blue-100 bg-blue-50 p-3 text-sm">
                <p>
                  <strong>ヒント:</strong> ドラッグ要素のサイズを考慮して、maxX/maxYから要素サイズを差し引くことで、
                  要素が常に表示領域内に収まるようにします。
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 実装詳細 */}
      <div className="mb-8 rounded-lg border p-4">
        <h2 className="mb-3 text-xl font-semibold">実装詳細</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <h3 className="mb-2 font-medium">特徴</h3>
            <ul className="ml-5 list-disc space-y-1 text-sm">
              <li>マウスとタッチイベントの両方に対応</li>
              <li>ReactとTypeScriptで完全に型付け</li>
              <li>パフォーマンス最適化オプション</li>
              <li>適切なイベントリスナーの管理によるメモリリーク防止</li>
              <li>SSRと互換性のある設計</li>
              <li>CSSトランスフォームを利用したスムーズなアニメーション</li>
            </ul>
          </div>

          <div>
            <h3 className="mb-2 font-medium">使用方法</h3>
            <ol className="ml-5 list-decimal space-y-1 text-sm">
              <li>要素への参照を設定するためのrefを取得</li>
              <li>現在の位置情報をCSSで適用: translate(x, y)</li>
              <li>ドラッグ中の状態に応じてスタイルを変更</li>
              <li>必要に応じて境界制約を設定</li>
              <li>ライフサイクルコールバックを活用</li>
            </ol>
          </div>
        </div>
      </div>

      {/* フッター */}
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>useDndフックは再利用性、型安全性、パフォーマンスを念頭に置いて設計されています。</p>
        <p className="mt-2">© 2025 Hono Project</p>
      </div>
    </div>
  )
}

export default DndDemo
