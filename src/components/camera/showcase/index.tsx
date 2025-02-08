import React, { useEffect, useState } from "react";
import { Modal } from "@/components";
import { useImageset, type File, ImagesetState } from "@/components/camera";
import {
  useCamera,
  useIdb,
  LoadingSpinner,
  EditIcon,
} from "@/components/camera/_utils";
import { CurrentImages } from "./CurrentImages";
import { DrawerImagesets } from "./DrawerImagesets";
import { useCloud } from "./hooks/useCloud";
import { useNotion } from "./hooks/useNotion";
import { useGoogleDrive } from "./hooks/useGoogleDrive";
import { NotionModal } from "./NotionModal";
import { GoogleDriveModal } from "./GoogleDriveModal";
import { useSession } from "@/app/layout";

const Showcase = () => {
  const { session } = useSession();
  const { cameraState } = useCamera();
  const { cloudState } = useCloud();
  const { imageset, setImageset, dbName } = useImageset();
  const { idb, idbState } = useIdb<File>(dbName);
  const [isNameModalOpen, setIsNameModalOpen] = useState<boolean>(false);
  const [isNotionModalOpen, setIsNotionModalOpen] = useState<boolean>(false);
  const [isGoogleDriveModalOpen, setIsGoogleDriveModalOpen] =
    useState<boolean>(false);
  const { notionState, connectNotion, selectPage, uploadImagesToNotion } =
    useNotion();
  const {
    state: googleDriveState,
    uploadToGoogleDrive,
    checkConnection,
  } = useGoogleDrive();

  // useEffect(() => {
  //   console.log("cloudState.isOnline:", cloudState.isOnline);
  // }, [cloudState.isOnline]);

  const handleNotionUpload = async () => {
    try {
      if (!notionState.isConnected || !notionState.selectedPageId) {
        setIsNotionModalOpen(true);
        return;
      }

      const files = imageset.files.filter((file) => !file.deletedAt);
      await uploadImagesToNotion(files);

      // アップロード後にステータスを更新
      setImageset((prev) => ({
        ...prev,
        status: ImagesetState.SENT,
      }));
    } catch (error) {
      console.error("Failed to upload to Notion:", error);
    }
  };

  const handleGoogleDriveUpload = async () => {
    try {
      // 認証状態を確認
      const isConnected = await checkConnection(true);
      if (!isConnected) {
        setIsGoogleDriveModalOpen(true);
        return;
      }

      // 認証済みの場合はアップロード処理を実行
      const files = imageset.files.filter((file) => !file.deletedAt);
      console.log("Uploading files:", files);

      const fileObjects = await Promise.all(
        files.map((file) => {
          const blobUrl = file.idbUrl;
          if (!blobUrl) {
            throw new Error(`Blob URL not found for idbId: ${file.idbId}`);
          }
          return fetch(blobUrl)
            .then((response) => response.blob())
            .then((blob) => new File([blob], file.idbId, { type: blob.type }));
        })
      );

      const result = await uploadToGoogleDrive({
        name: imageset.name,
        files: fileObjects,
      });

      if (result.success) {
        setImageset((prev) => ({
          ...prev,
          status: ImagesetState.SENT,
        }));
      } else {
        throw new Error(result.error || "Upload failed");
      }
    } catch (error) {
      console.error("Failed to upload to Google Drive:", error);
    }
  };

  return (
    <div className="grid grid-rows-5 px-2 py-1 h-[23vh] w-vw place-content-center rounded-lg shadow-lg bg-white/80">
      <Modal
        id="setName"
        isOpen={isNameModalOpen}
        onClose={() => setIsNameModalOpen(false)}
        className="bg-transparent"
      >
        <div className="rounded-lg p-4 bg-white/80 shadow-lg">
          {/* TODO:　変更・追加（作成）・移動をわかりやすくする　セット間の転送も必要 */}
          <h2 className="text-xl mb-4">setNameを編集</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const newName = formData.get("storeName") as string;
              if (newName !== imageset.name) {
                setImageset({
                  id: Date.now(),
                  name: newName,
                  status: ImagesetState.DRAFT,
                  files: [],
                });
              }
              setIsNameModalOpen(false);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              name="storeName"
              defaultValue={imageset.name}
              className="p-2 border border-gray-300 bg-white/80 rounded"
            />
            <button
              type="submit"
              className="p-2 bg-blue-500 text-white rounded"
            >
              保存
            </button>
          </form>
        </div>
      </Modal>

      <NotionModal
        isOpen={isNotionModalOpen}
        onClose={() => setIsNotionModalOpen(false)}
        onConnect={connectNotion}
        isConnected={notionState.isConnected}
        onPageSelect={selectPage}
        pages={notionState.pages}
      />

      <GoogleDriveModal
        isOpen={isGoogleDriveModalOpen}
        onClose={() => setIsGoogleDriveModalOpen(false)}
      />

      <section className="row-start-1 grid w-full place-content-center">
        {idbState.isStoreLoading.includes(imageset.name) ? (
          <div className="grid justify-center">
            <LoadingSpinner size="24px" />
          </div>
        ) : (
          <>
            <div className="row-start-1 flex items-center justify-center">
              <h1 className="font-bold text-center break-words">
                セット: {imageset.name}
              </h1>
              {(cameraState.isScanning || !cameraState.isAvailable) && ( // 編集可能なのはSCANNING時のみ
                <button
                  onClick={() => setIsNameModalOpen(true)}
                  className="ml-2 p-1 bg-transparent hover:bg-gray-200 rounded-full transition-colors"
                >
                  <EditIcon />
                </button>
              )}
            </div>
          </>
        )}
      </section>

      <section className="row-span-4 relative grid w-full place-content-center gap-2">
        {cloudState.isOnline !== null && (
          <>
            <CurrentImages />
            <DrawerImagesets />
            {imageset.files.length > 0 && (
              <div className="absolute top-2 right-2 flex gap-2">
                <button
                  onClick={handleNotionUpload}
                  className="px-3 py-1 bg-black text-white rounded-md text-sm"
                >
                  Notionへ送信
                </button>
                <button
                  onClick={handleGoogleDriveUpload}
                  disabled={
                    googleDriveState.isUploading || googleDriveState.isChecking
                  }
                  className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm disabled:bg-gray-400"
                >
                  {googleDriveState.isUploading
                    ? "アップロード中..."
                    : googleDriveState.isChecking
                    ? "認証状態確認中..."
                    : "Google Driveへ送信"}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* クリックしてセッション情報を確認 */}
      <div className="fixed bottom-4 left-4">
        <button
          onClick={() => alert(session?.user.id)}
          className="p-1 bg-gray-200/80 rounded"
        >
          session
        </button>
      </div>

      {/* 開発環境でDBの初期化ボタンを配置 */}
      {process.env.NODE_ENV === "development" && (
        <section className="flex fixed bottom-4 right-4 text-xs p-1 m-1 gap-1">
          <button
            className="bg-gray-200"
            onClick={() =>
              idb.debugDb().then(() => console.log("debugDB done"))
            }
          >
            debugDB
          </button>
          <button
            className="bg-gray-200"
            onClick={() => {
              setImageset({
                id: Date.now(),
                name: "1",
                status: ImagesetState.DRAFT,
                files: [],
              });
              idb.destroyDb();
            }}
          >
            destroyDB
          </button>
        </section>
      )}
    </div>
  );
};

export { Showcase };
