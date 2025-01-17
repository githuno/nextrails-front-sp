import React from "react";
import { useIdb, LoadingSpinner, CameraIcon } from "../_utils";
import { useCameraContext, File, ImagesetState } from "../CameraContext";

interface CaptureImageButtonProps {
  onSaved: () => void;
}

const CaptureImageButton: React.FC<CaptureImageButtonProps> = ({ onSaved }) => {
  const { cameraState, setCameraState, dbName, imageset, setImageset } =
    useCameraContext();
  const { idb } = useIdb(dbName);

  const handleCaptureImage = async () => {
    // 画像セット名を取得
    const currentImagesetName = imageset.name;

    // Preview の video 要素を取得して非表示に
    const video = document.getElementById("preview-video") as HTMLVideoElement;
    video.style.display = "none";
    // Preview の canvas 要素を取得して表示 ※scanQRCode()でcontext.drawImageしているため描画済みcanvasを使用可能
    const canvas = document.getElementById(
      "preview-canvas"
    ) as HTMLCanvasElement;
    canvas.style.display = "block";
    // 両要素が取得できない場合はエラー
    if (!video || !canvas) {
      console.error("Failed to find video & canvas element");
      return;
    }

    // capture開始
    setCameraState("CAPTURING");

    // 一時的に dataUrl を idbUrl として設定
    const tempImage: File = {
      idbId: new Date().toISOString().replace(/[-:.TZ]/g, ""), // IDB用のIDを現在時刻から生成
      idbUrl: canvas.toDataURL("image/png"),
      blob: null,
      updatedAt: Date.now(),
      deletedAt: null, // 論理削除日時
      id: null, // DB用のID => あればDBに登録済み ※idbではこれは使わずidbIdを使用する
      size: 0,
      contentType: "image/png",
      key: null, // S3 key　=> あればアップロード済み
      createdAt: Date.now(), // 作成日時
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

    // 1秒後にスキャン状態に戻す
    setTimeout(() => {
      setCameraState("SCANNING");
      video.style.display = "block";
      canvas.style.display = "none";
    }, 1000);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((blob) => resolve(blob), "image/png")
    );
    if (blob) {
      const savedImage: File = await idb.post(imageset.name, {
        ...tempImage,
        idbUrl: null, // 一時的な dataUrl は削除
        blob: blob,
        size: blob.size,
      });
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
    }
  };

  return (
    <div className="flex items-center justify-center w-16 h-16 rounded-full shadow-md">
      <button
        onClick={handleCaptureImage}
        disabled={cameraState === "CAPTURING"}
        className="w-full h-full flex items-center justify-center rounded-full bg-gradient-to-r from-blue-200 to-white shadow-inner hover:shadow-lg transition-transform"
      >
        {cameraState === "CAPTURING" ? <LoadingSpinner /> : <CameraIcon />}
      </button>
    </div>
  );
};

export { CaptureImageButton };
