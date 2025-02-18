import React from "react";
import { Modal } from "@/components/atoms";
import { LoadingSpinner } from "@/components/camera/_utils";

interface NotionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: () => Promise<void>;
  isConnected: boolean;
  onPageSelect: (pageId: string) => void;
  pages: Array<{
    id: string;
    title: string;
  }>;
}

export const NotionModal: React.FC<NotionModalProps> = ({
  isOpen,
  onClose,
  onConnect,
  isConnected,
  onPageSelect,
  pages,
}) => {
  const [isLoading, setIsLoading] = React.useState(false);

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      await onConnect();
    } catch (error) {
      console.error("Failed to connect:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="bg-transparent">
      <div className="rounded-lg p-4 bg-white/80 shadow-lg min-w-[300px]">
        <h2 className="text-lg font-bold mb-4">Notionと連携</h2>
        {!isConnected ? (
          <div>
            <p className="mb-4">
              画像をアップロードするためにNotionと連携する必要があります。
            </p>
            <button
              className="bg-black text-white px-4 py-2 rounded-md w-full disabled:opacity-50"
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
                <p className="text-center text-gray-500 py-4">
                  ページが見つかりません
                </p>
              ) : (
                pages.map((page) => (
                  <button
                    key={page.id}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded-md mb-2 transition-colors"
                    onClick={() => {
                      onPageSelect(page.id);
                      onClose();
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
  );
};
