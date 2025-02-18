import React from "react";
import { useStorage } from "@/components/storage";
import { useImageset, File, ImagesetState } from "@/components/camera";
import {
  LoadingSpinner,
  CameraIcon,
  useCamera,
} from "@/components/camera/_utils";

const base64ToBlob = (
  base64: string,
  contentType: string = "image/png"
): Blob => {
  const byteCharacters = atob(base64.split(",")[1]);
  const byteNumbers = new Array(byteCharacters.length)
    .fill(0)
    .map((_, i) => byteCharacters.charCodeAt(i));
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: contentType });
};
// const base64ToBlob = async (base64: string): Promise<Blob> => {
//   const response = await fetch(base64);
//   return await response.blob();
// };

interface CaptureImageButtonProps {
  onSaved: () => void;
}

const CaptureImageButton: React.FC<CaptureImageButtonProps> = ({ onSaved }) => {
  const { idb } = useStorage();
  const { camera, cameraState } = useCamera();
  const { imageset, setImageset } = useImageset();

  const handleCaptureImage = async (url: string | null) => {
    if (!url) {
      console.error("Capture failed: URL is null");
      return;
    }
    // 画像セット名を取得
    const currentImagesetName = imageset.name;

    // 一時的に dataUrl を idbUrl として設定
    const tempImage: File = {
      id: null, // DB用のID => あればDBに登録済み ※idbではこれは使わずidbIdを使用する
      key: null, // S3 key　=> あればアップロード済み
      idbId: new Date().toISOString().replace(/[-:.TZ]/g, ""), // IDB用のIDを現在時刻から生成
      idbUrl: url,
      blob: null,
      updatedAt: Date.now(),
      deletedAt: null, // 論理削除日時
      createdAt: Date.now(), // 作成日時
      fetchedAt: 0, // 取得日時
      shouldPush: true, // クラウドにプッシュすべきどうか（クラウドで管理していないプロパティ）
      size: 0,
      contentType: "image/png",
      filename: "", // PUTで編集させる
      version: 1, // PUTで編集された回数
      metadata: {
        status: ImagesetState.DRAFT,
      },
    };

    // 一時的に保存した画像を imageset に追加
    setImageset((prev) => {
      if (prev.name === currentImagesetName) {
        return {
          ...prev,
          files: [tempImage, ...prev.files],
        };
      }
      return prev;
    });

    const blob = base64ToBlob(url);

    // IDBに保存
    const savedImage: File = await idb.post(imageset.name, {
      ...tempImage,
      idbUrl: null, // 一時的な dataUrl は削除
      blob: blob,
      size: blob.size,
    });
    // 戻り値でimagesetを更新
    setImageset((prev) => {
      if (prev.name === currentImagesetName) {
        return {
          ...prev,
          files: prev.files.map((file) =>
            file.idbId === tempImage.idbId ? savedImage : file
          ),
        };
      }
      return prev;
    });
    onSaved();
  };

  return (
    camera && (
      <div className="flex items-center justify-center w-16 h-16 rounded-full shadow-md">
        <button
          onClick={async () => await camera.capture(handleCaptureImage)}
          disabled={cameraState.isCapturing}
          className="w-full h-full flex items-center justify-center rounded-full bg-gradient-to-r from-blue-200 to-white shadow-inner hover:shadow-lg transition-transform"
        >
          {cameraState.isCapturing ? <LoadingSpinner /> : <CameraIcon />}
        </button>
      </div>
    )
  );
};

export { CaptureImageButton };
