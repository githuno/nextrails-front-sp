import { useCallback, useEffect, useMemo, useRef, useState } from "react"

// SSEイベントの状態を表す型
type SSEState<T> =
  | { status: "disconnected"; data?: T }
  | { status: "connecting"; retryCount: number; data?: T }
  | { status: "connected"; lastEventTimestamp?: number; data?: T }
  | { status: "error"; error: Error; retryCount: number; data?: T }
  | { status: "completed"; data: T }

// SSEレスポンスの型定義
type SSEResponse<T> = T & {
  status?: T extends { status: infer U } ? U : string
  error?: string | Record<string, string>
}

// SSEエラーの種類
type SSEErrorType = "connection" | "parse" | "timeout" | "server" | "unknown"

// エラー詳細情報を保持する型
type SSEErrorInfo = {
  type: SSEErrorType
  message: string
  timestamp: number
  retryCount: number
  originalError?: unknown
}

// オプションの型定義
interface SSEOptions<T> {
  readonly enabled?: boolean
  readonly retryOnError?: boolean
  readonly retryInterval?: number
  readonly maxRetries?: number
  readonly eventTypes?: ReadonlyArray<string>
  readonly headers?: Record<string, string>
  readonly timeout?: number // タイムアウト時間（ミリ秒）

  // イベントハンドラ
  readonly onMessage?: (_event: SSEResponse<T>) => void
  readonly onError?: (_error: Error, _errorInfo: SSEErrorInfo) => void
  readonly onConnected?: () => void
  readonly onDisconnected?: () => void
  readonly onCompleted?: (_data: SSEResponse<T>) => void
  readonly onRetry?: (_attempt: number, _maxRetries: number) => void
}

// フックの戻り値の型
interface SSEHookResult<T> {
  readonly status: SSEState<T>["status"]
  readonly data: T | null
  readonly error: Error | null
  readonly errorInfo: SSEErrorInfo | null
  readonly connect: () => void
  readonly disconnect: () => void
  readonly isComplete: boolean
  readonly isConnected: boolean
  readonly isError: boolean
  readonly isConnecting: boolean
  readonly retry: () => void
  readonly reset: () => void
}

/**
 * Server-Sent Events (SSE) を使用するための React フック
 * @template T レスポンスデータの型
 * @param url SSE接続先のURL
 * @param options SSE接続オプション
 * @returns SSE接続の状態と制御メソッド
 */
export function useSSE<T extends Record<string, any> = any>(
  url: string | null,
  options: SSEOptions<T> = {},
): SSEHookResult<T> {
  const isSSR = typeof window === "undefined"

  // enabledの値を直接stateとして管理
  const [isEnabled, setIsEnabled] = useState(options.enabled ?? true)
  const [prevEnabled, setPrevEnabled] = useState(options.enabled ?? true)

  // options.enabledの変更をレンダリング中に反映
  if (options.enabled !== prevEnabled) {
    setPrevEnabled(options.enabled ?? true)
    setIsEnabled(options.enabled ?? true)
  }

  const optionsRef = useRef<SSEOptions<T>>({
    enabled: true,
    retryOnError: true,
    retryInterval: 5000,
    maxRetries: 3,
    ...options,
  })

  // optionsの更新を確実に反映
  useEffect(() => {
    optionsRef.current = {
      ...optionsRef.current,
      ...options,
    }
  }, [options])

  const [state, setState] = useState<SSEState<T>>({ status: "disconnected" })
  const [errorInfo, setErrorInfo] = useState<SSEErrorInfo | null>(null)

  const urlRef = useRef<string | null>(url)
  const eventSourceRef = useRef<EventSource | null>(null)
  const retryCountRef = useRef(0)
  const timeoutIdRef = useRef<number | null>(null)
  const completedRef = useRef(false)
  const connectRef = useRef<() => void>(() => {})

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    if (timeoutIdRef.current !== null) {
      clearTimeout(timeoutIdRef.current)
      timeoutIdRef.current = null
    }
  }, [])

  const handleError = useCallback((errorType: SSEErrorType, message: string, originalError?: unknown) => {
    const error = originalError instanceof Error ? originalError : new Error(message)

    const newErrorInfo: SSEErrorInfo = {
      type: errorType,
      message,
      timestamp: Date.now(),
      retryCount: retryCountRef.current,
      originalError,
    }

    setErrorInfo(newErrorInfo)
    setState({ status: "error", error, retryCount: retryCountRef.current })

    optionsRef.current.onError?.(error, newErrorInfo)
  }, [])

  const connect = useCallback(() => {
    if (isSSR || !urlRef.current || !isEnabled || completedRef.current) {
      cleanup()
      return
    }

    cleanup()
    setState({ status: "connecting", retryCount: retryCountRef.current })

    try {
      const eventSource = new EventSource(urlRef.current)
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        setState({ status: "connected" })
        retryCountRef.current = 0
        optionsRef.current.onConnected?.()
      }

      eventSource.onmessage = (event) => {
        try {
          const parsedData = JSON.parse(event.data) as SSEResponse<T>
          // statusがnullの場合に通信を停止
          if (parsedData.status === null) {
            completedRef.current = true
            setState({ status: "disconnected", data: parsedData })
            cleanup()
            optionsRef.current.onCompleted?.(parsedData)
            return
          }
          setState((prev) => ({
            ...prev,
            status: "connected",
            data: parsedData,
          }))

          if (parsedData.status === "completed") {
            completedRef.current = true
            setState({ status: "completed", data: parsedData })
            cleanup()
            optionsRef.current.onCompleted?.(parsedData)
          } else {
            optionsRef.current.onMessage?.(parsedData)
          }
        } catch (err) {
          handleError("parse", "Failed to parse SSE message", err)
        }
      }

      eventSource.onerror = () => {
        if (optionsRef.current.retryOnError && retryCountRef.current < optionsRef.current.maxRetries!) {
          retryCountRef.current += 1
          setState({ status: "connecting", retryCount: retryCountRef.current })
          timeoutIdRef.current = window.setTimeout(() => connectRef.current(), optionsRef.current.retryInterval!)
        } else {
          handleError("connection", "Failed to connect to SSE")
          cleanup()
        }
      }
    } catch (err) {
      handleError("connection", "Failed to create EventSource", err)
    }
  }, [cleanup, handleError, isSSR, isEnabled])

  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  // enabled状態の変更を監視する専用のEffect
  useEffect(() => {
    if (isEnabled) {
      connect()
    } else {
      cleanup()
    }
  }, [isEnabled, connect, cleanup])

  // 非活性時はステータスをdisconnectedに同期
  if (!isEnabled && state.status !== "disconnected") {
    setState({ status: "disconnected" })
  }

  // URL変更時の処理
  useEffect(() => {
    if (isSSR) return
    if (url !== urlRef.current) {
      urlRef.current = url
      completedRef.current = false
      if (url && isEnabled) {
        connect()
      } else {
        cleanup()
      }
    }
    return cleanup
  }, [url, isEnabled, connect, cleanup, isSSR])

  return useMemo(() => {
    const { status } = state
    return {
      status,
      data: state.data ?? null,
      error: state.status === "error" ? state.error : null,
      errorInfo,
      connect,
      disconnect: cleanup,
      retry: connect,
      reset: () => {
        cleanup()
        retryCountRef.current = 0
        setState({ status: "disconnected" })
        setErrorInfo(null)
      },
      isComplete: status === "completed",
      isConnected: status === "connected",
      isError: status === "error",
      isConnecting: status === "connecting",
    }
  }, [state, errorInfo, connect, cleanup])
}
