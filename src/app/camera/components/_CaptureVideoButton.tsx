import React, { useState, useRef } from "react";
import { openDB } from "idb";
import LoadingSpinner from "./loading";

interface CaptureVideoButtonProps {
  stream: MediaStream | null;
  setIsScanning: React.Dispatch<React.SetStateAction<boolean>>;
  onSaved: () => void;
}

const CaptureVideoButton: React.FC<CaptureVideoButtonProps> = ({
  stream,
  setIsScanning,
  onSaved,
}) => {
  const [recording, setRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedBlobsRef = useRef<Blob[]>([]);

  const handleStartRecording = () => {
    if (stream) {
      setIsScanning(false);
      recordedBlobsRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedBlobsRef.current.push(event.data);
        }
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedBlobsRef.current, { type: "video/webm" });
        saveRecording(blob);
      };
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setRecording(true);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      setIsScanning(true);
      setIsLoading(true);
    }
  };

  const saveRecording = async (blob: Blob) => {
    let db = await openDB("media", 3, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("videos")) {
          db.createObjectStore("videos", {
            keyPath: "id",
            autoIncrement: true,
          });
        }
      },
    });
    let tx = db.transaction("videos", "readwrite");
    let videos = tx.objectStore("videos");
    const videoId = new Date().toISOString();
    const videoData = { id: videoId, blob };
    await videos.add(videoData);
    onSaved();
    setIsLoading(false);
  };

  return (
    <div>
      <button onClick={recording ? handleStopRecording : handleStartRecording} disabled={isLoading}>
        {recording ? "Stop" : "REC"}
      </button>
      {isLoading && <LoadingSpinner />}
    </div>
  );
};

export { CaptureVideoButton };