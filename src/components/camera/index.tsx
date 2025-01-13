import React from "react";
import { CameraPreview } from "./sensor/CameraPreview";
import { Controller } from "./controls";
import { ImageGallery } from "./gallery/ImageGallery";
import { CameraProvider } from "./CameraContext";

const CameraContent: React.FC = () => {
  return (
    <>
      <div className="flex h-full w-full justify-center">
        <CameraPreview onQRCodeScanned={(data) => alert(data)} />
      </div>
      <div className="fixed bottom-[5%] left-0 w-full p-4">
        <Controller />
      </div>
      <div className="fixed top-1 left-0 w-full p-2">
        <ImageGallery />
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
