"use client"

import React, { useRef, useState } from "react"
import FloatingActionButton from "./_components/FloatingActionButton"
import { CameraIcon } from "./_components/Icons"
import { useSessionSync } from "./_hooks/useSessionSync"
import { useToolActionStore } from "./_hooks/useToolActionStore"
import CameraModal from "./camera/Modal.Camera"

// PGlite関連のimportは開発モード時のみ行う ------------------
import { Repl } from "@electric-sql/pglite-repl"
import { Modal } from "./_components/atoms/Modal"
import { usePgliteStore } from "./_hooks/db/usePgliteStore"
// ---------------------------------------------------------

const FAB: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className }) => {
  useSessionSync() // URLとStateのセッション同期を有効化
  const { isReady, isCameraOpen, isWebViewOpen, webUrl, handleScan, addFiles, setCameraOpen, closeWebView } =
    useToolActionStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // PGlite関連の状態管理 ------------------------------
  const { db } = usePgliteStore()
  const [isPgliteOpen, setPgliteOpen] = useState(false)
  // --------------------------------------------------

  const handleSelect = () => {
    fileInputRef.current?.click()
  }

  const fabItems = [
    { id: 1, label: "Camera", icon: <CameraIcon />, onClick: () => setCameraOpen(true) },
    { id: 2, label: "Text", onClick: () => alert("Text Component") },
    { id: 3, label: "Voice", onClick: () => alert("Voice Component") },
    { id: 4, label: "File", onClick: handleSelect },
    ...(process.env.NODE_ENV === "development" ? [{ id: 5, label: "PGLite", onClick: () => setPgliteOpen(true) }] : []),
  ]

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return
    addFiles(files)
    // 同じファイルを再度選択できるようにinputをリセットする
    event.target.value = ""
  }

  if (!isReady) return null

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

      <Modal
        isOpen={isPgliteOpen}
        onClose={() => setPgliteOpen(false)}
        className="fixed top-[10vh] z-50 h-[80vh] w-[90vw] bg-white"
      >
        <Repl pg={db?.$client} theme="dark" border={true} />
      </Modal>
    </div>
  )
}

export default FAB
