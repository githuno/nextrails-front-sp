import { openDB, IDBPDatabase, deleteDB } from "idb";
import { useState, useRef } from "react";

// BaseFileBlobインターフェース (Blobデータ用)
export interface BaseFileBlob {
  id: string;
  blob: Blob;
}

// BaseFileInfoインターフェース (ファイル情報用)
export interface BaseFileInfo {
  id: string;
  path: string | null;
}

interface IdbState {
  isLoading: boolean;
  isPosting: string[];
  isDeleting: string[];
}

class Idb<T extends BaseFileInfo> {
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
  
  // async updateFileInfoPaths(storeName: string): Promise<void> {
  //   const db = await this.createStore(storeName);
  //   const tx = db.transaction([storeName, `${storeName}-blobs`], "readwrite");
  //   const store = tx.objectStore(storeName);
  
  //   // すべてのobjectURLを削除
  //   this.revokeObjectURLs();
  
  //   const storeFiles = (await store.getAll()) as T[];
  //   for (const file of storeFiles) {
  //     const blob = await store.get(file.id) as BaseFileBlob;
  //     if (blob) {
  //       const path = URL.createObjectURL(blob.blob);
  //       this.objectURLs.set(file.id, path);
  //       file.path = path;
  //       await store.put(file);
  //     }
  //   }
  // }

  async getAll(): Promise<T[]> {
    this.updateState({ isLoading: true });
    try {
      const db = await openDB(this.dbName);
      const tx = db.transaction(db.objectStoreNames, "readonly");
      const allObjects = await Promise.all(
        Array.from(tx.objectStoreNames).map(async (storeName) => {
          const store = tx.objectStore(storeName);
          return await store.getAll();
        })
      );
      const objects = allObjects.flat() as T[];
      return objects;
    } catch (error) {
      console.error("Error fetching all objects:", error);
      throw error;
    } finally {
      this.updateState({ isLoading: false });
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
            db.createObjectStore(storeName, { keyPath: "id" });
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
        objects.forEach((object: { id: string }) => {
          const url = this.objectURLs.get(object.id);
          if (url) {
            URL.revokeObjectURL(url);
            this.objectURLs.delete(object.id);
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

  async get(storeName: string, id?: string): Promise<T | T[] | undefined> {
    this.updateState({ isLoading: true });
    try {
      const db = await this.createStore(storeName); // storeがなければ作成される
      const tx = db.transaction(storeName, "readonly");
      const fileInfoStore = tx.objectStore(storeName);
      if (id) {
        return (await fileInfoStore.get(id)) as T | undefined;
      } else {
        return (await fileInfoStore.getAll()) as T[];
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

  async post(
    storeName: string,
    data: Omit<T, "path"> & { blob: Blob }
  ): Promise<void> {
    this.updateState({ isPosting: [...this.state.isPosting, data.id] });
    try {
      const db = await openDB(this.dbName);
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      await store.add(data);
    } catch (error) {
      console.error("Error post object:", error);
      throw error;
    } finally {
      this.updateState({
        isPosting: this.state.isPosting.filter((id) => id !== data.id),
      });
    }
  }

  async put(storeName: string, data: T): Promise<void> {
    this.updateState({ isPosting: [...this.state.isPosting, data.id] });
    try {
      const db = await openDB(this.dbName);
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const existingFile = (await store.get(data.id)) as T;
      if (!existingFile) {
        throw new Error(`File with id ${data.id} not found`);
      }

      // 一部のみ更新可能
      const updatedFile = {
        ...existingFile,
        ...data,
        id: existingFile.id, // idは更新不可
        path: existingFile.path, // pathは更新不可
      };
      await store.put(updatedFile);
    } catch (error) {
      console.error("Error put object:", error);
      throw error;
    } finally {
      this.updateState({
        isPosting: this.state.isPosting.filter((id) => id !== data.id),
      });
    }
  }

  async delete(storeName: string, id: string): Promise<void> {
    this.updateState({ isDeleting: [...this.state.isDeleting, id] });
    try {
      const db = await openDB(this.dbName);
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      await store.delete(id);
      const url = this.objectURLs.get(id);
      if (url) {
        URL.revokeObjectURL(url);
        this.objectURLs.delete(id);
      }
    } catch (error) {
      console.error("Error delete object:", error);
      throw error;
    } finally {
      this.updateState({
        isDeleting: this.state.isDeleting.filter((deleteId) => deleteId !== id),
      });
    }
  }
}

const useIdb = <T extends BaseFileInfo>(
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

