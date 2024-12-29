import React from "react";
import { useCameraContext } from "../CameraContext";

interface MenuButtonProps {
}

const MenuButton: React.FC<MenuButtonProps> = () => {
  const { cameraState } = useCameraContext();

  const MenuIcon = () => (
    <svg
      version="1.1"
      id="_x32_"
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      x="0px"
      y="0px"
      viewBox="0 0 512 512"
      style={{ width: "24px", height: "24px", opacity: 1 }}
      xmlSpace="preserve"
    >
      <style type="text/css">
        {`.st0{fill:#4B4B4B;}`}
      </style>
      <g>
        <circle
          className="st0"
          cx="48"
          cy="64"
          r="48"
          style={{ fill: "rgb(75, 75, 75)" }}
        ></circle>
        <rect
          x="160"
          y="16"
          className="st0"
          width="352"
          height="96"
          style={{ fill: "rgb(75, 75, 75)" }}
        ></rect>
        <circle
          className="st0"
          cx="48"
          cy="256"
          r="48"
          style={{ fill: "rgb(75, 75, 75)" }}
        ></circle>
        <rect
          x="160"
          y="208"
          className="st0"
          width="352"
          height="96"
          style={{ fill: "rgb(75, 75, 75)" }}
        ></rect>
        <circle
          className="st0"
          cx="48"
          cy="448"
          r="48"
          style={{ fill: "rgb(75, 75, 75)" }}
        ></circle>
        <rect
          x="160"
          y="400"
          className="st0"
          width="352"
          height="96"
          style={{ fill: "rgb(75, 75, 75)" }}
        ></rect>
      </g>
    </svg>
  );

  return (
    <div className="flex items-center justify-center w-14 h-14 rounded-full shadow-md">
      <button
        onClick={() => {
          alert("Open menu");
        }}
        disabled={cameraState === "saving"}
        className="w-full h-full flex items-center justify-center rounded-full bg-gradient-to-r from-slate-200 to-yellow-100 shadow-inner hover:shadow-lg transition-transform"
      >
        <MenuIcon />
      </button>
    </div>
  );
};

export { MenuButton };