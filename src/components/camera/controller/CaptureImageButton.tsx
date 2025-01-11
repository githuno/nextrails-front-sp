import React, { useRef } from "react";
import { useIdb, LoadingSpinner, CameraIcon } from "../_utils";
import { useCameraContext, File, ImagesetState } from "../CameraContext";

interface CaptureImageButtonProps {
  onSaved: () => void;
}

const CaptureImageButton: React.FC<CaptureImageButtonProps> = ({ onSaved }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { stream, cameraState, setCameraState, dbName, imageset, setImageset } =
    useCameraContext();
  const { idb } = useIdb(dbName);

  const handleCaptureImage = async () => {
    if (!stream || !canvasRef.current) return;

    // QrScannerManager の video 要素を取得
    const video = document.getElementById(
      "qr-scanner-video"
    ) as HTMLVideoElement;
    if (!video) {
      console.error("Failed to find video element");
      return;
    }

    setCameraState("CAPTURING");
    const currentImagesetName = imageset.name;
    let savedImage: File;

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
        const image: File = {
          idbId: new Date().toISOString().replace(/[-:.TZ]/g, ""), // IDB用のIDを現在時刻から生成
          idbUrl: null,
          blob: blob,
          // ------------------------------------------------- ↑ DBには不要
          updatedAt: Date.now(),
          deletedAt: null, // 論理削除日時
          // ---------------------------------- ↑ IdbFile | ↓ FileType ---
          id: null, // DB用のID => あればDBに登録済み ※idbではこれは使わずidbIdを使用する
          size: blob.size,
          contentType: blob.type,

          filename: "", // PUTで編集させる
          version: 1, // PUTで編集された回数
          key: null, // S3 key　=> あればアップロード済み
          createdAt: Date.now(), // 作成日時
          metadata: {
            status: ImagesetState.DRAFT,
          },
        };
        savedImage = await idb.post(imageset.name, image);
      }
    }

    setCameraState("SCANNING");
    setImageset((prev) => {
      if (prev.name === currentImagesetName) {
        return {
          ...prev,
          syncAt: prev.syncAt ?? new Date(0).getTime(),
          files: [...prev.files, savedImage!],
        };
      }
      return prev;
    });
    onSaved();
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
