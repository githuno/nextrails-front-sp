import React, { useRef, useEffect } from "react";
import { useModal } from "@/components";
import { useImageset } from "@/components/camera";
import { useCamera, LoadingSpinner } from "@/components/camera/_utils";

const CameraPreview = () => {
  const { imageset, onQrScanned } = useImageset();
  const { isOpen } = useModal();
  const { cameraState, camera } = useCamera();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 初期化処理
  useEffect(() => {
    const setupCamera = async () => {
      if (videoRef.current && canvasRef.current && camera && isOpen) {
        await camera.setupWithVideo({
          videoElement: videoRef.current,
          canvasElement: canvasRef.current,
        });
        camera.startQrScan(onQrScanned);
      } else if (!isOpen && camera) {
        // モーダルが閉じられたらクリーンアップ
        console.log("Cleanup camera", camera);
        await camera.cleanup();
      }
    };
    setupCamera();
  }, [videoRef.current, canvasRef.current, camera, isOpen, imageset.name]);

  return (
    <>
      {cameraState.isInitializing && (
        <div className="absolute inset-0 flex items-center justify-center">
          <LoadingSpinner size="72px" />
        </div>
      )}
      <video
        id="preview-video"
        ref={videoRef}
        className={`h-full w-full object-cover rounded-lg ${
          cameraState.isCapturing ? "brightness-75" : ""
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
