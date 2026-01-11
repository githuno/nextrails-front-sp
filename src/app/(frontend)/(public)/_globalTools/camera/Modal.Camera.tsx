import { Carousel, CarouselItem, Modal } from "@/components/atoms"
import Image from "next/image"
import React, { useEffect, useRef, useState } from "react"
import { Tool } from "../_components/GlobalTool"
import { LoadingSpinner, MenuIcon, PictureIcon, StopIcon, SwitchCameraIcon } from "../_components/Icons"
import { useToolActionStore } from "../_hooks/useToolActionStore"
import { cameraActions, useCameraState } from "./cameraStore"

interface CameraModalProps {
  isOpen: boolean
  onClose: () => void
  onScan?: (data: string) => void
  onSelect?: () => void
}

const CameraModal: React.FC<CameraModalProps> = ({ isOpen, onClose, onScan, onSelect }) => {
  const { isDbReady, isWebViewOpen, webUrl, closeWebView, currentFileSet, fileSetInfo, switchFileSet } =
    useToolActionStore()
  const cameraState = useCameraState()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)

  const [showDeviceList, setShowDeviceList] = useState(false)
  const [isLongPressing, setIsLongPressing] = useState(false)
  const [viewingIndex, setViewingIndex] = useState<number | null>(null)
  const [isLibraryOpen, setIsLibraryOpen] = useState(false)

  // アクション（コールバック）の登録
  useEffect(() => {
    cameraActions.setCallbacks({ onScan, onSelect })
  }, [onScan, onSelect])

  // モーダル開閉時の初期化・クリーンアップ
  useEffect(() => {
    if (!isOpen) {
      cameraActions.cleanup()
      return
    }
    const setupCamera = async () => {
      if (videoRef.current && canvasRef.current) {
        await cameraActions.setup(videoRef.current, canvasRef.current)
        cameraActions.startQrScan()
        cameraActions.startOrientationTracking()
      }
    }
    setupCamera()
  }, [isOpen])

  // ImageViewer表示中はスキャンを止めてUI応答性を優先
  useEffect(() => {
    if (!isOpen) return
    if (viewingIndex !== null) {
      if (cameraState.isScanning) cameraActions.stopQrScan()
      return
    }
    if (cameraState.isAvailable && !cameraState.isRecording && !cameraState.isScanning) {
      cameraActions.startQrScan()
    }
  }, [isOpen, viewingIndex, cameraState.isAvailable, cameraState.isRecording, cameraState.isScanning])

  const handleSwitchDevice = async (deviceId?: string) => {
    setShowDeviceList(false)
    await cameraActions.switchDevice(deviceId)
    cameraActions.startQrScan()
  }

  const handleMainActionPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    if (cameraState.isRecording) return
    setIsLongPressing(true)
    longPressTimerRef.current = setTimeout(() => {
      cameraActions.stopQrScan()
      cameraActions.startRecord()
      setIsLongPressing(false)
    }, 300) // 300ms長押しで録画開始
  }

  const handleMainActionPointerUp = (e: React.PointerEvent) => {
    e.preventDefault()
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    setIsLongPressing(false)
  }

  const handleMainActionClick = async () => {
    if (cameraState.isRecording) {
      cameraActions.stopRecord((blob) => {
        confirm(`Save recorded video (${(blob.size / 1024).toFixed(2)} KB)?`) // && cameraActions.saveCapturedFile(blob)
        cameraActions.startQrScan()
      })
    } else {
      await cameraActions.capture()
    }
  }

  if (!isOpen) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} backdropClassName="backdrop:bg-transparent">
      <Tool className="bg-transparent" enableBackgroundTap onBackgroundTap={() => console.log("maximize")}>
        {/* Main Viewer: プレビュー */}
        <Tool.Main>
          <>
            {cameraState.isAvailable === null && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-950">
                <LoadingSpinner size="48px" color="#3b82f6" />
                <p className="mt-4 animate-pulse text-xs tracking-widest text-zinc-500 uppercase">Initializing...</p>
              </div>
            )}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`${cameraState.isCapturing ? "scale-[0.98] brightness-50" : "scale-100 brightness-100"} ${cameraState.isAvailable ? "opacity-100" : "opacity-0"}`}
            />
            <canvas ref={canvasRef} className="hidden" />
            {/* QR Overlay */}
            {cameraState.isScanning && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative h-48 w-48 rounded-lg border-2 border-blue-500/30">
                  <div className="absolute inset-0 animate-pulse rounded-lg bg-blue-500/5" />
                  {/* Corner accents */}
                  <div className="absolute -top-1 -left-1 h-6 w-6 rounded-tl-lg border-t-4 border-l-4 border-blue-500" />
                  <div className="absolute -top-1 -right-1 h-6 w-6 rounded-tr-lg border-t-4 border-r-4 border-blue-500" />
                  <div className="absolute -bottom-1 -left-1 h-6 w-6 rounded-bl-lg border-b-4 border-l-4 border-blue-500" />
                  <div className="absolute -right-1 -bottom-1 h-6 w-6 rounded-br-lg border-r-4 border-b-4 border-blue-500" />

                  {/* Scanning line: Tailwind v4 arbitrary animation */}
                  <div className="@keyframes-scan:[0%{top:0}100%{top:100%}] absolute left-0 h-1 w-full animate-[scan_2s_linear_infinite] bg-linear-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
                </div>
                {cameraState.scannedData && (
                  <div className="absolute bottom-10 animate-bounce rounded-full bg-blue-600 px-6 py-2 text-sm font-bold shadow-xl">
                    QR Detected: {cameraState.scannedData}
                  </div>
                )}
              </div>
            )}
            {/* Recording Indicator */}
            {cameraState.isRecording && (
              <div className="absolute top-24 left-1/2 flex -translate-x-1/2 animate-pulse items-center gap-2 rounded-full bg-red-600/90 px-4 py-1 text-[10px] font-bold tracking-widest text-white uppercase shadow-lg">
                <div className="h-2 w-2 rounded-full bg-white" />
                Recording
              </div>
            )}
          </>
        </Tool.Main>

        {/* Controller: 操作系 */}
        <Tool.Controller>
          <div className="flex items-center justify-around gap-4 px-4">
            {/* Device Switch */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowDeviceList(!showDeviceList)
                }}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/80 transition-all hover:bg-zinc-700 active:scale-90"
              >
                <SwitchCameraIcon size="36px" color="#fff" />
              </button>
              {showDeviceList && (
                <div className="absolute bottom-16 left-0 w-48 rounded-2xl border border-zinc-800 bg-zinc-900/95 p-2 shadow-2xl backdrop-blur-xl">
                  <div className="mb-2 px-2 py-1 text-[10px] font-bold text-zinc-500 uppercase">Select Device</div>
                  {cameraState.availableDevices.map((device) => (
                    <button
                      key={device.deviceId}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSwitchDevice(device.deviceId)
                      }}
                      className={`w-full rounded-xl px-3 py-2 text-left text-xs transition-colors ${
                        cameraState.deviceId === device.deviceId
                          ? "bg-blue-600 text-white"
                          : "text-zinc-300 hover:bg-zinc-800"
                      }`}
                    >
                      {device.label || `Camera ${device.deviceId.slice(0, 5)}`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Main Action: Capture or Stop Record */}
            <div className="relative flex items-center justify-center">
              {cameraState.isRecording ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleMainActionClick()
                  }}
                  className="hover:shadow-3xl flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br from-white to-gray-100 shadow-2xl ring-0 ring-white/20 transition-all duration-300 hover:ring-2 active:scale-95"
                >
                  <StopIcon size="32px" color="#ef4444" />
                </button>
              ) : (
                <button
                  onContextMenu={(e) => e.preventDefault()}
                  onPointerDown={handleMainActionPointerDown}
                  onPointerUp={handleMainActionPointerUp}
                  onPointerLeave={handleMainActionPointerUp}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleMainActionClick()
                  }}
                  className={`group hover:shadow-3xl relative flex h-12 w-12 touch-none items-center justify-center rounded-full bg-linear-to-br from-white to-gray-100 shadow-2xl ring-0 ring-white/20 transition-all duration-300 select-none hover:ring-2 active:scale-95 ${isLongPressing ? "ring-4 ring-red-500" : ""}`}
                >
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-full border-2 border-zinc-200 transition-transform group-hover:scale-110">
                    <div className="h-8 w-8 rounded-full border border-zinc-300/50"></div>
                  </div>
                </button>
              )}
            </div>

            {/* Select Image (Gallery) */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onSelect?.()
              }}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/80 transition-all hover:bg-zinc-700 active:scale-90"
            >
              <PictureIcon size="28px" color="#fff" />
            </button>
          </div>
        </Tool.Controller>

        {/* Showcase: 撮影済み画像一覧 */}
        <Tool.Showcase>
          <div className="grid grid-rows-[auto_1fr] gap-2">
            <div className="flex justify-end px-1">
              {/* Library / Set Management button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsLibraryOpen(true)
                }}
                className="group flex h-8 items-center gap-2 rounded-full border border-white/5 bg-zinc-800/80 px-3 shadow-lg transition-all hover:bg-zinc-700 active:scale-95"
              >
                <MenuIcon size="14px" color="#fff" />
                <div className="flex flex-col items-start leading-none">
                  <span className="max-w-64 truncate text-[14px] font-bold text-zinc-100">{currentFileSet}</span>
                </div>
              </button>
            </div>
            {/* ギャラリー */}
            {cameraState.capturedImages.length > 0 ? (
              <Carousel containerClassName="gap-x-3 h-16">
                {cameraState.capturedImages.map((image, index) => (
                  <CarouselItem key={index}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setViewingIndex(index)
                      }}
                      className={`h-full overflow-hidden rounded-xs shadow-2xl transition-opacity ${image.isPending ? "opacity-50" : ""}`}
                    >
                      <Image
                        src={image.url}
                        alt={`Captured ${index}`}
                        width={96}
                        height={54}
                        unoptimized
                        className={`h-full w-auto rounded-xs border border-zinc-700/30 object-contain transition-all group-hover:scale-105 group-hover:brightness-110 ${image.isPending ? "grayscale" : ""}`}
                      />
                      {image.isPending && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <LoadingSpinner size="12px" color="#fff" />
                        </div>
                      )}
                    </button>
                    {/* remove */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        cameraActions.removeCapturedImage(index)
                        if (viewingIndex === index) setViewingIndex(null)
                      }}
                      className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-zinc-700/80 shadow-md backdrop-blur-md transition-opacity group-hover:opacity-100 hover:bg-gray-600/50 hover:text-white sm:opacity-0"
                    >
                      ✕
                    </button>
                  </CarouselItem>
                ))}
              </Carousel>
            ) : !isDbReady ? (
              <div className="flex h-16 w-full items-center justify-center gap-2 text-[8px] font-bold tracking-[0.2em] text-zinc-600 uppercase italic">
                <LoadingSpinner size="12px" color="rgba(255,255,255,0.2)" />
                Loading Database...
              </div>
            ) : (
              <div className="flex h-16 w-full items-center justify-center text-[10px] font-bold tracking-widest text-zinc-600 uppercase italic">
                No captures yet
              </div>
            )}
          </div>
        </Tool.Showcase>
      </Tool>

      {/* ImageViewer using Modal and Carousel */}
      <Modal isOpen={viewingIndex !== null} onClose={() => setViewingIndex(null)} className="h-[90vh] w-[90vw] p-0">
        {viewingIndex !== null && (
          <Carousel index={viewingIndex} className="p-4" containerClassName="h-full">
            {cameraState.capturedImages.map((image, index) => (
              <CarouselItem key={index}>
                <Image
                  src={image.url}
                  alt={`View ${index}`}
                  fill
                  unoptimized
                  className="object-contain drop-shadow-2xl"
                  priority={index === viewingIndex}
                />
              </CarouselItem>
            ))}
          </Carousel>
        )}
      </Modal>

      {/* FileSet Library Modal - Integrated Management */}
      <Modal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        className="shadow-3xl w-[95vw] max-w-md overflow-hidden border border-white/10 p-0"
        backdropClassName="backdrop:bg-zinc-950/80 backdrop:backdrop-blur-sm"
      >
        <div className="flex max-h-[85vh] flex-col bg-zinc-900">
          {/* Header & Create Input */}
          <div className="border-b border-zinc-800 bg-linear-to-b from-zinc-800 to-zinc-900 px-8 pt-10 pb-6">
            <h3 className="mb-2 flex items-center gap-2 text-xl font-bold text-white">
              <PictureIcon size="20px" color="#3b82f6" />
              FileSet Library
            </h3>
            <p className="mb-8 text-[10px] leading-relaxed font-bold tracking-[0.2em] text-zinc-500 uppercase">
              Organize your workspace into independent collections.
            </p>

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
              className="group relative"
            >
              <input
                key={isLibraryOpen ? currentFileSet : "closed"}
                type="text"
                name="setName"
                defaultValue={currentFileSet}
                autoFocus
                className="w-full rounded-2xl border border-zinc-700 bg-zinc-950/50 px-6 py-4 text-lg font-bold text-white shadow-inner transition-all outline-none placeholder:text-zinc-700 focus:border-blue-500"
                placeholder="Name a new collection..."
              />
              <button
                type="submit"
                className="absolute top-2 right-2 bottom-2 rounded-xl bg-blue-600 px-5 text-[10px] font-black tracking-widest text-white uppercase shadow-lg transition-all hover:bg-blue-500 active:scale-95"
              >
                Execute
              </button>
            </form>
          </div>

          {/* Library Grid */}
          <div className="scrollbar-hide flex-1 overflow-y-auto p-6">
            <div className="mb-4 flex items-center justify-between px-2">
              <h4 className="text-[10px] font-black tracking-[0.25em] text-zinc-600 uppercase">Existing Collections</h4>
              <span className="text-[10px] font-bold text-zinc-700">{fileSetInfo.length} sets</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {fileSetInfo.map((set) => (
                <button
                  key={set.name}
                  onClick={() => {
                    switchFileSet(set.name)
                    setIsLibraryOpen(false)
                  }}
                  className={`group relative flex flex-col text-left transition-all active:scale-[0.98] ${
                    currentFileSet === set.name
                      ? "ring-2 ring-blue-500 ring-offset-4 ring-offset-zinc-900"
                      : "hover:-translate-y-0.5"
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/5 bg-zinc-950 shadow-xl">
                    {set.latestImageUrl ? (
                      <Image
                        src={set.latestImageUrl}
                        alt={set.name}
                        fill
                        unoptimized
                        className="object-cover opacity-80 transition-all group-hover:scale-110 group-hover:opacity-100"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center border-2 border-dashed border-zinc-800">
                        <PictureIcon size="24px" color="#18181b" />
                      </div>
                    )}
                    {/* Badge */}
                    <div className="absolute top-2 right-2 rounded-md border border-white/10 bg-black/60 px-2 py-0.5 text-[8px] font-black tracking-tighter text-white uppercase backdrop-blur-md">
                      {set.count} items
                    </div>
                  </div>

                  {/* Set Name */}
                  <div className="mt-2 px-1">
                    <div className="truncate text-xs font-black tracking-widest text-zinc-400 uppercase transition-colors group-hover:text-blue-400">
                      {set.name}
                    </div>
                  </div>

                  {/* Active Indicator */}
                  {currentFileSet === set.name && (
                    <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-zinc-900 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-center bg-zinc-950/50 p-4">
            <button
              onClick={() => setIsLibraryOpen(false)}
              className="text-[10px] font-bold tracking-[0.2em] text-zinc-600 uppercase transition-colors hover:text-white"
            >
              Back to Camera
            </button>
          </div>
        </div>
      </Modal>

      {/* WebViewer Modal: UI実体をCameraModal側で保持 */}

      <Modal
        isOpen={!!isWebViewOpen}
        onClose={() => closeWebView()}
        className="h-full max-h-none w-full max-w-none p-0"
        backdropClassName="backdrop:bg-black/90 backdrop:backdrop-blur-md"
      >
        <div className="relative h-full w-full overflow-hidden bg-white">
          {webUrl && (
            <iframe
              src={`/api/proxy/qr?url=${encodeURIComponent(webUrl)}`}
              className="h-full w-full border-none"
              title="Webview"
            />
          )}
        </div>
      </Modal>
    </Modal>
  )
}

export default CameraModal
