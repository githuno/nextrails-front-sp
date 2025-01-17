import React from "react";
import { CameraPreview } from "./sensor/CameraPreview";
import { Controller } from "./controls";
import { Showcase } from "./showcase";
import { CameraProvider, useCameraContext } from "./CameraContext";
// import { useEffect } from "react";

const CameraContent: React.FC = () => {
  // const { imageset } = useCameraContext();
  // useEffect(() => {
  //   if ("serviceWorker" in navigator && "PushManager" in window) {
  //     console.log("Service Worker and Push is supported");

  //     navigator.serviceWorker
  //       .register("/sw.js", {
  //         scope: "/",
  //         updateViaCache: "none",
  //         type: "module",
  //       })
  //       .then((reg) => {
  //         console.log("⚡️Service Worker registered", reg);
  //         const sw = reg.installing || reg.waiting || reg.active;
  //         console.log("sw-state:", sw?.state);
  //         sw?.addEventListener("statechange", () => {
  //           console.log("change sw-state:", sw?.state);
  //         });
  //       })
  //       .catch((err) => {
  //         console.log("Service Worker registration failed: ", err);
  //       });

  //     navigator.serviceWorker.addEventListener("message", (event) => {
  //       if (event.data && event.data.type === "ALERT_IMAGESET_FILES") {
  //         alert(event.data.message);
  //       }
  //     });
  //   }
  // }, []);

  // const handleButtonClick = () => {
  //   if (navigator.serviceWorker.controller) {
  //     navigator.serviceWorker.controller.postMessage({
  //       type: "CHECK_IMAGESET_FILES",
  //       imageset: imageset,
  //     });
  //   } else {
  //     alert("Service Worker not ready");
  //   }
  // };

  return (
    <>
      {/* <button
        id="callHelloButton"
        onClick={() => {
          handleButtonClick();
          console.log("click");
        }}
        className="fixed top-1 z-50 right-1 p-2 bg-blue-500 text-white rounded-md"
      >
        Call Hello Function
      </button> */}
      <div className="flex h-full w-full justify-center">
        <CameraPreview onQRCodeScanned={(data) => alert(data)} />
      </div>
      <div className="fixed bottom-[5%] left-0 w-full p-4">
        <Controller />
      </div>
      <div className="fixed top-1 left-0 w-full p-2">
        <Showcase />
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
