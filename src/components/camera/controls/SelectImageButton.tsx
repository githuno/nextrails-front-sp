import React from "react";
import { PictureIcon, useCamera } from "@/components/camera/_utils";

interface SelectImageButtonProps {
  onSaved: () => void;
}

const SelectImageButton: React.FC<SelectImageButtonProps> = ({ onSaved }) => {
  const { cameraState } = useCamera();

  return (
    <div className="flex items-center justify-center w-16 h-16 rounded-full shadow-md">
      <button
        onClick={() => {
          alert("Select Image");
        }}
        disabled={(!cameraState.isScanning && !!cameraState.isAvailable)}
        className="w-full h-full flex items-center justify-center rounded-full bg-gradient-to-r from-slate-200 to-yellow-100 shadow-inner hover:shadow-lg transition-transform"
      >
        <PictureIcon />
      </button>
    </div>
  );
};

export { SelectImageButton };
