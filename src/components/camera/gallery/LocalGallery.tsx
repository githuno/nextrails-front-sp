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

  const EditIcon = () => (
    <svg
      version="1.1"
      id="_x32_"
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      x="0px"
      y="0px"
      viewBox="0 0 512 512"
      style={{ width: "16px", height: "16px", opacity: 1 }}
      xmlSpace="preserve"
    >
      <style type="text/css">
        {`.st0{fill:#4B4B4B;}`}
      </style>
      <g>
        <path
          className="st0"
          d="M165.628,461.127c0,0,0.827-0.828,1.838-1.839l194.742-194.742c1.012-1.011,1.92-1.92,2.019-2.019
          c0.099-0.099,1.008-1.008,2.019-2.019l103.182-103.182c0.018-0.018,0.018-0.048,0-0.067L354.259,42.092
          c-0.018-0.018-0.048-0.018-0.067,0L251.01,145.274c-1.011,1.011-1.92,1.92-2.019,2.019c-0.099,0.099-1.008,1.008-2.019,2.019
          L50.401,345.884c-0.006,0.006-0.01,0.012-0.012,0.02L0.002,511.459c-0.011,0.036,0.023,0.07,0.059,0.059l163.079-49.633
          C164.508,461.468,165.628,461.127,165.628,461.127z M36.734,474.727l25.159-82.666c0.01-0.034,0.053-0.045,0.078-0.02
          l57.507,57.507c0.025,0.025,0.014,0.068-0.02,0.078l-82.666,25.16C36.756,474.797,36.722,474.764,36.734,474.727z"
          style={{ fill: "rgb(75, 75, 75)" }}
        />
        <path
          className="st0"
          d="M502.398,104.432c12.803-12.804,12.803-33.754,0-46.558l-47.791-47.792c-12.804-12.803-33.754-12.803-46.558,0
          l-23.862,23.862c-0.018,0.018-0.018,0.048,0,0.067l94.282,94.282c0.018,0.018,0.048,0.018,0.067,0L502.398,104.432z"
          style={{ fill: "rgb(75, 75, 75)" }}
        />
      </g>
    </svg>
  );

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
      <div className="grid grid-cols-3 gap-4 p-2 items-center rounded-lg shadow-lg bg-white/80">
        {isLoading ? (
          <div className="col-span-3 grid justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <>
          <div className="col-span-2 flex items-center justify-center">
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
          <p className="text-center break-words">
            count: {mediaList.length}
          </p>
        </>
        )}

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

        {mediaList.map((media) => (
          <div key={media.id} className="relative">
            {media.type === "image" ? (
              <img
                src={media.url ?? ""}
                alt={`Image ${media.id}`}
                className="w-full h-full"
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
