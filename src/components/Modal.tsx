import { FC, ReactNode, useRef, HTMLAttributes, RefObject } from "react";
import { createPortal } from "react-dom";

interface ModalProps extends HTMLAttributes<HTMLDialogElement> {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  anchorRef?: RefObject<HTMLElement>;
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
            <svg
              className="w-6 h-6 hover:w-7 hover:h-7 transition-transform"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M5.29289 5.29289C5.68342 4.90237 6.31658 4.90237 6.70711 5.29289L12 10.5858L17.2929 5.29289C17.6834 4.90237 18.3166 4.90237 18.7071 5.29289C19.0976 5.68342 19.0976 6.31658 18.7071 6.70711L13.4142 12L18.7071 17.2929C19.0976 17.6834 19.0976 18.3166 18.7071 18.7071C18.3166 19.0976 17.6834 19.0976 17.2929 18.7071L12 13.4142L6.70711 18.7071C6.31658 19.0976 5.68342 19.0976 5.29289 18.7071C4.90237 18.3166 4.90237 17.6834 5.29289 17.2929L10.5858 12L5.29289 6.70711C4.90237 6.31658 4.90237 5.68342 5.29289 5.29289Z"
                fill="#000000"
              />
            </svg>
          </button>
        </div>
      </dialog>
    </>,
    document.body
  );
};

export { Modal };
