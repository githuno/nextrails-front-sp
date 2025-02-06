import React from 'react';
import { Modal } from '@/components';
import { useGoogleDrive } from './hooks/useGoogleDrive';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const GoogleDriveModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { openAuthWindow, state } = useGoogleDrive();

  const handleConnect = () => {
    // ポップアップウィンドウで認証を実行
    openAuthWindow();
    // モーダルを閉じる
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6 max-w-sm mx-auto">
        <h3 className="text-xl font-bold mb-4">Googleドライブと連携</h3>
        <p className="mb-4">
          画像をGoogleドライブにアップロードするには、アカウントの連携が必要です。
        </p>
        {state.isChecking ? (
          <div className="text-center text-gray-600">認証状態を確認中...</div>
        ) : !state.isConnected ? (
          <button
            onClick={handleConnect}
            className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
          >
            Googleアカウントと連携する
          </button>
        ) : (
          <div className="text-center text-green-600">
            Googleドライブと連携済みです
          </div>
        )}
      </div>
    </Modal>
  );
};