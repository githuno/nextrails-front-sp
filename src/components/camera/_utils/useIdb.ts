import { openDB, IDBPDatabase, deleteDB } from "idb";
import { useState, useRef } from "react";

export interface IdbFile {
  idbId: string;
  blob: Blob | null;
  path: string | null;
  updatedAt: string;
}

interface IdbState {
  isLoading: boolean;
  isPosting: string[];
  isDeleting: string[];
}

class Idb<T extends IdbFile> {
  private dbName: string;
  private state: IdbState = {
    isLoading: false,
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
    this.updateState({ isLoading: true });
    try {
      await deleteDB(this.dbName);
      this.revokeObjectURLs();
    } catch (error) {
      console.error("Error destroying database:", error);
      throw error;
    } finally {
      this.updateState({ isLoading: false });
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
    this.updateState({ isLoading: true });
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
      this.updateState({ isLoading: false });
    }
  }

  async destroyStore(storeName: string): Promise<void> {
    this.updateState({ isLoading: true });
    try {
      const db = await openDB(this.dbName);
      if (db.objectStoreNames.contains(storeName)) {
        // store内のオブジェクトURLを破棄
        const tx = db.transaction(storeName, "readonly");
        const objects = await tx.objectStore(storeName).getAll();
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
      this.updateState({ isLoading: false });
    }
  }

  // 管理者のみ使用
  async getAll(): Promise<T[]> {
    this.updateState({ isLoading: true });
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
        if (!file.blob) continue;
        file.path = URL.createObjectURL(file.blob);
      }
      return files;
    } catch (error) {
      console.error("Error fetching all files:", error);
      throw error;
    } finally {
      this.updateState({ isLoading: false });
    }
  }

  async get(
    storeName: string,
    options?: { idbId?: string; updatedAt?: "latest" }
  ): Promise<T | T[] | undefined> {
    this.updateState({ isLoading: true });
    try {
      const db = await this.createStore(storeName); // storeがなければ作成される
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      if (options?.updatedAt === "latest") {
        const files = (await store.getAll()) as T[];
        if (files.length === 0) return undefined;
        const latestFile = files.reduce((latest, file) => {
          return new Date(file.updatedAt) > new Date(latest.updatedAt)
            ? file
            : latest;
        });
        if (latestFile.blob) {
          latestFile.path = URL.createObjectURL(latestFile.blob);
        }
        return latestFile;
      } else if (options?.idbId) {
        const file = (await store.get(options.idbId)) as T;
        if (!file.blob) return undefined;
        file.path = URL.createObjectURL(file.blob);
        return file;
      } else {
        const files = (await store.getAll()) as T[];
        for (const file of files) {
          if (!file.blob) continue;
          file.path = URL.createObjectURL(file.blob);
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
      this.updateState({ isLoading: false });
    }
  }

  // INFO: IndexedDBでは、オブジェクトストア内のキーは一意である必要があり、同一のIDを持つファイルが存在することはありません。
  // もし同じIDで新しいファイルを追加しようとすると、既存のエントリが上書きされます。
  async post(storeName: string, data: T): Promise<void> {
    this.updateState({ isPosting: [...this.state.isPosting, data.idbId] });
    try {
      const db = await openDB(this.dbName);
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const newData = {
        ...data,
        updatedAt: new Date().toISOString(),
      };
      await store.add(newData);
    } catch (error) {
      console.error("Error post object:", error);
      throw error;
    } finally {
      this.updateState({
        isPosting: this.state.isPosting.filter((idbId) => idbId !== data.idbId),
      });
    }
  }

  // syncメソッドはidbに存在しない、または更新されたファイルをidbにaddする
  async sync(storeName: string, files: T[]) {
    let newFiles: T[] = [];
    try {
      const db = await openDB(this.dbName);
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const existingFiles = (await store.get(storeName)) as T[];
      newFiles = files.filter((file) => {
        const existingFile = existingFiles?.find(
          (existingFile) => existingFile.idbId === file.idbId
        );
        return (
          !existingFile ||
          new Date(file.updatedAt) > new Date(existingFile.updatedAt)
        );
      });
      this.updateState({
        isPosting: [
          ...this.state.isPosting,
          ...newFiles.map((file) => file.idbId),
        ],
      });
      for (const file of newFiles) {
        await store.put(file); // putメソッドは、エントリが存在しない場合は追加し、存在する場合は更新する
      }
      return this.get(storeName);
    } catch (error) {
      console.error("Error sync object:", error);
      throw error;
    } finally {
      this.updateState({
        isPosting: this.state.isPosting.filter(
          (idbId) => !newFiles.some((file) => file.idbId === idbId)
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

      // 一部のみ更新可能
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
    isLoading: false,
    isPosting: [],
    isDeleting: [],
  });

  const idbRef = useRef<Idb<T> | null>(null);

  if (!idbRef.current) {
    idbRef.current = new Idb<T>(dbName, setIdbState);
  }

  return { idb: idbRef.current, idbState };
};

export default useIdb;
