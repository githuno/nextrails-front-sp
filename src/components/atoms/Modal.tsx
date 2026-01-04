// https://www.notion.so/UI-HTML-dialog-ICS-MEDIA-2a6565e97d7c812db74fe5a9ce73bc6a

import { useIsClient } from "@/hooks/useIsClient"
import {
  createContext,
  FC,
  HTMLAttributes,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react"
import { createPortal } from "react-dom"
import { CloseIcon } from "../camera/_utils"

// TODO: ESC,領域外クリックで閉じるモードを追加

interface ModalContextType {
  isOpen: boolean
}

const ModalContext = createContext<ModalContextType>({
  isOpen: false,
})

const useModal = () => {
  return useContext(ModalContext)
}

interface ModalProps extends HTMLAttributes<HTMLDialogElement> {
  isOpen: boolean
  onClose: () => void // TODO: オプショナルに変更し、渡されなかったらcloseアイコンは表示しない
  children: ReactNode
  backdropClassName?: string
  hideCloseButton?: boolean
}

const Modal: FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  className,
  backdropClassName,
  hideCloseButton = false,
  ...props
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const isClient = useIsClient()

  const handleOpen = useCallback(() => {
    if (dialogRef.current) {
      dialogRef.current.showModal() // ダイアログを開く
      // body要素にoverflow: hiddenを設定するとモーダル表示時に背景がスクロールしなくなる
      document.body.style.overflow = "hidden"
    }
  }, [])

  // .contains()を使った領域外クリックで閉じるモード
  // useEffect(() => {
  //   function handleClickOutside(event: MouseEvent) {
  //     if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) {
  //       onClose();
  //     }
  //   }
  //   document.addEventListener("click", handleClickOutside);
  //   return () => document.removeEventListener("click", handleClickOutside);
  // }, [onClose]);

  const handleClose = useCallback(() => {
    if (dialogRef.current) {
      dialogRef.current.close() // ダイアログを閉じる
      document.body.style.overflow = "" // body要素のoverflow: hiddenを戻す
    }
    onClose()
  }, [onClose])

  const contextValue = useMemo(() => ({ isOpen }), [isOpen])

  useEffect(() => {
    if (isOpen) {
      handleOpen()
    } else if (!isOpen && dialogRef.current?.open) {
      handleClose()
    }
  }, [handleOpen, handleClose, isOpen])

  if (!isClient) return null

  return createPortal(
    <ModalContext.Provider value={contextValue}>
      <dialog
        ref={dialogRef}
        className={`fixed inset-0 m-auto overflow-hidden bg-transparent p-2 select-none backdrop:transition-opacity ${backdropClassName || "backdrop:bg-black/80 backdrop:backdrop-blur-sm"} ${className || ""}`}
        {...props}
      >
        <div className="relative h-full w-full">
          {!hideCloseButton && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleClose()
              }}
              className="relative -top-2 right-2 z-50 float-right -ml-8 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/50 shadow-lg backdrop-blur-md transition-all hover:scale-110 hover:bg-white/80 active:scale-95"
            >
              <CloseIcon />
            </button>
          )}
          {children}
        </div>
      </dialog>
    </ModalContext.Provider>,
    document.body,
  )
}

export { Modal, useModal }
