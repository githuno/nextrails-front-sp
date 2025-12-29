"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import RadikoClient from "./client"
import { AreaId, areaIdToRegionMap, areaListParRegion, getClientIP, RegionId, regions } from "./constants"

interface AreaSelectProps {
  radikoClient: typeof RadikoClient
  currentAreaName: string
  onAreaChange: () => void
}

export const AreaSelect: React.FC<AreaSelectProps> = ({ radikoClient, currentAreaName, onAreaChange }) => {
  // const [currentAreaName, setCurrentAreaName] = useState<string>("未判定");
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // isClient は派生状態なので initializer で計算（effect 不要）
  const [isClient] = useState(() => typeof window !== "undefined")

  // エラーハンドリング関数
  const handleError = useCallback(
    (err: unknown) => {
      setIsAuthenticating(false)

      // radikoClientのエラーメッセージ取得メソッドを使用
      if (typeof radikoClient.getErrorMessage === "function") {
        setError(radikoClient.getErrorMessage(err))
      } else if (err instanceof Error) {
        setError(err.message)
      } else if (typeof err === "string") {
        setError(err)
      } else {
        setError("予期せぬエラーが発生しました")
      }

      // 5秒後に自動でクリア
      setTimeout(() => {
        setError(null)
      }, 5000)
    },
    [radikoClient],
  )

  /** カスタムエリア管理------------------------------------------------------ */
  const CUSTOM_AREA_STORAGEKEY = "radiko_custom_area"
  const IP_STORAGEKEY = "radiko_specified_ip"
  const [customRegion, setCustomRegion] = useState<RegionId | "">("")
  const [customArea, setCustomArea] = useState<AreaId>("none")
  const [specifiedIp, setSpecifiedIp] = useState<string>("")
  const [isEditingIp, setIsEditingIp] = useState<boolean>(false)
  const specifiedIpRef = useRef<HTMLInputElement>(null)

  // クリア
  const clearCustomArea = useCallback(() => {
    setCustomRegion("")
    setCustomArea("none")
    if (isClient) {
      localStorage.removeItem(CUSTOM_AREA_STORAGEKEY)
    }
  }, [isClient])

  // IPをクリアする
  const clearSpecifiedIp = useCallback(() => {
    if (specifiedIpRef.current) {
      specifiedIpRef.current.value = ""
    }
    setSpecifiedIp("")
    setIsEditingIp(false)
    if (isClient) {
      localStorage.removeItem(IP_STORAGEKEY)
    }
  }, [isClient])

  // 地域選択時の処理
  const handleRegionChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRegion = e.target.value as RegionId | ""
    setCustomRegion(newRegion)
    setCustomArea("" as AreaId)
    setError(null) // 選択時にエラーをクリア
  }, [])

  // エリア選択時の処理
  const handleAreaChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      setIsAuthenticating(true)
      setError(null)

      const newArea = e.target.value as AreaId
      setCustomArea(newArea)

      try {
        // 1.認証処理を実行
        await radikoClient.customAuthenticate(newArea)

        // 2.エリア名を更新
        onAreaChange()
        localStorage.setItem(CUSTOM_AREA_STORAGEKEY, newArea)

        // 3.他のエリア情報をクリア
        clearSpecifiedIp()
      } catch (err) {
        handleError(err)
        return
      }

      setIsAuthenticating(false)
    },
    [handleError, radikoClient, onAreaChange, clearSpecifiedIp],
  )

  // IP入力フィールドの変更を監視
  const handleIpInputSubmit = useCallback(
    async (ip: string) => {
      setIsAuthenticating(true)
      setIsEditingIp(false)
      setError(null)

      // 0.簡易バリデーション
      const newIp = ip.trim()
      const isValid = /^(\d{1,3}\.){3}\d{1,3}$/.test(newIp)

      if (isValid) {
        try {
          // 1.認証処理を実行
          setSpecifiedIp(newIp)
          await radikoClient.authenticate(newIp)

          // 2.エリア名を更新
          onAreaChange()
          localStorage.setItem(IP_STORAGEKEY, newIp)

          // 3.他のエリア情報をクリア
          clearCustomArea()
        } catch (err) {
          handleError(err)
          return
        }
      } else {
        // 無効なIPアドレスの場合、エラーを表示
        setError("有効なIPアドレス形式を入力してください（例: 203.141.131.1）")
        setSpecifiedIp("")
      }

      setIsAuthenticating(false)
    },
    [clearCustomArea, handleError, radikoClient, onAreaChange],
  )

  /** 自動判定のIPアドレス管理------------------------------------------------ */
  const handleAutoJudge = useCallback(async () => {
    setIsAuthenticating(true)
    setError(null)

    try {
      // 1.認証処理を実行
      const ip = await getClientIP()
      await radikoClient.authenticate(ip)

      // 2.エリア名を更新
      onAreaChange()

      // 3.他のエリア情報をクリア
      clearSpecifiedIp()
      clearCustomArea()
    } catch (err) {
      handleError(err)
      return
    }

    setIsAuthenticating(false)
  }, [clearSpecifiedIp, clearCustomArea, handleError, radikoClient, onAreaChange])

  // 初期化（マウント時のみ実行）
  const initialized = useRef(false)
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    // localStorage からの読み込みと setState が同じ effect scope 内にあるため ESLint 準拠
    const savedArea = localStorage.getItem(CUSTOM_AREA_STORAGEKEY)
    const savedIp = localStorage.getItem(IP_STORAGEKEY)

    const initialize = async () => {
      try {
        if (savedArea) {
          // inline: mountCustomArea 相当の処理
          const regionId = areaIdToRegionMap(savedArea as AreaId)
          if (regionId) {
            setCustomRegion(regionId)
            setCustomArea(savedArea as AreaId)
            // 認証処理
            await radikoClient.customAuthenticate(savedArea as AreaId)
            onAreaChange()
            localStorage.setItem(CUSTOM_AREA_STORAGEKEY, savedArea)
            if (specifiedIpRef.current) {
              specifiedIpRef.current.value = ""
            }
            setSpecifiedIp("")
            setIsEditingIp(false)
          }
        } else if (savedIp) {
          // inline: mountSpecifiedIp 相当の処理
          if (specifiedIpRef.current) {
            specifiedIpRef.current.value = savedIp
            await radikoClient.authenticate(savedIp)
            onAreaChange()
            localStorage.setItem(IP_STORAGEKEY, savedIp)
            setCustomRegion("")
            setCustomArea("none")
          }
        } else {
          // inline: handleAutoJudge 相当の処理
          const ip = await getClientIP()
          await radikoClient.authenticate(ip)
          onAreaChange()
          if (specifiedIpRef.current) {
            specifiedIpRef.current.value = ""
          }
          setSpecifiedIp("")
          setIsEditingIp(false)
          setCustomRegion("")
          setCustomArea("none")
        }
      } catch (err) {
        handleError(err)
      }
    }

    initialize()
  }, [radikoClient, onAreaChange, handleError])

  /** JSX------------------------------------------------------------------- */
  return (
    <>
      <h2 className="mb-2 text-xl font-semibold">エリア</h2>

      {/* カスタムエリア選択 */}
      <div id="custom">
        <div className="mb-2">
          {/* <label className="block text-sm font-medium text-gray-700 mb-2">
            カスタムエリアを選択
          </label> */}
          <div className="flex w-full flex-row gap-2">
            {/* 地域選択 */}
            <select
              value={customRegion}
              onChange={handleRegionChange}
              className={"w-full rounded border border-gray-300 py-1 text-center"}
              id="custom-region"
              disabled={isAuthenticating}
            >
              <option value="" disabled>
                カスタムエリアを選択
              </option>
              {regions.map(({ id, name }) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>

            {/* 都道府県選択 */}
            {customRegion && (
              <select
                value={customArea}
                onChange={handleAreaChange}
                className={"w-full rounded border border-gray-300 py-1 text-center"}
                id="custom-area"
                disabled={isAuthenticating}
              >
                <option value="" disabled>
                  都道府県を選択
                </option>
                {areaListParRegion[customRegion].map(({ id, name }) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* 任意ip選択 */}
      <div id="specified-ip">
        <div className="mb-2">
          {/* <label className="block text-sm font-medium text-gray-700 mb-2">
            カスタムIPを入力
          </label> */}
          <div className="col-span-3 text-sm">
            <input
              ref={specifiedIpRef}
              type="text"
              placeholder="あるいはカスタムIPアドレスを入力 (例: 203.141.131.1 / 221.114.127.0)"
              className="w-full rounded border py-1 text-center"
              onChange={(value) => {
                setIsEditingIp(value.target.value !== "")
              }}
              defaultValue=""
              disabled={isAuthenticating}
            />
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        {/* 現在のエリア */}
        <div className="rounded bg-gray-100 p-2">
          {isAuthenticating ? (
            <div className="text-center text-blue-600">認証中...</div>
          ) : (
            <div className="text-center text-gray-600">
              <span className="text-xs">現在のエリア: </span>
              <span className="font-bold">{currentAreaName}</span>
            </div>
          )}
        </div>

        {/* 自動判定オプション */}
        {isEditingIp ? (
          <button
            type="button"
            onClick={() => {
              if (specifiedIpRef.current?.value) {
                handleIpInputSubmit(specifiedIpRef.current.value)
              }
            }}
            className="rounded border bg-red-500 py-2 text-white"
            disabled={isAuthenticating}
          >
            {isAuthenticating ? "処理中..." : "IP確定"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleAutoJudge}
            className={`rounded border py-2 ${
              customArea === "none" && !specifiedIp ? "border-blue-500 bg-blue-100" : "border-gray-300"
            }`}
            disabled={isAuthenticating}
          >
            {isAuthenticating ? "処理中..." : "自動判定"}
          </button>
        )}
      </div>

      {/* エラー表示 - アニメーション付き */}
      {error && (
        <div className="relative mt-4 rounded border border-red-400 bg-red-100 p-3 text-red-700">
          <span className="block sm:inline">{error}</span>
          <button className="absolute top-0 right-0 bottom-0 px-4 py-3" onClick={() => setError(null)}>
            <span className="text-red-500 hover:text-red-700">×</span>
          </button>
        </div>
      )}
    </>
  )
}
