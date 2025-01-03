import { BaseFileInfo } from "./useIdb";

enum ImagesetStatus {
  DRAFT = "DRAFT",
  SENT = "SENT",
  ARCHIVED = "ARCHIVED",
  DELETED = "DELETED",
}

interface FileType extends BaseFileInfo {
  filename?: string; // PUTで編集させる
  version?: number; // PUTで編集された回数
  extension?: string; // PUTで編集された拡張子
  blob?: Blob; // Blobデータ

  key?: string | null; // S3 key　=> あればアップロード済み
  createdAt?: string; // 作成日時
  updatedAt?: string; // 更新日時
  deletedAt?: string | null; // 削除日時
  status?: ImagesetStatus; // imageSetのステータス　=> DRAFTのみ画面表示。SENTになったら非同期アップロードしてindexedDBからは削除する
}

type CameraState =
  | "initializing"
  | "scanning"
  | "recording"
  | "capturing"
  | "saving"
  | "waiting";

export { type FileType, ImagesetStatus, type CameraState };
