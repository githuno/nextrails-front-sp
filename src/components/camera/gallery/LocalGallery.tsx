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
  const { cloudStorage, contentTypeToExtension } = useCloudStorage();
  const { storeName, setStoreName, cameraState, setCameraState, dbName } =
    useCameraContext();
  const { idb, idbState } = useIdb<FileType>(dbName);
  const [imageset, setImageset] = useState<Imageset>({
    id: "", // TODO: UUIDを生成
    name: storeName,
    status: ImagesetStatus.DRAFT,
    files: [],
  });
  const isOnline = navigator.onLine;
  const [latestImagesets, setLatestImagesets] = useState<FileType[]>([]);
  const [isNameModalOpen, setIsNameModalOpen] = useState<boolean>(false);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [isPosting, setIsPosting] = useState<string[]>([]);
  const [isPutting, setIsPutting] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState<string[]>([]);
  const [syncAt, setSyncAt] = useState<Date | null>(null);

  // オンラインメソッド GET -----------------------------------------------------
  const getOnlineFiles = useCallback(
    async ({ params }: { params?: string } = {}): Promise<FileType[]> => {
      setIsFetching(true);
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE}/files?name=${storeName}${
            params ? `&${params}` : ""
          }`
        );
        if (!response.ok) {
          throw new Error(`Response not ok: ${response.status}`);
        }

        const cloudFiles = await response.json().then(async (json) => {
          // keyからblobをダウンロード
          const keys = json
            .filter((file: FileType) => !file.deletedAt) // 削除済みファイルはkeysから除外してblobは取得しない
            .map((file: FileType) => file.key);
          const blobs = await cloudStorage.download({ keys }).catch((error) => {
            console.error("Error downloading blobs:", error);
            return []; // エラーの場合は空の配列を返すか、適切な処理をする
          });

          // ローカル用に整形
          const files = json.map((file: FileType) => {
            // 1. keyからidbIdを取得
            file.idbId =
              file.key
                ?.split("/")
                .pop()
                ?.replace(/\.[^/.]+$/, "") || "";
            // 2. 日時を"JST"に変換
            file.updatedAt = new Date(file.updatedAt).toLocaleString("ja-JP");
            file.createdAt = file.createdAt
              ? new Date(file.createdAt).toLocaleString("ja-JP")
              : new Date().toLocaleString("ja-JP");
            file.deletedAt = file.deletedAt
              ? new Date(file.deletedAt).toLocaleString("ja-JP")
              : null;
            // 3. 削除済みファイルはblobを付与しない
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
        return cloudFiles;
      } catch (error) {
        console.error("Error fetching media:", error);
        return [];
      } finally {
        setIsFetching(false);
      }
    },
    [storeName, cloudStorage]
  );

  // オンラインメソッド PUT -----------------------------------------------------
  const putOnlineFile = useCallback(
    async (file: FileType) => {
      try {
        if (!file.id || !file.version || !file.createdAt || !file.deletedAt)
          return;
        setIsPutting((prev) => [...prev, file.idbId]);
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE}/files/${file.id}?name=${storeName}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            // 日時を"UTC"に変換して送信
            body: JSON.stringify({
              ...file,
              updatedAt: new Date(file.updatedAt).toISOString(),
              createdAt: new Date(file.createdAt).toISOString(),
              deletedAt: new Date(file.deletedAt).toISOString(),
            }),
          }
        );
        if (!response.ok) {
          throw new Error(`Failed to update file: ${response.statusText}`);
        }
        setIsPutting((prev) => prev.filter((id) => id !== file.idbId));
      } catch (error) {
        console.error("Error updating files:", error);
      } finally {
        setIsPutting((prev) => prev.filter((id) => id !== file.idbId));
      }
    },
    [storeName]
  );

  // オンラインメソッド POST(idを返す) ---------------------------------------
  const postOnlineFile = useCallback(
    async (file: FileType): Promise<string | undefined> => {
      try {
        if (!file.contentType || !file.path || !file.idbId) return;
        setIsPosting((prev) => [...prev, file.idbId]);

        // 1. CloudStorageへアップロード---------------
        const type = contentTypeToExtension[file.contentType];
        // cloudStorageへアップロードして、keyを格納
        file.key = await cloudStorage.upload({
          storagePath: `users/${session.userId}/${storeName}/${type.class}/${file.idbId}.${type.ext}`,
          fileId: file.idbId,
          filePath: file.path,
          contentType: file.contentType,
        });

        // 2. バックエンドへPOST-----------------------
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE}/files?name=${storeName}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            // 日時を"UTC"に変換して送信
            body: JSON.stringify({
              ...file,
              updatedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              deletedAt: null,
            }),
          }
        );
        if (!response.ok) {
          throw new Error(`Failed to upload file: ${response.statusText}`);
        }
        const updatedFile = await response.json();
        return updatedFile.id;
      } catch (error) {
        console.error("Error uploading files:", error);
      } finally {
        setIsPosting((prev) => prev.filter((id) => id !== file.idbId));
      }
    },
    [storeName, cloudStorage, contentTypeToExtension]
  );

  // オンラインメソッド DELETE --------------------------------------------------
  const deleteOnlineFile = useCallback(
    async (file: FileType) => {
      try {
        if (!file.id || !file.version || !file.updatedAt || !file.deletedAt)
          throw new Error("Invalid file data");
        setIsDeleting((prev) => [...prev, file.idbId]);
        await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE}/files/${file.id}/s?name=${storeName}`,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
            // 日時を"UTC"に変換して送信
            body: JSON.stringify({
              version: file.version,
              updatedAt: new Date(file.updatedAt).toISOString(),
              deletedAt: new Date(file.deletedAt).toISOString(),
            }),
          }
        );
      } catch (error) {
        console.error("Error updating files:", error);
      } finally {
        setIsDeleting((prev) => prev.filter((id) => id !== file.idbId));
      }
    },
    [storeName]
  );

  const getImageset = useCallback(async () => {
    try {
      const idbFiles = await idb.get(storeName);
      // この時点ではsyncAtはnullのためauto関数は発火しない
      setImageset((prev) => ({
        ...prev,
        files: Array.isArray(idbFiles) ? idbFiles : [],
      }));

      // SyncAtに(idbFilesの最終更新日時｜0)をセット
      setSyncAt(
        new Date(
          Array.isArray(idbFiles) && idbFiles.length > 0
            ? idbFiles.reduce((prev, current) =>
                prev.updatedAt > current.updatedAt ? prev : current
              ).updatedAt
            : new Date(0).toISOString()
        )
      );

      if (isOnline) {
        const cloudFiles = await getOnlineFiles();
        // cloudFilesがない場合はSyncAtを(0)で上書きして終了
        // (ここまではidb側の最終更新日が入っているためuseIdbのputも発火しない)
        if (cloudFiles.length === 0 || !Array.isArray(idbFiles)) {
          setSyncAt(new Date(0));
          return;
        } else {
          // syncメソッドは差分（＝存在しないor更新された）ファイルをidbに追加したうえで最新のidbファイルセットを返す
          const syncedFiles = await idb.sync(storeName, cloudFiles);
          // SyncAtを(cloudFilesの最終更新日時｜0)で上書き
          // (ここまではidb側の最終更新日が入っているためuseIdbのputも発火しない)
          setSyncAt(
            new Date(
              Array.isArray(cloudFiles) && cloudFiles.length > 0
                ? cloudFiles.reduce((prev, current) =>
                    prev.updatedAt > current.updatedAt ? prev : current
                  ).updatedAt
                : new Date(0).toISOString()
            )
          );
          if (!Array.isArray(syncedFiles) || syncedFiles.length === 0) {
            // 更新ファイルがない場合はSyncAtにはidb側の最終更新日時が入っているためここで終了
            return;
          } else {
            // syncedFilesでimageset.filesを上書き→auto関数が発火する
            setImageset((prev) => ({
              ...prev,
              files: syncedFiles,
            }));
          }
        }
      }
    } catch (error) {
      console.error("Error updating media:", error);
    }
  }, [idb, storeName, getOnlineFiles, isOnline]);

  const autoUploadImageset = useCallback(async () => {
    // syncAtがない（＝cloudfilesをダウンロードしていない）場合は実行しない
    if (!syncAt || !isOnline) return;

    // 対象ファイルを抽出
    const filesToUpload = imageset.files.filter((file) => {
      // 1. 基本的なチェック -------------------------
      if (file.key) return false;
      // 2. すでにアップロード中のファイルを除外 ------
      if (isPosting.includes(file.idbId)) return false;
      // 3. 重複チェック（例：ハッシュや内容による比較）
      const isDuplicate = imageset.files.some(
        (existingFile) => existingFile.key && existingFile.idbId === file.idbId
      );
      return !isDuplicate;
    });

    // ひとつずつアップロード
    for (const file of filesToUpload) {
      try {
        // 1. オンラインアップロード
        const fileId = (await postOnlineFile(file)) ?? null;
        // 2. imagesetのidのみ更新 ----------------
        setImageset((prev) => {
          return {
            ...prev,
            files: prev.files.map((f) =>
              f.idbId === file.idbId ? { ...f, id: fileId } : f
            ),
          };
        });
        // 3. IDBのidのみ更新 ---------------------
        await idb.put(storeName, {
          ...file,
          id: fileId,
          // updatedAt: new Date().toISOString(), // idのみ更新
          // version: (file.version ?? 0) + 1, // idのみ更新
        });
      } catch (error) {
        console.error(`Error uploading file with id ${file.idbId}:`, error);
      }
    }
  }, [imageset, postOnlineFile, idb, storeName]);

  const autoUpdateImageset = useCallback(async () => {
    // syncAtがない（＝cloudfilesをダウンロードしていない）場合は実行しない
    if (!syncAt || !isOnline) return;

    // POST済の更新ファイル（＝updatedAtがsyncAtより新しく、かつ既にidがあるファイル）をクラウド更新
    const filesToUpdate = imageset.files.filter(
      (file) => new Date(file.updatedAt) > syncAt && file.id !== null
    );

    for (const file of filesToUpdate) {
      try {
        await putOnlineFile(file);
      } catch (error) {
        console.error(`Error updating file with id ${file.id}:`, error);
      }
    }
  }, [imageset, syncAt, putOnlineFile]);

  const deleteImage = useCallback(
    async (file: FileType) => {
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
            f.idbId === targetFile.idbId ? targetFile : f
          ),
        };
      });

      try {
        // 2. IDBの更新（未アップロードファイルを考慮して論理削除）
        await idb.put(storeName, targetFile);

        // 3. オンラインの場合、バックエンドの削除を実行
        if (isOnline && targetFile.id) {
          // バックエンドを削除
          await deleteOnlineFile(targetFile);
          // IDBを削除
          await idb.delete(storeName, targetFile.idbId);
        }
      } catch (error) {
        console.error("Error deleting file:", error);
      }
    },
    [idb, storeName, isOnline, deleteOnlineFile]
  );

  // TODO: 未使用
  const getOnlineLatestImagesets = useCallback(async () => {
    try {
      const idbStores = await idb.getStores();
      for (const store of idbStores) {
        const idbLatestFile = (await idb.get(store, {
          updatedAt: "latest",
        })) as FileType;
        setLatestImagesets((prev) => [...prev, idbLatestFile]);

        // オンラインならクラウドからファイルを取得
        if (isOnline) {
          // 最新更新ファイルのみを取得
          const tmpCloudFile = await getOnlineFiles({
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
    getOnlineFiles,
    isOnline,
    setSyncAt,
    setImageset,
    setLatestImagesets,
  ]);

  useEffect(() => {
    const initialize = async () => {
      if (cameraState === "INITIALIZING") {
        await getImageset();
        // getOnlineLatestImagesets();
        setCameraState("SCANNING");
      }
    };
    initialize();
  }, [storeName, cameraState]);

  useEffect(() => {
    const syncImageset = async () => {
      if (
        imageset.files.length === 0 ||
        !isOnline ||
        cameraState !== "SCANNING"
      )
        return;

      const timeoutId = setTimeout(() => {
        autoUploadImageset();
        autoUpdateImageset();
      }, 1000); // 1秒のデバウンス
      return () => clearTimeout(timeoutId);
    };
    syncImageset();
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
        {idbState.isLoading || isFetching ? (
          <div className="col-span-3 grid justify-center">
            <LoadingSpinner size="24px" />
          </div>
        ) : (
          <>
            <div className="col-span-2 row-start-1 flex items-center justify-center">
              <h1 className="font-bold text-center break-words">
                セット: {storeName}
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
            <div key={file.idbId} className="relative h-full pt-3 pr-2">
              {file.contentType === "video/webm" ? (
                <video
                  controls
                  src={file.path ?? ""}
                  className="h-full w-full object-contain"
                />
              ) : (
                <img
                  src={file.path ?? ""}
                  alt={`Image ${file.idbId}`}
                  className="h-full w-full object-contain"
                />
              )}
              {
                // 削除操作が不可な状態
                idbState.isDeleting.includes(file.idbId) ||
                idbState.isPosting.includes(file.idbId) ||
                isDeleting.includes(file.idbId) ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-50">
                    <LoadingSpinner />
                  </div>
                ) : (
                  // 削除操作が可能な状態
                  <div>
                    <button
                      onClick={() => deleteImage(file)}
                      className="absolute top-0 right-0 rounded-full bg-white/80 p-1 z-10"
                    >
                      <CloseIcon />
                    </button>
                    {(isPosting.includes(file.idbId) ||
                      isPutting.includes(file.idbId)) && (
                      <div className="absolute top-0 left-0">
                        <SyncIcon size="24" />
                      </div>
                    )}
                  </div>
                )
              }
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
