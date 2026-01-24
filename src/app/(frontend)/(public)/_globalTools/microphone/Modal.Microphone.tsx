import Image from "next/image"
import React, { useEffect, useMemo, useRef, useState } from "react"
import { Carousel } from "../_components/atoms/Carousel"
import { Modal } from "../_components/atoms/Modal"
import { Tool } from "../_components/GlobalTool"
import { CheckIcon, LoadingSpinner, MicIcon, PictureIcon, PlayIcon, StopIcon, TrashIcon } from "../_components/Icons"
import { useToolActionStore, type ToolFile } from "../_hooks/useToolActionStore"
import { microphoneActions, useMicrophoneState } from "./microphoneStore"

const SABI_GOLD = "#9f890e"

const hexToRgb = (hex: string): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : "159, 137, 14"
}

interface MicrophoneModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect?: (accept?: string) => void
  standalone?: boolean
  showShowcase?: boolean
  onCapture?: (result: { type: "audio"; blob: Blob; url: string } | { type: "file"; files: File[] }) => void
}

const MicrophoneModal: React.FC<MicrophoneModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  standalone,
  showShowcase,
  onCapture,
}) => {
  const {
    currentFileSet,
    audioFiles: files, // Destructure as 'files' to minimize downstream changes
    deleteFiles,
    saveFile,
    getFileWithUrl,
    fileSetInfo,
    switchFileSet,
    isDbReady,
  } = useToolActionStore()
  const microphoneState = useMicrophoneState()
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [selectedIdbKey, setSelectedIdbKey] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLibraryOpen, setIsLibraryOpen] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const selectedFile = useMemo(() => files.find((f) => f.idbKey === selectedIdbKey) || null, [files, selectedIdbKey])

  const handleSelectFile = (file: ToolFile): void => {
    setSelectedIdbKey(file.idbKey)
    microphoneActions.setAudioUrl(file.url)
  }

  // currentFileSet の変更を render 時に検知して同期
  const [prevFileSet, setPrevFileSet] = useState(currentFileSet)
  if (currentFileSet !== prevFileSet) {
    setPrevFileSet(currentFileSet)
    setSelectedKeys(new Set())
    setSelectedIdbKey(null)
  }

  // アクション（コールバック）の登録
  useEffect(() => {
    if (!isOpen) return // 閉じている時は登録しない
    microphoneActions.setCallbacks({
      onSelect,
      onRecordComplete: (result) => {
        // files が更新されるまで少し待つ
        setTimeout(() => {
          const savedFile = files.find((f) => f.idbKey === result.idbKey)
          if (savedFile) {
            setSelectedIdbKey(result.idbKey)
            microphoneActions.setAudioUrl(savedFile.url)
          }
        }, 10)
      },
    })
    const deleteFile = async (idbKey: string, dbId: string) => {
      await deleteFiles([{ idbKey, id: dbId }])
    }
    microphoneActions.setExternalActions({
      saveFile: (file, options) => saveFile(file, { ...options, category: "microphone" }),
      getFileWithUrl,
      deleteFile,
    })
  }, [isOpen, onSelect, saveFile, getFileWithUrl, deleteFiles, files])

  // モーダル開閉時の初期化・クリーンアップ
  useEffect(() => {
    if (!isOpen) {
      microphoneActions.cleanup()
      return
    }
    const setupMicrophone = async () => {
      await microphoneActions.setup()
    }
    setupMicrophone()
  }, [isOpen])

  const handleMainActionClick = async () => {
    if (selectedFile === null) {
      // 非選択状態: 録音操作
      if (microphoneState.isRecording) {
        await microphoneActions.stopRecord(async (blob) => {
          if (standalone && onCapture) {
            onCapture({ type: "audio", blob, url: URL.createObjectURL(blob) })
            onClose()
            return { id: "standalone", idbKey: "standalone" }
          }
          const res = await microphoneActions.saveFile(blob, { fileName: `recording_${Date.now()}.mp3` })
          return res
        })
      } else {
        microphoneActions.startRecord()
      }
    } else {
      // 選択状態: 再生操作
      if (isPlaying) {
        audioRef.current?.pause()
        setIsPlaying(false)
      } else {
        audioRef.current?.play()
        setIsPlaying(true)
      }
    }
  }

  const toggleSelection = (idbKey: string) => {
    const next = new Set(selectedKeys)
    if (next.has(idbKey)) {
      next.delete(idbKey)
    } else {
      next.add(idbKey)
    }
    setSelectedKeys(next)
  }

  const handleBulkDelete = async () => {
    if (selectedKeys.size === 0) return
    const count = selectedKeys.size
    if (confirm(`Delete ${count} selected audio files?`)) {
      const fileMap = new Map(files.map((f) => [f.idbKey, f]))
      const itemsToDelete = Array.from(selectedKeys)
        .map((idbKey) => {
          const file = fileMap.get(idbKey)
          return file ? { idbKey: file.idbKey, id: file.id } : null
        })
        .filter((item): item is { idbKey: string; id: string } => item !== null)
      await deleteFiles(itemsToDelete)
      setSelectedKeys(new Set())
      setSelectedIdbKey(null)
    }
  }

  const handleDecision = async () => {
    if (selectedKeys.size === 0 || !onCapture) return
    const count = selectedKeys.size
    if (confirm(`Select ${count} audio files and set to input?`)) {
      const fileMap = new Map(files.map((f) => [f.idbKey, f]))
      const selectedIdbKeys = Array.from(selectedKeys)
      const { idbStore } = await import("../_hooks/db/useIdbStore")
      const store = idbStore()
      const results = await Promise.all(
        selectedIdbKeys.map(async (key) => {
          const fileInfo = fileMap.get(key)
          if (!fileInfo) return null
          const blob = await store.get(key)
          if (!blob) return null
          return { blob, info: fileInfo }
        }),
      )
      const validResults = results.filter((r): r is { blob: Blob; info: (typeof files)[0] } => r !== null)
      if (validResults.length === 0) return
      if (validResults.length === 1) {
        const { blob, info } = validResults[0]
        const finalUrl = info.url || URL.createObjectURL(blob)
        onCapture({ type: "audio", blob, url: finalUrl })
      } else {
        const filesArray = validResults.map((r) => new File([r.blob], r.info.fileName, { type: r.info.mimeType }))
        onCapture({ type: "file", files: filesArray })
      }
      onClose()
    }
  }

  const getButtonIcon = () => {
    if (selectedFile === null) {
      // 非選択状態
      if (microphoneState.isRecording) return <StopIcon size="h-8 w-8" color="text-red-600" />
      return <MicIcon size="h-8 w-8" color="text-zinc-800" />
    } else {
      // 選択状態
      if (isPlaying) return <StopIcon size="h-8 w-8" color={SABI_GOLD} />
      return <PlayIcon size="h-8 w-8" color={SABI_GOLD} />
    }
  }

  const getButtonAriaLabel = () => {
    if (selectedFile === null) {
      if (microphoneState.isRecording) return "Stop recording"
      return "Start recording"
    } else {
      if (isPlaying) return "Stop playing"
      return "Play recording"
    }
  }

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(null)
  const audioContextRef = useRef<AudioContext>(null)
  const analyserRef = useRef<AnalyserNode>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode>(null)

  // リアルタイムビジュアライザー効果
  useEffect(() => {
    if (!microphoneState.isRecording || !microphoneState.stream || !canvasRef.current) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      return
    }
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    // 必要に応じてオーディオコンテキストを初期化
    if (!audioContextRef.current) {
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      audioContextRef.current = new AudioContextClass()
    }
    const audioCtx = audioContextRef.current
    // ブラウザポリシーにより中断された場合、コンテキストを再開
    if (audioCtx.state === "suspended") {
      audioCtx.resume()
    }
    // アナライザーをセットアップ
    if (!analyserRef.current) {
      analyserRef.current = audioCtx.createAnalyser()
      analyserRef.current.fftSize = 256 // 解像度
    }
    const analyser = analyserRef.current
    // ストリームを接続
    if (!sourceRef.current || sourceRef.current.mediaStream !== microphoneState.stream) {
      if (sourceRef.current) {
        sourceRef.current.disconnect()
      }
      sourceRef.current = audioCtx.createMediaStreamSource(microphoneState.stream)
      sourceRef.current.connect(analyser)
    }
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    const draw = () => {
      animationRef.current = requestAnimationFrame(draw)
      // クラシックで最小限の波形ラインに時間ドメインデータを使用
      analyser.getByteTimeDomainData(dataArray)
      const width = canvas.width
      const height = canvas.height
      ctx.clearRect(0, 0, width, height)
      ctx.beginPath()
      ctx.strokeStyle = SABI_GOLD
      ctx.lineWidth = 2
      ctx.lineCap = "round"
      ctx.globalAlpha = 0.9
      const sliceWidth = width / bufferLength
      let x = 0
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0 // 128 is the neutral center for time domain data
        const y = v * (height / 2)
        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
        x += sliceWidth
      }
      ctx.lineTo(width, height / 2)
      ctx.stroke()
    }
    draw()
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [microphoneState.isRecording, microphoneState.stream])

  const renderVisualizer = () => {
    if (microphoneState.isRecording && microphoneState.stream) {
      // リアルタイムキャンバス
      return (
        <canvas
          ref={canvasRef}
          width={192}
          height={192}
          className="absolute inset-0 h-full w-full rounded-full opacity-80"
        />
      )
    }

    // 再生モックアニメーション
    if (isPlaying) {
      return (
        <div className="flex items-center gap-1">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="w-1.5 rounded-full"
              style={{
                backgroundColor: SABI_GOLD,
                height: `${20 + ((i % 3) + 1) * 15}px`, // 決定論的高さ
                animationName: "pulse",
                animationDuration: `${0.5 + (i % 5) * 0.1}s`,
                animationTimingFunction: "ease-in-out",
                animationIterationCount: "infinite",
                animationDirection: "alternate",
                animationDelay: `${i * 0.1}s`,
                opacity: 0.8,
              }}
            />
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="h-full w-full p-0">
      <Tool className="bg-transparent" enableBackgroundTap onBackgroundTap={() => console.log("expand")}>
        {/* Main Viewer: Audio Status & Visualizer */}
        <Tool.Main className="relative flex flex-col items-center justify-center text-white">
          {microphoneState.isAvailable === null && !microphoneState.error && (
            <div className="flex flex-col items-center justify-center">
              <LoadingSpinner size="48px" color="#3b82f6" />
              <p className="mt-4 animate-pulse text-xs tracking-widest text-zinc-500 uppercase">Initializing...</p>
            </div>
          )}

          {microphoneState.error && (
            <div className="flex flex-col items-center justify-center px-8 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20 text-red-500">
                <StopIcon size="h-8 w-8" color="text-red-500" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-white">Microphone Error</h3>
              <p className="mb-6 text-sm text-zinc-400">{microphoneState.error.message}</p>
              <button
                onClick={() => microphoneActions.setup()}
                className="rounded-full bg-zinc-800 px-6 py-2 text-xs font-bold text-white hover:bg-zinc-700"
              >
                Retry
              </button>
            </div>
          )}

          {microphoneState.isAvailable && (
            <div className="flex flex-col items-center space-y-8 p-4">
              {/* Visualizer Area or Audio Player */}
              {selectedFile ? (
                // 再生状態UI
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative flex h-48 w-48 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 shadow-2xl">
                    {/* Album Art / File Icon Placeholder */}
                    <div className="flex flex-col items-center justify-center">
                      <div className="mb-2 rounded-full bg-zinc-800 p-4">
                        <PlayIcon size="h-8 w-8" color={isPlaying ? SABI_GOLD : "text-zinc-600"} />
                      </div>
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className="w-1 rounded-full bg-zinc-700"
                            style={{
                              height: isPlaying ? `${10 + ((i % 3) + 1) * 5}px` : "10px",
                              animationName: isPlaying ? "pulse" : "none",
                              animationDuration: "0.5s",
                              animationTimingFunction: "ease-in-out",
                              animationIterationCount: "infinite",
                              animationDirection: "alternate",
                              animationDelay: `${i * 0.1}s`,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Native Audio Player with Custom Styling Wrapper */}
                  <div className="w-64 rounded-xl bg-zinc-900/50 p-2 backdrop-blur-sm">
                    <audio
                      ref={audioRef}
                      src={microphoneState.audioUrl || undefined}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onEnded={() => setIsPlaying(false)}
                      controls
                      className="h-8 w-full opacity-80 mix-blend-screen hue-rotate-180 invert filter"
                    />
                  </div>
                </div>
              ) : (
                // 録音 / アイドル状態UI (既存のSabi Goldデザイン)
                <div
                  className="relative flex h-48 w-48 items-center justify-center rounded-full border border-[rgba(159,137,14,0.2)] bg-[rgba(159,137,14,0.05)]"
                  style={{ "--sabi-gold": hexToRgb(SABI_GOLD) } as React.CSSProperties}
                >
                  {/* Wabi-sabi accents */}
                  <div className="absolute top-4 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[rgba(var(--sabi-gold),0.4)]" />
                  <div className="absolute bottom-4 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[rgba(var(--sabi-gold),0.4)]" />
                  <div className="absolute top-1/2 left-4 h-1 w-1 -translate-y-1/2 rounded-full bg-[rgba(var(--sabi-gold),0.4)]" />
                  <div className="absolute top-1/2 right-4 h-1 w-1 -translate-y-1/2 rounded-full bg-[rgba(var(--sabi-gold),0.4)]" />

                  {microphoneState.isRecording ? (
                    renderVisualizer()
                  ) : (
                    <MicIcon size="h-16 w-16" color="rgba(159,137,14,0.5)" />
                  )}

                  {/* Recording Ripple Effect */}
                  {microphoneState.isRecording && (
                    <div className="absolute inset-0 animate-ping rounded-full border border-[rgba(var(--sabi-gold),0.3)] opacity-20" />
                  )}
                </div>
              )}
              {/* Status Text */}
              <div className="text-center">
                <p
                  className="text-[10px] font-black tracking-[0.3em] uppercase"
                  style={{ color: microphoneState.isRecording ? "#ef4444" : isPlaying ? SABI_GOLD : "#a1a1aa" }}
                >
                  {microphoneState.isRecording
                    ? "Recording..."
                    : selectedFile
                      ? isPlaying
                        ? "Now Playing"
                        : "Playback Ready"
                      : "Ready to Record"}
                </p>

                {selectedFile && (
                  <div className="mt-2 flex flex-col items-center">
                    <p className="max-w-50 truncate text-xs font-bold text-zinc-300">
                      {selectedFile.fileName || "Untitled Audio"}
                    </p>
                    <p className="text-[9px] text-zinc-600">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                )}
              </div>{" "}
            </div>
          )}
        </Tool.Main>

        {/* Controller */}
        <Tool.Controller>
          <div className="flex items-center justify-around gap-4 px-4">
            {/* Library Switch (Placeholder to balance layout or additional function) */}
            <div className="h-12 w-12" />

            {/* Main Action */}

            <div className="relative flex items-center justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation()

                  handleMainActionClick()
                }}
                disabled={!microphoneState.isAvailable}
                aria-label={getButtonAriaLabel()}
                className={`group hover:shadow-3xl relative flex h-16 w-16 touch-none items-center justify-center rounded-full shadow-2xl transition-all duration-300 select-none active:scale-95 disabled:opacity-50 ${
                  selectedFile
                    ? isPlaying
                      ? "bg-zinc-800 ring-2 ring-[rgba(159,137,14,0.5)]" // 再生状態 (一時停止ボタン)
                      : "bg-linear-to-br from-[rgba(159,137,14,0.2)] to-[rgba(159,137,14,0.1)] ring-1 ring-[rgba(159,137,14,0.3)] hover:ring-2 hover:ring-[rgba(159,137,14,0.8)]" // 再生準備完了 (再生ボタン)
                    : microphoneState.isRecording
                      ? "bg-white ring-4 ring-red-500/30" // 録音状態 (停止ボタン)
                      : "bg-linear-to-br from-white to-zinc-100 ring-0 ring-white/20 hover:scale-105" // アイドル状態 (録音ボタン)
                }`}
              >
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full transition-transform group-hover:scale-110 ${selectedFile ? "border-0" : "border-2 border-zinc-200"}`}
                >
                  {getButtonIcon()}
                </div>
              </button>
            </div>

            {/* Deselect / Gallery Select */}
            {selectedFile !== null ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedIdbKey(null)
                  microphoneActions.setAudioUrl(null)
                }}
                aria-label="Deselect file"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/80 transition-all hover:bg-zinc-700 active:scale-90"
              >
                <StopIcon size="h-6 w-6" color="#fff" />
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect?.("audio/*")
                }}
                aria-label="Select File"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/80 transition-all hover:bg-zinc-700 active:scale-90"
              >
                <PictureIcon size="h-6 w-6" color="#fff" />
              </button>
            )}
          </div>
        </Tool.Controller>

        {/* Showcase: Audio Files Gallery */}
        {(!standalone || showShowcase) && (
          <Tool.Showcase>
            <div className="grid grid-rows-[auto_1fr] gap-2">
              <div className="flex items-center justify-between px-2">
                {/* Left Side: Delete Action with Numeric Badge */}
                <div className="flex h-5 items-center gap-3">
                  {selectedKeys.size > 0 && (
                    <div className="animate-in fade-in slide-in-from-left-2 flex items-center gap-3">
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (standalone) {
                              handleDecision()
                            } else {
                              handleBulkDelete()
                            }
                          }}
                          aria-label={
                            standalone
                              ? `Select ${selectedKeys.size} audio files`
                              : `Delete ${selectedKeys.size} selected audio files`
                          }
                          className={`flex h-7 w-7 items-center justify-center rounded-xl bg-zinc-900 text-zinc-400 ring-1 ring-white/10 transition-all hover:bg-zinc-800 hover:text-white active:scale-90 ${standalone ? "text-green-500" : ""}`}
                        >
                          {standalone ? (
                            <CheckIcon size="14px" color="currentColor" />
                          ) : (
                            <TrashIcon size="14px" color="currentColor" />
                          )}
                        </button>
                        {/* Numeric Badge */}
                        <div
                          style={{ backgroundColor: SABI_GOLD }}
                          className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-black text-white shadow-sm ring-1 ring-zinc-950"
                        >
                          {selectedKeys.size}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedKeys(new Set())
                        }}
                        className="text-[9px] font-black tracking-widest text-zinc-600 uppercase transition-colors hover:text-zinc-400"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                {/* Right Side: FileSet Navigation */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsLibraryOpen(true)
                  }}
                  aria-label="Open FileSet Library"
                  className="group relative -top-2 -right-2 float-right flex flex-col items-end rounded-2xl bg-white/50 shadow-lg transition-all hover:scale-110"
                >
                  <div className="flex items-center gap-1.5">
                    <div className="flex h-6 max-w-64 min-w-12 cursor-pointer items-center justify-center-safe truncate px-2 text-sm font-bold text-zinc-800">
                      {currentFileSet}
                    </div>
                  </div>
                </button>
              </div>

              {/* Gallery */}
              {files.length > 0 ? (
                <Carousel containerClassName="gap-x-2 h-16">
                  {files.map((file, index) => {
                    const isSelected = !!file.idbKey && selectedKeys.has(file.idbKey)
                    const isCurrent = selectedIdbKey === file.idbKey
                    return (
                      <Carousel.Item key={file.idbKey || index} className="group relative">
                        <div
                          data-testid="audio-item"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSelectFile(file)
                          }}
                          className={`h-full cursor-pointer overflow-hidden transition-all duration-500 ease-out sm:rounded-none ${
                            isSelected
                              ? "scale-[0.88] bg-black/40 shadow-none ring-1 ring-yellow-200/10"
                              : isCurrent
                                ? "border-zinc-500 bg-zinc-800 shadow-[0_0_15px_rgba(159,137,14,0.3)]"
                                : "scale-100 border-white/5 bg-black/20 shadow-xl hover:bg-black/30"
                          }`}
                        >
                          <div className="flex h-full w-24 flex-col items-center justify-center p-2">
                            <div className="mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-950/50">
                              <PlayIcon size="h-3 w-3" color={isCurrent ? SABI_GOLD : "text-zinc-500"} />
                            </div>
                            <div className="h-1 w-12 rounded-full bg-zinc-800">
                              <div className="h-full rounded-full bg-zinc-600" style={{ width: "60%" }} />
                            </div>
                          </div>

                          {file.isPending && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                              <LoadingSpinner size="10px" color="#666" />
                            </div>
                          )}
                        </div>

                        {/* Select Toggle */}
                        {file.idbKey && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleSelection(file.idbKey!)
                            }}
                            aria-label={isSelected ? "Deselect audio file" : "Select audio file"}
                            className={`absolute -top-1 -right-1 z-10 flex h-7 w-7 items-center justify-center transition-all duration-300 active:scale-75 ${
                              isSelected ? "opacity-100" : "opacity-50 hover:opacity-100"
                            }`}
                          >
                            <div
                              style={{
                                backgroundColor: isSelected ? SABI_GOLD : "rgba(255,255,255,250)",
                                borderColor: isSelected ? SABI_GOLD : "rgba(0,0,0,0.6)",
                              }}
                              className={`flex h-4.5 w-4.5 items-center justify-center rounded-full border shadow-sm transition-all ${
                                !isSelected && "hover:border-white/60"
                              }`}
                            >
                              <CheckIcon size="10px" color={isSelected ? "#fff" : "rgba(0,0,0,0.6)"} />
                            </div>
                          </button>
                        )}
                      </Carousel.Item>
                    )
                  })}
                </Carousel>
              ) : !isDbReady ? (
                <div className="flex h-16 w-full items-center justify-center gap-2 text-[8px] font-bold tracking-[0.2em] text-zinc-600 uppercase italic">
                  <LoadingSpinner size="12px" color="rgba(255,255,255,0.2)" />
                  Loading Database...
                </div>
              ) : (
                <div className="flex h-16 w-full items-center justify-center text-[10px] font-bold tracking-widest text-zinc-600 uppercase italic">
                  No recordings yet
                </div>
              )}
            </div>
          </Tool.Showcase>
        )}
      </Tool>

      {/* FileSet Library Modal - Identical to CameraModal for consistency */}
      <Modal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        className="w-[90vw] max-w-lg border border-white/5 bg-zinc-700/80 p-0 shadow-[0_40px_100px_rgba(0,0,0,0.8)]"
      >
        <div className="flex max-h-[85vh] flex-col overflow-hidden">
          {/* Header Area */}
          <div className="relative border-b border-white/5 px-8 pt-10 pb-6">
            <h3
              style={{ color: SABI_GOLD }}
              className="flex items-center gap-2 text-[10px] font-black tracking-[0.4em] uppercase"
            >
              Collection Library
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                const newName = formData.get("setName") as string
                if (newName.trim()) {
                  switchFileSet(newName.trim())
                  setIsLibraryOpen(false)
                }
              }}
              className="mt-6 flex items-baseline gap-4"
            >
              <div className="group relative flex-1">
                <input
                  key={isLibraryOpen ? currentFileSet : "closed"}
                  type="text"
                  name="setName"
                  defaultValue={currentFileSet}
                  autoFocus
                  className="w-full bg-transparent py-2 text-xl font-bold text-zinc-100 placeholder:text-zinc-700 focus:outline-none"
                  placeholder="Name collection..."
                />
                <div
                  className="absolute bottom-0 left-0 h-0.5 w-full bg-zinc-800 transition-all group-focus-within:bg-current"
                  style={{ backgroundColor: "rgba(159, 137, 14, 0.3)" }}
                />
                <div
                  className="absolute bottom-0 left-0 h-0.5 w-0 bg-current transition-all duration-500 group-focus-within:w-full"
                  style={{ backgroundColor: SABI_GOLD }}
                />
              </div>
              <button
                type="submit"
                style={{ color: SABI_GOLD }}
                className="text-[10px] font-black tracking-widest uppercase transition-opacity hover:opacity-50"
              >
                Create / Switch
              </button>
            </form>
          </div>

          {/* Library Grid */}
          <div className="custom-scrollbar flex-1 overflow-y-auto bg-zinc-950/20 px-4 py-6 sm:px-8">
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-2">
              {fileSetInfo.map((set) => (
                <button
                  key={set.name}
                  onClick={() => {
                    switchFileSet(set.name)
                    setIsLibraryOpen(false)
                  }}
                  className={`group flex flex-col items-start transition-all ${
                    currentFileSet === set.name ? "opacity-100" : "opacity-60 hover:opacity-100"
                  }`}
                >
                  <div
                    className={`relative aspect-video w-full overflow-hidden transition-all duration-500 ${
                      currentFileSet === set.name
                        ? "border border-zinc-500 shadow-[0_0_20px_rgba(159,137,14,0.1)]"
                        : "border border-zinc-800 hover:border-zinc-500"
                    }`}
                  >
                    {set.latestImageUrl ? (
                      <Image
                        src={set.latestImageUrl}
                        alt={set.name}
                        fill
                        unoptimized
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/40">
                        {/* Using MicIcon here as a generic placeholder if no image exists in the set */}
                        <MicIcon size="h-6 w-6" color="rgba(255,255,255,0.05)" />
                      </div>
                    )}

                    <div className="absolute top-2 right-2">
                      <div className="rounded-xs bg-black/40 px-1.5 py-0.5 text-[7px] font-bold tracking-widest text-zinc-300 uppercase backdrop-blur-md">
                        {set.count} Items
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex w-full flex-col px-0.5">
                    <div className="flex items-center justify-between">
                      <span
                        className={`truncate text-[10px] font-black tracking-[0.2em] uppercase transition-colors ${
                          currentFileSet === set.name ? "text-zinc-100" : "text-zinc-500"
                        }`}
                      >
                        {set.name}
                      </span>
                      {currentFileSet === set.name && (
                        <div style={{ backgroundColor: SABI_GOLD }} className="h-1 w-1 animate-pulse rounded-full" />
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-white/5 p-6 text-center">
            <button
              onClick={() => setIsLibraryOpen(false)}
              className="text-[9px] font-bold tracking-[0.3em] text-zinc-600 uppercase transition-colors hover:text-zinc-300"
            >
              Close Archive
            </button>
          </div>
        </div>
      </Modal>
    </Modal>
  )
}

export default MicrophoneModal
