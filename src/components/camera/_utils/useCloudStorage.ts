import { useState, useRef } from "react";

// INFO：引数を使う場合はこちらを拡張する
//  (例：const {} = useCloudStorage({ endpoint: "https://example.com" });)
interface CloudStorageOptions {
  endpoint: string;
}

interface CloudStorageState {
  isUploading: string[];
}

interface CloudStorageManager {
  upload(params: {
    storagePath: string;
    fileId: string;
    filePath: string;
    contentType: string;
  }): Promise<string>;
  download(params: { keys: string[] }): Promise<Blob[]>;
}

// INFO：CloudStorageの実装
class CloudStorageImpl implements CloudStorageManager {
  private state: CloudStorageState = {
    isUploading: [],
  };
  private setState: React.Dispatch<React.SetStateAction<CloudStorageState>>;
  private endpoint: string;

  constructor(
    setState: React.Dispatch<React.SetStateAction<CloudStorageState>>,
    options: CloudStorageOptions
  ) {
    this.setState = setState;
    this.endpoint = options.endpoint;
  }

  private updateState(newState: Partial<CloudStorageState>) {
    this.state = { ...this.state, ...newState };
    this.setState(this.state);
  }

  private async getDownloadPresignedUrl(keys: string[]): Promise<string[]> {
    if (keys.length === 0) return [];
    try {
      const url = new URL(`${this.endpoint}/files/presignedUrl`);
      url.searchParams.append("keys", keys.join(","));
      const response = await fetch(url.toString(), {
        method: "GET",
        // headers: {
        //   "Content-Type": "application/json",
        // },
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(
          `Failed to get presigned URL: ${response.status} ${error}`
        );
      }
      const jsonResponse: { urls: string[] } = await response.json();
      return jsonResponse.urls;
    } catch (error) {
      console.error("Error getting presigned URL:", error);
      throw error;
    }
  }

  private async getUploadPresignedUrl(
    storagePath: string,
    contentType: string
  ): Promise<string> {
    try {
      const url = new URL(`${this.endpoint}/files/presignedUrl`);
      url.searchParams.append("contentType", contentType);
      url.searchParams.append("storagePath", storagePath);
      const response = await fetch(url.toString(), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(
          `Failed to get presigned URL: ${response.status} ${error}`
        );
      }
      const jsonResponse: { url: string } = await response.json();
      return jsonResponse.url;
    } catch (error) {
      console.error("Error getting presigned URL:", error);
      throw error;
    }
  }

  async download({ keys }: { keys: string[] }): Promise<Blob[]> {
    try {
      const downloadPresignedUrls = await this.getDownloadPresignedUrl(keys);
      const blobs: Blob[] = [];
      for (const url of downloadPresignedUrls) {
        const downloadResponse = await fetch(url, {
          method: "GET",
        });
        if (!downloadResponse.ok) {
          const error = await downloadResponse.text();
          throw new Error(
            `Failed to download file: ${downloadResponse.status} ${error}`
          );
        }
        blobs.push(await downloadResponse.blob());
      }
      return blobs;
    } catch (error) {
      console.error("Error downloading file:", error);
      throw error;
    }
  }

  async upload({
    storagePath,
    fileId,
    filePath,
    contentType,
  }: {
    storagePath: string;
    fileId: string;
    filePath: string;
    contentType: string;
  }): Promise<string> {
    this.updateState({ isUploading: [...this.state.isUploading, fileId] });
    try {
      const uploadPresignedUrl = await this.getUploadPresignedUrl(
        storagePath,
        contentType
      );
      // -----------------------------------------------------------------------
      // INFO：メモリ消費を抑えるためstreamでUPしたいが、HTTP2エラーで失敗するため一旦BlobでUPする実装としている
      // 参考：https://community.cloudflare.com/t/cant-upload-streams-to-r2-because-of-http-1/676021/4
      // 調査：通常のfetchリクエストではHTTP2が問題なく使われている。（dev toolのnetworkタブで確認可能）
      // 仮説1：streamを送信するにはfetchオプションにduplex: 'half'を設定する必要があり、これにより単方向通信となりHTTP2エラーが発生している？
      // 仮説2：presignedUrlの取得時にContentType: application/octet-streamを指定すると、streamを送信することができるかも？
      // 参考：https://developer.chrome.com/docs/capabilities/web-apis/fetch-streaming-requests?hl=ja
      // const response = await fetch(contentPath);
      // const readableStream = response.body;

      // INFO：contentPathからBlobを取得
      const response = await fetch(filePath);
      const blob = await response.blob();
      // -----------------------------------------------------------------------
      const uploadResponse = await fetch(uploadPresignedUrl, {
        method: "PUT",
        body: blob, // readableStreamを渡したいが、Blobでしか動作しないため一旦Blobで実装
        headers: {
          "Content-Type": contentType,
        },
      });
      if (!uploadResponse.ok) {
        const error = await uploadResponse.text();
        throw new Error(
          `Failed to upload file: ${uploadResponse.status} ${error}`
        );
      }
      return storagePath;
    } catch (error) {
      console.error("Error uploading file:", error);
      throw error;
    } finally {
      this.updateState({
        isUploading: this.state.isUploading.filter((id) => id !== fileId),
      });
    }
  }
}

// INFO：CloudStorageのディレクトリ
enum CloudStorageDir {
  IMAGES = "images",
  VIDEOS = "videos",
  THREES = "threes",
  DOCS = "docs",
  OTHERS = "others",
}

const extensionToContentType: Record<
  string,
  { mime: string; class: CloudStorageDir }
> = {
  png: { mime: "image/png", class: CloudStorageDir.IMAGES },
  jpg: { mime: "image/jpeg", class: CloudStorageDir.IMAGES },
  jpeg: { mime: "image/jpeg", class: CloudStorageDir.IMAGES },
  mp4: { mime: "video/mp4", class: CloudStorageDir.VIDEOS },
  webm: { mime: "video/webm", class: CloudStorageDir.VIDEOS },
  mov: { mime: "video/quicktime", class: CloudStorageDir.VIDEOS },
  avi: { mime: "video/x-msvideo", class: CloudStorageDir.VIDEOS },
  obj: { mime: "application/octet-stream", class: CloudStorageDir.THREES },
  fbx: { mime: "application/octet-stream", class: CloudStorageDir.THREES },
  glb: { mime: "model/gltf-binary", class: CloudStorageDir.THREES },
  pdf: { mime: "application/pdf", class: CloudStorageDir.DOCS },
  doc: { mime: "application/msword", class: CloudStorageDir.DOCS },
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    class: CloudStorageDir.DOCS,
  },
  txt: { mime: "text/plain", class: CloudStorageDir.DOCS },
};

const contentTypeToExtension: Record<
  string,
  { ext: string; class: CloudStorageDir }
> = {
  "image/png": { ext: "png", class: CloudStorageDir.IMAGES },
  "image/jpeg": { ext: "jpg", class: CloudStorageDir.IMAGES },
  "video/mp4": { ext: "mp4", class: CloudStorageDir.VIDEOS },
  "video/webm": { ext: "webm", class: CloudStorageDir.VIDEOS },
  "video/quicktime": { ext: "mov", class: CloudStorageDir.VIDEOS },
  "video/x-msvideo": { ext: "avi", class: CloudStorageDir.VIDEOS },
  "application/octet-stream": { ext: "obj", class: CloudStorageDir.THREES },
  "model/gltf-binary": { ext: "glb", class: CloudStorageDir.THREES },
  "application/pdf": { ext: "pdf", class: CloudStorageDir.DOCS },
  "application/msword": { ext: "doc", class: CloudStorageDir.DOCS },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    ext: "docx",
    class: CloudStorageDir.DOCS,
  },
  "text/plain": { ext: "txt", class: CloudStorageDir.DOCS },
};

const useCloudStorage = (
  storageOptions?: CloudStorageOptions // INFO：引数を使う場合はこちらを拡張する
): {
  cloudStorage: CloudStorageManager;
  isUploading: string[];
  extensionToContentType: typeof extensionToContentType;
  contentTypeToExtension: typeof contentTypeToExtension;
} => {
  const [cloudStorageState, setCloudStorageState] = useState<CloudStorageState>(
    {
      isUploading: [],
    }
  );

  const cloudStorageRef = useRef<CloudStorageImpl | null>(null);

  const options =
    storageOptions ||
    ({
      endpoint: process.env.NEXT_PUBLIC_API_BASE || "https://api.example.com",
    } as CloudStorageOptions);

  if (!cloudStorageRef.current) {
    cloudStorageRef.current = new CloudStorageImpl(
      setCloudStorageState,
      options
    );
  }

  return {
    cloudStorage: cloudStorageRef.current,
    isUploading: cloudStorageState.isUploading,
    extensionToContentType,
    contentTypeToExtension,
  };
};

export { useCloudStorage };
