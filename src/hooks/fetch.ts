const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

/**
 * APIリクエストの基本設定
 */
const apiFetch = async <T>(
  path: string,
  options: RequestInit = {}
): Promise<T> => {
  const baseOptions: RequestInit = {
    credentials: "include", // クッキーを送信する
    headers: {
      Accept: "application/json", // JSON形式でレスポンスを受け取る
    },
  };

  // FormDataの場合はContent-Typeを設定しない
  if (!(options.body instanceof FormData)) {
    baseOptions.headers = {
      ...baseOptions.headers,
      "Content-Type": "application/json", // JSON形式でリクエストを送信する
    };
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...baseOptions,
    ...options,
    headers: {
      ...baseOptions.headers,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || response.statusText);
  }

  return response.json();
};

/**
 * 以下はReact Hooks となりコンポーネントのトップレベルでのみ呼び出すことができます
 * 非同期関数内や条件分岐内では Hooks を使用できません
 **/
import { useEffect, useCallback, useState, useReducer } from "react";

// キャッシュの型
interface CacheData<T> {
  data: T;
  timestamp: number;
}

// キャッシュストア
const cache = new Map<string, CacheData<any>>();

// キャッシュの有効期限をチェック（デフォルト5分）
const isCacheValid = (
  timestamp: number,
  maxAge: number = 5 * 60 * 1000
): boolean => {
  return Date.now() - timestamp < maxAge;
};

// 参考：https://medium.com/@ignatovich.dm/typescript-patterns-you-should-know-for-react-development-d43129494027
// Discriminated Unionを使用したAPI状態の型定義
type ApiState<T> = 
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T; timestamp: number }
  | { status: 'error'; error: Error };

// API状態更新のアクション型
type ApiAction<T> = 
  | { type: 'FETCH_START' }
  | { type: 'FETCH_CACHED'; data: T; timestamp: number }
  | { type: 'FETCH_SUCCESS'; data: T }
  | { type: 'FETCH_ERROR'; error: Error };

// API状態を更新するreducer関数
function apiReducer<T>(state: ApiState<T>, action: ApiAction<T>): ApiState<T> {
  switch (action.type) {
    case 'FETCH_START':
      return { status: 'loading' };
    case 'FETCH_CACHED':
      return { 
        status: 'success', 
        data: action.data,
        timestamp: action.timestamp
      };
    case 'FETCH_SUCCESS':
      return { 
        status: 'success', 
        data: action.data,
        timestamp: Date.now()
      };
    case 'FETCH_ERROR':
      return { status: 'error', error: action.error };
    default:
      return state;
  }
}
// Queryレスポンスの型定義
interface QueryResult<T> {
  // 状態
  state: ApiState<T>;
  // データとエラー
  data: T | null;
  error: Error | null;
  // 状態フラグ
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  isIdle: boolean;
  // キャッシュ情報
  cachedAt: Date | null;
  // ユーティリティ関数
  refetch: () => Promise<void>;
  clearCache: () => void;
  clearAllCache: () => void;
}

/**
 * データ取得用のカスタムフック（キャッシュ機能付き）
 * 
 * @param path APIエンドポイントのパス
 * @param options fetchオプション
 * @param cacheTime キャッシュの有効期間（ミリ秒）
 * @returns QueryResult型のオブジェクト
 */
function useQuery<T>(
  path: string,
  options: RequestInit = {},
  cacheTime: number = 5 * 60 * 1000
): QueryResult<T> {
  // useReducerでAPIの状態を管理
  const [state, dispatch] = useReducer(
    apiReducer<T>,
    { status: 'idle' } as ApiState<T>
  );

  // データ取得関数
  const fetchData = useCallback(async () => {
    dispatch({ type: 'FETCH_START' });

    // キャッシュチェック
    const cachedData = cache.get(path);
    if (cachedData && isCacheValid(cachedData.timestamp, cacheTime)) {
      dispatch({ 
        type: 'FETCH_CACHED', 
        data: cachedData.data,
        timestamp: cachedData.timestamp 
      });
      return;
    }

    try {
      const data = await apiFetch<T>(path, { ...options, method: "GET" });
      cache.set(path, { data, timestamp: Date.now() });
      dispatch({ type: 'FETCH_SUCCESS', data });
    } catch (error) {
      dispatch({
        type: 'FETCH_ERROR',
        error: error instanceof Error ? error : new Error(String(error))
      });
    }
  }, [path, cacheTime]);

  // 初回マウント時にデータを取得
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 便利なプロパティを計算
  const isLoading = state.status === 'loading';
  const isSuccess = state.status === 'success';
  const isError = state.status === 'error';
  const isIdle = state.status === 'idle';
  
  // データとエラーを抽出
  const data = isSuccess ? state.data : null;
  const error = isError ? state.error : null;
  
  // キャッシュ情報
  const cachedAt = isSuccess ? new Date(state.timestamp) : null;

  // キャッシュをクリアする関数
  const clearCache = useCallback(() => {
    cache.delete(path);
  }, [path]);

  // すべてのキャッシュを削除
  const clearAllCache = useCallback(() => {
    cache.clear();
  }, []);

  return {
    // 状態
    state,
    // ユーティリティ関数
    refetch: fetchData,
    clearCache,
    clearAllCache,
    // 便利なプロパティ
    isLoading,
    isSuccess,
    isError,
    isIdle,
    data,
    error,
    cachedAt
  };
}


// Mutation操作の結果型
interface MutationResult<T> {
  // 状態
  state: ApiState<T>;
  // データとエラー
  data: T | null;
  error: Error | null;
  // 状態フラグ
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  isIdle: boolean;
  // 操作関数
  mutate: <U = any>(data?: U) => Promise<T | null>;
  // リセット関数
  reset: () => void;
}
/**
 * データ変更用のカスタムフック（POST/PUT/DELETE操作）
 * 
 * @param path APIエンドポイントのパス
 * @param method HTTPメソッド（POST/PUT/DELETE）
 * @returns MutationResult型のオブジェクト
 */
function useMutation<T>(
  path: string,
  method: "POST" | "PUT" | "DELETE" = "POST"
): MutationResult<T> {
  const [state, dispatch] = useReducer(
    apiReducer<T>,
    { status: 'idle' } as ApiState<T>
  );

  // データ送信関数
  const mutate = async <U = any>(data?: U): Promise<T | null> => {
    dispatch({ type: 'FETCH_START' });

    try {
      const response = await apiFetch<T>(path, {
        method,
        body: data ? JSON.stringify(data) : undefined,
      });
      dispatch({ type: 'FETCH_SUCCESS', data: response });
      return response;
    } catch (error) {
      dispatch({
        type: 'FETCH_ERROR',
        error: error instanceof Error ? error : new Error(String(error))
      });
      return null;
    }
  };

  // 状態をリセット
  const reset = useCallback(() => {
    dispatch({ type: 'FETCH_START' });
    dispatch({ 
      type: 'FETCH_SUCCESS', 
      data: null as unknown as T 
    });
  }, []);

  // 便利なプロパティを計算
  const isLoading = state.status === 'loading';
  const isSuccess = state.status === 'success';
  const isError = state.status === 'error';
  const isIdle = state.status === 'idle';
  
  // データとエラーを抽出
  const data = isSuccess ? state.data : null;
  const error = isError ? state.error : null;

  return {
    state,
    mutate,
    reset,
    isLoading,
    isSuccess,
    isError,
    isIdle,
    data,
    error,
  };
}

export { apiFetch, useQuery, useMutation };

/**
 * useQuery (GET) 使用例:
 * 
 * // 型付きでAPIデータを取得する例
 * interface User {
 *   id: number;
 *   name: string;
 *   email: string;
 * }
 * 
 * const UserProfile = () => {
 *   const { 
 *     data, 
 *     error, 
 *     isLoading, 
 *     isError,
 *     refetch,
 *     cachedAt,
 *     clearCache
 *   } = useQuery<User>('/api/user/profile');
 *
 *   // 読み込み中の表示
 *   if (isLoading) return <div>読み込み中...</div>;
 *   
 *   // エラー表示
 *   if (isError) return (
 *     <div>
 *       <p>エラー: {error.message}</p>
 *       <button onClick={refetch}>再試行</button>
 *     </div>
 *   );
 *   
 *   // データの表示
 *   return (
 *     <div>
 *       <h1>{data?.name}</h1>
 *       <p>メール: {data?.email}</p>
 *       {cachedAt && <p>最終更新: {cachedAt.toLocaleString()}</p>}
 *       <button onClick={refetch}>更新</button>
 *       <button onClick={clearCache}>キャッシュをクリア</button>
 *     </div>
 *   );
 * };
 */

/**
 * useMutation (POST/PUT/DELETE) 使用例:
 *
 * // 送信データの型とレスポンスの型を定義
 * interface UserUpdateForm {
 *   name: string;
 *   email: string;
 * }
 * 
 * interface UpdateResponse {
 *   success: boolean;
 *   message: string;
 *   user?: {
 *     id: number;
 *     name: string;
 *     email: string;
 *   }
 * }
 * 
 * const UserEditor = () => {
 *   // フォーム状態
 *   const [form, setForm] = useState({ name: '', email: '' });
 * 
 *   // ユーザー情報更新のmutation
 *   const { 
 *     mutate, 
 *     isLoading, 
 *     isSuccess, 
 *     data, 
 *     error, 
 *     reset 
 *   } = useMutation<UpdateResponse, UserUpdateForm>('/api/user/profile', 'PUT');
 * 
 *   // フォーム送信ハンドラー
 *   const handleSubmit = async (e: React.FormEvent) => {
 *     e.preventDefault();
 *     await mutate(form);
 *   };
 * 
 *   // フォーム入力の変更ハンドラー
 *   const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 *     setForm({ ...form, [e.target.name]: e.target.value });
 *   };
 * 
 *   // 送信成功時の表示
 *   if (isSuccess) {
 *     return (
 *       <div>
 *         <p>更新成功: {data?.message}</p>
 *         <button onClick={reset}>新しい更新</button>
 *       </div>
 *     );
 *   }
 * 
 *   // フォーム表示
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       {isError && <p className="error">エラー: {error.message}</p>}
 *       
 *       <div>
 *         <label htmlFor="name">名前</label>
 *         <input
 *           id="name"
 *           name="name"
 *           value={form.name}
 *           onChange={handleChange}
 *         />
 *       </div>
 *       
 *       <div>
 *         <label htmlFor="email">メール</label>
 *         <input
 *           id="email"
 *           name="email"
 *           type="email"
 *           value={form.email}
 *           onChange={handleChange}
 *         />
 *       </div>
 *       
 *       <button type="submit" disabled={isLoading}>
 *         {isLoading ? '送信中...' : '更新する'}
 *       </button>
 *     </form>
 *   );
 * };
 */

/* 以下参考フック　---------------------------------------------------------　*/
const useDataFetching = <T>(url: string) => {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [url]);

  const fetchData = async () => {
    try {
      const response = await fetch(url);
      const result = await response.json();
      setData(result);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  };

  return { data, error, loading, refetch: fetchData };
};

const handleAsync = async <T>(
  promise: Promise<T>
): Promise<[T, null] | [null, Error]> => {
  try {
    const data = await promise;
    return [data, null];
  } catch (error) {
    return [null, error instanceof Error ? error : new Error(String(error))];
  }
};
// 使用例
// const [user, error] = await handleAsync(fetchData(1));
// if (error) {
//   console.error("Error:", error.message);
// } else {
//   console.log("User:", user.name);
// }
