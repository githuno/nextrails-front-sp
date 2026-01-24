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

const listeners = new Set<() => void>()

export const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const notify = () => listeners.forEach((l) => l())

/**
 * PgliteとDrizzleの接続を初期化する
 */
export const getDb = async () => {
  if (dbInstance) return dbInstance
  if (initPromise) return initPromise

  initPromise = (async () => {
    try {
      if (typeof window === "undefined") {
        throw new Error("PGlite is only available in the browser")
      }

      if (!pgWorker) {
        pgWorker = new Worker(new URL("./pgliteWorker.ts", import.meta.url), {
          type: "module",
        })
      }

      // 永続化に IndexedDB を使用 (固定データベース名で集約管理)
      const baseUrl = window.location.origin === "null" ? window.location.href : window.location.origin
      const workerOptions: Parameters<typeof PGliteWorker.create>[1] & { __ftbBaseUrl: string } = {
        dataDir: "idb://ftb-global-database",
        __ftbBaseUrl: baseUrl,
      }
      pgInstance = await PGliteWorker.create(pgWorker, workerOptions)
      dbInstance = drizzle(pgInstance as unknown as PGlite, { schema })

      // カラムまで含めて整合性をチェック (information_schema を使用)
      const columnCheckRes = await pgInstance.query<{ exists: boolean }>(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'files' AND column_name = 'file_set'
        ) as exists;
      `)

      if (!columnCheckRes.rows[0]?.exists) {
        // テーブルを安全に削除して再作成（開発中あるいは内部ツールなので破壊的変更を許容）
        await pgInstance.exec(`
          DROP TABLE IF EXISTS files;
          CREATE TABLE files (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            session_id TEXT NOT NULL,
            file_set TEXT NOT NULL,
            file_name TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            size INTEGER NOT NULL,
            idb_key TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMP
          );
          CREATE INDEX idx_files_session_id ON files(session_id);
          CREATE INDEX idx_files_file_set ON files(file_set);
        `)
        console.log("[PgliteStore] Column mismatch detected, table recreated.")
      }

      notify()
      return dbInstance
    } catch (e) {
      initPromise = null // 失敗時は再試行可能にする
      lastError = e instanceof Error ? e : new Error(String(e))

      try {
        await pgInstance?.close()
      } catch {
        // noop
      }
      pgInstance = null
      try {
        pgWorker?.terminate()
      } catch {
        // noop
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
  const db = useExternalStore({
    subscribe,
    getSnapshot: () => dbInstance,
    getServerSnapshot: () => null,
  })
  const error = useExternalStore({
    subscribe,
    getSnapshot: () => lastError,
    getServerSnapshot: () => null,
  })
  // クライアントサイドで未初期化なら起動する
  if (typeof window !== "undefined" && !dbInstance && !initPromise) {
    getDb().catch(() => {}) // エラーは lastError/notify で管理される
  }
  return { db, error, isLoading: !db && !error }
}
