import React, { useRef, useState } from "react";
import { openDB } from "idb";
import LoadingSpinner from "./loading";

interface CaptureImageButtonProps {
  stream: MediaStream | null;
  setIsScanning: React.Dispatch<React.SetStateAction<boolean>>;
  onSaved: () => void;
}

const CaptureImageButton: React.FC<CaptureImageButtonProps> = ({
  stream,
  setIsScanning,
  onSaved,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleCaptureImage = async () => {
    setIsLoading(true);
    setIsScanning(false);
    if (stream && canvasRef.current) {
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();

      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((blob) => resolve(blob), "image/png")
        );
        if (blob) {
          await saveImage(blob);
        }
      }
      video.pause();
      video.srcObject = null;
    }
    setIsScanning(true);
    setIsLoading(false);
  };

  const saveImage = async (blob: Blob) => {
    let db = await openDB("media", 3, {
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
    let photos = tx.objectStore("photos");
    const photoId = new Date().toISOString();
    const photoData = { id: photoId, blob };
    await photos.add(photoData);
    onSaved();
  };

  return (
    <div>
      <button onClick={handleCaptureImage} disabled={isLoading}>
        {isLoading ? <LoadingSpinner /> : "Capture"}
      </button>
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
};

export { CaptureImageButton };