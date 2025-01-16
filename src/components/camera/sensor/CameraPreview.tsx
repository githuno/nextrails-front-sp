import React, { useRef, useEffect, useState, use } from "react";
import jsQR from "jsqr";
import { useCameraContext } from "../CameraContext";
import { useModal } from "@/components";
import { LoadingSpinner } from "../_utils";

// TODO: バーコードスキャナーの実装したい
// TODO: カメラの前面・背面切り替え機能を実装したい
// TODO: カメラのフラッシュ機能を実装したい
// TODO: カメラのズーム機能を実装したい
// TODO: 撮影時・スキャン時のシャッター音・バイブレーションを実装したい
// TODO: 解像度を変更する機能を実装したい
// TODO: AIモデルへのリアルタイムデータ送信機能を実装したい

class CameraPreviewManager {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private scanInterval: number | null = null;
  private onQRCodeScanned: (data: string) => void;
  private setStream: React.Dispatch<React.SetStateAction<MediaStream | null>>;

  constructor(
    onQRCodeScanned: (data: string) => void,
    setStream: React.Dispatch<React.SetStateAction<MediaStream | null>>
  ) {
    this.onQRCodeScanned = onQRCodeScanned;
    this.setStream = setStream;
  }

  public async initialize(
    videoElement: HTMLVideoElement,
    canvasElement: HTMLCanvasElement
  ): Promise<void> {
    this.videoElement = videoElement;
    this.canvasElement = canvasElement;
    try {
      await this.getSensor();
      await this.waitForVideoReady();
    } catch (error) {
      console.error("Failed to initialize camera:", error);
      this.cleanup();
      throw error;
    }
  }

  private waitForVideoReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.videoElement || !this.stream) {
        reject(new Error("Video element or stream is not initialized"));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error("Video loading timeout"));
      }, 10000); // 10 second timeout

      const checkVideo = () => {
        if (this.videoElement?.readyState === 4) {
          clearTimeout(timeout);
          resolve();
        } else {
          requestAnimationFrame(checkVideo);
        }
      };

      this.videoElement.addEventListener(
        "loadedmetadata",
        () => {
          void this.videoElement?.play().then(checkVideo).catch(reject);
        },
        { once: true }
      );

      this.videoElement.addEventListener(
        "error",
        (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        { once: true }
      );

      this.videoElement.srcObject = this.stream;
    });
  }

  private async getSensor(): Promise<void> {
    try {
      // まずリアカメラを試す
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          // width: { ideal: 1920 }, // 1920px幅 のカメラを理想とする
          // height: { ideal: 1080 }, // 1080px高さ のカメラを理想とする
          facingMode: { exact: "environment" },
        },
        audio: false,
      });
    } catch (err) {
      // フロントカメラにフォールバック
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
    }

    if (!this.stream) {
      throw new Error("Failed to get camera stream");
    }

    this.setStream(this.stream);
  }

  private scanQRCode(): void {
    if (!this.videoElement || !this.canvasElement) return;

    const context = this.canvasElement.getContext("2d");
    if (!context) return;

    if (this.videoElement.readyState === 4) {
      this.canvasElement.width = this.videoElement.videoWidth;
      this.canvasElement.height = this.videoElement.videoHeight;

      context.drawImage(
        this.videoElement,
        0,
        0,
        this.canvasElement.width,
        this.canvasElement.height
      );

      const imageData = context.getImageData(
        0,
        0,
        this.canvasElement.width,
        this.canvasElement.height
      );

      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code?.data) {
        this.onQRCodeScanned(code.data);
      }
    }
  }

  public startScanning(): void {
    this.scanInterval = window.setInterval(() => this.scanQRCode(), 300);
  }

  public pauseScanning(): void {
    if (this.scanInterval !== null) {
      window.clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
  }

  public cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
    if (this.scanInterval !== null) {
      window.clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    this.stream = null;
    this.videoElement = null;
    this.canvasElement = null;
    this.setStream(null);
  }
}

interface CameraPreviewProps {
  onQRCodeScanned: (data: string) => void;
}

const CameraPreview: React.FC<CameraPreviewProps> = ({ onQRCodeScanned }) => {
  const { cameraState, setCameraState, setStream } = useCameraContext();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scannerRef = useRef<CameraPreviewManager | null>(null);
  const { registerBeforeOpen, registerBeforeClose } = useModal();

  // スキャン開始/停止
  useEffect(() => {
    if (!scannerRef.current) return;
    if (cameraState === "SCANNING") {
      scannerRef.current.startScanning();
    } else if (cameraState === "CAPTURING") {
      scannerRef.current.pauseScanning();
    }
  }, [cameraState]);

  // TODO:各effectを一つにまとめる

  useEffect(() => {
    // 初期化
    setCameraState("INITIALIZING");
    // ビデオとキャンバスが存在しない場合はリターン
    if (!videoRef.current || !canvasRef.current) {
      alert("Failed to initialize camera");
      return;
    }
    // スキャンマネージャーをインスタンス化
    scannerRef.current = new CameraPreviewManager(onQRCodeScanned, setStream);
    // スキャンマネージャーを初期化
    void scannerRef.current
      .initialize(videoRef.current, canvasRef.current)
      .catch((error) => {
        console.error("Failed to initialize QR scanner:", error);
      });
    // スキャン開始
    setCameraState("SCANNING");
    // アンマウント時にクリーンアップ
    return () => {
      scannerRef.current?.cleanup();
    };
  }, []);

  useEffect(() => {
    // ウィンドウが閉じられる前にクリーンアップ
    return registerBeforeClose(async () => {
      scannerRef.current?.cleanup();
      return true;
    });
  }, []);

  useEffect(() => {
    // ウィンドウが開かれる前にカメラを再起動
    return registerBeforeOpen(async () => {
      if (videoRef.current && canvasRef.current && scannerRef.current) {
        setCameraState("INITIALIZING");
        await scannerRef.current.initialize(
          videoRef.current,
          canvasRef.current
        );
        setCameraState("SCANNING");
        return true;
      }
      return false;
    });
  }, []);

  return (
    <>
      {cameraState === "INITIALIZING" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <LoadingSpinner size="72px" />
        </div>
      )}
      <video
        id="preview-video"
        ref={videoRef}
        className={`h-full w-full object-cover rounded-lg ${
          cameraState === "CAPTURING" ? "brightness-75" : ""
        }`}
        autoPlay
        playsInline
        muted
      />
      <canvas id="preview-canvas" ref={canvasRef} className="hidden" />
    </>
  );
};

export { CameraPreview };

// 【Barcode Detection API】
// https://developer.mozilla.org/en-US/docs/Web/API/Barcode_Detection_API

// 続・Webの技術だけで作るQRコードリーダー
// https://qiita.com/kan_dai/items/3486880236a2fcd9b527
