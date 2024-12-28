import { openDB, IDBPDatabase, deleteDB } from "idb";
import { useState, useCallback } from "react";
import { Media } from "./types";

interface IDBMediaProps {
  dbName: string;
}

interface FetchIDBArgs<T> {
  method: "AllGET" | "AllDELETE" | "AllDEBUG" | "GET" | "POST" | "DELETE";
  storeName: string;
  data?: T;
}

const useIDBMedia = <T extends Media>({ dbName }: IDBMediaProps) => {
  const [isLoading, setIsLoading] = useState(true);

  const destroyDB = useCallback(async (): Promise<void> => {
    try {
      await deleteDB(dbName);
    } catch (error) {
      console.error("Error destroying database:", error);
      throw error;
    }
  }, [dbName]);

  const debugDB = useCallback(async () => {
    console.log("Debugging database");
    try {
      const db = await openDB(dbName);
      console.log("Database name:", db.name);
      console.log("Database version:", db.version);
      console.log("Object stores:", Array.from(db.objectStoreNames));
    } catch (error) {
      console.error("Error debugging database:", error);
      throw error;
    }
  }, [dbName]);

  const getAllObjects = useCallback(async (): Promise<Media[]> => {
    try {
      const db = await openDB(dbName);
      const tx = db.transaction(db.objectStoreNames, "readonly");
      const allObjects = await Promise.all(
        Array.from(tx.objectStoreNames).map(async (storeName) => {
          const store = tx.objectStore(storeName);
          return await store.getAll();
        })
      );
      const objects = allObjects
        .flat()
        .map((media: { id: string; blob: Blob; isUploaded: boolean }) => ({
          id: media.id,
          url: URL.createObjectURL(media.blob),
          blob: media.blob,
          isUploaded: media.isUploaded || false,
          type: media.blob.type.startsWith("image") ? "image" : "video",
        }));
      return objects as Media[];
    } catch (error) {
      console.error("Error fetching all objects:", error);
      throw error;
    }
  }, [dbName]);

  const initStore = useCallback(
    async (storeName: string): Promise<IDBPDatabase> => {
      console.log("Initializing store:", storeName);
      try {
        const db = await openDB(dbName);
        if (!db.objectStoreNames.contains(storeName)) {
          const newVersion = db.version + 1;
          return openDB(dbName, newVersion, {
            upgrade(db) {
              db.createObjectStore(storeName, { keyPath: "id" });
            },
          });
        }
        return db;
      } catch (error) {
        console.error("Error initializing store:", storeName, error);
        throw error;
      }
    },
    [dbName]
  );

  const deleteStore = useCallback(
    async (storeName: string): Promise<void> => {
      try {
        const db = await openDB(dbName);
        if (db.objectStoreNames.contains(storeName)) {
          db.deleteObjectStore(storeName);
        }
      } catch (error) {
        console.error("Error deleting store:", storeName, error);
        throw error;
      }
    },
    [dbName]
  );

  const getStoreObjects = useCallback(
    async (storeName: string): Promise<Media[]> => {
      try {
        const db = await initStore(storeName);
        const tx = db.transaction(storeName, "readonly");
        const storeObjects = await tx.objectStore(storeName).getAll();
        const objects = storeObjects.map(
          (media: { id: string; blob: Blob; isUploaded: boolean }) => ({
            id: media.id,
            url: URL.createObjectURL(media.blob),
            blob: media.blob,
            isUploaded: media.isUploaded || false,
            type: media.blob.type.startsWith("image") ? "image" : "video",
          })
        );
        return objects as Media[];
      } catch (error) {
        console.error("Error fetching objects:", error);
        if (error instanceof Error) {
          console.error("Error message:", error.message);
          console.error("Error stack:", error.stack);
        }
        throw error;
      }
    },
    [dbName]
  );

  const postStoreObject = async (storeName: string, data: T): Promise<void> => {
    try {
      const db = await initStore(storeName);
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      await store.add(data);
    } catch (error) {
      console.error("Error saving object:", error);
      throw error;
    }
  };

  const deleteStoreObject = async (
    storeName: string,
    id: string
  ): Promise<void> => {
    try {
      const db = await openDB(dbName);
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      await store.delete(id);
    } catch (error) {
      console.error("Error deleting object:", error);
      throw error;
    }
  };

  const fetchIDB = useCallback(
    async ({
      method,
      storeName,
      data,
    }: FetchIDBArgs<T>): Promise<Media[] | void> => {
      try {
        if (method === "AllGET") {
          setIsLoading(true);
          const objects = await getAllObjects();
          setIsLoading(false);
          return objects;
        }
        if (method === "GET") {
          setIsLoading(true);
          const objects = await getStoreObjects(storeName);
          setIsLoading(false);
          return objects;
        }
        if (method === "POST" && data) {
          await postStoreObject(storeName, data);
        }
        if (method === "DELETE" && data) {
          await deleteStoreObject(storeName, data.id);
        }
        if (method === "AllDEBUG") {
          await debugDB();
        }
        if (method === "AllDELETE") {
          setIsLoading(true);
          await destroyDB();
          const objects = await getStoreObjects(storeName);
          setIsLoading(false);
          return objects;
        }
      } catch (error) {
        console.error("Error in fetchIDB:", error);
        throw error;
      }
    },
    []
  );

  return [fetchIDB, isLoading] as const;
};

export default useIDBMedia;
