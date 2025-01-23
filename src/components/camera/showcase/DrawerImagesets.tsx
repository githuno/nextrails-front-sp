import { useCloudImg } from "./hooks/useCloudImg";
import React, { useCallback, useEffect, useState } from "react";
import { Carousel, CarouselItem } from "@/components";
import {
  useImageset,
  File,
  Imageset,
  ImagesetState,
} from "@/components/camera";
import { useCamera, useIdb } from "@/components/camera/_utils";
import { LinesIcon } from "@/components/Icons";

const DrawerImagesets = () => {
  const { cameraState } = useCamera();
  const { dbName, setImageset } = useImageset();
  const { idb } = useIdb<File>(dbName);
  const { cloud } = useCloudImg();

  const isOnline = navigator.onLine;
  const [isRequireGet, setIsRequireGet] = useState<boolean>(true); // TODO: 修正必要→発火トリガー・非発火トリガー・リセットトリガー
  const [latestImagesets, setLatestImagesets] = useState<Imageset[]>([]);

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

  const handleCarouselItemClick = (name: string) => {
    setImageset((prev) => ({ ...prev, name }));
    // ドロワーを閉じる
    const drawerToggle = document.getElementById(
      "drawerToggle"
    ) as HTMLInputElement;
    if (drawerToggle) {
      drawerToggle.checked = false;
    }
  };

  useEffect(() => {
    if (cameraState.isScanning && isRequireGet) {
      getLatestImagesets();
      setIsRequireGet(false); // TODO：今のところこれないと無限ループになる
    }
  }, [cameraState, getLatestImagesets, isRequireGet]);

  return (
    // ドロワー
    latestImagesets.length > 1 && (
      <div className="fixed z-10">
        <input type="checkbox" id="drawerToggle" className="hidden peer" />
        <div
          className="
              fixed top-4 right-[-95vw] w-[95vw] h-[20vh] 
              bg-gradient-to-r from-white to-white/80 shadow-lg
              flex flex-col items-end 
              transition-all duration-300 peer-checked:right-0
            "
        >
          <label
            htmlFor="drawerToggle"
            className="
                absolute top-4 left-[-1rem] transform -translate-x-1/2 -translate-y-1/2
                flex justify-center items-center w-12 h-12 bg-white
                rounded-tl-full rounded-tr-full rounded-bl-full
                shadow-[-4px_4px_6px_-1px_rgba(0,0,0,0.1)]
                cursor-pointer transition-transform duration-300
                peer-checked:rotate-180
              "
            // INFO: shadow-[X方向_Y方向_ぼかし半径_拡散半径_色] で右方向に影を出さないよう調整している
          >
            <LinesIcon className="w-6 h-6" fill="#999999" />
          </label>

          {/* ドロワー内の要素 */}
          <div className="grid w-full justify-start">
            <Carousel>
              {latestImagesets.map(({ name, files }) => (
                <CarouselItem
                  key={name}
                  className="relative h-[18vh] w-32 pt-3 pr-2"
                >
                  <div
                    className="h-full w-full cursor-pointer"
                    onClick={() => handleCarouselItemClick(name)}
                  >
                    <h1 className="font-bold text-center break-words">
                      {name}
                    </h1>
                    {files.length > 0 && (
                      <img
                        src={files[0].idbUrl ?? ""}
                        alt={`Image ${files[0].idbId}`}
                        className="h-full w-full object-contain"
                      />
                    )}
                  </div>
                </CarouselItem>
              ))}
            </Carousel>
          </div>
        </div>
      </div>
    )
  );
};

export { DrawerImagesets };
