import React, { useState, useEffect, useRef } from "react";
import { CameraState } from "../_utils";
import jsQR from "jsqr";

interface QrScanViewerProps {
  setStream: React.Dispatch<React.SetStateAction<MediaStream | null>>;
  onQRCodeScanned: (data: string) => void;
  state: CameraState;
  setState: React.Dispatch<React.SetStateAction<CameraState>>;
}

const QrScanViewer: React.FC<QrScanViewerProps> = ({
  setStream,
  onQRCodeScanned,
  state,
  setState,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setLocalStream] = useState<MediaStream | null>(null);

  const getMediaSuccess = (stream: MediaStream) => {
    setStream(stream);
    setLocalStream(stream);
    setState("scanning");
  };

  const getMediaError = (error: Error) => {
    console.error("Camera Device Not Found: ", error);
  };

  const getMedia = () => {
    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: {
            exact: "environment", // リアカメラを指定
          },
        },
        audio: false,
      })
      .then(getMediaSuccess)
      .catch((err) => {
        navigator.mediaDevices
          .getUserMedia({
            video: true,
            audio: false,
          })
          .then(getMediaSuccess)
          .catch(() => {
            getMediaError(err);
          });
      });
  };

  useEffect(() => {
    getMedia();
    return () => {
      if (stream) {
        stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    // streamが更新されたらvideoRefにstreamをセット
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (state === "scanning") {
      const scanQRCode = () => {
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
            const code = jsQR(
              imageData.data,
              imageData.width,
              imageData.height
            );

            if (code?.data) {
              onQRCodeScanned(code.data);
            }
          }
        }
      };

      intervalId = setInterval(scanQRCode, 300); // Scan every 300ms
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId); // Clear the interval on unmount
      }
    };
  }, [stream, state]);

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
