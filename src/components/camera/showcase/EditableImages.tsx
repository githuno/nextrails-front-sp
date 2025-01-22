import React, { useCallback, useEffect, useState } from "react";
import { Carousel, CarouselItem, Modal } from "@/components";
import { useImageset, File } from "@/components/camera";
import {
  useCamera,
  useIdb,
  LoadingSpinner,
  CloseIcon,
  SyncIcon,
} from "@/components/camera/_utils";
import { useCloudImg, ShouldDo } from "./hooks/useCloudImg";

const EditableImages = () => {
  const { cameraState } = useCamera();
  const { imageset, setImageset, dbName } = useImageset();
  const { idb, idbState } = useIdb<File>(dbName);
  const { cloud, cloudState, isOnline } = useCloudImg();

  const [isSyncing, setIsSyncing] = useState<string[]>([]);
  const [isImageModalOpen, setIsImageModalOpen] = useState<boolean>(false);

  const getImages = useCallback(async () => {
    const currentName = imageset.name;
    setIsSyncing([...isSyncing, currentName]);
    try {
      let params = "deletedAt_null=true&updatedAt_sort=desc"; // 削除されていないファイルを全部取得
      // IDBから降順でファイルを取得
      const idbFiles = await idb.get(imageset.name, {
        date: { key: "updatedAt", order: "desc" },
      });
      // debug
      console.log("GET! idbFiles:", idbFiles);
      // IDBファイルが存在する場合
      if (Array.isArray(idbFiles) && idbFiles.length > 0) {
        setImageset((prev) =>
          // セット名が変更されている場合は更新しない
          prev.name === currentName ? { ...prev, files: idbFiles } : prev
        );
        // IDBの同期済みファイルのうちで最新更新日時を取得
        const idbSyncedAt =
          idbFiles.filter((file) => !file.shouldSync).shift()?.updatedAt ?? 0;
        params = `updatedAt_over=${idbSyncedAt}&updatedAt_sort=desc`; // 更新日時がidbの最新ファイルより新しい(削除含む)ファイルを取得
      }
      // クラウドからファイルを取得
      await syncFromImages({ setName: imageset.name, params });
    } catch (error) {
      console.error("Error updating media:", error);
    } finally {
      setIsSyncing((prev) => prev.filter((name) => name !== currentName));
    }
  }, [idb, cloud, isOnline, imageset.name]);

  const localCleanup = useCallback(
    async (imagesetName: string) => {
      const targetFiles = imageset.files.filter(
        (file) => file.deletedAt && !file.shouldSync // 削除済みかつ同期不要ファイル
      );
      // debug
      console.log("targetFiles:", targetFiles);
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

  const syncFromImages = useCallback(
    async ({ setName, params }: { setName: string; params: string }) => {
      if (!isOnline) return;
      try {
        const cloudFiles = await cloud.getFiles(setName, {
          params: params,
        });
        if (cloudFiles.length === 0 || !Array.isArray(cloudFiles)) return;
        // debug
        console.log("GET! cloudFiles:", cloudFiles);
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
        // debug
        console.log("GET! syncedFiles:", syncedFiles);
      } catch (error) {
        console.error(`Error updating media with ${setName}:`, error);
      }
    },
    [cloud, idb]
  );

  const syncToImage = useCallback(
    async ({ setName, file }: { file: File; setName: string }) => {
      const method = cloud.shouldDo(file);
      if (
        !isOnline ||
        method === ShouldDo.NOT ||
        isSyncing.includes(file.idbId)
      )
        return;
      setIsSyncing((prev) => [...prev, file.idbId]);

      // debug
      console.log("autoSync! method,file:", method, file);

      // 同期済みとして新しいファイルを作成
      let newFile: File = { ...file, shouldSync: false };

      try {
        switch (method) {
          case ShouldDo.POST:
            newFile = await cloud.postFile({ file, imagesetName: setName });
            newFile.idbUrl = file.idbUrl;
            await idb.put(setName, newFile);
            break;
          case ShouldDo.PUT:
            await cloud.putFile({ file, imagesetName: setName });
            await idb.put(setName, newFile);
            break;
          case ShouldDo.DELETE:
            await cloud.deleteFile({ file, imagesetName: setName });
            await idb.delete(setName, file.idbId); // IDBの物理削除
            break;
          default:
            break;
        }
        // imagesetの該当fileを更新
        setImageset((prev) =>
          prev.name === setName
            ? {
                ...prev,
                files:
                  method !== ShouldDo.DELETE
                    ? prev.files.map((f) =>
                        f.idbId === newFile.idbId ? newFile : f
                      )
                    : prev.files.filter((f) => f.idbId !== newFile.idbId),
              }
            : prev
        );
      } catch (error) {
        console.error(`Error updating file with id ${file.idbId}:`, error);
      } finally {
        setIsSyncing((prev) => prev.filter((id) => id !== file.idbId));
      }
    },
    [cloud, idb, isSyncing]
  );

  const handleLocalDelete = useCallback(
    async ({ setName, file }: { setName: string; file: File }) => {
      if (isSyncing.includes(file.idbId)) return;
      // 1. fileのversionとdeletedAtを更新して定義
      const deleteFile = {
        ...file,
        deletedAt: Date.now(),
        updatedAt: Date.now(),
        shouldSync: true,
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
    [imageset.name, idb, cloud, isOnline]
  );

  const handleLocalUpdate = useCallback(
    async ({ setName, file }: { setName: string; file: File }) => {
      if (isSyncing.includes(file.idbId)) return;
      const targetFile = {
        ...file,
        updatedAt: Date.now(),
        shouldSync: true,
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
    [idb, isSyncing]
  );

  // debug ---------------------------------------------------------------------
  useEffect(() => {
    console.log("cameraState:", cameraState);
  }, [cameraState]);
  useEffect(() => {
    console.log("imageset.files:", imageset.files);
  }, [imageset.files]);
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const initialize = async () => {
      if (cameraState.isInitializing) {
        await getImages();
        localCleanup(imageset.name);
      }
    };
    initialize();
  }, [imageset.name, cameraState.isInitializing]);

  useEffect(() => {
    const autoSync = async () => {
      if (
        !cameraState.isScanning || // SCANNING状態でない場合
        imageset.files.length === 0 || // ファイルがない場合
        isSyncing.includes(imageset.name) // 同期中の場合
      )
        return; // 上記条件下では処理しない

      // 未同期ファイルの最古ファイルを抽出
      const fileToUpdate = imageset.files
        .filter((file) => file.shouldSync)
        .pop();
      if (!fileToUpdate) return; // 更新がない場合は処理しない

      // 前回の同期日時を取得
      const prevSyncedAt =
        imageset.files.filter((file) => !file.shouldSync).shift()?.updatedAt ??
        0;
      // 前回の同期以降に更新されたファイルを取得
      const params = `updatedAt_over=${prevSyncedAt}&updatedAt_sort=desc`;

      // TODO: リクエストが多くなるので最適化が必要
      const timeoutId = setTimeout(() => {
        // 1. 未同期ファイルを同期（local→cloud）
        syncToImage({ setName: imageset.name, file: fileToUpdate });
        // 2. 差分更新ファイルを取得（cloud→local）
        syncFromImages({ setName: imageset.name, params });
        // 3. 論理削除済みファイルを物理削除
        localCleanup(imageset.name);
      }, 500); // 0.5秒のデバウンス後に上記処理を実行
      return () => clearTimeout(timeoutId);
    };
    autoSync();
  }, [isOnline, imageset.files, cameraState.isScanning]);

  return (
    <>
      <Carousel>
        {imageset.files
          .filter((file) => !file.deletedAt)
          .map((file) => (
            // 子要素自身で幅を定義
            <CarouselItem
              key={file.idbId}
              className="relative h-full w-40 pt-3 pr-2"
            >
              <div
                className="w-full aspect-video bg-gray-100 rounded-lg flex items-center justify-center"
                onClick={() => {
                  setIsImageModalOpen(true);
                }}
              >
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
                      <button
                        onClick={() =>
                          handleLocalDelete({ file, setName: imageset.name })
                        }
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
      <Modal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        className="bg-black/70"
      >
        <Carousel>
          {imageset.files.map((file) => (
            <CarouselItem
              key={file.idbId}
              className="relative flex items-center justify-center"
            >
              <div className="w-[100vw] h-[90vh]">
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
        cloudState.isFilesFetching) && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50">
          <LoadingSpinner size="32px" />
        </div>
      )}
    </>
  );
};

export { EditableImages };
