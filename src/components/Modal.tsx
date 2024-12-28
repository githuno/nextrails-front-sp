import { FC, ReactNode, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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
      document.body.style.overflow = 'hidden';
    }
  };

  const handleClose = () => {
    if (dialogRef.current) {
      dialogRef.current.close();
      document.body.style.overflow = '';
      onClose();
    }
  };

  if (isOpen) {
    handleOpen();
  } else if (!isOpen && dialogRef.current?.open) {
    handleClose();
  }

  return createPortal(
    <dialog ref={dialogRef} className="modal">
      {children}
      <button
        onClick={handleClose}
        style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
      >
        閉じる
      </button>
    </dialog>,
    document.body
  );
};

export { Modal };