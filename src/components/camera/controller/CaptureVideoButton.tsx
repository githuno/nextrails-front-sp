import React, { useRef } from "react";
import { CameraState, Media, useIDBMedia, LoadingSpinner } from "../_utils";

interface CaptureVideoButtonProps {
  stream: MediaStream | null;
  state: CameraState;
  setState: React.Dispatch<React.SetStateAction<CameraState>>;
  onSaved: () => void;
}

const CaptureVideoButton: React.FC<CaptureVideoButtonProps> = ({
  stream,
  state,
  setState,
  onSaved,
}) => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedBlobsRef = useRef<Blob[]>([]);
  const [fetchIDB, ] = useIDBMedia("Media");

  const handleStartRecording = () => {
    if (stream) {
      setState("recording");
      recordedBlobsRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedBlobsRef.current.push(event.data);
        }
      };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedBlobsRef.current, { type: "video/webm" });
        const video: Media = { id: new Date().toISOString(), blob, url: null, isUploaded: false, type: "video" };
        await fetchIDB("POST", video);
        setState("initializing"); 
        onSaved();
      };
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setState("saving");
    }
  };

  return (
    <div className="flex items-center justify-center w-24 h-24 bg-red-500 rounded-full shadow-lg">
      <button
        onClick={state === "recording" ? handleStopRecording : handleStartRecording}
        disabled={state === "saving"}
      >
        {state === "saving" ? null : state === "recording" ? "STOP" : "REC"}
      </button>
      {state === "saving" && <LoadingSpinner />}
    </div>
  );
};

export { CaptureVideoButton };