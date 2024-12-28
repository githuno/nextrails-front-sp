import { useState, useEffect } from "react"; // useStateとuseEffectをreactからインポート
import { useLocation } from "react-router-dom";
import dynamic from "next/dynamic";

// SplatSceneを動的にインポートし、SSRを無効にします
const SplatScene = dynamic(() => import("./scene/SplatScene"), { ssr: false });

const ViewerContent = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const targetUrl = queryParams.get("url");
  // const defaultUrl = "https://pub-b5e3fa5caf8549b4bf8bff1ac7c7eee8.r2.dev/53470b29-88cd-4cce-9184-6faf9f8776ae/output/a.splat";
  const defaultUrl =
    "https://huggingface.co/datasets/dylanebert/3dgs/resolve/main/bonsai/bonsai-7k-mini.splat";
  const [sceneUrl, setSceneUrl] = useState(targetUrl || defaultUrl);

  useEffect(() => {
    // Update the sceneUrl only when the targetUrl changes
    if (targetUrl) {
      setSceneUrl(targetUrl);
    }
  }, [targetUrl]);

  return (
    <>
      <div className="pointer-events-none">
        <dialog
          open
          id="progress-dialog"
          className="top-1/2 p-2 rounded-lg"
        >
          <p htmlFor="progress-indicator">Loading scene...</p>
          <progress max="100" id="progress-indicator"></progress>
        </dialog>
      </div>
      <SplatScene url={sceneUrl} />
    </>
  );
};

export default ViewerContent;
