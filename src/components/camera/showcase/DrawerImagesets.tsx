import { Carousel } from "@/components/atoms"
import { ImagesetState, useImageset } from "@/components/camera"
import { useCallback, useEffect, useState } from "react"
import { useSyncLatests } from "./hooks/useSyncLatests"

const LinesIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" className={className} {...props}>
    <path d="M2.39 2.105c-.342.108-.585.267-.857.562a1.974 1.974 0 0 0-.328 2.203c.145.305.562.746.848.89.492.254-.01.24 9.947.24 8.128 0 9.248-.01 9.492-.07.994-.263 1.645-1.238 1.477-2.222-.113-.675-.61-1.317-1.205-1.561l-.272-.108-9.422-.01c-8.906-.009-9.436-.004-9.68.076zM8.658 10.031c-1.036.178-1.795 1.228-1.631 2.255.14.867.81 1.542 1.673 1.683.37.06 12.23.06 12.6 0a2.025 2.025 0 0 0 1.673-1.683c.17-1.05-.595-2.081-1.673-2.255-.337-.056-12.314-.051-12.642 0zM14.498 18.07c-.38.103-.618.244-.904.535a1.945 1.945 0 0 0-.042 2.747c.28.3.53.454.89.557.235.07.638.075 3.656.066l3.394-.014.272-.108c.375-.155.834-.586 1.017-.966a1.985 1.985 0 0 0-1.289-2.817c-.394-.103-6.614-.098-6.994 0z" />
  </svg>
)

const DrawerImagesets = () => {
  const { imageset, setImageset } = useImageset()
  const { syncPullLatests, latestImagesets } = useSyncLatests()

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
        <div id="bg" className="fixed top-2 left-0 hidden h-[24vh] w-[90vw] bg-black/50 peer-checked:block" />
        <div className="fixed top-7 left-[-85vw] flex h-[20vh] w-[85vw] flex-col items-end rounded-tr-3xl bg-white/80 shadow-lg transition-all duration-300 peer-checked:left-0">
          <label
            htmlFor="drawerToggle"
            className="absolute right-[-1.2rem] bottom-0 flex h-8 w-8 translate-x-1/2 transform cursor-pointer items-center justify-center rounded-tr-full rounded-br-full bg-white/80 shadow-[4px_4px_6px_-1px_rgba(0,0,0,0.3)] transition-transform duration-300 peer-checked:rotate-180"
            // INFO: shadow-[X方向_Y方向_ぼかし半径_拡散半径_色] で影を調整している
          >
            <LinesIcon className="h-4 w-4" fill="#999" />
          </label>

          {/* ドロワー内の要素 */}
          <div className="grid w-full justify-end px-4 py-2">
            <Carousel containerClassName="gap-x-2">
              {latestImagesets.map(({ name, files }) => (
                <Carousel.Item
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
                          <img
                            src={files[0].idbUrl ?? ""}
                            alt={`Image ${files[0].idbId}`}
                            className="h-full w-full object-contain p-0.5"
                          />
                        )}
                      </div>
                    )}
                  </div>
                </Carousel.Item>
              ))}
            </Carousel>
          </div>
        </div>
      </div>
    )
  )
}

export { DrawerImagesets }
