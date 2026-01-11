"use client"

import React, { useRef } from "react"
import FloatingActionButton from "./_components/FloatingActionButton"
import { CameraIcon } from "./_components/Icons"
import { useSessionSync } from "./_hooks/useSessionSync"
import { useToolActionStore } from "./_hooks/useToolActionStore"
import CameraModal from "./camera/Modal.Camera"


const FTB: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className }) => {
  useSessionSync() // URLとStateのセッション同期を有効化

  const { isCameraOpen, isWebViewOpen, webUrl, handleScan, addFiles, setCameraOpen, closeWebView } =
    useToolActionStore()

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSelect = () => {
    fileInputRef.current?.click()
  }

  const fabItems = [
    { id: 1, label: "Camera", icon: <CameraIcon />, onClick: () => setCameraOpen(true) },
    { id: 2, label: "Text", onClick: () => alert("Text Component") },
    { id: 3, label: "Voice", onClick: () => alert("Voice Component") },
    { id: 4, label: "File", onClick: handleSelect },
  ]

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return
    addFiles(files)
    // 同じファイルを再度選択できるようにinputをリセットする
    event.target.value = ""
  }

  return (
    <div className="pointer-events-none fixed top-0 z-50 h-svh w-svw overflow-hidden">
      {/* Hidden file input for gallery selection */}
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" multiple className="hidden" />

      <FloatingActionButton.Simple items={fabItems} className={className} />

      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setCameraOpen(false)}
        onScan={handleScan}
        onSelect={handleSelect}
        webViewUrl={webUrl}
        isWebViewOpen={isWebViewOpen}
        onWebViewClose={closeWebView}
      />
    </div>
  )
}

export default FTB
