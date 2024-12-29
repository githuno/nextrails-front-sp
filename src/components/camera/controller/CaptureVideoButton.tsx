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

  const RecordIcon = () => (
    <svg
      version="1.1"
      id="_x32_"
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      x="0px"
      y="0px"
      width="48px"
      height="48px"
      viewBox="0 0 512 512"
      style={{ width: "40px", height: "40px", opacity: 1 }}
      xmlSpace="preserve"
    >
      <style type="text/css">{`.st0{fill:#4B4B4B;}`}</style>
      <path
        d="M289.375,40.703c-40.906,0-76.25,23.781-93,58.266c-16.75-34.484-52.109-58.266-93.016-58.266
        C46.266,40.703,0,86.969,0,144.063c0,57.078,46.266,103.328,103.359,103.328h186.016c57.094,0,103.359-46.25,103.359-103.328
        C392.734,86.969,346.469,40.703,289.375,40.703z M103.359,183.141c-21.594,0-39.094-17.516-39.094-39.078
        c0-21.594,17.5-39.094,39.094-39.094c21.563,0,39.063,17.5,39.063,39.094C142.422,165.625,124.922,183.141,103.359,183.141z
         M289.375,183.141c-21.578,0-39.063-17.516-39.063-39.078c0-21.594,17.484-39.094,39.063-39.094
    c21.594,0,39.094,17.5,39.094,39.094C328.469,165.625,310.969,183.141,289.375,183.141z"
        style={{ fill: "rgb(75, 75, 75)" }}
      ></path>
      <path
        d="M332.125,271H53.828c-11.094,0-20.063,8.969-20.063,20.047v160.188c0,11.078,8.969,20.063,20.063,20.063
    h278.297c11.094,0,20.063-8.984,20.063-20.063V291.047C352.188,279.969,343.219,271,332.125,271z"
        style={{ fill: "rgb(75, 75, 75)" }}
      ></path>
      <path
        d="M504.344,306.688c-4.844-3.797-11.172-5.156-17.156-3.719l-97.844,23.844c-9,2.188-15.328,10.25-15.328,19.5
    v47.484c0,9.25,6.328,17.297,15.328,19.484l97.844,23.859c5.984,1.438,12.313,0.078,17.156-3.719
    c4.828-3.813,7.656-9.625,7.656-15.781v-95.188C512,316.313,509.172,310.5,504.344,306.688z"
        style={{ fill: "rgb(75, 75, 75)" }}
      ></path>
    </svg>
  );

  const StopIcon = () => (
    <svg
      version="1.1"
      id="_x32_"
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      x="0px"
      y="0px"
      width="64px"
      height="64px"
      viewBox="0 0 512 512"
      style={{ width: "32px", height: "32px", opacity: 1 }}
      xmlSpace="preserve"
    >
      <style type="text/css">{`.st0{fill:#4B4B4B;}`}</style>
      <path
        className="st0"
        d="M256,0C114.625,0,0,114.625,0,256s114.625,256,256,256s256-114.625,256-256S397.375,0,256,0z M328,328H184V184
        h144V328z"
        style={{ fill: "rgb(75, 75, 75)" }}
      ></path>
    </svg>
  );

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
