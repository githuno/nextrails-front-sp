import React from "react";
import { useCameraContext } from "../CameraContext";
import { PictureIcon } from "../_utils";

interface SelectImageButtonProps {
  onSaved: () => void;
}

const SelectImageButton: React.FC<SelectImageButtonProps> = ({ onSaved }) => {
  const { cameraState } = useCameraContext();

  return (
    <div className="flex items-center justify-center w-16 h-16 rounded-full shadow-md">
      <button
        onClick={() => {
          alert("Select Image");
        }}
        disabled={cameraState !== "SCANNING"}
        className="w-full h-full flex items-center justify-center rounded-full bg-gradient-to-r from-slate-200 to-yellow-100 shadow-inner hover:shadow-lg transition-transform"
      >
        <PictureIcon />
      </button>
    </div>
  );
};

export { SelectImageButton };
