"use client";
import React, { useCallback, useEffect, useState } from "react";
import {
  useIdb,
  useCloudStorage,
  LoadingSpinner,
  EditIcon,
  CloseIcon,
  SyncIcon,
} from "../_utils";
import {
  useCameraContext,
  File,
  Imageset,
  ImagesetState,
} from "../CameraContext";
import { Modal, session } from "@/components";

const LocalGallery = () => {
  const { imageset, setImageset, cameraState, setCameraState, dbName } =
    useCameraContext();
  const { cloudStorage, contentTypeToExtension } = useCloudStorage();
  const { idb, idbState } = useIdb<File>(dbName);

  const isOnline = navigator.onLine;
  const [latestImagesets, setLatestImagesets] = useState<Imageset[]>([]);
  const [isNameModalOpen, setIsNameModalOpen] = useState<boolean>(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState<boolean>(false);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [isPosting, setIsPosting] = useState<string[]>([]);
  const [isPutting, setIsPutting] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState<string[]>([]);

  // オンラインメソッド GET -----------------------------------------------------
  const getOnlineFiles = useCallback(
    async (imagesetName: string): Promise<File[]> => {
      setIsFetching(true);
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE}/files?name=${imagesetName}`
        );
        if (!response.ok) {
          throw new Error(`Response not ok: ${response.status}`);
        }

        const cloudFiles = await response.json().then(async (json) => {
          console.log("GET:json:", json);
          // keyからblobをダウンロード
          const keys = json
            .filter((file: File) => !file.deletedAt) // 削除済みファイルはkeysから除外してblobは取得しない
            .map((file: File) => file.key);
          const blobs = await cloudStorage.download({ keys }).catch((error) => {
            console.error("Error downloading blobs:", error);
            return []; // エラーの場合は空の配列を返すか、適切な処理をする
          });

          // ローカル用に整形
          const files = json.map((file: File) => {
            // 1. keyからidbIdを取得
            file.idbId =
              file.key
                ?.split("/")
                .pop()
                ?.replace(/\.[^/.]+$/, "") || "";
            // 2. 削除済みファイルはblobを付与しない ※idb上で削除されず、cloud上では削除されたファイルを考慮
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
    [cloudStorage]
  );

  // オンラインメソッド GET -----------------------------------------------------
  const getOnlineImagesets = useCallback(
    async ({ params }: { params?: string }): Promise<Imageset[]> => {
      try {
        const response = await fetch(
          params
            ? `${process.env.NEXT_PUBLIC_API_BASE}/imagesets?${params}`
            : `${process.env.NEXT_PUBLIC_API_BASE}/imagesets`
        );
        if (!response.ok) {
          throw new Error(`Response not ok: ${response.status}`);
        }
        const cloudImagesets = await response.json().then(async (json) => {
          const imagesets = await Promise.all(
            json.map(async (imageset: Imageset) => {
              if (!imageset) {
                return null; // imagesetがundefinedの場合はnullを返す
              }
              // syncAtを追加
              imageset.syncAt = null;
              // filesプロパティが存在しない場合や、値が配列でない場合に空の配列を設定
              imageset.files = Array.isArray(imageset.files)
                ? imageset.files
                : [];

              imageset.files = await Promise.all(
                imageset.files.map(async (file: File) => {
                  // blobをDLしてセット
                  const blobs = await cloudStorage
                    .download({ keys: [file.key ?? ""] })
                    .catch((error) => {
                      console.error("Error downloading blobs:", error);
                      return [null]; // エラーの場合はnullを返すか、適切な処理をする
                    });
                  file.blob = blobs[0] as Blob;
                  // IDB用のidをセット
                  file.idbId =
                    file.key
                      ?.split("/")
                      .pop()
                      ?.replace(/\.[^/.]+$/, "") || "";
                  // 削除済みファイルはcloudから返ってこないため考慮不要
                  return file;
                })
              );
              return imageset;
            })
          );
          return imagesets.filter((imageset) => imageset !== null); // nullを除外
        });
        return cloudImagesets;
      } catch (error) {
        console.error("Error fetching media:", error);
        return [];
      } finally {
        // setIsFetching(false);
      }
    },
    [cloudStorage]
  );

  // オンラインメソッド PUT -----------------------------------------------------
  const putOnlineFile = useCallback(
    async ({ imagesetName, file }: { imagesetName: string; file: File }) => {
      try {
        if (!file.id || !file.version || !file.createdAt || !file.deletedAt)
          return;
        setIsPutting((prev) => [...prev, file.idbId]);
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE}/files/${file.id}?name=${imagesetName}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(file),
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
    []
  );

  // オンラインメソッド POST(idを返す) ---------------------------------------
  const postOnlineFile = useCallback(
    async ({
      imagesetName,
      file,
    }: {
      imagesetName: string;
      file: File;
    }): Promise<string | undefined> => {
      try {
        if (!file.contentType || !file.idbUrl || !file.idbId) return;
        setIsPosting((prev) => [...prev, file.idbId]);

        // 1. CloudStorageへアップロード---------------
        const type = contentTypeToExtension[file.contentType];
        // cloudStorageへアップロードして、keyを格納
        file.key = await cloudStorage.upload({
          storagePath: `users/${session.userId}/${imagesetName}/${type.class}/${file.idbId}.${type.ext}`,
          fileId: file.idbId,
          filePath: file.idbUrl,
          contentType: file.contentType,
        });

        // 2. バックエンドへPOST-----------------------
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE}/files?name=${imagesetName}`,
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
        return updatedFile.id;
      } catch (error) {
        console.error("Error uploading files:", error);
      } finally {
        setIsPosting((prev) => prev.filter((id) => id !== file.idbId));
      }
    },
    [cloudStorage, contentTypeToExtension]
  );

  // オンラインメソッド DELETE --------------------------------------------------
  const deleteOnlineFile = useCallback(
    async ({ imagesetName, file }: { imagesetName: string; file: File }) => {
      try {
        if (!file.id || !file.version || !file.updatedAt || !file.deletedAt)
          throw new Error("Invalid file data");
        setIsDeleting((prev) => [...prev, file.idbId]);
        await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE}/files/${file.id}/s?name=${imagesetName}`,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(file),
          }
        );
      } catch (error) {
        console.error("Error updating files:", error);
      } finally {
        setIsDeleting((prev) => prev.filter((id) => id !== file.idbId));
      }
    },
    []
  );

  const getImageset = useCallback(async () => {
    const currentName = imageset.name;
    try {
      // IDBからファイルを取得
      const idbFiles = await idb.get(imageset.name);
      if (Array.isArray(idbFiles) && idbFiles.length > 0) {
        // idbファイルが存在する場合
        setImageset((prev) =>
          prev.name === currentName ? { ...prev, files: idbFiles } : prev
        );
      }

      if (!isOnline) {
        return; // A. オフラインであればidbfilesの有無にかかわらず終了（=auto関数も発火不要）
      } else {
        const cloudFiles = await getOnlineFiles(currentName);
        console.log("GET:cloudFiles:", cloudFiles);
        if (cloudFiles.length === 0 || !Array.isArray(idbFiles)) {
          // B. オンラインでcloudFilesがない場合はsyncAtを1で更新（=auto関数が発火）
          setImageset((prev) =>
            prev.name === currentName
              ? { ...prev, syncAt: new Date(1).getTime() }
              : prev
          );
          return;
        } else {
          // C. オンラインでcloudFilesがある場合は同期（=auto関数が発火）
          const syncedFiles = await idb.sync(currentName, cloudFiles);
          console.log("GET:syncedFiles:", syncedFiles);
          setImageset((prev) =>
            prev.name === currentName
              ? {
                  ...prev,
                  files: syncedFiles,
                  syncAt: cloudFiles.reduce((prev, current) =>
                    prev.updatedAt > current.updatedAt ? prev : current
                  ).updatedAt,
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
  }, [idb, getOnlineFiles, isOnline, imageset.name]);

  const autoUploadImageset = useCallback(
    async (targetSet: Imageset) => {
      // syncAtがない（＝cloudfilesをダウンロードしていない）場合は実行しない
      if (!targetSet.syncAt || !isOnline) return;

      // 対象ファイルを抽出
      let filesToUpload = targetSet.files.filter((file) => {
        // 1. 基本的なチェック -------------------------
        if (file.key) return false;
        // 2. すでにアップロード中のファイルを除外 ------
        if (isPosting.includes(file.idbId)) return false;
        // 3. 重複チェック（例：ハッシュや内容による比較）
        const isDuplicate = imageset.files.some(
          (existingFile) =>
            existingFile.key && existingFile.idbId === file.idbId
        );
        return !isDuplicate;
      });

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
            (await postOnlineFile({ file, imagesetName: targetSet.name })) ??
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
    [imageset, postOnlineFile, idb, isOnline]
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

      for (const file of filesToUpdate) {
        try {
          await putOnlineFile({ file, imagesetName: targetSet.name });
        } catch (error) {
          console.error(`Error updating file with id ${file.id}:`, error);
        }
      }
    },
    [imageset, putOnlineFile]
  );

  const deleteImage = useCallback(
    async ({ imagesetName, file }: { imagesetName: string; file: File }) => {
      // 1. fileのversionとdeletedAtを更新
      const targetFile = {
        ...file,
        deletedAt: Date.now(),
        updatedAt: Date.now(),
        version: (file.version ?? 0) + 1,
        blob: null,
      };

      // 2. imagesetの該当ファイルのdeletedAtを更新
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

      try {
        // 2. IDBの更新（未アップロードファイルを考慮して論理削除）
        await idb.put(imageset.name, targetFile);

        // 3. オンラインの場合、バックエンドの削除を実行
        if (isOnline && targetFile.id) {
          // バックエンドを削除
          await deleteOnlineFile({ file: targetFile, imagesetName });
          // IDBを削除
          await idb.delete(imageset.name, targetFile.idbId);
        }
      } catch (error) {
        console.error("Error deleting file:", error);
      }
    },
    [idb, imageset.name, isOnline, deleteOnlineFile]
  );

  const getLatestImagesets = useCallback(async () => {
    try {
      let allImagesets: Imageset[] = [];
      if (isOnline) {
        // 1. cloudから最新のimageを取得してlatestImagesetsにセット（※ここでblobもDL）
        const cloudLatestImagesets: Imageset[] = await getOnlineImagesets({
          params: `updatedAt=latest`,
        });
        // 2. 同期store名を取得（cloudLatestImagesetsの各name配列を渡す）
        const cloudStores = cloudLatestImagesets.map((set) => set.name);
        const syncedStores = await idb.syncStores(cloudStores);
        // 3. syncedStoresのうち、cloudStoresに含まれないstore名についてimagesetを追加
        const diffSets = syncedStores
          .filter((store) => !cloudStores.includes(store))
          .map((store) => ({
            id: new Date().getTime(),
            name: store,
            status: ImagesetState.DRAFT,
            files: [],
            syncAt: null,
          }));
        allImagesets = [...cloudLatestImagesets, ...diffSets];
        setLatestImagesets([...allImagesets]);
      }
      // 4. allImagesetsを同期(storeNameとfileのセットを渡す)
      const syncedSets = await idb.syncLatests(
        allImagesets.map((imageset) => ({
          file: imageset.files[0],
          storeName: imageset.name,
        }))
      );
      // 5. latestImagesetsのfilesを更新
      setLatestImagesets((prev) =>
        prev.map((imageset) => {
          const syncedSet = syncedSets.find(
            (set) => set.storeName === imageset.name
          );
          return syncedSet
            ? {
                id: imageset.id,
                name: syncedSet.storeName,
                status: ImagesetState.DRAFT,
                syncAt: syncedSet.updatedAt,
                files: [syncedSet as File],
              }
            : imageset;
        })
      );
      // 特別. 非同期で各storeのcloudfilesをidbに同期しておく
      const syncPromises = latestImagesets.map(async (store) => {
        try {
          const cloudfiles = await getOnlineFiles(store.name);
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
  }, [idb, getOnlineFiles, isOnline, setLatestImagesets]);

  useEffect(() => {
    console.log("cameraState:", cameraState);
  }, [cameraState]);

  useEffect(() => {
    console.log("idbState:", idbState);
  }, [idbState]);

  useEffect(() => {
    console.log("syncAt:", imageset.syncAt);
  }, [imageset.syncAt]);

  useEffect(() => {
    console.log("latestImageset:", latestImagesets);
  }, [latestImagesets]);

  useEffect(() => {
    const initialize = async () => {
      await getImageset();
      getLatestImagesets();
      setCameraState("SCANNING");
    };
    initialize();
  }, [imageset.name]);

  useEffect(() => {
    const syncImageset = async () => {
      if (
        !isOnline ||
        !imageset.syncAt ||
        cameraState === "INITIALIZING" ||
        imageset.files.length === 0
      )
        return;
      const timeoutId = setTimeout(() => {
        autoUploadImageset(imageset);
        autoUpdateImageset(imageset);
      }, 1000); // 1秒のデバウンス
      return () => clearTimeout(timeoutId);
    };
    syncImageset();
  }, [imageset, isOnline]);

  return (
    <div className="grid px-1 h-[25vh] items-center justify-center rounded-lg shadow-lg bg-white/80">
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
                  id: new Date().getTime(),
                  name: newName,
                  status: ImagesetState.DRAFT,
                  files: [],
                  syncAt: null,
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

      <section className="relative grid grid-cols-3 grid-rows-1 h-4/5 w-full items-center justify-center gap-2">
        {imageset.files
          .filter((file) => !file.deletedAt) // TODO：表示は更新日順かつ、削除済みファイルを除外
          .map((file) => (
            <div key={file.idbId} className="relative h-full pt-3 pr-2">
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
                isDeleting.includes(file.idbId) ? (
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
        {(idbState.isStoreSyncing.includes(imageset.name) || isFetching) && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50">
            <LoadingSpinner size="32px" />
          </div>
        )}
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
            onClick={() => idb.debug().then(() => console.log("debugDB done"))}
          >
            debugDB
          </button>
          <button
            className="bg-gray-200"
            onClick={() => {
              setImageset({
                id: new Date().getTime(),
                name: "1",
                status: ImagesetState.DRAFT,
                files: [],
                syncAt: null,
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
