import React, { Component, ErrorInfo, ReactNode } from 'react';
import { useToast } from '@/hooks/toast';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('予期せぬエラーが発生しました:', error);
    console.error('エラー情報:', errorInfo);
    // ここで既存のToastを使用することも可能
    const { showError } = useToast();
    showError(error);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="container mx-auto p-4">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <h2 className="text-xl font-bold mb-2">エラーが発生しました</h2>
            <p>予期せぬエラーが発生しました。ページを更新してください。</p>
            <button
              className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              onClick={() => window.location.reload()}
            >
              ページを更新
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
