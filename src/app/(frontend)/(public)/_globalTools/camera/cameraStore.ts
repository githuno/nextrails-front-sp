import { useExternalStore } from "../_hooks/atom/useExternalStore"
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
  capturedImages: CapturedImage[]
  error: Error | null
  aspectRatio: number | null
  deviceOrientation: number // デバイスの物理的な向き 0, 90, 180, 270
}

export interface CapturedImage {
  url: string
  idbKey?: string
  dbId?: string
  isPending?: boolean
}

export interface SavedFileResult {
  idbKey: string
  id: string
}

export interface CameraExternalActions {
  saveCapturedFile?: (file: Blob | File, options?: { fileName?: string }) => Promise<SavedFileResult>
  getFileWithUrl?: (idbKey: string) => Promise<string | null>
  deleteFile?: (idbKey: string, dbId: string) => Promise<void>
}

interface CameraStateInternal extends CameraState {
  stream: MediaStream | null
  videoElement: HTMLVideoElement | null
  canvasElement: HTMLCanvasElement | null
  mediaRecorder: MediaRecorder | null
  scanStopper: (() => void) | null
  recordedBlob: Blob | null
  aspectRatio: number | null
  orientationListener: ((e: DeviceOrientationEvent) => void) | null
  externalActions: CameraExternalActions
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
  deviceOrientation: 0,
  orientationListener: null,
  externalActions: {},
  callbacks: {},
}
const listeners: Set<() => void> = new Set()

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
  deviceOrientation: 0,
}

// Cache for getSnapshot to avoid infinite loops
let snapshotCache: CameraState = serverSnapshot
let snapshotVersion = 0
let currentVersion = 0

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
  if (currentVersion !== snapshotVersion) {
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
      deviceOrientation: state.deviceOrientation,
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

    // プレビュー補正（非ミラーのまま、フロント×横向きで上下反転する症状を抑制）
    applyPreviewOrientationFix()
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

const applyPreviewOrientationFix = (): void => {
  if (!state.videoElement) return
  // 撮影はcanvas側で補正済み。ここではプレビューのみを最小限補正する。
  // Tailwindのscale等（transform）と干渉しないよう、CSS individual transformのrotateを使う。
  const shouldFlipVertical =
    state.facingMode === "user" && (state.deviceOrientation === 90 || state.deviceOrientation === 270)
  state.videoElement.style.setProperty("transform-origin", "center")
  state.videoElement.style.setProperty("rotate", shouldFlipVertical ? "180deg" : "0deg")
}

const getAvailableDevices = async (): Promise<MediaDeviceInfo[]> => {
  const client = getCameraClient()
  const devices = await client.getAvailableDevices()
  state.availableDevices = devices
  state.isAvailable = devices.length > 0
  notify()
  return devices
}

const checkAvailability = async (): Promise<boolean> => {
  if (state.isAvailable !== null) return state.isAvailable
  const devices = await getAvailableDevices()
  return devices.length > 0
}

const switchDevice = async (deviceId?: string): Promise<void> => {
  if (!state.videoElement || !state.canvasElement) return
  const nextFacingMode = state.facingMode === "user" ? "environment" : "user"
  stopQrScan() // ストリームのみクリーンアップ（isAvailableをnullにしない）
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
  if (deviceId) {
    await setup(state.videoElement, state.canvasElement, deviceId)
  } else {
    await setup(state.videoElement, state.canvasElement, undefined, nextFacingMode)
  }
  // facingModeが変わり得るため、プレビュー補正を再適用
  applyPreviewOrientationFix()
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

const setExternalActions = (actions: Partial<CameraStateInternal["externalActions"]>): void => {
  state.externalActions = { ...state.externalActions, ...actions }
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
  const capturePromise = client.capture(
    state.videoElement,
    state.canvasElement,
    state.deviceOrientation,
    async (url, blob) => {
      if (url && blob) {
        let savedInfo: CapturedImage = { url, idbKey: undefined, dbId: undefined }
        // 外部アクション（永続化）があれば実行
        if (state.externalActions.saveCapturedFile) {
          try {
            const result = await state.externalActions.saveCapturedFile(blob)
            if (result) {
              savedInfo = {
                url,
                idbKey: result.idbKey,
                dbId: result.id,
              }
            }
          } catch (e) {
            console.error("Failed to persist captured image:", e)
          }
          // Note: ここでstate.capturedImagesを直接更新しない!
          // actions.saveCapturedFile(blob)の内部でsyncData()が呼ばれ、
          // cameraActions.setCapturedImages経由で最新リストが流れてくる。
        } else {
          // 外部アクションがない場合、フォールバックとしてオンメモリ保存
          state.capturedImages = [savedInfo, ...state.capturedImages]
          notify()
        }
      }
      onComplete?.(url)
    },
  )
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

const removeCapturedImage = async (index: number): Promise<void> => {
  const target = state.capturedImages[index]
  if (!target) return

  // 永続化されている場合は削除アクションを実行
  if (target.idbKey && target.dbId && state.externalActions.deleteFile) {
    try {
      await state.externalActions.deleteFile(target.idbKey, target.dbId)
      // ToolActionStore側でsyncData()が走り、setCapturedImages経由で状態が更新されるため
      // ここで手動でstate.capturedImagesを操作しない
    } catch (e) {
      console.error("Failed to delete persisted file:", e)
    }
  } else {
    // 永続化されていない(インメモリのみの)場合は手動削除
    if (target.url.startsWith("blob:")) {
      URL.revokeObjectURL(target.url)
    }
    state.capturedImages = state.capturedImages.filter((_, i) => i !== index)
    notify()
  }
}

const addCapturedImage = (image: CapturedImage | string): void => {
  const newImage = typeof image === "string" ? { url: image } : image
  state.capturedImages = [newImage, ...state.capturedImages]
  notify()
}

const setCapturedImages = (images: CapturedImage[]): void => {
  state.capturedImages = images
  notify()
}

const addCapturedFile = async (file: Blob | File): Promise<void> => {
  const url = URL.createObjectURL(file)
  let savedInfo: CapturedImage = { url, idbKey: undefined, dbId: undefined }

  if (state.externalActions.saveCapturedFile) {
    try {
      const result = await state.externalActions.saveCapturedFile(file)
      if (result) {
        savedInfo = {
          url,
          idbKey: result.idbKey,
          dbId: result.id,
        }
      }
    } catch (e) {
      console.error("Failed to persist added file:", e)
    }
  }

  state.capturedImages = [savedInfo, ...state.capturedImages]
  notify()
}

const startOrientationTracking = (): void => {
  if (state.orientationListener) return
  const handleOrientation = (event: DeviceOrientationEvent) => {
    const { beta, gamma } = event
    if (beta === null || gamma === null) return
    // フロントカメラを非ミラー表示している場合、左右(roll)の体感とgammaの符号が逆に見えることがあるため補正する
    const gammaForUi = state.facingMode === "user" ? -gamma : gamma
    // 微妙な角度ではセンサー値が揺れて0/180が頻繁に切り替わり、プレビューが不安定になる。
    // 本ツールでは横持ちの補正(90/270)が主目的なので、portraitは常に0扱いに固定し、
    // 横持ち判定のみヒステリシス付きで安定化する。
    const absRoll = Math.abs(gammaForUi)
    const prevIsLandscape = state.deviceOrientation === 90 || state.deviceOrientation === 270
    const LANDSCAPE_ENTER = 50
    const LANDSCAPE_EXIT = 40
    const isLandscape = prevIsLandscape ? absRoll >= LANDSCAPE_EXIT : absRoll >= LANDSCAPE_ENTER
    const nextOrientation = isLandscape ? (gammaForUi > 0 ? 90 : 270) : 0
    state.deviceOrientation = nextOrientation
    // プレビュー補正はここで追従させる（UIの再描画は不要）
    applyPreviewOrientationFix()
  }
  window.addEventListener("deviceorientation", handleOrientation)
  state.orientationListener = handleOrientation
}

const stopOrientationTracking = (): void => {
  if (state.orientationListener) {
    window.removeEventListener("deviceorientation", state.orientationListener)
    state.orientationListener = null
  }
}

const cleanup = (): void => {
  stopQrScan()
  stopOrientationTracking()
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
  // state.isAvailable はリセットしない（ハードウェアの有無は基本変わらないため）
  state.isScanning = false
  state.isRecording = false
  state.isCapturing = false
  state.aspectRatio = null
  state.callbacks = {}
  notify()
}

const cameraActions = {
  checkAvailability,
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
  addCapturedFile,
  setCapturedImages,
  setCallbacks,
  setExternalActions,
  startOrientationTracking,
  cleanup,
}

export { cameraActions }
export const useCameraState = () => {
  return useExternalStore<CameraState>({ subscribe, getSnapshot, getServerSnapshot })
}

// 自動初期化: ストア読み込み時にデバイスチェックを開始
if (typeof window !== "undefined") {
  getAvailableDevices().catch((err) => {
    console.warn("[CameraStore] Auto-initialization device check failed:", err)
  })
}
