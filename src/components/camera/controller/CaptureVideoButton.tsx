import React, { useRef } from "react";
import { useIdb, LoadingSpinner, StopIcon, RecordIcon } from "../_utils";
import { useCameraContext, File, ImagesetState } from "../CameraContext";

interface CaptureVideoButtonProps {
  onSaveCompleted: () => void;
}

const CaptureVideoButton: React.FC<CaptureVideoButtonProps> = ({
  onSaveCompleted,
}) => {
  const { stream, cameraState, setCameraState, dbName, imageset, setImageset } =
    useCameraContext();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedBlobsRef = useRef<Blob[]>([]);
  const { idb } = useIdb(dbName);

  const handleStartRecording = () => {
    const currentImagesetName = imageset.name;
    if (stream) {
      setCameraState("RECORDING");
      recordedBlobsRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedBlobsRef.current.push(event.data);
        }
      };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedBlobsRef.current, { type: "video/webm" });
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
        const savedVideo: File = await idb.post(imageset.name, video);

        setCameraState("SCANNING");
        setImageset(
          (prev) => {
            if (prev.name === currentImagesetName) {
              return {
                ...prev,
                syncAt: prev.syncAt ?? new Date(0).getTime(),
                files: [...prev.files, savedVideo!],
              };
            }
            return prev;
          }
        );
        onSaveCompleted();
      };
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setCameraState("SAVING");
    }
  };

  return (
    <div className="flex items-center justify-center w-16 h-16 rounded-full shadow-md">
      <button
        onClick={
          cameraState === "RECORDING"
            ? handleStopRecording
            : handleStartRecording
        }
        disabled={cameraState === "SAVING"}
        className="w-full h-full flex items-center justify-center rounded-full bg-gradient-to-r from-red-200 to-white shadow-inner hover:shadow-lg transition-transform"
      >
        {cameraState === "SAVING" ? (
          <LoadingSpinner />
        ) : cameraState === "RECORDING" ? (
          <StopIcon />
        ) : (
          <RecordIcon />
        )}
      </button>
    </div>
  );
};

export { CaptureVideoButton };
