"use client"

import React, { useCallback, useMemo, useRef, useState } from "react"
import { CameraIcon, MicIcon } from "./_components/Icons"
import { useFlickGesture } from "./_hooks/useFlickGesture"
import CameraModal from "./camera/Modal.Camera"
import MicrophoneModal from "./microphone/Modal.Microphone"

export type FlickCaptureData =
  | { type: "image"; blob: Blob; url: string }
  | { type: "audio"; blob: Blob; url: string }
  | { type: "video"; blob: Blob; url: string }
  | { type: "qr"; data: string }
  | { type: "file"; files: File[] }

type ToolId = "camera" | "microphone" | "file"

interface FlickInputProps {
  onCapture: (data: FlickCaptureData) => void
  items?: ToolId[]
  className?: string
  triggerIcon?: React.ReactNode
  startAngle?: number
  sweepAngle?: number
  showShowcase?: boolean
}

export const FlickInput: React.FC<FlickInputProps> = ({
  onCapture,
  items = ["camera", "microphone", "file"],
  className,
  triggerIcon,
  startAngle = -150,
  sweepAngle = 120,
  showShowcase = false,
}) => {
  const [activeTool, setActiveTool] = useState<"camera" | "microphone" | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [fileAccept, setFileAccept] = useState<string | undefined>(undefined)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleToolClick = useCallback((id: ToolId) => {
    if (id === "camera") {
      setFileAccept("image/*")
      setActiveTool("camera")
    } else if (id === "microphone") {
      setFileAccept("audio/*")
      setActiveTool("microphone")
    } else if (id === "file") {
      setFileAccept(undefined) // 全てのファイル
      // 次の描画サイクルで実行することで、accept属性のリセットを確実にする
      requestAnimationFrame(() => {
        if (fileInputRef.current) {
          fileInputRef.current.click()
        }
      })
    }
    setIsExpanded(false)
  }, [])

  const handleGallerySelect = useCallback((accept?: string) => {
    setFileAccept(accept)
    setActiveTool(null) // モーダルを閉じてからファイル選択を開く
    // 次のティックで実行することで、モーダルが閉じるのを確実にする
    requestAnimationFrame(() => {
      if (fileInputRef.current) {
        fileInputRef.current.click()
      }
    })
  }, [])

  const toolItems = useMemo(() => {
    const allItems = [
      {
        id: "camera" as const,
        label: "Camera",
        icon: <CameraIcon />,
      },
      {
        id: "microphone" as const,
        label: "Mic",
        icon: <MicIcon />,
      },
      {
        id: "file" as const,
        label: "File",
        ariaLabel: "File",
      },
    ]
    return allItems
      .filter((item) => items.includes(item.id))
      .map((item) => ({
        ...item,
        onClick: () => handleToolClick(item.id),
      }))
  }, [items, handleToolClick])

  const gesture = useFlickGesture(
    {
      total: toolItems.length,
      distance: 80,
      startAngle,
      sweepAngle,
    },
    (expanded) => {
      if (expanded && !isExpanded) setIsExpanded(true)
    },
  )

  const handleTouchEnd = () => {
    gesture.handleTouchEnd((index) => {
      const item = toolItems[index]
      if (item) {
        item.onClick()
        setIsExpanded(false)
      }
    })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      setActiveTool(null) // ファイル選択後はモーダルを閉じる
      if (files.length === 1) {
        const file = files[0]
        const url = URL.createObjectURL(file)
        if (file.type.startsWith("image/")) {
          onCapture({ type: "image", blob: file, url })
        } else if (file.type.startsWith("audio/")) {
          onCapture({ type: "audio", blob: file, url })
        } else if (file.type.startsWith("video/")) {
          onCapture({ type: "video", blob: file, url })
        } else {
          onCapture({ type: "file", files: Array.from(files) })
        }
      } else {
        onCapture({ type: "file", files: Array.from(files) })
      }
    }
    e.target.value = ""
  }

  return (
    <div className={`relative inline-block ${className || ""}`}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        multiple
        accept={fileAccept}
      />
      <div
        className="relative z-10 touch-none transition-transform active:scale-95"
        onTouchStart={gesture.handleTouchStart}
        onTouchMove={gesture.handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <button
          type="button"
          className={`flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br from-blue-500 to-indigo-600 text-white shadow-lg transition-all ${
            isExpanded || gesture.isDragging ? "scale-110 rotate-135" : ""
          }`}
        >
          {triggerIcon || (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          )}
        </button>
      </div>

      {/* Action List Overlay */}
      {(isExpanded || gesture.isDragging) && (
        <div className="absolute top-1/2 left-1/2 z-30">
          {toolItems.map((item, index) => {
            const angleRad =
              (startAngle * Math.PI) / 180 +
              (toolItems.length > 1 ? index / (toolItems.length - 1) : 0) * (2 * Math.PI * (sweepAngle / 360))
            const x = 80 * Math.cos(angleRad)
            const y = 80 * Math.sin(angleRad)
            const isFlicked = gesture.flickIndex === index

            return (
              <div
                key={item.id}
                className="absolute flex items-center justify-center transition-all duration-300"
                style={{
                  transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                  scale: isFlicked ? "1.2" : "1",
                  opacity: 1,
                }}
              >
                <button
                  type="button"
                  aria-label={item.ariaLabel || item.label}
                  onClick={(e) => {
                    e.stopPropagation()
                    item.onClick()
                    setIsExpanded(false)
                  }}
                  className={`pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/90 text-slate-700 shadow-md backdrop-blur-sm transition-colors hover:bg-blue-500 hover:text-white ${
                    isFlicked ? "bg-blue-500 text-white" : ""
                  }`}
                >
                  {item.icon || <span className="text-[10px] font-bold">{item.label}</span>}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Standalone Modals */}
      <CameraModal
        isOpen={activeTool === "camera"}
        onClose={() => setActiveTool(null)}
        standalone={true}
        showShowcase={showShowcase}
        onCapture={(res) => {
          console.log("[FlickInput] CameraModal onCapture:", res)
          switch (res.type) {
            case "image":
            case "video":
              onCapture({ type: res.type, blob: res.blob, url: res.url })
              break
            case "qr":
              onCapture({ type: "qr", data: res.data })
              break
            case "file":
              onCapture({ type: "file", files: res.files })
              break
          }
        }}
        onSelect={() => handleGallerySelect("image/*")}
      />

      <MicrophoneModal
        isOpen={activeTool === "microphone"}
        onClose={() => setActiveTool(null)}
        standalone={true}
        showShowcase={showShowcase}
        onCapture={(res) => {
          console.log("[FlickInput] MicrophoneModal onCapture:", res)
          switch (res.type) {
            case "audio":
              onCapture({ type: "audio", blob: res.blob, url: res.url })
              break
            case "file":
              onCapture({ type: "file", files: res.files })
              break
          }
        }}
        onSelect={() => handleGallerySelect("audio/*")}
      />
    </div>
  )
}
