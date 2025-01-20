import React from "react";
import { useImageset, File, ImagesetState } from "@/components/camera";
import {
  useIdb,
  LoadingSpinner,
  StopIcon,
  RecordIcon,
  useCamera,
} from "@/components/camera/_utils";

interface RecordVideoButtonProps {
  onSaveCompleted: () => void;
}

const RecordVideoButton: React.FC<RecordVideoButtonProps> = ({
  onSaveCompleted,
}) => {
  const { camera, cameraState } = useCamera();
  const { imageset, setImageset, dbName, onQrScanned } = useImageset();
  const { idb } = useIdb(dbName);

  const handleStartRecording = () => {
    if (!camera) {
      throw new Error("Camera is not initialized");
    }
    camera.stopQrScan();
    camera.startRecord();
  };

  const handleStopRecording = async (blob: Blob | null) => {
    if (!blob || !camera) {
      console.error("Recording failed: Blob is null");
      return;
    }
    const currentImagesetName = imageset.name;

    const video: File = {
      idbId: new Date().toISOString().replace(/[-:.TZ]/g, ""),
      idbUrl: null,
      blob: blob,
      // ------------------------------------------------- ↑ DBには不要
      updatedAt: Date.now(),
      // ---------------------------------- ↑ IdbFile | ↓ FileType ---
      id: null, // DB用のID => あればDBに登録済み ※idbではこれは使わずidbIdを使用する
      size: blob.size,
      contentType: blob.type,

      filename: "", // PUTで編集させる
      version: 1, // PUTで編集された回数
      key: null, // S3 key　=> あればアップロード済み
      createdAt: Date.now(), // 作成日時
      deletedAt: null, // 削除日時
      metadata: {
        status: ImagesetState.DRAFT,
      },
    };
    const savedVideo: File = await idb.post(currentImagesetName, video);

    setImageset((prev) => {
      if (prev.name === currentImagesetName) {
        return {
          ...prev,
          files: [savedVideo!, ...prev.files],
        };
      }
      return prev;
    });
    camera.startQrScan(onQrScanned);
    onSaveCompleted();
  };

  return (
    camera && (
      <div className="flex items-center justify-center w-16 h-16 rounded-full shadow-md">
        <button
          onClick={async () => {
            if (cameraState.isRecording) {
              await camera.stopRecord(handleStopRecording);
            } else {
              handleStartRecording();
            }
          }}
          disabled={cameraState.isCapturing}
          className="w-full h-full flex items-center justify-center rounded-full bg-gradient-to-r from-red-200 to-white shadow-inner hover:shadow-lg transition-transform"
        >
          {cameraState.isInitializing ? (
            <LoadingSpinner />
          ) : cameraState.isRecording ? (
            <StopIcon />
          ) : (
            <RecordIcon />
          )}
        </button>
      </div>
    )
  );
};

export { RecordVideoButton };
