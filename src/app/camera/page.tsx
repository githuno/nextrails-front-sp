"use client";
import React, { useState, useEffect } from "react";
import {
  CameraViewer,
  CaptureVideoButton,
  CaptureImageButton,
  LocalVideosList,
  LocalImagesList,
} from "./components";
import { openDB } from "idb";

export default function Page() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isScanning, setIsScanning] = useState(true);  const [videoCount, setVideoCount] = useState(0);
  const [imageCount, setImageCount] = useState(0);

  const updateVideoCount = async () => {
    let db = await openDB("recordings", 3, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("videos")) {
          db.createObjectStore("videos", {
            keyPath: "id",
            autoIncrement: true,
          });
        }
      },
    });
    let tx = db.transaction("videos", "readwrite");
    const count = await tx.objectStore("videos").count();
    setVideoCount(count);
  };
  
  const updateImageCount = async () => {
    let db = await openDB("images", 3, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("photos")) {
          db.createObjectStore("photos", {
            keyPath: "id",
            autoIncrement: true,
          });
        }
      },
    });
    let tx = db.transaction("photos", "readwrite");
    const count = await tx.objectStore("photos").count();
    setImageCount(count);
  }

  useEffect(() => {
    updateVideoCount();
  }, [videoCount]);

  useEffect(() => {
    updateImageCount();
  }, [imageCount]);

  const handleVideoCapture = () => {
    setIsScanning(false);
    updateVideoCount();
  };

  const handleImageCapture = () => {
    setIsScanning(false);
    updateImageCount();
  };

  useEffect(() => {
    updateVideoCount();
    updateImageCount();
  }, []);

  // サーバーサイドとクライアントサイドで同じメッセージを表示する ↓
  const [isClient, setIsClient] = useState(false);
  const loadingMessage = "Loading...";
  useEffect(() => {
    setIsClient(true);
  }, []);
  if (!isClient) {
    return <div>{loadingMessage}</div>;
  }
  // サーバーサイドとクライアントサイドで同じメッセージを表示する ↑

  return (
    <main className="flex flex-col items-center justify-between p-1">
      <div className="bg-gray-200 shadow-lg">
        <CameraViewer
          setStream={setStream}
          onQRCodeScanned={(data) => alert(data)}
          isScanning={isScanning}
        />
      </div>
      <div className="flex space-x-4">
        <div className="flex items-center justify-center w-24 h-24 bg-red-500 rounded-full shadow-lg">
          <CaptureVideoButton stream={stream} setIsScanning={setIsScanning} onSaved={handleVideoCapture} />
        </div>
        <div className="flex items-center justify-center w-24 h-24 bg-blue-500 rounded-full shadow-lg">
          <CaptureImageButton stream={stream} setIsScanning={setIsScanning} onSaved={handleImageCapture} />
        </div>
      </div>
      <LocalVideosList key={videoCount} />
      <LocalImagesList key={imageCount} />
    </main>
  );
}
