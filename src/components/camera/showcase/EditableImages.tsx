import React, { useCallback, useEffect, useState } from "react";
import { useIdb, LoadingSpinner, CloseIcon, SyncIcon } from "../_utils";
import { useCameraContext, File } from "../CameraContext";
import { useCloudImg } from "./hooks/useCloudImg";

const EditableImages = () => {
  const { imageset, setImageset, cameraState, dbName } = useCameraContext();
  const { idb, idbState } = useIdb<File>(dbName);
  const { cloud, cloudState, isOnline } = useCloudImg();

  const [isBusy, setIsBusy] = useState<string[]>([]);
  const [isImageModalOpen, setIsImageModalOpen] = useState<boolean>(false);

  const getImageset = useCallback(async () => {
    const currentName = imageset.name;
    try {
      // IDBから降順でファイルを取得
      const idbFiles = await idb.get(imageset.name, {
        date: { key: "updatedAt", order: "desc" },
      });
      let idbUpdatedAt = 0;
      let params = "deletedAt_null=true&updatedAt_sort=desc"; // 削除されていないファイルのみ取得
      if (Array.isArray(idbFiles) && idbFiles.length > 0) {
        // idbファイルが存在する場合
        setImageset((prev) =>
          // セット名が変更されていない場合は更新
          prev.name === currentName ? { ...prev, files: idbFiles } : prev
        );
        idbUpdatedAt = idbFiles[0].updatedAt;
        params = `updatedAt_over=${idbUpdatedAt}&updatedAt_sort=desc`; // 更新日時がidbの最新ファイルより新しい(削除含む)ファイルを取得
      }

      if (!isOnline) {
        // --- A. オフラインであればidbfilesの有無にかかわらず終了（=auto関数も発火不要）
        return;
      } else {
        const cloudFiles = await cloud.getFiles(currentName, {
          params: params,
        });
        // debug
        console.log("GET:cloudFiles:", cloudFiles);
        // --- B. オンラインでcloudFilesがない場合はsyncAtを1で更新（=auto関数が発火）
        if (cloudFiles.length === 0 || !Array.isArray(idbFiles)) {
          setImageset((prev) =>
            prev.name === currentName
              ? { ...prev, syncAt: idbUpdatedAt ?? 1 }
              : prev
          );
          return;

          // - C. オンラインでcloudFilesがある場合は同期（=auto関数が発火）
        } else {
          const syncedFiles = await idb.sync(currentName, cloudFiles, {
            dateKey: "updatedAt",
            order: "desc",
          });
          // debug
          console.log("GET:syncedFiles:", syncedFiles);
          setImageset((prev) =>
            prev.name === currentName
              ? {
                  ...prev,
                  files: syncedFiles,
                  syncAt: cloudFiles[0].updatedAt,
                }
              : prev
          );
        }
      }
      // debug
      console.log("GET imageset:", imageset);
    } catch (error) {
      console.error("Error updating media:", error);
    }
  }, [idb, cloud, isOnline, imageset.name]);

  const autoPostImage = useCallback(
    async ({
      setName,
      file,
      syncAt,
    }: {
      file: File;
      setName: string;
      syncAt: number;
    }) => {
      if (
        file.id || // idがある（＝POSTされている）
        file.size === 0 || // サイズが0
        syncAt === 0 || // syncAtが0（＝cloudfilesをダウンロードしていない）
        isBusy.includes(file.idbId)
      )
        return; // 上記条件下では処理しない
      setIsBusy((prev) => [...prev, file.idbId]);
      console.log("autoPOST:file:", file);

      // INFO:アップロードはidbの作成までコントローラーで行う

      try {
        if (isOnline) {
          // 1-1. オンラインアップロード
          const fileId =
            (await cloud.postFile({ file, imagesetName: setName })) ?? null;
          if (!fileId) throw new Error("Failed to upload file");
          // 1-2. ファイルを更新 ※idのみ更新（バージョンはあげない）
          const newFile = { ...file, id: fileId };

          // 2. imagesetのsyncAtと該当ファイルの更新
          setImageset((prev) =>
            prev.name === setName
              ? {
                  ...prev,
                  files: prev.files.map((f) =>
                    f.idbId === file.idbId ? newFile : f
                  ),
                  syncAt: file.updatedAt,
                }
              : prev
          );
          // 3. IDBのidのみ更新
          await idb.put(setName, newFile);
        }
      } catch (error) {
        console.error(`Error uploading file with id ${file.idbId}:`, error);
      } finally {
        setIsBusy((prev) => prev.filter((id) => id !== file.idbId));
      }
    },
    [cloud, idb, isBusy]
  );

  const autoPutImage = useCallback(
    async ({
      setName,
      file,
      syncAt,
    }: {
      file: File;
      setName: string;
      syncAt: number;
    }) => {
      if (
        !file.id || // idがない（＝POSTされていない）
        file.size === 0 || // サイズが0
        file.updatedAt <= syncAt || // 更新日がsyncAt以前
        isBusy.includes(file.idbId) // すでにアップロード中
      )
        return; // 上記条件下では処理しない
      setIsBusy((prev) => [...prev, file.idbId]);
      console.log("autoPUT:file:", file);

      // 1. IDBの更新
      await idb.put(setName, file);

      try {
        if (isOnline) {
          // 2. オンラインアップデート
          await cloud.putFile({ file, imagesetName: setName });
          // 3. imagesetのsyncAtを更新
          setImageset((prev) =>
            prev.name === setName
              ? {
                  ...prev,
                  syncAt: file.updatedAt,
                }
              : prev
          );
        }
      } catch (error) {
        console.error(`Error updating file with id ${file.idbId}:`, error);
      } finally {
        setIsBusy((prev) => prev.filter((id) => id !== file.idbId));
      }
    },
    [cloud, isBusy]
  );

  const autoCleanup = useCallback(
    async ({ setName, syncAt }: { setName: string; syncAt: number }) => {
      if (syncAt === 0) return;
      // 1. imagesetのクリーニング(deletedAtがsyncAtより古いfileを削除)
      setImageset((prev) =>
        prev.name === setName
          ? {
              ...prev,
              files: prev.files.filter(
                (file) => !(file.deletedAt && file.deletedAt < syncAt)
              ),
            }
          : prev
      );
      // 2. IDBのクリーニング
      idb.cleanup(setName, { until: syncAt });
    },
    [imageset.name]
  );

  const deleteImage = useCallback(
    async ({ setName, file }: { setName: string; file: File }) => {
      if (isBusy.includes(file.idbId)) return;
      // 1. fileのversionとdeletedAtを更新
      const targetFile = {
        ...file,
        deletedAt: Date.now(),
        updatedAt: Date.now(),
        version: file.version + 1,
        blob: null,
      };
      // 2. IDBの更新（未アップロードファイルを考慮して論理削除）
      await idb.put(imageset.name, targetFile);

      // 3. imagesetの該当ファイルを更新
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

      try {
        // 4. オンラインの場合、バックエンドの削除を実行
        if (isOnline && targetFile.id) {
          // バックエンドを削除
          await cloud.deleteFile({ file: targetFile, imagesetName: setName });
          // IDBを削除
          await idb.delete(imageset.name, targetFile.idbId);
          // imagesetの削除
          setImageset((prev) =>
            prev.name === setName
              ? {
                  ...prev,
                  files: prev.files.filter((f) => f.idbId !== targetFile.idbId),
                }
              : prev
          );
        }
      } catch (error) {
        console.error("Error deleting file:", error);
      }
    },
    [imageset.name, idb, cloud, isOnline]
  );

  useEffect(() => {
    console.log("cameraState:", cameraState);
  }, [cameraState]);

  useEffect(() => {
    console.log("imageset.syncAt:", imageset.syncAt);
  }, [imageset.syncAt]);

  useEffect(() => {
    console.log("imageset.files:", imageset.files);
  }, [imageset.files]);

  useEffect(() => {
    // 開くたびに初期化
    const initialize = async () => {
      if (cameraState === "INITIALIZING") {
        await getImageset();
        autoCleanup({ setName: imageset.name, syncAt: imageset.syncAt });
      }
    };
    initialize();
  }, [imageset.name, cameraState]);

  useEffect(() => {
    const autoUpdate = async () => {
      if (
        imageset.syncAt === 0 || // syncAtが0の場合
        cameraState !== "SCANNING" || // SCANNING状態でない場合
        imageset.files.length === 0 // ファイルがない場合
      )
        return; // 上記条件下では処理しない

      // syncAtより新しいファイルを抽出
      const filesToUpdate = imageset.files.filter(
        (file) => file.updatedAt > imageset.syncAt
      );
      if (filesToUpdate.length === 0) return; // 更新がない場合は処理しない
      const fileToUpdate = filesToUpdate[filesToUpdate.length - 1];
      // debug
      console.log("filesToUpdate:", filesToUpdate);
      console.log("imageset.syncAt:", imageset.syncAt);

      // デバウンス後に同期処理を実行
      const timeoutId = setTimeout(() => {
        if (!fileToUpdate.id) {
          // ファイルにidがない場合のみautoPostを実行
          autoPostImage({
            setName: imageset.name,
            file: fileToUpdate,
            syncAt: imageset.syncAt,
          });
        } else {
          // ファイルにidがある場合のみautoPutを実行
          autoPutImage({
            setName: imageset.name,
            file: fileToUpdate,
            syncAt: imageset.syncAt,
          });
        }
      }, 500); // 0.5秒のデバウンス
      return () => clearTimeout(timeoutId);
    };
    autoUpdate();
  }, [imageset, isOnline, cameraState]);

  return (
    <>
      {imageset.files
        .filter((file) => !file.deletedAt)
        .map((file) => (
          <div key={file.idbId} className="relative h-full pt-3 pr-2">
            {/* TODO: カルーセルではsrcのサイズが大きいときの最適化が必要 */}
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
                      deleteImage({ file, setName: imageset.name })
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
        ))}
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
