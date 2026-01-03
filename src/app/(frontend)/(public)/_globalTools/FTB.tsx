"use client"

import React, { useState } from "react"
import CameraModal from "./camera/CameraModal"

const FTB: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className, ...buttonProps }) => {
  const [isCameraOpen, setIsCameraOpen] = useState(false)

  return (
    <>
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
      <CameraModal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} />
    </>
  )
}

export default FTB
