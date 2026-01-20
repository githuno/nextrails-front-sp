import { Carousel, Modal } from "@/components/atoms"
import { useImageset, type File } from "@/components/camera"
import { LoadingSpinner, SyncIcon, useCamera } from "@/components/camera/_utils"
import { useStorage } from "@/components/storage"
import { useCallback, useEffect, useRef, useState } from "react"
import { useSyncImageset } from "./hooks/useSyncImageset"

const CurrentImages = () => {
  const { cameraState } = useCamera()
  const { imageset, setImageset } = useImageset()
  const { idb, cloud } = useStorage()

  const [isLoading, setIsLoading] = useState<string[]>([])
  const [isImageModalOpen, setIsImageModalOpen] = useState<boolean>(false)
  const [carouselIndex, setCarouselIndex] = useState<number | null>(null)

  const isInitializingRef = useRef(false)

  const { syncPullFiles, syncPushFile, checkUpdatedAt, isSyncing } = useSyncImageset()

  // const pullImages = useCallback(
  //   async ({ setName, params }: { setName: string; params: string }) => {
  //     if (!cloud.state.isConnected) return;
  //     try {
  //       const cloudFiles = await cloudGetFiles(setName, {
  //         params: params,
  //       });
  //       if (cloudFiles.length === 0 || !Array.isArray(cloudFiles)) return;
  //       // cloudFilesがある場合はIDBに同期してimagesetにセット
  //       const syncedFiles = await idb.sync(setName, cloudFiles, {
  //         dateKey: "updatedAt",
  //         order: "desc",
  //       });
  //       setImageset((prev) =>
  //         prev.name === setName
  //           ? {
  //               ...prev,
  //               files: syncedFiles,
  //             }
  //           : prev
  //       );
  //     } catch (error) {
  //       console.error(`Error updating media with ${setName}:`, error);
  //     }
  //   },
  //   [idb, cloudGetFiles, setImageset, cloud.state.isConnected]
  // );

  // const pushImage = useCallback(
  //   async (set: Imageset) => {
  //     const file = set.files
  //       .filter(
  //         (file) =>
  //           file.size !== 0 && // ファイルのサイズプロパティが0（＝まだIDBに保存されていない仮ファイル）
  //           file.shouldPush && // shouldPushプロパティがtrue
  //           !isLoading.includes(file.idbId) // isLoadingに含まれていないファイル
  //       )
  //       .pop(); // 上記条件内で更新日が最古のファイル
  //     if (!file) return; // ファイルがない場合は処理しない

  //     setIsLoading((prev) => [...prev, file.idbId]);

  //     let newFile: File = { ...file, shouldPush: false };
  //     try {
  //       if (file.deletedAt) {
  //         // DELETE
  //         await cloudDeleteFile({ file, imagesetName: set.name });
  //         await idb.delete(set.name, file.idbId); // IDBの物理削除
  //       } else if (file.id && file.version) {
  //         // PUT
  //         await cloudPutFile({ file, imagesetName: set.name });
  //         await idb.put(set.name, newFile);
  //       } else if (!file.id) {
  //         // POST
  //         newFile = await cloudPostFile({ file, imagesetName: set.name });
  //         await idb.put(set.name, newFile);
  //       }
  //       // imagesetの該当fileを更新
  //       setImageset((prev) =>
  //         prev.name === set.name
  //           ? {
  //               ...prev,
  //               files: file.deletedAt
  //                 ? prev.files.filter((f) => f.idbId !== newFile.idbId)
  //                 : prev.files.map((f) =>
  //                     f.idbId === newFile.idbId ? newFile : f
  //                   ),
  //             }
  //           : prev
  //       );
  //     } catch (error) {
  //       console.error(`Error updating file with id ${file.idbId}:`, error);
  //     } finally {
  //       setIsLoading((prev) => prev.filter((id) => id !== file.idbId));
  //     }
  //   },
  //   [idb, cloudPutFile, cloudPostFile, cloudDeleteFile, isLoading]
  // );

  const getImages = useCallback(async () => {
    const currentName = imageset.name
    setIsLoading((prev) => [...prev, currentName])
    try {
      let params = "deletedAt_null=true&updatedAt_sort=desc" // 削除されていないファイルを全部取得
      // IDBから降順でファイルを取得
      const idbFiles = await idb.get(imageset.name, {
        date: { key: "updatedAt", order: "desc" },
      })

      // IDBファイルが存在する場合
      if (Array.isArray(idbFiles) && idbFiles.length > 0) {
        setImageset((prev) =>
          // セット名が変更されている場合は更新しない
          prev.name === currentName ? { ...prev, files: idbFiles } : prev,
        )
        // IDBのfilesから適切な日時を取得してparamsを再定義
        params = `updatedAt_over=${checkUpdatedAt(idbFiles)}&updatedAt_sort=desc`
      }

      // クラウドからファイルを取得してIDBに同期
      if (cloud.state.isConnected) {
        await syncPullFiles({ setName: imageset.name, options: { params } })
      }
    } catch (error) {
      console.error("Error updating media:", error)
    } finally {
      setIsLoading((prev) => prev.filter((name) => name !== currentName))
    }
  }, [imageset.name, idb, cloud.state.isConnected, setImageset, checkUpdatedAt, syncPullFiles])

  const localCleanup = useCallback(
    async (imagesetName: string) => {
      const targetFiles = imageset.files.filter(
        (file) => file.deletedAt && file.updatedAt < file.fetchedAt, // 削除済みかつ取得以降に更新されていないファイル
      )
      try {
        for (const file of targetFiles) {
          await idb.delete(imagesetName, file.idbId) // IDBの削除済みファイルを削除
          setImageset((prev) =>
            prev.name === imagesetName
              ? {
                  ...prev,
                  files: prev.files.filter((file) => !file.deletedAt),
                }
              : prev,
          )
        }
      } catch (error) {
        console.error("Error cleaning up media:", error)
      }
    },
    [idb, imageset.files, setImageset],
  )

  const handleLocalDelete = useCallback(
    async ({ setName, file }: { setName: string; file: File }) => {
      if (isLoading.includes(file.idbId)) return
      // 1. fileのversionとdeletedAtを更新して定義
      const deleteFile = {
        ...file,
        shouldPush: true,
        deletedAt: Date.now(),
        updatedAt: Date.now(),
        version: file.version + 1,
        blob: null,
      }
      // 2. IDBの論理削除
      await idb.put(imageset.name, deleteFile)

      // 3. imagesetの該当ファイルを論理削除
      setImageset((prev) =>
        prev.name === setName
          ? {
              ...prev,
              files: prev.files.map((f) => (f.idbId === deleteFile.idbId ? deleteFile : f)),
            }
          : prev,
      )
    },
    [isLoading, idb, imageset.name, setImageset],
  )

  const handleLocalUpdate = useCallback(
    async ({ setName, file }: { setName: string; file: File }) => {
      if (isLoading.includes(file.idbId)) return
      const targetFile = {
        ...file,
        shouldPush: true,
        updatedAt: Date.now(),
        version: file.version + 1,
      }
      // 1. IDBの更新
      await idb.put(setName, targetFile)
      // 2. imagesetの更新
      setImageset((prev) =>
        prev.name === setName
          ? {
              ...prev,
              files: prev.files.map((f) => (f.idbId === targetFile.idbId ? targetFile : f)),
            }
          : prev,
      )
    },
    [isLoading, idb, setImageset],
  )

  // debug ---------------------------------------------------------------------
  useEffect(() => {
    console.log("cameraState:", cameraState)
  }, [cameraState])
  useEffect(() => {
    console.log("imageset.files:", imageset.files)
  }, [imageset.files])
  useEffect(() => {
    console.log("cloud", cloud.state)
  }, [cloud.state])
  useEffect(() => {
    console.log("idbState:", idb.state)
  }, [idb.state])
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (isInitializingRef.current) return
    isInitializingRef.current = true

    const initialize = async () => {
      if (!isLoading.includes(imageset.name)) {
        await getImages()
        localCleanup(imageset.name)
      }
      isInitializingRef.current = false
    }
    initialize()
  }, [imageset.name, getImages, localCleanup, isLoading])

  useEffect(() => {
    const autoPush = async () => {
      if (
        !cloud.state.isConnected || // オフラインの場合
        (cameraState.isAvailable && !cameraState.isScanning) || // カメラが使えるのにSCANNING状態でない場合
        imageset.files.length === 0 || // filesがない場合
        isLoading.includes(imageset.name) // 同期中の場合
      )
        return // 上記条件下では処理しない

      await syncPushFile({ set: imageset })
    }
    autoPush()
  }, [
    imageset.files,
    cameraState.isScanning,
    cameraState.isAvailable,
    imageset,
    isLoading,
    syncPushFile,
    cloud.state.isConnected,
  ])

  const handleCarouselItemClick = (fileIndex: number) => {
    const controller = new AbortController() // https://qiita.com/tronicboy/items/31c1f60daf26edc9cefb
    setIsImageModalOpen(true)
    setTimeout(() => {
      if (!controller.signal.aborted) {
        setCarouselIndex(fileIndex)
      }
    }, 100)
    return () => {
      controller.abort()
    }
  }

  return (
    <>
      {/* {(isLoading.includes(imageset.name) || cameraState.isAvailable === null) && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50">
          <div className="flex w-12 items-center justify-center">
            <LoadingSpinner size="48px" />
          </div>
        </div>
      )} */}
      <Carousel className="h-16" containerClassName="h-full" gap="0">
        {imageset.files
          .filter((file) => !file.deletedAt)
          .map((file) => (
            <Carousel.Item key={"small-" + file.idbId} className="group h-full shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleCarouselItemClick(imageset.files.indexOf(file))
                }}
                className="h-full overflow-hidden rounded-xs shadow-2xl"
              >
                {file.contentType === "video/webm" ? (
                  <video
                    controls
                    src={file.idbUrl ?? ""}
                    width={96}
                    height={54}
                    className="h-full w-auto rounded-xs border border-zinc-700/30 object-contain transition-all group-hover:scale-105 group-hover:brightness-110"
                  />
                ) : (
                  <img
                    src={file.idbUrl ?? ""}
                    alt={`Image ${file.idbId}`}
                    width={96}
                    height={54}
                    className="h-full w-auto rounded-xs border border-zinc-700/30 object-contain transition-all group-hover:scale-105 group-hover:brightness-110"
                  />
                )}
              </button>
              {
                // 削除操作が不可な状態
                idb.state.isUpdating.includes(file.idbId) ||
                idb.state.isDeleting.includes(file.idbId) ||
                cloud.state.isDeleting.includes(file.idbId) ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <LoadingSpinner />
                  </div>
                ) : (
                  // 削除操作が可能な状態
                  <div>
                    {/* TODO: モーダルのオープンとクローズが重複して作動してしまっている */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation() // 親要素のクリックイベントを防ぐ
                        handleLocalDelete({ file, setName: imageset.name })
                      }}
                      className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-white/50 text-[10px] text-zinc-700/80 shadow-md backdrop-blur-md transition-opacity group-hover:opacity-100 hover:bg-red-600 sm:opacity-0"
                    >
                      ✕
                    </button>
                    {isSyncing.includes(file.idbId) && (
                      <div className="absolute top-0 left-0">
                        <SyncIcon size="24" />
                      </div>
                    )}
                  </div>
                )
              }
            </Carousel.Item>
          ))}
      </Carousel>

      <Modal
        isOpen={isImageModalOpen}
        onClose={() => {
          setCarouselIndex(null)
          setIsImageModalOpen(false)
        }}
        className="bg-white/0"
      >
        <Carousel className="bg-black/70" containerClassName="md:gap-x-1" index={carouselIndex}>
          {imageset.files.map((file) => (
            <Carousel.Item key={"large-" + file.idbId} className="w-full">
              <div className="h-[90vh] w-screen px-1 py-2 md:w-[93vw] md:pr-0">
                {file.contentType === "video/webm" ? (
                  <video controls src={file.idbUrl ?? ""} className="h-full w-full object-contain" />
                ) : (
                  <img src={file.idbUrl ?? ""} alt={`Image ${file.idbId}`} className="h-full w-full object-contain" />
                )}
              </div>
            </Carousel.Item>
          ))}
        </Carousel>
      </Modal>
    </>
  )
}

export { CurrentImages }
