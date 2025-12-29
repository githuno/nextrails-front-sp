import React, { createContext, useCallback, useContext, useState } from "react"
import { createPortal } from "react-dom"

const POSITION = "bottom-right"
const DURATION = 5000

// 位置の型を追加
export type ToastPosition = "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center" | "bottom-center"

// トースト通知の種類
export type ToastType = "info" | "success" | "error"

// トースト通知の状態
export interface ToastState {
  id: string
  message: string
  isVisible: boolean
  type: ToastType
  position?: ToastPosition
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface ToastProps {
  toast: ToastState
  onRemove: (id: string) => void
}

// トーストの位置によってグループ化するヘルパー関数を追加
const groupToastsByPosition = (toasts: ToastState[]) => {
  return toasts.reduce(
    (acc, toast) => {
      const position = toast.position || POSITION
      if (!acc[position]) {
        acc[position] = []
      }
      acc[position].push(toast)
      return acc
    },
    {} as Record<ToastPosition, ToastState[]>,
  )
}

// トーストポータルコンポーネントを修正
const ToastPortal: React.FC<{
  position: ToastPosition
  toasts: ToastState[]
  onRemove: (id: string) => void
}> = ({ position, toasts, onRemove }) => {
  // 位置に応じたスタイルを定義
  const containerStyles = {
    "top-right": "top-0 right-0",
    "top-left": "top-0 left-0",
    "bottom-right": "bottom-0 right-0",
    "bottom-left": "bottom-0 left-0",
    "top-center": "top-0 left-1/2 -translate-x-1/2",
    "bottom-center": "bottom-0 left-1/2 -translate-x-1/2",
  }[position]

  return (
    <div className={`fixed ${containerStyles} pointer-events-none flex flex-col gap-2 p-4`}>
      {toasts.map((toast, index) => (
        <Toast key={toast.id} toast={toast} onRemove={onRemove} index={index} />
      ))}
    </div>
  )
}

// Toast コンポーネント
const Toast: React.FC<ToastProps & { index: number }> = ({ toast, onRemove, index }) => {
  const { message, type, position = POSITION, action } = toast

  const backgroundColor = {
    info: "bg-blue-500",
    success: "bg-green-500",
    error: "bg-red-500",
  }[type]

  // インデックスに基づく垂直方向のオフセット
  const offset = `${index * 4}rem`

  // 位置に応じたスタイルを定義
  const positionStyles = {
    "top-right": "top-4 right-4",
    "top-left": "top-4 left-4",
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "top-center": "top-4 left-1/2 -translate-x-1/2",
    "bottom-center": "bottom-4 left-1/2 -translate-x-1/2",
  }[position]

  // 位置に応じたアニメーションクラスを定義
  const animationClass = {
    "top-right": "animate-slide-in-right",
    "top-left": "animate-slide-in-left",
    "bottom-right": "animate-slide-in-right",
    "bottom-left": "animate-slide-in-left",
    "top-center": "animate-slide-in-down",
    "bottom-center": "animate-slide-in-up",
  }[position]

  // アクションボタンのクリックハンドラ
  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation() // トースト自体のクリックイベントが発火するのを防止

    if (action?.onClick) {
      action.onClick()
    }

    onRemove(toast.id) // アクション実行後にトーストを閉じる
  }

  return (
    <div
      style={{
        marginTop: position.startsWith("top") ? offset : undefined,
        marginBottom: position.startsWith("bottom") ? offset : undefined,
      }}
      className={`fixed ${positionStyles} pointer-events-auto rounded-md px-4 py-2 text-white ${backgroundColor} shadow-lg transition-all duration-300 ${animationClass} flex items-center justify-between`}
      onClick={() => onRemove(toast.id)}
    >
      <div>{message}</div>

      {action && (
        <button
          onClick={handleActionClick}
          className="bg-opacity-20 hover:bg-opacity-30 ml-4 rounded bg-white px-3 py-1 text-sm font-medium transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

// トーストコンテキストの型定義
interface ToastContextType {
  showToast: (message: string, options?: Partial<Omit<ToastState, "id" | "isVisible">>) => void
  showError: (error: Error | string, options?: Partial<Omit<ToastState, "id" | "isVisible" | "type">>) => void
  showSuccess: (message: string, options?: Partial<Omit<ToastState, "id" | "isVisible" | "type">>) => void
  showInfo: (message: string, options?: Partial<Omit<ToastState, "id" | "isVisible" | "type">>) => void
}

// トーストコンテキストの作成
const ToastContext = createContext<ToastContextType | null>(null)

// トーストプロバイダーコンポーネント
const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastState[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback(
    (message: string, options: Partial<Omit<ToastState, "id" | "isVisible">> = {}) => {
      const id = Math.random().toString(36).substring(2, 9)
      const newToast: ToastState = {
        id,
        message,
        isVisible: true,
        type: options.type || "info",
        position: options.position || POSITION,
        duration: options.duration || DURATION,
        action: options.action,
      }

      setToasts((prev) => [...prev, newToast])

      setTimeout(() => {
        removeToast(id)
      }, newToast.duration)
    },
    [removeToast],
  )

  const showError = useCallback(
    (error: Error | string, options?: Partial<Omit<ToastState, "id" | "isVisible" | "type">>) => {
      const message = error instanceof Error ? error.message : error
      showToast(message, { ...options, type: "error" })
    },
    [showToast],
  )

  const showSuccess = useCallback(
    (message: string, options?: Partial<Omit<ToastState, "id" | "isVisible" | "type">>) => {
      showToast(message, { ...options, type: "success" })
    },
    [showToast],
  )

  const showInfo = useCallback(
    (message: string, options?: Partial<Omit<ToastState, "id" | "isVisible" | "type">>) => {
      showToast(message, { ...options, type: "info" })
    },
    [showToast],
  )

  const toastPortal =
    typeof document !== "undefined"
      ? createPortal(
          <>
            {Object.entries(groupToastsByPosition(toasts)).map(([position, positionToasts]) => (
              <ToastPortal
                key={position}
                position={position as ToastPosition}
                toasts={positionToasts}
                onRemove={removeToast}
              />
            ))}
          </>,
          document.body,
        )
      : null

  return (
    <ToastContext.Provider value={{ showToast, showError, showSuccess, showInfo }}>
      {children}
      {toastPortal}
    </ToastContext.Provider>
  )
}

// カスタムフック
const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}

export { ToastProvider, useToast }
