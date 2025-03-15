"use client";
import React, { useEffect, useState } from "react";
import { useCloud } from "./cloudProviders/useCloud";
import { StorageSession } from "./cloudProviders/type";

interface Props {
  dbName: string;
}

const ConnectButton: React.FC<Props> = ({dbName}) => {
  const NATIVESESSION: StorageSession = {
    type: "NATIVE",
    uuid: dbName,
  };
  const GDRIVESESSION: StorageSession = {
    type: "GDRIVE",
    uuid: dbName,
  };
  const [showMenu, setShowMenu] = useState(false);
  const { storage, selectProvider, removeProvider } = useCloud();

  const handleGoogleAuth = async () => {
    try {
      await selectProvider(GDRIVESESSION); // TODO: typeだけ渡したい
    } catch (error) {
      console.error("Google Drive connection error:", error);
    }
  };

  const handleNativeAuth = async () => {
    try {
      await selectProvider(NATIVESESSION); // TODO: typeだけ渡したい
    } catch (error) {
      console.error("Native storage connection error:", error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await removeProvider();
    } catch (error) {
      console.error("Disconnect error:", error);
    }
  };

  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    // クライアントサイドでのみ実行
    setIsClient(true);
    console.log("storage", storage?.type);
  }, [storage?.type]);
  if (!isClient) return null;
  
  return (
    <div className="fixed top-0 w-svw h-svh pointer-events-none z-50">
      <div className="absolute top-[2%] right-[5%] pointer-events-auto">
        <button
          onClick={() =>
            storage?.uuid ? handleDisconnect() : setShowMenu((prev) => !prev)
          }
          className={`px-4 py-2 rounded ${
            storage?.uuid
              ? "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
              : "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
          } text-white transition-colors duration-300 shadow-lg focus:outline-none`}
        >
          {storage?.uuid ? `DISCONNECT (${storage.type})` : "CONNECT"}
        </button>

        {showMenu && !storage && (
          <div className="absolute right-0 mt-2 w-fit bg-white border border-gray-200 rounded shadow-xl z-10 transition duration-200 ease-in-out">
            <ul className="py-1 w-full whitespace-nowrap">
              <li
                onClick={() => {
                  handleGoogleAuth();
                  setShowMenu(false);
                }}
                className="px-4 py-2 hover:bg-green-100 cursor-pointer transition-colors border-b border-gray-100"
              >
                GoogleDriveと接続
              </li>
              <li
                onClick={() => {
                  handleNativeAuth();
                  setShowMenu(false);
                }}
                className="px-4 py-2 hover:bg-green-100 cursor-pointer transition-colors"
              >
                ログイン（5セットまで無料）
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConnectButton;
