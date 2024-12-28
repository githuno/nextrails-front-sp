import { openDB, IDBPDatabase, deleteDB } from "idb";
import { useState, useCallback } from "react";
import { Media } from "./types";

const useIDBMedia = <T extends Media>(dbName: string) => {
  const [isLoading, setIsLoading] = useState(true);
  const dbVersion = 1;
  const storeName = "media";

  const initIDB = useCallback(async (): Promise<IDBPDatabase> => {
    console.log("Initializing database");
    try {
      await deleteDB(dbName);
      return openDB(dbName, dbVersion, {
        upgrade(db, oldVersion, newVersion) {
          console.log(`Upgrading from version ${oldVersion} to ${newVersion}`);
          if (!db.objectStoreNames.contains(storeName)) {
            console.log(`Creating object store: ${storeName}`);
            db.createObjectStore(storeName, { keyPath: "id" });
          }
        },
      });
    } catch (error) {
      console.error("Error initializing database:", error);
      throw error;
    }
  }, [dbName, dbVersion, storeName]);

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

  const fetchObjects = useCallback(async (): Promise<Media[]> => {
    try {
      const db = await openDB(dbName, dbVersion);
      const tx = db.transaction(storeName, "readonly");
      const allObjects = await tx.objectStore(storeName).getAll();
      const objects = allObjects.map(
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
  }, [storeName, dbName]);

  const saveObject = async (data: T): Promise<void> => {
    try {
      const db = await openDB(dbName, dbVersion);
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      await store.add(data);
    } catch (error) {
      console.error("Error saving object:", error);
      throw error;
    }
  };

  const deleteObject = async (id: string): Promise<void> => {
    try {
      const db = await openDB(dbName, dbVersion);
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      await store.delete(id);
    } catch (error) {
      console.error("Error deleting object:", error);
      throw error;
    }
  };

  const fetchIDB = useCallback(async (Method: string, data?: T): Promise<Media[] | void> => {
    try {
      if (Method === "GET") {
        setIsLoading(true);
        const db = await openDB(dbName, dbVersion);
        const objects = await fetchObjects();
        setIsLoading(false);
        return objects;
      }
      if (Method === "POST" && data) {
        await saveObject(data);
      }
      if (Method === "DELETE" && data) {
        await deleteObject(data.id);
      }
      if (Method === "DEBUG") {
        await debugDB();
      }
      if (Method === "INIT") {
        setIsLoading(true);
        const db = await initIDB();
        const objects = await fetchObjects();
        setIsLoading(false);
        return objects;
      }
    } catch (error) {
      console.error("Error in fetchIDB:", error);
      throw error;
    }
  }, []);

  return [fetchIDB, isLoading] as const;
};

export default useIDBMedia;