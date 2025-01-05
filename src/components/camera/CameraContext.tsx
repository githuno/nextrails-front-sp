import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  Dispatch,
  SetStateAction,
} from "react";
import { CameraState } from "./_utils";
import { session } from "@/components";

interface CameraContextProps {
  storeName: string;
  setStoreName: Dispatch<SetStateAction<string>>;
  stream: MediaStream | null;
  setStream: Dispatch<SetStateAction<MediaStream | null>>;
  cameraState: CameraState;
  setCameraState: Dispatch<SetStateAction<CameraState>>;
  dbName: string;
}

const CameraContext = createContext<CameraContextProps | undefined>(undefined);

export const CameraProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const dbName = `user-${session.userId}`;
  const [storeName, setStoreName] = useState<string>("1");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>("INITIALIZING");

  return (
    // 以下の値変更は子孫の再レンダリングを伴う
    <CameraContext.Provider
      value={{
        storeName,
        setStoreName,
        stream,
        setStream,
        cameraState,
        setCameraState,
        dbName,
      }}
    >
      {children}
    </CameraContext.Provider>
  );
};

export const useCameraContext = (): CameraContextProps => {
  const context = useContext(CameraContext);
  if (!context) {
    throw new Error("useCameraContext must be used within a CameraProvider");
  }
  return context;
};
