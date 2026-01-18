import { FC, HTMLAttributes, ReactNode } from "react"

// https://codepen.io/tak-dcxi/pen/RNPvmQr
// https://www.notion.so/UI-HTML-dialog-ICS-MEDIA-2a6565e97d7c812db74fe5a9ce73bc6a

const CloseIcon = ({ size = "h-5 w-5", color = "bg-current" }: { size?: string; color?: string }) => (
  <div className={`relative ${size}`}>
    <span
      className={`absolute top-1/2 left-1/2 h-0.5 w-full -translate-x-1/2 -translate-y-1/2 rotate-45 transform ${color}`}
    ></span>
    <span
      className={`absolute top-1/2 left-1/2 h-0.5 w-full -translate-x-1/2 -translate-y-1/2 -rotate-45 transform ${color}`}
    ></span>
  </div>
)

interface ModalProps extends HTMLAttributes<HTMLDialogElement> {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  hideCloseButton?: boolean
  closeOnBackdropClick?: boolean
}

/**
 * - useEffect / Context を完全に排除し Ref Callback で同期
 * - createPortal を廃止し Top Layer API を活用
 * - CSS :has() セレクタによるスクロールロック
 */
const Modal: FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  className = "",
  hideCloseButton = false,
  closeOnBackdropClick = false,
  ...props
}) => {
  return (
    <>
      <style>{`
        /* JSレスなスクロールロック */
        body:has(dialog[open]) { overflow: hidden; scrollbar-gutter: stable; }

        /* モダンなTop Layerアニメーション */
        dialog {
          transition: 
            display 0.4s allow-discrete, 
            overlay 0.4s allow-discrete, 
            opacity 0.4s ease-out,
            transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          opacity: 0; 
          transform: scale(0.95) translateY(10px);
        }
        dialog[open] { 
          opacity: 1; 
          transform: scale(1) translateY(0);
        }
        @starting-style { 
          dialog[open] { 
            opacity: 0; 
            transform: scale(0.95) translateY(10px); 
          } 
        }

        dialog::backdrop {
          transition: 
            display 0.4s allow-discrete, 
            overlay 0.4s allow-discrete, 
            background-color 0.4s,
            backdrop-filter 0.4s;
          background-color: rgb(0 0 0 / 0); 
          backdrop-filter: blur(0);
        }
        dialog[open]::backdrop { 
          background-color: rgb(0 0 0 / 0.7); 
          backdrop-filter: blur(4px); 
        }
        @starting-style { 
          dialog[open]::backdrop { 
            background-color: rgb(0 0 0 / 0); 
            backdrop-filter: blur(0);
          } 
        }
      `}</style>
      <dialog
        {...props}
        className={`pointer-events-auto fixed inset-0 m-auto overflow-visible border-none bg-transparent p-0 outline-none ${className}`}
        style={{ pointerEvents: "auto" }}
        /* Refで初期化・同期。React 19以降のJS-Liteパターン */
        ref={(node) => {
          if (!node) return
          if (isOpen && !node.open) node.showModal()
          else if (!isOpen && node.open) node.close()
        }}
        /* ESCキーやブラウザバックでの閉じ動作をReact側に同期 */
        onCancel={(e) => {
          e.preventDefault()
          onClose()
        }}
        /* 背景クリックで閉じる(dialog要素自体のクリック判定) */
        onMouseDown={(e) => {
          if (closeOnBackdropClick && e.target === e.currentTarget) onClose()
        }}
      >
        <div className="pointer-events-auto relative h-full w-full">
          {!hideCloseButton && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onClose()
              }}
              className="relative -top-2 right-2 z-50 float-right -ml-8 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/50 shadow-lg backdrop-blur-md transition-all hover:scale-110 hover:bg-white/80 active:scale-95"
            >
              <CloseIcon />
            </button>
          )}
          {children}
        </div>
      </dialog>
    </>
  )
}

export { Modal }
