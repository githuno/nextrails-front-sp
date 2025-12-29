import { type File } from "@/components/camera"
import { useStorage } from "@/components/storage"
import { useCallback, useState } from "react"
import { NotionModal } from "./NotionModal"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://mac-hono.tail55100.ts.net:10000/api"

interface NotionState {
  isConnected: boolean
  selectedPageId: string | null
  pages: Array<{
    id: string
    title: string
  }>
}

// クラウドプロバイダー用の公開URL取得インターフェース
interface PublicUrlProvider {
  isProviderFile: (key: string) => boolean
  getPublicUrl: (key: string, provider: any) => Promise<string>
  requiresPublishing?: boolean
}

// プロバイダーごとの公開URL取得ロジック
const publicUrlProviders: PublicUrlProvider[] = [
  {
    // Google Drive用
    isProviderFile: (key: string) => key.startsWith("gdrive/"),
    getPublicUrl: async (key: string, provider) => {
      const fileId = key.replace("gdrive/", "")
      const folderId = fileId.split("/")[0]

      if (provider.publishFolder) {
        const shouldPublish = await confirm(
          "Notionで画像を表示するには、Googleドライブのフォルダを公開設定にする必要があります。\n公開設定にしてもよろしいですか？",
        )
        if (!shouldPublish) {
          throw new Error("User cancelled folder publishing")
        }
        await provider.publishFolder(folderId)
      }

      return key
    },
    requiresPublishing: true,
  },
  // R2用 (デフォルトプロバイダー)
  {
    isProviderFile: (key: string) => !key.startsWith("gdrive/"),
    getPublicUrl: async (key: string) => key,
  },
]

const useNotion = () => {
  const [notionState, setNotionState] = useState<NotionState>({
    isConnected: false,
    selectedPageId: null,
    pages: [],
  })
  const { cloud } = useStorage()

  const fetchPages = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/notion/pages`)
      const data = await response.json()

      if (data.success) {
        setNotionState((prev) => ({
          ...prev,
          pages: data.data,
          isConnected: true,
        }))
      } else {
        throw new Error(data.error || "Failed to fetch pages")
      }
    } catch (error) {
      console.error("Failed to fetch Notion pages:", error)
      throw error
    }
  }, [])

  const connectNotion = useCallback(async () => {
    try {
      await fetchPages()
    } catch (error) {
      console.error("Failed to connect to Notion:", error)
      throw error
    }
  }, [fetchPages])

  const selectPage = useCallback((pageId: string) => {
    setNotionState((prev) => ({
      ...prev,
      selectedPageId: pageId,
    }))
  }, [])

  // ファイルの公開URLを取得する関数
  const getPublicUrl = useCallback(
    async (key: string) => {
      const provider = publicUrlProviders.find((p) => p.isProviderFile(key))
      if (!provider) {
        throw new Error(`Unsupported storage provider for key: ${key}`)
      }
      return provider.getPublicUrl(key, cloud.provider)
    },
    [cloud.provider],
  )

  const uploadImagesToNotion = useCallback(
    async (files: File[]) => {
      if (!notionState.isConnected || !notionState.selectedPageId) {
        throw new Error("Notion is not connected or no page is selected")
      }

      try {
        const validFiles = files.filter((file) => !file.deletedAt)
        if (validFiles.length === 0) {
          throw new Error("No valid images to upload")
        }

        // 各ファイルの公開URLを取得
        const imagePromises = validFiles.map(async (file) => {
          if (!file.key) {
            throw new Error(`Storage key not found for file: ${file.filename || "untitled"}`)
          }

          try {
            const publicUrl = await getPublicUrl(file.key)
            return {
              url: publicUrl,
              filename: file.filename || "untitled",
            }
          } catch (error) {
            console.error(`Failed to get public URL for file ${file.key}:`, error)
            throw error
          }
        })

        const images = await Promise.all(imagePromises)

        const response = await fetch(`${API_BASE}/notion/upload`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pageId: notionState.selectedPageId,
            images,
          }),
        })

        const data = await response.json()

        if (!data.success) {
          throw new Error(data.error || "Failed to upload images")
        }

        return data
      } catch (error) {
        console.error("Failed to upload images to Notion:", error)
        throw error
      }
    },
    [notionState, getPublicUrl],
  )

  return {
    notionState,
    connectNotion,
    selectPage,
    uploadImagesToNotion,
  }
}

export { NotionModal, useNotion }
