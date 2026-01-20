import { apiFetch } from "@/hooks/useFetch"
import { useState } from "react"
import { CloudManager, CloudState, Session } from "./type"

const CONNECT_URL = "/storages/connect/r2"
const PRESIGNED_URL = "/files/presignedUrl"

// INFO：引数を使う場合はこちらを拡張する
//  (例：const {} = useR2({ endpoint: "https://example.com" });)
interface R2options {
  endpoint: string
}

// INFO：R2の実装
class R2manager implements CloudManager {
  public state: CloudState = {
    isChecking: false,
    isUploading: [],
    isDownloading: [],
    isDeleting: [],
    isConnected: false,
  }
  private setState: React.Dispatch<React.SetStateAction<CloudState>>
  private endpoint: string

  constructor(setState: React.Dispatch<React.SetStateAction<CloudState>>, options: R2options) {
    this.setState = setState
    this.endpoint = options.endpoint
    this.setState(this.state)
  }
  private updateState(newState: Partial<CloudState>) {
    // 関数形式でステートを更新
    this.setState((prevState) => {
      const nextState = { ...prevState, ...newState }
      this.state = nextState // 内部状態も更新
      return nextState
    })
  }

  private async getDownloadPresignedUrl(keys: string[]): Promise<string[]> {
    if (keys.length === 0) return []
    try {
      const params = new URLSearchParams()
      params.append("keys", keys.join(","))
      const response = await apiFetch<{ urls: string[] }>(`${PRESIGNED_URL}?${params.toString()}`, {
        credentials: "omit", // credentialsをomitに設定
      })
      return response.urls
    } catch (error) {
      console.error("Error getting presigned URL:", error)
      throw error
    }
  }

  private async getUploadPresignedUrl(storagePath: string, contentType: string): Promise<string> {
    try {
      const params = new URLSearchParams()
      params.append("contentType", contentType)
      params.append("storagePath", storagePath)
      const response = await apiFetch<{ url: string }>(`${PRESIGNED_URL}?${params.toString()}`, { method: "PUT" })
      return response.url
    } catch (error) {
      console.error("Error getting presigned URL:", error)
      throw error
    }
  }

  async connect(storage: { uuid: string }): Promise<void> {
    try {
      const response = await apiFetch<Session>(CONNECT_URL, {
        method: "POST",
        body: JSON.stringify({ storage }),
      })
      if (response.storage?.type !== "NATIVE") {
        throw new Error("Invalid storage type")
      }
    } catch (error) {
      console.error("R2 connection error:", error)
      throw error
    }
  }

  async session(): Promise<boolean> {
    // 空メソッド：DBヘルスチェックでもいいかも
    console.log("R2 session check - always returns true")
    return true
  }

  async disconnect(): Promise<void> {
    // 空メソッド
    this.updateState({
      isUploading: [], // アップロード中の処理もクリア
      isDownloading: [], // ダウンロード中の処理もクリア
    })
    return
  }

  async download({ keys }: { keys: string[] }): Promise<Blob[]> {
    try {
      const downloadPresignedUrls = await this.getDownloadPresignedUrl(keys)
      const downloadPromises = downloadPresignedUrls.map(async (url) => {
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`Failed to download file: ${response.status}`)
        }
        return response.blob()
      })
      return Promise.all(downloadPromises)
    } catch (error) {
      console.error("Error downloading file:", error)
      throw error
    }
  }

  async upload({
    storagePath,
    fileId,
    filePath,
    contentType,
  }: {
    storagePath: string
    fileId: string
    filePath: string
    contentType: string
  }): Promise<string> {
    this.updateState({ isUploading: [...this.state.isUploading, fileId] })
    try {
      const uploadPresignedUrl = await this.getUploadPresignedUrl(storagePath, contentType)
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
      const response = await fetch(filePath)
      const blob = await response.blob()
      // -----------------------------------------------------------------------
      await fetch(uploadPresignedUrl, {
        method: "PUT",
        body: blob,
        headers: {
          "Content-Type": contentType,
        },
      })

      return storagePath
    } catch (error) {
      console.error("Error uploading file:", error)
      throw error
    } finally {
      this.updateState({
        isUploading: this.state.isUploading.filter((id) => id !== fileId),
      })
    }
  }

  async delete({ keys: _keys }: { keys: string[] }): Promise<void> {
    try {
      alert("delete")
    } catch (error) {
      console.error("Error deleting file:", error)
      throw error
    }
  }
}

const useR2 = (
  storageOptions?: R2options, // INFO：引数を使う場合はこちらを拡張する
): {
  r2: R2manager
  r2state: CloudState
} => {
  const [r2state, setR2state] = useState<CloudState>({
    isChecking: false,
    isUploading: [],
    isDownloading: [],
    isDeleting: [],
    isConnected: false,
  })

  const options =
    storageOptions ||
    ({
      endpoint: process.env.NEXT_PUBLIC_API_BASE || "https://api.example.com",
    } as R2options)

  // 初回レンダリング時に一度だけインスタンスを生成します。
  // useRef.currentをレンダリング中に直接操作するのはReact 19では非推奨です。
  const [r2] = useState(() => new R2manager(setR2state, options))

  return {
    r2: r2,
    r2state: r2state,
  }
}

export { useR2 }
