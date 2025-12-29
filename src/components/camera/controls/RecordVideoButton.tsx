import { File, ImagesetState, useImageset } from "@/components/camera"
import { RecordIcon, StopIcon, useCamera } from "@/components/camera/_utils"
import { useStorage } from "@/components/storage"
import React from "react"

interface RecordVideoButtonProps {
  onSaveCompleted: () => void
}

const RecordVideoButton: React.FC<RecordVideoButtonProps> = ({ onSaveCompleted }) => {
  const { idb } = useStorage()
  const { camera, cameraState } = useCamera()
  const { imageset, setImageset } = useImageset()

  const handleStartRecording = () => {
    if (!camera) {
      throw new Error("Camera is not initialized")
    }
    camera.stopQrScan()
    camera.startRecord()
  }

  const handleStopRecording = async (blob: Blob | null) => {
    if (!blob || !camera) {
      console.error("Recording failed: Blob is null")
      return
    }
    const currentImagesetName = imageset.name

    const video: File = {
      id: null, // DB用のID => あればDBに登録済み ※idbではこれは使わずidbIdを使用する
      key: null, // S3 key => あればアップロード済み
      idbId: new Date().toISOString().replace(/[-:.TZ]/g, ""),
      idbUrl: null,
      blob: blob,
      updatedAt: Date.now(),
      deletedAt: null, // 削除日時
      createdAt: Date.now(), // 作成日時
      fetchedAt: 0, // 取得日時
      shouldPush: true, // クラウドにプッシュすべきかどうか（クラウドで管理していないプロパティ）
      size: blob.size,
      contentType: blob.type,
      filename: "", // PUTで編集させる
      version: 1, // PUTで編集された回数
      metadata: {
        status: ImagesetState.DRAFT,
      },
    }
    const savedVideo: File = await idb.post(currentImagesetName, video)

    setImageset((prev) => {
      if (prev.name === currentImagesetName) {
        return {
          ...prev,
          files: [savedVideo!, ...prev.files],
        }
      }
      return prev
    })
    camera.startQrScan()
    onSaveCompleted()
  }

  return (
    camera && (
      <div className="flex h-16 w-16 items-center justify-center rounded-full shadow-md">
        <button
          onClick={async () => {
            if (cameraState.isRecording) {
              await camera.stopRecord(handleStopRecording)
            } else {
              handleStartRecording()
            }
          }}
          disabled={cameraState.isCapturing}
          className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-r from-red-200 to-white shadow-inner transition-transform hover:shadow-lg"
        >
          {cameraState.isRecording ? <StopIcon /> : <RecordIcon />}
        </button>
      </div>
    )
  )
}

export { RecordVideoButton }
