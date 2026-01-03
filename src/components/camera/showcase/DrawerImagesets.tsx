import { Carousel, CarouselItem } from "@/components/atoms"
import { ImagesetState, useImageset } from "@/components/camera"
import { LoadingSpinner } from "@/components/camera/_utils"
import { LinesIcon } from "@/components/Icons"
import Image from "next/image"
import { useCallback, useEffect, useState } from "react"
import { useSyncLatests } from "./hooks/useSyncLatests"

const DrawerImagesets = () => {
  const { imageset, setImageset } = useImageset()
  const { isLoading, syncPullLatests, latestImagesets } = useSyncLatests()

  // const pullLatests = useCallback(async (): Promise<
  //   { storeName: string; files: File[] }[]
  // > => {
  //   try {
  //     // cloudから最新のimageSetsを取得（※ここでidbId, blob, fetcedAtもセット済み）
  //     const cloudLatestSets: Imageset[] = await syncPullLatests({
  //       params: `updatedAt=latest`,
  //       excludeSetName: imageset.name,
  //     });

  //     return cloudLatestSets
  //       .filter((set) => set.name !== imageset.name && set.files.length > 0)
  //       .map((set) => ({
  //         storeName: set.name,
  //         files: set.files,
  //       }));
  //   } catch (error) {
  //     console.error("Error updating media:", error);
  //     return [];
  //   }
  // }, [syncPullLatests, imageset.name]);

  // const getLatestImagesets = useCallback(async () => {
  //   interface SyncSetType {
  //     storeName: string;
  //     files: File[];
  //   }
  //   try {
  //     let forSyncSets: SyncSetType[] = [];
  //     setIsLoading(true);
  //     // 1. オンラインの場合、クラウドのimageSetsを取得
  //     const cloudLatests = await syncPullLatests();
  //     forSyncSets;
  //     // 2. 同期
  //     const syncedSets: SyncSetType[] = await idb.syncLatests({
  //       dateKey: "updatedAt",
  //       set: forSyncSets,
  //     });
  //     // 3. Imageset型に更新して更新日降順で並び替え
  //     const updatedSets: Imageset[] = syncedSets.map((set) => ({
  //       id: set.files[0] ? BigInt(set.files[0].updatedAt) : BigInt(0), // 仮のセットID
  //       name: set.storeName,
  //       status: ImagesetState.DRAFT,
  //       files: set.files,
  //     }));
  //     // 4. idの降順で並び替え
  //     updatedSets.sort((a, b) => Number(b.id) - Number(a.id));
  //     setLatestImagesets(updatedSets);
  //     setIsLoading(false);
  //     // -----------------------------------------------------------------------
  //     // 特別. 非同期で各storeのcloudfilesをidbに同期しておく
  //     const syncPromises = latestImagesets
  //       .filter((set) => set.name !== imageset.name)
  //       .map(async (store) => {
  //         let params = "deletedAt_null=true&updatedAt_sort=desc";
  //         const idbFiles = await idb.get(store.name, {
  //           date: { key: "updatedAt", order: "desc" },
  //         });
  //         // INFO: lengthが1なら今回取得した最新ファイルのため削除されていないファイルを全取得すればよい
  //         // INFO: lengthが2以上ならIDBにもともと存在するファイルであり、クラウド上は削除されている可能性があるため"deletedAt_null=true"は使えない
  //         if (Array.isArray(idbFiles) && idbFiles.length > 1) {
  //           params = `updatedAt_over=${checkUpdatedAt(
  //             idbFiles
  //           )}&updatedAt_sort=desc`;
  //         }
  //         try {
  //           const cloudfiles = await syncPullLatests({
  //             params,
  //             excludeSetName: store.name,
  //           });
  //           const files = cloudfiles.flatMap((set) => set.files as File[]);
  //           await idb.sync(store.name, files);
  //         } catch (error) {
  //           console.error(
  //             `Error syncing store ${store} with cloud files:`,
  //             error
  //           );
  //         }
  //       });
  //     await Promise.all(syncPromises);
  //   } catch (error) {
  //     console.error("Error updating media:", error);
  //   } finally {
  //     setIsLoading(false);
  //   }
  // }, [idb, setLatestImagesets, imageset.name]);

  const handleCarouselItemClick = useCallback(
    (name: string) => {
      if (name !== imageset.name) {
        setImageset({
          id: BigInt(Date.now()),
          name: name,
          status: ImagesetState.DRAFT,
          files: [],
        })
      }
      // ドロワーを閉じる
      const drawerToggle = document.getElementById("drawerToggle") as HTMLInputElement
      if (drawerToggle) {
        drawerToggle.checked = false
      }
    },
    [imageset.name, setImageset],
  )

  const [requireCloudState, setRequireCloudState] = useState<boolean>(true)

  useEffect(() => {
    let timeoutId: NodeJS.Timeout
    const fetchLatests = async () => {
      // 実行前に1秒待つ
      timeoutId = await new Promise((resolve) => setTimeout(resolve, 1000))
      if (requireCloudState) {
        syncPullLatests()
        setRequireCloudState(false)
      } else {
        syncPullLatests()
      }
    }
    fetchLatests()
    return () => {
      clearTimeout(timeoutId)
    }
  }, [imageset.files, requireCloudState, syncPullLatests])

  return (
    // ドロワー
    latestImagesets.length > 1 && (
      <div className="fixed z-10">
        <input type="checkbox" id="drawerToggle" className="peer hidden" />
        <div id="bg" className="fixed top-2 left-0 hidden h-[24vh] w-full bg-black/50 peer-checked:block" />
        <div className="fixed top-7 left-[-95vw] flex h-[20vh] w-[95vw] flex-col items-end rounded-tr-3xl bg-white/80 shadow-lg transition-all duration-300 peer-checked:left-0">
          <label
            htmlFor="drawerToggle"
            className="absolute right-[-1.2rem] bottom-0 flex h-8 w-8 translate-x-1/2 transform cursor-pointer items-center justify-center rounded-tr-full rounded-br-full bg-white/80 shadow-[4px_4px_6px_-1px_rgba(0,0,0,0.3)] transition-transform duration-300 peer-checked:rotate-180"
            // INFO: shadow-[X方向_Y方向_ぼかし半径_拡散半径_色] で影を調整している
          >
            {isLoading ? <LoadingSpinner size="16px" /> : <LinesIcon className="h-4 w-4" fill="#999" />}
          </label>

          {/* ドロワー内の要素 */}
          <div className="grid w-full justify-end px-4 py-2">
            <Carousel containerClassName="gap-x-2">
              {latestImagesets.map(({ name, files }) => (
                <CarouselItem
                  key={name}
                  className={`relative h-[15vh] w-32 rounded-lg bg-white shadow-xl hover:bg-gray-100 ${
                    name === imageset.name ? "border-2 border-blue-200" : ""
                  }`}
                >
                  <div
                    className="grid h-full w-full cursor-pointer grid-rows-5"
                    onClick={() => handleCarouselItemClick(name)}
                  >
                    <h1 className="text-center font-bold wrap-break-word">{name}</h1>
                    {files.length > 0 && (
                      <div className="relative row-span-4 h-full w-full">
                        {files[0].contentType === "video/webm" ? (
                          <video controls src={files[0].idbUrl ?? ""} className="h-full w-full object-contain" />
                        ) : (
                          // <img
                          //   src={files[0].idbUrl ?? ""}
                          //   alt={`Image ${files[0].idbId}`}
                          //   className="h-full w-full object-contain"
                          // />
                          <Image
                            src={files[0].idbUrl ?? ""}
                            alt={`Image ${files[0].idbId}`}
                            fill
                            style={{ objectFit: "contain" }}
                            className="p-0.5"
                          />
                        )}
                      </div>
                    )}
                  </div>
                </CarouselItem>
              ))}
            </Carousel>
          </div>
        </div>
      </div>
    )
  )
}

export { DrawerImagesets }
