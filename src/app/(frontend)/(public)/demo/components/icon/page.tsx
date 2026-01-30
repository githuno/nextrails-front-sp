"use client"

import {
  CameraIcon,
  CheckIcon,
  CloseIcon,
  DocumentIcon,
  LoadingDot,
  LoadingSpinner,
  MenuIcon,
  MicIcon,
  NextIcon,
  PenIcon,
  PictureIcon,
  PlayIcon,
  PrevIcon,
  RecordIcon,
  StopIcon,
  SwitchCameraIcon,
  SyncIcon,
  TextIcon,
  TrashIcon,
} from "@/app/(frontend)/(public)/_globalTools/_components/Icons"
import { useState } from "react"

const icons = [
  { name: "CameraIcon", component: CameraIcon },
  { name: "CloseIcon", component: CloseIcon },
  { name: "LoadingDot", component: LoadingDot },
  { name: "LoadingSpinner", component: LoadingSpinner },
  { name: "MenuIcon", component: MenuIcon },
  { name: "NextIcon", component: NextIcon },
  { name: "PenIcon", component: PenIcon },
  { name: "PictureIcon", component: PictureIcon },
  { name: "PrevIcon", component: PrevIcon },
  { name: "RecordIcon", component: RecordIcon },
  { name: "StopIcon", component: StopIcon },
  { name: "SwitchCameraIcon", component: SwitchCameraIcon },
  { name: "SyncIcon", component: SyncIcon },
  { name: "MicIcon", component: MicIcon },
  { name: "PlayIcon", component: PlayIcon },
  { name: "TextIcon", component: TextIcon },
  { name: "DocumentIcon", component: DocumentIcon },
  { name: "CheckIcon", component: CheckIcon },
  { name: "TrashIcon", component: TrashIcon },
]

export default function IconDemoPage() {
  const [size, setSize] = useState("32px")
  const [color, setColor] = useState("#4B4B4B")

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold">Icon Demo</h1>
      <div className="mb-6">
        <label className="mb-2 block">
          Size:
          <input
            type="text"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="ml-2 rounded border px-2 py-1"
          />
        </label>
        <label className="mb-2 block">
          Color:
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="ml-2" />
        </label>
      </div>
      <div className="grid grid-cols-10 gap-2">
        {icons.map(({ name, component: IconComponent }) => (
          <div key={name} className="flex flex-col items-center rounded border p-4">
            <IconComponent size={size} color={color} />
            <span className="mt-2 text-sm">{name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
