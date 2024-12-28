"use client";
import React, { useCallback, useEffect, useState } from "react";
import { useIDBMedia, Media, LoadingSpinner } from "../_utils";
import { useCameraContext } from "../CameraContext";
import { Modal } from "@/components";

const LocalGallery = () => {
  const { imageSetName, setImageSetName, cameraState, setCameraState, dbName } =
    useCameraContext();
  const [isNameModalOpen, setIsNameModalOpen] = useState<boolean>(false);
  const [mediaList, setMediaList] = useState<Media[]>([]);
  const [fetchIDB, isLoading] = useIDBMedia({ dbName });
  const [processingStates, setProcessingStates] = useState<{
    [key: string]: boolean;
  }>({});

  const updateMedia = useCallback(async () => {
    try {
      const db = await fetchIDB({ method: "GET", storeName: imageSetName });
      if (Array.isArray(db)) {
        setMediaList(db);
      }
    } catch (error) {
      console.error("Error updating media:", error);
    }
  }, [fetchIDB, imageSetName]);

  // const uploadMedia = useCallback(async (media: Media, session: Session) => {
  //   setProcessingStates((prev) => ({ ...prev, [media.id]: true }));
  //   try {
  //     if (media.type === "video") {
  //       // 1. pre_createエンドポイントを呼び出して署名付きURLを取得
  //       const preCreateResponse = await fetch(
  //         `${process.env.NEXT_PUBLIC_API_BASE}/get_presignedUrl`,
  //         {
  //           method: "POST",
  //           headers: {
  //             "Content-Type": "application/json",
  //           },
  //           body: JSON.stringify({
  //             user_id: session.user_id,
  //             object_id: session.object_id,
  //           }),
  //         }
  //       );

  //       if (!preCreateResponse.ok) {
  //         throw new Error("Failed to get presigned URL");
  //       }

  //       const preCreateData = await preCreateResponse.json();
  //       const presignedUrl = preCreateData.result[0].path;

  //       // 2. 取得したURLに対して動画ファイルをアップロード
  //       const uploadResponse = await fetch(presignedUrl, {
  //         method: "PUT",
  //         body: media.blob,
  //         headers: {
  //           "Content-Type": "video/mp4",
  //         },
  //       });

  //       if (!uploadResponse.ok) {
  //         throw new Error("Failed to upload video");
  //       }

  //       // 3. createエンドポイントを呼び出して動画のパスを送信
  //       const createResponse = await fetch(
  //         `${process.env.NEXT_PUBLIC_API_BASE}/video_up`,
  //         {
  //           method: "POST",
  //           headers: {
  //             "Content-Type": "application/json",
  //           },
  //           body: JSON.stringify({
  //             user_id: session.user_id,
  //             object_id: session.object_id,
  //             image_path: presignedUrl.split("?")[0], // クエリパラメータを除いたパスを送信
  //           }),
  //         }
  //       );

  //       if (!createResponse.ok) {
  //         throw new Error("Failed to register video");
  //       }
  //     } else {
  //       // 画像のアップロード処理
  //       const formData = new FormData();
  //       formData.append("user_id", session.user_id);
  //       formData.append("object_id", session.object_id);
  //       formData.append("image_data", media.blob);

  //       const response = await fetch(
  //         `${process.env.NEXT_PUBLIC_API_BASE}/post_image`,
  //         {
  //           method: "POST",
  //           body: formData,
  //           mode: "cors", // CORSモードを明示的に指定
  //           headers: {
  //             "Access-Control-Allow-Origin": "*",
  //           },
  //         }
  //       );

  //       if (!response.ok) {
  //         throw new Error("Failed to upload image");
  //       }
  //     }

  //     // アップロード成功時にIndexedDBのisUploadedフィールドを更新
  //     media.isUploaded = true;
  //   } catch (error) {
  //     console.error("Upload failed", error);
  //   } finally {
  //     setProcessingStates((prev) => ({ ...prev, [media.id]: false }));
  //   }
  // }, []);

  useEffect(() => {
    if (cameraState === "initializing") {
      updateMedia();
      setCameraState("scanning");
    }
  }, [updateMedia, cameraState]);

  useEffect(() => {
    updateMedia();
  }, [imageSetName, updateMedia]);

  return (
    <>
      {isLoading && <LoadingSpinner />}
      <div className="grid grid-cols-3 gap-4 items-center">
        <h1 className="font-bold text-center break-words">
          setName: {imageSetName}
        </h1>
        <button
          onClick={() => setIsNameModalOpen(true)}
          className="m-2 p-2 bg-blue-500 text-white rounded"
        >
          編集
        </button>
        <Modal
          isOpen={isNameModalOpen}
          onClose={() => setIsNameModalOpen(false)}
        >
          <div className="p-4">
            <h2 className="text-xl font-bold mb-4">名前を編集</h2>
            <input
              type="text"
              value={imageSetName}
              onChange={(e) => setImageSetName(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded"
            />
            <div className="mt-4 flex justify-end"></div>
          </div>
        </Modal>
        <p className="text-center break-words">count: {mediaList.length}</p>

        {mediaList.map((media) => (
          <div key={media.id} className="relative">
            {media.type === "image" ? (
              <img
                src={media.url ?? ""}
                alt={`Image ${media.id}`}
                className="w-full h-auto"
              />
            ) : (
              <video controls src={media.url ?? ""} className="w-full h-auto" />
            )}
            {processingStates[media.id] ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-50">
                <LoadingSpinner />
              </div>
            ) : (
              <div>
                <button
                  onClick={async () => {
                    setProcessingStates((prev) => ({
                      ...prev,
                      [media.id]: true,
                    }));
                    await fetchIDB({
                      method: "DELETE",
                      data: media,
                      storeName: imageSetName,
                    });
                    setProcessingStates((prev) => ({
                      ...prev,
                      [media.id]: false,
                    }));
                    setCameraState("initializing");
                  }}
                  className="absolute top-0 right-0 bg-red-500 text-white p-1 z-10"
                >
                  削除
                </button>
                {/* {!media.isUploaded && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <button
                      onClick={() =>
                        uploadMedia(media, {
                          user_id: "sample_u_id",
                          object_id: "sample_o_id",
                        })
                      }
                      className="bg-gray-500 text-white rounded-full opacity-80 pointer-events-auto"
                    >
                      Upload
                    </button>
                  </div>
                )} */}
              </div>
            )}
          </div>
        ))}
        {/* DBの初期化ボタンを配置 */}
        <div className="flex fixed bottom-4 right-4 text-xs p-1 m-1 gap-1">
          <button
            className="bg-gray-200"
            onClick={() =>
              fetchIDB({ method: "AllDEBUG", storeName: imageSetName })
            }
          >
            debugDB
          </button>
          <button
            className="bg-gray-200"
            onClick={() => {
              fetchIDB({ method: "AllDELETE", storeName: imageSetName });
              updateMedia();
            }}
          >
            destroyDB
          </button>
        </div>
      </div>
    </>
  );
};

export { LocalGallery };
