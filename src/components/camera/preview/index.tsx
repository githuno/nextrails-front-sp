import { CameraPreview } from "./CameraPreview"
import { ModalWebview } from "./WebView"

const Preview: React.FC<{ isOpen?: boolean }> = ({ isOpen = true }) => {
  return (
    <>
      <CameraPreview isOpen={isOpen} />
      <ModalWebview />
    </>
  )
}

export { Preview }
