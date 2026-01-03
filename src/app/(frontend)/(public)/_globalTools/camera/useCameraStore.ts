import { useSyncExternalStore } from "react"
import { createCameraClient, type CameraConfig } from "./cameraClient"

interface CameraState {
  isAvailable: boolean | null // null:初期化中、true:利用可能、false:利用不可
  isScanning: boolean
  isRecording: boolean
  isCapturing: boolean
  isMirror: boolean
  deviceId: string | null
  facingMode: "user" | "environment"
  availableDevices: MediaDeviceInfo[]
  scannedData: string | null
  capturedImages: string[]
  error: Error | null
  aspectRatio: number | null
}

interface CameraStateInternal extends CameraState {
  stream: MediaStream | null
  videoElement: HTMLVideoElement | null
  canvasElement: HTMLCanvasElement | null
  mediaRecorder: MediaRecorder | null
  scanStopper: (() => void) | null
  recordedBlob: Blob | null
  aspectRatio: number | null
  callbacks: {
    onScan?: (data: string) => void
    onCapture?: (url: string | null) => void
    onSelect?: () => void
  }
}

let cameraClient: ReturnType<typeof createCameraClient> | null = null
const state: CameraStateInternal = {
  isAvailable: null,
  isScanning: false,
  isRecording: false,
  isCapturing: false,
  isMirror: true,
  deviceId: null,
  facingMode: "environment",
  availableDevices: [],
  scannedData: null,
  capturedImages: [],
  error: null,
  stream: null,
  videoElement: null,
  canvasElement: null,
  mediaRecorder: null,
  scanStopper: null,
  recordedBlob: null,
  aspectRatio: null,
  callbacks: {},
}
const listeners: Set<() => void> = new Set()

// Cache for getSnapshot to avoid infinite loops
let snapshotCache: CameraState | null = null
let snapshotVersion = 0
let currentVersion = 0

// Server snapshot is static since server can't access camera
const serverSnapshot: CameraState = {
  isAvailable: false,
  isScanning: false,
  isRecording: false,
  isCapturing: false,
  isMirror: false,
  deviceId: null,
  facingMode: "environment",
  availableDevices: [],
  scannedData: null,
  capturedImages: [],
  error: null,
  aspectRatio: null,
}

const getCameraClient = (config?: CameraConfig) => {
  if (!cameraClient) {
    cameraClient = createCameraClient(config)
  }
  return cameraClient
}

const notify = () => {
  snapshotVersion++
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getSnapshot = (): CameraState => {
  if (snapshotCache === null || currentVersion !== snapshotVersion) {
    snapshotCache = {
      isAvailable: state.isAvailable,
      isScanning: state.isScanning,
      isRecording: state.isRecording,
      isCapturing: state.isCapturing,
      isMirror: state.isMirror,
      deviceId: state.deviceId,
      facingMode: state.facingMode,
      availableDevices: state.availableDevices,
      scannedData: state.scannedData,
      capturedImages: state.capturedImages,
      error: state.error,
      aspectRatio: state.aspectRatio,
    }
    currentVersion = snapshotVersion
  }
  return snapshotCache
}

const getServerSnapshot = (): CameraState => {
  return serverSnapshot
}

const setup = async (
  videoElement: HTMLVideoElement,
  canvasElement: HTMLCanvasElement,
  deviceId?: string,
  facingMode?: "user" | "environment",
): Promise<void> => {
  try {
    const client = getCameraClient()
    state.videoElement = videoElement
    state.canvasElement = canvasElement

    const targetFacingMode = facingMode || state.facingMode
    state.stream = await client.setupWithVideo(videoElement, deviceId, targetFacingMode)

    // ストリームから実際の設定を取得
    const track = state.stream.getVideoTracks()[0]
    const settings = track.getSettings()
    const { width, height } = settings
    state.aspectRatio = width && height ? width / height : null
    state.deviceId = settings.deviceId || deviceId || null
    state.facingMode = (settings.facingMode as "user" | "environment") || targetFacingMode
    state.isMirror = state.facingMode === "user"
    state.isAvailable = true

    // デバイス一覧も更新
    await getAvailableDevices()

    notify()
  } catch (error) {
    const cameraError = error instanceof Error ? error : new Error("Camera initialization failed")
    state.isAvailable = false
    state.error = cameraError
    notify()
    throw cameraError
  }
}

const getAvailableDevices = async (): Promise<MediaDeviceInfo[]> => {
  const client = getCameraClient()
  const devices = await client.getAvailableDevices()
  state.availableDevices = devices
  notify()
  return devices
}

const switchDevice = async (deviceId?: string): Promise<void> => {
  if (!state.videoElement || !state.canvasElement) return

  const nextFacingMode = state.facingMode === "user" ? "environment" : "user"

  cleanup()

  if (deviceId) {
    await setup(state.videoElement, state.canvasElement, deviceId)
  } else {
    await setup(state.videoElement, state.canvasElement, undefined, nextFacingMode)
  }
}

const startQrScan = (): void => {
  if (!state.videoElement || !state.canvasElement) {
    throw new Error("Video or canvas element not set")
  }
  const client = getCameraClient()
  state.isScanning = true
  state.scannedData = null
  notify()

  state.scanStopper = client.startQrScan(state.videoElement, state.canvasElement, (data) => {
    if (state.scannedData !== data) {
      state.scannedData = data
      notify()
      // 外部アクションが登録されていれば実行し、データをクリアする
      if (state.callbacks.onScan) {
        state.callbacks.onScan(data)
        state.scannedData = null
        notify()
      }
    }
  })
}

const setCallbacks = (callbacks: Partial<CameraStateInternal["callbacks"]>): void => {
  state.callbacks = { ...state.callbacks, ...callbacks }
}

const clearScannedData = (): void => {
  state.scannedData = null
  notify()
}

const stopQrScan = (): void => {
  if (state.scanStopper) {
    state.scanStopper()
    state.scanStopper = null
  }
  state.isScanning = false
  state.scannedData = null
  notify()
}

const capture = async (onComplete?: (url: string | null) => void): Promise<void> => {
  if (!state.videoElement || !state.canvasElement) {
    onComplete?.(null)
    return
  }
  const client = getCameraClient()
  state.isCapturing = true
  notify()

  // 撮影処理と最低表示時間を並行して待機
  const capturePromise = client.capture(state.videoElement, state.canvasElement, (url) => {
    if (url) {
      state.capturedImages = [url, ...state.capturedImages]
    }
    onComplete?.(url)
  })
  const delayPromise = new Promise((resolve) => setTimeout(resolve, 200)) // 最低200msはシャッター状態を維持

  await Promise.all([capturePromise, delayPromise])
  state.isCapturing = false
  notify()
}

const startRecord = (): void => {
  if (!state.stream) {
    state.error = new Error("Media stream is not available")
    notify()
    return
  }
  const client = getCameraClient()
  state.isRecording = true
  notify()

  state.mediaRecorder = client.startRecord(state.stream, (blob) => {
    state.recordedBlob = blob
    state.isRecording = false
    notify()
  })
}

const stopRecord = (onComplete: (blob: Blob) => void): void => {
  if (!state.mediaRecorder) return

  state.mediaRecorder.addEventListener(
    "stop",
    () => {
      if (state.recordedBlob) {
        onComplete(state.recordedBlob)
        state.recordedBlob = null
      }
    },
    { once: true },
  )

  state.mediaRecorder.stop()
}

const removeCapturedImage = (index: number): void => {
  state.capturedImages = state.capturedImages.filter((_, i) => i !== index)
  notify()
}

const addCapturedImage = (url: string): void => {
  state.capturedImages = [url, ...state.capturedImages]
  notify()
}

const cleanup = (): void => {
  stopQrScan()

  if (state.mediaRecorder?.state === "recording") {
    state.mediaRecorder.stop()
  }

  if (state.stream) {
    const client = getCameraClient()
    client.cleanupStream(state.stream)
    state.stream = null
  }

  if (state.videoElement) {
    state.videoElement.srcObject = null
  }

  state.isAvailable = null
  state.isScanning = false
  state.isRecording = false
  state.isCapturing = false
  state.aspectRatio = null
  state.callbacks = {}
  notify()
}

const actions = {
  setup,
  switchDevice,
  startQrScan,
  stopQrScan,
  clearScannedData,
  capture,
  startRecord,
  stopRecord,
  removeCapturedImage,
  addCapturedImage,
  setCallbacks,
  cleanup,
}

export const useCameraState = () => {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export const useCameraActions = () => {
  return actions
}
