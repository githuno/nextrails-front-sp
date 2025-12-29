import React, { createContext, useContext, useEffect, useMemo, useState } from "react"
import { CameraConfig, CameraManager, CameraState } from "./cameraManager"

// 初期カメラ状態
const initialCameraState: CameraState = {
  isAvailable: null,
  isScanning: false,
  isRecording: false,
  isCapturing: false,
  availableDevices: [],
  scannedData: null,
  error: null,
}

// カメラコンテキストの値の型
interface CameraContextValue {
  camera: CameraManager | null
  cameraState: CameraState
}

// カメラコンテキストの作成
const CameraContext = createContext<CameraContextValue | null>(null)

// カメラプロバイダーコンポーネント
const CameraContextProvider: React.FC<{
  children: React.ReactNode
  config?: CameraConfig
}> = ({ children, config }) => {
  const [cameraState, setCameraState] = useState<CameraState>(initialCameraState)
  const [camera, setCamera] = useState<CameraManager | null>(null)

  useEffect(() => {
    // カメラインスタンスの遅延初期化
    const instance = new CameraManager(setCameraState, config)
    queueMicrotask(() => {
      setCamera(instance)
    })
    instance.setup()
    return () => {
      instance.cleanup()
    }
  }, [config])

  const value = useMemo(
    () => ({
      camera,
      cameraState,
    }),
    [camera, cameraState],
  )

  return <CameraContext.Provider value={value}>{children}</CameraContext.Provider>
}

// カメラコンテキストを使用するフック
const useCameraContext = (): CameraContextValue => {
  const context = useContext(CameraContext)
  if (!context) {
    throw new Error("useCameraContext must be used within a CameraContextProvider")
  }
  return context
}

// カメラフック
const useCamera = () => {
  return useCameraContext()
}

export { CameraContextProvider, useCamera }
