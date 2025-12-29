import { useCamera } from "@/components/camera/_utils"
import { CaptureImageButton } from "./CaptureImageButton"
import { MenuButton } from "./MenuButton"
import { RecordVideoButton } from "./RecordVideoButton"
import { SelectImageButton } from "./SelectImageButton"

const Controller = () => {
  const { cameraState } = useCamera()
  return (
    <div className="flex h-6 items-center gap-2 rounded-lg bg-white/20 shadow-lg">
      {cameraState.isAvailable && (
        <>
          <RecordVideoButton onSaveCompleted={() => {}} />
          <CaptureImageButton onSaved={() => {}} />
        </>
      )}
      <SelectImageButton onSaved={() => {}} />
      <MenuButton />
    </div>
  )
}

export { Controller }
