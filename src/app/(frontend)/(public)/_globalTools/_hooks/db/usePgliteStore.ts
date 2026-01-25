import type { PGlite } from "@electric-sql/pglite"
import { PGliteWorker } from "@electric-sql/pglite/worker"
import { drizzle } from "drizzle-orm/pglite"
import { useExternalStore } from "../atoms/useExternalStore"
import * as schema from "./pgliteSchema"

let pgInstance: PGliteWorker | null = null
let pgWorker: Worker | null = null
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null
let initPromise: Promise<ReturnType<typeof drizzle<typeof schema>>> | null = null
let lastError: Error | null = null
let DATA_DIR = "opfs-ahp://ftb-global-database" // "idb://ftb-global-database"

/**
 * DBを破棄して再初期化するための内部関数（破壊的）
 *
 * 注意: 呼び出すと Worker / 接続を閉じ、dataDir を差し替えます。
 * テストやデータ初期化用途のためのAPIであり、環境判定による分岐は行いません。
 */
export const _internal_reset_pglite_store = async (dir: string = "opfs-ahp://test-ftb-global-database") => {
  if (initPromise) {
    try {
      await initPromise
    } catch {
      /* noop */
    }
  }
  if (pgInstance) {
    try {
      await new Promise((resolve) => setTimeout(resolve, 50))
      await pgInstance.close()
    } catch (e) {
      console.warn("[PgliteStore] Error during close in reset:", e)
    }
    pgInstance = null
  }
  if (pgWorker) {
    pgWorker.terminate()
    pgWorker = null
  }
  dbInstance = null
  initPromise = null
  lastError = null
  DATA_DIR = dir
}

const listeners = new Set<() => void>()
export const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const notify = () => listeners.forEach((l) => l())

/**
 * PgliteとDrizzleの接続を初期化する
 */
export const getDb = async (signal?: AbortSignal) => {
  if (dbInstance) return dbInstance
  if (initPromise) {
    const res = await initPromise
    if (signal?.aborted) throw new Error("getDb aborted")
    return res
  }
  initPromise = (async () => {
    try {
      if (typeof window === "undefined") throw new Error("PGlite is only available in the browser")
      if (signal?.aborted) throw new Error("getDb aborted")
      if (!pgWorker) {
        pgWorker = new Worker(new URL("./pgliteWorker.ts", import.meta.url), { type: "module" })
      }
      const baseUrl = window.location.origin === "null" ? window.location.href : window.location.origin
      const workerOptions: Parameters<typeof PGliteWorker.create>[1] & { __ftbBaseUrl?: string } = {
        dataDir: DATA_DIR,
        __ftbBaseUrl: baseUrl,
      }
      pgInstance = await PGliteWorker.create(pgWorker, workerOptions)
      if (signal?.aborted) {
        await pgInstance.close()
        pgInstance = null
        throw new Error("getDb aborted")
      }
      // テーブル作成 (Classical Approach: 常に実DBへのDDLを実行して整合性を保つ)
      await pgInstance.exec(`
        CREATE TABLE IF NOT EXISTS files (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          session_id TEXT NOT NULL,
          file_set TEXT NOT NULL,
          category TEXT,
          file_name TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          size INTEGER NOT NULL,
          idb_key TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          deleted_at TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_files_session_id ON files(session_id);
        CREATE INDEX IF NOT EXISTS idx_files_file_set ON files(file_set);
        CREATE INDEX IF NOT EXISTS idx_files_category ON files(category);
      `)
      dbInstance = drizzle(pgInstance as unknown as PGlite, { schema })
      notify()
      return dbInstance
    } catch (e) {
      initPromise = null
      lastError = e instanceof Error ? e : new Error(String(e))
      try {
        await pgInstance?.close()
      } catch {
        /* noop */
      }
      pgInstance = null
      try {
        pgWorker?.terminate()
      } catch {
        /* noop */
      }
      pgWorker = null
      notify()
      throw e
    }
  })()

  return initPromise
}

/**
 * データベースインスタンスを取得するためのHook
 * useSyncExternalStore を使用して外部ステート（Singleton）と同期する
 */
export function usePgliteStore() {
  const db = useExternalStore({ subscribe, getSnapshot: () => dbInstance, getServerSnapshot: () => null })
  const error = useExternalStore({ subscribe, getSnapshot: () => lastError, getServerSnapshot: () => null })
  if (typeof window !== "undefined" && !dbInstance && !initPromise) {
    getDb().catch(() => {}) // エラーは lastError/notify で管理される
  }
  return { db, error, isLoading: !db && !error }
}
