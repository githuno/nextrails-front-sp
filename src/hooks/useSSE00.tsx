import { useCallback, useEffect, useMemo, useRef, useState } from "react"

// SSE接続状態の型
export type SSEConnectionStatus = "disconnected" | "connecting" | "connected" | "error"

// SSEの状態を表す型
export interface SSEState<T> {
  connectionStatus: SSEConnectionStatus
  data: T | null
  error?: Error
}

// エラー情報の型
interface SSEErrorInfo {
  message: string
  timestamp: number
  retryCount: number
  originalError?: unknown
}

// オプションの型定義
export interface SSEOptions<T> {
  readonly connectionKey?: string | null
  readonly isCompleted?: boolean
  readonly retryOnError?: boolean
  readonly retryInterval?: number
  readonly maxRetries?: number
  readonly timeout?: number
  readonly onMessage?: (_data: T) => void
  readonly onError?: (_error: Error, _errorInfo: SSEErrorInfo) => void
  readonly onConnected?: () => void
  readonly onDisconnected?: () => void
  readonly onCompleted?: (_data: T) => void
  readonly shouldDisconnect?: (_data: T) => boolean
  readonly shouldComplete?: (_data: T) => boolean
}

// フックの戻り値の型
export interface SSEHookResult<T> {
  readonly connectionStatus: SSEConnectionStatus
  readonly data: T | null
  readonly error: Error | null
  readonly errorInfo: SSEErrorInfo | null
}

export function useSSE<T>(url: string | null, options: SSEOptions<T> = {}): SSEHookResult<T> {
  const isSSR = typeof EventSource === "undefined" || typeof window === "undefined"

  const optionsRef = useRef({ ...options })
  const urlRef = useRef<string | null>(url)
  const eventSourceRef = useRef<EventSource | null>(null)
  const retryCountRef = useRef(0)
  const timeoutIdRef = useRef<number | null>(null)
  const completedRef = useRef(false)
  const connectRef = useRef<() => void>(() => {})
  const prevIsCompletedRef = useRef(options.isCompleted ?? false)

  const [key, setKey] = useState(options.connectionKey)
  const [prevConnection, setPrevConnection] = useState(options.connectionKey)
  const [prevUrl, setPrevUrl] = useState(url)

  const [state, setState] = useState<SSEState<T>>({
    connectionStatus: "disconnected",
    data: null,
  })
  const [errorInfo, setErrorInfo] = useState<SSEErrorInfo | null>(null)

  // options.connectionKeyの変更をレンダリング中に反映
  if (options.connectionKey !== prevConnection) {
    setPrevConnection(options.connectionKey)
    setKey(options.connectionKey)
  }

  // URLの変更をレンダリング中に反映
  if (url !== prevUrl) {
    setPrevUrl(url)
    // URLが変わったときは必ずデータをリセット
    setState((prev) => ({
      ...prev,
      data: null,
      error: undefined,
    }))
  }

  // Refの同期をEffectで行う (React 19対策)
  useEffect(() => {
    if (options.connectionKey) {
      completedRef.current = false
    }
  }, [options.connectionKey])

  useEffect(() => {
    completedRef.current = false
  }, [url])

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

  const handleError = useCallback((message: string, originalError?: unknown) => {
    const error = originalError instanceof Error ? originalError : new Error(message)
    const newErrorInfo: SSEErrorInfo = {
      message,
      timestamp: Date.now(),
      retryCount: retryCountRef.current,
      originalError,
    }

    setErrorInfo(newErrorInfo)
    setState((prev) => ({ ...prev, connectionStatus: "error", error }))
    optionsRef.current.onError?.(error, newErrorInfo)
  }, [])

  const connect = useCallback(() => {
    if (isSSR || !urlRef.current || !key) {
      cleanup()
      return
    }

    // 接続前に前回の接続をクローズ
    cleanup()

    // 同期的なsetStateを避けるためにマイクロタスクを使用
    queueMicrotask(() => {
      setState({ connectionStatus: "connecting", data: null, error: undefined })
    })

    try {
      const eventSource = new EventSource(urlRef.current)
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        setState((prev) => ({ ...prev, connectionStatus: "connected" }))
        retryCountRef.current = 0
        optionsRef.current.onConnected?.()
      }

      eventSource.onmessage = (event) => {
        try {
          const parsedData = JSON.parse(event.data)
          const data = parsedData.data || parsedData

          setState((prev) => ({ ...prev, connectionStatus: "connected", data }))
          optionsRef.current.onMessage?.(data)

          // データに基づいて監視を停止するかどうかをチェック
          if (optionsRef.current.shouldDisconnect && optionsRef.current.shouldDisconnect(data)) {
            setKey(null)
          }

          // データに基づいて完了マークするかどうかをチェック
          if (optionsRef.current.shouldComplete && optionsRef.current.shouldComplete(data)) {
            completedRef.current = true
            optionsRef.current.onCompleted?.(data)
            cleanup()
          }
        } catch (err) {
          handleError("メッセージの解析に失敗しました", err)
        }
      }

      eventSource.onerror = () => {
        const { retryOnError = true, maxRetries = 3, retryInterval = 5000 } = optionsRef.current

        if (retryOnError && retryCountRef.current < maxRetries) {
          retryCountRef.current += 1
          setState((prev) => ({ ...prev, connectionStatus: "connecting" }))
          timeoutIdRef.current = window.setTimeout(() => connectRef.current(), retryInterval)
        } else {
          handleError("SSE接続に失敗しました")
          cleanup()
        }
      }
    } catch (err) {
      handleError("EventSourceの作成に失敗しました", err)
    }
  }, [isSSR, key, cleanup, handleError])

  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  // オプションの更新
  useEffect(() => {
    optionsRef.current = { ...options }
  }, [options])

  // isCompleted状態の変更監視
  useEffect(() => {
    const isCompleted = options.isCompleted ?? false
    const prevIsCompleted = prevIsCompletedRef.current

    // 値が変わった場合のみ処理
    if (isCompleted !== prevIsCompleted) {
      prevIsCompletedRef.current = isCompleted

      if (isCompleted && state.data) {
        // trueに変わった場合は完了処理を実行
        completedRef.current = true
        cleanup()
        optionsRef.current.onCompleted?.(state.data)
      } else if (!isCompleted) {
        // falseに変わった場合は再接続可能にする
        completedRef.current = false
      }
    }
  }, [options.isCompleted, cleanup, state.data])

  // 接続状態の管理
  useEffect(() => {
    if (key && !completedRef.current) {
      connect()
    } else if (!key) {
      cleanup()
    }
  }, [key, connect, cleanup])

  // 非活性時はステータスをdisconnectedに同期
  if (!key && state.connectionStatus !== "disconnected") {
    setState((prev) => ({ ...prev, connectionStatus: "disconnected" }))
  }

  // 非活性時のコールバック実行
  useEffect(() => {
    if (!key) {
      optionsRef.current.onDisconnected?.()
    }
  }, [key])

  // URL変更時の処理
  useEffect(() => {
    if (isSSR) return

    if (url !== urlRef.current) {
      urlRef.current = url
      if (url && key) {
        connect()
      } else {
        cleanup()
      }
    }

    return cleanup
  }, [url, key, connect, cleanup, isSSR])

  return useMemo(
    () => ({
      connectionStatus: state.connectionStatus,
      data: state.data,
      error: state.error ?? null,
      errorInfo,
    }),
    [state, errorInfo],
  )
}
