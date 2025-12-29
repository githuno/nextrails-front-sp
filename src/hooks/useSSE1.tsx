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
interface SSEOptions<T> {
  readonly enabled?: boolean
  readonly isCompleted?: boolean
  readonly retryOnError?: boolean
  readonly retryInterval?: number
  readonly maxRetries?: number
  readonly timeout?: number
  readonly onMessage?: (data: T) => void
  readonly onError?: (error: Error, errorInfo: SSEErrorInfo) => void
  readonly onConnected?: () => void
  readonly onDisconnected?: () => void
  readonly onCompleted?: (data: T) => void
  readonly shouldDisconnect?: (data: T) => boolean
  readonly shouldComplete?: (data: T) => boolean
}

// フックの戻り値の型
interface SSEHookResult<T> {
  readonly connectionStatus: SSEConnectionStatus
  readonly data: T | null
  readonly error: Error | null
  readonly errorInfo: SSEErrorInfo | null
}

export function useSSE<T>(url: string | null, options: SSEOptions<T> = {}): SSEHookResult<T> {
  const isSSR = typeof window === "undefined"
  const [isEnabled, setIsEnabled] = useState(options.enabled ?? true)
  const [state, setState] = useState<SSEState<T>>({
    connectionStatus: "disconnected",
    data: null,
  })
  const [errorInfo, setErrorInfo] = useState<SSEErrorInfo | null>(null)

  const optionsRef = useRef({ ...options })
  const urlRef = useRef<string | null>(url)
  const eventSourceRef = useRef<EventSource | null>(null)
  const retryCountRef = useRef(0)
  const timeoutIdRef = useRef<number | null>(null)
  const completedRef = useRef(false)
  const connectRef = useRef<() => void>(() => {})
  const prevIsCompletedRef = useRef(options.isCompleted ?? false)
  const prevEnabledRef = useRef(options.enabled ?? true)

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
    if (isSSR || !urlRef.current || !isEnabled) {
      cleanup()
      return
    }

    // 接続前に前回の接続をクローズ
    cleanup()
    setState({ connectionStatus: "connecting", data: null, error: undefined })

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
            setIsEnabled(false)
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
  }, [isSSR, isEnabled, cleanup, handleError])

  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  // オプションの更新
  useEffect(() => {
    optionsRef.current = { ...options }
  }, [options])

  // enabled状態の変更監視
  useEffect(() => {
    const newEnabled = options.enabled ?? true
    const prevEnabled = prevEnabledRef.current

    // 値が変わった場合のみ処理
    if (newEnabled !== prevEnabled) {
      prevEnabledRef.current = newEnabled

      // falseからtrueに変わる場合はcompletedRefをリセット
      if (newEnabled && !prevEnabled) {
        completedRef.current = false
      }

      queueMicrotask(() => {
        setIsEnabled(newEnabled)
      })
    }
  }, [options.enabled])

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
    if (isEnabled && !completedRef.current) {
      queueMicrotask(() => {
        connect()
      })
    } else if (!isEnabled) {
      cleanup()
      queueMicrotask(() => {
        setState((prev) => ({ ...prev, connectionStatus: "disconnected" }))
      })
      optionsRef.current.onDisconnected?.()
    }
  }, [isEnabled, connect, cleanup])

  // URL変更時の処理
  useEffect(() => {
    if (isSSR) return

    if (url !== urlRef.current) {
      urlRef.current = url
      completedRef.current = false

      // URLが変わったときは必ずデータをリセット
      queueMicrotask(() => {
        setState((prev) => ({
          ...prev,
          data: null,
          error: undefined,
        }))
      })

      if (url && isEnabled) {
        queueMicrotask(() => {
          connect()
        })
      } else {
        cleanup()
      }
    }

    return cleanup
  }, [url, isEnabled, connect, cleanup, isSSR])

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
