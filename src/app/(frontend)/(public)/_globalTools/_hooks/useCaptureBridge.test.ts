import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { captureBridge, useCaptureTarget, type CaptureTarget } from "./useCaptureBridge"

describe("useCaptureBridge / captureBridge", () => {
  // `renderHook` を使う場合、テストフレームワークによっては自動 `cleanup()` が走らない。
  // 前テストの購読が残った状態で store を更新すると act 警告になるため、明示的に cleanup してから reset する。
  afterEach(() => {
    cleanup()
    act(() => {
      captureBridge._internal_reset()
    })
  })

  beforeEach(() => {
    act(() => {
      captureBridge._internal_reset()
    })
  })

  describe("captureBridge (Store Logic)", () => {
    it("ターゲットを登録するとアクティブターゲットになる", () => {
      const target: CaptureTarget = {
        id: "t1",
        label: "Target 1",
        onApply: () => {},
      }
      captureBridge.register(target)
      expect(captureBridge.getSnapshot().activeTargetId).toBe("t1")
      expect(captureBridge.getActiveTargetFor("image")).toEqual(target)
    })

    it("複数のターゲットを登録すると、最後に登録したものがアクティブになる", () => {
      captureBridge.register({ id: "t1", label: "T1", onApply: () => {} })
      captureBridge.register({ id: "t2", label: "T2", onApply: () => {} })
      expect(captureBridge.getSnapshot().activeTargetId).toBe("t2")
    })

    it("setActive でアクティブなターゲットを切り替えられる", () => {
      captureBridge.register({ id: "t1", label: "T1", onApply: () => {} })
      captureBridge.register({ id: "t2", label: "T2", onApply: () => {} })
      captureBridge.setActive("t1")
      expect(captureBridge.getSnapshot().activeTargetId).toBe("t1")
    })

    it("accepts 指定に基づき、適切なターゲットのみを返す", () => {
      const target: CaptureTarget = {
        id: "t1",
        label: "Image Only",
        accepts: ["image"],
        onApply: () => {},
      }
      captureBridge.register(target)
      // image なら取得できる
      expect(captureBridge.getActiveTargetFor("image")).toEqual(target)
      // qr や audio なら (accepts にないので) null が返る
      expect(captureBridge.getActiveTargetFor("qr")).toBeNull()
      expect(captureBridge.getActiveTargetFor("audio")).toBeNull()
    })

    it("unregister するとターゲットリストから削除され、アクティブなら解除される", () => {
      captureBridge.register({ id: "t1", label: "T1", onApply: () => {} })
      expect(captureBridge.getSnapshot().activeTargetId).toBe("t1")
      captureBridge.unregister("t1")
      expect(captureBridge.getSnapshot().targets).toHaveLength(0)
      expect(captureBridge.getSnapshot().activeTargetId).toBeNull()
    })
  })

  describe("useCaptureTarget (Hook)", () => {
    it("Hook経由で登録でき、isActive が正しく反映される", () => {
      const target: CaptureTarget = { id: "hook-t1", label: "Hook Target", onApply: () => {} }
      const { result } = renderHook(() => useCaptureTarget(target))
      act(() => {
        result.current.register()
      })
      expect(result.current.isActive).toBe(true)
      expect(captureBridge.getSnapshot().activeTargetId).toBe("hook-t1")
    })

    it("別のターゲットがアクティブになると isActive が false になる", () => {
      const target1 = { id: "t1", label: "T1", onApply: () => {} }
      const target2 = { id: "t2", label: "T2", onApply: () => {} }
      const { result: res1 } = renderHook(() => useCaptureTarget(target1))
      act(() => {
        res1.current.register()
      })
      expect(res1.current.isActive).toBe(true)
      // 別のターゲットを登録
      act(() => {
        captureBridge.register(target2)
      })
      // useSyncExternalStore の購読更新は非同期に反映され得るため待機
      return waitFor(() => {
        expect(res1.current.isActive).toBe(false)
      })
    })

    it("register/unregister/setActive 関数は参照が安定していること", () => {
      const target = { id: "t1", label: "T1", onApply: () => {} }
      const { result, rerender } = renderHook(() => useCaptureTarget(target))
      const initialRegister = result.current.register
      const initialUnregister = result.current.unregister
      const initialSetActive = result.current.setActive
      // 再レンダリングを発生させる
      act(() => {
        rerender()
      })
      expect(result.current.register).toBe(initialRegister)
      expect(result.current.unregister).toBe(initialUnregister)
      expect(result.current.setActive).toBe(initialSetActive)
    })
  })
})
