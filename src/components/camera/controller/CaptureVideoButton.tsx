import React, { useRef } from "react";
import { Media, useIDBMedia, LoadingSpinner } from "../_utils";
import { useCameraContext } from "../CameraContext";

interface CaptureVideoButtonProps {
  onSaved: () => void;
}

const CaptureVideoButton: React.FC<CaptureVideoButtonProps> = ({ onSaved }) => {
  const { stream, cameraState, setCameraState, dbName, imageSetName } =
    useCameraContext();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedBlobsRef = useRef<Blob[]>([]);
  const [fetchIDB] = useIDBMedia({ dbName });

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
        const video: Media = {
          id: new Date().toISOString(),
          blob,
          url: null,
          isUploaded: false,
          type: "video",
        };
        await fetchIDB({
          method: "POST",
          data: video,
          storeName: imageSetName,
        });
        setCameraState("initializing");
        onSaved();
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
    <div className="flex items-center justify-center w-24 h-24 bg-red-500 rounded-full shadow-lg">
      <button
        onClick={
          cameraState === "recording"
            ? handleStopRecording
            : handleStartRecording
        }
        disabled={cameraState === "saving"}
      >
        {cameraState === "saving"
          ? null
          : cameraState === "recording"
          ? "STOP"
          : "REC"}
      </button>
      {cameraState === "saving" && <LoadingSpinner />}
    </div>
  );
};

export { CaptureVideoButton };
