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
} from "../_utils";
import { useCameraContext } from "../CameraContext";
import { Modal } from "@/components";

const LocalGallery = () => {
  const { imageSetName, setImageSetName, cameraState, setCameraState, dbName } =
    useCameraContext();
  const [isNameModalOpen, setIsNameModalOpen] = useState<boolean>(false);
  const [idbFiles, setIdbFiles] = useState<FileType[]>([]);
  const { idb, idbState } = useIdb<FileType>(dbName);
  const { cloudStorage, isUploading } = useCloudStorage({
    endpoint: process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3001",
  });

  const getCloudFiles = useCallback(async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE}/imagesets/${imageSetName}/images`
      );
      if (response.ok) {
        const cloudfiles: FileType[] = await response.json();
        if (Array.isArray(cloudfiles)) {
          setIdbFiles((prev) => {
            const fileMap = new Map<string, FileType>();

            // 既存のファイルをマップに追加
            prev.forEach((file) => {
              fileMap.set(file.id, file);
            });

            // 新しいファイルをマップに追加または更新
            cloudfiles.forEach((file) => {
              const existingFile = fileMap.get(file.id);
              if (
                !existingFile ||
                new Date(file.updatedAt ?? 0) >
                  new Date(existingFile.updatedAt ?? 0)
              ) {
                fileMap.set(file.id, file);
              }
            });

            // マップから配列に変換して返す
            return Array.from(fileMap.values());
          });
        }
      }
    } catch (error) {
      console.error("Error fetching media:", error);
    }
  }, [imageSetName]);

  const getIdbFiles = useCallback(async () => {
    try {
      // await idb.updateFileInfoPaths(imageSetName); // PATHの取り直し
      const localFiles = await idb.get(imageSetName);
      if (Array.isArray(localFiles)) {
        const updatedFiles = localFiles.map((file) => {
          const objectURL = file.blob ? URL.createObjectURL(file.blob) : "";
          return { ...file, path: objectURL };
        });

        setIdbFiles((prev) => {
          const fileMap = new Map<string, FileType>();

          // 既存のファイルをマップに追加
          prev.forEach((file) => {
            fileMap.set(file.id, file);
          });

          // 新しいファイルをマップに追加または更新
          updatedFiles.forEach((file) => {
            const existingFile = fileMap.get(file.id);
            if (
              !existingFile ||
              new Date(file.updatedAt ?? 0) >
                new Date(existingFile.updatedAt ?? 0)
            ) {
              fileMap.set(file.id, file);
            }
          });

          // マップから配列に変換して返す
          return Array.from(fileMap.values());
        });
      }
    } catch (error) {
      console.error("Error updating media:", error);
    }
  }, [idb, imageSetName]);

  const autoUploadFiles = useCallback(async () => {
    try {
      const filesToUpload = idbFiles.filter((file) => file.key === null);
      for (const file of filesToUpload) {
        // TODO: ここでfile.extensionに応じたディレクトリを指定する
        const storagePath = `users/images/${file.id}.${file.extension}`;

        if (!file.path) continue;
        file.key = await cloudStorage.upload(
          storagePath,
          file.id,
          file.path,
          "image/jpeg" // TODO: ここでfile.extensionに応じたcontentTypeを指定する
        );
      }
    } catch (error) {
      console.error("Error uploading files:", error);
    }
  }, [cloudStorage, idbFiles, getIdbFiles]);

  useEffect(() => {
    if (cameraState === "initializing") {
      getIdbFiles();
      setCameraState("scanning");
    }
  }, [imageSetName, cameraState]);

  useEffect(() => {
    autoUploadFiles();
    return () => {
      idbFiles.forEach((file) => {
        if (file.path) {
          URL.revokeObjectURL(file.path);
        }
      });
    };
  }, [idbFiles]);

  // debug
  useEffect(() => {
    console.log("idbFiles", idbFiles);
    console.log("isLoading", idbState.isLoading);
    console.log("isDeleting", idbState.isDeleting);
    console.log("isPosting", idbState.isPosting);
  }, [idbFiles, idbState]);

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
            value={imageSetName}
            onChange={(e) => setImageSetName(e.target.value)}
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
                setName: {imageSetName}
              </h1>
              <button
                onClick={() => setIsNameModalOpen(true)}
                className="ml-2 p-1 bg-transparent hover:bg-gray-200 rounded-full transition-colors"
              >
                <EditIcon />
              </button>
            </div>
            {/* TODO: 削除済みを除外する */}
            <p className="text-center break-words">count: {idbFiles.length}</p>
          </>
        )}
      </section>

      <section className="grid grid-cols-3 grid-rows-1 h-4/5 w-full items-center justify-center gap-2">
        {idbFiles
          .filter((file) => !file.deletedAt)
          .map((file) => (
            <div key={file.id} className="relative h-full pt-3 pr-2">
              {file.extension === "webm" ? (
                <video
                  controls
                  src={file.path ?? ""}
                  className="h-full w-full object-contain"
                />
              ) : (
                <img
                  src={file.path ?? ""}
                  alt={`Image ${file.id}`}
                  className="h-full w-full object-contain"
                />
              )}
              {idbState.isDeleting.includes(file.id) ||
              idbState.isPosting.includes(file.id) ? (
                <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-50">
                  <LoadingSpinner />
                </div>
              ) : (
                <div>
                  <button
                    onClick={async () => {
                      setIdbFiles((prev) =>
                        prev.filter((prevFile) => prevFile.id !== file.id)
                      );
                      await idb.put(imageSetName, {
                        ...file,
                        version: (file.version ?? 0) + 1,
                        updatedAt: new Date().toISOString(),
                        deletedAt: new Date().toISOString(),
                      } as FileType);
                      // await idb.delete(imageSetName, file.id);
                      setCameraState("initializing");
                    }}
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
              setIdbFiles([]);
              idb.destroy();
              getIdbFiles();
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
