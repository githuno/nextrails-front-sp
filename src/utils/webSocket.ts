export interface WebSocketOptions {
  reconnectInterval?: number
  maxReconnectInterval?: number
  heartbeatInterval?: number
  heartbeatTimeout?: number
  maxReconnectAttempts?: number
  maxHeartbeatTimeouts?: number
  onOpen?: (event: Event) => void
  onMessage?: (event: MessageEvent) => void
  onClose?: (event: CloseEvent) => void
  onError?: (event: Event) => void
}

export interface WebSocketMessage {
  type: string
  [key: string]: unknown
}

// https://jsdev.space/snippets/comprehensive-websocket-client/

/**
 * 再利用可能なWebSocketクライアント
 * - 型安全性の向上
 * - SSR互換性（isServerチェック）
 * - メモリリーク防止のための適切なクリーンアップ
 * - イベントベースのアーキテクチャ
 */
export class WebSocketClient {
  private url: string
  private ws: WebSocket | null = null
  private options: Required<WebSocketOptions>
  private reconnectAttempts = 0
  private heartbeatTimeouts = 0
  private messageQueue: WebSocketMessage[] = []
  private heartbeatTimer: number | null = null
  private heartbeatTimeoutId: number | null = null
  private reconnectTimer: number | null = null
  private isReconnecting = false
  private isServer = typeof window === "undefined"

  constructor(url: string, options: WebSocketOptions = {}) {
    this.url = url
    this.options = {
      reconnectInterval: options.reconnectInterval || 5000,
      maxReconnectInterval: options.maxReconnectInterval || 60000,
      heartbeatInterval: options.heartbeatInterval || 30000,
      heartbeatTimeout: options.heartbeatTimeout || 10000,
      maxReconnectAttempts: options.maxReconnectAttempts || 5,
      maxHeartbeatTimeouts: options.maxHeartbeatTimeouts || 3,
      onOpen: options.onOpen || (() => {}),
      onMessage: options.onMessage || (() => {}),
      onClose: options.onClose || (() => {}),
      onError: options.onError || (() => {}),
    }

    // SSR環境ではWebSocketを初期化しない
    if (!this.isServer) {
      this.connect()
    }
  }

  /**
   * WebSocket接続を開始
   */
  public connect(): void {
    if (this.isServer) return

    try {
      this.ws = new WebSocket(this.url)

      this.ws.onopen = (event: Event) => {
        console.log("WebSocket connected")
        this.isReconnecting = false
        this.reconnectAttempts = 0
        this.heartbeatTimeouts = 0
        this.startHeartbeat()
        this.flushMessageQueue()
        this.options.onOpen(event)
      }

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data as string)
          if (data?.type === "heartbeat") {
            this.resetHeartbeatTimeout()
          }
          this.options.onMessage(event)
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error)
        }
      }

      this.ws.onclose = (event: CloseEvent) => {
        console.log(`WebSocket closed: ${event.code} ${event.reason}`)
        this.stopHeartbeat()
        this.options.onClose(event)

        if (!this.isReconnecting && event.code !== 1000) {
          this.reconnect()
        }
      }

      this.ws.onerror = (event: Event) => {
        console.error("WebSocket error:", event)
        this.options.onError(event)
      }
    } catch (error) {
      console.error("Failed to create WebSocket:", error)
      this.reconnect()
    }
  }

  /**
   * ハートビートの開始
   */
  private startHeartbeat(): void {
    if (this.isServer) return

    this.stopHeartbeat() // 既存のタイマーをクリア

    this.heartbeatTimer = window.setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "heartbeat" }))
        this.setHeartbeatTimeout()
      }
    }, this.options.heartbeatInterval)
  }

  /**
   * ハートビートの停止とタイマーのクリーンアップ
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }

    if (this.heartbeatTimeoutId !== null) {
      window.clearTimeout(this.heartbeatTimeoutId)
      this.heartbeatTimeoutId = null
    }
  }

  /**
   * ハートビートタイムアウトの設定
   */
  private setHeartbeatTimeout(): void {
    if (this.isServer) return

    if (this.heartbeatTimeoutId !== null) {
      window.clearTimeout(this.heartbeatTimeoutId)
    }

    this.heartbeatTimeoutId = window.setTimeout(() => {
      console.warn("Heartbeat timeout")
      this.heartbeatTimeouts++
      if (this.heartbeatTimeouts >= this.options.maxHeartbeatTimeouts) {
        this.ws?.close()
      }
    }, this.options.heartbeatTimeout)
  }

  /**
   * ハートビートタイムアウトのリセット
   */
  private resetHeartbeatTimeout(): void {
    this.heartbeatTimeouts = 0
    this.setHeartbeatTimeout()
  }

  /**
   * 再接続処理
   */
  private reconnect(): void {
    if (this.isServer) return

    this.isReconnecting = true

    if (this.reconnectAttempts < this.options.maxReconnectAttempts) {
      const backoff = Math.min(
        this.options.reconnectInterval * Math.pow(2, this.reconnectAttempts),
        this.options.maxReconnectInterval,
      )

      if (this.reconnectTimer !== null) {
        window.clearTimeout(this.reconnectTimer)
      }

      this.reconnectTimer = window.setTimeout(() => {
        console.log(`Reconnecting... Attempt ${this.reconnectAttempts + 1}`)
        this.reconnectAttempts++
        this.connect()
      }, backoff)
    } else {
      console.error("Max reconnect attempts reached")
      this.isReconnecting = false
    }
  }

  /**
   * メッセージ送信
   * @param data 送信するデータ
   */
  public send(data: WebSocketMessage): void {
    if (this.isServer) return

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    } else {
      this.messageQueue.push(data)
    }
  }

  /**
   * 送信待ちメッセージの処理
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()
      if (message) this.send(message)
    }
  }

  /**
   * 接続を閉じてリソースを解放
   */
  public close(): void {
    if (this.isServer) return

    if (this.ws) {
      try {
        this.ws.close(1000, "Closed by client")
      } catch (error) {
        console.error("Error closing WebSocket:", error)
      }
      this.ws = null
    }

    this.stopHeartbeat()

    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    // キューをクリア
    this.messageQueue = []
  }

  /**
   * 現在の接続状態を取得
   */
  public getState(): number | null {
    return this.ws?.readyState ?? null
  }
}

// シングルトンインスタンスの管理用マップ
const webSocketInstances = new Map<string, WebSocketClient>()

/**
 * 特定のURLに対するWebSocketClientのシングルトンインスタンスを取得
 */
export function getWebSocketClient(url: string, options?: WebSocketOptions): WebSocketClient {
  if (!webSocketInstances.has(url)) {
    webSocketInstances.set(url, new WebSocketClient(url, options))
  }
  return webSocketInstances.get(url)!
}
