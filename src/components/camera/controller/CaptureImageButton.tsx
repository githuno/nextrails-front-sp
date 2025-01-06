import React, { useRef } from "react";
import {
  useIdb,
  LoadingSpinner,
  CameraIcon,
  FileType,
  ImagesetStatus,
} from "../_utils";
import { useCameraContext } from "../CameraContext";

interface CaptureImageButtonProps {
  onSaved: () => void;
}

const CaptureImageButton: React.FC<CaptureImageButtonProps> = ({ onSaved }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { stream, cameraState, setCameraState, storeName, dbName } =
    useCameraContext();
  const { idb } = useIdb(dbName);

  const handleCaptureImage = async () => {
    if (cameraState === "RECORDING") return;
    setCameraState("CAPTURING");
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
          const image: FileType = {
            idbId: new Date().toISOString().replace(/[-:.TZ]/g, ""),
            blob: blob,
            path: null,
            // ------------------------------------------------- ↑ DBには不要
            updatedAt: new Date().toISOString(),
            // ---------------------------------- ↑ IdbFile | ↓ FileType ---
            id: null, // DB用のID => あればDBに登録済み ※idbではこれは使わずidbIdを使用する
            size: blob.size,
            contentType: blob.type,

            filename: "", // PUTで編集させる
            version: 1, // PUTで編集された回数
            key: null, // S3 key　=> あればアップロード済み
            createdAt: new Date().toISOString(), // 作成日時
            deletedAt: null, // 削除日時
            metadata: {
              status: ImagesetStatus.DRAFT,
            },
          };
          await idb.post(storeName, image);
          onSaved();
        }
      }
      video.pause();
      video.srcObject = null;
    }
    setCameraState("INITIALIZING");
  };

  return (
    <div className="flex items-center justify-center w-16 h-16 rounded-full shadow-md">
      <button
        onClick={handleCaptureImage}
        disabled={cameraState === "CAPTURING"}
        className="w-full h-full flex items-center justify-center rounded-full bg-gradient-to-r from-blue-200 to-white shadow-inner hover:shadow-lg transition-transform"
      >
        {cameraState === "CAPTURING" ? <LoadingSpinner /> : <CameraIcon />}
      </button>
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
};

export { CaptureImageButton };
