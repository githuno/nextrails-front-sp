import React, { useCallback, useEffect, useState } from "react";
import { Carousel, CarouselItem, Modal } from "@/components";
import { useImageset, type Imageset, type File } from "@/components/camera";
import {
  useCamera,
  useIdb,
  LoadingSpinner,
  CloseIcon,
  SyncIcon,
} from "@/components/camera/_utils";
import { useCloud } from "./hooks/useCloud";
import Image from "next/image";

const CurrentImages = () => {
  const { cameraState } = useCamera();
  const { imageset, setImageset, dbName } = useImageset();
  const { idb, idbState } = useIdb<File>(dbName);
  const {
    cloudState,
    cloudGetFiles,
    cloudPutFile,
    cloudPostFile,
    cloudDeleteFile,
    checkUpdatedAt,
  } = useCloud();

  const [isSyncing, setIsSyncing] = useState<string[]>([]);
  const [isImageModalOpen, setIsImageModalOpen] = useState<boolean>(false);
  const [carouselIndex, setCarouselIndex] = useState<number | null>(null);

  const pullImages = useCallback(
    async ({ setName, params }: { setName: string; params: string }) => {
      if (!cloudState.isOnline) return;
      try {
        const cloudFiles = await cloudGetFiles(setName, {
          params: params,
        });
        if (cloudFiles.length === 0 || !Array.isArray(cloudFiles)) return;
        // cloudFilesがある場合はIDBに同期してimagesetにセット
        const syncedFiles = await idb.sync(setName, cloudFiles, {
          dateKey: "updatedAt",
          order: "desc",
        });
        setImageset((prev) =>
          prev.name === setName
            ? {
                ...prev,
                files: syncedFiles,
              }
            : prev
        );
      } catch (error) {
        console.error(`Error updating media with ${setName}:`, error);
      }
    },
    [idb, cloudGetFiles, setImageset, cloudState.isOnline]
  );

  const pushImage = useCallback(
    async (set: Imageset) => {
      const file = set.files
        .filter(
          (file) =>
            file.size !== 0 && // ファイルのサイズプロパティが0（＝まだIDBに保存されていない仮ファイル）
            file.shouldPush && // shouldPushプロパティがtrue
            !isSyncing.includes(file.idbId) // isSyncingに含まれていないファイル
        )
        .pop(); // 上記条件内で更新日が最古のファイル
      if (!file) return; // ファイルがない場合は処理しない

      setIsSyncing((prev) => [...prev, file.idbId]);

      let newFile: File = { ...file, shouldPush: false };
      try {
        if (file.deletedAt) {
          // DELETE
          await cloudDeleteFile({ file, imagesetName: set.name });
          await idb.delete(set.name, file.idbId); // IDBの物理削除
        } else if (file.id && file.version) {
          // PUT
          await cloudPutFile({ file, imagesetName: set.name });
          await idb.put(set.name, newFile);
        } else if (!file.id) {
          // POST
          newFile = await cloudPostFile({ file, imagesetName: set.name });
          await idb.put(set.name, newFile);
        }
        // imagesetの該当fileを更新
        setImageset((prev) =>
          prev.name === set.name
            ? {
                ...prev,
                files: file.deletedAt
                  ? prev.files.filter((f) => f.idbId !== newFile.idbId)
                  : prev.files.map((f) =>
                      f.idbId === newFile.idbId ? newFile : f
                    ),
              }
            : prev
        );
      } catch (error) {
        console.error(`Error updating file with id ${file.idbId}:`, error);
      } finally {
        setIsSyncing((prev) => prev.filter((id) => id !== file.idbId));
      }
    },
    [idb, cloudPutFile, cloudPostFile, cloudDeleteFile, isSyncing]
  );

  const getImages = useCallback(async () => {
    const currentName = imageset.name;
    setIsSyncing([...isSyncing, currentName]);
    try {
      let params = "deletedAt_null=true&updatedAt_sort=desc"; // 削除されていないファイルを全部取得
      // IDBから降順でファイルを取得
      const idbFiles = await idb.get(imageset.name, {
        date: { key: "updatedAt", order: "desc" },
      });

      // IDBファイルが存在する場合
      if (Array.isArray(idbFiles) && idbFiles.length > 0) {
        setImageset((prev) =>
          // セット名が変更されている場合は更新しない
          prev.name === currentName ? { ...prev, files: idbFiles } : prev
        );
        // IDBのfilesから適切な日時を取得してparamsを再定義
        params = `updatedAt_over=${checkUpdatedAt(
          idbFiles
        )}&updatedAt_sort=desc`;
      }

      // クラウドからファイルを取得
      await pullImages({ setName: imageset.name, params });
    } catch (error) {
      console.error("Error updating media:", error);
    } finally {
      setIsSyncing((prev) => prev.filter((name) => name !== currentName));
    }
  }, [idb, pullImages, imageset.name, checkUpdatedAt, cloudState.isOnline]);

  const localCleanup = useCallback(
    async (imagesetName: string) => {
      const targetFiles = imageset.files.filter(
        (file) => file.deletedAt && file.updatedAt < file.fetchedAt // 削除済みかつ取得以降に更新されていないファイル
      );
      try {
        for (const file of targetFiles) {
          await idb.delete(imagesetName, file.idbId); // IDBの削除済みファイルを削除
          setImageset((prev) =>
            prev.name === imagesetName
              ? {
                  ...prev,
                  files: prev.files.filter((file) => !file.deletedAt),
                }
              : prev
          );
        }
      } catch (error) {
        console.error("Error cleaning up media:", error);
      }
    },
    [idb, imageset.files]
  );

  const handleLocalDelete = useCallback(
    async ({ setName, file }: { setName: string; file: File }) => {
      if (isSyncing.includes(file.idbId)) return;
      // 1. fileのversionとdeletedAtを更新して定義
      const deleteFile = {
        ...file,
        shouldPush: true,
        deletedAt: Date.now(),
        updatedAt: Date.now(),
        version: file.version + 1,
        blob: null,
      };
      // 2. IDBの論理削除
      await idb.put(imageset.name, deleteFile);

      // 3. imagesetの該当ファイルを論理削除
      setImageset((prev) =>
        prev.name === setName
          ? {
              ...prev,
              files: prev.files.map((f) =>
                f.idbId === deleteFile.idbId ? deleteFile : f
              ),
            }
          : prev
      );
    },
    [imageset.name, idb, isSyncing]
  );

  const handleLocalUpdate = useCallback(
    async ({ setName, file }: { setName: string; file: File }) => {
      if (isSyncing.includes(file.idbId)) return;
      const targetFile = {
        ...file,
        shouldPush: true,
        updatedAt: Date.now(),
        version: file.version + 1,
      };
      // 1. IDBの更新
      await idb.put(setName, targetFile);
      // 2. imagesetの更新
      setImageset((prev) =>
        prev.name === setName
          ? {
              ...prev,
              files: prev.files.map((f) =>
                f.idbId === targetFile.idbId ? targetFile : f
              ),
            }
          : prev
      );
    },
    [imageset.name, idb, isSyncing]
  );

  // debug ---------------------------------------------------------------------
  useEffect(() => {
    console.log("cameraState:", cameraState);
  }, [cameraState]);
  useEffect(() => {
    console.log("imageset.files:", imageset.files);
  }, [imageset.files]);
  useEffect(() => {
    console.log("cloudState:", cloudState);
  }, [cloudState]);
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const initialize = async () => {
      if (
        cameraState.isAvailable !== null &&
        !isSyncing.includes(imageset.name)
      ) {
        console.log("⚡️fetchCurrents", cloudState.isOnline);
        await getImages();
        localCleanup(imageset.name);
      }
    };
    initialize();
    return () => {
      setIsSyncing([]);
    };
  }, [imageset.name, cameraState.isAvailable]);

  useEffect(() => {
    const autoPush = async () => {
      if (
        !cloudState.isOnline || // オフラインの場合
        (cameraState.isAvailable && !cameraState.isScanning) || // カメラが使えるのにSCANNING状態でない場合
        imageset.files.length === 0 || // filesがない場合
        isSyncing.includes(imageset.name) // 同期中の場合
      )
        return; // 上記条件下では処理しない

      await pushImage(imageset);
    };
    autoPush();
  }, [cloudState.isOnline, imageset.files, cameraState.isScanning]);

  const handleCarouselItemClick = (fileIndex: number) => {
    const controller = new AbortController(); // https://qiita.com/tronicboy/items/31c1f60daf26edc9cefb
    setIsImageModalOpen(true);
    setTimeout(() => {
      if (!controller.signal.aborted) {
        setCarouselIndex(fileIndex);
      }
    }, 100);
    return () => {
      controller.abort();
    };
  };

  return (
    <>
      <Carousel autoScrollTop={true} containerClassName="gap-x-3">
        {imageset.files
          .filter((file) => !file.deletedAt)
          .map((file) => (
            // 子要素自身で幅を定義
            <CarouselItem
              key={"small-" + file.idbId}
              className="relative h-full w-40 pt-2 pr-2"
            >
              <div className="aspect-video bg-gray-100/50 rounded-lg flex items-center justify-center">
                <div
                  className="relative h-full w-full cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCarouselItemClick(imageset.files.indexOf(file));
                  }}
                >
                  {file.contentType === "video/webm" ? (
                    <video
                      controls
                      src={file.idbUrl ?? ""}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    // <img
                    //   src={file.idbUrl ?? ""}
                    //   alt={`Image ${file.idbId}`}
                    //   className="h-full w-full object-contain p-0.5"
                    // />
                    <Image
                      src={file.idbUrl ?? ""}
                      alt={`Image ${file.idbId}`}
                      fill
                      style={{ objectFit: "contain" }}
                      className="p-0.5"
                    />
                  )}
                </div>
                {
                  // 削除操作が不可な状態
                  idbState.isUpdating.includes(file.idbId) ||
                  idbState.isDeleting.includes(file.idbId) ||
                  cloudState.isDeleting.includes(file.idbId) ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <LoadingSpinner />
                    </div>
                  ) : (
                    // 削除操作が可能な状態
                    <div>
                      {/* TODO: モーダルのオープンとクローズが重複して作動してしまっている */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // 親要素のクリックイベントを防ぐ
                          handleLocalDelete({ file, setName: imageset.name });
                        }}
                        className="absolute top-0 right-0 rounded-full bg-white/80 p-1 z-10"
                      >
                        <CloseIcon />
                      </button>
                      {(cloudState.isPosting.includes(file.idbId) ||
                        cloudState.isPutting.includes(file.idbId)) && (
                        <div className="absolute top-0 left-0">
                          <SyncIcon size="24" />
                        </div>
                      )}
                    </div>
                  )
                }
              </div>
            </CarouselItem>
          ))}
      </Carousel>

      {/* TODO：クリックした画像が開くようにする必要あり。現在は先頭画像に戻ってしまう */}
      <Modal
        isOpen={isImageModalOpen}
        onClose={() => {
          setCarouselIndex(null);
          setIsImageModalOpen(false);
        }}
        className="bg-white/0"
      >
        <Carousel
          className="bg-black/70"
          containerClassName="md:gap-x-1"
          index={carouselIndex}
        >
          {imageset.files.map((file) => (
            <CarouselItem key={"large-" + file.idbId}>
              <div className="w-[100vw] h-[90vh] py-2 px-1 md:w-[93vw] md:pr-0">
                {file.contentType === "video/webm" ? (
                  <video
                    controls
                    src={file.idbUrl ?? ""}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <img
                    src={file.idbUrl ?? ""}
                    alt={`Image ${file.idbId}`}
                    className="h-full w-full object-contain"
                  />
                )}
              </div>
            </CarouselItem>
          ))}
        </Carousel>
      </Modal>
      {(idbState.isStoreSyncing.includes(imageset.name) ||
        cameraState.isAvailable === null ||
        cloudState.isFilesFetching) && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50">
          <LoadingSpinner size="32px" />
        </div>
      )}
    </>
  );
};

export { CurrentImages };
