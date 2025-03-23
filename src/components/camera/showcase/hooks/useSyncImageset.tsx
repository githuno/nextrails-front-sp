import { useCallback, useState } from "react";
import { apiFetch } from "@/hooks/useFetch";
import { useStorage } from "@/components/storage";
import { useImageset, type Imageset, type File } from "@/components/camera";

const useSyncImageset = () => {
  const { idb, cloud } = useStorage();
  const { setImageset } = useImageset();
  const [isSyncing, setIsSyncing] = useState<string[]>([]); // file.idbId or imageset.name

  const pullFiles = useCallback(
    async ({
      setName,
      options,
    }: {
      setName: string;
      options?: { params: string };
    }): Promise<File[]> => {
      if (!cloud.storage) return [];
      // 即座に取得日時をセットしておく
      const now = Date.now();

      try {
        // バックエンドからファイル情報を取得
        const json = await apiFetch<File[]>(
          `/files?name=${setName}${options ? `&${options.params}` : ""}`
        );
        if (!json) return [];

        console.log("⚡️ json:", json);

        // クラウドストレージからblobを取得（対象は未削除のみ）
        const keys = json
          .filter((file) => !file.deletedAt)
          .map((file) => file.key as string);
        const blobs = await cloud.provider
          ?.download({ keys })
          .catch((error: Error) => {
            console.error("Error downloading blobs:", error);
            return [] as Blob[];
          });

        // ファイル情報を整形して返す
        const files = json.map((file) => ({
          ...file,
          fetchedAt: now,
          shouldPush: false,
          idbId:
            file.key
              ?.split("/")
              .pop()
              ?.replace(/\.[^/.]+$/, "") || "",
          blob:
            !file.deletedAt && blobs
              ? blobs[keys.indexOf(file.key!)] || null
              : null,
        }));
        if (files.length === 0 || !Array.isArray(files)) return [];
        return files;
      } catch (error) {
        console.error("Error fetching media:", error);
        throw error;
      }
    },
    [cloud, idb, setImageset]
  );

  const postFile = useCallback(
    async (imagesetName: string, file: File): Promise<File | undefined> => {
      setIsSyncing((prev) => [...prev, file.idbId]);
      try {
        if (!file.contentType || !file.idbUrl || !file.idbId) {
          throw new Error("Invalid file data");
        }

        // 1. ストレージにアップロードしてkeyを取得
        const type = cloud.contentTypeToExtension[file.contentType];
        const storagePath = `${cloud.storage?.uuid}/${imagesetName}_${type.class}/${file.idbId}.${type.ext}`;
        const key = (await cloud.provider?.upload({
          storagePath: storagePath,
          fileId: file.idbId,
          filePath: file.idbUrl,
          contentType: file.contentType,
        })) as unknown as string;

        // 2. バックエンドにファイルをPOST
        const fileData = {
          ...file,
          key: key,
          fetchedAt: 0,
          shouldPush: false,
          idbUrl: file.idbUrl,
          // idbId:
          //   key
          //     ?.split("/")
          //     .pop()
          //     ?.replace(/\.[^/.]+$/, "") || "",
        };
        const updatedFile = await apiFetch<File>(
          `/files?name=${imagesetName}`,
          {
            method: "POST",
            body: JSON.stringify(fileData),
          }
        );
        // 3. 各プロパティをセット
        updatedFile.fetchedAt = 0;
        updatedFile.shouldPush = false;
        updatedFile.idbUrl = file.idbUrl;
        updatedFile.idbId = file.idbId;
        // updatedFile.idbId =
        //   updatedFile.key
        //     ?.split("/")
        //     .pop()
        //     ?.replace(/\.[^/.]+$/, "") || "";

        // 4. 更新されたファイルを返す
        return updatedFile as File;
      } catch (error) {
        console.error("Error uploading files:", error);
        throw error;
      } finally {
        setIsSyncing((prev) => prev.filter((id) => id !== file.idbId));
      }
    },
    [cloud, setImageset]
  );

  const putFile = useCallback(
    async (imagesetName: string, file: File): Promise<File | undefined> => {
      setIsSyncing((prev) => [...prev, file.idbId]);
      try {
        if (!file.id || !file.version || !file.createdAt || !file.updatedAt)
          return;
        const updatedFile = await apiFetch<File>(
          `/files/${file.id}?name=${imagesetName}`,
          {
            method: "PUT",
            body: JSON.stringify(file),
          }
        );
        return updatedFile as File;
      } catch (error) {
        console.error("Error updating files:", error);
        throw error;
      } finally {
        setIsSyncing((prev) => prev.filter((id) => id !== file.idbId));
      }
    },
    []
  );

  const deleteFile = useCallback(
    async (imagesetName: string, file: File): Promise<void> => {
      setIsSyncing((prev) => [...prev, file.idbId]);
      try {
        if (!file.id || !file.version || !file.updatedAt || !file.deletedAt)
          throw new Error("Invalid file data");
        await apiFetch(`/files/${file.id}/s?name=${imagesetName}`, {
          method: "DELETE",
          body: JSON.stringify(file),
        });
      } catch (error) {
        console.error("Error updating files:", error);
        throw error;
      } finally {
        setIsSyncing((prev) => prev.filter((id) => id !== file.idbId));
      }
    },
    []
  );

  const syncPullFiles = useCallback(
    async ({
      setName,
      options,
    }: {
      setName: string;
      options?: { params: string };
    }): Promise<void> => {
      setIsSyncing((prev) => [...prev, setName]);

      try {
        // クラウドからファイルを取得
        const cloudFiles = await pullFiles({ setName, options });

        // あればIDBに同期
        const syncedFiles = await idb.sync(setName, cloudFiles, {
          dateKey: "updatedAt",
          order: "desc",
        });

        // あればimagesetにセット
        setImageset((prev) =>
          prev.name === setName
            ? {
                ...prev,
                files: syncedFiles,
              }
            : prev
        );
      } catch (error) {
        console.error("Error fetching media:", error);
        throw error;
      } finally {
        setIsSyncing((prev) => prev.filter((id) => id !== setName));
      }
    },
    [cloud, idb, setImageset]
  );

  const syncPushFile = useCallback(
    async ({ set }: { set: Imageset }) => {
      if (!cloud.storage) return;
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
          await deleteFile(set.name, file);
          await idb.delete(set.name, file.idbId); // IDBの物理削除
        } else if (file.id && file.version) {
          // PUT
          await putFile(set.name, file);
          await idb.put(set.name, newFile);
        } else if (!file.id) {
          // POST
          newFile = (await postFile(set.name, file)) as File;
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
        throw error;
      } finally {
        setIsSyncing((prev) => prev.filter((id) => id !== file.idbId));
      }
    },
    [idb, postFile, putFile, deleteFile, isSyncing]
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

  return {
    isSyncing,
    checkUpdatedAt,
    syncPullFiles,
    syncPushFile,
    pullFiles,
  };
};

export { useSyncImageset };
