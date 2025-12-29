import { MenuIcon, useCamera } from "@/components/camera/_utils"
import React from "react"

interface MenuButtonProps {}

const MenuButton: React.FC<MenuButtonProps> = () => {
  const { cameraState } = useCamera()

  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-full shadow-md">
      <button
        onClick={() => {
          alert("Open menu")
        }}
        disabled={!cameraState.isScanning && !!cameraState.isAvailable}
        className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-r from-slate-200 to-yellow-100 shadow-inner transition-transform hover:shadow-lg"
      >
        <MenuIcon />
      </button>
    </div>
  )
}

export { MenuButton }
