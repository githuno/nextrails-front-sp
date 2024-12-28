import React, { useState, useEffect, useRef, useCallback } from "react";
import jsQR from "jsqr";
import { useCameraContext } from "../CameraContext";

interface QrScanViewerProps {
  setStream: React.Dispatch<React.SetStateAction<MediaStream | null>>;
  onQRCodeScanned: (data: string) => void;
}

const QrScanViewer: React.FC<QrScanViewerProps> = ({
  setStream,
  onQRCodeScanned,
}) => {
  const { setCameraState } = useCameraContext();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setLocalStream] = useState<MediaStream | null>(null);

  const onGetSensorSuccess = useCallback(
    (stream: MediaStream) => {
      setStream(stream);
      setLocalStream(stream);
      setCameraState("scanning");
    },
    [setStream, setCameraState]
  );

  const getSensor = useCallback(() => {
    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: {
            exact: "environment", // リアカメラを指定
          },
        },
        audio: false,
      })
      .then(onGetSensorSuccess)
      .catch((err) => {
        navigator.mediaDevices
          .getUserMedia({
            video: true,
            audio: false,
          })
          .then(onGetSensorSuccess)
          .catch(() => {
            console.error("Camera Device Not Found: ", err);
          });
      });
  }, [onGetSensorSuccess]);

  const cleanup = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStream(null);
    setLocalStream(null);
    setCameraState("initializing");
  }, [stream, setStream, setCameraState]);

  const scanQRCode = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      if (context && video.videoWidth > 0 && video.videoHeight > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height
        );
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code?.data) {
          onQRCodeScanned(code.data);
        }
      }
    }
  }, [onQRCodeScanned]);

  const startScanning = useCallback(() => {
    const intervalId = setInterval(scanQRCode, 300); // Scan every 300ms
    return () => clearInterval(intervalId); // Clear the interval on unmount
  }, [scanQRCode]);

  // コンポーネントがマウントされたときにセンサーを取得し、アンマウントされたときにクリーンアップする
  useEffect(() => {
    getSensor();
    const stopScanning = startScanning();
    return () => {
      cleanup();
      stopScanning();
    };
  }, []);

  // streamが更新されたらvideoRefにstreamをセット
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div>
      <video ref={videoRef} className="rounded-lg" autoPlay muted />
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
};

export { QrScanViewer };

// 【Barcode Detection API】
// https://developer.mozilla.org/en-US/docs/Web/API/Barcode_Detection_API

// 続・Webの技術だけで作るQRコードリーダー
// https://qiita.com/kan_dai/items/3486880236a2fcd9b527
