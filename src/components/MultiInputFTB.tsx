"use client"

import { Modal } from "@/components/atoms"
import Camera from "@/components/camera"
import React, { useEffect, useState } from "react"

interface MultiInputFTBProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
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

const resetZoom = () => {
  ;(document.body.style as any).zoom = "1"
  document.body.style.transform = "scale(1)"
  document.body.style.transformOrigin = "0 0"
}

const MultiInputFTB: React.FC<MultiInputFTBProps> = ({ className, ...props }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedComponent, setSelectedComponent] = useState<React.ReactNode>(null)

  // Hydrationエラーを回避
  const [isClient, setIsClient] = useState(false)
  useEffect(() => {
    queueMicrotask(() => {
      setIsClient(true)
    })
  }, [])

  const toggleButtons = () => {
    setIsExpanded(!isExpanded)
  }

  const openModal = (component: React.ReactNode) => {
    setSelectedComponent(component)
    if (React.isValidElement(component) && component.type === Camera) {
      resetZoom()
    }
    setIsModalOpen(true)
    setIsExpanded(false)
  }

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
  ]

  if (!isClient) {
    return null
  }

  return (
    <div className="pointer-events-none fixed top-0 z-50 h-svh w-svw">
      <div className={`pointer-events-auto absolute right-[5%] bottom-[5%] ${className}`} {...props}>
        <button
          onClick={toggleButtons}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-500 text-white shadow-lg hover:bg-blue-700"
        >
          {isExpanded ? "×" : "+"}
        </button>
        {isExpanded &&
          buttons.map((button, index) => {
            const distance = 100 // 距離
            const startAngle = -200 // 開始点角度（0度が3時の位置）
            const angle = (startAngle * Math.PI) / 180 + (index / (buttons.length - 1)) * (2 * Math.PI * (120 / 360))
            const x = distance * Math.cos(angle)
            const y = distance * Math.sin(angle)
            return (
              <button
                key={button.id}
                onClick={button.onClick}
                className={`absolute flex h-12 w-12 items-center justify-center rounded-full bg-slate-500 text-white shadow-lg`}
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
            )
          })}
      </div>
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        className="fixed top-[25vh] h-[75vh] bg-transparent"
      >
        {selectedComponent}
      </Modal>
    </div>
  )
}

export default MultiInputFTB
