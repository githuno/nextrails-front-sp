import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  Dispatch,
  SetStateAction,
} from "react";
import { session } from "@/components";
import { IdbFile } from "./_utils";

type CameraState =
  | "INITIALIZING"
  | "SCANNING"
  | "RECORDING"
  | "REC_SAVING"
  | "CAPTURING";

enum ImagesetState {
  DRAFT = "DRAFT",
  SENT = "SENT",
  ARCHIVED = "ARCHIVED",
  DELETED = "DELETED",
}

interface File extends IdbFile {
  // idbId: string; // IDB用のID
  // idbUrl: string | null; // IDB用のURL
  // blob: Blob; // 画像データ
  // updatedAt: number; // 更新日時
  deletedAt: number | null; // 論理削除日時

  createdAt: number; // 作成日時
  id: string | null; // DB用のID => あればDBに登録済み ※idbではこれは使わずidbIdを使用する
  contentType: string;
  size: number;

  filename?: string; // PUTで編集させる
  version: number; // PUTで編集された回数
  key: string | null; // S3 key　=> あればアップロード済み
  metadata?: {
    status: ImagesetState; // imageSetのステータス　=> DRAFTのみ画面表示。SENTになったら非同期アップロードしてindexedDBからは削除する
  };
}

interface Imageset {
  id: number;
  name: string;
  status: ImagesetState;
  files: File[];
  syncAt: number | null;
}

interface CameraContextProps {
  imageset: Imageset;
  setImageset: Dispatch<SetStateAction<Imageset>>;
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
  const [imageset, setImageset] = useState<Imageset>({
    id: Date.now(),
    name: "1",
    status: ImagesetState.DRAFT,
    files: [],
    syncAt: null,
  });
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>("INITIALIZING");

  return (
    // 以下の値変更は子孫の再レンダリングを伴う
    <CameraContext.Provider
      value={{
        imageset,
        setImageset,
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

const useCameraContext = (): CameraContextProps => {
  const context = useContext(CameraContext);
  if (!context) {
    throw new Error("useCameraContext must be used within a CameraProvider");
  }
  return context;
};

export {
  useCameraContext,
  type File,
  type Imageset,
  type CameraState, // TODO: typeとenumを統一する
  ImagesetState, // TODO: typeとenumを統一する
};
