import React, { useState } from "react";
import { Modal } from "@/components";
import { useImageset, File, ImagesetState } from "@/components/camera";
import {
  useCamera,
  useIdb,
  LoadingSpinner,
  EditIcon,
} from "@/components/camera/_utils";
import { CurrentImages } from "./CurrentImages";
import { DrawerImagesets } from "./DrawerImagesets";

const Showcase = () => {
  const { cameraState } = useCamera();
  const { imageset, setImageset, dbName } = useImageset();
  const { idb, idbState } = useIdb<File>(dbName);
  const [isNameModalOpen, setIsNameModalOpen] = useState<boolean>(false);

  return (
    <div className="grid grid-rows-5 px-2 pt-2 h-[23vh] w-vw place-content-center rounded-lg shadow-lg bg-white/80">
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
                setImageset({
                  id: Date.now(),
                  name: newName,
                  status: ImagesetState.DRAFT,
                  files: [],
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

      <section className="row-start-1 grid grid-cols-3 w-full place-content-center">
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
              {cameraState.isScanning && ( // 編集可能なのはSCANNING時のみ
                <button
                  onClick={() => setIsNameModalOpen(true)}
                  className="ml-2 p-1 bg-transparent hover:bg-gray-200 rounded-full transition-colors"
                >
                  <EditIcon />
                </button>
              )}
            </div>
            {/* TODO: 削除済みを除外する */}
            <p className="text-center break-words">
              count: {imageset.files.length}
            </p>
          </>
        )}
      </section>

      <section className="row-span-4 relative grid w-full place-content-center gap-2">
        <CurrentImages />
        <DrawerImagesets />
      </section>

      {/* 開発環境でDBの初期化ボタンを配置 */}
      {process.env.NODE_ENV === "development" && (
        <section className="flex fixed bottom-4 right-4 text-xs p-1 m-1 gap-1">
          <button
            className="bg-gray-200"
            onClick={() =>
              idb.debugDb().then(() => console.log("debugDB done"))
            }
          >
            debugDB
          </button>
          <button
            className="bg-gray-200"
            onClick={() => {
              setImageset({
                id: Date.now(),
                name: "1",
                status: ImagesetState.DRAFT,
                files: [],
              });
              idb.destroyDb();
            }}
          >
            destroyDB
          </button>
        </section>
      )}
    </div>
  );
};

export { Showcase };
