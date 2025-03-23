import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
} from "react";
import { useToast } from "./useToast";

interface ErrorBoundaryContextType {
  handleError: (error: unknown) => void;
  withErrorHandling: <T extends (...args: any[]) => Promise<any>>(
    fn: T
  ) => (...args: Parameters<T>) => Promise<ReturnType<T>>;
}

const ErrorBoundaryContext = createContext<ErrorBoundaryContextType | null>(
  null
);

export const ErrorBoundaryProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { showError } = useToast();

  const handleError = useCallback(
    (error: unknown) => {
      if (error instanceof Error) {
        showError(error);
      } else if (typeof error === "string") {
        showError(new Error(error));
      } else {
        showError(new Error("An unexpected error occurred"));
      }
    },
    [showError]
  );

  const withErrorHandling = useCallback(
    <T extends (...args: any[]) => Promise<any>>(fn: T) => {
      return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
        try {
          return await fn(...args);
        } catch (error) {
          handleError(error);
          throw error;
        }
      };
    },
    [handleError]
  );

  // グローバルエラーハンドリング
  useEffect(() => {
    // 未ハンドルのPromiseリジェクションを監視
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      handleError(event.reason);
    };

    // グローバルエラーを監視
    const handleGlobalError = (event: ErrorEvent) => {
      event.preventDefault();
      handleError(event.error);
    };

    // console.errorをオーバーライド
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      handleError(args[0]);
      originalConsoleError.apply(console, args);
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleGlobalError);

    return () => {
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection
      );
      window.removeEventListener("error", handleGlobalError);
      console.error = originalConsoleError;
    };
  }, [handleError]);

  return (
    <ErrorBoundaryContext.Provider value={{ handleError, withErrorHandling }}>
      {children}
    </ErrorBoundaryContext.Provider>
  );
};

export const useErrorBoundary = () => {
  const context = useContext(ErrorBoundaryContext);
  if (!context) {
    throw new Error(
      "useErrorBoundary must be used within an ErrorBoundaryProvider"
    );
  }
  return context;
};
