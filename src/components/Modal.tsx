import {
  FC,
  ReactNode,
  useRef,
  HTMLAttributes,
  RefObject,
  useMemo,
  createContext,
  useContext,
  useEffect,
} from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "./camera/_utils";

type BeforeOpenHandler = () => Promise<boolean>;
type BeforeCloseHandler = () => Promise<boolean>;

interface ModalContextType {
  registerBeforeOpen: (handler: BeforeOpenHandler) => () => void;
  registerBeforeClose: (handler: BeforeCloseHandler) => () => void;
}

const ModalContext = createContext<ModalContextType>({
  registerBeforeOpen: () => () => {},
  registerBeforeClose: () => () => {},
});

const useModal = () => {
  return useContext(ModalContext);
};

interface ModalProps extends HTMLAttributes<HTMLDialogElement> {
  isOpen: boolean;
  onClose: () => void; // TODO: オプショナルに変更し、渡されなかったらcloseアイコンは表示しない
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
  const beforeOpenHandlers = useRef<BeforeOpenHandler[]>([]);
  const beforeCloseHandlers = useRef<BeforeCloseHandler[]>([]);

  const registerBeforeOpen = (handler: BeforeOpenHandler) => {
    beforeOpenHandlers.current.push(handler);
    return () => {
      beforeOpenHandlers.current = beforeOpenHandlers.current.filter(
        (h) => h !== handler
      );
    };
  };

  const registerBeforeClose = (handler: BeforeCloseHandler) => {
    beforeCloseHandlers.current.push(handler);
    return () => {
      beforeCloseHandlers.current = beforeCloseHandlers.current.filter(
        (h) => h !== handler
      );
    };
  };

  const handleOpen = async () => {
    // ダイアログを開く前に実行する処理
    for (const handler of beforeOpenHandlers.current) {
      const canOpen = await handler();
      if (!canOpen) return;
    }

    if (dialogRef.current) {
      // ダイアログを開く
      dialogRef.current.showModal();
      // body要素にoverflow: hiddenを設定するとモーダル表示時に背景がスクロールしなくなる
      document.body.style.overflow = "hidden";
    }
  };

  const handleClose = async () => {
    // ダイアログを閉じる前に実行する処理
    for (const handler of beforeCloseHandlers.current) {
      const canClose = await handler();
      if (!canClose) return;
    }

    if (dialogRef.current) {
      // ダイアログを閉じる
      dialogRef.current?.close();
      // body要素のoverflow: hiddenを戻す
      document.body.style.overflow = "";
      // ボタンのフォーカスを外す
      // document.activeElement instanceof HTMLElement && document.activeElement.blur()
    }
    onClose();
  };

  const contextValue = useMemo(
    () => ({
      registerBeforeOpen,
      registerBeforeClose,
    }),
    []
  );

  useEffect(() => {
    if (isOpen) {
      handleOpen();
    } else if (!isOpen && dialogRef.current?.open) {
      handleClose();
    }
  }, [isOpen]);

  return createPortal(
    <ModalContext.Provider value={contextValue}>
      {/* モーダル外背景色の設定 */}
      {isOpen && <div className="fixed inset-0 bg-black/50" />}

      <dialog ref={dialogRef} className={`modal ${className}`} {...props}>
        <div className="relative p-2 h-full">
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
    </ModalContext.Provider>,
    document.body
  );
};

export { Modal, useModal };
