"use client"
import React, { useEffect, useState } from "react"
import { StorageSession } from "./cloudProviders/type"
import { useCloud } from "./cloudProviders/useCloud"

interface Props {
  dbName: string
}

const ConnectButton: React.FC<Props> = ({ dbName }) => {
  const NATIVESESSION: StorageSession = {
    type: "NATIVE",
    uuid: dbName,
  }
  const GDRIVESESSION: StorageSession = {
    type: "GDRIVE",
    uuid: dbName,
  }
  const [showMenu, setShowMenu] = useState(false)
  const { storage, selectProvider, removeProvider } = useCloud()

  const handleGoogleAuth = async () => {
    try {
      await selectProvider(GDRIVESESSION) // TODO: typeだけ渡したい
    } catch (error) {
      console.error("Google Drive connection error:", error)
    }
  }

  const handleNativeAuth = async () => {
    try {
      await selectProvider(NATIVESESSION) // TODO: typeだけ渡したい
    } catch (error) {
      console.error("Native storage connection error:", error)
    }
  }

  const handleDisconnect = async () => {
    try {
      await removeProvider()
    } catch (error) {
      console.error("Disconnect error:", error)
    }
  }

  const [isClient, setIsClient] = useState(false)
  useEffect(() => {
    // クライアントサイドでのみ実行
    queueMicrotask(() => {
      setIsClient(true)
    })
    console.log("storage", storage?.type)
  }, [storage?.type])
  if (!isClient) return null

  return (
    <div className="pointer-events-none fixed top-0 z-50 h-svh w-svw">
      <div className="pointer-events-auto absolute top-[2%] right-[5%]">
        <button
          onClick={() => (storage?.uuid ? handleDisconnect() : setShowMenu((prev) => !prev))}
          className={`rounded px-4 py-2 ${
            storage?.uuid
              ? "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
              : "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
          } text-white shadow-lg transition-colors duration-300 focus:outline-none`}
        >
          {storage?.uuid ? `DISCONNECT (${storage.type})` : "CONNECT"}
        </button>

        {showMenu && !storage && (
          <div className="absolute right-0 z-10 mt-2 w-fit rounded border border-gray-200 bg-white shadow-xl transition duration-200 ease-in-out">
            <ul className="w-full py-1 whitespace-nowrap">
              <li
                onClick={() => {
                  handleGoogleAuth()
                  setShowMenu(false)
                }}
                className="cursor-pointer border-b border-gray-100 px-4 py-2 transition-colors hover:bg-green-100"
              >
                GoogleDriveと接続
              </li>
              <li
                onClick={() => {
                  handleNativeAuth()
                  setShowMenu(false)
                }}
                className="cursor-pointer px-4 py-2 transition-colors hover:bg-green-100"
              >
                ログイン（5セットまで無料）
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

export default ConnectButton
