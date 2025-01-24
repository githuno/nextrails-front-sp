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
  const { dbName, imageset, setImageset } = useImageset();
  const { idb } = useIdb<File>(dbName);
  const { cloud } = useCloudImg();

  const isOnline = navigator.onLine;
  const [latestImagesets, setLatestImagesets] = useState<Imageset[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // TODO: リファクタリング必要
  const getLatestImagesets = useCallback(async () => {
    try {
      let tmpLatestSets: Imageset[] = [];
      if (isOnline) {
        setIsLoading(true);
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
      // 5. latestImagesetsのfilesを更新して更新日降順で並び替え
      const updatedSets = tmpLatestSets.map((imageset) => {
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
      });
      updatedSets.sort(
        (a, b) => b.files[0]?.updatedAt ?? 0 - a.files[0]?.updatedAt ?? 0
      );
      setLatestImagesets(updatedSets);
      setIsLoading(false);
      // -----------------------------------------------------------------------
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
    let timeoutId: NodeJS.Timeout;
    const fetchData = async () => {
      // 実行前に1秒待つ
      timeoutId = await new Promise((resolve) => setTimeout(resolve, 1000));
      getLatestImagesets();
    };

    if (cameraState.isInitializing) {
      fetchData();
    }
    return () => {
      clearTimeout(timeoutId);
    };
  }, [cameraState.isInitializing, getLatestImagesets]);

  useEffect(() => {
    // latestImagesetsのnameにimageset.nameが含まれていない場合、imagesetを追加
    if (
      imageset.name &&
      !latestImagesets.some((set) => set.name === imageset.name)
    ) {
      setLatestImagesets((prev) => [
        ...prev,
        {
          id: Date.now(),
          name: imageset.name,
          status: ImagesetState.DRAFT,
          files: [],
        },
      ]);
    }
    // imageset.filesが更新された場合、latestImagesetsの該当setのfilesを再取得
    if (imageset.files.length > 0) {
      // contentType: "image/png" のdeltedAtがnullの最新のfileを取得
      const latestImage = imageset.files
        .filter((file) => file.contentType === "image/png" && !file.deletedAt)
        .shift();
      setLatestImagesets((prev) =>
        prev.map((set) =>
          set.name === imageset.name && latestImage
            ? { ...set, files: [latestImage] }
            : set
        )
      );
    } else {
      setLatestImagesets((prev) =>
        prev.map((set) =>
          set.name === imageset.name ? { ...set, files: [] } : set
        )
      );
    }
  }, [imageset]);

  return (
    // ドロワー
    latestImagesets.length > 1 &&
    !isLoading && (
      <div className="fixed z-10">
        <input type="checkbox" id="drawerToggle" className="hidden peer" />
        <div
          id="bg"
          className="fixed top-2 left-0 w-full h-[24vh] bg-black/50 hidden peer-checked:block"
        />
        <div
          className="
              fixed top-7 left-[-95vw] w-[95vw] h-[20vh] 
              bg-gradient-to-l from-white to-white/80 shadow-lg
              flex flex-col items-end rounded-tr-3xl
              transition-all duration-300 peer-checked:left-0
            "
        >
          <label
            htmlFor="drawerToggle"
            className="
                absolute bottom-0 right-[-1.2rem] transform translate-x-1/2
                flex justify-center items-center w-8 h-8 bg-white
                rounded-tr-full rounded-br-full
                shadow-[4px_4px_6px_-1px_rgba(0,0,0,0.1)]
                cursor-pointer transition-transform duration-300
                peer-checked:rotate-180
              "
            // INFO: shadow-[X方向_Y方向_ぼかし半径_拡散半径_色] で左方向に影を出さないよう調整している
          >
            <LinesIcon className="w-4 h-4" fill="#999999" />
          </label>

          {/* ドロワー内の要素 */}
          <div className="grid w-full justify-end px-4 py-2">
            <Carousel>
              {latestImagesets.map(({ name, files }) => (
                <CarouselItem
                  key={name}
                  className={`relative h-[15vh] w-32 pr-2 rounded-lg bg-white hover:bg-gray-100 shadow-xl ${
                    name === imageset.name ? "border-2 border-blue-200" : ""
                  }`}
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
