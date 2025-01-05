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

// IdbクラスにBaseFileInfoを継承した型Tを渡す
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

  async updateFileInfoPaths(storeName: string): Promise<void> {
    const db = await this.createStore(storeName);
    const tx = db.transaction([storeName, `${storeName}-blobs`], "readwrite");
    const fileInfoStore = tx.objectStore(storeName);
    const blobStore = tx.objectStore(`${storeName}-blobs`);
    const fileInfos = (await fileInfoStore.getAll()) as T[];
  
    // すべてのobjectURLを削除
    this.revokeObjectURLs();
  
    for (const fileInfo of fileInfos) {
      const blobData = (await blobStore.get(fileInfo.id)) as BaseFileBlob;
      if (blobData) {
        // 新しいobjectURLをセット
        const path = URL.createObjectURL(blobData.blob);
        this.objectURLs.set(fileInfo.id, path);
        // fileInfoのpathを更新
        fileInfo.path = path;
        await fileInfoStore.put(fileInfo); // 更新されたfileInfoを保存
      }
    }
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

  async getAll(): Promise<T[]> {
    this.updateState({ isLoading: true });
    try {
      const db = await openDB(this.dbName);
      const tx = db.transaction(db.objectStoreNames, "readonly");
      const allObjects = await Promise.all(
        Array.from(db.objectStoreNames)
          .filter((storeName) => storeName.endsWith("-blobs"))
          .map(async (storeName) => {
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
            db.createObjectStore(`${storeName}-blobs`, { keyPath: "id" }); // blobストアも作成
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
        db.deleteObjectStore(storeName);
        db.deleteObjectStore(`${storeName}-blobs`); // blobストアも削除
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
      const db = await this.createStore(storeName);
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

  async getBlob(storeName: string, id: string): Promise<Blob | undefined> {
    this.updateState({ isLoading: true });
    try {
      const db = await this.createStore(storeName);
      const tx = db.transaction(`${storeName}-blobs`, "readonly");
      const blobStore = tx.objectStore(`${storeName}-blobs`);
      const blobData = (await blobStore.get(id)) as BaseFileBlob | undefined; // BaseFileBlob型で取得
      return blobData?.blob; // blobを返す
    } catch (error) {
      console.error("Error fetching blob:", error);
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
      const tx = db.transaction([storeName, `${storeName}-blobs`], "readwrite");
      const fileInfoStore = tx.objectStore(storeName);
      const blobStore = tx.objectStore(`${storeName}-blobs`);
      const path = URL.createObjectURL(data.blob);
      const { blob, ...fileInfoWithoutBlob } = data;
      const fileInfo: T = {
        ...fileInfoWithoutBlob,
        path: path,
      } as unknown as T;
      await fileInfoStore.add(fileInfo);
      await blobStore.add({ id: data.id, blob: data.blob });
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
      const fileInfoStore = tx.objectStore(storeName);
      const existingFileInfo = (await fileInfoStore.get(data.id)) as T;
      if (!existingFileInfo) {
        throw new Error(`File with id ${data.id} not found`);
      }

      // 一部のみ更新可能
      const updatedFileInfo = {
        ...existingFileInfo,
        ...data,
        id: existingFileInfo.id, // idは更新不可
        path: existingFileInfo.path, // pathは更新不可
      };
      await fileInfoStore.put(updatedFileInfo);
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
      const tx = db.transaction([storeName, `${storeName}-blobs`], "readwrite");
      const fileInfoStore = tx.objectStore(storeName);
      const blobStore = tx.objectStore(`${storeName}-blobs`);
      await blobStore.delete(id);
      await fileInfoStore.delete(id);
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
