/**
 * fetchをラップして、APIリクエストを簡素化するユーティリティ関数
 * 
 * この関数は、APIエンドポイントにリクエストを送信し、レスポンスをJSON形式で返します。
 * 
 * @param path - APIエンドポイントのパス
 * @param options - fetchのオプション（RequestInit）
 * @param abortOptions - リクエストのキャンセルやタイムアウトのオプション
 *  abortOptions.signal - AbortSignalを使用してリクエストをキャンセルするためのシグナル
 *  abortOptions.timeoutMs - リクエストのタイムアウト時間（ミリ秒）
 * 
 * @returns - APIレスポンスのデータ（ジェネリック型T）
 * @throws - エラーが発生した場合、Errorオブジェクトをスロー
 * 
 * @example
// シンプルな使用例
  try {
    const data = await apiFetch<UserData>('/api/users/1');
    console.log(data);
  } catch (error) {
    console.error('エラー:', error);
  }

// タイムアウト付きの例
try {
  const data = await apiFetch<UserData>(
    '/api/users/1', 
    {}, // 通常のオプション
    { timeoutMs: 5000 } // 5秒でタイムアウト
  );
  console.log(data);
} catch (error) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    console.warn('タイムアウトしました');
  } else {
    console.error('エラー:', error);
  }
}

// 外部からのキャンセルシグナルを使用する例
const controller = new AbortController();

// どこかで後からキャンセルできる
setTimeout(() => controller.abort(), 3000); // 3秒後にキャンセル

try {
  const data = await apiFetch<UserData>(
    '/api/users/1', 
    {}, 
    { signal: controller.signal }
  );
  console.log(data);
} catch (error) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    console.log('リクエストがキャンセルされました');
  } else {
    console.error('エラー:', error);
  }
}
 */

import { safeAsync } from './async';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

export const apiFetch = async <T>(
  path: string,
  options: RequestInit = {},
  abortOptions?: {
    signal?: AbortSignal;
    timeoutMs?: number;
  }
): Promise<T> => {
  const baseOptions: RequestInit = {
    credentials: "include", // クッキーを送信する
    headers: {
      Accept: "application/json", // JSON形式でレスポンスを受け取る
    },
    // 外部からのシグナルがあれば設定
    signal: abortOptions?.signal,
  };

  // FormDataの場合はContent-Typeを設定しない
  if (!(options.body instanceof FormData)) {
    baseOptions.headers = {
      ...baseOptions.headers,
      "Content-Type": "application/json", // JSON形式でリクエストを送信する
    };
  }

  // safeAsyncを使用してリクエスト実行
  const { promise } = safeAsync<T, Error>(
    async () => {
      const response = await fetch(`${API_BASE}${path}`, {
        ...baseOptions,
        ...options,
        headers: {
          ...baseOptions.headers,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        // より詳細なエラー情報を提供するカスタムエラー
        const error = new Error(errorText || response.statusText);
        // エラーオブジェクトにステータスコード情報を追加
        Object.assign(error, { 
          status: response.status,
          statusText: response.statusText
        });
        throw error;
      }

      return response.json();
    },
    {
      // タイムアウト設定（指定があれば）
      timeoutMs: abortOptions?.timeoutMs,
      // 外部シグナルの伝達
      signal: abortOptions?.signal,
    }
  );

  // Result型の処理
  const result = await promise;
  
  if (result.error) {
    // エラーの場合は例外をスロー
    throw result.error;
  } else if (result.aborted) {
    // アボートの場合は専用エラーをスロー
    throw new DOMException("リクエストがキャンセルされました", "AbortError");
  }
  
  // 成功時はデータを返す
  return result.data as T;
};