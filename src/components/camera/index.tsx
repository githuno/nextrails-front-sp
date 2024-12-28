import React from "react";
import { QrScanViewer } from "./capture/QrScanViewer";
import { Controller } from "./controller";
import { LocalGallery } from "./gallery/LocalGallery";
import { CameraProvider, useCameraContext } from "./CameraContext";

const CameraContent: React.FC = () => {
  const { setStream } = useCameraContext();

  return (
    <div className="flex flex-col items-center justify-between p-1">
      <QrScanViewer
        setStream={setStream}
        onQRCodeScanned={(data) => alert(data)}
      />
      <Controller />
      <LocalGallery />
    </div>
  );
};

const Camera: React.FC = () => (
  <CameraProvider>
    <CameraContent />
  </CameraProvider>
);

export default Camera;
