import { FC, ReactNode, useRef, HTMLAttributes, RefObject } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "./camera/_utils";

interface ModalProps extends HTMLAttributes<HTMLDialogElement> {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  anchorRef?: RefObject<HTMLElement>; // 基準位置を明示的に受け取る場合に使用
}

const Modal: FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  className,
  anchorRef,
  ...props
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const handleOpen = () => {
    if (dialogRef.current) {
      dialogRef.current.showModal();
      document.body.style.overflow = "hidden";
    }
  };

  const handleClose = () => {
    if (dialogRef.current) {
      dialogRef.current.close();
      document.body.style.overflow = "";
      onClose();
    }
  };

  if (isOpen) {
    handleOpen();
  } else if (!isOpen && dialogRef.current?.open) {
    handleClose();
  }

  return createPortal(
    <>
      {/* モーダル外背景色の設定 */}
      {isOpen && <div className="fixed inset-0 bg-black/50" />}

      <dialog ref={dialogRef} className={`modal ${className}`} {...props}>
        <div className="relative p-2">
          {children}

          <button
            onClick={handleClose}
            className="absolute bg-white/50 cursor-pointer rounded-full shadow-md hover:shadow-lg transition-transform"
            style={{
              top: anchorRef?.current?.offsetTop ?? 0,
              right: anchorRef?.current?.offsetWidth ?? 0,
            }}
          >
            <CloseIcon />
          </button>
        </div>
      </dialog>
    </>,
    document.body
  );
};

export { Modal };
