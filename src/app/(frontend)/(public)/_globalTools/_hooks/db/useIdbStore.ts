import { openDB, type IDBPDatabase } from "idb"

/**
 * IndexedDBをBLOB専用の「ローカルS3」として扱うためのラッパー
 * メタデータ管理はPgliteに任せ、ここでは純粋なバイナリ保存のみを担当する
 */
const DB_NAME = "local-s3-bucket"
const STORE_NAME = "objects"
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase> | null = null

/**
 * DB接続の初期化（シングルトン）
 */
const getDB = async (): Promise<IDBPDatabase> => {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB is only available in the browser")
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          // keyPathなし（アウトオブラインキー）で作成
          db.createObjectStore(STORE_NAME)
        }
      },
    })
  }
  return dbPromise
}

export const useIdbStore = () => ({
  /**
   * S3のputObjectに相当: Blob/Fileをキーで保存
   */
  put: async (key: string, data: Blob | File): Promise<void> => {
    try {
      const db = await getDB()
      await db.put(STORE_NAME, data, key)
    } catch (error) {
      throw new Error("IdbStore: Failed to put object [" + key + "]", { cause: error })
    }
  },

  /**
   * S3のgetObjectに相当: キーからBlobを取得
   */
  get: async (key: string): Promise<Blob | undefined> => {
    try {
      const db = await getDB()
      const result = await db.get(STORE_NAME, key)
      return result as Blob | undefined
    } catch (error) {
      throw new Error("IdbStore: Failed to get object [" + key + "]", { cause: error })
    }
  },

  /**
   * S3のdeleteObjectに相当: キーで削除
   */
  remove: async (key: string): Promise<void> => {
    try {
      const db = await getDB()
      await db.delete(STORE_NAME, key)
    } catch (error) {
      throw new Error("IdbStore: Failed to delete object [" + key + "]", { cause: error })
    }
  },

  /**
   * バケットの全削除
   */
  clear: async (): Promise<void> => {
    try {
      const db = await getDB()
      await db.clear(STORE_NAME)
    } catch (error) {
      throw new Error("IdbStore: Failed to clear bucket", { cause: error })
    }
  },

  /**
   * キー一覧の取得
   */
  listKeys: async (): Promise<string[]> => {
    try {
      const db = await getDB()
      const keys = await db.getAllKeys(STORE_NAME)
      return keys.map((k) => String(k))
    } catch (error) {
      throw new Error("IdbStore: Failed to list keys", { cause: error })
    }
  },
})
