"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Hls from "hls.js";
import {
  RadikoApi,
  PLAYBACK_STATE_KEY,
  IP_STORAGE_KEY,
  AREA_PREFECTURE_MAP,
  formatRadikoTime,
  type Station,
  type Program,
  type PlaybackState,
} from "./utils";
// import { useToast } from "@/hooks/toast";

// 状態管理
export default function Page() {
  const [area, setArea] = useState<string>("");
  const [authToken, setAuthToken] = useState<string>("");
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStation] = useState<string>("");
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedTab, setSelectedTab] = useState<number>(6);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [clientIP, setClientIP] = useState<string>(""); // 自動取得のip
  const [ip, setIp] = useState<string>(""); // ユーザー指定のip

  // refs
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Hooks
  // const { showSuccess } = useToast();

  // 日付タブの一覧を生成
  const dates = Array.from({ length: 7 }, (_, i) => {
    const now = new Date();
    const jstOffset = 9 * 60;
    const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
    const jstNow = new Date(utc + jstOffset * 60 * 1000);
    const date = new Date(jstNow);
    date.setDate(date.getDate() - (6 - i));
    return date;
  });

  const getClientIP = async () => {
    const clientIp = await fetch("https://api.ipify.org?format=json")
      .then((response) => response.json())
      .then((data) => data.ip)
      .catch(() => undefined);
    return clientIp;
  };

  // HLSストリームの初期化
  const initializeHLS = useCallback((url: string) => {
    if (!audioRef.current) return;

    // 既存のHLSインスタンスをクリーンアップ
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        maxLoadingDelay: 3, // ロードの最大遅延時間を設定
        manifestLoadingRetryDelay: 1000, // マニフェストのロードリトライ間隔を設定
        levelLoadingRetryDelay: 1000, // レベルのロードリトライ間隔を設定
      });

      hlsRef.current = hls;

      // エラーハンドリングを強化
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error("HLS error:", data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              // ネットワークエラー時は再試行
              console.log(
                "Fatal network error encountered, trying to recover..."
              );
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              // メディアエラー時は再試行
              console.log(
                "Fatal media error encountered, trying to recover..."
              );
              hls.recoverMediaError();
              break;
            default:
              // 致命的なエラーの場合はインスタンスを破棄
              console.log("Fatal error, cannot recover");
              hls.destroy();
              setError("再生中に致命的なエラーが発生しました");
              break;
          }
        }
      });

      hls.loadSource(url);
      hls.attachMedia(audioRef.current);
    } else if (audioRef.current.canPlayType("application/vnd.apple.mpegurl")) {
      audioRef.current.src = url;
    }
  }, []);

  // 再生終了時の処理
  const handleEnded = () => {
    localStorage.removeItem(PLAYBACK_STATE_KEY);
    setAudioUrl(null);
    setIsPlaying(false);
  };

  // 再生速度の変更処理
  const handlePlaybackRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newRate = parseFloat(e.target.value);
    setPlaybackRate(newRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = newRate;
    }

    // 現在の再生状態を取得して更新
    const savedState = localStorage.getItem(PLAYBACK_STATE_KEY);
    if (savedState) {
      const state = JSON.parse(savedState) as PlaybackState;
      state.playbackRate = newRate;
      localStorage.setItem(PLAYBACK_STATE_KEY, JSON.stringify(state));
    }
  };

  /* ------------------------------------------------------再生状態の保存・復元 */
  // 再生状態をクリア
  const clearPlaybackState = useCallback(() => {
    localStorage.removeItem(PLAYBACK_STATE_KEY);
  }, []);
  // 再生状態の保存処理
  const savePlaybackState = useCallback(
    (program: Program) => {
      if (!selectedStation || !audioRef.current) return;

      const state: PlaybackState = {
        stationId: selectedStation,
        programStartTime: program.startTime,
        programEndTime: program.endTime,
        currentTime: audioRef.current.currentTime,
        playbackRate: playbackRate,
      };
      console.log("Saving playback state:", state); // デバッグログ
      localStorage.setItem(PLAYBACK_STATE_KEY, JSON.stringify(state));
    },
    [selectedStation, playbackRate]
  );
  // 定期的な再生位置の保存を改善
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isPlaying) {
      console.log("Audio not ready or not playing, skipping state monitoring");
      return;
    }

    const handleStateUpdate = () => {
      const savedState = localStorage.getItem(PLAYBACK_STATE_KEY);
      if (!savedState) return;

      const state = JSON.parse(savedState) as PlaybackState;
      const updatedState = {
        ...state,
        currentTime: audio.currentTime,
        playbackRate: audio.playbackRate,
      };
      console.log("Updating playback state:", updatedState); // デバッグログ
      localStorage.setItem(PLAYBACK_STATE_KEY, JSON.stringify(updatedState));
    };

    // イベントリスナーの設定
    const events = [
      "timeupdate",
      "pause",
      "seeking",
      // "seeked",
      "ratechange",
      // "play",
      // "playing",
    ];
    events.forEach((event) => audio.addEventListener(event, handleStateUpdate));

    // 定期的な保存
    const interval = setInterval(handleStateUpdate, 5000);

    // クリーンアップ
    return () => {
      events.forEach((event) =>
        audio.removeEventListener(event, handleStateUpdate)
      );
      clearInterval(interval);
      handleStateUpdate();
    };
  }, [isPlaying]);
  /* -------------------------------------------------------------------日選択 */
  // タブ切り替えの処理を修正
  const handleTabChange = (index: number) => {
    setSelectedTab(index);
    const newDate = dates[index];

    // 選択された日付の番組表を取得
    if (selectedStation) {
      const dateStr = newDate.toISOString().slice(0, 10).replace(/-/g, "");
      getProgramsByDate(selectedStation, dateStr);
    }
  };
  // 日付指定での番組表取得
  const getProgramsByDate = useCallback(
    async (stationId: string, date: string) => {
      setIsLoading(true);
      try {
        const effectiveIp = ip || clientIP;

        const res = await fetch(
          `${RadikoApi}/programs?type=date${
            effectiveIp ? `&ip=${effectiveIp}` : ""
          }&stationId=${stationId}&date=${date}`
        );
        if (!res.ok) throw new Error("番組表の取得に失敗しました");
        const data = await res.json();
        setPrograms(data.data || []);
      } catch (error) {
        console.error("Failed to fetch programs:", error);
        setError(
          error instanceof Error ? error.message : "番組表の取得に失敗しました"
        );
      } finally {
        setIsLoading(false);
      }
    },
    [ip, clientIP]
  );
  // 番組表の再取得
  const getPrograms = useCallback(
    async (stationId: string) => {
      setIsLoading(true);
      try {
        const effectiveIp = ip || clientIP;

        const res = await fetch(
          `${RadikoApi}/programs?type=weekly${
            effectiveIp ? `&ip=${effectiveIp}` : ""
          }&stationId=${stationId}`
        );
        if (!res.ok) throw new Error("番組表の取得に失敗しました");
        const data = await res.json();
        setPrograms(data.data || []);
      } catch (error) {
        console.error("Failed to fetch programs:", error);
        setError(
          error instanceof Error ? error.message : "番組表の取得に失敗しました"
        );
      } finally {
        setIsLoading(false);
      }
    },
    [ip, clientIP]
  );

  /* ---------------------------------------------------------------------選局 */
  // 放送局の選択処理
  const handleStationSelect = async (stationId: string) => {
    setSelectedStation(stationId);
    setSelectedTab(6);
    setError("");
    if (stationId) {
      try {
        const res = await fetch(
          `${RadikoApi}/programs?type=weekly&ip=${
            ip ? ip : clientIP
          }&stationId=${stationId}`
        );
        if (!res.ok) throw new Error("番組表の取得に失敗しました");
        const data = await res.json();
        setPrograms(data.data || []);
      } catch (error) {
        console.error("Failed to fetch programs:", error);
        setError(
          error instanceof Error ? error.message : "番組表の取得に失敗しました"
        );
      }
    } else {
      setPrograms([]); // 局が未選択の場合は番組表をクリア
    }
  };
  // 選局時に番組表を更新して当日までスクロール
  useEffect(() => {
    const updatePrograms = async () => {
      if (!selectedStation || !area) return;

      // clientIPの取得を待つ
      if (!clientIP && !ip) {
        console.log("Waiting for IP...");
        return;
      }
      await getPrograms(selectedStation);

      // 当日のタブまでスクロール
      if (tabsRef.current) {
        const scrollWidth = tabsRef.current.scrollWidth;
        const clientWidth = tabsRef.current.clientWidth;
        tabsRef.current.scrollTo({
          left: scrollWidth - clientWidth,
          behavior: "smooth",
        });
      }
    };

    updatePrograms();
  }, [selectedStation, area, clientIP, ip, getPrograms]); // 依存配列に clientIP と ip を追加

  // リアルタイム再生の処理
  const handleLivePlay = useCallback(async () => {
    if (!selectedStation) return;

    try {
      if (isPlaying) {
        // 再生中の場合は停止
        if (audioRef.current) {
          audioRef.current.pause();
        }
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
        setIsPlaying(false);
        setAudioUrl(null);
        return;
      }

      // リアルタイム再生用のストリームURL（エリアIDを追加）
      const streamUrl = `${RadikoApi}/stream/${selectedStation}/live?ip=${
        ip || clientIP
      }`;

      // エラー状態をリセット
      setError("");

      // HLSストリームを初期化（認証トークンをヘッダーに追加）
      const response = await fetch(streamUrl, {
        method: "GET",
        credentials: "include",
      });
      if (!response.ok) throw new Error("ストリームの取得に失敗しました");

      initializeHLS(streamUrl);
      setIsPlaying(true);
      setAudioUrl(streamUrl);

      if (audioRef.current) {
        try {
          await audioRef.current.play();
        } catch (error) {
          console.error("Playback error:", error);
          setError(
            "再生の開始に失敗しました。ブラウザの自動再生設定を確認してください。"
          );
        }
      }
    } catch (error) {
      console.error("Live playback error:", error);
      setError("再生の開始に失敗しました");
      setIsPlaying(false);
      setAudioUrl(null);
    }
  }, [selectedStation, isPlaying, initializeHLS, ip, clientIP, authToken]);

  /* -----------------------------------------------------------------番組選択 */
  // 番組選択の処理を修正
  const handleProgramSelect = useCallback(
    async (program: Program) => {
      if (!selectedStation) return;

      try {
        // ft と to をそのまま使用（YYYYMMDDHHmmss形式）、エリアIDを追加
        const streamUrl = `${RadikoApi}/stream/${selectedStation}/timeshift?ft=${
          program.ft
        }&to=${program.to}&ip=${ip || clientIP}`;
        initializeHLS(streamUrl);
        setIsPlaying(true);
        setAudioUrl(streamUrl);

        const handlePlay = () => {
          savePlaybackState(program);
          audioRef.current?.removeEventListener("play", handlePlay);
        };

        // 再生状態を保存
        savePlaybackState(program);

        if (audioRef.current) {
          audioRef.current.play();
        }
      } catch (error) {
        console.error("Playback error:", error);
        setError("再生の開始に失敗しました");
      }
    },
    [
      selectedStation,
      playbackRate,
      initializeHLS,
      savePlaybackState,
      ip,
      clientIP,
    ]
  );

  /* --------------------------------------------------初期化（エリア、放送局） */
  // プレイヤーのクリーンアップ関数
  const cleanupPlayer = useCallback(() => {
    setPrograms([]);
    setSelectedTab(6);
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
  }, []);

  // 認証処理
  const authWithIp = useCallback(
    async (ip?: string) => {
      const detectedIp = await getClientIP();
      if (detectedIp) {
        setClientIP(detectedIp);
      }
      const res = await fetch(`${RadikoApi}/auth?ip=${ip || detectedIp}`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("初期データの取得に失敗しました");
      }
      const authData = await res.json();
      if (ip) setIp(ip);
      setArea(authData.areaId); //いらないかも
      setAuthToken(authData.token); //いらなそう
      const stationsRes = await fetch(
        `${RadikoApi}/stations/${ip || detectedIp}`
      );
      if (!stationsRes.ok) {
        throw new Error("放送局の取得に失敗しました");
      }
      const stationsData = await stationsRes.json();
      setStations(stationsData.data || []);
    },
    [ip, clientIP]
  );

  // 再生状態の復元処理
  const restorePlaybackState = useCallback(async () => {
    try {
      const savedState = localStorage.getItem(PLAYBACK_STATE_KEY);
      if (!savedState) return;

      const state = JSON.parse(savedState) as PlaybackState;
      if (
        !state.stationId ||
        !state.programStartTime ||
        !state.programEndTime
      ) {
        return;
      }

      // 選局と再生速度を設定
      setSelectedStation(state.stationId);
      setPlaybackRate(state.playbackRate);

      if (inputRef.current) {
        inputRef.current.value = ip;
      }

      // タイムシフトストリームのURLを構築
      const streamUrl = `${RadikoApi}/stream/${state.stationId}/timeshift?ft=${
        state.programStartTime
      }&to=${state.programEndTime}&ip=${ip || clientIP}&token=${authToken}`;

      // HLSストリームを初期化
      initializeHLS(streamUrl);
      setAudioUrl(streamUrl);
      setIsPlaying(true);

      // 再生位置を設定
      if (audioRef.current) {
        const handleCanPlay = () => {
          if (audioRef.current) {
            audioRef.current.currentTime = state.currentTime;
            audioRef.current.playbackRate = state.playbackRate;
          }
          audioRef.current?.removeEventListener("canplay", handleCanPlay);
        };
        audioRef.current.addEventListener("canplay", handleCanPlay);
      }
    } catch (error) {
      console.error("Playback restore error:", error);
      clearPlaybackState();
    }
  }, [area, authToken, initializeHLS, clearPlaybackState]);

  // 1.マウント時の初期化処理
  useEffect(() => {
    const initializeWithIp = async () => {
      // 1.IPアドレスの復元
      const savedIp = localStorage.getItem(IP_STORAGE_KEY);
      if (savedIp) {
        setIp(savedIp);
      }
      // 2.認証
      await authWithIp(savedIp ? savedIp : undefined);
    };

    initializeWithIp();
    // クリーンアップ
    return () => cleanupPlayer();
  }, []); // マウント時のみ実行

  // 2.areaが変更されたら再生状態を復元
  useEffect(() => {
    const restore = async () => {
      if (area) {
        await restorePlaybackState();
      }
    };
    restore();
  }, [area]);

  // IP変更ハンドラーを改善
  const handleIpChange = useCallback(
    async (newIp?: string) => {
      try {
        // 1.現在の再生を停止
        cleanupPlayer();
        setIsPlaying(false);
        setAudioUrl(null);

        // 2.input要素とローカルストレージを更新
        if (inputRef.current && newIp) {
          inputRef.current.value = newIp;
        } else if (inputRef.current) {
          inputRef.current.value = "";
        }
        if (newIp) {
          localStorage.setItem(IP_STORAGE_KEY, newIp);
        } else {
          localStorage.removeItem(IP_STORAGE_KEY);
        }

        // 3.認証
        await authWithIp(newIp ? newIp : undefined);
      } catch (error) {
        console.error("IP change error:", error);
        setError("エリアの変更中にエラーが発生しました");
      }
    },
    [cleanupPlayer]
  );
  // IPの確定/クリアボタンのクリックハンドラーを修正
  const handleIpButtonClick = useCallback(() => {
    if (ip) {
      // クリアの場合
      console.log("Clearing IP...");
      handleIpChange();
    } else {
      // 確定の場合
      const newIp = inputRef.current?.value || "";
      handleIpChange(newIp);
    }
  }, [ip, handleIpChange]);

  /* -------------------------------------------------------------レンダリング */
  // クライアントサイドでのみ状態を更新するために useEffect を使用
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);
  if (!isClient) return null;

  return (
    <div className="container mx-auto p-4 pb-32">
      <h1 className="text-2xl font-bold mb-4">Radiko Player</h1>

      {/* テスト用ボタンを追加
      <button
        onClick={() => showSuccess("トーストテスト")}
        className="mb-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
      >
        テスト
      </button> */}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          {/* エリア選択 */}
          <h2 className="text-xl font-semibold mb-2">エリア</h2>
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-4 gap-2">
              <div className="col-span-3">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="IPアドレスを入力 (例: 203.141.131.1)"
                  className="w-full p-2 border rounded"
                />
              </div>
              <button
                onClick={handleIpButtonClick}
                className={`p-2 rounded ${
                  ip
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-blue-500 hover:bg-blue-600"
                } text-white`}
              >
                {ip ? "クリア" : "確定"}
              </button>
            </div>
            <div className="bg-gray-100 p-2 rounded">
              現在のエリア:{" "}
              {AREA_PREFECTURE_MAP[area as keyof typeof AREA_PREFECTURE_MAP]}
            </div>
          </div>

          {/* 放送局 */}
          <h2 className="text-xl font-semibold mb-2">放送局</h2>
          <div className="grid grid-cols-2 gap-2">
            {stations.map((station) => (
              <button
                key={station.id}
                onClick={() => handleStationSelect(station.id)}
                className={`p-2 rounded ${
                  selectedStation === station.id
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200"
                }`}
              >
                {station.name}
              </button>
            ))}
          </div>

          {/* リアルタイム再生ボタンを追加 */}
          {selectedStation && (
            <button
              onClick={handleLivePlay}
              className={`mt-4 w-full p-3 rounded transition-all ${
                isPlaying
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-green-500 hover:bg-green-600"
              } text-white font-bold`}
            >
              {isPlaying ? "停止" : "リアルタイム再生"}
            </button>
          )}
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">番組表</h2>

          {/* 日付タブ */}
          <div className="flex overflow-x-auto mb-4 border-b" ref={tabsRef}>
            {dates.map((date, index) => {
              const isToday = date.toDateString() === new Date().toDateString();
              return (
                <button
                  key={date.toISOString()}
                  onClick={() => handleTabChange(index)}
                  className={`px-4 py-2 whitespace-nowrap ${
                    selectedTab === index
                      ? "border-b-2 border-blue-500 text-blue-500"
                      : "text-gray-500"
                  } ${isToday ? "bg-blue-50" : ""}`}
                >
                  {date.toLocaleDateString("ja-JP", {
                    month: "numeric",
                    day: "numeric",
                    weekday: "short",
                    timeZone: "Asia/Tokyo",
                  })}
                </button>
              );
            })}
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {programs.length > 0 ? (
                programs.map((program, index) => {
                  const isCurrentlyPlaying = (() => {
                    try {
                      const savedState =
                        localStorage.getItem(PLAYBACK_STATE_KEY);
                      if (!savedState) return false;

                      const state = JSON.parse(savedState) as PlaybackState;
                      return (
                        audioUrl && program.startTime === state.programStartTime
                      );
                    } catch {
                      return false;
                    }
                  })();
                  const isPast =
                    new Date(
                      parseInt(program.endTime.substring(0, 4)),
                      parseInt(program.endTime.substring(4, 6)) - 1,
                      parseInt(program.endTime.substring(6, 8)),
                      parseInt(program.endTime.substring(8, 10)),
                      parseInt(program.endTime.substring(10, 12))
                    ) < new Date();

                  return (
                    <button
                      key={index}
                      onClick={() => handleProgramSelect(program)}
                      className={`
                        w-full p-2 text-left border rounded transition-all
                        ${
                          isCurrentlyPlaying
                            ? "bg-blue-100 border-blue-500 shadow-md"
                            : "hover:bg-gray-100 border-gray-200"
                        }
                        ${isPast ? "text-gray-900" : "text-gray-500"}
                      `}
                    >
                      <div
                        className={`font-medium ${
                          isCurrentlyPlaying ? "text-blue-700" : ""
                        }`}
                      >
                        {program.title}
                      </div>
                      <div
                        className={`text-sm ${
                          isPast ? "text-gray-600" : "text-gray-400"
                        }`}
                      >
                        {formatRadikoTime(program.startTime)} -
                        {formatRadikoTime(program.endTime)}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="text-center text-gray-500 py-4">
                  {error || "番組情報がありません"}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* audioを表示 */}
      <div
        className={`fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 ${
          audioUrl ? "block" : "hidden"
        }`}
      >
        <div className="container mx-auto max-w-7xl">
          <h2 className="text-xl font-semibold mb-2">再生</h2>
          <div className="flex flex-col gap-2">
            <audio
              ref={audioRef}
              controls
              className="w-full"
              onEnded={handleEnded}
            />
            <div className="flex items-center gap-2">
              <span className="text-sm">
                再生速度: {playbackRate.toFixed(1)}x
              </span>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.1"
                value={playbackRate}
                onChange={handlePlaybackRateChange}
                className="flex-grow"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
