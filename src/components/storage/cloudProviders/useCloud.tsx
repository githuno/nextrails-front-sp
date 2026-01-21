import { apiFetch } from "@/hooks/useFetch"
import React, { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"

import { useGDrive } from "./gDriveProvider"
import { useR2 } from "./nativeProvider"
import type { CloudManager, CloudState, Session, StorageSession } from "./type"

// INFO：クラウドのディレクトリタイプ
enum DirType {
  // TODO: enumは書き換える必要ありそう：https://zenn.dev/ubie_dev/articles/ts-58-erasable-syntax-only
  IMAGES = "imgs",
  VIDEOS = "vdos",
  THREES = "3ds",
  DOCS = "docs",
  OTHERS = "others",
}

const extensionToContentType: Record<string, { mime: string; class: DirType }> = {
  png: { mime: "image/png", class: DirType.IMAGES },
  jpg: { mime: "image/jpeg", class: DirType.IMAGES },
  jpeg: { mime: "image/jpeg", class: DirType.IMAGES },
  mp4: { mime: "video/mp4", class: DirType.VIDEOS },
  webm: { mime: "video/webm", class: DirType.VIDEOS },
  mov: { mime: "video/quicktime", class: DirType.VIDEOS },
  avi: { mime: "video/x-msvideo", class: DirType.VIDEOS },
  obj: { mime: "application/octet-stream", class: DirType.THREES },
  fbx: { mime: "application/octet-stream", class: DirType.THREES },
  glb: { mime: "model/gltf-binary", class: DirType.THREES },
  pdf: { mime: "application/pdf", class: DirType.DOCS },
  doc: { mime: "application/msword", class: DirType.DOCS },
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    class: DirType.DOCS,
  },
  txt: { mime: "text/plain", class: DirType.DOCS },
}

const contentTypeToExtension: Record<string, { ext: string; class: DirType }> = {
  "image/png": { ext: "png", class: DirType.IMAGES },
  "image/jpeg": { ext: "jpg", class: DirType.IMAGES },
  "video/mp4": { ext: "mp4", class: DirType.VIDEOS },
  "video/webm": { ext: "webm", class: DirType.VIDEOS },
  "video/quicktime": { ext: "mov", class: DirType.VIDEOS },
  "video/x-msvideo": { ext: "avi", class: DirType.VIDEOS },
  "application/octet-stream": { ext: "obj", class: DirType.THREES },
  "model/gltf-binary": { ext: "glb", class: DirType.THREES },
  "application/pdf": { ext: "pdf", class: DirType.DOCS },
  "application/msword": { ext: "doc", class: DirType.DOCS },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    ext: "docx",
    class: DirType.DOCS,
  },
  "text/plain": { ext: "txt", class: DirType.DOCS },
}

// プロバイダーのコンテキストインターフェース
export interface CloudStateContextValue {
  state: CloudState
}

export interface CloudActionsContextValue {
  storage: StorageSession | null
  provider: CloudManager | null
  selectProvider: (session: StorageSession) => Promise<void>
  removeProvider: () => Promise<void>
  extensionToContentType: typeof extensionToContentType
  contentTypeToExtension: typeof contentTypeToExtension
}

// コンテキストの作成
const CloudStateContext = createContext<CloudStateContextValue | null>(null)
const CloudActionsContext = createContext<CloudActionsContextValue | null>(null)

// プロバイダーコンポーネント
export const CloudProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<CloudState>({
    isChecking: false,
    isUploading: [],
    isDownloading: [],
    isDeleting: [],
    isConnected: false,
  })
  const [provider, setProvider] = useState<CloudManager | null>(null)
  const [storage, setStorage] = useState<StorageSession | null>(null)
  const SESSION_URL = "/storages/session"
  const DISCONNECT_URL = "/storages/disconnect"

  // R2とGDriveのフックを直接コンポーネント内で呼び出す
  const { r2 } = useR2()
  const { gdrive } = useGDrive()

  const checkSession = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isChecking: true }))
      const response = await apiFetch<Session>(SESSION_URL)
      if (response && response.storage) {
        const storage = response.storage
        let newProvider: CloudManager | null = null
        switch (storage.type) {
          case "NATIVE":
            newProvider = r2
            break
          case "GDRIVE":
            newProvider = gdrive
            break
          default:
            newProvider = null
        }
        if (newProvider) await newProvider.session()
        setStorage(storage)
        setProvider(newProvider)
        setState((prev) => ({ ...prev, isConnected: true }))
      } else {
        setProvider(null)
        setStorage(null)
        setState((prev) => ({ ...prev, isConnected: false }))
      }
    } catch (error) {
      console.error("Session check failed:", error)
      setProvider(null)
      setStorage(null)
      setState((prev) => ({ ...prev, isConnected: false }))
    } finally {
      setState((prev) => ({ ...prev, isChecking: false }))
    }
  }, [r2, gdrive])

  const selectProvider = useCallback(
    async (storage: StorageSession) => {
      let newProvider: CloudManager | null = null
      try {
        switch (storage.type) {
          case "NATIVE":
            newProvider = r2
            break
          case "GDRIVE":
            newProvider = gdrive
            break
          default:
            return
        }

        // 1. 一時的にプロバイダーをセット（この時点ではuuid/typeは未設定）
        setProvider(newProvider)

        // 2. 接続処理を実行
        await newProvider.connect({ uuid: storage.uuid })

        // 3. セッション情報を設定
        await checkSession()
      } catch (error) {
        console.error("Provider connection error:", error)
        if (newProvider) {
          try {
            await newProvider.disconnect()
          } catch (e) {
            console.error("Disconnect error:", e)
          }
        }
        setProvider(null)
        setStorage(null)
        throw error
      }
    },
    [r2, gdrive, checkSession],
  )

  const disconnect = async () => {
    try {
      await apiFetch(DISCONNECT_URL, { method: "POST" })
    } catch (error) {
      console.error("Disconnect error:", error)
      throw error
    }
  }

  useEffect(() => {
    checkSession()
  }, [checkSession])

  const removeProvider = useCallback(async () => {
    if (!provider) return
    await provider.disconnect()
    await disconnect()
    setProvider(null)
    setStorage(null)
    setState((prev) => ({ ...prev, isConnected: false }))
  }, [provider])

  const stateContextValue = React.useMemo(() => ({ state }), [state])
  const actionsContextValue = React.useMemo(
    () => ({
      storage,
      provider,
      selectProvider,
      removeProvider,
      extensionToContentType,
      contentTypeToExtension,
    }),
    [storage, provider, selectProvider, removeProvider],
  )

  return (
    <CloudStateContext.Provider value={stateContextValue}>
      <CloudActionsContext.Provider value={actionsContextValue}>{children}</CloudActionsContext.Provider>
    </CloudStateContext.Provider>
  )
}

// カスタムフック
export const useCloudState = () => {
  const context = useContext(CloudStateContext)
  if (!context) {
    throw new Error("useCloudState must be used within CloudProvider")
  }
  return context
}

export const useCloudActions = () => {
  const context = useContext(CloudActionsContext)
  if (!context) {
    throw new Error("useCloudActions must be used within CloudProvider")
  }
  return context
}

export const useCloud = () => {
  const { state } = useCloudState()
  const actions = useCloudActions()
  return { state, ...actions }
}
