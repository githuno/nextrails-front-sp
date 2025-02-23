"use client";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  IdbProvider,
  useIdb,
  IdbManager,
  type IdbFile,
} from "./localProviders/useIdb";
import { CloudProvider, useCloud } from "./cloudProviders/useCloud";
import { type File } from "@/components/camera";
import ConnectButton from "./ConnectButton";

const userId = "11111111-1111-1111-1111-111111111111"; // TODO: ユーザーID
const CLOUD_DBNAME = userId;

// コンテキストで共有する値の型定義をジェネリックに
interface StorageContextValue<T extends IdbFile> {
  idb: IdbManager<T>;
  cloud: ReturnType<typeof useCloud>;
  dbName: string;
}

const StorageContext = createContext<StorageContextValue<File> | null>(null);

// プロバイダーコンポーネント
const StorageProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  return (
    <CloudProvider>
      <IdbProvider>
        <StorageContextWrapper>{children}</StorageContextWrapper>
      </IdbProvider>
    </CloudProvider>
  );
};

// コンテキスト値を提供するラッパーコンポーネント
const StorageContextWrapper: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [IDBs, setIDBs] = useState<string[]>(["default"]);
  const [currentDb, setCurrentDb] = useState<string>("default");

  const cloudContext = useCloud();
  const dbName = cloudContext.storage ? cloudContext.storage.uuid : currentDb;
  const { idb } = useIdb<File>(dbName);

  // currentDbの変更をハンドリング
  const handleDbChange = useCallback(
    async (newDbName: string) => {
      console.log("🚀 newDbName:", newDbName);
      try {
        // 現在のDBの状態をクリーンアップ
        if (idb) {
          await idb.revokeObjectURLs();
        }
        setCurrentDb(newDbName);
      } catch (error) {
        console.error("Error changing database:", error);
      }
    },
    [idb]
  );

  useEffect(() => {
    console.log("🚀 currentDb:", currentDb);
    console.log("🚀 dbName;", dbName);
    console.log("🚀 idb.deName:", idb.dbName);
  }, [currentDb, dbName, idb.dbName]);

  // cloudContext.storageの変更を監視
  useEffect(() => {
    if (cloudContext.storage) {
      console.log("🚀 cloudContext.storage:", cloudContext.storage);
      handleDbChange(cloudContext.storage.uuid);
    }
  }, [cloudContext.storage, handleDbChange]);

  // indexedDBのデータベース一覧を取得してIDBsに追加
  useEffect(() => {
    const fetchDatabases = async () => {
      const databases = await indexedDB.databases();
      const dbNames = databases
        .map((db) => db.name)
        .filter(
          (name): name is string =>
            name !== undefined && name !== null && name !== "default"
        );
      setIDBs([...dbNames, "default"]);
    };
    fetchDatabases().catch(console.error);
  }, []);

  // TODO: オフラインでDBの認証付き切り替えを実装する必要がある

  // メモ化されたコンテキスト値
  const contextValue = useMemo(
    () => ({
      idb,
      cloud: cloudContext,
      dbName,
    }),
    [cloudContext, idb]
  );

  return (
    <StorageContext.Provider value={contextValue}>
      {children}

      {/* IDBの選択ボタン TODO:オフライン認証ボタンに変更*/}
      <div className="fixed top-0 w-svw h-svh pointer-events-none z-50">
        <div className="absolute top-[2%] right-[30%] pointer-events-auto">
          <label>IndexedDB:</label>
          <select
            value={idb.dbName}
            onChange={(e) => handleDbChange(e.target.value)}
            className={`flex self-stretch w-48 px-4 py-2 rounded border ${
              !!cloudContext.storage && `bg-gray-200 text-gray-500`
            }`}
            disabled={!!cloudContext.storage}
          >
            {IDBs.map((dbName) => (
              <option key={dbName} value={dbName}>
                {dbName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* クラウドストレージの接続ボタン */}
      <ConnectButton dbName={CLOUD_DBNAME} />
    </StorageContext.Provider>
  );
};

// カスタムフック
const useStorage = () => {
  const context = useContext(StorageContext);
  if (!context) {
    throw new Error("useStorage must be used within StorageProvider");
  }
  return context;
};

export { useStorage, StorageProvider, type IdbFile, userId };
