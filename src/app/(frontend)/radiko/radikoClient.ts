import {
  AreaId,
  Auth,
  Station,
  Program,
  areaIdToNameMap,
  url,
} from "./constants";
const RADIKO_AUTH_KEY = "radiko_auth";

/** 型定義 ----------------------------------------------------------*/

// エラーレスポンスの型定義
type ErrorResponse = {
  error: string;
  message: string;
  status: number;
  details?: any;
  phase?: "auth1" | "auth2" | "area_validation" | "header_validation";
  retry_recommended?: boolean;
};

// カスタムエラー型
type RadikoAPIError = {
  name: string;
  message: string;
  status?: number;
  details?: any;
  retryRecommended: boolean;
};

// リトライ設定の型
type RetryConfig = {
  readonly maxRetries: number;
  readonly initialDelay: number;
  readonly maxDelay: number;
};

// 認証情報の型定義
type StoredAuthInfo = {
  token: string;
  areaId: string;
  timestamp: number;
};

/** 定数 ----------------------------------------------------------*/

// 認証リトライ設定
export const RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 5000,
};

/** ユーティリティ関数 ---------------------------------------------*/

// APIエラー作成関数
const createRadikoAPIError = (
  message: string,
  status?: number,
  details?: any,
  retryRecommended = true
): RadikoAPIError => ({
  name: "RadikoAPIError",
  message,
  status,
  details,
  retryRecommended,
});

// APIレスポンス処理関数
const handleApiResponse = async <T>(
  response: Response,
  signal?: AbortSignal
): Promise<T> => {
  // シグナルがアボートされていたら中断
  if (signal?.aborted) {
    throw new DOMException("Request aborted", "AbortError");
  }

  if (!response.ok) {
    const error = (await response.json().catch(() => ({
      error: "予期せぬエラーが発生しました",
      status: response.status,
    }))) as ErrorResponse;

    throw createRadikoAPIError(
      error.message || error.error,
      error.status || response.status,
      error.details,
      error.retry_recommended ?? true
    );
  }

  return response.json();
};

// リトライ処理を実装
const withRetry = async <T>(
  operation: () => Promise<T>,
  retryCount = 0
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    // RadikoAPIErrorかどうかをチェック
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "RadikoAPIError"
    ) {
      const apiError = error as RadikoAPIError;

      if (!apiError.retryRecommended || retryCount >= RETRY_CONFIG.maxRetries) {
        throw apiError;
      }

      // 指数バックオフでリトライ
      const delay = Math.min(
        RETRY_CONFIG.initialDelay * 2 ** retryCount,
        RETRY_CONFIG.maxDelay
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
      return withRetry(operation, retryCount + 1);
    }
    throw error;
  }
};

// 認証情報をローカルストレージに保存
const saveAuthInfo = (token: string, areaId: string): void => {
  try {
    const authInfo: StoredAuthInfo = {
      token,
      areaId,
      timestamp: Date.now(),
    };
    localStorage.setItem(RADIKO_AUTH_KEY, JSON.stringify(authInfo));
  } catch (error) {
    console.warn("Failed to save auth info to localStorage:", error);
  }
};

// 認証情報の有効性を確認
const isAuthValid = (authInfo: StoredAuthInfo): boolean => {
  // 70分以内の認証情報のみ有効とする
  const EXPIRY_TIME = 70 * 60 * 1000; // 70 minutes
  return Date.now() - authInfo.timestamp < EXPIRY_TIME;
};

// 認証情報をローカルストレージから取得
const getStoredAuthInfo = (): StoredAuthInfo | null => {
  try {
    const stored = localStorage.getItem(RADIKO_AUTH_KEY);
    if (!stored) return null;

    const authInfo: StoredAuthInfo = JSON.parse(stored);
    return isAuthValid(authInfo) ? authInfo : null;
  } catch {
    return null;
  }
};

// ローカルストレージの認証情報から地域名を取得
const getStoredAuthName = (): string => {
  let areaName = "未判定";
  try {
    const stored = localStorage.getItem(RADIKO_AUTH_KEY);
    if (!stored) return areaName;
    const authInfo: Auth = JSON.parse(stored);
    areaName = areaIdToNameMap[authInfo.areaId as AreaId] || areaName;
  } catch (error) {
    console.warn("Failed to get auth name:", error);
  }
  return areaName;
};

const authenticateWithIp = async (ip: string): Promise<Auth> => {
  try {
    // 認証処理をリトライ機能付きで実行
    const result = await withRetry(async () => {
      const response = await fetch(url.authIp.replace("{ip}", ip), {
        method: "POST",
      });
      return handleApiResponse<Auth>(response);
    });

    // 認証情報を保存
    saveAuthInfo(result.token, result.areaId);

    return result;
  } catch (error) {
    console.error("Authentication error:", error);

    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "RadikoAPIError"
    ) {
      throw error;
    }
    throw createRadikoAPIError("認証に失敗しました", 500, error);
  }
};

const customAuthenticate = async (areaId: AreaId): Promise<Auth> => {
  try {
    // 既存の有効な認証情報があれば再利用
    const storedAuth = getStoredAuthInfo();
    if (storedAuth && storedAuth.areaId === areaId) {
      return {
        token: storedAuth.token,
        areaId: storedAuth.areaId,
      };
    }

    // 認証処理をリトライ機能付きで実行
    const result = await withRetry(async () => {
      const response = await fetch(url.customAuth, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ areaId }),
      });

      const authResult = await handleApiResponse<Auth>(response);

      // レスポンスヘッダーからトークンとエリアIDを取得
      const token =
        response.headers.get("X-Radiko-AuthToken") || authResult.token;
      const responseAreaId =
        response.headers.get("X-Radiko-AreaId") || authResult.areaId;

      return {
        token,
        areaId: responseAreaId,
      };
    });

    // 認証情報を保存
    saveAuthInfo(result.token, result.areaId);

    return result;
  } catch (error) {
    console.error("Authentication error:", error);

    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "RadikoAPIError"
    ) {
      throw error;
    }
    throw createRadikoAPIError("認証に失敗しました", 500, error);
  }
};

const getStations = async (
  areaId: AreaId,
  signal?: AbortSignal
): Promise<Station[]> => {
  try {
    const stationsRes = await fetch(url.stations.replace("{area}", areaId), {
      signal,
    });
    if (!stationsRes.ok) {
      throw createRadikoAPIError(
        "放送局情報の取得に失敗しました",
        stationsRes.status
      );
    }
    const result = await stationsRes.json();
    // data プロパティから配列を抽出して返す
    return result.data || [];
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    console.error("Failed to fetch stations:", error);
    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "RadikoAPIError"
    ) {
      throw error;
    }
    throw createRadikoAPIError("放送局情報の取得に失敗しました", 500, error);
  }
};

const getProgramNow = async ({
  token,
  area,
  stationId,
  signal,
}: {
  token: string;
  area: AreaId;
  stationId: string;
  signal?: AbortSignal;
}): Promise<Program> => {
  try {
    const programsRes = await fetch(
      url.programNow.replace("{area}", area).replace("{token}", token),
      { signal }
    );
    if (!programsRes.ok) {
      throw createRadikoAPIError(
        "番組情報の取得に失敗しました",
        programsRes.status
      );
    }
    const result = await programsRes.json();
    console.log("Program now:", result);
    // resultからstationIdの番組情報を抽出
    const program = result.data.find(
      (p: Program) => p.station_id === stationId
    );
    if (!program) {
      throw createRadikoAPIError("番組情報が見つかりませんでした", 404);
    }
    return program;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    console.error("Failed to fetch programs:", error);
    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "RadikoAPIError"
    ) {
      throw error;
    }
    throw createRadikoAPIError("番組情報の取得に失敗しました", 500, error);
  }
};

const getPrograms = async ({
  token,
  stationId,
  type = "date",
  date,
  signal,
}: {
  token: string;
  stationId: string;
  type?: "today" | "weekly" | "date";
  date?: string;
  signal?: AbortSignal;
}): Promise<Program[]> => {
  try {
    const targetUrl = (() => {
      switch (type) {
        case "today":
          return url.programsToday;
        case "weekly":
          return url.programsWeekly;
        case "date":
          return url.programsDate;
        default:
          return url.programsDate;
      }
    })();
    const programsRes = await fetch(
      targetUrl
        .replace("{stationId}", stationId)
        .replace("{token}", token)
        .replace("{date}", date || ""),
      { signal }
    );
    if (!programsRes.ok) {
      throw createRadikoAPIError(
        "番組表の取得に失敗しました",
        programsRes.status
      );
    }
    const result = await programsRes.json();
    return result.data || [];
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    console.error("Failed to fetch programs:", error);
    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "RadikoAPIError"
    ) {
      throw error;
    }
    throw createRadikoAPIError("番組表の取得に失敗しました", 500, error);
  }
};

const funcGetErrorMessage = (err: unknown): string => {
  if (typeof err === "object" && err !== null && "message" in err) {
    return String(err.message);
  } else if (typeof err === "string") {
    return err;
  }
  return "予期せぬエラーが発生しました";
};

/** RadikoClient クラス ------------------------------------------------------*/
// export default class RadikoClient {
//   // エラーメッセージの取得
//   getErrorMessage = funcGetErrorMessage;
//   // 認証情報の取得
//   getAuthName = getStoredAuthName;
//   getAuthInfo = getStoredAuthInfo;

//   // IPアドレスでの認証
//   async authenticate(ip: string): Promise<Auth> {
//     return authenticateWithIp(ip);
//   }

//   // エリアIDでのカスタム認証
//   async customAuthenticate(areaId: AreaId): Promise<Auth> {
//     return customAuthenticate(areaId);
//   }

//   // 放送局情報の取得
//   async getStations(areaId: string, signal?: AbortSignal): Promise<Station[]> {
//     return getStations(areaId as AreaId, signal);
//   }

//   // 現在の番組情報の取得
//   async getProgramNow({
//     token,
//     area,
//     stationId,
//     signal,
//   }: {
//     token: string;
//     area: AreaId;
//     stationId: string;
//     signal?: AbortSignal;
//   }): Promise<Program> {
//     return getProgramNow(token, area, stationId, signal);
//   }

//   // 番組情報の取得
//   async getPrograms({
//     token,
//     stationId,
//     type,
//     date,
//     signal,
//   }: {
//     token: string;
//     stationId: string;
//     type?: "today" | "weekly" | "date";
//     date?: string;
//     signal?: AbortSignal;
//   }): Promise<Program[]> {
//     return getPrograms(token, stationId, type, date, signal);
//   }
// }


/** RadikoClient ラッパー ----------------------------------------------------*/
// 参考：https://medium.com/@perisicnikola37/dont-use-react-imports-like-this-use-wrapper-pattern-instead-b7a49b864ff4
// const RadikoClient = {
//   getErrorMessage: funcGetErrorMessage,
//   getAuthName: getStoredAuthName,
//   getAuthInfo: getStoredAuthInfo,
//   authenticate: authenticateWithIp,
//   customAuthenticate,
//   getStations,
//   getProgramNow,
//   getPrograms,
// };

// export default RadikoClient;

/** 状態をもたせる ----------------------------------------------------------- */
// ...既存のインポート文
import { useState, useCallback } from 'react';

// 状態タイプの定義を追加
export type RequestState = {
  isLoading: boolean;
  error: string | null;
};

// イベント購読用の型定義
type Listener = (state: RequestState) => void;

// RadikoClientStateManagerクラスを作成
class RadikoClientStateManager {
  private state: RequestState = {
    isLoading: false,
    error: null
  };
  private listeners: Listener[] = [];

  // 状態を取得
  getState(): RequestState {
    return { ...this.state };
  }

  // 状態を更新
  setState(newState: Partial<RequestState>): void {
    this.state = { ...this.state, ...newState };
    this.notifyListeners();
  }

  // リスナーに通知
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.state));
  }

  // リスナーを追加
  subscribe(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
}

// 状態管理のインスタンスを作成
const stateManager = new RadikoClientStateManager();

// 拡張したRadikoClientの実装
const RadikoClient = {
  // 既存のメソッド
  getErrorMessage: funcGetErrorMessage,
  getAuthName: getStoredAuthName,
  getAuthInfo: getStoredAuthInfo,

  // 状態管理関連のメソッド
  getState: () => stateManager.getState(),
  subscribe: (listener: Listener) => stateManager.subscribe(listener),

  // API呼び出しをラップして状態管理を組み込んだメソッド
  authenticate: async (ip: string): Promise<Auth> => {
    try {
      stateManager.setState({ isLoading: true, error: null });
      const result = await authenticateWithIp(ip);
      stateManager.setState({ isLoading: false });
      return result;
    } catch (error) {
      const errorMessage = funcGetErrorMessage(error);
      stateManager.setState({ isLoading: false, error: errorMessage });
      throw error;
    }
  },

  customAuthenticate: async (areaId: AreaId): Promise<Auth> => {
    try {
      stateManager.setState({ isLoading: true, error: null });
      const result = await customAuthenticate(areaId);
      stateManager.setState({ isLoading: false });
      return result;
    } catch (error) {
      const errorMessage = funcGetErrorMessage(error);
      stateManager.setState({ isLoading: false, error: errorMessage });
      throw error;
    }
  },

  getStations: async (areaId: string, signal?: AbortSignal): Promise<Station[]> => {
    try {
      stateManager.setState({ isLoading: true, error: null });
      const result = await getStations(areaId as AreaId, signal);
      stateManager.setState({ isLoading: false });
      return result;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        stateManager.setState({ isLoading: false });
        throw error;
      }
      const errorMessage = funcGetErrorMessage(error);
      stateManager.setState({ isLoading: false, error: errorMessage });
      throw error;
    }
  },

  getProgramNow: async ({
    token,
    area,
    stationId,
    signal,
  }: {
    token: string;
    area: AreaId;
    stationId: string;
    signal?: AbortSignal;
  }): Promise<Program> => {
    try {
      stateManager.setState({ isLoading: true, error: null });
      const result = await getProgramNow({ token, area, stationId, signal });
      stateManager.setState({ isLoading: false });
      return result;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        stateManager.setState({ isLoading: false });
        throw error;
      }
      const errorMessage = funcGetErrorMessage(error);
      stateManager.setState({ isLoading: false, error: errorMessage });
      throw error;
    }
  },

  getPrograms: async ({
    token,
    stationId,
    type,
    date,
    signal,
  }: {
    token: string;
    stationId: string;
    type?: "today" | "weekly" | "date";
    date?: string;
    signal?: AbortSignal;
  }): Promise<Program[]> => {
    try {
      stateManager.setState({ isLoading: true, error: null });
      const result = await getPrograms({ token, stationId, type, date, signal });
      stateManager.setState({ isLoading: false });
      return result;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        stateManager.setState({ isLoading: false });
        throw error;
      }
      const errorMessage = funcGetErrorMessage(error);
      stateManager.setState({ isLoading: false, error: errorMessage });
      throw error;
    }
  },
};

export default RadikoClient;

// Reactフック：RadikoClientの状態を使用するためのカスタムフック
export function useRadikoClientState(): RequestState {
  const [state, setState] = useState<RequestState>(RadikoClient.getState());

  useCallback(() => {
    // コンポーネントマウント時にサブスクライブ
    const unsubscribe = RadikoClient.subscribe(newState => {
      setState(newState);
    });
    
    // クリーンアップ時にアンサブスクライブ
    return () => {
      unsubscribe();
    };
  }, []);

  return state;
}

/**使用例
 * import React, { useEffect } from "react";
 * import RadikoClient, { useRadikoClientState } from "./radikoClient";
 * 
 * // コンポーネント内で使用
 * function SomeComponent() {
 *   // RadikoClientの状態を取得
 *   const { isLoading, error } = useRadikoClientState();
 * 
 *   // ...他の実装
 * 
 *   // 状態を表示する例
 *   return (
 *     <div>
 *       {isLoading && <div>ロード中...</div>}
 *       {error && <div className="error">{error}</div>}
 *     </div>
 *   );
 * }
 */

/* // ...既存のインポート
import RadikoClient, { useRadikoClientState } from "./radikoClient";

export default function Page() {
  // RadikoClientの状態を使用
  const { isLoading: clientLoading, error: clientError } = useRadikoClientState();
  
  // 独自の状態（必要な場合のみ保持）
  const [localLoading, setLocalLoading] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string>("");
  
  // 全体のローディング状態（クライアントとローカル状態を統合）
  const isLoading = clientLoading || localLoading;
  // エラー状態の統合
  const error = clientError || localError;

  // ...以下は既存のコード

  // ローカルステートの代わりにクライアントのステートを使用
  // setIsLoading(true) → RadikoClient.getState().isLoading で参照
  // setError(...) → RadikoClient.getState().error で参照

  // ...
} */