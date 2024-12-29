import React, { useRef } from "react";
import { Media, useIDBMedia, LoadingSpinner } from "../_utils";
import { useCameraContext } from "../CameraContext";

interface CaptureImageButtonProps {
  onSaved: () => void;
}

const CaptureImageButton: React.FC<CaptureImageButtonProps> = ({ onSaved }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { stream, cameraState, setCameraState, imageSetName, dbName } =
    useCameraContext();
  const [fetchIDB] = useIDBMedia({ dbName });
  const CameraIcon = () => (
    <svg
      version="1.1"
      id="_x32_"
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      x="0px"
      y="0px"
      width="512px"
      height="512px"
      viewBox="0 0 512 512"
      style={{ width: "40px", height: "40px", opacity: 1 }}
      xmlSpace="preserve"
    >
      <g>
        <path
          d="M256,224.828c-34.344,0-62.156,28.078-62.156,62.719s27.813,62.719,62.156,62.719s62.156-28.078,62.156-62.719
    S290.344,224.828,256,224.828z"
          style={{ fill: "#4B4B4B" }}
        ></path>
        <path
          d="M478.766,135.75h-58.625c-13.078,0-24.938-7.75-30.297-19.781l-17.547-39.313
    c-5.359-12.016-17.234-19.766-30.313-19.766H170.016c-13.078,0-24.953,7.75-30.328,19.766l-17.531,39.313
    C116.797,128,104.938,135.75,91.859,135.75H33.234C14.875,135.75,0,150.766,0,169.266v252.328c0,18.5,14.875,33.516,33.234,33.516
    h244.25h201.281c18.344,0,33.234-15.016,33.234-33.516V169.266C512,150.766,497.109,135.75,478.766,135.75z M256,403.844
    c-63.688,0-115.297-52.063-115.297-116.297S192.313,171.234,256,171.234s115.297,52.078,115.297,116.313
    S319.688,403.844,256,403.844z"
          style={{ fill: "#4B4B4B" }}
        ></path>
      </g>
    </svg>
  );

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
