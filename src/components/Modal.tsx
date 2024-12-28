import { FC, ReactNode, useRef } from "react";
import { createPortal } from "react-dom";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
};

const Modal: FC<ModalProps> = ({ isOpen, onClose, children }) => {
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
    <dialog ref={dialogRef} className="modal rounded-lg shadow-xl">
      {children}
      <button onClick={handleClose} className="bg-slate-300 cursor-pointer">
        閉じる
      </button>
    </dialog>,
    document.body
  );
};

export { Modal };
