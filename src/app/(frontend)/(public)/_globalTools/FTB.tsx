"use client"

import React, { useRef, useState } from "react"
import CameraModal from "./camera/CameraModal"
import { useCameraActions } from "./camera/useCameraStore"

const FTB: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className, ...buttonProps }) => {
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

      <div className="pointer-events-none fixed top-0 z-50 h-svh w-svw">
        <div className={`pointer-events-auto absolute right-[5%] bottom-[5%] ${className || ""}`}>
          <button
            onClick={() => setIsCameraOpen(true)}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-500 p-4 text-white shadow-lg transition-transform active:scale-95"
            {...buttonProps}
          >
            📷
          </button>
        </div>
      </div>

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
