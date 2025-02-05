import { useState, useCallback } from 'react';
import { type File } from '../../index';
import { type IdbFile } from '../../_utils/useIdb';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://mac-hono.tail55100.ts.net:10000/api';

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
    pages: []
  });

  const fetchPages = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/notion/pages`);
      const data = await response.json();
      
      if (data.success) {
        setNotionState(prev => ({
          ...prev,
          pages: data.data,
          isConnected: true
        }));
      } else {
        throw new Error(data.error || 'Failed to fetch pages');
      }
    } catch (error) {
      console.error('Failed to fetch Notion pages:', error);
      throw error;
    }
  }, []);

  const connectNotion = useCallback(async () => {
    try {
      await fetchPages();
    } catch (error) {
      console.error('Failed to connect to Notion:', error);
      throw error;
    }
  }, [fetchPages]);

  const selectPage = useCallback((pageId: string) => {
    setNotionState(prev => ({
      ...prev,
      selectedPageId: pageId
    }));
  }, []);

  const uploadImagesToNotion = useCallback(async (files: File[], idb: any, storeName: string) => {
    if (!notionState.isConnected || !notionState.selectedPageId) {
      throw new Error('Notion is not connected or no page is selected');
    }

    try {
      const validFiles = files.filter(file => !file.deletedAt);
      if (validFiles.length === 0) {
        throw new Error('No valid images to upload');
      }

      // IDBからファイル一覧を取得（idbUrlを含む）
      const idbFiles = await idb.get(storeName) as IdbFile[];
      if (!idbFiles) {
        throw new Error('No files found in IDB');
      }

      // IDBファイルとvalidFilesをマッピング
      const imagePromises = validFiles.map(async file => {
        const idbFile = idbFiles.find(f => f.idbId === file.idbId);
        if (!idbFile?.idbUrl) {
          throw new Error(`Failed to get image URL from IDB for file: ${file.idbId}`);
        }

        // Fetch blob from idbUrl
        const response = await fetch(idbFile.idbUrl);
        const blob = await response.blob();

        // blobをDataURLに変換
        const blobDataPromise = new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result;
            if (typeof result === 'string') {
              resolve(result);
            } else {
              reject(new Error('Failed to convert blob to data URL'));
            }
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });

        const dataUrl = await blobDataPromise;
        return {
          url: dataUrl,
          filename: file.filename || 'untitled'
        };
      });

      const images = await Promise.all(imagePromises);
      console.log('Prepared images for upload:', images.length);

      const response = await fetch(`${API_BASE}/notion/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pageId: notionState.selectedPageId,
          images
        })
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to upload images');
      }

      return data;
    } catch (error) {
      console.error('Failed to upload images to Notion:', error);
      throw error;
    }
  }, [notionState]);

  return {
    notionState,
    connectNotion,
    selectPage,
    uploadImagesToNotion
  };
};