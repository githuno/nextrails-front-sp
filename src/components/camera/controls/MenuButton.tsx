import React from "react";
import { MenuIcon, useCamera } from "@/components/camera/_utils";

interface MenuButtonProps {}

const MenuButton: React.FC<MenuButtonProps> = () => {
  const { cameraState } = useCamera();

  return (
    <div className="flex items-center justify-center w-14 h-14 rounded-full shadow-md">
      <button
        onClick={() => {
          alert("Open menu");
        }}
        disabled={(!cameraState.isScanning && !!cameraState.isAvailable)}
        className="w-full h-full flex items-center justify-center rounded-full bg-gradient-to-r from-slate-200 to-yellow-100 shadow-inner hover:shadow-lg transition-transform"
      >
        <MenuIcon />
      </button>
    </div>
  );
};

export { MenuButton };
