"use client";
import React, { useCallback, useEffect, useState } from "react";
import {
  useIdb,
  useCloudStorage,
  FileType,
  LoadingSpinner,
  EditIcon,
  CloseIcon,
  SyncIcon,
  ImagesetStatus,
} from "../_utils";
import { useCameraContext } from "../CameraContext";
import { Modal, session } from "@/components";

interface Imageset {
  id: string;
  name: string;
  status: ImagesetStatus;
  files: FileType[];
}

const LocalGallery = () => {
  const { cloudStorage, isUploading, contentTypeToExtension } =
    useCloudStorage();
  const { storeName, setStoreName, cameraState, setCameraState, dbName } =
    useCameraContext();
  const { idb, idbState } = useIdb<FileType>(dbName);
  const [imageset, setImageset] = useState<Imageset>({
    id: "", // TODO: UUIDを生成
    name: storeName,
    status: ImagesetStatus.DRAFT,
    files: [],
  });
  const [latestImagesets, setLatestImagesets] = useState<FileType[]>([]);
  const [isNameModalOpen, setIsNameModalOpen] = useState<boolean>(false);
  const isOnline = navigator.onLine;
  const [syncAt, setSyncAt] = useState<Date | null>(null);

  // オンラインメソッド GET -----------------------------------------------------
  const getCloudFiles = useCallback(
    async ({ params }: { params?: string } = {}): Promise<FileType[]> => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE}/files?name=${storeName}${
            params ? `&${params}` : ""
          }`
        );
        if (!response.ok) {
          throw new Error(`Response not ok: ${response.status}`);
        }

        // レスポンスbodyの各keyの末尾からstorageIdを取得し、blobをダウンロード
        const cloudFiles = await response.json().then(async (json) => {
          const keys = json
            .filter((file: FileType) => !file.deletedAt) // 削除済みファイルはkeysから除外
            .map((file: FileType) => file.key);
          const blobs = await cloudStorage.download({ keys }).catch((error) => {
            console.error("Error downloading blobs:", error);
            return []; // エラーの場合は空の配列を返すか、適切な処理をする
          });

          const files = json.map((file: FileType) => {
            file.storageId =
              file.key
                ?.split("/")
                .pop()
                ?.replace(/\.[^/.]+$/, "") || "";
            if (!file.deletedAt) {
              const blobIndex = keys.indexOf(file.key);
              if (blobIndex !== -1 && blobs[blobIndex]) {
                file.blob = blobs[blobIndex];
              } else {
                console.error(`Failed to fetch blob for ${file.key}`);
              }
            }
            return file;
          });
          return files;
        });
        console.log("cloudFiles", cloudFiles);

        return cloudFiles;
      } catch (error) {
        console.error("Error fetching media:", error);
        return [];
      }
    },
    [storeName]
  );

  // オンラインメソッド POST -----------------------------------------------------
  const autoUploadFiles = useCallback(async () => {
    try {
      const filesToUpload = imageset.files.filter((file) => {
        // 基本的なチェック
        if (file.key || file.id) return false;
        // すでにアップロード中のファイルを除外
        if (isUploading.includes(file.storageId)) return false;
        // 重複チェック（例：ハッシュや内容による比較）
        const isDuplicate = imageset.files.some(
          (existingFile) =>
            existingFile.key && existingFile.storageId === file.storageId
        );
        return !isDuplicate;
      });
      for (const file of filesToUpload) {
        if (!file.contentType || !file.path || !file.storageId) continue;
        // CloudStorageへアップロード
        const type = contentTypeToExtension[file.contentType];
        file.key = await cloudStorage.upload({
          storagePath: `users/${session.userId}/${storeName}/${type.class}/${file.storageId}.${type.ext}`,
          fileId: file.storageId,
          filePath: file.path,
          contentType: file.contentType,
        });

        // バックエンドへPOST
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE}/files?name=${storeName}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(file),
          }
        );
        if (!response.ok) {
          throw new Error(`Failed to upload file: ${response.statusText}`);
        }
        const updatedFile = await response.json();
        const updatedFileStorageId = updatedFile.key
          ?.split("/")
          .pop()
          .replace(/\.[^/.]+$/, "");
        const updatedFileId = updatedFile.id;
        // imagesetの該当ファイルidを更新
        setImageset((prev) => {
          return {
            ...prev,
            files: prev.files.map((f) =>
              f.storageId === updatedFileStorageId
                ? { ...f, id: updatedFileId }
                : f
            ),
          };
        });
        // debug
        console.log("fileをアップロード", imageset.files);
      }
    } catch (error) {
      console.error("Error uploading files:", error);
    }
  }, [cloudStorage, imageset, storeName]);

  // オンラインメソッド PUT -----------------------------------------------------
  const autoUpdateFiles = useCallback(async () => {
    try {
      if (!syncAt) return;
      // updatedAtがsyncAtより新しく、かつ既にidがあるファイルを更新
      const filesToUpdate = imageset.files.filter(
        (file) => new Date(file.updatedAt) > syncAt && file.id !== null
      );

      for (const file of filesToUpdate) {
        await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE}/files/${file.id}?name=${storeName}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(file),
          }
        );
      }
    } catch (error) {
      console.error("Error updating files:", error);
    }
  }, [imageset, syncAt, storeName]);

  // オンラインメソッド DELETE --------------------------------------------------
  const deleteFile = useCallback(async (fileId: string) => {
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE}/files/${fileId}/s?name=${storeName}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    } catch (error) {
      console.error("Error updating files:", error);
    }
  }, [storeName]);

  const getImageset = useCallback(async () => {
    // debug
    console.log("getImageset storeName", storeName);
    try {
      const files = await idb.get(storeName);
      setImageset((prev) => ({
        ...prev,
        files: Array.isArray(files) ? files : [],
      }));

      if (isOnline) {
        const tmpCloudFiles = await getCloudFiles();
        if (tmpCloudFiles.length === 0) return;

        // syncメソッドはidbに存在しない、または更新されたファイルをidbにaddし、最新のファイルセットを返す
        const updatedIdbFiles = await idb.sync(storeName, tmpCloudFiles);
        if (
          !updatedIdbFiles ||
          !Array.isArray(updatedIdbFiles) ||
          updatedIdbFiles.length === 0
        )
          return; // 更新されたファイルがない場合は何もしない

        // // 削除済みのファイルを除外
        // const activeUpdatedFiles = updatedIdbFiles.filter(
        //   (file) => !file.deletedAt
        // );

        setSyncAt(
          new Date(
            updatedIdbFiles.reduce((prev, current) =>
              prev.updatedAt > current.updatedAt ? prev : current
            ).updatedAt
          )
        );

        setImageset((prev) => ({
          ...prev,
          files: updatedIdbFiles,
        }));
      }
    } catch (error) {
      console.error("Error updating media:", error);
    }
  }, [idb, storeName, getCloudFiles, isOnline]);

  // TODO: 未使用
  const getLatestImagesets = useCallback(async () => {
    try {
      const stores = await idb.getStores();
      console.log("stores", stores);
      for (const store of stores) {
        const idbLatestFile = (await idb.get(store, {
          updatedAt: "latest",
        })) as FileType;
        setLatestImagesets((prev) => [...prev, idbLatestFile]);

        // オンラインならクラウドからファイルを取得
        if (isOnline) {
          // 最新更新ファイルのみを取得
          const tmpCloudFile = await getCloudFiles({
            params: `updatedAt=latest`,
          });

          // syncメソッドはidbに存在しない、または更新されたファイルをidbにaddし、最新のファイルセットを返す
          const updatedIdbFiles = await idb.sync(store, tmpCloudFile);
          if (
            !updatedIdbFiles ||
            !Array.isArray(updatedIdbFiles) ||
            updatedIdbFiles.length === 0
          )
            return;

          // 最新更新日時をsyncAtにセット→これ以降の更新を自動反映していく
          setSyncAt(
            new Date(
              updatedIdbFiles.reduce((prev, current) =>
                prev.updatedAt > current.updatedAt ? prev : current
              ).updatedAt
            )
          );

          setLatestImagesets((prev) => ({
            ...prev,
            files: Array.isArray(updatedIdbFiles) ? updatedIdbFiles : [],
          }));
        }
      }
    } catch (error) {
      console.error("Error updating media:", error);
    }
  }, [
    idb,
    getCloudFiles,
    isOnline,
    setSyncAt,
    setImageset,
    setLatestImagesets,
  ]);

  const deleteImage = useCallback(
    async (file: FileType) => {
      try {
        // debug
        console.log("fileを削除", file);

        // 1. fileのversionとdeletedAtを更新
        const targetFile = {
          ...file,
          deletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: (file.version ?? 0) + 1,
          blob: null,
        };

        // 2. imagesetの該当ファイルのdeletedAtを更新
        setImageset((prev) => {
          return {
            ...prev,
            files: prev.files.map((f) =>
              f.storageId === targetFile.storageId ? targetFile : f
            ),
          };
        });

        // 2. IDBの更新
        if (targetFile) {
          await idb.put(storeName, targetFile);
        }

        // 3. オンラインの場合、バックエンドの削除を実行
        if (isOnline && targetFile.id) {
          const response = await deleteFile(targetFile.id);
          // if (!response.ok) {
          //   throw new Error('Failed to delete file from backend');
          // }
        }

        // カメラの状態はリセットしない
        // setCameraState("INITIALIZING"); を削除
      } catch (error) {
        console.error("Error deleting file:", error);
        // エラー時はUIを元に戻す
        setImageset((prev) => ({
          ...prev,
          files: [...prev.files, file],
        }));
        // エラーをユーザーに通知する処理を追加
      }
    },
    [idb, storeName, isOnline]
  );

  useEffect(() => {
    const initialize = async () => {
      // INITIALIZINGの場合のみ実行
      if (cameraState === "INITIALIZING") {
        await getImageset();
        // getLatestImagesets();
        setCameraState("SCANNING");
      }
    };
    initialize();
  }, [storeName, cameraState]);

  useEffect(() => {
    const syncData = async () => {
      // debug
      console.log("CHANGE:imageset", imageset.files);
      if (
        imageset.files.length === 0 ||
        !isOnline ||
        cameraState !== "SCANNING"
      )
        return;

      const timeoutId = setTimeout(() => {
        autoUploadFiles();
        autoUpdateFiles();
      }, 1000); // 1秒のデバウンス
      return () => clearTimeout(timeoutId);
    };
    syncData();
  }, [imageset.files, isOnline]);

  return (
    <div className="grid px-1 h-[25vh] items-center justify-center rounded-lg shadow-lg bg-white/80">
      <Modal
        isOpen={isNameModalOpen}
        onClose={() => setIsNameModalOpen(false)}
        className="bg-transparent"
      >
        <div className="rounded-lg p-4 bg-white/80 shadow-lg">
          <h2 className="text-xl mb-4">setNameを編集</h2>
          <input
            type="text"
            value={storeName}
            onChange={(e) => {
              setStoreName(e.target.value);
              setCameraState("INITIALIZING");
            }}
            className="w-full p-2 border border-gray-300 bg-white/80 rounded"
          />
        </div>
      </Modal>

      <section className="grid grid-cols-3 grid-rows-1 h-1/5 w-full items-center justify-between pt-2">
        {idbState.isLoading ? (
          <div className="col-span-3 grid justify-center">
            <LoadingSpinner size="24px" />
          </div>
        ) : (
          <>
            <div className="col-span-2 row-start-1 flex items-center justify-center">
              <h1 className="font-bold text-center break-words">
                setName: {storeName}
              </h1>
              <button
                onClick={() => setIsNameModalOpen(true)}
                className="ml-2 p-1 bg-transparent hover:bg-gray-200 rounded-full transition-colors"
              >
                <EditIcon />
              </button>
            </div>
            {/* TODO: 削除済みを除外する */}
            <p className="text-center break-words">
              count: {imageset.files.length}
            </p>
          </>
        )}
      </section>

      <section className="grid grid-cols-3 grid-rows-1 h-4/5 w-full items-center justify-center gap-2">
        {imageset.files
          .filter((file) => !file.deletedAt) // TODO：表示は更新日順かつ、削除済みファイルを除外
          .map((file) => (
            <div key={file.storageId} className="relative h-full pt-3 pr-2">
              {file.contentType === "video/webm" ? (
                <video
                  controls
                  src={file.path ?? ""}
                  className="h-full w-full object-contain"
                />
              ) : (
                <img
                  src={file.path ?? ""}
                  alt={`Image ${file.storageId}`}
                  className="h-full w-full object-contain"
                />
              )}
              {idbState.isDeleting.includes(file.storageId) ||
              idbState.isPosting.includes(file.storageId) ? (
                <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-50">
                  <LoadingSpinner />
                </div>
              ) : (
                <div>
                  <button
                    onClick={() => deleteImage(file)}
                    className="absolute top-0 right-0 rounded-full bg-white/80 p-1 z-10"
                  >
                    <CloseIcon />
                  </button>
                  {isUploading.includes(file.key ?? "") && (
                    <div className="absolute top-0 left-0">
                      <SyncIcon size="24" />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
      </section>

      {/* 開発環境でDBの初期化ボタンを配置 */}
      {process.env.NODE_ENV === "development" && (
        <section className="flex fixed bottom-4 right-4 text-xs p-1 m-1 gap-1">
          <button
            className="bg-gray-200"
            onClick={() => idb.debug().then(() => console.log("debugDB done"))}
          >
            debugDB
          </button>
          <button
            className="bg-gray-200"
            onClick={() => {
              // TODO: UUIDを生成
              setImageset({
                id: "",
                name: storeName,
                status: ImagesetStatus.DRAFT,
                files: [],
              });
              idb.destroy();
              getImageset();
            }}
          >
            destroyDB
          </button>
        </section>
      )}
    </div>
  );
};

export { LocalGallery };
