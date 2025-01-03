import { useState, useRef } from "react";

interface CloudStorageState {
  isUploading: string[];
}

interface CloudStorage {
  upload: (
    storagePath: string,
    fileId: string,
    filePath: string,
    contentType: string
  ) => Promise<string>;
}

interface CloudStorageOptions {
  endpoint: string;
}

class CloudStorageImpl implements CloudStorage {
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

  private async getPresignedUrl(
    storagePath: string,
    contentType: string
  ): Promise<string> {
    try {
      const url = new URL(`${this.endpoint}/files/presignedUrl`);
      url.searchParams.append("contentType", contentType);
      url.searchParams.append("storagePath", storagePath);
      const response = await fetch(url.toString(), {
        method: "GET",
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

  async upload(
    storagePath: string,
    fileId: string,
    filePath: string,
    contentType: string
  ): Promise<string> {
    this.updateState({ isUploading: [...this.state.isUploading, fileId] });
    try {
      const presignedUrl = await this.getPresignedUrl(storagePath, contentType);

      // INFO：メモリ消費を抑えるためstreamでUPしたいが、HTTP2エラーで失敗するため一旦BlobでUPする実装としている
      // 参考：https://community.cloudflare.com/t/cant-upload-streams-to-r2-because-of-http-1/676021/4
      // 調査：通常のfetchリクエストではHTTP2が問題なく使われている。（dev toolのnetworkタブで確認可能）
      // 仮説：streamを送信するにはfetchオプションにduplex: 'half'を設定する必要があり、これにより単方向通信となりHTTP2エラーが発生している？
      // 参考：https://developer.chrome.com/docs/capabilities/web-apis/fetch-streaming-requests?hl=ja
      // const response = await fetch(contentPath);
      // const readableStream = response.body;
      
      // INFO：contentPathからBlobを取得
      const response = await fetch(filePath);
      const blob = await response.blob();

      const uploadResponse = await fetch(presignedUrl, {
        method: "PUT",
        body: blob, // readableStreamを渡したい
        headers: {
          "Content-Type": contentType,
        },
      });
      if (!uploadResponse.ok) {
        const error = await uploadResponse.text();
        throw new Error(`Failed to upload file: ${uploadResponse.status} ${error}`);
      }
      return storagePath;
    } catch (error) {
      console.error("Error uploading file:", error);
      throw error;
    }
  }
}

const useCloudStorage = (
  options: CloudStorageOptions
): { cloudStorage: CloudStorage; isUploading: string[] } => {
  const [cloudStorageState, setCloudStorageState] = useState<CloudStorageState>(
    {
      isUploading: [],
    }
  );

  const cloudStorageRef = useRef<CloudStorageImpl | null>(null);

  if (!cloudStorageRef.current) {
    cloudStorageRef.current = new CloudStorageImpl(
      setCloudStorageState,
      options
    );
  }

  return {
    cloudStorage: cloudStorageRef.current,
    isUploading: cloudStorageState.isUploading,
  };
};

export default useCloudStorage;
