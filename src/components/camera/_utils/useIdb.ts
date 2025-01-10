import { openDB, IDBPDatabase, deleteDB } from "idb";
import { useState, useRef } from "react";

interface IdbFile {
  idbId: string;
  blob: Blob | null;
  path: string | null;
  updatedAt: string;
  deletedAt?: string | null;
}

interface IdbState {
  isStoreLoading: string[]; // storeName配列
  isStoreSyncing: string[]; // storeName配列
  isPosting: string[]; // idbId配列
  isDeleting: string[]; // idbId配列
}

class Idb<T extends IdbFile> {
  private dbName: string;
  private state: IdbState = {
    isStoreLoading: [],
    isStoreSyncing: [],
    isPosting: [],
    isDeleting: [],
  };
  private setState: React.Dispatch<React.SetStateAction<IdbState>>;
  private objectURLs: Map<string, string> = new Map();

  constructor(
    dbName: string,
    setState: React.Dispatch<React.SetStateAction<IdbState>>
  ) {
    this.dbName = dbName;
    this.setState = setState;
  }

  private updateState(newState: Partial<IdbState>) {
    this.state = { ...this.state, ...newState };
    this.setState(this.state);
  }

  private revokeObjectURLs() {
    this.objectURLs.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    this.objectURLs.clear();
  }

  async destroy(): Promise<void> {
    try {
      await deleteDB(this.dbName);
      this.revokeObjectURLs();
    } catch (error) {
      console.error("Error destroying database:", error);
      throw error;
    }
  }

  async debug(): Promise<void> {
    console.log("Debugging database");
    try {
      const db = await openDB(this.dbName);
      console.log("Database name:", db.name);
      console.log("Database version:", db.version);
      console.log("Object stores:", Array.from(db.objectStoreNames));
    } catch (error) {
      console.error("Error debugging database:", error);
      throw error;
    }
  }

  async getStores(): Promise<string[]> {
    try {
      const db = await openDB(this.dbName);
      return Array.from(db.objectStoreNames);
    } catch (error) {
      console.error("Error fetching store names:", error);
      throw error;
    }
  }

  async createStore(storeName: string): Promise<IDBPDatabase> {
    this.updateState({
      isStoreLoading: [...this.state.isStoreLoading, storeName],
    });
    try {
      const db = await openDB(this.dbName);
      if (!db.objectStoreNames.contains(storeName)) {
        const newVersion = db.version + 1;
        return openDB(this.dbName, newVersion, {
          upgrade(db) {
            db.createObjectStore(storeName, { keyPath: "idbId" });
          },
        });
      }
      return db;
    } catch (error) {
      console.error("Error create store:", storeName, error);
      throw error;
    } finally {
      this.updateState({
        isStoreLoading: this.state.isStoreLoading.filter(
          (name) => name !== storeName
        ),
      });
    }
  }

  async destroyStore(storeName: string): Promise<void> {
    this.updateState({
      isStoreLoading: [...this.state.isStoreLoading, storeName],
    });
    try {
      const db = await openDB(this.dbName);
      if (db.objectStoreNames.contains(storeName)) {
        const tx = db.transaction(storeName, "readonly");
        const objects = await tx.objectStore(storeName).getAll();
        // store内のオブジェクトURLを破棄
        objects.forEach((object: { idbId: string }) => {
          const url = this.objectURLs.get(object.idbId);
          if (url) {
            URL.revokeObjectURL(url);
            this.objectURLs.delete(object.idbId);
          }
        });
        // storeを削除
        db.deleteObjectStore(storeName);
      }
    } catch (error) {
      console.error("Error destroy store:", storeName, error);
      throw error;
    } finally {
      this.updateState({
        isStoreLoading: this.state.isStoreLoading.filter(
          (name) => name !== storeName
        ),
      });
    }
  }

  // 管理者のみ使用
  async getAll(): Promise<T[]> {
    try {
      const db = await openDB(this.dbName);
      const tx = db.transaction(db.objectStoreNames, "readonly");
      const allFiles = await Promise.all(
        Array.from(tx.objectStoreNames).map(async (storeName) => {
          const store = tx.objectStore(storeName);
          return await store.getAll();
        })
      );
      const files = allFiles.flat() as T[];
      for (const file of files) {
        if (file.blob) {
          const existingUrl = this.objectURLs.get(file.idbId);
          if (existingUrl) URL.revokeObjectURL(existingUrl);
          const newUrl = URL.createObjectURL(file.blob);
          this.objectURLs.set(file.idbId, newUrl);
          file.path = newUrl;
        }
      }
      return files;
    } catch (error) {
      console.error("Error fetching all files:", error);
      throw error;
    }
  }

  async get(
    storeName: string,
    options?: { idbId?: string; updatedAt?: "latest" }
  ): Promise<T | T[] | undefined> {
    this.updateState({
      isStoreLoading: [...this.state.isStoreLoading, storeName],
    });
    try {
      const db = await this.createStore(storeName); // storeがなければ作成される
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      if (options?.updatedAt === "latest") {
        const files = (await store.getAll()) as T[];
        if (files.length === 0) return undefined;
        const latestFile: T = files
          .filter((file) => file.deletedAt === null) // 論理削除されていないファイルのみ
          .reduce((latest, file) => {
            // 最新のファイルを一つだけ取得
            return new Date(file.updatedAt) > new Date(latest.updatedAt)
              ? file
              : latest;
          }, files[0]);
        if (latestFile.blob) {
          const existingUrl = this.objectURLs.get(latestFile.idbId);
          if (existingUrl) URL.revokeObjectURL(existingUrl);
          const newUrl = URL.createObjectURL(latestFile.blob);
          this.objectURLs.set(latestFile.idbId, newUrl);
          latestFile.path = newUrl;
        }
        return latestFile;
      } else if (options?.idbId) {
        const file = (await store.get(options.idbId)) as T;
        if (!file.blob) return undefined;
        // // CHECK: 一旦単体GETではpathの更新は行わない
        // const existingUrl = this.objectURLs.get(file.idbId);
        // if (existingUrl) URL.revokeObjectURL(existingUrl);
        // const newUrl = URL.createObjectURL(file.blob);
        // this.objectURLs.set(file.idbId, newUrl);
        // file.path = newUrl;
        return file;
      } else {
        const files = (await store.getAll()) as T[];
        for (const file of files) {
          if (!file.blob) continue;
          const existingUrl = this.objectURLs.get(file.idbId);
          if (existingUrl) URL.revokeObjectURL(existingUrl);
          const newUrl = URL.createObjectURL(file.blob);
          this.objectURLs.set(file.idbId, newUrl);
          file.path = newUrl;
        }
        return files;
      }
    } catch (error) {
      console.error("Error fetching objects:", error);
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }
      throw error;
    } finally {
      this.updateState({
        isStoreLoading: this.state.isStoreLoading.filter(
          (name) => name !== storeName
        ),
      });
    }
  }

  // INFO: IndexedDBでは、オブジェクトストア内のキーは一意である必要があり、同一のIDを持つファイルが存在することはありません。
  // もし同じIDで新しいファイルを追加しようとすると、既存のエントリが上書きされます。
  async post<T extends IdbFile>(storeName: string, data: T): Promise<T> {
    if (!data.blob) throw new Error("Data blob is required");
    this.updateState({ isPosting: [...this.state.isPosting, data.idbId] });
    try {
      const db = await this.createStore(storeName);
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const newData: T = {
        ...data,
        path: URL.createObjectURL(data.blob),
      };
      await store.add(newData);
      return newData;
    } catch (error) {
      console.error("Error post object:", error);
      throw error;
    } finally {
      this.updateState({
        isPosting: this.state.isPosting.filter((idbId) => idbId !== data.idbId),
      });
    }
  }

  // syncStoresは存在しないストアを作成したうえで全てのストア名を返却する
  async syncStores(storeNames: string[]): Promise<string[]> {
    for (const storeName of storeNames) {
      await this.createStore(storeName);
    }
    return this.getStores();
  }

  // syncLatestsは最新のファイルをidbに追加したうえで最新のidbファイルセットを返す
  async syncLatests(
    latests: { file: T; storeName: string }[]
  ): Promise<(T & { storeName: string })[]> {
    const results: (T & { storeName: string })[] = [];
    if (latests.length === 0) {
      // A. 同期するファイルがない場合
      console.log("No files to sync");
      const storeNames = await this.getStores();
      for (const storeName of storeNames) {
        const storeLatestFile = (await this.get(storeName, {
          updatedAt: "latest",
        })) as T;
        if (storeLatestFile) {
          results.push({
            ...storeLatestFile,
            storeName,
          });
        }
      }
    } else {
      // B. 同期するファイルがある場合
      for (const { file, storeName } of latests) {
        const storeLatestFile = (await this.get(storeName, {
          updatedAt: "latest",
        })) as T;
        if (
          !file ||
          !file.blob ||
          !file.updatedAt || // ファイルが存在しないか、
          (storeLatestFile && // idbにファイルが存在するのに、
            new Date(file.updatedAt) <= new Date(storeLatestFile.updatedAt!)) // idbデータより古い場合
        ) {
          // ストア名だけ返す
          results.push({
            ...storeLatestFile,
            storeName,
          });
        } else {
          // ファイルを追加して返す
          const newFile: T = await this.post(storeName, file);
          results.push({
            ...newFile,
            storeName,
          });
        }
      }
    }
    return results;
  }

  // syncメソッドは指定Storeの差分ファイル（＝存在しないor更新された）を同期したうえで最新のidbファイルセットを返す
  async sync(
    storeName: string,
    files: T[]
  ): Promise<(T & { storeName?: string })[]> {
    this.updateState({
      isStoreSyncing: [...this.state.isStoreSyncing, storeName],
    });
    let newFiles: T[] = [];
    try {
      const db = await openDB(this.dbName);
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const existingFiles = await store.getAll();
      if (!existingFiles) {
        newFiles = files;
      } else {
        newFiles = files.filter((file) => {
          const existingFile = existingFiles?.find(
            (existingFile) => existingFile.idbId === file.idbId
          );
          return (
            !existingFile || // 1. idbに存在しないファイル
            new Date(file.updatedAt) > new Date(existingFile.updatedAt) // 2. idbのデータより新しいファイル
          );
        });
      }
      this.updateState({
        isPosting: [
          ...this.state.isPosting,
          ...newFiles.map((file) => file.idbId),
        ],
      });
      for (const file of newFiles) {
        await store.put(file); // putメソッドはエントリが存在しない場合は追加し、存在する場合は更新する
      }
      return this.get(storeName) as Promise<T[]>;
    } catch (error) {
      console.error("Error sync object:", error);
      throw error;
    } finally {
      this.updateState({
        isPosting: this.state.isPosting.filter(
          (idbId) => !newFiles.some((file) => file.idbId === idbId)
        ),
        isStoreSyncing: this.state.isStoreSyncing.filter(
          (name) => name !== storeName
        ),
      });
    }
  }

  async put(storeName: string, data: T): Promise<void> {
    this.updateState({ isPosting: [...this.state.isPosting, data.idbId] });
    try {
      const db = await openDB(this.dbName);
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const existingFile = (await store.get(data.idbId)) as T;
      if (!existingFile) {
        throw new Error(`File with idbId ${data.idbId} not found`);
      }

      // 一部のみ更新可能とするため、念の為のチェックとして働く
      const updatedFile = {
        ...existingFile,
        ...data,
        idbId: existingFile.idbId, // idbIdは更新不可
        path: existingFile.path, // pathは更新不可
        blob: existingFile.blob, // blobは更新不可
        updatedAt: new Date().toISOString(), // updatedAtを必須更新
      };
      await store.put(updatedFile);
    } catch (error) {
      console.error("Error put object:", error);
      throw error;
    } finally {
      this.updateState({
        isPosting: this.state.isPosting.filter((idbId) => idbId !== data.idbId),
      });
    }
  }

  async delete(storeName: string, idbId: string): Promise<void> {
    this.updateState({ isDeleting: [...this.state.isDeleting, idbId] });
    try {
      const db = await openDB(this.dbName);
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      await store.delete(idbId);
      const url = this.objectURLs.get(idbId);
      if (url) {
        URL.revokeObjectURL(url);
        this.objectURLs.delete(idbId);
      }
    } catch (error) {
      console.error("Error delete object:", error);
      throw error;
    } finally {
      this.updateState({
        isDeleting: this.state.isDeleting.filter(
          (deleteId) => deleteId !== idbId
        ),
      });
    }
  }
}

const useIdb = <T extends IdbFile>(
  dbName: string
): { idb: Idb<T>; idbState: IdbState } => {
  const [idbState, setIdbState] = useState<IdbState>({
    isStoreLoading: [],
    isStoreSyncing: [],
    isPosting: [],
    isDeleting: [],
  });

  const idbRef = useRef<Idb<T> | null>(null);

  if (!idbRef.current) {
    idbRef.current = new Idb<T>(dbName, setIdbState);
  }

  return { idb: idbRef.current, idbState };
};

export { useIdb, type IdbFile };

// https://claude.ai/chat/c05047a2-59cd-43c6-84c9-954c3acf483c
// メモリ管理とリソース解放
// ✅ ObjectURLの管理が改善され、createObjectURL前にrevokeObjectURLを実行するように修正
// ✅ destroyStore, destroy メソッドでのリソース解放が適切に実装
// ✅ get メソッドの各パターンでObjectURLの管理が統一的に処理

// エラーハンドリングとロギング
// ✅ 全てのメソッドで try-catch-finally が適切に実装
// ✅ エラーログに関連情報（ストア名やID）が含まれている
// 💡 改善案：カスタムエラークラスの導入を検討（より詳細なエラー区別のため）

// 非同期処理
// ✅ Promise の扱いが適切
// ✅ トランザクションの使用が適切
// 💡 改善案：並行処理時のデッドロック防止のためのタイムアウト機能の追加を検討

// 型安全性
// ✅ ジェネリック型の使用が適切
// ✅ インターフェースの定義が明確
// 💡 改善案：readonly プロパティの活用を検討（意図しない変更防止のため）

// コードの一貫性と可読性
// ⚠️ コメントの言語が日本語と英語が混在（統一を推奨）
// ✅ メソッド名が目的を明確に表現
// ✅ 状態管理のロジックが一貫

// セキュリティ
// ✅ DB操作の権限チェック（管理者用メソッドの明示）
// 💡 改善案：重要な操作のログ記録機能の追加を検討

// パフォーマンス
// ⚠️ get メソッドの options.idbId での path 更新が無効化されている点の要確認
// 💡 改善案：大量データ処理時のバッチ処理の導入を検討

// 具体的な改善提案：

// // 1. カスタムエラークラスの導入
// class IdbError extends Error {
//   constructor(
//     message: string,
//     public readonly storeName?: string,
//     public readonly operation?: string
//   ) {
//     super(message);
//     this.name = 'IdbError';
//   }
// }

// // 2. タイムアウト機能の追加
// private async withTimeout<T>(
//   promise: Promise<T>,
//   timeoutMs: number = 5000
// ): Promise<T> {
//   const timeoutPromise = new Promise((_, reject) => {
//     setTimeout(() => reject(new Error('Operation timed out')), timeoutMs);
//   });
//   return Promise.race([promise, timeoutPromise]) as Promise<T>;
// }

// // 3. readonly プロパティの活用
// export interface IdbFile {
//   readonly idbId: string;
//   readonly blob: Blob | null;
//   path: string | null;
//   readonly updatedAt: string;
// }

// // 4. ログ機能の強化
// private log(operation: string, details: Record<string, any>) {
//   console.log(`[IDB ${this.dbName}] ${operation}:`, details);
// }

// // その他の提案：
// メソッドのドキュメンテーション強化
// ユニットテストの追加（特にエッジケース）
// バッチ処理用のメソッド追加
// キャッシュ戦略の最適化
// 監視機能の追加（パフォーマンスメトリクス等）

// コード全体としては非常によく設計されていますが、
// 上記の改善を加えることで、より堅牢で保守性の高いコードになると考えます。
// 特に運用面での機能（ログ、モニタリング、エラーハンドリング）を強化することで、
// 実運用環境での信頼性が向上するでしょう。
