"use client"
import { useWebWorker } from "@/hooks/useWorker"
import React, { useEffect, useRef, useState } from "react"

/**
 * ArrayBufferなどの転送可能オブジェクトを使ったデモページ
 */
const BufferWorkerDemo = () => {
  // 転送モード用とコピーモード用の別々のWeb Workerを初期化
  const transferWorker = useWebWorker({
    scriptUrl: "/workers/buffer-worker.js",
    debug: true,
    terminateAfterJob: false,
  })

  const copyWorker = useWebWorker({
    scriptUrl: "/workers/buffer-worker.js",
    debug: true,
    terminateAfterJob: false,
  })

  // 画像処理用の状態
  const [selectedImage, setSelectedImage] = useState<File | null>(null)

  // 転送モードとコピーモードの結果を追跡
  const [transferModeResult, setTransferModeResult] = useState<{
    url: string | null
    time: number | null
    progress: number
    isProcessing: boolean
    dataSize: number | null
  }>({
    url: null,
    time: null,
    progress: 0,
    isProcessing: false,
    dataSize: null,
  })

  const [copyModeResult, setCopyModeResult] = useState<{
    url: string | null
    time: number | null
    progress: number
    isProcessing: boolean
    dataSize: number | null
  }>({
    url: null,
    time: null,
    progress: 0,
    isProcessing: false,
    dataSize: null,
  })

  // Canvas参照
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null)
  const transferCanvasRef = useRef<HTMLCanvasElement>(null)
  const copyCanvasRef = useRef<HTMLCanvasElement>(null)

  // ソース画像がロードされたらCanvasに描画
  useEffect(() => {
    if (selectedImage && sourceCanvasRef.current) {
      const url = URL.createObjectURL(selectedImage)
      const img = new Image()
      img.onload = () => {
        const canvas = sourceCanvasRef.current
        if (!canvas) {
          URL.revokeObjectURL(url)
          return
        }

        // キャンバスサイズを画像に合わせる（最大幅500px）
        const maxWidth = 500
        let width = img.width
        let height = img.height

        if (width > maxWidth) {
          const ratio = maxWidth / width
          width = maxWidth
          height = height * ratio
        }

        canvas.width = width
        canvas.height = height

        // 画像を描画
        const ctx = canvas.getContext("2d")
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height)
          console.log(`元画像をキャンバスに描画: ${width}x${height}`)
        }
        URL.revokeObjectURL(url)
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
      }
      img.src = url
    }
  }, [selectedImage])

  // 画像ファイル選択ハンドラ
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      setSelectedImage(files[0])

      // 結果をリセット
      const resetResult = {
        url: null,
        time: null,
        progress: 0,
        isProcessing: false,
        dataSize: null,
      }
      setTransferModeResult(resetResult)
      setCopyModeResult(resetResult)
    }
  }

  // 両方のモードで画像を同時に処理する関数
  const processImageBothModes = async () => {
    if (!sourceCanvasRef.current) return

    // 初期化
    setTransferModeResult((prev) => ({
      ...prev,
      url: null,
      time: null,
      isProcessing: true,
      progress: 0,
      dataSize: null,
    }))

    setCopyModeResult((prev) => ({
      ...prev,
      url: null,
      time: null,
      isProcessing: true,
      progress: 0,
      dataSize: null,
    }))

    try {
      const canvas = sourceCanvasRef.current
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      // 元の画像データを取得
      const originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

      console.log(
        `画像処理開始: ${canvas.width}x${canvas.height}、データサイズ: ${originalImageData.data.buffer.byteLength} バイト`,
      )

      // 同時に両モードの処理を開始（Promise.allで並列処理）
      Promise.all([
        processImageWithMode("transfer", originalImageData),
        processImageWithMode("copy", originalImageData),
      ]).catch((error) => {
        console.error("並列画像処理中にエラーが発生しました:", error)
      })
    } catch (error) {
      console.error("画像処理の準備中にエラーが発生しました:", error)
      // エラー時は処理状態をリセット
      setTransferModeResult((prev) => ({ ...prev, isProcessing: false }))
      setCopyModeResult((prev) => ({ ...prev, isProcessing: false }))
    }
  }

  // 指定モードで画像処理を行う関数
  const processImageWithMode = async (mode: "transfer" | "copy", originalImageData: ImageData) => {
    try {
      // 元データのコピーを作成して、両モードが完全に同じ開始点から始まるようにする
      const imageDataClone = new ImageData(
        new Uint8ClampedArray(originalImageData.data),
        originalImageData.width,
        originalImageData.height,
      )

      // モードに応じた処理方法
      let dataBuffer: ArrayBuffer
      let transferables: Transferable[] = []

      if (mode === "transfer") {
        // 転送モード: 元のバッファを使用
        dataBuffer = imageDataClone.data.buffer as ArrayBuffer
        transferables = [dataBuffer]

        console.log(`転送モード処理開始: バッファサイズ ${dataBuffer.byteLength} バイト`)
      } else {
        // コピーモード: バッファをコピー（slice(0)で完全な別コピーを作成）
        dataBuffer = (imageDataClone.data.buffer as ArrayBuffer).slice(0)

        console.log(`コピーモード処理開始: バッファサイズ ${dataBuffer.byteLength} バイト`)
      }

      // 処理開始時間
      const startTime = performance.now()

      // ワーカーに処理依頼（モードに応じて異なるワーカーを使用）
      const worker = mode === "transfer" ? transferWorker : copyWorker

      const jobResult = await worker.executeJob({
        payload: {
          type: "processImageData",
          imageData: {
            data: dataBuffer,
            width: imageDataClone.width,
            height: imageDataClone.height,
          },
          slowMode: true, // 進捗を視覚化するために処理を遅くする
          mode: mode, // モード情報を追加
        },
        transferables: transferables as Transferable[],
        enableProgress: true,
        onProgress: (progress) => {
          // 進捗を更新
          if (mode === "transfer") {
            setTransferModeResult((prev) => ({ ...prev, progress }))
          } else {
            setCopyModeResult((prev) => ({ ...prev, progress }))
          }
        },
      })

      // 処理時間計算
      const endTime = performance.now()
      const processTime = endTime - startTime

      console.log(`${mode}モード処理完了: 処理時間 ${processTime.toFixed(2)}ms`)

      // 処理結果の表示
      if (jobResult.status === "completed" && jobResult.data) {
        const result = jobResult.data as {
          data: ArrayBuffer
          width: number
          height: number
        }

        // 処理結果をキャンバスに描画
        const targetCanvas = mode === "transfer" ? transferCanvasRef.current : copyCanvasRef.current

        if (targetCanvas) {
          targetCanvas.width = result.width
          targetCanvas.height = result.height
          const resultCtx = targetCanvas.getContext("2d")

          if (resultCtx) {
            const processedData = new ImageData(new Uint8ClampedArray(result.data), result.width, result.height)

            resultCtx.putImageData(processedData, 0, 0)

            console.log(`${mode}モード処理結果:`, {
              width: targetCanvas.width,
              height: targetCanvas.height,
              dataSize: result.data.byteLength,
            })

            const dataUrl = targetCanvas.toDataURL("image/png")
            console.log(`${mode}モードのdataURL生成完了`)

            // 結果を保存
            if (mode === "transfer") {
              setTransferModeResult({
                url: dataUrl,
                time: processTime,
                progress: 100,
                isProcessing: false,
                dataSize: result.data.byteLength,
              })
            } else {
              setCopyModeResult({
                url: dataUrl,
                time: processTime,
                progress: 100,
                isProcessing: false,
                dataSize: result.data.byteLength,
              })
            }
          }
        }
      }
    } catch (error) {
      console.error(`${mode}モード処理エラー:`, error)
      // エラー時も処理状態をリセット
      if (mode === "transfer") {
        setTransferModeResult((prev) => ({ ...prev, isProcessing: false }))
      } else {
        setCopyModeResult((prev) => ({ ...prev, isProcessing: false }))
      }
    }
  }

  // 処理状態の判定
  const isProcessing = transferModeResult.isProcessing || copyModeResult.isProcessing

  return (
    <div className="flex flex-col items-center justify-center pt-30">
      <h1 className="text-2xl font-bold">Transferable Objectsデモ</h1>
      <p className="mt-2 max-w-2xl text-center text-gray-600">
        大きなデータをWeb Workerに効率的に転送して処理する方法を示します。
        <br />
        転送モード（所有権移譲）とコピーモード（通常のpostMessage）の違いを視覚的に比較できます。
      </p>

      {/* 画像選択セクション */}
      <div className="mt-6 w-full max-w-2xl rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">1. 画像の選択</h2>

        <div className="mt-4">
          <input
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
          />

          <p className="mt-2 text-sm text-gray-500">
            処理する画像を選択してください。転送モードとコピーモードを同時に比較します。
            大きな画像ほど処理時間の差が明確になります。
          </p>
        </div>
      </div>

      {/* 元の画像表示 */}
      {selectedImage && (
        <div className="mt-4 w-full max-w-2xl rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">2. 元の画像</h2>
          <div className="mt-2 inline-block rounded border p-2">
            <canvas ref={sourceCanvasRef} className="max-w-full" />
          </div>

          <div className="mt-4">
            <button
              onClick={processImageBothModes}
              disabled={isProcessing}
              className={`rounded-md px-4 py-2 text-white ${
                isProcessing
                  ? "cursor-not-allowed bg-gray-400"
                  : "bg-blue-500 hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              }`}
            >
              {isProcessing ? "処理中..." : "両モードで同時処理開始"}
            </button>

            <p className="mt-2 text-sm text-gray-600">
              転送モード（所有権移譲）とコピーモード（通常のpostMessage）を同時に処理し、
              パフォーマンスと挙動の違いを比較します。
            </p>
          </div>
        </div>
      )}

      {/* 両モード比較表示 */}
      {selectedImage && (
        <div className="mt-4 w-full max-w-2xl rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">3. 転送モードとコピーモードの比較</h2>

          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* 転送モード結果 */}
            <div className="rounded border p-4">
              <h3 className="mb-2 text-sm font-medium text-blue-600">転送モード（ArrayBuffer転送）</h3>

              {/* 進捗バー */}
              <div className="mb-4">
                <div className="mb-1 text-center text-sm">進捗: {transferModeResult.progress}%</div>
                <div className="h-2.5 w-full rounded-full bg-gray-200">
                  <div
                    className="h-2.5 rounded-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${transferModeResult.progress}%` }}
                  />
                </div>
                {transferModeResult.time !== null && (
                  <div className="mt-1 text-xs text-gray-600">
                    処理時間: <span className="font-bold">{transferModeResult.time.toFixed(1)}ms</span>
                    {transferModeResult.dataSize && (
                      <span className="ml-2">
                        ({(transferModeResult.dataSize / (1024 * 1024)).toFixed(2)}
                        MB)
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* 画像表示 */}
              <div className="flex min-h-50 items-center justify-center rounded border bg-gray-50 p-2">
                {transferModeResult.isProcessing ? (
                  <div className="text-gray-500">処理中...</div>
                ) : transferModeResult.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={transferModeResult.url} alt="転送モード結果" className="max-h-50 max-w-full" />
                ) : (
                  <div className="text-gray-500">処理を開始してください</div>
                )}
              </div>
              {/* 正しく配置された非表示キャンバス */}
              <div className="hidden">
                <canvas ref={transferCanvasRef} />
              </div>

              <p className="mt-2 text-xs text-gray-500">
                所有権移譲方式: メモリコピーなしでArrayBufferの所有権がWorkerに移動します。
                元のバッファは空（0バイト）になります。
              </p>
            </div>

            {/* コピーモード結果 */}
            <div className="rounded border p-4">
              <h3 className="mb-2 text-sm font-medium text-green-600">コピーモード（通常転送）</h3>

              {/* 進捗バー */}
              <div className="mb-4">
                <div className="mb-1 text-center text-sm">進捗: {copyModeResult.progress}%</div>
                <div className="h-2.5 w-full rounded-full bg-gray-200">
                  <div
                    className="h-2.5 rounded-full bg-green-600 transition-all duration-300"
                    style={{ width: `${copyModeResult.progress}%` }}
                  />
                </div>
                {copyModeResult.time !== null && (
                  <div className="mt-1 text-xs text-gray-600">
                    処理時間: <span className="font-bold">{copyModeResult.time.toFixed(1)}ms</span>
                    {copyModeResult.dataSize && (
                      <span className="ml-2">
                        ({(copyModeResult.dataSize / (1024 * 1024)).toFixed(2)}
                        MB)
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* 画像表示 */}
              <div className="flex min-h-50 items-center justify-center rounded border bg-gray-50 p-2">
                {copyModeResult.isProcessing ? (
                  <div className="text-gray-500">処理中...</div>
                ) : copyModeResult.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={copyModeResult.url} alt="コピーモード結果" className="max-h-50 max-w-full" />
                ) : (
                  <div className="text-gray-500">処理を開始してください</div>
                )}
              </div>
              {/* 正しく配置された非表示キャンバス */}
              <div className="hidden">
                <canvas ref={copyCanvasRef} />
              </div>

              <p className="mt-2 text-xs text-gray-500">
                通常方式: ArrayBufferの完全なコピーが作成されます。
                元のバッファはそのまま使用可能ですが、メモリ使用量が増加します。
              </p>
            </div>
          </div>

          {/* 結果比較セクション */}
          {transferModeResult.time !== null && copyModeResult.time !== null && (
            <div className="mt-6 border-t pt-4">
              <h3 className="mb-2 text-sm font-medium">性能比較結果</h3>
              <div className="rounded border bg-gray-50 p-4">
                <div className="flex flex-wrap justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">
                      転送モード: <span className="text-blue-600">{transferModeResult.time.toFixed(1)}ms</span>
                    </p>
                    <p className="text-sm font-medium">
                      コピーモード: <span className="text-green-600">{copyModeResult.time.toFixed(1)}ms</span>
                    </p>
                  </div>
                  <div>
                    {transferModeResult.time < copyModeResult.time ? (
                      <p className="text-sm font-bold text-blue-600">
                        転送モードが {(copyModeResult.time / transferModeResult.time).toFixed(2)}倍 高速
                      </p>
                    ) : transferModeResult.time > copyModeResult.time ? (
                      <p className="text-sm font-bold text-green-600">
                        コピーモードが {(transferModeResult.time / copyModeResult.time).toFixed(2)}倍 高速
                      </p>
                    ) : (
                      <p className="text-sm font-bold">同じ処理時間</p>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  注: 処理速度はデータサイズやブラウザの実装によって異なります。
                  理論的には大きなデータで転送モードがメリットを持ちますが、
                  実際のパフォーマンスはブラウザの実装や環境に依存します。
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 解説セクション */}
      <div className="mt-8 w-full max-w-2xl rounded-lg border bg-gray-50 p-6">
        <h2 className="text-lg font-semibold">Transferable Objectsとは</h2>

        <div className="mt-2 space-y-2 text-sm text-gray-700">
          <p>
            <strong>Transferable Objects（転送可能オブジェクト）</strong>
            は、スレッド間でデータの所有権を移動できる特殊なオブジェクトです。
          </p>

          <p>
            通常、
            <code className="rounded bg-gray-100 px-1">postMessage()</code>
            でデータを送信すると、そのデータの完全なコピーが作成されます。
            これは小さなデータでは問題ありませんが、大きなArrayBufferなどでは非効率です。
          </p>

          <p>
            転送可能オブジェクトを使うと、データのコピーを作らずに所有権だけを移動できるため、
            メモリ使用量を抑えつつ大きなデータを効率的に転送できます。
          </p>

          <p>主な転送可能オブジェクト:</p>
          <ul className="list-inside list-disc pl-4">
            <li>ArrayBuffer</li>
            <li>MessagePort</li>
            <li>ImageBitmap</li>
            <li>OffscreenCanvas</li>
            <li>ReadableStream / WritableStream / TransformStream</li>
          </ul>

          <p>注意: 転送後、元のオブジェクトは使用できなくなります（「移譲」されるため）。</p>
        </div>
      </div>

      {/* 戻るリンク */}
      <div className="mt-6 mb-12">
        <a href="/demo/jw/simple" className="text-sm text-blue-600 hover:underline">
          ← シンプルなデモページに戻る
        </a>
      </div>
    </div>
  )
}

export default BufferWorkerDemo
