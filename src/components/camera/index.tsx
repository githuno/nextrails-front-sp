import React, { useRef } from "react";
import { QrScanViewer } from "./capture/QrScanViewer";
import { Controller } from "./controller";
import { LocalGallery } from "./gallery/LocalGallery";
import { CameraProvider } from "./CameraContext";

const CameraContent: React.FC = () => {
  const qrScanViewerRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <div ref={qrScanViewerRef}>
        <QrScanViewer onQRCodeScanned={(data) => alert(data)} />
      </div>
      <div className="fixed bottom-8 flex items-center justify-center">
        <Controller />
      </div>
      <div className="fixed top-2 left-0 w-full p-2 max-h-[20%] overflow-y-auto">
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
