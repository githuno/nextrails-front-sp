"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  RegionId,
  AreaId,
  regions,
  areaListParRegion,
  areaIdToRegionMap,
  getClientIP,
} from "./constants";
import RadikoClient from "./client";

interface AreaSelectProps {
  radikoClient: typeof RadikoClient;
  currentAreaName: string;
  onAreaChange: () => void;
}

export const AreaSelect: React.FC<AreaSelectProps> = ({
  radikoClient,
  currentAreaName,
  onAreaChange,
}) => {
  // const [currentAreaName, setCurrentAreaName] = useState<string>("未判定");
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState<boolean>(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // エラーハンドリング関数
  const handleError = useCallback((err: unknown) => {
    setIsAuthenticating(false);

    // radikoClientのエラーメッセージ取得メソッドを使用
    if (typeof radikoClient.getErrorMessage === "function") {
      setError(radikoClient.getErrorMessage(err));
    } else if (err instanceof Error) {
      setError(err.message);
    } else if (typeof err === "string") {
      setError(err);
    } else {
      setError("予期せぬエラーが発生しました");
    }

    // 5秒後に自動でクリア
    setTimeout(() => {
      setError(null);
    }, 5000);
  }, []);

  /** カスタムエリア管理------------------------------------------------------ */
  const CUSTOM_AREA_STORAGEKEY = "radiko_custom_area";
  const [customRegion, setCustomRegion] = useState<RegionId | "">("");
  const [customArea, setCustomArea] = useState<AreaId>("none");

  // 地域選択時の処理
  const handleRegionChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newRegion = e.target.value as RegionId | "";
      setCustomRegion(newRegion);
      setCustomArea("" as any);
      setError(null); // 選択時にエラーをクリア
    },
    []
  );

  // エリア選択時の処理
  const handleAreaChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      setIsAuthenticating(true);
      setError(null);

      const newArea = e.target.value as AreaId;
      setCustomArea(newArea);

      try {
        // 1.認証処理を実行
        await radikoClient.customAuthenticate(newArea);

        // 2.エリア名を更新
        onAreaChange();
        localStorage.setItem(CUSTOM_AREA_STORAGEKEY, newArea);

        // 3.他のエリア情報をクリア
        clearSpecifiedIp();
      } catch (err) {
        handleError(err);
        return;
      }

      setIsAuthenticating(false);
    },
    [handleError]
  );

  // クリア
  const clearCustomArea = useCallback(() => {
    setCustomRegion("");
    setCustomArea("none");
    if (isClient) {
      localStorage.removeItem(CUSTOM_AREA_STORAGEKEY);
    }
  }, [isClient]);

  // マウント時の処理
  const mountCustomArea = useCallback(
    (savedArea: AreaId) => {
      if (savedArea !== "none") {
        // エリアIDから地域IDを検索
        const regionId = areaIdToRegionMap(savedArea as AreaId);
        if (regionId) {
          setCustomRegion(regionId);
          setCustomArea(savedArea);

          // 認証処理
          handleAreaChange({
            target: { value: savedArea },
          } as any);
        }
      }
    },
    [handleError]
  );

  /** 任意のIPアドレス管理---------------------------------------------------- */
  const IP_STORAGEKEY = "radiko_specified_ip";
  const [specifiedIp, setSpecifiedIp] = useState<string>("");
  const [isEditingIp, setIsEditingIp] = useState<boolean>(false);
  const specifiedIpRef = useRef<HTMLInputElement>(null);

  // IP入力フィールドの変更を監視
  const handleIpInputSubmit = useCallback(
    async (ip: string) => {
      setIsAuthenticating(true);
      setIsEditingIp(false);
      setError(null);

      // 0.簡易バリデーション
      const newIp = ip.trim();
      const isValid = /^(\d{1,3}\.){3}\d{1,3}$/.test(newIp);

      if (isValid) {
        try {
          // 1.認証処理を実行
          setSpecifiedIp(newIp);
          const newAuth = await radikoClient.authenticate(newIp);

          // 2.エリア名を更新
          onAreaChange();
          localStorage.setItem(IP_STORAGEKEY, newIp);

          // 3.他のエリア情報をクリア
          clearCustomArea();
        } catch (err) {
          handleError(err);
          return;
        }
      } else {
        // 無効なIPアドレスの場合、エラーを表示
        setError("有効なIPアドレス形式を入力してください（例: 203.141.131.1）");
        setSpecifiedIp("");
      }

      setIsAuthenticating(false);
    },
    [specifiedIp, clearCustomArea, handleError]
  );

  // IPをクリアする
  const clearSpecifiedIp = useCallback(() => {
    if (specifiedIpRef.current) {
      specifiedIpRef.current.value = "";
    }
    setSpecifiedIp("");
    setIsEditingIp(false);
    if (isClient) {
      localStorage.removeItem(IP_STORAGEKEY);
    }
  }, [isClient]);

  // マウント時の処理
  const mountSpecifiedIp = useCallback(
    (savedIp: string) => {
      if (specifiedIpRef.current) {
        // input要素に値をセットして認証
        specifiedIpRef.current.value = savedIp;
        handleIpInputSubmit(savedIp);
      }
    },
    [handleError]
  );

  /** 自動判定のIPアドレス管理------------------------------------------------ */
  const handleAutoJudge = useCallback(async () => {
    setIsAuthenticating(true);
    setError(null);

    try {
      // 1.認証処理を実行
      const ip = await getClientIP();
      const newAuth = await radikoClient.authenticate(ip);

      // 2.エリア名を更新
      onAreaChange();

      // 3.他のエリア情報をクリア
      clearSpecifiedIp();
      clearCustomArea();
    } catch (err) {
      handleError(err);
      return;
    }

    setIsAuthenticating(false);
  }, [clearSpecifiedIp, clearCustomArea, handleError]);

  // 初期化
  useEffect(() => {
    if (!isClient) return;

    const savedArea = localStorage.getItem(CUSTOM_AREA_STORAGEKEY);
    const savedIp = localStorage.getItem(IP_STORAGEKEY);

    try {
      if (savedArea) {
        console.log("savedArea", savedArea);
        mountCustomArea(savedArea as AreaId);
      } else if (savedIp) {
        console.log("savedIp", savedIp);
        mountSpecifiedIp(savedIp);
      } else {
        console.log("autoJudge");
        handleAutoJudge();
      }
    } catch (err) {
      handleError(err);
    }
  }, [
    isClient,
    mountCustomArea,
    mountSpecifiedIp,
    handleAutoJudge,
    handleError,
  ]);

  /** JSX------------------------------------------------------------------- */
  return (
    <>
      <h2 className="text-xl font-semibold mb-2">エリア</h2>

      {/* カスタムエリア選択 */}
      <div id="custom">
        <div className="mb-2">
          {/* <label className="block text-sm font-medium text-gray-700 mb-2">
            カスタムエリアを選択
          </label> */}
          <div className="flex flex-row gap-2 w-full">
            {/* 地域選択 */}
            <select
              value={customRegion}
              onChange={handleRegionChange}
              className={
                "w-full py-1 rounded border border-gray-300 text-center"
              }
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
                className={
                  "w-full py-1 rounded border border-gray-300 text-center"
                }
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
              className="w-full py-1 border rounded  text-center"
              onChange={(value) => {
                setIsEditingIp(value.target.value !== "");
              }}
              defaultValue={isClient ? specifiedIp : ""}
              disabled={isAuthenticating}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        {/* 現在のエリア */}
        <div className="bg-gray-100 p-2 rounded">
          {isAuthenticating ? (
            <div className="text-blue-600 text-center">認証中...</div>
          ) : (
            <div className="text-gray-600 text-center">
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
                handleIpInputSubmit(specifiedIpRef.current.value);
              }
            }}
            className="py-2 rounded border bg-red-500 text-white"
            disabled={isAuthenticating}
          >
            {isAuthenticating ? "処理中..." : "IP確定"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleAutoJudge}
            className={`py-2 rounded border ${
              customArea === "none" && !specifiedIp
                ? "bg-blue-100 border-blue-500"
                : "border-gray-300"
            }`}
            disabled={isAuthenticating}
          >
            {isAuthenticating ? "処理中..." : "自動判定"}
          </button>
        )}
      </div>

      {/* エラー表示 - アニメーション付き */}
      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded relative">
          <span className="block sm:inline">{error}</span>
          <button
            className="absolute top-0 bottom-0 right-0 px-4 py-3"
            onClick={() => setError(null)}
          >
            <span className="text-red-500 hover:text-red-700">×</span>
          </button>
        </div>
      )}
    </>
  );
};
