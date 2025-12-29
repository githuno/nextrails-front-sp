import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useSSE } from "./useSSE02"

describe("useSSE", () => {
  let eventSourceInstances: any[] = []
  let currentEventSource: any
  let instanceCounter = 0

  beforeEach(() => {
    // インスタンス履歴とカウンターをリセット
    eventSourceInstances = []
    instanceCounter = 0

    // 毎回新しいモックインスタンスを返すようにする
    const mockEventSource = {
      close: vi.fn(),
      onopen: null,
      onmessage: null,
      onerror: null,
    }

    global.EventSource = vi.fn().mockImplementation(() => {
      const instance = {
        ...mockEventSource,
        instanceId: instanceCounter++, // 追加：各インスタンスに一意のIDを付与
      }
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
    const { result } = renderHook(() => useSSE({ url: "http://example.com/events" }, []))
    const testData = { message: "test", status: "success" }

    // 接続状態に変更してからメッセージを送信
    act(() => {
      currentEventSource.onopen()
      currentEventSource.onmessage({ data: JSON.stringify(testData) })
    })

    expect(result.current.data).toEqual(testData)
  })

  it("接続が成功した場合、connectedステータスである", () => {
    const { result } = renderHook(() => useSSE({ url: "http://example.com/events" }, []))

    // 最新のインスタンスを使用
    act(() => {
      currentEventSource.onopen()
    })

    expect(result.current.sseStatus).toBe("connected")
  })

  it("接続エラー時にN回リトライしたあと、切断されるべき", () => {
    const onError = vi.fn()
    const RETRY = 5

    const { result } = renderHook(() =>
      useSSE(
        {
          url: "http://example.com/events",
          retry: RETRY,
          onError,
        },
        [],
      ),
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

  it("URLが変更された時に再接続するべき", () => {
    const { rerender } = renderHook(({ url }) => useSSE({ url }, []), {
      initialProps: { url: "http://example.com/events1" },
    })

    expect(global.EventSource).toHaveBeenCalledWith("http://example.com/events1")
    const initialInstance = currentEventSource

    act(() => {
      initialInstance.onopen()
    })

    // URLを変更
    act(() => {
      rerender({ url: "http://example.com/events2" })
    })

    expect(initialInstance.close).toHaveBeenCalled()
    expect(global.EventSource).toHaveBeenLastCalledWith("http://example.com/events2")
  })

  it("手動でreconnect関数を呼び出すと再接続されるべき", () => {
    const { result } = renderHook(() => useSSE({ url: "http://example.com/events" }, []))

    // 一度切断状態にする
    act(() => {
      result.current.disconnect()
    })

    // 初期状態は切断
    expect(result.current.sseStatus).toBe("disconnected")

    // 再接続
    act(() => {
      result.current.reconnect()
    })

    // 接続中状態になることを確認
    expect(result.current.sseStatus).toBe("connecting")
    expect(global.EventSource).toHaveBeenCalledWith("http://example.com/events")
  })

  it("手動でdisconnect関数を呼び出すと接続が切断されるべき", () => {
    const { result } = renderHook(() => useSSE({ url: "http://example.com/events" }, []))

    // 接続状態にする
    expect(result.current.sseStatus).toBe("connecting")

    // 切断状態にする
    act(() => {
      result.current.disconnect()
    })

    // 切断状態になることを確認
    expect(result.current.sseStatus).toBe("disconnected")
  })

  it("依存配列が変更されたら再接続されるべき", async () => {
    console.log("🔍テスト開始")

    const { result, rerender } = renderHook(({ dep }) => useSSE({ url: "http://example.com/events" }, [dep]), {
      initialProps: { dep: "initial-value" },
    })

    // 最初のイベントソースインスタンスを記録
    const firstInstance = currentEventSource
    console.log("🔍初回のインスタンス:", {
      instanceId: firstInstance.instanceId,
      status: result.current.sseStatus,
    })

    // 最初のインスタンスを接続状態にする
    act(() => {
      firstInstance.onopen()
    })

    expect(result.current.sseStatus).toBe("connected")

    // 依存配列の値を変更とeffectの実行を待つ
    await act(async () => {
      console.log("🔍依存配列の値を変更")
      rerender({ dep: "updated-value" })
      // effectの実行を待つ
      await vi.runAllTimersAsync()
    })

    // cleanup が呼ばれたことを確認
    expect(firstInstance.close).toHaveBeenCalled()

    // 新しいインスタンスを確認
    console.log("🔍新しいインスタンス:", {
      instanceId: currentEventSource.instanceId,
      status: result.current.sseStatus,
    })

    // 新しいインスタンスが作成されていることを確認
    expect(global.EventSource).toHaveBeenCalledTimes(2)
  })

  it("依存配列がfalsy値または空配列、空オブジェクトのいずれかから有効値に変更されたら再接続されるべき", () => {
    // 初期値も有効な値を使用
    const { result, rerender } = renderHook(({ dep }) => useSSE({ url: "http://example.com/events" }, [dep]), {
      initialProps: { dep: {} } as { dep: string | {} },
    })

    // 1. 切断状態を確認
    expect(result.current.sseStatus).toBe("disconnected")

    // 2. 依存値を有効値に変更
    act(() => {
      rerender({ dep: "update" })
    })

    // 3. 接続の確認
    expect(global.EventSource).toHaveBeenCalledWith("http://example.com/events")
  })

  it("依存配列にfalsy値または空配列、空オブジェクトのいずれかが含まれる場合、切断されるべき", () => {
    // 初期値も有効な値を使用
    const { result, rerender } = renderHook(({ dep }) => useSSE({ url: "http://example.com/events" }, [dep]), {
      initialProps: { dep: "initial" } as { dep: string | {} },
    })

    // 1. 初期接続の確認
    expect(global.EventSource).toHaveBeenCalledWith("http://example.com/events")
    const initialInstance = currentEventSource
    expect(result.current.sseStatus).toBe("connecting")

    // 2. 初期接続の完了確認
    act(() => {
      initialInstance.onopen()
      initialInstance.onmessage({ data: JSON.stringify({ message: "initial" }) })
    })
    expect(result.current.data).toEqual({ message: "initial" })

    // 3. 依存値をnullに変更
    act(() => {
      rerender({ dep: {} })
    })

    // 4. 切断の確認
    expect(initialInstance.close).toHaveBeenCalled()
    expect(result.current.sseStatus).toBe("disconnected")
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
        const { result } = renderHook(() => useSSE({ url: "http://example.com/events" }, []))
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
