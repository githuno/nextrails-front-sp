import { Modal } from "@/components/atoms"
import { ImagesetState, useImageset } from "@/components/camera"
import { EditIcon, LoadingSpinner, useCamera } from "@/components/camera/_utils"
import { NotionModal, useNotion } from "@/components/services/notion"
import { useStorage } from "@/components/storage"
import { useState } from "react"
import { CurrentImages } from "./CurrentImages"
import { DrawerImagesets } from "./DrawerImagesets"

const Showcase = () => {
  const { cameraState } = useCamera()
  const { idb } = useStorage()
  const { imageset, setImageset } = useImageset()
  const [isNameModalOpen, setIsNameModalOpen] = useState<boolean>(false)
  const [isNotionModalOpen, setIsNotionModalOpen] = useState<boolean>(false)
  const { notionState, connectNotion, selectPage, uploadImagesToNotion } = useNotion()

  const handleNotionUpload = async () => {
    try {
      if (!notionState.isConnected || !notionState.selectedPageId) {
        setIsNotionModalOpen(true)
        return
      }

      const files = imageset.files.filter((file) => !file.deletedAt)
      await uploadImagesToNotion(files)

      // アップロード後にステータスを更新
      setImageset((prev) => ({
        ...prev,
        status: ImagesetState.SENT,
      }))
    } catch (error) {
      console.error("Failed to upload to Notion:", error)
    }
  }

  // const handleGoogleDriveUpload = async () => {
  //   try {
  //     // 認証状態を確認
  //     const isConnected = await checkConnection(true);
  //     if (!isConnected) {
  //       setIsGoogleDriveModalOpen(true);
  //       return;
  //     }

  //     // 認証済みの場合はアップロード処理を実行
  //     const files = imageset.files.filter((file) => !file.deletedAt);
  //     console.log("Uploading files:", files);

  //     const fileObjects = await Promise.all(
  //       files.map((file) => {
  //         const blobUrl = file.idbUrl;
  //         if (!blobUrl) {
  //           throw new Error(`Blob URL not found for idbId: ${file.idbId}`);
  //         }
  //         return fetch(blobUrl)
  //           .then((response) => response.blob())
  //           .then((blob) => new File([blob], file.idbId, { type: blob.type }));
  //       })
  //     );

  //     const result = await uploadToGoogleDrive({
  //       name: imageset.name,
  //       files: fileObjects,
  //     });

  //     if (result.success) {
  //       setImageset((prev) => ({
  //         ...prev,
  //         status: ImagesetState.SENT,
  //       }));
  //     } else {
  //       throw new Error(result.error || "Upload failed");
  //     }
  //   } catch (error) {
  //     console.error("Failed to upload to Google Drive:", error);
  //   }
  // };

  return (
    <div className="w-vw grid h-[23vh] grid-rows-5 place-content-center rounded-lg bg-white/80 px-2 py-1 shadow-lg">
      <Modal id="setName" isOpen={isNameModalOpen} onClose={() => setIsNameModalOpen(false)} className="bg-transparent">
        <div className="rounded-lg bg-white/80 p-4 shadow-lg">
          {/* TODO: 変更・追加（作成）・移動をわかりやすくする セット間の転送も必要 */}
          <h2 className="mb-4 text-xl">setNameを編集</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const formData = new FormData(e.currentTarget)
              const newName = formData.get("storeName") as string
              if (newName !== imageset.name) {
                setImageset({
                  id: BigInt(Date.now()),
                  name: newName,
                  status: ImagesetState.DRAFT,
                  files: [],
                })
              }
              setIsNameModalOpen(false)
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              name="storeName"
              defaultValue={imageset.name}
              className="rounded border border-gray-300 bg-white/80 p-2"
            />
            <button type="submit" className="rounded bg-blue-500 p-2 text-white">
              保存
            </button>
          </form>
        </div>
      </Modal>

      <NotionModal
        isOpen={isNotionModalOpen}
        onClose={() => setIsNotionModalOpen(false)}
        onConnect={connectNotion}
        isConnected={notionState.isConnected}
        onPageSelect={selectPage}
        pages={notionState.pages}
      />

      {/* <GoogleDriveModal
        isOpen={isGoogleDriveModalOpen}
        onClose={() => setIsGoogleDriveModalOpen(false)}
      /> */}

      <section className="row-start-1 grid w-full place-content-center">
        {idb.state.isStoreLoading.includes(imageset.name) ? (
          <div className="grid justify-center">
            <LoadingSpinner size="24px" />
          </div>
        ) : (
          <>
            <div className="row-start-1 flex items-center justify-center">
              <h1 className="text-center font-bold break-words">セット: {imageset.name}</h1>
              {(cameraState.isScanning || !cameraState.isAvailable) && ( // 編集可能なのはSCANNING時のみ
                <button
                  onClick={() => setIsNameModalOpen(true)}
                  className="ml-2 rounded-full bg-transparent p-1 transition-colors hover:bg-gray-200"
                >
                  <EditIcon />
                </button>
              )}
            </div>
          </>
        )}
      </section>

      <section className="relative row-span-4 grid w-full place-content-center gap-2">
        <>
          <CurrentImages />
          <DrawerImagesets />
          {imageset.files.length > 0 && (
            <div className="absolute top-2 right-2 flex gap-2">
              <button onClick={handleNotionUpload} className="rounded-md bg-black px-3 py-1 text-sm text-white">
                Notionへ送信
              </button>
              {/* <button
                onClick={handleGoogleDriveUpload}
                disabled={
                  googleDriveState.isUploading || googleDriveState.isChecking
                }
                className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm disabled:bg-gray-400"
              >
                {googleDriveState.isUploading
                  ? "アップロード中..."
                  : googleDriveState.isChecking
                  ? "認証状態確認中..."
                  : "Google Driveへ送信"}
              </button> */}
            </div>
          )}
        </>
      </section>

      {/* 開発環境でDBの初期化ボタンを配置 */}
      {process.env.NODE_ENV === "development" && (
        <section className="fixed right-4 bottom-4 m-1 flex gap-1 p-1 text-xs">
          <button className="bg-gray-200" onClick={() => idb.debugDb().then(() => console.log("debugDB done"))}>
            debugDB
          </button>
          <button
            className="bg-gray-200"
            onClick={() => {
              setImageset({
                id: BigInt(Date.now()),
                name: "1",
                status: ImagesetState.DRAFT,
                files: [],
              })
              idb.destroyDb()
            }}
          >
            destroyDB
          </button>
        </section>
      )}
    </div>
  )
}

export { Showcase }
