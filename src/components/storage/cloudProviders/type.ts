import { UserSession } from "@/app/(frontend)/page";
export interface StorageSession {
  uuid: string;
  type: ProviderType;
}
export interface Session {
  user: UserSession | null;
  storage: StorageSession | null;
}

// GITHUB | ONEDRIVE | GDRIVE | DROPBOX | BOX | NATIVE(R2)
export type ProviderType = "NATIVE" | "GDRIVE";

export interface CloudState {
  isUploading: string[];
  isDownloading: string[];
  isDeleting: string[];
  isChecking: boolean;
}

// 共通のレスポンス型を定義
// export interface CloudResponse {
//   idbId: string; // idbのID（
//   key: string; // クラウドのキー
//   metadata?: any; // プロバイダー固有のメタデータ
// }

export interface CloudManager {
  state: CloudState;
  connect(storage: { uuid: string }): Promise<void>;
  session(): Promise<boolean>;
  disconnect(): Promise<void>;
  upload(params: {
    storagePath: string;
    fileId: string;
    filePath: string;
    contentType?: string;
  }): Promise<string>;
  download(params: { keys: string[] }): Promise<Blob[]>;
  // delete(params: { keys: string[] }): Promise<void>;

  // 固有のメソッドを追加可能
  [key: string]: any;
}
