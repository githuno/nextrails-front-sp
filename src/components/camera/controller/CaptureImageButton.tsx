import React, { useRef } from "react";
import { CameraState, Media, useIDBMedia, LoadingSpinner } from "../_utils";

interface CaptureImageButtonProps {
  stream: MediaStream | null;
  state: CameraState;
  setState: React.Dispatch<React.SetStateAction<CameraState>>;
  onSaved: () => void;
}

const CaptureImageButton: React.FC<CaptureImageButtonProps> = ({
  stream,
  state,
  setState,
  onSaved,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [fetchIDB, ] = useIDBMedia("Media");

  const handleCaptureImage = async () => {
    if (state === "recording") return;
    setState("capturing");
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
          const image: Media = { id: new Date().toISOString(), blob, url: null,  isUploaded: false, type: "image" };
          await fetchIDB("POST", image);
          onSaved();
        }
      }
      video.pause();
      video.srcObject = null;
    }
    setState("initializing");
  };

  return (
    <div className="flex items-center justify-center w-24 h-24 bg-blue-500 rounded-full shadow-lg">
      <button onClick={handleCaptureImage} disabled={state === "capturing"}>
        {state === "capturing" ? <LoadingSpinner /> : "Capture"}
      </button>
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
};

export { CaptureImageButton };