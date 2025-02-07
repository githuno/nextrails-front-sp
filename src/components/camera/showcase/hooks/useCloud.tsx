import React, { useContext, useCallback, useState, ReactNode, createContext, useEffect, useLayoutEffect } from "react";
import { session } from "@/components";
import { File, Imageset } from "@/components/camera";
import { useCloudStorage } from "@/components/camera/_utils";
import { useCamera } from "@/components/camera/_utils";

interface CloudState {
  isOnline: boolean | null; // オンラインかどうか
  isFilesFetching: boolean; // filesを取得中
  isPosting: string[]; // file.idbIdを追加中
  isPutting: string[]; // file.idbIdを更新中
  isDeleting: string[]; // file.idbIdを削除中
}

interface CloudContextProps {
  cloudState: CloudState;
  checkOnlineStatus: () => Promise<boolean>;
  cloudGetImagesets: (params: { params?: string; excludeSetName?: string }) => Promise<Imageset[]>;
  cloudGetFiles: (imagesetName: string, options?: { params: string }) => Promise<File[]>;
  cloudPutFile: (params: { imagesetName: string; file: File }) => Promise<void>;
  cloudPostFile: (params: { imagesetName: string; file: File }) => Promise<File>;
  cloudDeleteFile: (params: { imagesetName: string; file: File }) => Promise<void>;
  checkUpdatedAt: (descendedLocalfiles: File[]) => number;
}

const CloudContext = createContext<CloudContextProps | undefined>(undefined);

const CloudProvider = ({ children }: { children: ReactNode }) => {
  const {cameraState} = useCamera();
  const [cloudState, setCloudState] = useState<CloudState>({
    isOnline: null, // navigator.onLine,
    isFilesFetching: false,
    isPosting: [],
    isPutting: [],
    isDeleting: [],
  });
  const { cloudStorage, contentTypeToExtension } = useCloudStorage();

  // オンライン状況のチェック
  const checkOnlineStatus = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/health`);
      const isOnline = response.ok;
      setCloudState(prev => ({ ...prev, isOnline }));
      return isOnline;
    } catch (error) {
      setCloudState(prev => ({ ...prev, isOnline: false }));
      return false;
    }
  }, []);
  useLayoutEffect(() => {
    if(cameraState.isAvailable !== null) checkOnlineStatus();
      // checkOnlineStatus();
    return () => {
      setCloudState(prev => ({ ...prev, isOnline: null }));
    }
  }, [cameraState.isAvailable]);

  // imagesetsを取得して返す
  const cloudGetImagesets = useCallback(
    async ({
      params,
      excludeSetName,
    }: {
      params?: string;
      excludeSetName?: string;
    }): Promise<Imageset[]> => {
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
              if (!imageset) return null; // imagesetがnullの場合はスキップ

              // 1. 条件に当てはまるセットはfilesを空にしてスキップ
              if (
                !Array.isArray(imageset.files) || // filesが配列でない場合
                imageset.name === excludeSetName // 除外対象のimagesetの場合
              ) {
                imageset.files = [];
                return imageset;
              }

              // 2. セット.filesについてfileごとに各要素をセット
              imageset.files = await Promise.all(
                imageset.files.map(async (file: File) => {
                  // 2-1. blobをDLしてセット
                  const blobs: (Blob | null)[] = await cloudStorage
                    .download({ keys: [file.key ?? ""] })
                    .catch((error: Error): (Blob | null)[] => {
                      console.error("Error downloading blobs:", error);
                      return [null]; // エラーの場合はnullを返すか、適切な処理をする
                    });
                  file.blob = blobs[0] as Blob;

                  // 2-2. IDB用のidをセット
                  file.idbId =
                    file.key
                      ?.split("/")
                      .pop()
                      ?.replace(/\.[^/.]+$/, "") || "";
                  // 2-3. 取得日時は0にセット
                  file.fetchedAt = 0;
                  file.shouldPush = false;
                  return file;
                })
              );
              return imageset;
            })
          );
          // nullは除外して返す
          return imagesets.filter((imageset) => imageset !== null);
        });
        return cloudImagesets;
      } catch (error) {
        console.error("Error fetching media:", error);
        return [];
      }
    },
    [cloudStorage]
  );

  // imageset.filesを取得して返す
  const cloudGetFiles = useCallback(
    async (
      imagesetName: string,
      options?: { params: string }
    ): Promise<File[]> => {
      setCloudState((prev) => ({ ...prev, isFilesFetching: true }));
      const now = Date.now(); // 先に取得日時をセットしておく
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE}/files?name=${imagesetName}${
            options ? `&${options.params}` : ""
          }`
        );
        if (!response.ok) {
          throw new Error(`Response not ok: ${response.status}`);
        }

        const cloudFiles: File[] = await response.json().then(async (json) => {
          // 1. keyを取得
          const keys = json
            .filter((file: File) => !file.deletedAt || !file.idbUrl) // 削除済みorIDB保存済みファイルはkeysから除外してblobは取得しない
            .map((file: File) => file.key);

          // 2. keyからblobをダウンロード
          const blobs: Blob[] = await cloudStorage
            .download({ keys })
            .catch((error: Error) => {
              console.error("Error downloading blobs:", error);
              return [] as Blob[]; // エラーの場合は空の配列を返すか、適切な処理をする
            });

          // 3. 各fileにプロパティをセット
          const files = json.map((file: File) => {
            file.fetchedAt = now;
            file.shouldPush = false;
            file.idbId =
              file.key
                ?.split("/")
                .pop()
                ?.replace(/\.[^/.]+$/, "") || "";
            // 削除済みファイルはblobを付与しない ※idb上で削除されず、cloud上では削除されたファイルを考慮
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
          // 4. blobをセットしたファイルを返す
          return files;
        });
        return cloudFiles;
      } catch (error) {
        console.error("Error fetching media:", error);
        return [];
      } finally {
        setCloudState((prev) => ({ ...prev, isFilesFetching: false }));
      }
    },
    [cloudStorage]
  );

  // imageset.fileを更新する
  const cloudPutFile = useCallback(
    async ({
      imagesetName,
      file,
    }: {
      imagesetName: string;
      file: File;
    }): Promise<void> => {
      setCloudState((prev) => ({
        ...prev,
        isPutting: [...prev.isPutting, file.idbId],
      }));
      try {
        if (!file.id || !file.version || !file.createdAt || !file.updatedAt)
          return;
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
      } catch (error) {
        console.error("Error updating files:", error);
      } finally {
        setCloudState((prev) => ({
          ...prev,
          isPutting: prev.isPutting.filter((id) => id !== file.idbId),
        }));
      }
    },
    []
  );

  // imageset.fileを追加して返す
  const cloudPostFile = useCallback(
    async ({
      imagesetName,
      file,
    }: {
      imagesetName: string;
      file: File;
    }): Promise<File> => {
      setCloudState((prev) => ({
        ...prev,
        isPosting: [...prev.isPosting, file.idbId],
      }));
      try {
        if (!file.contentType || !file.idbUrl || !file.idbId) {
          throw new Error("Invalid file data");
        }

        // 1. CloudStrageにアップロードしてkeyを取得
        const type = contentTypeToExtension[file.contentType];
        try {
          file.key = await cloudStorage.upload({
            storagePath: `users/${session.userId}/${imagesetName}/${type.class}/${file.idbId}.${type.ext}`,
            fileId: file.idbId,
            filePath: file.idbUrl,
            contentType: file.contentType,
          });
        } catch (uploadError) {
          console.error("Error uploading file to cloud storage:", uploadError);
          throw new Error("Failed to upload file to cloud storage");
        }

        // 2. CloudにファイルをPOST
        let response;
        try {
          response = await fetch(
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
            const errorText = await response.text();
            throw new Error(`Failed to upload file: ${response.statusText} - ${errorText}`);
          }
        } catch (networkError) {
          console.error("Network error:", networkError);
          throw new Error("Network error occurred while uploading file");
        }
        const updatedFile = await response.json();
        // 3. 各プロパティをセット
        updatedFile.fetchedAt = 0;
        updatedFile.shouldPush = false;
        updatedFile.idbUrl = file.idbUrl;
        updatedFile.idbId =
          updatedFile.key
            ?.split("/")
            .pop()
            ?.replace(/\.[^/.]+$/, "") || "";

        // 4. 更新されたファイルを返す
        return updatedFile as File;
      } catch (error) {
        console.error("Error uploading files:", error);
        return Promise.reject(error);
      } finally {
        setCloudState((prev) => ({
          ...prev,
          isPosting: prev.isPosting.filter((id) => id !== file.idbId),
        }));
      }
    },
    [cloudStorage, contentTypeToExtension]
  );

  // imageset.fileを論理削除する
  const cloudDeleteFile = useCallback(
    async ({
      imagesetName,
      file,
    }: {
      imagesetName: string;
      file: File;
    }): Promise<void> => {
      setCloudState((prev) => ({
        ...prev,
        isDeleting: [...prev.isDeleting, file.idbId],
      }));
      try {
        if (!file.id || !file.version || !file.updatedAt || !file.deletedAt)
          throw new Error("Invalid file data");
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
        setCloudState((prev) => ({
          ...prev,
          isDeleting: prev.isDeleting.filter((id) => id !== file.idbId),
        }));
      }
    },
    []
  );

  const checkUpdatedAt = useCallback((descendedLocalfiles: File[]): number => {
    let lastPushedAt = 0;
    let firstUpdatedAt = 0;

    for (const file of descendedLocalfiles) {
      // fetchedAt が 0 でない最新ファイル（配列の先頭）日時を取得
      if (file.fetchedAt !== 0) return file.fetchedAt;
      // shouldPush が false の最新ファイル（配列の先頭）日時を取得
      if (lastPushedAt === 0 && !file.shouldPush) {
        lastPushedAt = file.updatedAt;
        break;
      }
      // 更新日が最古（配列の最後）のファイル日時を取得
      firstUpdatedAt = file.updatedAt;
    }

    return lastPushedAt || firstUpdatedAt;
  }, []);

  return (
    <CloudContext.Provider
      value={{
        cloudState,
        checkOnlineStatus,
        cloudGetImagesets,
        cloudGetFiles,
        cloudPutFile,
        cloudPostFile,
        cloudDeleteFile,
        checkUpdatedAt,
      }}
    >
      {children}
    </CloudContext.Provider>
  );
};


const useCloud = (): CloudContextProps => {
  const context = useContext(CloudContext);
  if (!context) {
    throw new Error("useCloud must be used within a CloudProvider");
  }
  return context;
};

export { CloudProvider, useCloud };