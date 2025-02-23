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
import { useEffect, useCallback, useState } from "react";

// APIレスポンスの基本型
interface HooksApiResponse<T = any> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

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

/**
 * GETリクエスト用のカスタムフック（キャッシュ機能付き）
 */
const useApiGet = <T>(
  path: string,
  options: RequestInit = {},
  cacheTime: number = 5 * 60 * 1000 // キャッシュの有効期限（デフォルト5分）
): HooksApiResponse<T> => {
  const [state, setState] = useState<HooksApiResponse<T>>({
    data: null,
    error: null,
    loading: true,
    refetch: async () => {},
  });

  const fetchData = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));

    // キャッシュチェック
    const cachedData = cache.get(path);
    if (cachedData && isCacheValid(cachedData.timestamp, cacheTime)) {
      setState({
        data: cachedData.data,
        error: null,
        loading: false,
        refetch: fetchData,
      });
      return;
    }

    try {
      const data = await apiFetch<T>(path, { ...options, method: "GET" });
      cache.set(path, { data, timestamp: Date.now() });
      setState({ data, error: null, loading: false, refetch: fetchData });
    } catch (error) {
      setState({
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
        loading: false,
        refetch: fetchData,
      });
    }
  }, [path, cacheTime]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return state;
};

/**
 * POST/PUT/DELETE用のカスタムフック
 */
const useApiMutation = <T, U = any>(
  path: string,
  method: "POST" | "PUT" | "DELETE" = "POST"
) => {
  const [state, setState] = useState<HooksApiResponse<T>>({
    data: null,
    error: null,
    loading: false,
    refetch: async () => {},
  });

  const mutate = async (data?: U): Promise<T | null> => {
    setState((prev) => ({ ...prev, loading: true }));

    try {
      const response = await apiFetch<T>(path, {
        method,
        body: data ? JSON.stringify(data) : undefined,
      });
      setState({
        data: response,
        error: null,
        loading: false,
        refetch: async () => {},
      });
      return response;
    } catch (error) {
      setState({
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
        loading: false,
        refetch: async () => {},
      });
      return null;
    }
  };

  return { ...state, mutate };
};

export { apiFetch, useApiGet, useApiMutation };

/* 以下使用例 -----------------------------------------------------------------*/
// // GETリクエストの例
// const UserProfile: React.FC = () => {
//   const { data, error, loading, refetch } = useApiGet('/api/user/profile');

//   if (loading) return <div>Loading...</div>;
//   if (error) return <div>Error: {error.message}</div>;

//   return (
//     <div>
//       <h1>{data?.name}</h1>
//       <button onClick={refetch}>更新</button>
//     </div>
//   );
// };

// // POST/PUT/DELETEリクエストの例
// const UpdateProfile: React.FC = () => {
//   const { mutate, loading, error } = useApiMutation('/api/user/profile', 'PUT');

//   const handleSubmit = async (formData: any) => {
//     const result = await mutate(formData);
//     if (result) {
//       // 成功時の処理
//     }
//   };

//   return (
//     <form onSubmit={handleSubmit}>
//       {/* フォーム要素 */}
//     </form>
//   );
// };

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
