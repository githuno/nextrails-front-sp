import React, {
  useRef,
  useState,
  useEffect,
  useMemo,
  createContext,
  useContext,
} from "react";
import { CameraState, CameraConfig, CameraManager } from "./cameraManager";

// 初期カメラ状態
const initialCameraState: CameraState = {
  isInitializing: true,
  isAvailable: false,
  isScanning: false,
  isRecording: false,
  isCapturing: false,
  availableDevices: [],
  error: null,
};

// カメラコンテキストの値の型
interface CameraContextValue {
  camera: CameraManager | null;
  cameraState: CameraState;
}

// カメラコンテキストの作成
const CameraContext = createContext<CameraContextValue | null>(null);

// カメラプロバイダーコンポーネント
const CameraContextProvider: React.FC<{
  children: React.ReactNode;
  config?: CameraConfig;
}> = ({ children, config }) => {
  const [cameraState, setCameraState] =
    useState<CameraState>(initialCameraState);
  const cameraRef = useRef<CameraManager | null>(null);

  useEffect(() => {
    // カメラインスタンスの遅延初期化
    cameraRef.current = new CameraManager(setCameraState, config);
    cameraRef.current.setup();
    return () => {
      cameraRef.current?.cleanup();
    };
  }, [config]);

  const value = useMemo(
    () => ({
      camera: cameraRef.current,
      cameraState: cameraState,
    }),
    [cameraRef.current, cameraState]
  );

  return (
    <CameraContext.Provider value={value}>{children}</CameraContext.Provider>
  );
};

// カメラコンテキストを使用するフック
const useCameraContext = (): CameraContextValue => {
  const context = useContext(CameraContext);
  if (!context) {
    throw new Error(
      "useCameraContext must be used within a CameraContextProvider"
    );
  }
  return context;
};

// カメラフック
const useCamera = () => {
  return useCameraContext();
};

export { CameraContextProvider, useCamera };
