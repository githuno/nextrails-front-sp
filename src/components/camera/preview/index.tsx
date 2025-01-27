import React from "react";
import { Modal } from "@/components/Modal";
import { useCamera } from "@/components/camera/_utils";

import { CameraPreview } from "./CameraPreview";
import { Webview } from "./WebView";

const Preview = () => {
  const { cameraState } = useCamera();

  return (
    <>
      <CameraPreview />
      <Modal
        id="webview"
        isOpen={!!cameraState.scannedData}
        onClose={() => {}}
        className="bg-white w-full h-full"
      >
        <Webview />
      </Modal>
    </>
  );
};

export { Preview };
