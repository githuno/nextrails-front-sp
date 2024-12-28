import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  Dispatch,
  SetStateAction,
} from "react";
import { Session } from "@/components";

type CameraState =
  | "initializing"
  | "scanning"
  | "recording"
  | "capturing"
  | "saving"
  | "waiting";

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
    user_id: "sample_u_id",
    object_id: "sample_o_id",
  };
  const dbName = `AppName-${session.user_id}`;
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
