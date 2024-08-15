import React, { useState, useEffect } from "react";
import { openDB } from "idb";

const LocalImagesList = () => {
  const [images, setImages] = useState<{ id: string; url: string }[]>([]);

  useEffect(() => {
    const fetchImages = async () => {
      const db = await openDB("images", 3, {
        upgrade(db) {
          if (!db.objectStoreNames.contains("photos")) {
            db.createObjectStore("photos", { keyPath: "id" });
          }
        },
      });

      // データベースが正しく開かれたか確認
      console.log("Database opened:", db);

      const tx = db.transaction("photos", "readonly");
      const allPhotos = await tx.objectStore("photos").getAll();
      const imageData = allPhotos.map((photo: { id: string; blob: Blob }) => ({
        id: photo.id,
        url: URL.createObjectURL(photo.blob), // BlobからURLを作成
      }));
      setImages(imageData);
    };

    fetchImages();
  }, []);

  const handleDelete = async (id: string) => {
    const db = await openDB("images", 3);
    const tx = db.transaction("photos", "readwrite");
    await tx.objectStore("photos").delete(id);
    setImages(images.filter((image) => image.id !== id));
  };

  return (
    <div className="grid grid-cols-3 gap-4">
      {images.map((image) => (
        <div key={image.id} className="relative">
          <img src={image.url} alt={`Image ${image.id}`} className="w-full h-auto" />
          <button
            onClick={() => handleDelete(image.id)}
            className="absolute top-0 right-0 bg-red-500 text-white p-1"
          >
            削除
          </button>
        </div>
      ))}
    </div>
  );
};

export { LocalImagesList };