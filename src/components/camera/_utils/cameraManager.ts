import jsQR from "jsqr";

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

interface CameraState {
  isInitializing: boolean;
  isAvailable: boolean;
  isScanning: boolean;
  isRecording: boolean;
  isCapturing: boolean;
  deviceId?: string;
  availableDevices: MediaDeviceInfo[];
  scannedData: string | null;
  error: Error | null;
}

interface CameraConfig {
  QRSCAN_INTERVAL?: number; // QRコードスキャン間隔
  VIDEO_TIMEOUT?: number; // ビデオタイムアウト
  PREFERRED_CAMERA?: "environment" | "user"; // デフォルトカメラ
  VIDEO_CONSTRAINS?: MediaTrackConstraints; // ビデオ制約
}

interface CameraCallbacks {
  onCaptureComplete?: (url: string | null) => void;
  onRecordComplete?: (blob: Blob) => void;
  onError?: (error: Error) => void;
}

class CameraManager {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private scanInterval: number | null = null;
  private captureTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private animationFrameId: number | null = null;
  private readonly config: Required<CameraConfig>;
  private callbacks: CameraCallbacks = {};
  private readonly setState: React.Dispatch<React.SetStateAction<CameraState>>;
  private cleanupCallbacks: Set<() => void> = new Set();

  private static readonly defaultConfig: Required<CameraConfig> = {
    QRSCAN_INTERVAL: 300,
    VIDEO_TIMEOUT: 10000,
    PREFERRED_CAMERA: "environment",
    VIDEO_CONSTRAINS: {},
  };

  constructor(
    setState: React.Dispatch<React.SetStateAction<CameraState>>,
    config: CameraConfig = {}
  ) {
    this.setState = setState;
    this.config = { ...CameraManager.defaultConfig, ...config };

    // Error boundary for unexpected errors
    this.setupErrorBoundary();
  }

  private setupErrorBoundary(): void {
    const handleUnexpectedError = (error: Error) => {
      console.error("Unexpected camera error:", error);
      this.handleError(error);
      this.cleanup();
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason instanceof Error) {
        handleUnexpectedError(event.reason);
      }
    };

    window.addEventListener("unhandledrejection", onUnhandledRejection);

    this.addCleanupCallback(() => {
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    });
  }

  private addCleanupCallback(callback: () => void): void {
    this.cleanupCallbacks.add(callback);
  }

  private handleError(error: Error): void {
    this.setState((prev) => ({ ...prev, error }));
    this.callbacks.onError?.(error);
  }

  private setCallbacks(callbacks: CameraCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  private async checkVideoReady(): Promise<void> {
    return new Promise<void>((resolve) => {
      const check = () => {
        if (this.videoElement?.readyState === 4) {
          resolve();
        } else {
          requestAnimationFrame(check);
        }
      };
      check();
    });
  }

  private async waitForVideoReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Video loading timeout"));
      }, this.config.VIDEO_TIMEOUT);

      const cleanup = () => {
        clearTimeout(timeout);
        this.videoElement?.removeEventListener(
          "loadedmetadata",
          onLoadedMetadata
        );
        this.videoElement?.removeEventListener("error", onError);
      };

      const onLoadedMetadata = async () => {
        try {
          await this.videoElement?.play();
          await this.checkVideoReady();
          cleanup();
          resolve();
        } catch (error) {
          cleanup();
          reject(error);
        }
      };

      const onError = (event: Event) => {
        cleanup();
        reject(new Error(`Video error: ${event}`));
      };

      this.videoElement?.addEventListener("loadedmetadata", onLoadedMetadata);
      this.videoElement?.addEventListener("error", onError);

      if (this.videoElement) {
        this.videoElement.srcObject = this.stream;
      }
      this.addCleanupCallback(cleanup);
    });
  }

  private async getSensor(): Promise<void> {
    try {
      // まずPREFERRED_CAMERA（デフォルト：リアカメラ）を試す
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          // width: { ideal: 1920 }, // 1920px幅 のカメラを理想とする
          // height: { ideal: 1080 }, // 1080px高さ のカメラを理想とする
          facingMode: { exact: this.config.PREFERRED_CAMERA },
        },
        audio: false,
      });
    } catch (err) {
      // PREFERRED_CAMERA が失敗した場合はフォールバック
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
    }

    if (!this.stream) {
      throw new Error("Failed to get camera stream");
    }
  }

  // --------------------------------------------------------------------------
  public async setup(): Promise<void> {
    this.setState((prev) => ({ ...prev, isInitializing: true, error: null }));
    try {
      await this.getSensor();
      this.setState((prev) => ({
        ...prev,
        isInitializing: false,
        isAvailable: true,
      }));
    } catch (error) {
      const cameraError =
        error instanceof Error
          ? error
          : new Error("Camera initialization failed");
      this.callbacks.onError?.(cameraError);
      this.cleanup();
      this.setState((prev) => ({
        ...prev,
        isInitializing: false,
        isAvailable: false,
        error: cameraError,
      }));
      throw cameraError;
    }
  }

  public async setupWithVideo({
    videoElement,
    canvasElement,
  }: {
    videoElement: HTMLVideoElement;
    canvasElement: HTMLCanvasElement;
  }): Promise<void> {
    this.setState((prev) => ({ ...prev, isInitializing: true, error: null }));
    this.videoElement = videoElement;
    this.canvasElement = canvasElement;
    try {
      await this.getSensor();
      await this.waitForVideoReady();
      this.setState((prev) => ({
        ...prev,
        isInitializing: false,
        isAvailable: true,
      }));
    } catch (error) {
      const cameraError =
        error instanceof Error
          ? error
          : new Error("Camera initialization failed");
      this.callbacks.onError?.(cameraError);
      this.cleanup();
      this.setState((prev) => ({
        ...prev,
        isInitializing: false,
        isAvailable: false,
        error: cameraError,
      }));
      throw cameraError;
    }
  }

  public async getAvailableDevices(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(
      (device) => device.kind === "videoinput"
    );

    this.setState((prev) => ({
      ...prev,
      availableDevices: videoDevices,
    }));

    return videoDevices;
  }

  public async switchDevice(deviceId?: string): Promise<void> {
    await this.cleanup();

    if (deviceId) {
      this.config.VIDEO_CONSTRAINS.deviceId = deviceId;
    }

    if (this.videoElement && this.canvasElement) {
      await this.setupWithVideo({
        videoElement: this.videoElement,
        canvasElement: this.canvasElement,
      });
    }
  }

  public async startQrScan(): Promise<void> {
    if (!this.videoElement || !this.canvasElement) {
      throw new Error(
        "video or canvas element is not set. please setupVideo first"
      );
    }
    this.setState((prev) => ({ ...prev, isScanning: true, scannedData: null }));

    const context = this.canvasElement.getContext("2d");
    if (!context) return;

    this.scanInterval = window.setInterval(() => {
      if (this.videoElement?.readyState === 4) {
        this.canvasElement!.width = this.videoElement.videoWidth;
        this.canvasElement!.height = this.videoElement.videoHeight;

        context.drawImage(
          this.videoElement,
          0,
          0,
          this.canvasElement!.width,
          this.canvasElement!.height
        );

        const imageData = context.getImageData(
          0,
          0,
          this.canvasElement!.width,
          this.canvasElement!.height
        );

        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code?.data) {
          this.setState((prev) => ({ ...prev, scannedData: code.data }));
        }
      }
    }, this.config.QRSCAN_INTERVAL);
  }

  public stopQrScan(): void {
    if (this.scanInterval !== null) {
      window.clearInterval(this.scanInterval);
      this.scanInterval = null;
      this.setState((prev) => ({
        ...prev,
        isScanning: false,
        scannedData: null,
      }));
    }
  }

  public async capture(
    onComplete: (url: string | null) => void
  ): Promise<void> {
    // public async capture(onComplete: (blob: Blob | null) => void): Promise<void> {
    if (!this.videoElement || !this.canvasElement) {
      onComplete(null);
      throw new Error(
        "video or canvas element is not set. please setupVideo first"
      );
    }

    this.setState((prev) => ({ ...prev, isCapturing: true }));
    this.setCallbacks({ onCaptureComplete: onComplete });
    // INFO(最適化): video.pause()を呼び出す前にvideo.currentTimeで一時停止するフレームを正確に指定する
    const captureTime = this.videoElement.currentTime; // 現在の再生位置を取得
    this.videoElement.currentTime = captureTime; // 同じ位置を設定
    this.videoElement.pause(); // 一時停止

    const context = this.canvasElement.getContext("2d");
    if (!context) {
      onComplete(null);
      return;
    }

    this.canvasElement.width = this.videoElement.videoWidth;
    this.canvasElement.height = this.videoElement.videoHeight;

    const drawFrame = () => {
      if (!this.videoElement || !this.canvasElement) return;
      context.drawImage(
        this.videoElement, // 第一引数は描画対象の要素
        0, // 第二引数はx軸の開始位置
        0, // 第三引数はy軸の開始位置
        this.canvasElement.width, // 第四引数は描画する幅
        this.canvasElement.height // 第五引数は描画する高さ
      );
      const url = this.canvasElement.toDataURL("image/png");
      this.callbacks.onCaptureComplete?.(url);
      this.animationFrameId = null; // アニメーションフレームIDをクリア
    };
    // INFO(最適化): drawImage の処理をフレームレートに合わせて最適化
    this.animationFrameId = requestAnimationFrame(drawFrame);

    this.captureTimeoutId = setTimeout(() => {
      // 1秒後にビデオを再生してstateを更新
      this.videoElement?.play();
      this.setState((prev) => ({ ...prev, isCapturing: false }));
      this.captureTimeoutId = null; // タイムアウトIDをクリア
    }, 1000);
  }

  public startRecord(): void {
    if (!this.stream) {
      this.handleError(new Error("Media stream is not available"));
      this.setState((prev) => ({ ...prev, isRecording: false }));
      return;
    }

    this.setState((prev) => ({ ...prev, isRecording: true }));
    this.recordedChunks = [];
    this.mediaRecorder = new MediaRecorder(this.stream);

    this.mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    });

    this.mediaRecorder.start();
  }

  public stopRecord(onComplete: (blob: Blob) => void): void {
    if (!this.mediaRecorder) return;

    this.setCallbacks({ onRecordComplete: onComplete });

    this.mediaRecorder.addEventListener(
      "stop",
      () => {
        const blob = new Blob(this.recordedChunks, { type: "video/webm" });
        this.callbacks.onRecordComplete?.(blob);
        this.setState((prev) => ({ ...prev, isRecording: false }));
      },
      { once: true }
    );

    this.mediaRecorder.stop();
  }

  // 不要
  public async setPreviewElements(
    videoElement: HTMLVideoElement,
    canvasElement: HTMLCanvasElement
  ): Promise<void> {
    this.videoElement = videoElement;
    this.canvasElement = canvasElement;
  }

  public cleanup(): void {
    this.stopQrScan();

    if (this.captureTimeoutId) {
      clearTimeout(this.captureTimeoutId);
      this.captureTimeoutId = null;
    }

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.mediaRecorder?.state === "recording") {
      this.mediaRecorder.stop();
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }

    // Execute all cleanup callbacks
    this.cleanupCallbacks.forEach((callback) => callback());
    this.cleanupCallbacks.clear();

    this.stream = null;
    this.mediaRecorder = null;
    this.recordedChunks = [];

    this.setState((prev) => ({
      ...prev,
      isInitializing: false,
      isAvailable: false,
      isScanning: false,
      isRecording: false,
      isCapturing: false,
      availableDevices: [],
      scannedData: null,
      error: null,
    }));
  }

  // 不要：サンプル
  public setVideoToBlock = async (): Promise<void> => {
    if (!this.videoElement) return;
    console.log("block", this.videoElement);
    if (this.videoElement) {
      this.videoElement.style.display = "block";
    }
  };
}

export {
  CameraManager,
  type CameraState,
  type CameraConfig,
  type CameraCallbacks,
};
