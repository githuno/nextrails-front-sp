import { useCallback, useEffect, useMemo, useRef, useState } from "react"

// SSE接続状態の型
type SSEConnectionStatus = "disconnected" | "connecting" | "connected"

// SSEエラーの型
interface SSEConnectionError {
  readonly message: string
  readonly timestamp: number
  readonly originalError?: unknown
}

// export interface Message<T> {
//   data: T | null
//   sseStatus: SSEConnectionStatus
//   sseError: SSEConnectionError | null
// }

// SSEオプションの型
export interface SSEOptions<T> {
  readonly connectionKey?: string | null
  readonly retry?: number // リトライ回数,デフォルトは3回
  readonly onMessage?: (_data: T) => void
  readonly onError?: (_error: SSEConnectionError) => void
}

// フックの戻り値の型
export interface SSEHookResult<T> {
  readonly data: T | null
  readonly sseStatus: SSEConnectionStatus
  readonly sseError: SSEConnectionError | null
  readonly disconnect: () => void
  readonly reconnect: () => void
}

export function useSSE<T>(url: string | null, options: SSEOptions<T> = {}): SSEHookResult<T> {
  const isSSR = typeof window === "undefined" || typeof EventSource === "undefined"

  const urlRef = useRef(url)
  const optionsRef = useRef(options)
  const eventSourceRef = useRef<EventSource | null>(null)
  const connectionKeyRef = useRef(options.connectionKey)
  const retryCountRef = useRef(0)
  const connectRef = useRef<() => void>(() => {})

  const [data, setData] = useState<T | null>(null)
  const [sseStatus, setSseStatus] = useState<SSEConnectionStatus>("disconnected")
  const [sseError, setSseError] = useState<SSEConnectionError | null>(null)
  const [key, setKey] = useState(options.connectionKey)
  const [prevConnection, setPrevConnection] = useState(options.connectionKey)
  const [prevUrl, setPrevUrl] = useState(url)

  // options.connectionKeyの変更をレンダリング中に反映
  if (options.connectionKey !== prevConnection) {
    setPrevConnection(options.connectionKey)
    setKey(options.connectionKey)
  }

  // URLの変更をレンダリング中に反映
  if (url !== prevUrl) {
    setPrevUrl(url)
  }

  // Refの同期をEffectで行う (React 19対策)
  useEffect(() => {
    connectionKeyRef.current = options.connectionKey
  }, [options.connectionKey])

  useEffect(() => {
    urlRef.current = url
  }, [url])

  // オプションの更新
  useEffect(() => {
    optionsRef.current = options
  }, [options])

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setSseStatus("disconnected")
  }, [])

  const handleError = useCallback(
    (message: string, originalError?: unknown) => {
      const error = {
        message,
        timestamp: Date.now(),
        originalError,
      }
      setSseError(error)
      optionsRef.current.onError?.(error)
    },
    [setSseError],
  )

  // 接続処理
  const connect = useCallback(() => {
    // INFO: connectionKeyが与えられなかったとき（=undefined）は接続する
    if (isSSR || !urlRef.current || connectionKeyRef.current === null) {
      cleanup()
      return
    }

    // 既存の接続を閉じる
    cleanup()

    const { retry = 3 } = optionsRef.current

    // 同期的なsetStateを避けるためにマイクロタスクを使用
    queueMicrotask(() => {
      setSseStatus("connecting")
      setSseError(null)
    })

    try {
      const eventSource = new EventSource(urlRef.current)
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        setSseStatus("connected")
        retryCountRef.current = 0 // 接続成功時にリトライ回数をリセット
      }

      eventSource.onmessage = (event) => {
        try {
          const parsedData = JSON.parse(event.data)
          const newData = parsedData.data || parsedData
          setData(newData)
          optionsRef.current.onMessage?.(newData)
        } catch (err) {
          handleError("メッセージの解析に失敗しました", err)
        }
      }

      eventSource.onerror = (err) => {
        handleError("SSE接続でエラーが発生しました", err)

        // リトライ処理
        if (retryCountRef.current < retry) {
          retryCountRef.current++
          console.log(`SSE接続リトライ: ${retryCountRef.current}/${retry}`)
          setTimeout(() => connectRef.current(), 1000) // 1秒後にリトライ
        } else {
          console.log("SSE接続エラー")
          retryCountRef.current = 0
          setSseStatus("disconnected")
          cleanup()
        }
      }
    } catch (err) {
      handleError("EventSourceの作成に失敗しました", err)
      cleanup()
    }
  }, [isSSR, cleanup, handleError])

  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  // keyの変更に基づいて接続制御
  useEffect(() => {
    if (connectionKeyRef.current !== null) {
      queueMicrotask(() => {
        connect()
      })
    } else {
      queueMicrotask(() => {
        cleanup()
      })
    }

    return cleanup
  }, [key, url, connect, cleanup])

  // 非活性時はステータスをdisconnectedに同期
  if (key === null && sseStatus !== "disconnected") {
    setSseStatus("disconnected")
  }

  // 手動切断関数
  const disconnect = useCallback(() => {
    connectionKeyRef.current = null
    cleanup()
  }, [cleanup])

  // 再接続関数
  const reconnect = useCallback(() => {
    if (connectionKeyRef.current === null) {
      connectionKeyRef.current = "reconnect" // 再接続のための仮キー
    }
    connect()
  }, [connect])

  // フックの戻り値
  return useMemo(
    () => ({
      data,
      sseStatus,
      sseError,
      disconnect,
      reconnect,
    }),
    [sseStatus, data, sseError, disconnect, reconnect],
  )
}
