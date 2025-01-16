import React, { useCallback, useEffect, useState } from "react";
import { useIdb, LoadingSpinner, CloseIcon, SyncIcon } from "../_utils";
import {
  useCameraContext,
  File,
  Imageset,
  ImagesetState,
} from "../CameraContext";
import { useCloudImg } from "./hooks/useCloudImg";

const EditableImages = () => {
  const { imageset, setImageset, cameraState, setCameraState, dbName } =
    useCameraContext();
  const { idb, idbState } = useIdb<File>(dbName);
  const { cloud, cloudState, isOnline } = useCloudImg();

  const [isImageModalOpen, setIsImageModalOpen] = useState<boolean>(false);

  const getImageset = useCallback(async () => {
    const currentName = imageset.name;
    try {
      // IDBから降順でファイルを取得
      const idbFiles = await idb.get(imageset.name, {
        date: { key: "updatedAt", order: "desc" },
      });
      let idbUpdatedAt: number = 0;
      let params = "deletedAt_null=true"; // 削除されていないファイルのみ取得
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
            prev.name === currentName ? { ...prev, syncAt: 1 } : prev
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

  const autoUploadImageset = useCallback(
    async (targetSet: Imageset) => {
      // syncAtがない（＝cloudfilesをダウンロードしていない）場合は実行しない
      if (!targetSet.syncAt || !isOnline) return;

      // 対象ファイルを抽出
      let filesToUpload = targetSet.files.filter((file) => {
        // 1. 基本的なチェック -------------------------
        if (file.key) return false;
        // 2. すでにアップロード中のファイルを除外 ------
        if (cloudState.isPosting.includes(file.idbId)) return false;
        // 3. 重複チェック（例：ハッシュや内容による比較）
        const isDuplicate = imageset.files.some(
          (existingFile) =>
            existingFile.key && existingFile.idbId === file.idbId
        );
        return !isDuplicate;
      });

      if (filesToUpload.length === 0) return;

      // 更新日順に並べ替え（古い順）
      filesToUpload = filesToUpload.sort(
        (a, b) =>
          new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
      );

      // ひとつずつアップロード
      for (const file of filesToUpload) {
        try {
          // 1. オンラインアップロード
          const fileId =
            (await cloud.postFile({ file, imagesetName: targetSet.name })) ??
            null;
          // 2. imagesetのsyncAtと該当ファイルのidのみ更新
          setImageset((prev) =>
            prev.name === targetSet.name
              ? {
                  ...prev,
                  files: prev.files.map((f) =>
                    f.idbId === file.idbId ? { ...f, id: fileId } : f
                  ),
                  syncAt: file.updatedAt,
                }
              : prev
          );
          // 3. IDBのidのみ更新
          await idb.put(targetSet.name, {
            ...file,
            id: fileId,
            // updatedAt: Date.now(), // -------------INFO: idのみ更新
            // version: (file.version ?? 0) + 1, // --INFO: idのみ更新
          });
        } catch (error) {
          console.error(`Error uploading file with id ${file.idbId}:`, error);
        }
      }
    },
    [imageset, cloud, idb, isOnline]
  );

  const autoUpdateImageset = useCallback(
    async (targetSet: Imageset) => {
      // syncAtがない（＝cloudfilesをダウンロードしていない）場合は実行しない
      if (!targetSet.syncAt || !isOnline) return;

      // 更新するファイルを抽出
      const filesToUpdate = targetSet.files.filter(
        (file) =>
          file.updatedAt > targetSet.syncAt! && // 更新日がsyncAtより新しい
          file.id !== null // かつidがある(=POST済)
      );

      // TODO:ファイルがない場合はcloud,ローカルでsyncAtを更新して終了

      for (const file of filesToUpdate) {
        try {
          await cloud.putFile({ file, imagesetName: targetSet.name });
        } catch (error) {
          console.error(`Error updating file with id ${file.id}:`, error);
        }
      }
    },
    [imageset, cloud]
  );

  const deleteImage = useCallback(
    async ({ imagesetName, file }: { imagesetName: string; file: File }) => {
      // 1. fileのversionとdeletedAtを更新
      const targetFile = {
        ...file,
        deletedAt: Date.now(),
        updatedAt: Date.now(),
        version: file.version + 1,
        blob: null,
      };

      try {
        // 2. IDBの更新（未アップロードファイルを考慮して論理削除）
        await idb.put(imageset.name, targetFile);

        // 3. imagesetの該当ファイルのdeletedAtを更新
        setImageset((prev) =>
          prev.name === imagesetName
            ? {
                ...prev,
                files: prev.files.map((f) =>
                  f.idbId === targetFile.idbId ? targetFile : f
                ),
              }
            : prev
        );

        // 4. オンラインの場合、バックエンドの削除を実行
        if (isOnline && targetFile.id) {
          // バックエンドを削除
          await cloud.deleteFile({ file: targetFile, imagesetName });
          // IDBを削除
          await idb.delete(imageset.name, targetFile.idbId);
        }
      } catch (error) {
        console.error("Error deleting file:", error);
      }
    },
    [imageset.name, idb, cloud, isOnline]
  );

  // useEffect(() => {
  //   console.log("cameraState:", cameraState);
  // }, [cameraState]);

  // useEffect(() => {
  //   console.log("idbState:", idbState);
  // }, [idbState]);

  // useEffect(() => {
  //   console.log("imageset.syncAt:", imageset.syncAt);
  // }, [imageset.syncAt]);

  // useEffect(() => {
  //   const activeFiles = imageset.files.filter(
  //     (file) => file.deletedAt === null
  //   );
  //   console.log("active files:", activeFiles);
  // }, [imageset.files]);

  useEffect(() => {
    const initialize = async () => {
      if (cameraState === "INITIALIZING") {
        await getImageset();
        setCameraState("SCANNING");
      }
    };
    initialize();
  }, [imageset.name, cameraState]);

  useEffect(() => {
    const syncImageset = async () => {
      // 以下条件下では同期しない
      if (
        !isOnline || // オフラインの場合
        !imageset.syncAt || // syncAtがない場合
        cameraState !== "SCANNING" || // SCANNING状態でない場合
        imageset.files.length === 0 // ファイルがない場合
      )
        return;
      // 1秒後に同期処理を実行
      const timeoutId = setTimeout(() => {
        autoUploadImageset(imageset);
        autoUpdateImageset(imageset);
      }, 1000); // 1秒のデバウンス
      return () => clearTimeout(timeoutId);
    };
    syncImageset();
  }, [imageset, isOnline, cameraState]);

  return (
    <>
      {imageset.files
        .filter((file) => !file.deletedAt) // TODO：表示は更新日順かつ、削除済みファイルを除外
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
              idbState.isDeleting.includes(file.idbId) ||
              idbState.isPosting.includes(file.idbId) ||
              cloudState.isDeleting.includes(file.idbId) ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <LoadingSpinner />
                </div>
              ) : (
                // 削除操作が可能な状態
                <div>
                  <button
                    onClick={() =>
                      deleteImage({ file, imagesetName: imageset.name })
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
