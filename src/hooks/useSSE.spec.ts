import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useSSE } from "./useSSE"

describe("useSSE", () => {
  let mockEventSource: any

  beforeEach(() => {
    // EventSourceのモック
    mockEventSource = {
      close: vi.fn(),
      onopen: vi.fn(),
      onmessage: vi.fn(),
      onerror: vi.fn(),
    }

    global.EventSource = vi.fn().mockImplementation(() => mockEventSource) as unknown as typeof EventSource
    Object.assign(global.EventSource, {
      CONNECTING: 0,
      OPEN: 1,
      CLOSED: 2,
    })
  })

  // 日本語で
  it("初期状態は接続中であるべき", () => {
    const { result } = renderHook(() => useSSE("http://example.com/events"))

    expect(result.current.status).toBe("connecting")
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })

  // 日本語で
  it("接続が成功した場合、接続状態であるべき", () => {
    const { result } = renderHook(() => useSSE("http://example.com/events"))

    act(() => {
      mockEventSource.onopen()
    })

    expect(result.current.status).toBe("connected")
    expect(result.current.isConnected).toBe(true)
  })

  // 日本語で
  it("メッセージを受信した場合、データが更新されるべき", () => {
    const { result } = renderHook(() => useSSE("http://example.com/events"))
    const testData = { message: "test", status: "success" }

    act(() => {
      mockEventSource.onmessage({ data: JSON.stringify(testData) })
    })

    expect(result.current.data).toEqual(testData)
  })

  // 日本語で
  it("エラーが発生した場合、エラーステータスであるべき", () => {
    const { result } = renderHook(() =>
      useSSE("http://example.com/events", {
        retryOnError: false,
      }),
    )

    act(() => {
      mockEventSource.onerror(new Error("Connection failed"))
    })

    expect(result.current.status).toBe("error")
    expect(result.current.isError).toBe(true)
    expect(result.current.error).toBeTruthy()
  })

  it("接続が完了した場合、完了状態であるべき", () => {
    const { unmount } = renderHook(() => useSSE("http://example.com/events"))

    unmount()

    expect(mockEventSource.close).toHaveBeenCalled()
  })

  describe("タイムアウト機能", () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it("指定時間後にタイムアウトエラーが発生するべき", () => {
      const { result } = renderHook(() =>
        useSSE("http://example.com/events", {
          timeout: 5000,
        }),
      )

      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect(result.current.status).toBe("error")
      expect(result.current.errorInfo?.type).toBe("timeout")
    })
  })

  describe("リトライ機能", () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it("エラー時に指定回数リトライするべき", () => {
      const { result } = renderHook(() =>
        useSSE("http://example.com/events", {
          retryOnError: true,
          retryInterval: 1000,
          maxRetries: 3,
        }),
      )

      // 1回目のエラー
      act(() => {
        mockEventSource.onerror(new Error("Connection failed"))
      })

      expect(result.current.status).toBe("connecting")
      expect(result.current.errorInfo?.retryCount).toBe(1)

      // リトライ間隔を進める
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      // 最大リトライ回数に達するまでテスト
      for (let i = 2; i <= 3; i++) {
        act(() => {
          mockEventSource.onerror(new Error("Connection failed"))
          vi.advanceTimersByTime(1000)
        })
      }

      expect(result.current.status).toBe("error")
      expect(result.current.errorInfo?.retryCount).toBe(3)
    })
  })

  describe("イベントハンドラ", () => {
    it("各イベントハンドラが正しく呼び出されるべき", () => {
      const handlers = {
        onMessage: vi.fn(),
        onError: vi.fn(),
        onConnected: vi.fn(),
        onDisconnected: vi.fn(),
        onCompleted: vi.fn(),
        onRetry: vi.fn(),
      }

      const { result } = renderHook(() => useSSE("http://example.com/events", handlers))

      // 接続成功
      act(() => {
        mockEventSource.onopen()
      })
      expect(handlers.onConnected).toHaveBeenCalled()

      // メッセージ受信
      const testData = { message: "test", status: "success" }
      act(() => {
        mockEventSource.onmessage({ data: JSON.stringify(testData) })
      })
      expect(handlers.onMessage).toHaveBeenCalledWith(testData)

      // 完了メッセージ
      const completedData = { message: "complete", status: "completed" }
      act(() => {
        mockEventSource.onmessage({ data: JSON.stringify(completedData) })
      })
      expect(handlers.onCompleted).toHaveBeenCalledWith(completedData)
    })
  })

  describe("制御機能", () => {
    it("connect/disconnect/retry/resetが正しく動作するべき", () => {
      const { result } = renderHook(() => useSSE("http://example.com/events"))

      // disconnect
      act(() => {
        result.current.disconnect()
      })
      expect(mockEventSource.close).toHaveBeenCalled()
      expect(result.current.status).toBe("disconnected")

      // connect
      act(() => {
        result.current.connect()
      })
      expect(result.current.status).toBe("connecting")

      // retry
      act(() => {
        result.current.retry()
      })
      expect(mockEventSource.close).toHaveBeenCalled()
      expect(result.current.status).toBe("connecting")

      // reset
      act(() => {
        result.current.reset()
      })
      expect(result.current.status).toBe("disconnected")
      expect(result.current.error).toBeNull()
      expect(result.current.errorInfo).toBeNull()
    })
  })

  describe("URL変更時の挙動", () => {
    it("URLが変更された時に再接続するべき", () => {
      const { rerender } = renderHook(({ url }) => useSSE(url), {
        initialProps: { url: "http://example.com/events1" },
      })

      expect(global.EventSource).toHaveBeenCalledWith("http://example.com/events1")

      rerender({ url: "http://example.com/events2" })

      expect(mockEventSource.close).toHaveBeenCalled()
      expect(global.EventSource).toHaveBeenCalledWith("http://example.com/events2")
    })
  })

  describe("SSRサポート", () => {
    it("SSR環境では接続を試みないべき", () => {
      // windowをundefinedに設定してSSR環境をシミュレート
      const original = global.window
      delete (global as any).window

      const { result } = renderHook(() => useSSE("http://example.com/events"))

      expect(result.current.status).toBe("disconnected")
      expect(global.EventSource).not.toHaveBeenCalled()

      // windowを元に戻す
      global.window = original
    })
  })
})
