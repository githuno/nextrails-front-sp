"use client"

import React, { useRef, useState } from "react"
import FloatingActionButton from "./_components/FloatingActionButton"
import { useCameraActions } from "./camera/cameraStore"
import { CameraIcon } from "./camera/Icons.Camera"
import CameraModal from "./camera/Modal.Camera"

// TODO: FTB利用画面ではsessionID(uuidv7)を発行しurlパラメータにセットしてlocalStrageに保存する
// そのsessionIDに紐づく画像を表示する（urlをSSOTとする。sessionSync 機能）
// TODO: sessionIdごとにIndexedDBでdatabaseを作成して、キーバリューストア（ローカルのs3）として画像・動画のblob/urlを保存する
// TODO: 上記キーバリューストアとは別に、pgliteでローカルDBを作成して、sessionSyncに使用するキーバリューストアのキーなどのRDB管理を行う
// TODO: pgliteはDrizzle→TanstackDBでラップして抽象化しそのまま状態管理として利用する
// TODO: FTB内で定義するcameraへ注入するaction関数はuseSyncExternalStoreを用いて*useToolActionStore()*にまとめてグローバル状態管理する（コンテキスト次第でactionを切り替え可能にする）

const FTB: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className }) => {
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [isWebViewOpen, setIsWebViewOpen] = useState(false)
  const [webUrl, setWebUrl] = useState("")

  const cameraActions = useCameraActions()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleScan = (data: string) => {
    try {
      const url = new URL(data)
      if (url.protocol === "http:" || url.protocol === "https:") {
        setWebUrl(data)
        setIsWebViewOpen(true)
      } else {
        alert(`Detected: ${data}`)
      }
    } catch (e) {
      console.log("Invalid URL scanned:", e)
      alert(`Detected text: ${data}`)
    }
  }

  const handleSelect = () => {
    fileInputRef.current?.click()
  }

  const fabItems = [
    { id: 1, label: "Camera", icon: <CameraIcon />, onClick: () => setIsCameraOpen(true) },
    { id: 2, label: "Text", onClick: () => alert("Text Component") },
    { id: 3, label: "Voice", onClick: () => alert("Voice Component") },
    { id: 4, label: "File", onClick: handleSelect },
  ]

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return
    Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file)
      cameraActions.addCapturedImage(url)
    })
    // 同じファイルを再度選択できるようにinputをリセットする
    event.target.value = ""
  }

  return (
    <>
      {/* Hidden file input for gallery selection */}
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" multiple className="hidden" />

      <FloatingActionButton.Simple items={fabItems} className={className} />

      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onScan={handleScan}
        onSelect={handleSelect}
        webViewUrl={webUrl}
        isWebViewOpen={isWebViewOpen}
        onWebViewClose={() => {
          setIsWebViewOpen(false)
          setWebUrl("")
        }}
      />
    </>
  )
}

export default FTB
