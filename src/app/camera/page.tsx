"use client";
import React, { useState, useEffect, useCallback, use } from "react";
import {
  CameraQrScanViewer,
  CaptureVideoButton,
  CaptureImageButton,
  LocalMediaList,
} from "./components";
import { openDB } from "idb";

export default function Page() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [count, setCount] = useState(0);
  const [media, setMedia] = useState<
    {
      id: string;
      url: string;
      blob: Blob;
      isUploaded: boolean;
      type: "image" | "video";
    }[]
  >([]);

  const fetchMedia = useCallback(async () => {
    try {
      const db = await openDB("media", 3, {
        upgrade(db) {
          if (!db.objectStoreNames.contains("photos")) {
            db.createObjectStore("photos", { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains("videos")) {
            db.createObjectStore("videos", { keyPath: "id" });
          }
        },
      });

      const txPhotos = db.transaction("photos", "readonly");
      const allPhotos = await txPhotos.objectStore("photos").getAll();
      const photoData = allPhotos.map(
        (photo: { id: string; blob: Blob; isUploaded: boolean }) => ({
          id: photo.id,
          url: URL.createObjectURL(photo.blob),
          blob: photo.blob,
          isUploaded: photo.isUploaded || false,
          type: "image" as "image",
        })
      );

      const txVideos = db.transaction("videos", "readonly");
      const allVideos = await txVideos.objectStore("videos").getAll();
      const videoData = allVideos.map(
        (video: { id: string; blob: Blob; isUploaded: boolean }) => ({
          id: video.id,
          url: URL.createObjectURL(
            new Blob([video.blob], { type: "video/webm" })
          ),
          blob: video.blob,
          isUploaded: video.isUploaded || false,
          type: "video" as "video",
        })
      );

      const mediaList = [...photoData, ...videoData];
      const mediaCount = mediaList.length;

      setMedia(mediaList);
      setCount(mediaCount);
    } catch (error) {
      console.error("Error fetching media:", error);
      return { mediaList: [], mediaCount: 0 };
    }
  }, []);

  useEffect(() => {
    fetchMedia();
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
        <CameraQrScanViewer
          setStream={setStream}
          onQRCodeScanned={(data) => alert(data)}
          isScanning={isScanning}
        />
      </div>
      <div className="flex space-x-4">
        <div className="flex items-center justify-center w-24 h-24 bg-red-500 rounded-full shadow-lg">
          <CaptureVideoButton
            stream={stream}
            setIsScanning={setIsScanning}
            onSaved={fetchMedia}
          />
        </div>
        <div className="flex items-center justify-center w-24 h-24 bg-blue-500 rounded-full shadow-lg">
          <CaptureImageButton
            stream={stream}
            setIsScanning={setIsScanning}
            onSaved={fetchMedia}
          />
        </div>
      </div>
      <div className="col-span-3">
        <p>Media count: {count}</p>
      </div>
      <LocalMediaList media={media} setMedia={setMedia} setCount={setCount} />
    </main>
  );
}
