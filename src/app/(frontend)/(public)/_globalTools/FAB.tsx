"use client"

import React, { Suspense, useCallback, useMemo, useRef, useState } from "react"
import FloatingActionButton from "./_components/FloatingActionButton"
import { CameraIcon, MicIcon, TextIcon } from "./_components/Icons"
import { useSessionSync } from "./_hooks/useSessionSync"
import { useToolActionStore, type ToolActionState, type ToolActions } from "./_hooks/useToolActionStore"
import CameraModal from "./camera/Modal.Camera"
import { useCameraState } from "./camera/cameraStore"
import MicrophoneModal from "./microphone/Modal.Microphone"
import { useMicrophoneState } from "./microphone/microphoneStore"
import TextModal from "./text/Modal.Text"

// PGlite関連のimportは開発モード時のみ行う ------------------
import dynamic from "next/dynamic"
import { Modal } from "./_components/atoms/Modal"
import { usePgliteStore } from "./_hooks/db/usePgliteStore"
const Repl = dynamic(() => import("@electric-sql/pglite-repl").then((m) => m.Repl), { ssr: false })
// ---------------------------------------------------------

const FABContent: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className }) => {
  useSessionSync() // URLとStateのセッション同期を有効化

  const activeTool = useToolActionStore(useCallback((s: ToolActionState & ToolActions) => s.activeTool, []))
  const setActiveTool = useToolActionStore(useCallback((s: ToolActionState & ToolActions) => s.setActiveTool, []))
  const handleScan = useToolActionStore(useCallback((s: ToolActionState & ToolActions) => s.handleScan, []))
  const handleSelect = useToolActionStore(useCallback((s: ToolActionState & ToolActions) => s.handleSelect, []))
  const handleFileChange = useToolActionStore(useCallback((s: ToolActionState & ToolActions) => s.handleFileChange, []))

  const cameraState = useCameraState()
  const microphoneState = useMicrophoneState()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // PGlite関連の状態管理 ------------------------------
  const { db, isLoading } = usePgliteStore()
  const [isPgliteOpen, setPgliteOpen] = useState(false)
  // --------------------------------------------------

  const fabItems = useMemo(
    () => [
      ...(cameraState.isAvailable !== false
        ? [{ id: 1, label: "Camera", icon: <CameraIcon />, onClick: () => setActiveTool("camera") }]
        : []),
      ...(microphoneState.isAvailable !== false
        ? [{ id: 2, label: "Mic", icon: <MicIcon />, onClick: () => setActiveTool("microphone") }]
        : []),
      { id: 3, label: "Text", icon: <TextIcon />, onClick: () => setActiveTool("text") },
      { id: 4, label: "File", onClick: () => handleSelect(fileInputRef) },
      ...(process.env.NODE_ENV === "development"
        ? [{ id: 5, label: "PGLite", onClick: () => setPgliteOpen(true) }]
        : []),
    ],
    [cameraState.isAvailable, microphoneState.isAvailable, setActiveTool, handleSelect],
  )

  return (
    <div className="pointer-events-none fixed top-0 z-50 h-svh w-svw overflow-hidden">
      {/* Hidden file input for gallery selection */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => handleFileChange(event)}
        accept="image/*,audio/*,video/*"
        multiple
        className="hidden"
      />
      <FloatingActionButton.Simple items={fabItems} className={className} />

      <CameraModal
        isOpen={activeTool === "camera"}
        onClose={() => setActiveTool(null)}
        onScan={handleScan}
        onSelect={() => handleSelect(fileInputRef)}
      />
      <MicrophoneModal
        isOpen={activeTool === "microphone"}
        onClose={() => setActiveTool(null)}
        onSelect={() => handleSelect(fileInputRef)}
      />
      <TextModal isOpen={activeTool === "text"} onClose={() => setActiveTool(null)} />
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
    <Suspense fallback={<div className="pointer-events-none fixed top-0 z-50 h-svh w-svw overflow-hidden" />}>
      <FABContent className={className} />
    </Suspense>
  )
}
