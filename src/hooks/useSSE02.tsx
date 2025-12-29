import { useCallback, useEffect, useMemo, useRef, useState } from "react"

// 定数定義
const DEFAULT_RETRY_COUNT = 3
const DEFAULT_RETRY_INTERVAL = 1000 // ms

// SSE接続状態の型
type SSEConnectionStatus = "disconnected" | "connecting" | "connected"

// SSEエラーの型
interface SSEConnectionError {
  readonly message: string
  readonly timestamp: number
  readonly originalError?: unknown
}

// 引数の型
export interface SSEProps<T> {
  readonly url: string | null
  readonly retry?: number // リトライ回数,デフォルトは3回
  readonly onMessage?: (_data: T) => void
  readonly onError?: (_error: SSEConnectionError) => void
}

// 戻り値の型
export interface SSEHookResult<T> {
  readonly data: T | null
  readonly sseStatus: SSEConnectionStatus
  readonly sseError: SSEConnectionError | null
  readonly disconnect: () => void
  readonly reconnect: () => void
}

export function useSSE<T, D = unknown>({ url, ...options }: SSEProps<T>, dependencies: D[]): SSEHookResult<T> {
  const isSSR = typeof window === "undefined" || typeof EventSource === "undefined"

  const [data, setData] = useState<T | null>(null)
  const [sseStatus, setSseStatus] = useState<SSEConnectionStatus>("disconnected")
  const [sseError, setSseError] = useState<SSEConnectionError | null>(null)

  const urlRef = useRef(url)
  const optionsRef = useRef(options)
  const eventSourceRef = useRef<EventSource | null>(null)
  const retryCountRef = useRef(0)
  const connectRef = useRef<() => void>(() => {})

  // INFO: dependencies の有効性検証ロジック:
  // - dependencies配列内に1つでもfalsyな値、または{}、または[]があればfalse
  // - dependenciesが空配列または全てがtruthyの場合はtrue
  const isDependenciesValid = useMemo(() => {
    const deps = dependencies ?? []

    // 空配列ならtrue
    if (deps.length === 0) {
      return true
    }

    return deps.every((dep) => {
      // nullやundefinedをチェック
      if (dep == null) return false
      // オブジェクトや配列の場合、空かどうかをチェック
      if (typeof dep === "object") {
        return Object.keys(dep).length > 0
      }
      // それ以外はtruthy/falsyで判定
      return Boolean(dep)
    })
  }, [dependencies])

  // オプションの更新
  useEffect(() => {
    optionsRef.current = options
  }, [options])

  // URLの更新
  useEffect(() => {
    urlRef.current = url
  }, [url])

  // クリーンアップ関数
  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setSseStatus("disconnected")
  }, [])

  // 接続処理
  const connect = useCallback(() => {
    if (isSSR || !urlRef.current) {
      cleanup()
      return
    }

    // 新規接続時は既存データをリセット
    if (!eventSourceRef.current) {
      // 同期的なsetStateを避けるためにマイクロタスクを使用
      queueMicrotask(() => {
        setData(null)
        setSseError(null)
      })
      retryCountRef.current = 0
    }
    const { retry = DEFAULT_RETRY_COUNT } = optionsRef.current || {}

    // 同期的なsetStateを避けるためにマイクロタスクを使用
    queueMicrotask(() => {
      setSseStatus("connecting")
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
          optionsRef.current?.onMessage?.(newData)
        } catch (err) {
          const error = {
            message: "メッセージの解析に失敗しました",
            timestamp: Date.now(),
            originalError: err,
          }
          setSseError(error)
          optionsRef.current?.onError?.(error)
          cleanup()
        }
      }

      eventSource.onerror = (err) => {
        // リトライ処理
        if (retryCountRef.current < retry) {
          retryCountRef.current++
          setTimeout(() => connectRef.current(), DEFAULT_RETRY_INTERVAL)
        } else {
          const error = {
            message: "SSE接続でエラーが発生しました",
            timestamp: Date.now(),
            originalError: err,
          }
          setSseError(error)
          optionsRef.current?.onError?.(error)
          cleanup()
        }
      }
    } catch (err) {
      const error = {
        message: "EventSourceの作成に失敗しました",
        timestamp: Date.now(),
        originalError: err,
      }
      setSseError(error)
      optionsRef.current?.onError?.(error)
      cleanup()
    }
  }, [isSSR, cleanup])

  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  // 手動切断関数
  const disconnect = useCallback(() => {
    cleanup()
  }, [cleanup])

  // 再接続関数
  const reconnect = useCallback(() => {
    urlRef.current = url
    if (!isSSR && url !== null && isDependenciesValid) {
      // 同期的なsetStateを避けるためにマイクロタスクを使用
      queueMicrotask(() => {
        setData(null)
        setSseError(null)
      })
      cleanup()
      connect()
    }
  }, [cleanup, connect, isDependenciesValid, isSSR, url])

  // 依存配列の変更を監視して再接続
  useEffect(() => {
    queueMicrotask(() => {
      reconnect()
    })
    return cleanup
  }, [reconnect, cleanup, isSSR, isDependenciesValid, url])

  // フックの戻り値
  return useMemo(
    () => ({
      data,
      sseStatus,
      sseError,
      disconnect,
      reconnect,
    }),
    [data, sseStatus, sseError, disconnect, reconnect],
  )
}
