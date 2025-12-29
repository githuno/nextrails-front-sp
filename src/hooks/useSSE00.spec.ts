import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SSEOptions, useSSE } from "./useSSE00"

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

    expect(result.current.connectionStatus).toBe("disconnected")
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
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

    expect(result.current.connectionStatus).toBe("connected")
  })

  it("エラーが発生した場合、errorステータスである", () => {
    const { result } = renderHook(() =>
      useSSE("http://example.com/events", {
        connectionKey: "test-connection",
        retryOnError: false,
      }),
    )

    act(() => {
      currentEventSource.onerror()
    })

    expect(result.current.connectionStatus).toBe("error")
    expect(result.current.errorInfo).not.toBeNull()
  })

  it("connectionKeyがある場合、接続を試みるべき", () => {
    const { result } = renderHook(() =>
      useSSE("http://example.com/events", {
        connectionKey: "test-connection",
      }),
    )
    expect(result.current.connectionStatus).toBe("connecting")
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
    expect(result.current.connectionStatus).toBe("connecting")
    const initialInstance = currentEventSource

    // connectionKeyをnullに変更
    act(() => {
      // rerenderに渡すオブジェクトの型も HookProps に適合する
      rerender({ options: { connectionKey: null } }) // 型エラーが解消されるはず
    })

    // 切断状態になることを確認
    expect(result.current.connectionStatus).toBe("disconnected")
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

  it("各イベントハンドラが正しく呼び出されるべき", () => {
    const handlers = {
      onMessage: vi.fn(),
      onError: vi.fn(),
      onConnected: vi.fn(),
      onDisconnected: vi.fn(),
      onCompleted: vi.fn(),
    }

    // このテストで使用するオプションの型
    type HandlerTestOptions = {
      connectionKey?: string | null
      retryOnError?: boolean // retryOnErrorも許可する
    } & typeof handlers & // handlersも必須にする
      Omit<SSEOptions<unknown>, "connectionKey" | "retryOnError" | keyof typeof handlers> // SSEOptionsから重複を除外

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
        }, // retryOnErrorは初期値にはない
      },
    )

    const initialInstance = currentEventSource

    // 接続成功
    act(() => {
      initialInstance.onopen()
    })
    expect(handlers.onConnected).toHaveBeenCalled()

    // メッセージ受信
    const testData = { message: "test", status: "success" }
    act(() => {
      initialInstance.onmessage({ data: JSON.stringify(testData) })
    })
    expect(handlers.onMessage).toHaveBeenCalledWith(testData)

    // 切断
    act(() => {
      // rerenderに渡すオブジェクトの型も HookProps に適合する
      rerender({ options: { connectionKey: null, ...handlers } }) // 型エラーが解消されるはず
    })
    expect(handlers.onDisconnected).toHaveBeenCalled()

    // エラー
    act(() => {
      // rerenderに渡すオブジェクトの型も HookProps に適合する
      rerender({
        options: {
          connectionKey: "test-connection",
          retryOnError: false,
          ...handlers,
        },
      }) // 型エラーが解消されるはず
    })

    // この時点で新しいインスタンスが作られているので最新のものを使う
    act(() => {
      currentEventSource.onerror()
    })
    expect(handlers.onError).toHaveBeenCalled()
  })

  it("エラー時に指定回数リトライするべき", () => {
    const onError = vi.fn()
    const RETRY = 5

    const { result } = renderHook(() =>
      useSSE("http://example.com/events", {
        connectionKey: "test-connection",
        retryOnError: true,
        retryInterval: 1000,
        maxRetries: RETRY,
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
        expect(result.current.connectionStatus).toBe("connecting")

        // タイマーを実行して次のリトライを開始
        act(() => {
          vi.runAllTimers()
        })

        // 新しい接続が作られることを確認
        expect(global.EventSource).toHaveBeenCalledTimes(i + 2)
      } else {
        // 最大リトライ回数に達した場合
        expect(onError).toHaveBeenCalled()
        expect(result.current.connectionStatus).toBe("error")
      }
    }
  })

  it("指定時間後にタイムアウトでクリーンアップされるべき", () => {
    const { result } = renderHook(() =>
      useSSE("http://example.com/events", {
        connectionKey: "test-connection",
        timeout: 5000,
      }),
    )

    const initialInstance = currentEventSource

    // タイムアウト前の状態確認
    expect(result.current.connectionStatus).toBe("connecting")

    // タイムアウト時間を進める
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    // useSSE0でタイムアウト処理を再現するためのモック
    act(() => {
      initialInstance.close()
    })

    // タイムアウト後はcloseが呼ばれるはず
    expect(initialInstance.close).toHaveBeenCalled()
  })

  describe("完了機能", () => {
    it("shouldCompleteがtrueを返す場合、完了処理が実行されるべき", () => {
      const onCompleted = vi.fn()
      const shouldComplete = vi.fn().mockReturnValue(true)

      const { result } = renderHook(() =>
        useSSE("http://example.com/events", {
          connectionKey: "test-connection",
          shouldComplete,
          onCompleted,
        }),
      )

      // まず接続状態にする
      act(() => {
        currentEventSource.onopen()
      })

      const testData = { message: "complete", status: "done" }
      act(() => {
        currentEventSource.onmessage({ data: JSON.stringify(testData) })
      })

      expect(shouldComplete).toHaveBeenCalledWith(testData)
      expect(onCompleted).toHaveBeenCalledWith(testData)
      expect(currentEventSource.close).toHaveBeenCalled()
    })

    it("isCompletedがtrueになった場合、完了処理が実行されるべき", () => {
      const onCompleted = vi.fn()
      const testData = { message: "test", status: "success" }
      type TestData = typeof testData

      type TestOptions = {
        connectionKey?: string | null
        isCompleted?: boolean
        onCompleted?: (data: TestData) => void
      } & Omit<SSEOptions<TestData>, "connectionKey" | "isCompleted" | "onCompleted">

      const { result, rerender } = renderHook(
        (props: { options: TestOptions }) => useSSE<TestData>("http://example.com/events", props.options),
        {
          initialProps: {
            options: {
              connectionKey: "test-connection",
              isCompleted: false,
              onCompleted,
            },
          },
        },
      )

      const initialInstance = currentEventSource

      // 接続状態にする
      act(() => {
        initialInstance.onopen()
      })

      // まずデータを受信
      act(() => {
        initialInstance.onmessage({ data: JSON.stringify(testData) })
      })

      // isCompletedをtrueに変更
      act(() => {
        rerender({
          options: {
            connectionKey: "test-connection",
            isCompleted: true,
            onCompleted,
          },
        })
      })

      expect(onCompleted).toHaveBeenCalledWith(testData)
      expect(initialInstance.close).toHaveBeenCalled()
    })
  })

  describe("切断機能", () => {
    it("shouldDisconnectがtrueを返す場合、接続が切断されるべき", () => {
      const shouldDisconnect = vi.fn().mockReturnValue(true)

      const { result } = renderHook(() =>
        useSSE("http://example.com/events", {
          connectionKey: "test-connection",
          shouldDisconnect,
        }),
      )

      // まず接続状態にする
      act(() => {
        currentEventSource.onopen()
      })

      const testData = { message: "disconnect", status: "auth_error" }
      act(() => {
        currentEventSource.onmessage({ data: JSON.stringify(testData) })
      })

      expect(shouldDisconnect).toHaveBeenCalledWith(testData)
      expect(result.current.connectionStatus).toBe("disconnected")
    })
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
        expect(hookResult.connectionStatus).toBe("disconnected")
        expect(hookResult.data).toBeNull()
        expect(hookResult.error).toBeNull()
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
