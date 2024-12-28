import React, { useState } from "react";
import { CameraState } from "./_utils";
import { QrScanViewer } from "./capture/QrScanViewer";
import { Controller } from "./controller";
import { LocalGallery } from "./gallery/LocalGallery";

const Camera: React.FC = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>("initializing");
  return (
    <div className="flex flex-col items-center justify-between p-1">
      <QrScanViewer
        setStream={setStream}
        state={state}
        setState={setState}
        onQRCodeScanned={(data) => alert(data)}
      />
      <Controller stream={stream} state={state} setState={setState} />
      <LocalGallery state={state} setState={setState} />
    </div>
  );
};

export default Camera;
