import { PictureIcon, useCamera } from "@/components/camera/_utils"
import React from "react"

interface SelectImageButtonProps {
  onSaved: () => void
}

const SelectImageButton: React.FC<SelectImageButtonProps> = ({ onSaved }) => {
  const { cameraState } = useCamera()

  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-full shadow-md">
      <button
        onClick={() => {
          alert("Select Image")
        }}
        disabled={!cameraState.isScanning && !!cameraState.isAvailable}
        className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-r from-slate-200 to-yellow-100 shadow-inner transition-transform hover:shadow-lg"
      >
        <PictureIcon />
      </button>
    </div>
  )
}

export { SelectImageButton }
