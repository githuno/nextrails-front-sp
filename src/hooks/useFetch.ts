import { apiFetch } from "@/utils/fetch"
/**
 * 以下はReact Hooks となりコンポーネントのトップレベルでのみ呼び出すことができます
 * 非同期関数内や条件分岐内では Hooks を使用できません
 **/
import { useCallback, useEffect, useReducer, useRef } from "react"

// キャッシュの型
interface CacheData<T> {
  data: T
  timestamp: number
}

// キャッシュストア
const cache = new Map<string, CacheData<any>>()

// キャッシュの有効期限をチェック（デフォルト5分）
const isCacheValid = (timestamp: number, maxAge: number = 5 * 60 * 1000): boolean => {
  return Date.now() - timestamp < maxAge
}

// 参考：https://medium.com/@ignatovich.dm/typescript-patterns-you-should-know-for-react-development-d43129494027
// Discriminated Unionを使用したAPI状態の型定義
type ApiState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T; timestamp: number }
  | { status: "error"; error: Error }

// API状態更新のアクション型
type ApiAction<T> =
  | { type: "FETCH_START" }
  | { type: "FETCH_CACHED"; data: T; timestamp: number }
  | { type: "FETCH_SUCCESS"; data: T }
  | { type: "FETCH_ERROR"; error: Error }

// API状態を更新するreducer関数
function apiReducer<T>(state: ApiState<T>, action: ApiAction<T>): ApiState<T> {
  switch (action.type) {
    case "FETCH_START":
      return { status: "loading" }
    case "FETCH_CACHED":
      return {
        status: "success",
        data: action.data,
        timestamp: action.timestamp,
      }
    case "FETCH_SUCCESS":
      return {
        status: "success",
        data: action.data,
        timestamp: Date.now(),
      }
    case "FETCH_ERROR":
      return { status: "error", error: action.error }
    default:
      return state
  }
}
// Queryレスポンスの型定義
interface QueryResult<T> {
  // 状態
  state: ApiState<T>
  // データとエラー
  data: T | null
  error: Error | null
  // 状態フラグ
  isLoading: boolean
  isSuccess: boolean
  isError: boolean
  isIdle: boolean
  // キャッシュ情報
  cachedAt: Date | null
  // ユーティリティ関数
  refetch: () => Promise<void>
  clearCache: () => void
  clearAllCache: () => void
}

/**
 * データ取得用のカスタムフック（キャッシュ機能、アボート機能、タイムアウト機能付き）
 * 
 * @param path APIエンドポイントのパス
 * @param options fetchオプション
 * @param cacheTime キャッシュの有効期間（ミリ秒）
 * @param queryOptions.cacheTime キャッシュの有効期間（ミリ秒）
 * @param queryOptions.timeoutMs タイムアウト時間（ミリ秒）
 * @param queryOptions.enabled フェッチを有効にするかどうか
 * @returns QueryResult型のオブジェクト
 * 
 * @example
 //  拡張版の使用例
 const UserProfile = () => {
  // タイムアウト付きのクエリ
  const { 
    data, 
    error, 
    isLoading, 
    isError,
    refetch,
    cancel  // 👈 新機能：手動キャンセル
  } = useQuery<User>(
    '/api/user/profile',
    {},
    { timeoutMs: 5000 }  // 👈 5秒でタイムアウト
  );

  // 条件付きクエリの例
  const {
    data: conditionalData
  } = useQuery<DetailData>(
    `/api/details/${data?.id}`,
    {},
    { 
      enabled: !!data?.id,  // 👈 data.idがある場合のみ実行
      timeoutMs: 3000 
    }
  );

  // キャンセルボタンの例
  return (
    <div>
      {isLoading && (
        <div>
          読み込み中...
          <button onClick={cancel}>キャンセル</button>
        </div>
      )}
      残りの実装... 
      </div>
    );
  };
 *
 */
function useQuery<T>(
  path: string,
  options: RequestInit = {},
  queryOptions: {
    cacheTime?: number
    timeoutMs?: number
    enabled?: boolean
  } = {},
): QueryResult<T> & {
  cancel: () => void
} {
  const { cacheTime = 5 * 60 * 1000, timeoutMs, enabled = true } = queryOptions

  // useReducerでAPIの状態を管理
  const [state, dispatch] = useReducer(apiReducer<T>, {
    status: "idle",
  } as ApiState<T>)

  // AbortControllerのRef
  const controllerRef = useRef<AbortController | null>(null)

  // キャンセル関数
  const cancel = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort()
      controllerRef.current = null
    }
  }, [])

  // データ取得関数
  const fetchData = useCallback(async () => {
    // enabledがfalseの場合は何もしない
    if (!enabled) return

    dispatch({ type: "FETCH_START" })

    // キャッシュチェック
    const cachedData = cache.get(path)
    if (cachedData && isCacheValid(cachedData.timestamp, cacheTime)) {
      dispatch({
        type: "FETCH_CACHED",
        data: cachedData.data,
        timestamp: cachedData.timestamp,
      })
      return
    }

    // 既存のコントローラーがあればキャンセル
    cancel()

    // 新しいコントローラーを作成
    const controller = new AbortController()
    controllerRef.current = controller

    try {
      const data = await apiFetch<T>(
        path,
        { ...options, method: "GET" },
        {
          signal: controller.signal,
          timeoutMs,
        },
      )

      // アンマウント後の状態更新を防止
      if (!controllerRef.current) return

      cache.set(path, { data, timestamp: Date.now() })
      dispatch({ type: "FETCH_SUCCESS", data })
    } catch (error) {
      // アンマウント後の状態更新を防止
      if (!controllerRef.current) return

      // アボートエラーの場合は特別な処理
      if (error instanceof DOMException && error.name === "AbortError") {
        // タイムアウトまたはキャンセルの場合は特別なメッセージ
        dispatch({
          type: "FETCH_ERROR",
          error: new Error("リクエストがキャンセルまたはタイムアウトしました"),
        })
      } else {
        dispatch({
          type: "FETCH_ERROR",
          error: error instanceof Error ? error : new Error(String(error)),
        })
      }
    }
  }, [path, cacheTime, enabled, options, timeoutMs, cancel])

  // 初回マウント時とdepsの変更時にデータを取得
  useEffect(() => {
    fetchData()

    // クリーンアップ関数でアボート
    return () => {
      cancel()
    }
  }, [fetchData, cancel])

  // 現在の状態から派生値を計算
  const isLoading = state.status === "loading"
  const isSuccess = state.status === "success"
  const isError = state.status === "error"
  const isIdle = state.status === "idle"

  const data = isSuccess ? state.data : null
  const error = isError ? state.error : null

  const cachedAt = isSuccess ? new Date(state.timestamp) : null

  // キャッシュをクリアする関数
  const clearCache = useCallback(() => {
    cache.delete(path)
  }, [path])

  // すべてのキャッシュを削除
  const clearAllCache = useCallback(() => {
    cache.clear()
  }, [])

  return {
    // 状態
    state,
    // ユーティリティ関数
    refetch: fetchData,
    clearCache,
    clearAllCache,
    cancel,
    // 便利なプロパティ
    isLoading,
    isSuccess,
    isError,
    isIdle,
    data,
    error,
    cachedAt,
  }
}

// Mutation操作の結果型
interface MutationResult<T> {
  // 状態
  state: ApiState<T>
  // データとエラー
  data: T | null
  error: Error | null
  // 状態フラグ
  isLoading: boolean
  isSuccess: boolean
  isError: boolean
  isIdle: boolean
  // 操作関数
  mutate: <U = any>(data?: U) => Promise<T | null>
  // リセット関数
  reset: () => void
}
/**
 * データ変更用のカスタムフック（POST/PUT/DELETE操作、アボート機能、タイムアウト機能付き）
 * 
 * @param path APIエンドポイントのパス
 * @param method HTTPメソッド（POST/PUT/DELETE）
 * @param mutationOptions.timeoutMs タイムアウト時間（ミリ秒）
 * @returns MutationResult型のオブジェクト
 * 
 * @example
 const UserProfile = () => {
  // タイムアウト付きのクエリ
  const { 
    data, 
    error, 
    isLoading, 
    isError,
    refetch,
    cancel  // 👈 新機能：手動キャンセル
  } = useQuery<User>(
    '/api/user/profile',
    {},
    { timeoutMs: 5000 }  // 👈 5秒でタイムアウト
  );

  // 条件付きクエリの例
  const {
    data: conditionalData
  } = useQuery<DetailData>(
    `/api/details/${data?.id}`,
    {},
    { 
      enabled: !!data?.id,  // 👈 data.idがある場合のみ実行
      timeoutMs: 3000 
    }
  );

  // キャンセルボタンの例
  return (
    <div>
      {isLoading && (
        <div>
          読み込み中...
          <button onClick={cancel}>キャンセル</button>
        </div>
      )}
      残りの実装...
      </div>
    );
  };
 *
 */
function useMutation<T>(
  path: string,
  method: "POST" | "PUT" | "DELETE" = "POST",
  mutationOptions: {
    timeoutMs?: number
  } = {},
): MutationResult<T> & {
  cancel: () => void
} {
  const { timeoutMs } = mutationOptions

  const [state, dispatch] = useReducer(apiReducer<T>, {
    status: "idle",
  } as ApiState<T>)

  // AbortControllerのRef
  const controllerRef = useRef<AbortController | null>(null)

  // キャンセル関数
  const cancel = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort()
      controllerRef.current = null
    }
  }, [])

  // アンマウント時のキャンセル処理
  useEffect(() => {
    return () => {
      cancel()
    }
  }, [cancel])

  // データ送信関数
  const mutate = async <U = any>(data?: U): Promise<T | null> => {
    dispatch({ type: "FETCH_START" })

    // 既存のコントローラーがあればキャンセル
    cancel()

    // 新しいコントローラーを作成
    const controller = new AbortController()
    controllerRef.current = controller

    try {
      const response = await apiFetch<T>(
        path,
        {
          method,
          body: data ? JSON.stringify(data) : undefined,
        },
        {
          signal: controller.signal,
          timeoutMs,
        },
      )

      // アンマウント後の状態更新を防止
      if (!controllerRef.current) return null

      dispatch({ type: "FETCH_SUCCESS", data: response })
      return response
    } catch (error) {
      // アンマウント後の状態更新を防止
      if (!controllerRef.current) return null

      // アボートエラーの場合は特別な処理
      if (error instanceof DOMException && error.name === "AbortError") {
        dispatch({
          type: "FETCH_ERROR",
          error: new Error("リクエストがキャンセルまたはタイムアウトしました"),
        })
      } else {
        dispatch({
          type: "FETCH_ERROR",
          error: error instanceof Error ? error : new Error(String(error)),
        })
      }
      return null
    }
  }

  // 状態をリセット
  const reset = useCallback(() => {
    dispatch({ type: "FETCH_START" })
    dispatch({
      type: "FETCH_SUCCESS",
      data: null as unknown as T,
    })
  }, [])

  // 現在の状態から派生値を計算
  const isLoading = state.status === "loading"
  const isSuccess = state.status === "success"
  const isError = state.status === "error"
  const isIdle = state.status === "idle"

  const data = isSuccess ? state.data : null
  const error = isError ? state.error : null

  return {
    state,
    mutate,
    reset,
    cancel,
    isLoading,
    isSuccess,
    isError,
    isIdle,
    data,
    error,
  }
}

export { apiFetch, useMutation, useQuery }

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

/* 以下参考フック --------------------------------------------------------- */
// const useDataFetching = <T>(url: string) => {
//   const [data, setData] = useState<T | null>(null)
//   const [error, setError] = useState<Error | null>(null)
//   const [loading, setLoading] = useState(true)

//   const fetchData = async () => {
//     try {
//       const response = await fetch(url)
//       const result = await response.json()
//       setData(result)
//     } catch (e) {
//       setError(e as Error)
//     } finally {
//       setLoading(false)
//     }
//   }

//   useEffect(() => {
//     fetchData()
//   }, [fetchData, url])

//   return { data, error, loading, refetch: fetchData }
// }
