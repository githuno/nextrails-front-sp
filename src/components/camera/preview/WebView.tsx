import React, { useEffect, useState } from "react";
import { Modal } from "@/components/atoms";
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
    return () => {
      setIsUrlValid(false);
    };
  }, [cameraState.scannedData]);

  // IDBの連携サービスデータとサービスキーを突合 →
  // サービスキーにない場合はアラートを出す → ここでサービス連携を促すためのロジックが必要

  // 「サービスキー｜DBキー｜ID」の形式でQR作成
  // notionキーであり、一致データがない場合は登録を促す
  // notionキーであり、一致データがある場合は該当データのステータス変更を促す

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
          src={`/api/proxy/qr?url=${encodeURIComponent(cameraState.scannedData)}`}
          className="absolute inset-0 w-full h-full"
          title="Webview"
        />
      </Modal>
    )
  );
};

export { ModalWebview };
