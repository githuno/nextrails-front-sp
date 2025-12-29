import { Modal } from "@/components/atoms"
import { LoadingSpinner } from "@/components/camera/_utils"
import React from "react"

interface NotionModalProps {
  isOpen: boolean
  onClose: () => void
  onConnect: () => Promise<void>
  isConnected: boolean
  onPageSelect: (pageId: string) => void
  pages: Array<{
    id: string
    title: string
  }>
}

export const NotionModal: React.FC<NotionModalProps> = ({
  isOpen,
  onClose,
  onConnect,
  isConnected,
  onPageSelect,
  pages,
}) => {
  const [isLoading, setIsLoading] = React.useState(false)

  const handleConnect = async () => {
    setIsLoading(true)
    try {
      await onConnect()
    } catch (error) {
      console.error("Failed to connect:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="bg-transparent">
      <div className="min-w-[300px] rounded-lg bg-white/80 p-4 shadow-lg">
        <h2 className="mb-4 text-lg font-bold">Notionと連携</h2>
        {!isConnected ? (
          <div>
            <p className="mb-4">画像をアップロードするためにNotionと連携する必要があります。</p>
            <button
              className="w-full rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
              onClick={handleConnect}
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <LoadingSpinner size="20px" />
                  <span>確認中...</span>
                </div>
              ) : (
                "Notionと連携する"
              )}
            </button>
          </div>
        ) : (
          <div>
            <p className="mb-4">アップロード先のページを選択してください。</p>
            <div className="max-h-[300px] overflow-y-auto">
              {pages.length === 0 ? (
                <p className="py-4 text-center text-gray-500">ページが見つかりません</p>
              ) : (
                pages.map((page) => (
                  <button
                    key={page.id}
                    className="mb-2 w-full rounded-md px-4 py-2 text-left transition-colors hover:bg-gray-100"
                    onClick={() => {
                      onPageSelect(page.id)
                      onClose()
                    }}
                  >
                    {page.title}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
