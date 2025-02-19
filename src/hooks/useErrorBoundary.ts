import { useCallback } from "react";
import { useToast } from "./toast";

export const useErrorBoundary = () => {
  const { showError } = useToast();

  const handleError = useCallback(
    (error: unknown) => {
      // エラーオブジェクトの型を確認して適切なメッセージを表示
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

  return {
    handleError,
    withErrorHandling: <T extends (...args: any[]) => Promise<any>>(fn: T) => {
      return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
        try {
          return await fn(...args);
        } catch (error) {
          handleError(error);
          throw error;
        }
      };
    },
  };
};

// 使用例

// // コンポーネント内での使用例
// const YourComponent = () => {
//   const { withErrorHandling } = useErrorBoundary();

//   const handleSubmit = withErrorHandling(async (data) => {
//     // エラーが発生した場合、自動的にトースト表示される
//     await submitData(data);
//   });
// };

// // 個別のtry-catch内
// const YourComponent = () => {
//   const { handleError } = useErrorBoundary();

//   const doSomething = async () => {
//     try {
//       // 処理
//     } catch (error) {
//       handleError(error);
//     }
//   };
// };