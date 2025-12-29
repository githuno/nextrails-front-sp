// https://www.notion.so/UI-HTML-dialog-ICS-MEDIA-2a6565e97d7c812db74fe5a9ce73bc6a

import {
  createContext,
  FC,
  HTMLAttributes,
  ReactNode,
  RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
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
  anchorRef?: RefObject<HTMLElement> // 基準位置を明示的に受け取る場合に使用
}

const Modal: FC<ModalProps> = ({ isOpen, onClose, children, className, anchorRef, ...props }) => {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [anchorPos, setAnchorPos] = useState({ top: 0, right: 0 })

  useEffect(() => {
    if (isOpen && anchorRef?.current) {
      setAnchorPos({
        top: anchorRef.current.offsetTop,
        right: anchorRef.current.offsetWidth,
      })
    }
  }, [isOpen, anchorRef])

  const handleOpen = async () => {
    if (dialogRef.current) {
      // ダイアログを開く
      dialogRef.current.showModal()
      // body要素にoverflow: hiddenを設定するとモーダル表示時に背景がスクロールしなくなる
      document.body.style.overflow = "hidden"
    }
  }

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

  const handleClose = useCallback(
    async (e?: React.MouseEvent<HTMLButtonElement>) => {
      if (e) {
        e.stopPropagation()
      }
      if (dialogRef.current) {
        // ダイアログを閉じる
        dialogRef.current?.close()
        // body要素のoverflow: hiddenを戻す
        document.body.style.overflow = ""
        // ボタンのフォーカスを外す
        // document.activeElement instanceof HTMLElement && document.activeElement.blur()
      }
      onClose()
    },
    [onClose],
  )

  const contextValue = useMemo(() => ({ isOpen }), [isOpen])

  useEffect(() => {
    if (isOpen) {
      handleOpen()
    } else if (!isOpen && dialogRef.current?.open) {
      handleClose()
    }
  }, [handleClose, isOpen])

  return createPortal(
    <ModalContext.Provider value={contextValue}>
      {/* モーダル外背景色の設定 */}
      {isOpen && <div className="fixed inset-0 bg-black/50" />}

      <dialog ref={dialogRef} className={`modal ${className}`} {...props}>
        <div className="relative h-full p-2">
          {children}

          <button
            onClick={handleClose}
            className="absolute cursor-pointer rounded-full bg-white/80 shadow-lg transition-transform hover:shadow-lg"
            style={{
              top: anchorPos.top,
              right: anchorPos.right,
            }}
          >
            <CloseIcon />
          </button>
        </div>
      </dialog>
    </ModalContext.Provider>,
    document.body,
  )
}

export { Modal, useModal }
