import React, { useState, useEffect, useRef } from "react";
import jsQR from "jsqr";

interface CameraViewerProps {
  setStream: React.Dispatch<React.SetStateAction<MediaStream | null>>;
  onQRCodeScanned: (data: string) => void;
  isScanning: boolean;
}

const CameraViewer: React.FC<CameraViewerProps> = ({ setStream, onQRCodeScanned, isScanning }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setLocalStream] = useState<MediaStream | null>(null);

  const getMediaSuccess = (stream: MediaStream) => {
    setStream(stream);
    setLocalStream(stream);
  };

  const getMediaError = (error: Error) => {
    console.error("Camera Device Not Found: ", error);
  };

  const getMedia = () => {
    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: {
            exact: "environment",
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
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (isScanning) {
      const scanQRCode = () => {
        if (videoRef.current && canvasRef.current) {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          const context = canvas.getContext("2d");

          if (context && video.videoWidth > 0 && video.videoHeight > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);

            if (code) {
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
  }, [stream, isScanning]);

  return (
    <div>
      <video ref={videoRef} className="rounded-lg" autoPlay muted />
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
};

export { CameraViewer };

// 【Barcode Detection API】
// https://developer.mozilla.org/en-US/docs/Web/API/Barcode_Detection_API

// 続・Webの技術だけで作るQRコードリーダー
// https://qiita.com/kan_dai/items/3486880236a2fcd9b527