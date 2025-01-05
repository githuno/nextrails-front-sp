import { BaseFileType } from "./useIdb";

interface FileType extends BaseFileType {
  id: string | null; // DB用のID => あればDBに登録済み ※idbではこれは使わずstorageIdを使用する
  contentType?: string;
  size?: number;

  filename?: string; // PUTで編集させる
  version?: number; // PUTで編集された回数
  key?: string | null; // S3 key　=> あればアップロード済み
  createdAt?: string; // 作成日時
  deletedAt?: string | null; // 削除日時
  metadata?: {
    status: ImagesetStatus; // imageSetのステータス　=> DRAFTのみ画面表示。SENTになったら非同期アップロードしてindexedDBからは削除する
  };
}

type CameraState =
  | "INITIALIZING"
  | "SCANNING"
  | "RECORDING"
  | "CAPTURING"
  | "SAVING";

enum ImagesetStatus {
  DRAFT = "DRAFT",
  SENT = "SENT",
  ARCHIVED = "ARCHIVED",
  DELETED = "DELETED",
}

export { type FileType, type CameraState, ImagesetStatus };
