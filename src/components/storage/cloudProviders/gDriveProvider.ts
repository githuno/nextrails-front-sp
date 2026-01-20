import { apiFetch } from "@/hooks/useFetch"
import { useState } from "react"
import { CloudManager, CloudState } from "./type"

// Google関連のエンドポイント
const ENDPOINTS = {
  // Google認証関連
  AUTH: {
    ON: `/storages/connect/google/on`,
    STATUS: `/storages/connect/google/status`,
    OFF: `/storages/connect/google/off`,
    TOKEN: `/storages/connect/google/status/token`,
  },
  // Google Drive操作関連
  DRIVE: {
    UPLOAD: `/storages/gdrive/upload`,
    FOLDER: `/storages/gdrive/folder`,
    PUBLISH: `/storages/gdrive/publish`,
  },
} as const

interface GDriveOptions {
  endpoint: string
}

class GDriveManager implements CloudManager {
  public state: CloudState = {
    isChecking: false,
    isUploading: [],
    isDownloading: [],
    isDeleting: [],
    isConnected: false,
  }
  private setState: React.Dispatch<React.SetStateAction<CloudState>>
  private endpoint: string
  private authWindow: Window | null = null

  constructor(setState: React.Dispatch<React.SetStateAction<CloudState>>, options: GDriveOptions) {
    this.setState = setState
    this.endpoint = options.endpoint
    this.setState(this.state)
  }
  private updateState(newState: Partial<CloudState>) {
    this.setState((prevState) => {
      const nextState = { ...prevState, ...newState }
      this.state = nextState
      return nextState
    })
  }

  async connect(storage: { uuid: string }): Promise<void> {
    try {
      const queryParams = new URLSearchParams({
        uuid: storage.uuid,
      }).toString()

      // Google認証開始前にユーザーアクションを待つ
      await new Promise<void>((resolve) => {
        // ユーザーアクションを必要とするクリックイベントを作成
        const button = document.createElement("button")
        button.style.display = "none"
        document.body.appendChild(button)

        button.onclick = async () => {
          try {
            await this.openAuthWindow(queryParams)
            resolve()
          } catch (error) {
            console.error("Auth window error:", error)
          } finally {
            button.remove()
          }
        }

        button.click()
      })
    } catch (error) {
      console.error("GDrive connection error:", error)
      throw error
    }
  }

  async session(): Promise<boolean> {
    try {
      this.updateState({ isChecking: true })
      const statusResponse = await apiFetch<{ isConnected: boolean }>(ENDPOINTS.AUTH.STATUS)
      return statusResponse.isConnected
    } catch (error) {
      console.error("Status check failed:", error)
      return false
    } finally {
      this.updateState({ isChecking: false })
    }
  }

  async disconnect(): Promise<void> {
    try {
      await apiFetch(ENDPOINTS.AUTH.OFF, { method: "POST" })
      this.updateState({
        isUploading: [],
        isDownloading: [],
        isDeleting: [],
      })
    } catch (error) {
      console.error("GDrive disconnection error:", error)
      throw error
    }
  }

  async upload({
    storagePath,
    fileId,
    filePath,
  }: {
    storagePath: string
    fileId: string
    filePath: string
  }): Promise<string> {
    this.updateState({ isUploading: [...this.state.isUploading, fileId] })

    // storagepathの末尾を除いた部分をフォルダパスとして取得
    const folderPath = storagePath.split("/").slice(0, -1).join("/")
    // storagepathの末尾（拡張子除く）をファイル名として取得
    // const filename = storagePath.split("/").pop()?.split(".")[0] || "unnamed";

    try {
      // 1. フォルダを作成または検索
      const folderResponse = await apiFetch<{
        folderId: string
        isExisting: boolean
      }>(ENDPOINTS.DRIVE.FOLDER, {
        method: "POST",
        body: JSON.stringify({
          // 例）storagePath: 11111111-1111-1111-1111-111111111111/1_imgs/20250216093632970.png
          // フォルダパスを配列として送信
          folderPath: folderPath.split("/").filter(Boolean),
        }),
      })

      // 2. ファイルをアップロード
      const formData = new FormData()
      const response = await fetch(filePath)
      const blob = await response.blob()
      // ファイル名はパスの最後の部分を使用
      const fileName = storagePath.split("/").pop() || "unnamed"
      formData.append("file", blob, fileName)
      formData.append("folderId", folderResponse.folderId)

      const uploadResponse = await apiFetch<{
        fileId: string
        webViewLink?: string //TODO: 返ってきてない
      }>(ENDPOINTS.DRIVE.UPLOAD, {
        method: "POST",
        body: formData,
      })
      // uploadResponseにはgoogleのfileIdが格納される
      console.log("Uploaded to GDrive:", uploadResponse)

      // TODO：IDB上のkey/id/idbidの関係整理
      // idはバックエンドのuuid、
      // idbIdはオフラインで使えるファイル生成時の一意なID
      // keyはストレージのキー、
      // つまりここで返すべきはkeyのみ

      // storagepathの末尾（拡張子除く）を
      const key = `gdrive/${uploadResponse.fileId}`

      return key
    } catch (error) {
      console.error("Error uploading to GDrive:", error)
      throw error
    } finally {
      this.updateState({
        isUploading: this.state.isUploading.filter((id) => id !== fileId),
      })
    }
  }

  // バックエンド処理軽減のため現在不使用
  // またフロントからリクエストするときapiFetch関数ではフロント返却時に処理できず、純粋なfetch関数を使用する必要あり
  // async download({ keys }: { keys: string[] }): Promise<Blob[]> {
  //   this.updateState({ isDownloading: [...this.state.isDownloading, ...keys] });
  //   try {
  //     // キーからGoogle DriveのfileIdを抽出
  //     const fileIds = keys.map((key) => key.replace("gdrive/", ""));

  //     // バックエンド経由でダウンロード
  //     const downloadPromises = fileIds.map(async (fileId) => {
  //       const response = await fetch(
  //         `${process.env.NEXT_PUBLIC_API_BASE}${ENDPOINTS.DRIVE.DOWNLOAD}/${fileId}`,
  //         { credentials: "include" }
  //       );

  //       if (!response.ok) {
  //         throw new Error(`Failed to download file: ${response.statusText}`);
  //       }

  //       // ArrayBufferからBlobに変換して返す
  //       return new Blob([await response.arrayBuffer()], {
  //         type: response.headers.get("content-type") || "application/octet-stream"
  //       });
  //     });

  //     console.log("Downloaded from GDrive:", downloadPromises);

  //     return Promise.all(downloadPromises);
  //   } catch (error) {
  //     console.error("Error downloading from GDrive:", error);
  //     throw error;
  //   } finally {
  //     this.updateState({
  //       isDownloading: this.state.isDownloading.filter(
  //         (key) => !keys.includes(key)
  //       ),
  //     });
  //   }
  // }

  async download({ keys }: { keys: string[] }): Promise<Blob[]> {
    this.updateState({ isDownloading: [...this.state.isDownloading, ...keys] })
    try {
      const fileIds = keys.map((key) => key.replace("gdrive/", ""))

      // まずバックエンドからアクセストークンを取得
      const { accessToken } = await apiFetch<{ accessToken: string }>(ENDPOINTS.AUTH.TOKEN)

      const downloadPromises = fileIds.map(async (fileId) => {
        const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`

        // 取得したアクセストークンをAuthorizationヘッダーに設定
        const response = await fetch(downloadUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        })

        if (!response.ok) {
          throw new Error(`Failed to download file: ${response.statusText}`)
        }

        return response.blob()
      })

      return Promise.all(downloadPromises)
    } catch (error) {
      console.error("Error downloading from GDrive:", error)
      throw error
    } finally {
      this.updateState({
        isDownloading: this.state.isDownloading.filter((key) => !keys.includes(key)),
      })
    }
  }

  async publishFolder(folderId: string): Promise<void> {
    try {
      await apiFetch<{ success: boolean }>(ENDPOINTS.DRIVE.PUBLISH, {
        method: "POST",
        body: JSON.stringify({ folderId }),
      })
    } catch (error) {
      console.error("Error sharing folder:", error)
      throw error
    }
  }

  async publishFile(fileId: string): Promise<void> {
    try {
      await apiFetch<{ success: boolean }>(ENDPOINTS.DRIVE.PUBLISH, {
        method: "POST",
        body: JSON.stringify({ fileId }),
      })
    } catch (error) {
      console.error("Error sharing file:", error)
      throw error
    }
  }

  private openAuthWindow(queryParams: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const width = 600
      const height = 600
      const left = window.screen.width / 2 - width / 2
      const top = window.screen.height / 2 - height / 2

      const windowFeatures = [
        `width=${width}`,
        `height=${height}`,
        `left=${left}`,
        `top=${top}`,
        "toolbar=no",
        "menubar=no",
        "location=yes",
        "status=no",
        "popup=yes", // ポップアップとして明示的に指定
      ].join(",")

      const authUrl = `${process.env.NEXT_PUBLIC_API_BASE}${ENDPOINTS.AUTH.ON}?${queryParams}`
      this.authWindow = window.open(authUrl, "google-auth-window", windowFeatures)

      if (!this.authWindow) {
        reject(new Error("ポップアップがブロックされました。ブラウザの設定を確認してください。"))
        return
      }

      const messageHandler = async (event: MessageEvent) => {
        if (event.data === "google-auth-success") {
          window.removeEventListener("message", messageHandler)
          return resolve()
        } else {
          console.error("認証処理エラー:", event.data)
          reject(new Error("認証に失敗しました"))
        }
      }

      window.addEventListener("message", messageHandler)

      // タイムアウト処理
      setTimeout(() => {
        window.removeEventListener("message", messageHandler)
        reject(new Error("認証がタイムアウトしました"))
      }, 300000) // 5分でタイムアウト
    })
  }
}

const useGDrive = (
  storageOptions?: GDriveOptions,
): {
  gdrive: GDriveManager
  gdriveState: CloudState
} => {
  const [gdriveState, setGDriveState] = useState<CloudState>({
    isChecking: false,
    isUploading: [],
    isDownloading: [],
    isDeleting: [],
    isConnected: false,
  })

  const options = storageOptions || {
    endpoint: process.env.NEXT_PUBLIC_API_BASE || "",
  }

  const [gdrive] = useState(() => new GDriveManager(setGDriveState, options))

  return {
    gdrive,
    gdriveState,
  }
}

export { useGDrive }
