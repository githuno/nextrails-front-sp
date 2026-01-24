/**
 * useToolActionStore 統合テスト (Classical Approach)
 *
 * 【テストの性質】
 * このテストは、モックを最小限に抑え、実際の PGlite (PostgreSQL) と IndexedDB
 * インスタンスを使用してシステムの整合性を検証する「Classical Approach」を採用しています。
 */
import { toast } from "@/components/atoms/Toast"
import { cleanup } from "@testing-library/react"
import { eq } from "drizzle-orm"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { files as filesTable } from "./db/pgliteSchema"
import { _internal_reset_idb_store, idbStore } from "./db/useIdbStore"
import { _internal_reset_pglite_store, getDb } from "./db/usePgliteStore"
import { captureBridge } from "./useCaptureBridge"
import { createToolActionStore } from "./useToolActionStore"

// 外部UI依存のみモック
vi.mock("@/components/atoms/Toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// URL.createObjectURL のモック
if (typeof window !== "undefined") {
  window.URL.createObjectURL = vi.fn((blob) => `blob:mock-${blob.size}`)
  window.URL.revokeObjectURL = vi.fn()
}

describe("useToolActionStore (Classical Integration)", () => {
  const TEST_TIMEOUT = 30000
  let store: ReturnType<typeof createToolActionStore>

  beforeEach(async () => {
    vi.clearAllMocks()
    captureBridge._internal_reset()
    const testId = Math.random().toString(36).slice(2, 7)
    await _internal_reset_pglite_store(`idb://test-db-${testId}`)
    await _internal_reset_idb_store(`test-s3-${testId}`)
    // DB初期化を待機
    await getDb()
    // テストごとに独立した store インスタンスを作る（自動購読・自動同期はしない）
    store = createToolActionStore({ autoStart: false })
    // DBが確実に使える状態まで一度同期（URL hydration は不要）
    await store.syncData({ hydrateUrls: false })
  }, TEST_TIMEOUT)

  afterEach(async () => {
    cleanup()
    // 先に store 側の in-flight sync を止めてから DB を閉じる（BroadcastChannel closed を防止）
    store.dispose()
    captureBridge._internal_reset()
    await _internal_reset_pglite_store()
    await _internal_reset_idb_store()
    // 完全にクローズされるまで微小時間待機
    await new Promise((r) => setTimeout(r, 100))
  })

  it(
    "saveFile を実行すると IDB と PGlite の両方にデータが保存される",
    async () => {
      const testFile = new File(["test-content"], "test.jpg", { type: "image/jpeg" })
      const saveResult = await store.actions.saveFile(testFile, { fileName: "test.jpg", category: "camera" })
      const snapshot = store.getState()
      const saved = snapshot.files.find((f) => f.idbKey === saveResult.idbKey)
      expect(saved).toBeDefined()
      expect(saved?.isPending).not.toBe(true)
      // IDB にバイナリがあるか確認
      const idb = idbStore()
      const storedBlob = await idb.get(saveResult.idbKey)
      expect(storedBlob).toBeDefined()
      expect(storedBlob?.size).toBe(testFile.size)
      // PGlite にレコードがあるか確認
      const db = await getDb()
      const records = await db.select().from(filesTable).where(eq(filesTable.idbKey, saveResult.idbKey))
      expect(records).toHaveLength(1)
      expect(records[0].fileName).toBe("test.jpg")
    },
    TEST_TIMEOUT,
  )

  it(
    "deleteFiles を実行すると IDB と PGlite からデータが削除される",
    async () => {
      const testFile = new File(["delete-me"], "del.jpg", { type: "image/jpeg" })
      const saveRes = await store.actions.saveFile(testFile, { fileName: "del.jpg", category: "camera" })
      await store.actions.deleteFiles([{ idbKey: saveRes.idbKey, id: saveRes.id }])
      expect(store.getState().files).toHaveLength(0)
      const idb = idbStore()
      expect(await idb.get(saveRes.idbKey)).toBeUndefined()
      const db = await getDb()
      const records = await db.select().from(filesTable).where(eq(filesTable.idbKey, saveRes.idbKey))
      expect(records).toHaveLength(0)
    },
    TEST_TIMEOUT,
  )

  it(
    "カテゴリに基づき、cameraFiles と audioFiles が正しくフィルタリングされる",
    async () => {
      await store.actions.saveFile(new Blob(["img"], { type: "image/jpeg" }), { fileName: "i.jpg", category: "camera" })
      await store.actions.saveFile(new Blob(["aud"], { type: "audio/mp3" }), {
        fileName: "a.mp3",
        category: "microphone",
      })
      const snapshot = store.getState()
      expect(snapshot.files).toHaveLength(2)
      expect(snapshot.files.every((f) => !f.isPending)).toBe(true)
      expect(snapshot.cameraFiles).toHaveLength(1)
      expect(snapshot.audioFiles).toHaveLength(1)
    },
    TEST_TIMEOUT,
  )

  it(
    "保存成功時にアクティブターゲットがあれば適用アクション付きトーストが表示される",
    async () => {
      const onApplyMock = vi.fn()
      captureBridge.register({
        id: "target-1",
        label: "検証用ターゲット",
        accepts: ["image"],
        onApply: onApplyMock,
      })
      await store.actions.saveFile(new Blob(["test"], { type: "image/jpeg" }), {
        fileName: "bridge-test.jpg",
        category: "camera",
      })
      expect(toast.success).toHaveBeenCalledWith(
        "写真を保存しました",
        expect.objectContaining({
          action: expect.objectContaining({
            label: "検証用ターゲットに適用",
          }),
        }),
      )
      const toastCall = vi.mocked(toast.success).mock.calls[0]
      const action = toastCall[1]?.action as { label: string; onClick: () => Promise<void> }
      await action.onClick()
      expect(onApplyMock).toHaveBeenCalled()
    },
    TEST_TIMEOUT,
  )
})
