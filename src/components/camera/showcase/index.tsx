import { EditableImages } from "./EditableImages";
import React, { useCallback, useEffect, useState } from "react";
import { useIdb, LoadingSpinner, EditIcon } from "../_utils";
import {
  useCameraContext,
  File,
  Imageset,
  ImagesetState,
} from "../CameraContext";
import { Modal } from "@/components";
import { useCloudImg } from "./hooks/useCloudImg";

const Showcase = () => {
  const { imageset, setImageset, cameraState, setCameraState, dbName } =
    useCameraContext();
  const { idb, idbState } = useIdb<File>(dbName);
  const { cloud } = useCloudImg();

  const isOnline = navigator.onLine;
  const [latestImagesets, setLatestImagesets] = useState<Imageset[]>([]);
  const [isNameModalOpen, setIsNameModalOpen] = useState<boolean>(false);
  const [isRequireGet, setIsRequireGet] = useState<boolean>(true); // TODO: 修正必要→発火トリガー・非発火トリガー・リセットトリガー

  const getLatestImagesets = useCallback(async () => {
    try {
      let tmpLatestSets: Imageset[] = [];
      if (isOnline) {
        // 1. cloudから最新のimageを取得してlatestImagesetsにセット（※ここでblobもDL）
        const cloudLatestSets: Imageset[] = await cloud.getImagesets({
          params: `updatedAt=latest`,
        });
        // 2. 同期store名を取得（cloudLatestImagesetsの各name配列を渡す）
        const cloudStores = cloudLatestSets.map((set) => set.name);
        const syncedStores = await idb.syncStores(cloudStores);
        // 3. syncedStoresのうち、cloudStoresに含まれないstore名についてimagesetを追加
        const diffSets = syncedStores
          .filter((store) => !cloudStores.includes(store))
          .map((store) => ({
            id: Date.now(),
            name: store,
            status: ImagesetState.DRAFT,
            files: [],
            syncAt: 0,
          }));
        tmpLatestSets = [...cloudLatestSets, ...diffSets];
        setLatestImagesets([...tmpLatestSets]);
      }
      // 4. allImagesetsを同期(storeNameとfileのセットを渡す)
      const tmpLatestFiles = tmpLatestSets.map((imageset) => ({
        file: imageset.files[0],
        storeName: imageset.name,
      }));
      const syncedLatestFiles = await idb.syncLatests({
        dateKey: "updatedAt",
        set: tmpLatestFiles,
      });
      // 5. latestImagesetsのfilesを更新
      setLatestImagesets((prev) =>
        prev.map((imageset) => {
          const syncedLatestFile = syncedLatestFiles.find(
            (set) => set.storeName === imageset.name
          );
          const { storeName, ...file } = syncedLatestFile!;
          return syncedLatestFile
            ? {
                id: imageset.id,
                name: storeName,
                status: ImagesetState.DRAFT,
                syncAt: syncedLatestFile.updatedAt,
                files: [file as File],
              }
            : imageset;
        })
      );
      // 特別. 非同期で各storeのcloudfilesをidbに同期しておく
      const syncPromises = latestImagesets.map(async (store) => {
        try {
          const cloudfiles = await cloud.getFiles(store.name);
          await idb.sync(store.name, cloudfiles);
        } catch (error) {
          console.error(
            `Error syncing store ${store} with cloud files:`,
            error
          );
        }
      });
      await Promise.all(syncPromises);
    } catch (error) {
      console.error("Error updating media:", error);
    }
  }, [idb, cloud, isOnline, setLatestImagesets]);

  useEffect(() => {
    if (cameraState === "SCANNING" && isRequireGet) {
      // getLatestImagesets();
      setIsRequireGet(false); // TODO：今のところこれないと無限ループになる
    }
  }, [cameraState, getLatestImagesets, isRequireGet]);

  return (
    <div className="grid px-1 h-[23vh] items-center justify-center rounded-lg shadow-lg bg-white/80">
      <Modal
        isOpen={isNameModalOpen}
        onClose={() => setIsNameModalOpen(false)}
        className="bg-transparent"
      >
        <div className="rounded-lg p-4 bg-white/80 shadow-lg">
          <h2 className="text-xl mb-4">setNameを編集</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const newName = formData.get("storeName") as string;
              if (newName !== imageset.name) {
                setCameraState("INITIALIZING");
                setImageset({
                  id: Date.now(),
                  name: newName,
                  status: ImagesetState.DRAFT,
                  files: [],
                  syncAt: 0,
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

      <section className="grid grid-cols-3 grid-rows-1 h-1/5 w-full items-center justify-between pt-2">
        {idbState.isStoreLoading.includes(imageset.name) ? (
          <div className="col-span-3 grid justify-center">
            <LoadingSpinner size="24px" />
          </div>
        ) : (
          <>
            <div className="col-span-2 row-start-1 flex items-center justify-center">
              <h1 className="font-bold text-center break-words">
                セット: {imageset.name}
              </h1>
              {cameraState === "SCANNING" && ( // 編集可能なのはSCANNING時のみ
                <button
                  onClick={() => setIsNameModalOpen(true)}
                  className="ml-2 p-1 bg-transparent hover:bg-gray-200 rounded-full transition-colors"
                >
                  <EditIcon />
                </button>
              )}
            </div>
            {/* TODO: 削除済みを除外する */}
            <p className="text-center break-words">
              count: {imageset.files.length}
            </p>
          </>
        )}
      </section>

      <section className="relative grid grid-cols-3 grid-rows-1 h-4/5 w-full items-center justify-center gap-2">
        <EditableImages />
      </section>

      {/* latestImagesetsを表示 */}
      {/* <section className="grid grid-cols-3 grid-rows-1 h-1/5 w-full items-center justify-between pt-2">
        {latestImagesets.map(({ name, files }) => (
          <div key={name} className="flex items-center justify-center">
            <h1 className="font-bold text-center break-words">
              セット: {name}
            </h1>
            {files.length > 0 && (
              <img
                src={files[0].idbUrl ?? ""}
                alt={`Image ${files[0].idbId}`}
                className="h-full w-full object-contain"
              />
            )}
          </div>
        ))}
      </section> */}

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
                syncAt: 0,
              });
              idb.destroyDb();
              setCameraState("INITIALIZING");
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
