import React, { createContext, useEffect, useState } from "react";
import { IdbFile, useStorage } from "@/components/storage";
import { CameraContextProvider, useCamera } from "./_utils";
import { Preview } from "./preview";
import { Controller } from "./controls";
import { Showcase } from "./showcase";

// ----------------------------------------------------------------------------- ImagesetType
interface File extends IdbFile {
  // idbId: string; // IDB用のID（クラウドで管理していないプロパティ）
  // idbUrl: string | null; // IDB用のURL（クラウドで管理していないプロパティ）
  // blob: Blob | null; // 画像データ（クラウドで管理していないプロパティ）
  // updatedAt: number; // 更新日時
  fetchedAt: number; // 取得日時（クラウドで管理していないプロパティ）
  shouldPush: boolean; // クラウドにプッシュ必要かどうか（クラウドで管理していないプロパティ）
  deletedAt: number | null; // 論理削除日時
  createdAt: number; // 作成日時
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

enum ImagesetState { // TODO: enumは書き換える必要ありそう：https://zenn.dev/ubie_dev/articles/ts-58-erasable-syntax-only
  DRAFT = "DRAFT",
  SENT = "SENT",
  ARCHIVED = "ARCHIVED",
  DELETED = "DELETED",
}

interface Imageset {
  id: bigint;
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
}
const ImagesetContext = createContext<ImagesetContextProps | undefined>(
  undefined
);
const ImagesetContextProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { dbName } = useStorage();
  // 以下の値変更は子孫の再レンダリングを伴う
  const [imageset, setImageset] = useState<Imageset>({
    id: BigInt(Date.now()),
    name: "1",
    status: ImagesetState.DRAFT,
    files: [],
  });

  // 前回のdbNameを保持するためのref
  const prevDbNameRef = React.useRef(dbName);

  // dbNameが異なる値に変更されたときだけ、imagesetを初期化する
  useEffect(() => {
    if (dbName && dbName !== prevDbNameRef.current) {
      setImageset({
        id: BigInt(Date.now()),
        name: "1",
        status: ImagesetState.DRAFT,
        files: [],
      });
      prevDbNameRef.current = dbName;
    }
  }, [dbName]);

  return (
    <ImagesetContext.Provider value={{ dbName, imageset, setImageset }}>
      {children}
    </ImagesetContext.Provider>
  );
};

// ----------------------------------------------------------------------------- ImagesetContent
const ImagesetContent: React.FC = () => {
  // const { imageset } = useImageset();
  const { cameraState } = useCamera();

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
  //   return () => {
  //     navigator.serviceWorker.removeEventListener("message", (event) => {
  //       if (event.data && event.data.type === "ALERT_IMAGESET_FILES") {
  //         alert(event.data.message);
  //       }
  //     });
  //   };
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
        className="fixed top-1 z-50 left-1 p-2 bg-blue-500 text-white rounded-md"
      >
        Call Hello Function
      </button> */}
      <div className="flex h-full w-full justify-center">
        <Preview />
      </div>
      {cameraState.isAvailable !== null && (
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

// TODO: useCamera、useIDb、useStorageのリファクタリング
// TODO: cameraコンポーネントを各フックスを使ってリファクタリング
// TODO: useSWをpubsubと同じように使いたい（例:sw.subscribe, sw.publish）
// TODO: APIエラー時（オフライン）
// TODO: useContext使ってるとこ、pubsubで書き換えられるかも（トースト、エラー、imageset）
// TODO: hooksによる非同期・API通信の最適化→ hydrationエラー解消
// TODO: クエリパラメータで状態管理（モーダルオープン）
// TODO: ServiceWorker（イベント）の実装
// → useCloudによるオンラインアップロードは、ServiceWorkerで行う？
// → Notion拡張機能　ユーザー向け：1️⃣テンプレートDB作成機能 2️⃣QR生成（ID）印刷機能 ｜自分（企業）用：3️⃣QR生成（アクション）4️⃣refurnishへの連携データ生成
// → QRコードがサービス名文字列の場合、IDBで該当文字列とステートを検索する
// → 画像が3枚以上の場合にトーストでDRAFT変更を促す
// NotionDBアップロード
// Notionページアップロード
// Gmail下書き
// GooglePhotosアップロード
//
// 認証
// 制限＆課金　※ 「アップグレード」ではなく「支援してください」にする。応援コメントを送れるようにする
