"use client";

import React, { useEffect, useState } from "react";
import { Modal } from "@/components";
import Camera from "@/components/camera";

interface MultiInputFTBProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

// カメラが利用可能かどうかをチェックしてcameraボタンを非活性にするか判定する
// const hasCamera = async (): Promise<boolean> => {
//   try {
//     const devices = await navigator.mediaDevices.enumerateDevices();
//     return devices.some((device) => device.kind === "videoinput");
//   } catch (error) {
//     console.error("Error checking camera availability:", error);
//     return false;
//   }
// };

const MultiInputFTB: React.FC<MultiInputFTBProps> = ({
  className,
  ...props
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedComponent, setSelectedComponent] =
    useState<React.ReactNode>(null);

  // Hydrationエラーを回避
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  const toggleButtons = () => {
    setIsExpanded(!isExpanded);
  };

  const openModal = (component: React.ReactNode) => {
    setSelectedComponent(component);
    setIsExpanded(false);
    setIsModalOpen(true);
  };

  const buttons = [
    { id: 1, label: "Cam", onClick: () => openModal(<Camera />) },
    {
      id: 2,
      label: "Text",
      onClick: () => openModal(<div>Text Component</div>),
    },
    {
      id: 3,
      label: "Voice",
      onClick: () => openModal(<div>Voice Component</div>),
    },
    {
      id: 4,
      label: "File",
      onClick: () => openModal(<div>File Component</div>),
    },
  ];

  if (!isClient) {
    return null;
  }

  return (
    <div className="fixed top-0 w-svw h-svh pointer-events-none z-50">
      <div
        className={`absolute bottom-[5%] right-[5%] pointer-events-auto ${className}`}
        {...props}
      >
        <button
          onClick={toggleButtons}
          className="w-16 h-16 bg-blue-500 text-white rounded-full shadow-lg flex items-center justify-center"
        >
          {isExpanded ? "×" : "+"}
        </button>
        {isExpanded &&
          buttons.map((button, index) => {
            const distance = 100; // 距離
            const startAngle = -200; // 開始点角度（0度が3時の位置）
            const angle =
              (startAngle * Math.PI) / 180 +
              (index / (buttons.length - 1)) * (2 * Math.PI * (120 / 360));
            const x = distance * Math.cos(angle);
            const y = distance * Math.sin(angle);
            return (
              <button
                key={button.id}
                onClick={button.onClick}
                className={`absolute w-12 h-12 bg-slate-500 text-white rounded-full shadow-lg flex items-center justify-center`}
                style={{
                  transform: isExpanded
                    ? `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`
                    : "translate(calc(-50%), calc(-50%))",
                  top: `calc(50%)`,
                  left: `calc(50%)`,
                }}
              >
                {button.label}
              </button>
            );
          })}
      </div>
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        className="bg-transparent"
      >
        <div className="shadow-md">{selectedComponent}</div>
      </Modal>
    </div>
  );
};

export default MultiInputFTB;
