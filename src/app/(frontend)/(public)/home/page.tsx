"use client"

import MultiInputFTB from "@/components/MultiInputFTB"
import Image from "next/image"
import { ChangeEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { FAB } from "../_globalTools/FAB"
import { FlickInput, type FlickCaptureData } from "../_globalTools/FlickInput"
import { useCaptureTarget } from "../_globalTools/_hooks/useCaptureBridge"

interface FileInputProps {
  children: (props: { onClick: () => void; buttonText: string; isSelected: boolean }) => ReactNode
  onChange?: (file: File | null) => void
}

const FileInput = ({ children, onChange }: FileInputProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [inputKey, setInputKey] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const [openDialogTrigger, setOpenDialogTrigger] = useState(0)
  useEffect(() => {
    if (openDialogTrigger > 0) {
      inputRef.current?.click()
    }
  }, [openDialogTrigger])

  const onClick = useCallback(() => {
    if (selectedFile) {
      setSelectedFile(null)
      onChange?.(null)
      setInputKey((k) => k + 1)
    } else {
      setOpenDialogTrigger((t) => t + 1)
    }
  }, [onChange, selectedFile])

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null
    setSelectedFile(file)
    onChange?.(file)
  }

  const isSelected = !!selectedFile
  const buttonText = isSelected ? "Deselect File" : "Select a File"

  return (
    <div className="file-input-wrapper">
      <input key={inputKey} ref={inputRef} type="file" onChange={handleChange} style={{ display: "none" }} />
      {children({ onClick, buttonText, isSelected })}
    </div>
  )
}

export default function Page() {
  const [fileName, setFileName] = useState<string | null>(null)
  const [capturedData, setCapturedData] = useState<FlickCaptureData | null>(null)
  const [capturedDataWithShowcase, setCapturedDataWithShowcase] = useState<FlickCaptureData | null>(null)
  const [bridgeTargetFile, setBridgeTargetFile] = useState<{ url: string; name: string } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [apiResponse, setApiResponse] = useState<string | null>(null)

  // 1. Input Target
  const bridgeInput = useCaptureTarget(
    useMemo(
      () => ({
        id: "input-target",
        label: "入力欄",
        accepts: ["image", "file"],
        onApply: (data) => {
          if (data.type === "image") {
            setBridgeTargetFile({ url: data.url, name: "captured_image.jpg" })
          } else if (data.type === "file") {
            setBridgeTargetFile({ url: "", name: `${data.files.length} files selected` })
          }
        },
      }),
      [],
    ),
  )

  // 2. Canvas Target
  const bridgeCanvas = useCaptureTarget(
    useMemo(
      () => ({
        id: "canvas-target",
        label: "キャンバス",
        accepts: ["image"],
        onApply: (data) => {
          if (data.type !== "image") return
          const canvas = canvasRef.current
          if (!canvas) return
          const ctx = canvas.getContext("2d")
          if (!ctx) return
          const img = new window.Image()
          img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          }
          img.src = data.url
        },
      }),
      [],
    ),
  )

  // 3. API Target
  const bridgeApi = useCaptureTarget(
    useMemo(
      () => ({
        id: "api-target",
        label: "API送信",
        accepts: ["qr", "image", "audio"],
        onApply: async (data) => {
          setApiResponse("Sending...")
          // 疑似APIリクエスト
          await new Promise((r) => setTimeout(r, 1000))
          setApiResponse(`Success: Received ${data.type} at ${new Date().toLocaleTimeString()}`)
        },
      }),
      [],
    ),
  )

  // コンポーネントマウント時にデフォルトターゲットを登録
  const { register: regInput, unregister: unregInput } = bridgeInput
  const { register: regCanvas, unregister: unregCanvas } = bridgeCanvas
  const { register: regApi, unregister: unregApi } = bridgeApi

  useEffect(() => {
    regInput()
    regCanvas()
    regApi()
    return () => {
      unregInput()
      unregCanvas()
      unregApi()
    }
  }, [regInput, unregInput, regCanvas, unregCanvas, regApi, unregApi])

  const handleFileChange = useCallback((file: File | null) => {
    setFileName(file?.name || null)
  }, [])

  return (
    <main className="flex min-h-screen flex-col items-center justify-between overflow-x-hidden p-6 lg:p-24">
      <div className="flex w-full max-w-6xl flex-wrap items-start justify-center gap-8 pt-14">
        {/* FlickInput Example (Showcase Disabled) */}
        <div className="flex min-w-75 flex-1 flex-col items-center gap-4 rounded-3xl border border-zinc-200 bg-white/50 p-8 shadow-xl backdrop-blur-md">
          <h3 className="text-lg font-bold text-zinc-800">FlickInput</h3>
          <p className="text-[10px] font-bold tracking-tighter text-zinc-500 uppercase">Showcase: Disabled</p>

          <FlickInput onCapture={(data) => setCapturedData(data)} items={["camera", "microphone", "file"]} />
          {capturedData && (
            <div className="animate-in fade-in slide-in-from-top-2 mt-4 flex flex-col items-center gap-2">
              <div className="text-[10px] font-black tracking-widest text-blue-600 uppercase">
                {capturedData.type} Captured
              </div>
              {capturedData.type === "image" && (
                <div className="relative h-32 w-48 overflow-hidden rounded-xl border shadow-inner">
                  <Image src={capturedData.url} alt="Captured" fill unoptimized className="object-cover" />
                </div>
              )}
              {capturedData.type === "audio" && <audio src={capturedData.url} controls className="h-8 w-48" />}
              {capturedData.type === "video" && (
                <video src={capturedData.url} controls className="h-32 w-48 rounded-xl border shadow-inner" />
              )}
              {capturedData.type === "qr" && (
                <div className="rounded-xl border border-zinc-200 bg-zinc-100 p-4 shadow-inner">
                  <div className="mb-1 text-[8px] font-black tracking-widest text-zinc-400 uppercase">QR Data</div>
                  <div className="font-mono text-xs font-bold break-all text-zinc-700">{capturedData.data}</div>
                </div>
              )}
              {capturedData.type === "file" && (
                <div className="flex flex-col items-center gap-1">
                  {capturedData.files.map((f, i) => (
                    <div
                      key={i}
                      className="rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-700"
                    >
                      📄 {f.name}
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => setCapturedData(null)}
                className="text-[9px] font-bold tracking-widest text-zinc-400 uppercase hover:text-red-500"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* FlickInput Example (Showcase Enabled) */}
        <div className="flex min-w-75 flex-1 flex-col items-center gap-4 rounded-3xl border border-zinc-200 bg-white/50 p-8 shadow-xl backdrop-blur-md">
          <h3 className="text-lg font-bold text-zinc-800">FlickInput</h3>
          <p className="text-[10px] font-bold tracking-tighter text-zinc-500 uppercase">Showcase: Enabled</p>

          <FlickInput
            onCapture={(data) => setCapturedDataWithShowcase(data)}
            items={["camera", "microphone", "file"]}
            showShowcase={true}
          />

          {capturedDataWithShowcase && (
            <div className="animate-in fade-in slide-in-from-top-2 mt-4 flex flex-col items-center gap-2">
              <div className="text-[10px] font-black tracking-widest text-indigo-600 uppercase">
                {capturedDataWithShowcase.type} Selected
              </div>
              {capturedDataWithShowcase.type === "image" && (
                <div className="relative h-32 w-48 overflow-hidden rounded-xl border shadow-inner">
                  <Image src={capturedDataWithShowcase.url} alt="Selected" fill unoptimized className="object-cover" />
                </div>
              )}
              {capturedDataWithShowcase.type === "audio" && (
                <audio src={capturedDataWithShowcase.url} controls className="h-8 w-48" />
              )}
              {capturedDataWithShowcase.type === "video" && (
                <video
                  src={capturedDataWithShowcase.url}
                  controls
                  className="h-32 w-48 rounded-xl border shadow-inner"
                />
              )}
              {capturedDataWithShowcase.type === "qr" && (
                <div className="rounded-xl border border-zinc-200 bg-zinc-100 p-4 shadow-inner">
                  <div className="mb-1 text-[8px] font-black tracking-widest text-zinc-400 uppercase">QR Data</div>
                  <div className="font-mono text-xs font-bold break-all text-zinc-700">
                    {capturedDataWithShowcase.data}
                  </div>
                </div>
              )}
              {capturedDataWithShowcase.type === "file" && (
                <div className="flex flex-col items-center gap-1">
                  {capturedDataWithShowcase.files.map((f, i) => (
                    <div
                      key={i}
                      className="rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-700"
                    >
                      📄 {f.name}
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => setCapturedDataWithShowcase(null)}
                className="text-[9px] font-bold tracking-widest text-zinc-400 uppercase hover:text-red-500"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Capture Bridge Examples */}
        <div className="flex w-full flex-col gap-4">
          <h3 className="text-center text-xl font-bold text-zinc-800">Global Capture Bridge</h3>
          <div className="flex flex-wrap gap-4">
            {/* 1. Input Target */}
            <div
              onClick={() => bridgeInput.setActive()}
              className={`flex min-w-60 flex-1 cursor-pointer flex-col items-center gap-4 rounded-3xl border p-6 shadow-xl backdrop-blur-md transition-all ${
                bridgeInput.isActive
                  ? "border-blue-500 bg-blue-50/50 ring-2 ring-blue-200"
                  : "border-zinc-200 bg-white/50"
              }`}
            >
              <div className="text-sm font-bold text-zinc-800">入力欄ターゲット</div>
              {!bridgeTargetFile ? (
                <div className="flex h-32 w-full items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-4 text-center text-[10px] text-zinc-400">
                  写真を撮ってトーストのボタンを押してください
                </div>
              ) : (
                <div className="relative h-32 w-full overflow-hidden rounded-xl border">
                  {bridgeTargetFile.url ? (
                    <Image src={bridgeTargetFile.url} alt="Target" fill className="object-cover" unoptimized />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-zinc-100 text-[10px] font-bold">
                      {bridgeTargetFile.name}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. Canvas Target */}
            <div
              onClick={() => bridgeCanvas.setActive()}
              className={`flex min-w-60 flex-1 cursor-pointer flex-col items-center gap-4 rounded-3xl border p-6 shadow-xl backdrop-blur-md transition-all ${
                bridgeCanvas.isActive
                  ? "border-blue-500 bg-blue-50/50 ring-2 ring-blue-200"
                  : "border-zinc-200 bg-white/50"
              }`}
            >
              <div className="text-sm font-bold text-zinc-800">キャンバス描画</div>
              <canvas
                ref={canvasRef}
                width={200}
                height={150}
                className="h-32 w-full rounded-xl border bg-zinc-950 shadow-inner"
              />
              <div className="text-[9px] text-zinc-400 italic">※撮影データが直接Canvasに描画されます</div>
            </div>

            {/* 3. API Target */}
            <div
              onClick={() => bridgeApi.setActive()}
              className={`flex min-w-60 flex-1 cursor-pointer flex-col items-center gap-4 rounded-3xl border p-6 shadow-xl backdrop-blur-md transition-all ${
                bridgeApi.isActive
                  ? "border-blue-500 bg-blue-50/50 ring-2 ring-blue-200"
                  : "border-zinc-200 bg-white/50"
              }`}
            >
              <div className="text-sm font-bold text-zinc-800">疑似API送信 (QR/音声可)</div>
              <div className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border bg-zinc-900 p-4 text-center">
                <div className="font-mono text-[10px] text-zinc-500">Server Response:</div>
                <div className="line-clamp-3 font-mono text-xs font-bold break-all text-emerald-400">
                  {apiResponse || "Waiting for signal..."}
                </div>
              </div>
              <div className="text-center text-[9px] text-zinc-400 italic">
                ※QRコードを読み取るとトーストから送信できます
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
        <p className="fixed top-0 left-0 flex w-full justify-center border-b border-gray-300 bg-linear-to-b from-zinc-200 pt-8 pb-6 backdrop-blur-2xl lg:static lg:w-auto lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:dark:bg-zinc-800/30">
          Get started by editing&nbsp;
          <code className="font-mono font-bold">src/app/page.tsx</code>
        </p>
        <div className="fixed bottom-0 left-0 flex h-48 w-full items-end justify-center bg-linear-to-t from-white via-white lg:static lg:h-auto lg:w-auto lg:bg-none dark:from-black dark:via-black">
          <a
            className="pointer-events-none flex place-items-center gap-2 p-8 lg:pointer-events-auto lg:p-0"
            href="https://vercel.com?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            By <Image src="/vercel.svg" alt="Vercel Logo" className="dark:invert" width={100} height={24} priority />
          </a>
        </div>
      </div>
      <div className="before:bg-gradient-radial after:bg-gradient-conic relative z-[-1] flex place-items-center before:absolute before:h-75 before:w-120 before:-translate-x-1/2 before:rounded-full before:from-white before:to-transparent before:blur-2xl before:content-[''] after:absolute after:-z-20 after:h-45 after:w-60 after:translate-x-1/3 after:from-sky-200 after:via-blue-200 after:blur-2xl after:content-[''] before:lg:h-90 before:dark:bg-linear-to-br before:dark:from-transparent before:dark:to-blue-700 before:dark:opacity-10 after:dark:from-sky-900 after:dark:via-[#0141ff] after:dark:opacity-40">
        <Image
          className="relative dark:drop-shadow-[0_0_0.3rem_#ffffff70] dark:invert"
          src="/next.svg"
          alt="Next.js Logo"
          width={180}
          height={37}
          priority
        />
      </div>
      <div className="mb-32 grid text-center lg:mb-0 lg:w-full lg:max-w-5xl lg:grid-cols-4 lg:text-left">
        <FileInput onChange={handleFileChange}>
          {({ onClick, buttonText, isSelected }) => (
            <button
              className={`cursor-pointer rounded-full px-4 py-2 text-white transition-colors active:scale-95 lg:static ${
                isSelected ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
              }`}
              onClick={onClick}
            >
              {buttonText}
            </button>
          )}
        </FileInput>
        {fileName && <p className="mt-4 lg:mt-0">Selected File: {fileName}</p>}
        <a
          href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
          className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
          target="_blank"
          rel="noopener noreferrer"
        >
          <h2 className={`mb-3 text-2xl font-semibold`}>
            Docs
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className={`m-0 max-w-[30ch] text-sm opacity-50`}>
            Find in-depth information about Next.js features and API.
          </p>
        </a>

        <a
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
          target="_blank"
          rel="noopener noreferrer"
        >
          <h2 className={`mb-3 text-2xl font-semibold`}>
            Learn{" "}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className={`m-0 max-w-[30ch] text-sm opacity-50`}>
            Learn about Next.js in an interactive course with&nbsp;quizzes!
          </p>
        </a>

        <a
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
          className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
          target="_blank"
          rel="noopener noreferrer"
        >
          <h2 className={`mb-3 text-2xl font-semibold`}>
            Templates{" "}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className={`m-0 max-w-[30ch] text-sm opacity-50`}>Explore starter templates for Next.js.</p>
        </a>

        <a
          href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
          className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
          target="_blank"
          rel="noopener noreferrer"
        >
          <h2 className={`mb-3 text-2xl font-semibold`}>
            Deploy{" "}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className={`m-0 max-w-[30ch] text-sm opacity-50`}>
            Instantly deploy your Next.js site to a shareable URL with Vercel.
          </p>
        </a>
      </div>

      {/* ボタン↓ */}
      <MultiInputFTB className="p-2" />
      <FAB className="p-2" />
      {/* ボタン↑ */}
    </main>
  )
}
