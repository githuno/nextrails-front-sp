import { useCallback, useState } from "react";
import { apiFetch } from "@/hooks/useFetch";
import { useStorage } from "@/components/storage";
import {
  useImageset,
  type Imageset,
  type File,
  ImagesetState,
} from "@/components/camera";
import { useSyncImageset } from "./useSyncImageset";

const useSyncLatests = () => {
  const { idb, cloud } = useStorage();
  const { imageset } = useImageset();
  const { checkUpdatedAt, pullFiles } = useSyncImageset();

  const [latestImagesets, setLatestImagesets] = useState<Imageset[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const pullImagesets = useCallback(
    async ({
      params,
      excludeSetName,
    }: {
      params?: string;
      excludeSetName?: string;
    }): Promise<Imageset[]> => {
      if (!cloud.storage) return [];

      try {
        // 1. バックエンドからimagesets情報を取得
        const json = await apiFetch<Imageset[]>(
          `/imagesets${params ? `?${params}` : ""}`
        );
        if (!json) return [];

        // 2. imagesetごとにfilesを取得
        const cloudImagesets = await Promise.all(
          json.map(async (imageset: Imageset) => {
            if (!imageset) return null; // imagesetがnullの場合はスキップ

            // 2-1. 条件に当てはまるセットはfilesを空にしてスキップ
            if (
              !Array.isArray(imageset.files) || // filesが配列でない場合
              imageset.name === excludeSetName // 除外対象のimagesetの場合
            ) {
              imageset.files = [];
              return imageset;
            }

            // 2-2. filesについてfileごとに各要素をセット
            const files = await Promise.all(
              imageset.files.map(async (file: File) => {
                // 2-2-1. blobをDLしてセット
                const blobs: (Blob | null)[] =
                  (await cloud.provider
                    ?.download({ keys: [file.key ?? ""] })
                    .catch((error: Error): (Blob | null)[] => {
                      console.error("Error downloading blobs:", error);
                      return [null];
                    })) ?? [];

                return {
                  ...file,
                  blob: blobs[0] ?? null,
                  // 2-2-2. IDB用のidをセット
                  idbId:
                    file.key
                      ?.split("/")
                      .pop()
                      ?.replace(/\.[^/.]+$/, "") || "",
                  // 2-2-3. 取得日時は0にセット
                  fetchedAt: 0,
                  // 2-2-4. 送信フラグはfalseにセット
                  shouldPush: false,
                };
              })
            );

            return {
              ...imageset,
              files,
            };
          })
        );

        // nullは除外して返す
        return cloudImagesets.filter(
          (imageset): imageset is Imageset => imageset !== null
        );
      } catch (error) {
        console.error("Error fetching media:", error);
        return [];
      }
    },
    [cloud.provider, cloud.storage]
  );

  interface SyncSetType {
    storeName: string;
    files: File[];
  }

  const syncPullLatests = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      let forSyncSets: SyncSetType[] = [];
      // 1. クラウドから最新のimageSetsを取得（※ここでidbId, blob, fetcedAtもセット済み）
      const cloudLatestSets: Imageset[] = await pullImagesets({
        params: `updatedAt=latest`,
        excludeSetName: imageset.name,
      });

      // 2. idbとの同期型に変換してセット
      forSyncSets = cloudLatestSets
        .filter((set) => set.name !== imageset.name && set.files.length > 0)
        .map((set) => ({
          storeName: set.name,
          files: set.files,
        }));

      // 3. idbと同期
      const syncedSets: SyncSetType[] = await idb.syncLatests({
        dateKey: "updatedAt",
        set: forSyncSets,
      });

      // 4. Imageset型に更新して更新日降順で並び替え
      const updatedSets: Imageset[] = syncedSets.map((set) => ({
        id: set.files[0] ? BigInt(set.files[0].updatedAt) : BigInt(0), // 仮のセットID
        name: set.storeName,
        status: ImagesetState.DRAFT,
        files: set.files,
      }));
      // 5. idの降順で並び替え
      updatedSets.sort((a, b) => Number(b.id) - Number(a.id));
      setLatestImagesets(updatedSets);
      setIsLoading(false);
      // -----------------------------------------------------------------------
      // 特別. 非同期で各storeのcloudfilesをidbに同期しておく
      const syncPromises = latestImagesets
        .filter((set) => set.name !== imageset.name)
        .map(async (store) => {
          let params = "deletedAt_null=true&updatedAt_sort=desc";
          const idbFiles = await idb.get(store.name, {
            date: { key: "updatedAt", order: "desc" },
          });
          // INFO: lengthが1なら今回取得した最新ファイルのため削除されていないファイルを全取得すればよい
          // INFO: lengthが2以上ならIDBにもともと存在するファイルであり、クラウド上は削除されている可能性があるため"deletedAt_null=true"は使えない
          if (Array.isArray(idbFiles) && idbFiles.length > 1) {
            params = `updatedAt_over=${checkUpdatedAt(
              idbFiles
            )}&updatedAt_sort=desc`;
          }
          try {
            const cloudfiles = await pullFiles({
              setName: store.name,
              options: { params },
            });
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
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [
    cloud.provider,
    cloud.storage,
    idb,
    imageset.name,
    pullImagesets,
    checkUpdatedAt,
  ]);

  return {
    isLoading,
    latestImagesets,
    syncPullLatests,
  };
};

export { useSyncLatests };
