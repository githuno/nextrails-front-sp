import React, { useEffect, useState } from "react";
import { Modal } from "@/components";
import { useCamera } from "@/components/camera/_utils";

const ModalWebview = () => {
  const { camera, cameraState } = useCamera();
  const [isUrlValid, setIsUrlValid] = useState<boolean>(false);

  useEffect(() => {
    const checkURL = () => {
      if (!cameraState.scannedData) return;
      try {
        const url = new URL(cameraState.scannedData);
        if (url.protocol === "http:" || url.protocol === "https:") {
          console.log("url.protocol", url.protocol);
          setIsUrlValid(true);
        } else {
          alert(cameraState.scannedData);
          setIsUrlValid(false);
          camera?.clearScannedData();
        }
      } catch (e) {
        alert(cameraState.scannedData);
        setIsUrlValid(false);
        camera?.clearScannedData();
      }
    };

    checkURL();
  }, [cameraState.scannedData]);

  return (
    cameraState.scannedData && (
      <Modal
        id="webview"
        isOpen={isUrlValid}
        onClose={() => {
          camera?.clearScannedData();
        }}
        className="bg-white w-full h-full"
      >
        <iframe
          src={`/api/proxy?url=${encodeURIComponent(cameraState.scannedData)}`}
          className="absolute inset-0 w-full h-full"
          title="Webview"
        />
      </Modal>
    )
  );
};

export { ModalWebview };
