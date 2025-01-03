import React, { useRef } from "react";
import {
  useIdb,
  LoadingSpinner,
  StopIcon,
  RecordIcon,
  useCloudStorage,
  ImagesetStatus,
} from "../_utils";
import { useCameraContext } from "../CameraContext";

interface CaptureVideoButtonProps {
  onSaveCompleted: () => void;
}

const CaptureVideoButton: React.FC<CaptureVideoButtonProps> = ({
  onSaveCompleted,
}) => {
  const { stream, cameraState, setCameraState, dbName, imageSetName } =
    useCameraContext();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedBlobsRef = useRef<Blob[]>([]);
  const { idb } = useIdb(dbName);

  const handleStartRecording = () => {
    if (stream) {
      setCameraState("recording");
      recordedBlobsRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedBlobsRef.current.push(event.data);
        }
      };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedBlobsRef.current, { type: "video/webm" });
        const video = {
          id: new Date().toISOString().replace(/[-:.TZ]/g, ""),
          path: null,
          blob: blob,

          filename: "", // PUTで編集させる
          version: 1, // PUTで編集された回数
          extension: "webm",
          key: null, // S3 key　=> あればアップロード済み
          createdAt: new Date().toISOString(), // 作成日時
          updatedAt: new Date().toISOString(), // 更新日時
          deletedAt: null, // 削除日時
          status: ImagesetStatus.DRAFT,
        };
        await idb.post(imageSetName, video);
        setCameraState("initializing");
        onSaveCompleted();
      };
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setCameraState("saving");
    }
  };

  return (
    <div className="flex items-center justify-center w-16 h-16 rounded-full shadow-md">
      <button
        onClick={
          cameraState === "recording"
            ? handleStopRecording
            : handleStartRecording
        }
        disabled={cameraState === "saving"}
        className="w-full h-full flex items-center justify-center rounded-full bg-gradient-to-r from-red-200 to-white shadow-inner hover:shadow-lg transition-transform"
      >
        {cameraState === "saving" ? (
          <LoadingSpinner />
        ) : cameraState === "recording" ? (
          <StopIcon />
        ) : (
          <RecordIcon />
        )}
      </button>
    </div>
  );
};

export { CaptureVideoButton };
