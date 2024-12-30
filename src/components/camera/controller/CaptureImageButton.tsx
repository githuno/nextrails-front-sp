import React, { useRef } from "react";
import { Media, useIDBMedia, LoadingSpinner, CameraIcon } from "../_utils";
import { useCameraContext } from "../CameraContext";

interface CaptureImageButtonProps {
  onSaved: () => void;
}

const CaptureImageButton: React.FC<CaptureImageButtonProps> = ({ onSaved }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { stream, cameraState, setCameraState, imageSetName, dbName } =
    useCameraContext();
  const [fetchIDB] = useIDBMedia({ dbName });

  const handleCaptureImage = async () => {
    if (cameraState === "recording") return;
    setCameraState("capturing");
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
          const image: Media = {
            id: new Date().toISOString(),
            blob,
            url: null,
            isUploaded: false,
            type: "image",
          };
          await fetchIDB({
            method: "POST",
            data: image,
            storeName: imageSetName,
          });
          onSaved();
        }
      }
      video.pause();
      video.srcObject = null;
    }
    setCameraState("initializing");
  };

  return (
    <div className="flex items-center justify-center w-16 h-16 rounded-full shadow-md">
      <button
        onClick={handleCaptureImage}
        disabled={cameraState === "capturing"}
        className="w-full h-full flex items-center justify-center rounded-full bg-gradient-to-r from-blue-200 to-white shadow-inner hover:shadow-lg transition-transform"
      >
        {cameraState === "capturing" ? <LoadingSpinner /> : <CameraIcon />}
      </button>
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
};

export { CaptureImageButton };
