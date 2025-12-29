import { useCallback, useEffect, useMemo, useReducer, useRef } from "react"

/**
 * 型安全なスキーマ検証ユーティリティ
 */
const SchemaUtils = {
  isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
  },

  isString(value: unknown): value is string {
    return typeof value === "string"
  },

  validateSSEResponse(data: unknown): data is {
    status?: string
    error?: string | Record<string, string>
  } {
    if (!this.isObject(data)) return false

    if ("status" in data && data.status !== undefined) {
      if (!this.isString(data.status)) return false
    }

    if ("error" in data && data.error !== undefined) {
      const error = data.error
      if (!this.isString(error) && !this.isObject(error)) return false
      if (this.isObject(error)) {
        return Object.values(error).every(this.isString)
      }
    }

    return true
  },
}

// 厳密に型定義された状態タイプ
type SSEState<T> =
  | { status: "disconnected"; data?: T }
  | { status: "connecting"; retryCount: number; data?: T }
  | { status: "connected"; lastEventTimestamp: number; data?: T }
  | { status: "error"; error: Error; retryCount: number; data?: T }
  | { status: "completed"; data: T }

// 拡張可能なSSEレスポンス型
type SSEResponse<T> = T & {
  status?: T extends { status: infer U } ? U : string
  error?: string | Record<string, string>
}

// 詳細なエラー分類
type SSEErrorType = "connection" | "parse" | "timeout" | "server" | "network" | "validation" | "unknown"

// 包括的なエラー情報型
interface SSEErrorInfo {
  readonly type: SSEErrorType
  readonly message: string
  readonly timestamp: number
  readonly retryCount: number
  readonly originalError?: unknown
  readonly statusCode?: number
  readonly reconnectable: boolean
}

// 柔軟なオプション設定
interface SSEOptions<T> {
  readonly enabled?: boolean
  readonly retryOnError?: boolean
  readonly retryInterval?: number
  readonly maxRetries?: number
  readonly eventTypes?: ReadonlyArray<string>
  readonly headers?: HeadersInit
  readonly timeout?: number
  readonly validateResponse?: (data: unknown) => data is T
  readonly shouldRetry?: (error: SSEErrorInfo) => boolean
  readonly transformResponse?: (data: T) => T
  readonly autoReconnect?: boolean

  // イベントハンドラ
  readonly onMessage?: (event: SSEResponse<T>) => void | Promise<void>
  readonly onError?: (error: Error, errorInfo: SSEErrorInfo) => void
  readonly onConnected?: () => void
  readonly onDisconnected?: (info: { clean: boolean }) => void
  readonly onCompleted?: (data: SSEResponse<T>) => void
  readonly onRetry?: (attempt: number, maxRetries: number) => void
}

// 詳細な戻り値型
interface SSEHookResult<T> {
  readonly status: SSEState<T>["status"]
  readonly data: T | null
  readonly error: Error | null
  readonly errorInfo: SSEErrorInfo | null
  readonly lastEventTime: number | null
  readonly retryCount: number
  readonly isComplete: boolean
  readonly isConnected: boolean
  readonly isError: boolean
  readonly isConnecting: boolean
  readonly connect: () => void
  readonly disconnect: () => void
  readonly retry: () => void
  readonly reset: () => void
}

// 完全なSSE状態
interface SSEFullState<T> {
  sseState: SSEState<T>
  errorInfo: SSEErrorInfo | null
  lastEventTime: number | null
}

// アクション定義
type SSEAction<T> =
  | { type: "CONNECT"; retryCount: number }
  | { type: "CONNECTED"; timestamp: number }
  | { type: "DISCONNECT" }
  | { type: "COMPLETED"; data: T }
  | { type: "MESSAGE_RECEIVED"; data: T; timestamp: number }
  | { type: "ERROR"; error: Error; errorInfo: SSEErrorInfo; retryCount: number }
  | { type: "RETRY"; retryCount: number }
  | { type: "RESET" }

/**
 * Reducer関数: アクションに基づいて状態を更新
 */
function sseReducer<T>(state: SSEFullState<T>, action: SSEAction<T>): SSEFullState<T> {
  switch (action.type) {
    case "CONNECT":
      return {
        ...state,
        sseState: {
          status: "connecting",
          retryCount: action.retryCount,
          data: state.sseState.data,
        },
      }

    case "CONNECTED":
      return {
        ...state,
        sseState: {
          status: "connected",
          lastEventTimestamp: action.timestamp,
          data: state.sseState.data,
        },
        lastEventTime: action.timestamp,
      }

    case "DISCONNECT":
      return {
        ...state,
        sseState: {
          status: "disconnected",
          data: state.sseState.data,
        },
      }

    case "COMPLETED":
      return {
        ...state,
        sseState: {
          status: "completed",
          data: action.data,
        },
      }

    case "MESSAGE_RECEIVED":
      return {
        ...state,
        sseState: {
          status: "connected",
          lastEventTimestamp: action.timestamp,
          data: action.data,
        },
        lastEventTime: action.timestamp,
      }

    case "ERROR":
      return {
        ...state,
        sseState: {
          status: "error",
          error: action.error,
          retryCount: action.retryCount,
          data: state.sseState.data,
        },
        errorInfo: action.errorInfo,
      }

    case "RETRY":
      return {
        ...state,
        sseState: {
          status: "connecting",
          retryCount: action.retryCount,
          data: state.sseState.data,
        },
      }

    case "RESET":
      return {
        sseState: { status: "disconnected" },
        errorInfo: null,
        lastEventTime: null,
      }

    default:
      return state
  }
}

/**
 * 最適化されたServer-Sent Events (SSE) Reactフック
 *
 * 特徴:
 * - 完全な型安全性
 * - 高性能なメモリ管理
 * - SSR互換
 * - リトライ機能
 * - カスタムバリデーション
 * - 柔軟なエラーハンドリング
 * - WeakRef対応
 * - useReducerによる最適化された状態管理
 *
 * @template T レスポンスデータの型
 */
export function useSSE<T extends Record<string, any>>(
  url: string | null,
  options: SSEOptions<T> = {},
): SSEHookResult<T> {
  // // SSR環境での早期リターン（完全なSSR互換性）
  // if (typeof window === "undefined") {
  //   return {
  //     status: "disconnected",
  //     data: null,
  //     error: null,
  //     errorInfo: null,
  //     lastEventTime: null,
  //     retryCount: 0,
  //     isComplete: false,
  //     isConnected: false,
  //     isError: false,
  //     isConnecting: false,
  //     connect: () => {},
  //     disconnect: () => {},
  //     retry: () => {},
  //     reset: () => {},
  //   };
  // }

  // コンポーネントのマウント状態を追跡
  const isMountedRef = useRef(true)

  // デフォルトオプションのマージ（デフォルト値を明示的に設定）
  const {
    enabled = true,
    retryOnError = true,
    retryInterval = 5000,
    maxRetries = 3,
    timeout = 30000,
    autoReconnect = true,
  } = options

  // オプションの安全な参照管理
  const optionsRef = useRef<SSEOptions<T>>(options)
  optionsRef.current = options

  // useReducerで状態管理を最適化
  const [{ sseState, errorInfo, lastEventTime }, dispatch] = useReducer(sseReducer<T>, {
    sseState: { status: "disconnected" },
    errorInfo: null,
    lastEventTime: null,
  })

  // 安定した参照管理（集約スタイル）
  const refs = {
    url: useRef<string | null>(url),
    eventSource: useRef<EventSource | null>(null),
    eventSourceWeak: useRef<WeakRef<EventSource> | null>(null),
    retryCount: useRef(0),
    timeout: useRef<ReturnType<typeof setTimeout> | null>(null),
    completed: useRef(false),
    isConnecting: useRef(false),
    enabled: useRef(enabled),
    shouldRetry: useRef(options.shouldRetry || ((errorInfo: SSEErrorInfo) => errorInfo.reconnectable)),
    // 非同期処理とタイマーを管理
    asyncOperations: useRef<AbortController[]>([]),
    timers: useRef<Set<ReturnType<typeof setTimeout>>>(new Set()),
  }

  // 非同期操作のクリーンアップ
  const cleanupAsyncOperations = useCallback(() => {
    refs.asyncOperations.current.forEach((controller) => {
      try {
        controller.abort()
      } catch (e) {
        // エラー無視
      }
    })
    refs.asyncOperations.current = []
  }, [refs.asyncOperations])

  // タイマープールのクリーンアップ
  const clearAllTimers = useCallback(() => {
    refs.timers.current.forEach((timer) => {
      clearTimeout(timer)
    })
    refs.timers.current.clear()
  }, [refs.timers])

  // ヘルパー関数: エラー情報の詳細作成
  const createErrorInfo = useCallback(
    (type: SSEErrorType, message: string, originalError?: unknown): SSEErrorInfo => ({
      type,
      message,
      timestamp: performance.now?.() ?? Date.now(),
      retryCount: refs.retryCount.current,
      originalError,
      statusCode: originalError instanceof Response ? originalError.status : undefined,
      reconnectable: type !== "validation" && type !== "server",
    }),
    [refs.retryCount],
  )

  // クリーンアップ処理: メモリリーク防止
  const cleanup = useCallback(
    (isForced = false) => {
      if (refs.eventSource.current) {
        try {
          refs.eventSource.current.close()
        } catch (err) {
          console.warn("EventSource cleanup error:", err)
        }
        refs.eventSource.current = null
      }

      // WeakRefの参照も確認
      if (refs.eventSourceWeak.current) {
        const eventSource = refs.eventSourceWeak.current.deref()
        if (eventSource) {
          try {
            eventSource.close()
          } catch (err) {
            // エラー無視
          }
        }
        refs.eventSourceWeak.current = null
      }

      if (refs.timeout.current) {
        clearTimeout(refs.timeout.current)
        refs.timeout.current = null
      }

      clearAllTimers()
      refs.isConnecting.current = false
    },
    [clearAllTimers, refs.eventSource, refs.eventSourceWeak, refs.isConnecting, refs.timeout],
  )

  // エラーハンドリング: 統一された処理
  const handleError = useCallback(
    (errorType: SSEErrorType, message: string, originalError?: unknown) => {
      if (!isMountedRef.current) return { error: null, errorInfo: null }

      const error = originalError instanceof Error ? originalError : new Error(message)
      const newErrorInfo = createErrorInfo(errorType, message, originalError)

      dispatch({
        type: "ERROR",
        error,
        errorInfo: newErrorInfo,
        retryCount: refs.retryCount.current,
      })

      optionsRef.current.onError?.(error, newErrorInfo)

      return { error, errorInfo: newErrorInfo }
    },
    [createErrorInfo, refs.retryCount],
  )

  // メッセージの検証とパース: 型安全な処理
  const validateAndParseMessage = useCallback(
    (data: string): SSEResponse<T> | null => {
      if (!isMountedRef.current) return null

      try {
        const parsed = JSON.parse(data)

        // 基本的なSSEレスポンス構造の検証
        if (!SchemaUtils.validateSSEResponse(parsed)) {
          throw new Error("Invalid SSE response structure")
        }

        // カスタムバリデーション
        if (optionsRef.current.validateResponse && !optionsRef.current.validateResponse(parsed)) {
          throw new Error("Response validation failed")
        }

        // レスポンス変換
        return optionsRef.current.transformResponse ? optionsRef.current.transformResponse(parsed as T) : (parsed as T)
      } catch (err) {
        handleError("validation", "Failed to parse or validate SSE message", err)
        return null
      }
    },
    [handleError],
  )

  // メッセージハンドラ（メモ化）
  const messageHandler = useCallback(
    (event: MessageEvent) => {
      if (!isMountedRef.current) return

      const parsedData = validateAndParseMessage(event.data)
      if (!parsedData) return

      const now = performance.now?.() ?? Date.now()

      // 完了状態の検出
      if (parsedData.status === "completed" || parsedData.status === "failed") {
        refs.completed.current = true
        dispatch({ type: "COMPLETED", data: parsedData })
        cleanup()
        optionsRef.current.onCompleted?.(parsedData)
        return
      }

      // 通常のデータ更新
      dispatch({
        type: "MESSAGE_RECEIVED",
        data: parsedData,
        timestamp: now,
      })

      // onMessageコールバックが非同期の場合
      if (optionsRef.current.onMessage) {
        const result = optionsRef.current.onMessage(parsedData)
        if (result && typeof result.then === "function") {
          const controller = new AbortController()
          refs.asyncOperations.current.push(controller)

          result
            .catch((err) => {
              if (!controller.signal.aborted && isMountedRef.current) {
                console.error("Error in onMessage callback:", err)
              }
            })
            .finally(() => {
              if (isMountedRef.current) {
                const index = refs.asyncOperations.current.indexOf(controller)
                if (index !== -1) {
                  refs.asyncOperations.current.splice(index, 1)
                }
              }
            })
        }
      }
    },
    [validateAndParseMessage, refs.completed, refs.asyncOperations, cleanup],
  )

  // 前方宣言
  let connect = useCallback(() => {
    // 初期ダミー実装 (後で上書きされる)
  }, [])
  // エラーハンドラ（メモ化）
  const errorHandler: (err: Event) => void = useCallback(
    (err: Event): void => {
      if (!isMountedRef.current) return

      const error = err instanceof Error ? err : new Error("SSE connection failed")
      const eventSource = refs.eventSource.current

      if (!eventSource) return

      // 接続が閉じられた場合
      if (eventSource.readyState === EventSource.CLOSED) {
        dispatch({ type: "DISCONNECT" })
        handleError("connection", "Connection closed", error)
        optionsRef.current.onDisconnected?.({ clean: false })
        return
      }

      // 再試行条件の評価
      const errorInfo = createErrorInfo("connection", error.message, error)

      if (
        refs.shouldRetry.current(errorInfo) &&
        retryOnError &&
        refs.retryCount.current < maxRetries &&
        autoReconnect
      ) {
        refs.retryCount.current += 1
        optionsRef.current.onRetry?.(refs.retryCount.current, maxRetries)

        dispatch({ type: "RETRY", retryCount: refs.retryCount.current })

        // 安全な再接続
        cleanup()
        const timer = setTimeout(() => {
          if (isMountedRef.current) {
            refs.isConnecting.current = false
            connect()
          }
        }, retryInterval)

        refs.timeout.current = timer
        refs.timers.current.add(timer)
      } else {
        handleError("connection", `Failed after ${refs.retryCount.current} retries`, error)
        cleanup()
      }
    },
    [
      refs.eventSource,
      refs.shouldRetry,
      refs.retryCount,
      refs.timeout,
      refs.timers,
      refs.isConnecting,
      createErrorInfo,
      retryOnError,
      maxRetries,
      autoReconnect,
      handleError,
      cleanup,
      retryInterval,
      connect,
    ],
  )

  // 接続処理: 最適化された実装
  connect = useCallback(() => {
    if (!isMountedRef.current) return

    // 冗長接続防止
    if (
      !refs.url.current ||
      !optionsRef.current.enabled ||
      refs.completed.current ||
      refs.isConnecting.current ||
      refs.eventSource.current
    ) {
      return
    }

    refs.isConnecting.current = true
    cleanup(true) // 既存接続を強制クリーンアップ

    try {
      // キャッシュ防止のタイムスタンプ付きURL
      const url = new URL(refs.url.current, window.location.origin)
      url.searchParams.set("_t", String(performance.now?.() ?? Date.now()))

      // EventSourceインスタンス作成
      const eventSource = new EventSource(url.toString(), {
        withCredentials: true,
      })

      refs.eventSource.current = eventSource
      refs.eventSourceWeak.current = new WeakRef(eventSource)

      // 状態更新
      dispatch({ type: "CONNECT", retryCount: refs.retryCount.current })

      // タイムアウト設定
      if (timeout > 0) {
        const timer = setTimeout(() => {
          if (isMountedRef.current && refs.eventSource.current && refs.isConnecting.current) {
            handleError("timeout", `Connection timed out after ${timeout}ms`)
            cleanup()
          }
          refs.timers.current.delete(timer)
        }, timeout)

        refs.timeout.current = timer
        refs.timers.current.add(timer)
      }

      // イベントハンドラの設定（メモ化したハンドラを使用）
      eventSource.onopen = () => {
        if (!isMountedRef.current) return

        refs.isConnecting.current = false

        if (refs.timeout.current) {
          clearTimeout(refs.timeout.current)
          refs.timeout.current = null
        }

        const timestamp = performance.now?.() ?? Date.now()
        dispatch({ type: "CONNECTED", timestamp })

        refs.retryCount.current = 0
        optionsRef.current.onConnected?.()
      }

      eventSource.onmessage = messageHandler
      eventSource.onerror = errorHandler

      // 追加イベントタイプのリスナー登録
      if (optionsRef.current.eventTypes && optionsRef.current.eventTypes.length > 0) {
        optionsRef.current.eventTypes.forEach((eventType) => {
          const customHandler = (e: Event) => {
            if (!isMountedRef.current || !e || !(e instanceof MessageEvent)) return

            try {
              const parsedData = validateAndParseMessage(e.data)
              if (parsedData) {
                optionsRef.current.onMessage?.(parsedData)
              }
            } catch (err) {
              handleError("parse", `Failed to parse ${eventType} event`, err)
            }
          }

          eventSource.addEventListener(eventType, customHandler)
        })
      }
    } catch (err) {
      refs.isConnecting.current = false
      handleError("connection", "Failed to create EventSource", err)
    }
  }, [
    refs.url,
    refs.completed,
    refs.isConnecting,
    refs.eventSource,
    refs.eventSourceWeak,
    refs.retryCount,
    refs.timeout,
    refs.timers,
    cleanup,
    timeout,
    messageHandler,
    errorHandler,
    handleError,
    validateAndParseMessage,
  ])

  // URL/enabled変更の監視: 最適化された依存関係
  useEffect(() => {
    const isUrlChanged = url !== refs.url.current
    const isEnabledChanged = enabled !== refs.enabled.current

    // URLが変更された場合
    if (isUrlChanged) {
      refs.url.current = url
      refs.completed.current = false
      cleanup(true)

      if (url && enabled) {
        connect()
      }
    }
    // enabledのみが変更された場合
    else if (isEnabledChanged && refs.url.current) {
      refs.enabled.current = enabled

      if (enabled) {
        if (!refs.eventSource.current && !refs.isConnecting.current) {
          connect()
        }
      } else {
        cleanup(true)
        dispatch({ type: "DISCONNECT" })
      }
    }

    // クリーンアップ関数
    return () => {
      cleanup(true)
    }
  }, [url, enabled, cleanup, connect, refs.url, refs.enabled, refs.completed, refs.eventSource, refs.isConnecting])

  // コンポーネントのマウント状態を追跡
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      cleanup(true)
      cleanupAsyncOperations()
      clearAllTimers()
    }
  }, [cleanup, cleanupAsyncOperations, clearAllTimers])

  // 再試行関数
  const retry = useCallback(() => {
    if (!isMountedRef.current) return

    if (sseState.status === "error" || sseState.status === "disconnected") {
      refs.retryCount.current += 1
      refs.completed.current = false
      refs.isConnecting.current = false
      connect()
    }
  }, [connect, refs.completed, refs.isConnecting, refs.retryCount, sseState.status])

  // リセット関数
  const reset = useCallback(() => {
    if (!isMountedRef.current) return

    cleanup(true)
    refs.retryCount.current = 0
    refs.completed.current = false
    refs.isConnecting.current = false
    dispatch({ type: "RESET" })
  }, [cleanup, refs.completed, refs.isConnecting, refs.retryCount])

  // 切断関数
  const disconnect = useCallback(() => {
    if (!isMountedRef.current) return

    cleanup(true)
    dispatch({ type: "DISCONNECT" })
    optionsRef.current.onDisconnected?.({ clean: true })
  }, [cleanup])

  // 最適化された戻り値（不要な再計算を避ける）
  return useMemo(
    () => ({
      status: sseState.status,
      data: sseState.data ?? null,
      // 型ガードはこのまま維持
      error: sseState.status === "error" ? sseState.error : null,
      errorInfo,
      lastEventTime,
      retryCount: refs.retryCount.current,
      connect,
      disconnect,
      retry,
      reset,
      isComplete: sseState.status === "completed",
      isConnected: sseState.status === "connected",
      isError: sseState.status === "error",
      isConnecting: sseState.status === "connecting",
    }),
    [
      sseState, // オブジェクト全体を依存に含める（注：再レンダリングが増える可能性あり）
      errorInfo,
      lastEventTime,
      refs.retryCount,
      connect,
      disconnect,
      retry,
      reset,
    ],
  )
}
