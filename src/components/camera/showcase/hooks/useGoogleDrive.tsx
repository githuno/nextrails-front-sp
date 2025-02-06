import { useState, useCallback, useEffect, useRef } from 'react';

export interface GoogleDriveState {
  isConnected: boolean;
  isUploading: boolean;
  isChecking: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

// APIリクエストのベース設定
const apiFetch = (path: string, options: RequestInit = {}) => {
  const baseOptions: RequestInit = {
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
    },
  };

  // Content-Typeを設定（FormDataの場合は設定しない）
  if (!(options.body instanceof FormData)) {
    baseOptions.headers = {
      ...baseOptions.headers,
      'Content-Type': 'application/json',
    };
  }

  return fetch(`${API_BASE}${path}`, {
    ...baseOptions,
    ...options,
    headers: {
      ...baseOptions.headers,
      ...options.headers,
    },
  });
};

export const useGoogleDrive = () => {
  const [state, setState] = useState<GoogleDriveState>({
    isConnected: false,
    isUploading: false,
    isChecking: false,
  });
  const [authWindow, setAuthWindow] = useState<Window | null>(null);
  const checkingRef = useRef(false);
  const isInitialCheckRef = useRef(true);

  // 認証状態の確認
  const checkConnection = useCallback(async (force = false) => {
    if (checkingRef.current && !force) {
      return state.isConnected;
    }

    try {
      checkingRef.current = true;
      setState(prev => ({ ...prev, isChecking: true }));
      
      const response = await apiFetch('/auth/google/status');
      
      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`);
      }

      const data = await response.json();
      
      setState(prev => ({ 
        ...prev, 
        isConnected: data.isConnected,
        isChecking: false
      }));

      checkingRef.current = false;
      return data.isConnected;
    } catch (error) {
      console.error('Failed to check Google Drive connection:', error);
      setState(prev => ({ 
        ...prev, 
        isConnected: false,
        isChecking: false 
      }));
      checkingRef.current = false;
      return false;
    }
  }, [state.isConnected]);

  // 認証状態の変更を監視
  useEffect(() => {
    if (!authWindow) return;

    let authCheckInterval: NodeJS.Timeout | null = null;
    let closeCheckInterval: NodeJS.Timeout | null = null;

    const handleMessage = async (event: MessageEvent) => {
      const allowedOrigins = [
        'http://localhost:3000',
        'https://mac-hono.tail55100.ts.net:10000'
      ];
      if (!allowedOrigins.includes(event.origin)) return;

      if (event.data === 'google-auth-success') {
        // ウィンドウを閉じる前に少し待つ
        setTimeout(() => {
          try {
            if (authWindow && !authWindow.closed) {
              authWindow.close();
            }
          } catch (e) {
            console.log('Window close blocked, letting it close itself');
          }
          setAuthWindow(null);
        }, 1000);

        // 認証状態をチェック（複数回試行）
        let attempts = 0;
        authCheckInterval = setInterval(async () => {
          const isConnected = await checkConnection(true);
          if (isConnected || attempts >= 3) {
            if (authCheckInterval) {
              clearInterval(authCheckInterval);
            }
          }
          attempts++;
        }, 1000);
      }
    };

    // ポップアップが閉じられたことを検知
    closeCheckInterval = setInterval(() => {
      if (authWindow.closed) {
        setAuthWindow(null);
        if (closeCheckInterval) {
          clearInterval(closeCheckInterval);
        }
        // ウィンドウが閉じられた後に認証状態を確認
        setTimeout(() => checkConnection(true), 1000);
      }
    }, 500);

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      if (authCheckInterval) clearInterval(authCheckInterval);
      if (closeCheckInterval) clearInterval(closeCheckInterval);
    };
  }, [authWindow, checkConnection]);

  // 初回マウント時のみ認証状態をチェック
  useEffect(() => {
    if (isInitialCheckRef.current) {
      checkConnection(true);
      isInitialCheckRef.current = false;
    }
  }, [checkConnection]);

  // 認証ポップアップを開く
  const openAuthWindow = useCallback(() => {
    if (authWindow) return;

    const width = 600;
    const height = 600;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    // 新しいウィンドウを開く前に状態をリセット
    setState(prev => ({ ...prev, isConnected: false }));

    const popup = window.open(
      `${API_BASE}/auth/google/start`,
      'GoogleAuth',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    if (popup) {
      setAuthWindow(popup);
      // フォーカスを試みる
      try {
        popup.focus();
      } catch (e) {
        console.log('Could not focus popup window');
      }
    }
  }, [authWindow]);

  const uploadToGoogleDrive = useCallback(async (imageset: { name: string, files: File[] }) => {
    // アップロード前に認証状態を再確認
    const isConnected = await checkConnection(true);
    if (!isConnected) {
      console.error('Not connected to Google Drive');
      return { success: false, error: 'Not connected to Google Drive' };
    }

    try {
      setState(prev => ({ ...prev, isUploading: true }));

      // フォルダを作成または検索
      const createFolderResponse = await apiFetch('/google/drive/folder', {
        method: 'POST',
        body: JSON.stringify({ name: imageset.name }),
      });

      if (!createFolderResponse.ok) throw new Error('Failed to create/find folder');
      const { folderId, isExisting } = await createFolderResponse.json();

      console.log(`Using ${isExisting ? 'existing' : 'new'} folder:`, folderId);

      // 画像をアップロード
      const uploadPromises = imageset.files.map(async file => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folderId', folderId);

        const response = await apiFetch('/google/drive/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) throw new Error(`Failed to upload ${file.name}`);
        return response.json();
      });

      const uploadResults = await Promise.all(uploadPromises);

      // フォルダを共有設定に変更
      await apiFetch('/google/drive/share', {
        method: 'POST',
        body: JSON.stringify({ folderId }),
      });

      setState(prev => ({ ...prev, isUploading: false }));
      return { 
        success: true, 
        isExisting,
        folderId,
        uploadResults 
      };
    } catch (error) {
      console.error('Failed to upload to Google Drive:', error);
      setState(prev => ({ ...prev, isUploading: false }));
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }, [checkConnection]);

  return {
    state,
    checkConnection,
    openAuthWindow,
    uploadToGoogleDrive,
  };
};