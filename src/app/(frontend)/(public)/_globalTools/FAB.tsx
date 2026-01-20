"use client"

import React, { Suspense, useRef, useState } from "react"
import FloatingActionButton from "./_components/FloatingActionButton"
import { CameraIcon } from "./_components/Icons"
import { useSessionSync } from "./_hooks/useSessionSync"
import { useToolActionStore } from "./_hooks/useToolActionStore"
import CameraModal from "./camera/Modal.Camera"
import { useCameraState } from "./camera/cameraStore"

// PGlite関連のimportは開発モード時のみ行う ------------------
import { Repl } from "@electric-sql/pglite-repl"
import { Modal } from "./_components/atoms/Modal"
import { usePgliteStore } from "./_hooks/db/usePgliteStore"
// ---------------------------------------------------------

const FABContent: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className }) => {
  useSessionSync() // URLとStateのセッション同期を有効化
  const { isCameraOpen, handleScan, setCameraOpen, handleSelect, handleFileChange } = useToolActionStore()
  const cameraState = useCameraState()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // PGlite関連の状態管理 ------------------------------
  const { db, isLoading } = usePgliteStore()
  const [isPgliteOpen, setPgliteOpen] = useState(false)
  // --------------------------------------------------

  const fabItems = [
    ...(cameraState.isAvailable
      ? [{ id: 1, label: "Camera", icon: <CameraIcon />, onClick: () => setCameraOpen(true) }]
      : []),
    { id: 2, label: "Text", onClick: () => alert("Text Component") },
    { id: 3, label: "Voice", onClick: () => alert("Voice Component") },
    { id: 4, label: "File", onClick: () => handleSelect(fileInputRef) },
    ...(process.env.NODE_ENV === "development" ? [{ id: 5, label: "PGLite", onClick: () => setPgliteOpen(true) }] : []),
  ]

  return (
    <div className="pointer-events-none fixed top-0 z-50 h-svh w-svw overflow-hidden">
      {/* Hidden file input for gallery selection */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => handleFileChange(event)}
        accept="image/*"
        multiple
        className="hidden"
      />
      <FloatingActionButton.Simple items={fabItems} className={className} />

      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setCameraOpen(false)}
        onScan={handleScan}
        onSelect={() => handleSelect(fileInputRef)}
      />
      <Modal
        isOpen={isPgliteOpen}
        onClose={() => setPgliteOpen(false)}
        className="fixed top-[10vh] z-50 h-[80vh] w-[90vw] bg-white"
      >
        {isLoading && <div>Loading PGLite...</div>}
        {db && <Repl pg={db?.$client} theme="dark" border={true} />}
      </Modal>
    </div>
  )
}

export const FAB: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className }) => {
  return (
    <Suspense>
      <FABContent className={className} />
    </Suspense>
  )
}
