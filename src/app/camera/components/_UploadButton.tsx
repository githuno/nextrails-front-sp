import React, { useCallback, useState } from "react";
import { openDB } from "idb";
import LoadingSpinner from "./loading";

interface UploadButtonProps extends React.HTMLAttributes<HTMLDivElement> {
  file: Blob;
  type: "image" | "video";
  id: string; // メディアのIDを受け取る
  onUploadSuccess: () => void;
}

const UploadButton: React.FC<UploadButtonProps> = ({
  file,
  type,
  id,
  onUploadSuccess,
  className, // 追加: クラス名を受け取る
  ...rest // 追加: その他のpropsを受け取る
}) => {
  const [isUploading, setIsUploading] = useState(false); // アップロード中の状態を管理するステート

  const postObject = useCallback(async () => {
    setIsUploading(true); // アップロード開始時にステートを更新
    try {
      if (type === "video") {
        // 1. pre_createエンドポイントを呼び出して署名付きURLを取得
        const preCreateResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE}/get_presignedUrl`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              user_id: "sample_u_id",
              object_id: "sample_o_id",
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
          body: file,
          headers: {
            'Content-Type': 'video/mp4',
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
              user_id: "sample_u_id",
              object_id: "sample_o_id",
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
        formData.append("user_id", "sample_u_id"); // 適切なユーザーIDを設定
        formData.append("object_id", "sample_o_id"); // 適切なオブジェクトIDを設定
        formData.append(`${type}_data`, file);

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE}/post_${type}`,
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

        // アップロード成功時にIndexedDBのisUploadedフィールドを更新
        const db = await openDB("media", 3);
        const tx = db.transaction(
          type === "image" ? "photos" : "videos",
          "readwrite"
        );
        const store = tx.objectStore(type === "image" ? "photos" : "videos");
        const media = await store.get(id);
        media.isUploaded = true;
        await store.put(media);
      }

      onUploadSuccess();
    } catch (error) {
      console.error("Upload failed", error);
    } finally {
      setIsUploading(false); // アップロード終了時にステートを更新
    }
  }, [file, type, id, onUploadSuccess]);

  return (
    <div className={`relative ${className}`} {...rest}>
      {isUploading ? (
        <LoadingSpinner /> // アップロード中はローディングスピナーを表示
      ) : (
        <button
          onClick={postObject}
          className="bg-gray-500 text-white rounded-full opacity-80"
        >
          Upload
        </button>
      )}
    </div>
  );
};

export { UploadButton };