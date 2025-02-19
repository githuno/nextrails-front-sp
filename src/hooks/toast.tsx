import React, { useState, useCallback } from "react";
import { createPortal } from "react-dom";

// トースト通知の種類
export type ToastType = "info" | "success" | "error";

// トースト通知の状態
export interface ToastState {
  message: string;
  isVisible: boolean;
  type: ToastType;
}

// トースト通知のコンポーネント
const Toast: React.FC<{ message: string; type: ToastType }> = ({
  message,
  type,
}) => {
  const backgroundColor = {
    info: "bg-blue-500",
    success: "bg-green-500",
    error: "bg-red-500",
  }[type];

  return (
    <div
      className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-md text-white ${backgroundColor} transition-opacity duration-300 shadow-lg z-50`}
    >
      {message}
    </div>
  );
};

// トースト通知のカスタムフック
export const useToast = () => {
  const [toast, setToast] = useState<ToastState>({
    message: "",
    isVisible: false,
    type: "info",
  });

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    setToast({ message, isVisible: true, type });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, isVisible: false }));
    }, 3000);
  }, []);

  const showError = useCallback(
    (error: Error | string) => {
      const message = error instanceof Error ? error.message : error;
      showToast(message, "error");
    },
    [showToast]
  );

  const showSuccess = useCallback(
    (message: string) => {
      showToast(message, "success");
    },
    [showToast]
  );

  const showInfo = useCallback(
    (message: string) => {
      showToast(message, "info");
    },
    [showToast]
  );

  // トースト通知のレンダリング
  const ToastPortal = useCallback(() => {
    if (!toast.isVisible) return null;

    return createPortal(
      <Toast message={toast.message} type={toast.type} />,
      document.body
    );
  }, [toast.isVisible, toast.message, toast.type]);

  return {
    showToast,
    showError,
    showSuccess,
    showInfo,
    ToastPortal,
  };
};
