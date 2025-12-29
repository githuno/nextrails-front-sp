import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SSEOptions, useSSE } from "./useSSE01"

describe("useSSE", () => {
  let eventSourceInstances: any[] = []
  let currentEventSource: any

  beforeEach(() => {
    // インスタンス履歴をリセット
    eventSourceInstances = []

    // 毎回新しいモックインスタンスを返すようにする
    const mockEventSource = {
      close: vi.fn(),
      onopen: null,
      onmessage: null,
      onerror: null,
    }

    global.EventSource = vi.fn().mockImplementation(() => {
      const instance = { ...mockEventSource }
      // 各インスタンスは独自のコールバック関数を持つ
      instance.close = vi.fn()
      instance.onopen = null
      instance.onmessage = null
      instance.onerror = null

      // インスタンスを配列に追加
      eventSourceInstances.push(instance)
      // 最新のインスタンスを現在のインスタンスとして追跡
      currentEventSource = instance
      return instance
    }) as unknown as typeof EventSource

    Object.assign(global.EventSource, {
      CONNECTING: 0,
      OPEN: 1,
      CLOSED: 2,
    })

    // タイマーをモック
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("受信したメッセージデータを戻り値として取得できる", () => {
    const { result } = renderHook(() =>
      useSSE("http://example.com/events", {
        connectionKey: "test-connection",
      }),
    )
    const testData = { message: "test", status: "success" }

    // 接続状態に変更してからメッセージを送信
    act(() => {
      currentEventSource.onopen()
      currentEventSource.onmessage({ data: JSON.stringify(testData) })
    })

    expect(result.current.data).toEqual(testData)
  })

  it("初期状態はdisconnectedステータスである", () => {
    const { result } = renderHook(() =>
      useSSE("http://example.com/events", {
        connectionKey: null,
      }),
    )

    expect(result.current.sseStatus).toBe("disconnected")
    expect(result.current.data).toBeNull()
    expect(result.current.sseError).toBeNull()
  })

  it("接続が成功した場合、connectedステータスである", () => {
    const { result } = renderHook(() =>
      useSSE("http://example.com/events", {
        connectionKey: "test-connection",
      }),
    )

    // 最新のインスタンスを使用
    act(() => {
      currentEventSource.onopen()
    })

    expect(result.current.sseStatus).toBe("connected")
  })

  it("接続エラー時にN回リトライしたあと、切断されるべき", () => {
    const onError = vi.fn()
    const RETRY = 0

    const { result } = renderHook(() =>
      useSSE("http://example.com/events", {
        connectionKey: "test-connection",
        retry: RETRY,
        onError,
      }),
    )

    // リトライループをシミュレート
    for (let i = 0; i <= RETRY; i++) {
      // 初回 + N回のリトライ
      // エラー発生
      act(() => {
        currentEventSource.onerror()
      })

      if (i < RETRY) {
        // 最後のリトライ以外
        // リトライ中の状態確認
        expect(result.current.sseStatus).toBe("connecting")

        // タイマーを実行して次のリトライを開始
        act(() => {
          vi.runAllTimers()
        })

        // 新しい接続が作られることを確認
        expect(global.EventSource).toHaveBeenCalledTimes(i + 2)
      } else {
        // 最大リトライ回数に達した場合
        expect(onError).toHaveBeenCalled()
        expect(result.current.sseStatus).toBe("disconnected")
      }
    }
  })

  it("connectionKeyがある場合、接続を試みるべき", () => {
    const { result } = renderHook(() =>
      useSSE("http://example.com/events", {
        connectionKey: "test-connection",
      }),
    )
    expect(result.current.sseStatus).toBe("connecting")
    expect(global.EventSource).toHaveBeenCalledWith("http://example.com/events")
  })

  it("connectionKeyがnullになった場合、切断されるべき", () => {
    type TestOptions = { connectionKey?: string | null } & Omit<SSEOptions<unknown>, "connectionKey">
    // useSSEフックの戻り値の型を取得
    type HookResult = ReturnType<typeof useSSE>
    // renderHookのコールバック関数に渡されるpropsの型
    type HookProps = { options: TestOptions }

    // renderHookにジェネリクスで型を指定
    const { result, rerender } = renderHook<HookResult, HookProps>(
      (props) => useSSE("http://example.com/events", props.options),
      {
        // initialPropsの型は TestOptions に合わせるか、
        // connectionKey が string であることを明示する (どちらでも動作するはず)
        initialProps: { options: { connectionKey: "test-connection" } },
      },
    )

    // まず接続
    expect(result.current.sseStatus).toBe("connecting")
    const initialInstance = currentEventSource

    // connectionKeyをnullに変更
    act(() => {
      // rerenderに渡すオブジェクトの型も HookProps に適合する
      rerender({ options: { connectionKey: null } }) // 型エラーが解消されるはず
    })

    // 切断状態になることを確認
    expect(result.current.sseStatus).toBe("disconnected")
    expect(initialInstance.close).toHaveBeenCalled()
  })

  it("connectionKeyが変更されたら、再接続されるべき", () => {
    type TestOptions = { connectionKey?: string | null } & Omit<SSEOptions<unknown>, "connectionKey">

    // renderHookにジェネリクスで型を指定
    const { rerender } = renderHook(
      (props: { options: TestOptions }) => useSSE("http://example.com/events", props.options),
      { initialProps: { options: { connectionKey: "initial-connection" } } },
    )

    const initialInstance = currentEventSource

    // 接続状態に変更
    act(() => {
      initialInstance.onopen()
    })

    // 新しいconnectionKeyを指定して再レンダリング
    act(() => {
      rerender({ options: { connectionKey: "new-connection" } })
    })

    // 古い接続が閉じられることを確認
    expect(initialInstance.close).toHaveBeenCalled()

    // 新しい接続が作られることを確認
    expect(global.EventSource).toHaveBeenCalledTimes(2)
    expect(global.EventSource).toHaveBeenLastCalledWith("http://example.com/events")
  })

  it("URLが変更された時に再接続するべき", () => {
    const { rerender } = renderHook(
      (props: { url: string; options: SSEOptions<unknown> }) => useSSE(props.url, props.options),
      {
        initialProps: {
          url: "http://example.com/events1",
          options: { connectionKey: "test-connection" },
        },
      },
    )

    expect(global.EventSource).toHaveBeenCalledWith("http://example.com/events1")

    const initialInstance = currentEventSource

    // URLを変更して再レンダリング
    act(() => {
      rerender({
        url: "http://example.com/events2",
        options: { connectionKey: "test-connection" },
      })
    })

    expect(initialInstance.close).toHaveBeenCalled()
    expect(global.EventSource).toHaveBeenCalledWith("http://example.com/events2")
  })

  it("コールバック関数が正しく呼び出されるべき", () => {
    const handlers = {
      onMessage: vi.fn(),
      onError: vi.fn(),
    }

    // このテストで使用するオプションの型
    type HandlerTestOptions = {
      connectionKey?: string | null
    } & typeof handlers & // handlersも必須にする
      Omit<SSEOptions<unknown>, "connectionKey" | keyof typeof handlers> // SSEOptionsから重複を除外

    // useSSEフックの戻り値の型を取得
    type HookResult = ReturnType<typeof useSSE>
    // renderHookのコールバック関数に渡されるpropsの型
    type HookProps = { options: HandlerTestOptions }

    // renderHookにジェネリクスで型を指定
    const { result, rerender } = renderHook<HookResult, HookProps>(
      (props) => useSSE("http://example.com/events", props.options),
      {
        initialProps: {
          options: { connectionKey: "test-connection", ...handlers },
        },
      },
    )

    const initialInstance = currentEventSource

    // 接続成功
    act(() => {
      initialInstance.onopen()
    })

    // メッセージ受信
    const testData = { message: "test", status: "success" }
    act(() => {
      initialInstance.onmessage({ data: JSON.stringify(testData) })
    })
    expect(handlers.onMessage).toHaveBeenCalledWith(testData)

    // 切断
    act(() => {
      rerender({ options: { connectionKey: null, ...handlers } })
    })

    // エラー
    act(() => {
      rerender({
        options: {
          connectionKey: "test-connection",
          ...handlers,
        },
      })
    })

    // この時点で新しいインスタンスが作られているので最新のものを使う
    act(() => {
      currentEventSource.onerror()
    })
    expect(handlers.onError).toHaveBeenCalled()
  })

  it("手動でdisconnect関数を呼び出すと接続が切断されるべき", () => {
    const { result } = renderHook(() =>
      useSSE("http://example.com/events", {
        connectionKey: "test-connection",
      }),
    )

    // まず接続状態にする
    act(() => {
      currentEventSource.onopen()
    })

    expect(result.current.sseStatus).toBe("connected")

    // 手動切断
    act(() => {
      result.current.disconnect()
    })

    expect(result.current.sseStatus).toBe("disconnected")
    expect(currentEventSource.close).toHaveBeenCalled()
  })

  it("手動でreconnect関数を呼び出すと再接続されるべき", () => {
    const { result } = renderHook(() =>
      useSSE("http://example.com/events", {
        connectionKey: null,
      }),
    )

    expect(result.current.sseStatus).toBe("disconnected")

    // 手動再接続
    act(() => {
      result.current.reconnect()
    })

    expect(result.current.sseStatus).toBe("connecting")
    expect(global.EventSource).toHaveBeenCalledWith("http://example.com/events")
  })

  describe("SSRサポート", () => {
    // テスト名を変更
    it("EventSource がない環境では接続を試みないべき", () => {
      const originalEventSource = global.EventSource // 元を保存

      // EventSource だけを undefined に設定
      // @ts-ignore
      global.EventSource = undefined

      let hookResult: ReturnType<typeof useSSE>

      try {
        // renderHook を実行 (window は存在するので動作するはず)
        const { result } = renderHook(() =>
          useSSE("http://example.com/events", {
            connectionKey: "test-connection",
          }),
        )
        hookResult = result.current

        // フックの状態が disconnected であることを確認
        expect(hookResult.sseStatus).toBe("disconnected")
        expect(hookResult.data).toBeNull()
        expect(hookResult.sseError).toBeNull()
      } catch (error) {
        console.error("Error during EventSource unavailable test:", error)
        throw error
      } finally {
        // EventSource を元に戻す
        global.EventSource = originalEventSource
      }
    })
  })
})
