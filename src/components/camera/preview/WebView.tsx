import React from "react";
import { useCamera } from "@/components/camera/_utils";

const Webview = () => {
  const { cameraState } = useCamera();
  const proxyUrl = cameraState.scannedData
    ? `/api/proxy?url=${encodeURIComponent(cameraState.scannedData)}`
    : null;
  // const proxyUrl = iframeSrc
  //   ? `/api/proxy?url=${encodeURIComponent("https://veil-spy-46a.notion.site/7dd602d98f254544bf720e3ef72656db")}`
  //   : null;
  // const proxyUrl = "https://veil-spy-46a.notion.site/7dd602d98f254544bf720e3ef72656db"
  // const proxyUrl = "https://blog.openreplay.com/"

  return (
    <>
      {proxyUrl && (
        <iframe
          src={proxyUrl}
          className="absolute inset-0 w-full h-full"
          title="Webview"
        />
      )}
    </>
  );
};

export { Webview };
