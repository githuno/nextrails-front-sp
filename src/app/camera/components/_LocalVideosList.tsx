import React, { useState, useEffect } from "react";
import { openDB } from "idb";

const LocalVideosList = () => {
  const [videos, setVideos] = useState<{ id: string; url: string }[]>([]);

  useEffect(() => {
    const fetchVideos = async () => {
      const db = await openDB("recordings", 3, {
        upgrade(db) {
          if (!db.objectStoreNames.contains("videos")) {
            db.createObjectStore("videos", { keyPath: "id" });
          }
        },
      });

      // データベースが正しく開かれたか確認
      console.log("Database opened:", db);

      const tx = db.transaction("videos", "readonly");
      const allVideos = await tx.objectStore("videos").getAll();
      const videoData = allVideos.map((video: { id: string; blob: Blob }) => ({
        id: video.id,
        url: URL.createObjectURL(new Blob([video.blob], { type: "video/webm" })), // Blobに変換
      }));
      setVideos(videoData);
    };

    fetchVideos();
  }, []);

  const handleDelete = async (id: string) => {
    const db = await openDB("recordings", 3);
    const tx = db.transaction("videos", "readwrite");
    await tx.objectStore("videos").delete(id);
    setVideos(videos.filter((video) => video.id !== id));
  };

  return (
    <div className="grid grid-cols-3 gap-4">
      {videos.map((video) => (
        <div key={video.id} className="relative">
          <video controls src={video.url} className="w-full h-auto" />
          <button
            onClick={() => handleDelete(video.id)}
            className="absolute top-0 right-0 bg-red-500 text-white p-1"
          >
            削除
          </button>
        </div>
      ))}
    </div>
  );
};

export { LocalVideosList };