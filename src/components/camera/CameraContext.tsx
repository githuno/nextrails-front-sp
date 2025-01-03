import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  Dispatch,
  SetStateAction,
} from "react";
import {CameraState} from "./_utils";
import { Session } from "@/components";

interface CameraContextProps {
  imageSetName: string;
  setImageSetName: Dispatch<SetStateAction<string>>;
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
  // 仮
  const session: Session = {
    userId: "11111111-1111-1111-1111-111111111111",
  };
  const dbName = `user-${session.userId}`;
  const [imageSetName, setImageSetName] = useState<string>("1");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>("initializing");

  return (
    <CameraContext.Provider
      value={{
        imageSetName,
        setImageSetName,
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
