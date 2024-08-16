import React from "react";
import { openDB } from "idb";
import { UploadButton } from "./_UploadButton";

interface LocalMediaListProps {
  media: {
    id: string;
    url: string;
    blob: Blob;
    isUploaded: boolean;
    type: "image" | "video";
  }[];
  setMedia: React.Dispatch<React.SetStateAction<{
    id: string;
    url: string;
    blob: Blob;
    isUploaded: boolean;
    type: "image" | "video";
  }[]>>;
  setCount: React.Dispatch<React.SetStateAction<number>>;
}

const LocalMediaList = ({ media, setMedia, setCount }: LocalMediaListProps) => {
  const handleDelete = async (id: string, type: "image" | "video") => {
    try {
      const db = await openDB("media", 3);
      const tx = db.transaction(
        type === "image" ? "photos" : "videos",
        "readwrite"
      );
      await tx.objectStore(type === "image" ? "photos" : "videos").delete(id);
      setMedia(media.filter((item) => item.id !== id));
      setCount((prevCount) => prevCount - 1);
    } catch (error) {
      console.error("Error deleting media:", error);
    }
  };

  const handleUploadSuccess = (id: string) => {
    setMedia((prevMedia) =>
      prevMedia.map((item) =>
        item.id === id ? { ...item, isUploaded: true } : item
      )
    );
    alert("Upload successful");
  };

  return (
    <div className="grid grid-cols-3 gap-4">
      {media.map((item) => (
        <div key={item.id} className="relative">
          {item.type === "image" ? (
            <img
              src={item.url}
              alt={`Image ${item.id}`}
              className="w-full h-auto"
            />
          ) : (
            <video controls src={item.url} className="w-full h-auto" />
          )}
          <button
            onClick={() => handleDelete(item.id, item.type)}
            className="absolute top-0 right-0 bg-red-500 text-white p-1 z-10"
          >
            削除
          </button>
          {!item.isUploaded && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <UploadButton
                file={item.blob}
                type={item.type}
                id={item.id}
                onUploadSuccess={() => handleUploadSuccess(item.id)}
                className="pointer-events-auto"
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export { LocalMediaList };