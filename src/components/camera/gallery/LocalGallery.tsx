"use client";
import React, { useCallback, useEffect, useState } from "react";
import { useIDBMedia, Media, CameraState, LoadingSpinner } from "../_utils";
import { Session } from "@/components";

interface LocalGalleryProps {
  state: CameraState;
  setState: React.Dispatch<React.SetStateAction<CameraState>>;
}

const LocalGallery = ({ state, setState }: LocalGalleryProps) => {
  // 仮
  const session: Session = {
    user_id: "sample_u_id",
    object_id: "sample_o_id",
  };

  const [mediaList, setMediaList] = useState<Media[]>([]);
  const [fetchIDB, isLoading] = useIDBMedia("Media");
  const [processingStates, setProcessingStates] = useState<{
    [key: string]: boolean;
  }>({});

  const updateMedia = useCallback(async () => {
    try {
      const db = await fetchIDB("GET");
      if (Array.isArray(db)) {
        setMediaList(db);
      }
    } catch (error) {
      console.error("Error updating media:", error);
    }
  }, []);

  const uploadMedia = useCallback(async (media: Media, session: Session) => {
    setProcessingStates((prev) => ({ ...prev, [media.id]: true }));
    try {
      if (media.type === "video") {
        // 1. pre_createエンドポイントを呼び出して署名付きURLを取得
        const preCreateResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE}/get_presignedUrl`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              user_id: session.user_id,
              object_id: session.object_id,
            }),
          }
        );

        if (!preCreateResponse.ok) {
          throw new Error("Failed to get presigned URL");
        }

        const preCreateData = await preCreateResponse.json();
        const presignedUrl = preCreateData.result[0].path;

        // 2. 取得したURLに対して動画ファイルをアップロード
        const uploadResponse = await fetch(presignedUrl, {
          method: "PUT",
          body: media.blob,
          headers: {
            "Content-Type": "video/mp4",
          },
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload video");
        }

        // 3. createエンドポイントを呼び出して動画のパスを送信
        const createResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE}/video_up`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              user_id: session.user_id,
              object_id: session.object_id,
              image_path: presignedUrl.split("?")[0], // クエリパラメータを除いたパスを送信
            }),
          }
        );

        if (!createResponse.ok) {
          throw new Error("Failed to register video");
        }
      } else {
        // 画像のアップロード処理
        const formData = new FormData();
        formData.append("user_id", session.user_id);
        formData.append("object_id", session.object_id);
        formData.append("image_data", media.blob);

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE}/post_image`,
          {
            method: "POST",
            body: formData,
            mode: "cors", // CORSモードを明示的に指定
            headers: {
              "Access-Control-Allow-Origin": "*",
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to upload image");
        }
      }

      // アップロード成功時にIndexedDBのisUploadedフィールドを更新
      media.isUploaded = true;
    } catch (error) {
      console.error("Upload failed", error);
    } finally {
      setProcessingStates((prev) => ({ ...prev, [media.id]: false }));
    }
  }, []);

  useEffect(() => {
    if (state === "initializing") {
      updateMedia();
      setState("scanning");
    }
  }, [updateMedia, state]);

  return (
    <>
      {isLoading && <LoadingSpinner />}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-3 flex justify-center items-center">
          <p>Media count: {mediaList.length}</p>
        </div>
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
                    await fetchIDB("DELETE", media);
                    setProcessingStates((prev) => ({
                      ...prev,
                      [media.id]: false,
                    }));
                    setState("initializing");
                  }}
                  className="absolute top-0 right-0 bg-red-500 text-white p-1 z-10"
                >
                  削除
                </button>
                {!media.isUploaded && (
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
                )}
              </div>
            )}
          </div>
        ))}
        {/* DBの初期化ボタンを配置 */}
        <div className="flex fixed bottom-0 right-0 text-xs p-1 m-1 gap-1">
          <button className="bg-gray-200" onClick={() => fetchIDB("DEBUG")}>
            debugDB
          </button>
          <button className="bg-gray-200" onClick={() => fetchIDB("INIT")}>
            initDB
          </button>
        </div>
      </div>
    </>
  );
};

export { LocalGallery };
