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

// TODO: カルーセルの実装
// TODO: ServiceWorker（イベント）の実装
// → useCloudImgによるオンラインアップデートは、ServiceWorkerで行う？
// → 画像が3枚以上の場合にトーストでDRAFT変更を促す
// TODO: CameraPreviewに変更、RecordVideoButtonに変更、ImageGalleryに変更、sensor, controls, galleryに分割
