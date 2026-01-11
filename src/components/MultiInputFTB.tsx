"use client"

import FloatingActionButton from "@/app/(frontend)/(public)/_globalTools/_components/FloatingActionButton"
import { Modal } from "@/components/atoms"
import Camera from "@/components/camera"
import React, { useEffect, useState, useTransition } from "react"

interface MultiInputFTBProps {
  className?: string
}

const resetZoom = () => {
  document.body.style.transform = "scale(1)"
  document.body.style.transformOrigin = "0 0"
}

const MultiInputFTB: React.FC<MultiInputFTBProps> = ({ className }) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedComponent, setSelectedComponent] = useState<React.ReactNode>(null)
  const [isPending, startTransition] = useTransition()

  // Hydrationエラーを回避
  const [isClient, setIsClient] = useState(false)
  useEffect(() => {
    queueMicrotask(() => {
      setIsClient(true)
    })
  }, [])

  const openModal = async (component: React.ReactNode) => {
    startTransition(async () => {
      if (React.isValidElement(component) && component.type === Camera) {
        resetZoom()
      }
      setSelectedComponent(component)
      setIsModalOpen(true)
    })
  }

  const items = [
    { id: 11, label: "Cam", onClick: () => openModal(<Camera />), disabled: isPending },
    { id: 12, label: "Text", onClick: () => openModal(<div>Text Component</div>) },
    { id: 13, label: "Voice", onClick: () => openModal(<div>Voice Component</div>) },
    { id: 14, label: "File", onClick: () => openModal(<div>File Component</div>) },
  ]

  if (!isClient) {
    return null
  }

  return (
    <div className="pointer-events-none fixed top-0 z-50 h-svh w-svw overflow-hidden">
      <FloatingActionButton.Simple items={items} className={className} position={{ right: "8%", bottom: "30%" }} />

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
