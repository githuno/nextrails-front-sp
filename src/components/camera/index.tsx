import React from "react";
import { QrScanViewer } from "./capture/QrScanViewer";
import { Controller } from "./controller";
import { LocalGallery } from "./gallery/LocalGallery";
import { CameraProvider } from "./CameraContext";

const CameraContent: React.FC = () => {
  return (
    <>
      <div className="flex h-full w-full justify-center">
        <QrScanViewer onQRCodeScanned={(data) => alert(data)} />
      </div>
      <div className="fixed bottom-[5%] left-0 w-full p-4">
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
