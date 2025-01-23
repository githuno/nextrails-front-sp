import React, { createContext, useEffect, useState } from "react";
import { CameraContextProvider, IdbFile, useCamera } from "./_utils";
import { CameraPreview } from "./preview/CameraPreview";
import { Controller } from "./controls";
import { Showcase } from "./showcase";
import { session } from "@/components";

// ----------------------------------------------------------------------------- ImagesetType
interface File extends IdbFile {
  // idbId: string; // IDB用のID
  // idbUrl: string | null; // IDB用のURL
  // blob: Blob | null; // 画像データ
  // updatedAt: number; // 更新日時
  deletedAt: number | null; // 論理削除日時
  createdAt: number; // 作成日時
  shouldSync: boolean; // 同期済みかどうか
  id: string | null; // DB用のID => あればDBに登録済み ※idbではこれは使わずidbIdを使用する
  contentType: string;
  size: number;

  filename?: string; // PUTで編集させる
  version: number; // PUTで編集された回数
  key: string | null; // S3 key　=> あればアップロード済み
  metadata?: {
    status: ImagesetState; // imageSetのステータス　=> DRAFTのみ画面表示。SENTになったら非同期アップロードしてindexedDBからは削除する
  };
}

enum ImagesetState {
  DRAFT = "DRAFT",
  SENT = "SENT",
  ARCHIVED = "ARCHIVED",
  DELETED = "DELETED",
}

interface Imageset {
  id: number;
  name: string;
  status: ImagesetState;
  files: File[];
  // syncAt: number; // TODO:同期日時をIDBに持たせればEditableImagesでの不要なリクエストを減らせる
}

// ----------------------------------------------------------------------------- ImagesetContext
interface ImagesetContextProps {
  dbName: string;
  imageset: Imageset;
  setImageset: React.Dispatch<React.SetStateAction<Imageset>>;
  onQrScanned: (data: string) => void;
}
const ImagesetContext = createContext<ImagesetContextProps | undefined>(
  undefined
);
const ImagesetContextProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // 以下の値変更は子孫の再レンダリングを伴う
  const dbName = `user-${session.userId}`;
  const [imageset, setImageset] = useState<Imageset>({
    id: Date.now(),
    name: "1",
    status: ImagesetState.DRAFT,
    files: [],
  });
  const onQrScanned = (data: string) => alert(data);

  return (
    <ImagesetContext.Provider
      value={{ dbName, imageset, setImageset, onQrScanned }}
    >
      {children}
    </ImagesetContext.Provider>
  );
};

// ----------------------------------------------------------------------------- ImagesetContent
const ImagesetContent: React.FC = () => {
  const { imageset } = useImageset();
  const { cameraState } = useCamera();
  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      console.log("Service Worker and Push is supported");

      navigator.serviceWorker
        .register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
          type: "module",
        })
        .then((reg) => {
          console.log("⚡️Service Worker registered", reg);
          const sw = reg.installing || reg.waiting || reg.active;
          console.log("sw-state:", sw?.state);
          sw?.addEventListener("statechange", () => {
            console.log("change sw-state:", sw?.state);
          });
        })
        .catch((err) => {
          console.log("Service Worker registration failed: ", err);
        });

      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data && event.data.type === "ALERT_IMAGESET_FILES") {
          alert(event.data.message);
        }
      });
    }
  }, []);

  const handleButtonClick = () => {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "CHECK_IMAGESET_FILES",
        imageset: imageset,
      });
    } else {
      alert("Service Worker not ready");
    }
  };

  return (
    <>
      {/* <button
        id="callHelloButton"
        onClick={() => {
          handleButtonClick();
          console.log("click");
        }}
        className="fixed top-1 z-50 left-1 p-2 bg-blue-500 text-white rounded-md"
      >
        Call Hello Function
      </button> */}
      <div className="flex h-full w-full justify-center">
        <CameraPreview />
      </div>
      {!cameraState.isInitializing && (
        <div className="fixed bottom-[5%] left-0 w-full p-4">
          <Controller />
        </div>
      )}
      <div className="fixed top-1 left-0 w-full p-2">
        <Showcase />
      </div>
    </>
  );
};

// ----------------------------------------------------------------------------- Camera
const Camera: React.FC = () => (
  <CameraContextProvider>
    <ImagesetContextProvider>
      <ImagesetContent />
    </ImagesetContextProvider>
  </CameraContextProvider>
);
export default Camera;

const useImageset = (): ImagesetContextProps => {
  const context = React.useContext(ImagesetContext);
  if (context === undefined) {
    throw new Error(
      "useImageset must be used within a ImagesetContextProvider"
    );
  }
  return context;
};
export {
  useImageset,
  type File,
  type Imageset, // TODO: typeとenumを統一する
  ImagesetState, // TODO: typeとenumを統一する
};

// TODO: カルーセルの実装
// TODO: ServiceWorker（イベント）の実装
// → useCloudImgによるオンラインアップデートは、ServiceWorkerで行う？
// → 画像が3枚以上の場合にトーストでDRAFT変更を促す
