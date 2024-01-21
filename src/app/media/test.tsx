"use client";
import React, { useState, useEffect, useRef } from "react";

const MediaCaptureVeiwer = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const handleSuccess = (stream: MediaStream) => {
    const video = document.querySelector("video");
    if (video) {
      video.srcObject = stream;
    }
  };

  const handleError = (error: Error) => {
    console.error("Error: ", error);
  };

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: {
            exact: "environment", // リアカメラを指定
          },
        },
        audio: false,
      })
      .then(handleSuccess)
      .catch(() => {
        // リアカメラがない場合はフロントカメラを指定: https://blog.kimizuka.org/entry/2021/01/07/235209
        navigator.mediaDevices
          .getUserMedia({
            video: true,
            audio: false,
          })
          .then(handleSuccess)
          .catch((err) => {
            handleError(err);
          });
      });

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div>
      <p>MediaCaptureVeiwer</p>
      <video ref={videoRef} autoPlay muted />
    </div>
  );
};

const MediaCaptureButton = () => {
  return (
    <div>
      <p>MediaCaptureButton</p>
    </div>
  );
};

export default function MediaCapture() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      {/* MediaCaptureを格納する枠を表示(サイズをビューポートの7割で固定する) */}
      <div className="h-7/10 bg-gray-200 rounded-lg shadow-lg">
        <MediaCaptureVeiwer />
      </div>

      {/* MediaCaptureButtonを表示 */}
      <button className="flex items-center justify-center w-24 h-24 bg-blue-500 rounded-full shadow-lg">
        <MediaCaptureButton />
      </button>
    </main>
  );
}
