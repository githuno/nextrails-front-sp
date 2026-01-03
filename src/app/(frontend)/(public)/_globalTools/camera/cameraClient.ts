import jsQR from "jsqr"

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
// TODO: カメラデバイスの切り替え機能
// TODO: 利用可能なカメラデバイスの列挙
// TODO: カメラの前面・背面切り替え機能を実装したい
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

    let isScanning = true
    const scan = () => {
      if (!isScanning) return

      if (videoElement.readyState === 4) {
        canvasElement.width = videoElement.videoWidth
        canvasElement.height = videoElement.videoHeight
        context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height)
        const imageData = context.getImageData(0, 0, canvasElement.width, canvasElement.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height)
        if (code?.data) {
          onScan(code.data)
        }
      }
      setTimeout(scan, finalConfig.QRSCAN_INTERVAL)
    }

    scan()
    return () => {
      isScanning = false
    }
  }

  const capture = async (
    videoElement: HTMLVideoElement,
    canvasElement: HTMLCanvasElement,
    onComplete: (url: string | null) => void,
  ): Promise<void> => {
    const context = canvasElement.getContext("2d")
    if (!context) {
      onComplete(null)
      return
    }

    // フレーム固定ロジック
    videoElement.pause()
    const currentTime = videoElement.currentTime
    videoElement.currentTime = currentTime

    canvasElement.width = videoElement.videoWidth
    canvasElement.height = videoElement.videoHeight
    context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height)

    const url = canvasElement.toDataURL("image/png")

    // 少し待ってから再生再開（視覚的なフィードバックのため）
    setTimeout(() => {
      videoElement.play().catch(() => {})
    }, 100)

    onComplete(url)
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
