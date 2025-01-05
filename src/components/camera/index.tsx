import React from "react";
import { QrScanViewer } from "./capture/QrScanViewer";
import { Controller } from "./controller";
import { LocalGallery } from "./gallery/LocalGallery";
import { CameraProvider } from "./CameraContext";

const CameraContent: React.FC = () => {
  return (
    <>
      <QrScanViewer onQRCodeScanned={(data) => alert(data)} />
      <div className="fixed bottom-[8%] flex items-center justify-center">
        <Controller />
      </div>
      <div className="fixed top-1 left-0 w-full p-2">
        <LocalGallery />
      </div>
    </>
  );
};

const Camera: React.FC = () => (
  <CameraProvider>
    <CameraContent />
  </CameraProvider>
);

export default Camera;
