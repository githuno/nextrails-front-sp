import * as jsQRModule from "jsqr"
const jsQR = ((jsQRModule as unknown as { default: typeof jsQRModule.default }).default ||
  jsQRModule) as typeof jsQRModule.default

// 【Barcode Detection API】
// https://developer.mozilla.org/en-US/docs/Web/API/Barcode_Detection_API

// 続・Webの技術だけで作るQRコードリーダー
// https://qiita.com/kan_dai/items/3486880236a2fcd9b527

// TODO: バーコードスキャナーの実装したい
// TODO: カメラのフラッシュ機能を実装したい
// TODO: カメラのズーム機能を実装したい
// TODO: 撮影時・スキャン時のシャッター音・バイブレーションを実装したい
// TODO: 解像度を変更する機能を実装したい
// TODO: AIモデルへのリアルタイムデータ送信機能を実装したい
// TODO: Web Workers for QR scanning
// TODO: Stream Processing Pipeline
// TODO: Device capability detection
// TODO: Error recovery mechanisms
// TODO: Performance optimizations for video processing
// TODO: 利用可能なカメラデバイスの列挙
// TODO: ビデオ制約のカスタマイズ機能

interface CameraConfig {
  QRSCAN_INTERVAL?: number // QRコードスキャン間隔
  VIDEO_TIMEOUT?: number // ビデオタイムアウト
  PREFERRED_CAMERA?: "environment" | "user" // デフォルトカメラ
  VIDEO_CONSTRAINTS?: MediaTrackConstraints // ビデオ制約
}

const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  frameRate: { ideal: 30 },
}

interface CameraCallbacks {
  onCaptureComplete?: () => void
  onRecordComplete?: () => void
  onError?: (error: Error) => void
}

type BarcodeDetectorDetectedBarcode = {
  rawValue?: string
}

interface BarcodeDetectorLike {
  detect: (image: HTMLVideoElement | HTMLCanvasElement) => Promise<BarcodeDetectorDetectedBarcode[]>
}

type BarcodeDetectorConstructorLike = new (options: { formats: string[] }) => BarcodeDetectorLike

const getBarcodeDetectorConstructor = (): BarcodeDetectorConstructorLike | null => {
  if (typeof window === "undefined") return null
  const maybe = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructorLike }).BarcodeDetector
  return maybe ?? null
}

const createCameraClient = (config: CameraConfig = {}) => {
  const defaultConfig: Required<CameraConfig> = {
    QRSCAN_INTERVAL: 200,
    VIDEO_TIMEOUT: 10000,
    PREFERRED_CAMERA: "environment",
    VIDEO_CONSTRAINTS: VIDEO_CONSTRAINTS,
  }
  const finalConfig = { ...defaultConfig, ...config }

  const checkVideoReady = (videoElement: HTMLVideoElement): Promise<void> => {
    return new Promise<void>((resolve) => {
      const check = () => {
        if (videoElement.readyState === 4 && videoElement.videoWidth > 0) {
          resolve()
        } else {
          requestAnimationFrame(check)
        }
      }
      check()
    })
  }

  const waitForVideoReady = (videoElement: HTMLVideoElement, stream: MediaStream): Promise<void> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Video loading timeout"))
      }, finalConfig.VIDEO_TIMEOUT)

      const cleanup = () => {
        clearTimeout(timeout)
        videoElement.removeEventListener("loadedmetadata", onLoadedMetadata)
        videoElement.removeEventListener("error", onError)
      }

      const onLoadedMetadata = async () => {
        try {
          if (videoElement.paused) {
            await videoElement.play()
          }
          await checkVideoReady(videoElement)
          cleanup()
          resolve()
        } catch (error) {
          // すでに再生中のエラーなどは無視して進める場合もあるが、基本はreject
          if (videoElement.readyState >= 3) {
            cleanup()
            resolve()
          } else {
            cleanup()
            reject(error)
          }
        }
      }

      const onError = (event: Event) => {
        cleanup()
        reject(new Error(`Video error: ${event}`))
      }

      videoElement.addEventListener("loadedmetadata", onLoadedMetadata)
      videoElement.addEventListener("error", onError)
      videoElement.srcObject = stream

      // すでにメタデータがロードされている場合は手動で呼び出す
      if (videoElement.readyState >= 1) {
        onLoadedMetadata()
      }
    })
  }

  const getSensor = async (deviceId?: string, facingMode?: "user" | "environment"): Promise<MediaStream> => {
    const constraints: MediaStreamConstraints = {
      video: {
        ...finalConfig.VIDEO_CONSTRAINTS,
        ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: facingMode || finalConfig.PREFERRED_CAMERA }),
      },
      audio: false,
    }

    try {
      return await navigator.mediaDevices.getUserMedia(constraints)
    } catch (error) {
      console.warn("Failed to get sensor with constraints, falling back to default", error)
      return await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    }
  }

  const setupWithVideo = async (
    videoElement: HTMLVideoElement,
    deviceId?: string,
    facingMode?: "user" | "environment",
  ): Promise<MediaStream> => {
    const stream = await getSensor(deviceId, facingMode)
    await waitForVideoReady(videoElement, stream)
    return stream
  }

  const getAvailableDevices = async (): Promise<MediaDeviceInfo[]> => {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.filter((device) => device.kind === "videoinput")
  }

  const startQrScan = (
    videoElement: HTMLVideoElement,
    canvasElement: HTMLCanvasElement,
    onScan: (data: string) => void,
  ): (() => void) => {
    const context = canvasElement.getContext("2d", { willReadFrequently: true })
    if (!context) return () => {}

    const BarcodeDetectorCtor = getBarcodeDetectorConstructor()
    const detector = BarcodeDetectorCtor ? new BarcodeDetectorCtor({ formats: ["qr_code"] }) : null

    let isScanning = true
    let inFlight = false

    const ensureScanCanvasSize = () => {
      const vw = videoElement.videoWidth
      const vh = videoElement.videoHeight
      if (vw <= 0 || vh <= 0) return

      // jsQR fallback時は getImageData が支配的に重いので、必ず縮小する。
      // QR はある程度の解像度があれば読めるので、長辺 480px 程度に抑える。
      const maxSide = 480
      const scale = Math.min(1, maxSide / Math.max(vw, vh))
      const nextW = Math.max(1, Math.floor(vw * scale))
      const nextH = Math.max(1, Math.floor(vh * scale))
      if (canvasElement.width !== nextW) canvasElement.width = nextW
      if (canvasElement.height !== nextH) canvasElement.height = nextH
    }

    const scan = async () => {
      if (!isScanning) return
      if (inFlight) {
        setTimeout(() => {
          void scan()
        }, finalConfig.QRSCAN_INTERVAL)
        return
      }
      inFlight = true
      if (videoElement.readyState === 4) {
        try {
          if (detector) {
            // ネイティブ実装がある場合はそれを優先（メインスレッド負荷が大きく下がる）
            const codes = await detector.detect(videoElement)
            const first = codes[0]?.rawValue
            if (first) onScan(first)
          } else {
            ensureScanCanvasSize()
            context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height)
            const imageData = context.getImageData(0, 0, canvasElement.width, canvasElement.height)
            const code = jsQR(imageData.data, imageData.width, imageData.height)
            if (code?.data) onScan(code.data)
          }
        } catch {
          // スキャン失敗は無視して継続
        }
      }

      inFlight = false
      setTimeout(() => {
        void scan()
      }, finalConfig.QRSCAN_INTERVAL)
    }

    void scan()
    return () => {
      isScanning = false
    }
  }

  const capture = async (
    videoElement: HTMLVideoElement,
    canvasElement: HTMLCanvasElement,
    deviceOrientation: number, // デバイスの物理的な向き 0, 90, 180, 270
    onComplete: (url: string | null, blob: Blob | null) => void,
  ): Promise<void> => {
    const context = canvasElement.getContext("2d", { alpha: false })
    if (!context) {
      onComplete(null, null)
      return
    }

    // 1. フレーム固定（pauseのみ。currentTimeの設定は重いので避ける）
    videoElement.pause()
    const vw = videoElement.videoWidth
    const vh = videoElement.videoHeight

    // 2. キャンバスサイズ設定（必要時のみ変更してメモリ再確保を抑制したいが、現状は毎回設定）
    const isLandscape = deviceOrientation === 90 || deviceOrientation === 270
    const targetWidth = isLandscape ? vh : vw
    const targetHeight = isLandscape ? vw : vh

    if (canvasElement.width !== targetWidth || canvasElement.height !== targetHeight) {
      canvasElement.width = targetWidth
      canvasElement.height = targetHeight
    }

    // 3. 描画処理
    const draw = () => {
      context.save()
      context.translate(canvasElement.width / 2, canvasElement.height / 2)
      context.rotate((deviceOrientation * Math.PI) / 180)
      context.drawImage(videoElement, -vw / 2, -vh / 2, vw, vh)
      context.restore()

      // 描画が終わったら即座に再生を再開（ユーザーへのフィードバックを最優先）
      videoElement.play().catch(() => {})
    }
    draw()

    // 4. 即座にプレビューURLを通知（UIのトレイに表示するため）
    const previewUrl = canvasElement.toDataURL("image/jpeg", 0.6)
    onComplete(previewUrl, null)

    // 5. Blob生成（非同期）。
    // キャンバスの安全な解放を待つため、Promiseはこの完了を待機する。
    // コンポーネント側でシャッターを早く開けたい場合は、このPromiseをawaitせずにisCapturingを更新すればよい。
    const processBlob = async () => {
      return new Promise<void>((resolve) => {
        canvasElement.toBlob(
          (blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob)
              onComplete(url, blob) // 2回目の通知（本当のURLとBlob）
            }
            resolve()
          },
          "image/jpeg",
          0.85,
        )
      })
    }

    return processBlob()
  }

  const startRecord = (stream: MediaStream, onDataAvailable: (blob: Blob) => void): MediaRecorder => {
    const recordedChunks: Blob[] = []
    const mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" })

    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data)
      }
    })

    mediaRecorder.addEventListener("stop", () => {
      const blob = new Blob(recordedChunks, { type: "video/webm" })
      onDataAvailable(blob)
    })

    mediaRecorder.start()
    return mediaRecorder
  }

  const cleanupStream = (stream: MediaStream | null): void => {
    if (stream) {
      stream.getTracks().forEach((track) => {
        track.stop()
        stream.removeTrack(track)
      })
    }
  }

  return {
    setupWithVideo,
    getAvailableDevices,
    startQrScan,
    capture,
    startRecord,
    cleanupStream,
  }
}

export { createCameraClient, type CameraCallbacks, type CameraConfig }
