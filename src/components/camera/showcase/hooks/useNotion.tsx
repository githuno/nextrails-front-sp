import { useState, useCallback } from "react";
import { type File } from "@/components/camera";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  "https://mac-hono.tail55100.ts.net:10000/api";

interface NotionState {
  isConnected: boolean;
  selectedPageId: string | null;
  pages: Array<{
    id: string;
    title: string;
  }>;
}

export const useNotion = () => {
  const [notionState, setNotionState] = useState<NotionState>({
    isConnected: false,
    selectedPageId: null,
    pages: [],
  });

  const fetchPages = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/notion/pages`);
      const data = await response.json();

      if (data.success) {
        setNotionState((prev) => ({
          ...prev,
          pages: data.data,
          isConnected: true,
        }));
      } else {
        throw new Error(data.error || "Failed to fetch pages");
      }
    } catch (error) {
      console.error("Failed to fetch Notion pages:", error);
      throw error;
    }
  }, []);

  const connectNotion = useCallback(async () => {
    try {
      await fetchPages();
    } catch (error) {
      console.error("Failed to connect to Notion:", error);
      throw error;
    }
  }, [fetchPages]);

  const selectPage = useCallback((pageId: string) => {
    setNotionState((prev) => ({
      ...prev,
      selectedPageId: pageId,
    }));
  }, []);

  const uploadImagesToNotion = useCallback(
    async (files: File[]) => {
      if (!notionState.isConnected || !notionState.selectedPageId) {
        throw new Error("Notion is not connected or no page is selected");
      }

      try {
        const validFiles = files.filter((file) => !file.deletedAt);
        if (validFiles.length === 0) {
          throw new Error("No valid images to upload");
        }

        // R2のkeyを使用して画像情報を準備
        const images = validFiles.map((file) => {
          if (!file.key) {
            throw new Error(
              `R2 key not found for file: ${file.filename || "untitled"}`
            );
          }

          return {
            url: file.key,
            filename: file.filename || "untitled",
          };
        });

        const response = await fetch(`${API_BASE}/notion/upload`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pageId: notionState.selectedPageId,
            images,
          }),
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to upload images");
        }

        return data;
      } catch (error) {
        console.error("Failed to upload images to Notion:", error);
        throw error;
      }
    },
    [notionState]
  );

  return {
    notionState,
    connectNotion,
    selectPage,
    uploadImagesToNotion,
  };
};
