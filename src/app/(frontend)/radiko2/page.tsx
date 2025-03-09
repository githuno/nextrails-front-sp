"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import Hls from "hls.js";
import RadikoClient from "./radikoClient";
import { AreaSelect } from "./AreaSelect";
import {
  url,
  Auth,
  Station,
  Program,
  formatRadikoTime,
  formatDisplayDate,
  AreaId,
} from "./constants";
import useTrackedEffect from "@/hooks/useTrackedEffect";
// import { useToast } from "@/hooks/toast";

interface PlaybackState {
  stationId: string;
  currentTime: number;
  speed: number;
  program: Program;
}
interface ProgramsByDate {
  [date: string]: Program[];
}

// 状態管理
export default function Page() {
  // 表示用の状態
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [auth, setAuth] = useState<Auth | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStation] = useState<string>("");
  const [nowOnAir, setNowOnAir] = useState<Program | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [programsByDate, setProgramsByDate] = useState<ProgramsByDate>({});

  // 再生関連
  const [selectedTab, setSelectedTab] = useState<number>(7);
  const [currentProgram, setCurrentProgram] = useState<Program | null>(null);
  const [playingType, setPlayingType] = useState<"live" | "timefree" | null>(
    null
  );
  const [speed, setSpeed] = useState<number>(1.0);

  // refs
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  // Hooks
  // const { showSuccess } = useToast();

  // clientインスタンスの生成
  const radikoClient = new RadikoClient();

  const [currentAreaName, setCurrentAreaName] = useState<string>("未判定");
  const onAreaChange = async () => {
    const auth = await radikoClient.getAuthInfo();
    const name = await radikoClient.getAuthName();
    setAuth(auth);
    setCurrentAreaName(name);
  };

  useTrackedEffect(
    (changes) => {
      console.log("🚀: 0.playingType", "1.currentAreaName", changes);
    },
    [playingType, currentAreaName]
  );

  // 日付タブの一覧を生成（単純に日本時間で7日分）
  // const dates = useMemo(() => {
  //   const now = new Date();
  //   const hour = now.getHours();

  //   // 現在時刻が5時より前の場合、表示上の「今日」を前日とする
  //   const baseDate =
  //     hour < 5
  //       ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  //       : now;

  //   return Array.from({ length: 7 }, (_, i) => {
  //     return new Date(
  //       baseDate.getFullYear(),
  //       baseDate.getMonth(),
  //       baseDate.getDate() - (6 - i)
  //     );
  //   });
  // }, []);
  // 日付タブの一覧を生成（前後7日間に変更）
  const dates = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();

    // 現在時刻が5時より前の場合、表示上の「今日」を前日とする
    const baseDate =
      hour < 5
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
        : now;

    // 今日の日付（インデックスを取得するため）
    const today = new Date(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      baseDate.getDate()
    );

    // 前後7日間の日付を生成（計14日分）
    return Array.from({ length: 14 }, (_, i) => {
      return new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - 7 + i
      );
    });
  }, []);

  // 番組データを日付ごとに分類する関数（5時までは前日として扱う）
  const organizeProgramsByDate = useCallback((programs: Program[]) => {
    return programs.reduce((acc: ProgramsByDate, program) => {
      // 番組開始時刻を解析
      const year = parseInt(program.startTime.substring(0, 4));
      const month = parseInt(program.startTime.substring(4, 6)) - 1;
      const day = parseInt(program.startTime.substring(6, 8));
      const hour = parseInt(program.startTime.substring(8, 10));

      // 日付を取得（5時より前は前日として扱う）
      let date = new Date(year, month, day);
      if (hour < 5) {
        // 5時前の場合は前日の日付にする
        date.setDate(date.getDate() - 1);
      }

      // YYYYMMDD形式の文字列を生成
      const dateKey = date
        .toLocaleDateString("ja-JP", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
        .replace(/\D/g, "");

      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }

      // プログラムを時間でソート
      acc[dateKey].push(program);
      acc[dateKey].sort((a, b) => {
        return parseInt(a.startTime) - parseInt(b.startTime);
      });

      return acc;
    }, {});
  }, []);

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
        maxBufferLength: 30,
        maxMaxBufferLength: 600,
        maxBufferSize: 60 * 1000 * 1000,
        maxBufferHole: 0.5,
        highBufferWatchdogPeriod: 2,
        nudgeOffset: 0.1,
        nudgeMaxRetry: 5,
        maxFragLookUpTolerance: 0.5,

        // ライブストリーミングの設定を最適化
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
        liveDurationInfinity: true,
        liveBackBufferLength: 90,

        // メディアソース設定
        enableWorker: true,
        stretchShortVideoTrack: false,
        maxAudioFramesDrift: 1,

        // ローディング設定
        manifestLoadingTimeOut: 20000,
        manifestLoadingMaxRetry: 4,
        manifestLoadingRetryDelay: 500,
        manifestLoadingMaxRetryTimeout: 64000,

        // フラグメントローディング設定
        fragLoadingTimeOut: 20000,
        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 500,
        fragLoadingMaxRetryTimeout: 64000,

        // ストリーミング設定
        startLevel: -1,
        levelLoadingTimeOut: 10000,
        levelLoadingMaxRetry: 4,
        levelLoadingRetryDelay: 500,
        levelLoadingMaxRetryTimeout: 64000,

        // デバッグ設定
        // debug: true,
      });

      hlsRef.current = hls;

      // エラーハンドリングを改善
      hls.on(Hls.Events.ERROR, (event, data) => {
        // console.error("HLS error:", data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn(
                "Fatal network error encountered, trying to recover..."
              );
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn(
                "Fatal media error encountered, trying to recover..."
              );
              hls.recoverMediaError();
              break;
            default:
              console.error("Fatal error, cannot recover:", data);
              if (
                data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
                data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT
              ) {
                // マニフェストのロードに失敗した場合、再試行
                console.log("Manifest load failed, retrying...");
                setTimeout(() => {
                  hls.loadSource(url);
                }, 1000);
              } else {
                hls.destroy();
                setError("再生中に致命的なエラーが発生しました");
              }
              break;
          }
        }
      });

      // デバッグイベントの設定を改善
      const debugEvents = [
        Hls.Events.MANIFEST_LOADING,
        Hls.Events.MANIFEST_LOADED,
        Hls.Events.MANIFEST_PARSED,
        Hls.Events.LEVEL_LOADING,
        Hls.Events.LEVEL_LOADED,
        Hls.Events.LEVEL_SWITCHED,
        Hls.Events.LEVEL_UPDATED,
        Hls.Events.FRAG_LOADING,
        Hls.Events.FRAG_LOADED,
        Hls.Events.FRAG_PARSED,
        Hls.Events.BUFFER_APPENDING,
        Hls.Events.BUFFER_APPENDED,
      ];

      // debugEvents.forEach((event) => {
      //   hls.on(event, (...args: any) => {
      //     console.log(`HLS ${event}:`, ...args);
      //   });
      // });

      // メディア初期化イベントの追加
      // hls.on(Hls.Events.MEDIA_ATTACHED, () => {
      //   if (playingType === "timefree") {
      //     audioRef.current?.play().catch((error) => {
      //       // console.error("Playback error:", error);
      //       if (error.name === "NotAllowedError") {
      //         setError(
      //           "自動再生が許可されていません。再生ボタンをクリックしてください。"
      //         );
      //       } else {
      //         setError("再生の開始に失敗しました");
      //       }
      //     });
      //   }
      // });

      // ストリーム開始時のイベントハンドラ
      // hls.on(Hls.Events.MANIFEST_PARSED, () => {
      //   console.log("Manifest parsed, stream ready");
      //   if (audioRef.current?.paused) {
      //     audioRef.current.play().catch(console.error);
      //   }
      // });

      // レベル切り替え時のイベント
      // hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
      //   console.log("Stream quality level switched:", data);
      // });

      // フラグメントの更新イベント
      // hls.on(Hls.Events.FRAG_CHANGED, (event, data) => {
      //   console.log("Fragment changed:", data);
      // });

      hls.loadSource(url);
      if (audioRef.current) {
        hls.attachMedia(audioRef.current);
      }
    } else if (audioRef.current.canPlayType("application/vnd.apple.mpegurl")) {
      audioRef.current.src = url;
    }
  }, []);

  /* -----------------------------------------------------------再生状態の管理 */
  const PLAYBACK_STATE_KEY = "radiko_playback_state";
  // 再生終了時の処理
  const handleEnded = () => {
    localStorage.removeItem(PLAYBACK_STATE_KEY);
    setPlayingType(null);
    setCurrentProgram(null);
  };
  // 再生速度の変更処理
  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSpeed = parseFloat(e.target.value);
    setSpeed(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
    // 現在の再生状態を取得して更新
    const savedState = localStorage.getItem(PLAYBACK_STATE_KEY);
    if (savedState) {
      const state = JSON.parse(savedState) as PlaybackState;
      state.speed = newSpeed;
      localStorage.setItem(PLAYBACK_STATE_KEY, JSON.stringify(state));
    }
  };
  // 再生状態の保存処理
  const savePlaybackState = useCallback(
    (program: Program) => {
      if (!selectedStation || !audioRef.current) return;

      const state: PlaybackState = {
        stationId: selectedStation,
        currentTime: audioRef.current.currentTime,
        speed: speed,
        program: program,
      };
      localStorage.setItem(PLAYBACK_STATE_KEY, JSON.stringify(state));
    },
    [selectedStation, speed]
  );
  // 定期的な再生位置の保存を改善
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || playingType !== "timefree") return;

    const handleStateUpdate = () => {
      const savedState = localStorage.getItem(PLAYBACK_STATE_KEY);
      if (!savedState) return;

      const state = JSON.parse(savedState) as PlaybackState;
      const updatedState = {
        ...state,
        currentTime: audio.currentTime,
        speed: audio.playbackRate,
      };
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
  }, [playingType]);

  const getProgramsByDate = useCallback(
    async (stationId: string, date: string) => {
      if (!auth) return;
      setIsLoading(true);
      try {
        const programs = await radikoClient.getPrograms({
          token: auth.token,
          stationId,
          date,
        });
        const organized = organizeProgramsByDate(programs || []);
        setProgramsByDate((prev) => ({
          ...prev,
          ...organized,
        }));

        // 現在のタブの日付のプログラムを表示
        if (organized[date]) {
          setPrograms(organized[date]);
        }
      } catch (error) {
        console.error("Failed to fetch programs:", error);
        setError(
          error instanceof Error ? error.message : "番組表の取得に失敗しました"
        );
      } finally {
        setIsLoading(false);
      }
    },
    [organizeProgramsByDate]
  );
  // タブ切り替え時の処理
  const handleTabChange = useCallback(
    (index: number) => {
      setSelectedTab(index);
      const newDate = dates[index];
      // YYYYMMDD形式の文字列を生成
      const dateStr = newDate
        .toLocaleDateString("ja-JP", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
        .replace(/\D/g, "");

      // 既にデータがあるか確認
      if (programsByDate[dateStr]?.length > 0) {
        // タブの日付に該当する番組を表示
        setPrograms(programsByDate[dateStr]);
      } else if (selectedStation) {
        // データがない場合は取得
        getProgramsByDate(selectedStation, dateStr);
      }
    },
    [dates, selectedStation, programsByDate, getProgramsByDate]
  );

  // 放送局の選択
  const handleStationSelect = async (stationId: string) => {
    if (!auth) return;
    setSelectedStation(stationId);
    setSelectedTab(7); // 最新の日付をデフォルトで選択
    setError("");

    try {
      // 1.現在放送中の番組を取得
      const nowOnAir = await radikoClient.getProgramNow({
        token: auth.token,
        area: auth.areaId as AreaId,
        stationId,
      });
      setNowOnAir(nowOnAir);

      // 2.選択された局の番組表を取得
      const weeklyPrograms = await radikoClient.getPrograms({
        token: auth.token,
        stationId,
        type: "weekly",
      });

      // 3.取得した番組を日付ごとに整理
      const organized = organizeProgramsByDate(weeklyPrograms || []);
      setProgramsByDate(organized);

      // 4.現在選択されているタブの日付のデータを表示
      const currentDate = dates[selectedTab];
      const dateStr = currentDate
        .toLocaleDateString("ja-JP", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
        .replace(/\D/g, "");

      // 該当する日付の番組があれば表示
      if (organized[dateStr] && organized[dateStr].length > 0) {
        setPrograms(organized[dateStr]);
      } else {
        setPrograms([]);
      }

      // 5.当日のタブまで横スクロール
      if (tabsRef.current) {
        const tabsWidth = tabsRef.current.scrollWidth;
        // 縦スクロール
        tabsRef.current.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        });
        // 横スクロール
        tabsRef.current.scrollTo({
          left: tabsWidth * 0.3,
          behavior: "smooth",
        });
      }
    } catch (error) {
      console.error("Failed to fetch station data:", error);
      setError(
        error instanceof Error
          ? error.message
          : "番組データの取得に失敗しました"
      );
    }
  };

  // プレイヤーの停止関数
  const stopPlayer = useCallback(() => {
    console.log("cleanupPlayer");
    // setPrograms([]);
    setCurrentProgram(null);
    setPlayingType(null);
    // setAudioUrl(null);
    setSelectedTab(7);
    // if (hlsRef.current) {
    // hlsRef.current.destroy();
    // hlsRef.current = null;
    // }
    if (audioRef.current) {
      audioRef.current.pause();
      // audioRef.current.src = "";
    }
  }, []);

  // ライブ再生
  const handleLivePlay = useCallback(async () => {
    if (!selectedStation || !auth) return;

    // 再生中の場合は停止処理を実行して終了
    if (playingType !== null) {
      stopPlayer();
      return;
    }

    // 停止中の場合は再生処理を実行
    try {
      // 再生開始処理
      setPlayingType("live");
      setIsLoading(true);
      setError("");

      const playlistUrl = url.liveStreaming
        .replace("{stationId}", selectedStation)
        .replace("{token}", auth.token);
      initializeHLS(playlistUrl);
      audioRef.current?.play().catch((error) => {
        console.error("Playback error:", error);
        setError("再生の開始に失敗しました");
      });

      setIsLoading(false);
    } catch (error) {
      console.error("Live playback error:", error);
      setError("再生の開始に失敗しました");
      setPlayingType(null);
    }
  }, [selectedStation, playingType, initializeHLS, stopPlayer, auth]);

  const handleTimeFreePlay = useCallback(
    async (
      stationId: string,
      program: Program,
      stateSpeed?: number,
      stateCurrentTime?: number
    ) => {
      if (!auth) return;
      setPlayingType("timefree");

      try {
        // ストリーミングURLを構築
        const streamUrl = url.timeFreeStreaming
          .replace("{stationId}", stationId)
          .replace("{ft}", program.startTime)
          .replace("{to}", program.endTime)
          .replace("{token}", auth.token);

        setCurrentProgram(program);
        initializeHLS(streamUrl);

        // 再生およびイベントリスナーの設定
        if (audioRef.current) {
          // 再生速度の設定
          audioRef.current.playbackRate = speed;
          setSpeed(stateSpeed || speed);

          const handleCanPlay = () => {
            if (audioRef.current) {
              // 再生位置を設定
              audioRef.current.currentTime = stateCurrentTime || 0;
              // 再生速度を設定
              audioRef.current.playbackRate = stateSpeed || speed;
              setSpeed(stateSpeed || speed);
              // 初期状態を保存(必要？)
              savePlaybackState(program);
            }
            audioRef.current?.removeEventListener("canplay", handleCanPlay);
          };
          audioRef.current.addEventListener("canplay", handleCanPlay);

          // 自動再生
          if (hlsRef.current) {
            try {
              await audioRef.current.play();
            } catch (error) {
              console.debug("Playback error:", error);
              setError("自動再生に失敗しました");
            }
          }
        }
      } catch (error) {
        setPlayingType(null);
        console.error("Playback error:", error);
        setError("再生の開始に失敗しました");
      }
    },
    [selectedStation, initializeHLS, auth]
  );

  // 再生状態の復元処理
  const restorePlaybackState = useCallback(
    async (stations: Station[]) => {
      console.log("restorePlaybackState");
      try {
        const savedState = localStorage.getItem(PLAYBACK_STATE_KEY);
        if (!savedState) return;
        const state = JSON.parse(savedState) as PlaybackState;

        if (stations.some((item) => item.id.includes(state.stationId))) {
          // 選局
          handleStationSelect(state.stationId);
          // 番組選択と再生
          handleTimeFreePlay(
            state.stationId,
            state.program,
            state.speed,
            state.currentTime
          );
        }
      } catch (error) {
        console.error("Playback restore error:", error);
        localStorage.removeItem(PLAYBACK_STATE_KEY);
      }
    },
    [auth]
  );

  // エリアが変更されたら放送局を取得
  useEffect(() => {
    const initialize = async () => {
      setError("");
      if (!auth || currentAreaName === "未判定") return;
      const stations = await radikoClient.getStations(auth.areaId);
      setStations(stations);
      restorePlaybackState(stations);
    };
    initialize();
    return () => {
      stopPlayer();
    };
  }, [currentAreaName]);

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

      {error && !playingType && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-16">
        <div id="info">
          {/* エリア選択 */}
          <AreaSelect
            radikoClient={radikoClient}
            currentAreaName={currentAreaName}
            onAreaChange={onAreaChange}
          />

          {/* 放送局 */}
          <h2 className="text-xl font-semibold mb-2">放送局</h2>
          <div className="grid grid-cols-3 gap-2 text-sm">
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

          {/* 現在放送中の番組情報 */}
          {nowOnAir && (
            <div className="grid row-span-2 mt-4 bg-gray-100 p-2 rounded relative">
              {/* 番組詳細 */}
              <div className="md:row-start-2 max-h-[800px] overflow-y-auto">
                <div className="text-sm text-gray-600">
                  {formatRadikoTime(nowOnAir.startTime)} -{" "}
                  {formatRadikoTime(nowOnAir.endTime)}
                </div>
                <div className="text-lg font-semibold">{nowOnAir.title}</div>
                <div className="text-sm text-gray-600">{nowOnAir.pfm}</div>
                {/* infoはHTML形式のため、dangerouslySetInnerHTMLを使用 */}
                {nowOnAir.info && (
                  <div
                    className="text-sm text-gray-600 mt-2"
                    dangerouslySetInnerHTML={{ __html: nowOnAir.info }}
                  />
                )}
              </div>
              {/* リアルタイム再生ボタンを追加（番組情報内の右下に配置） */}
              {selectedStation && (
                <button
                  onClick={handleLivePlay}
                  className={`md:row-start-1 px-4 py-2 rounded shadow-md transition-all ${
                    !playingType
                      ? "bg-green-500 hover:bg-green-600"
                      : "bg-red-500 hover:bg-red-600"
                  } text-white font-semibold`}
                >
                  {!playingType ? "リアルタイム再生" : "停止"}
                </button>
              )}
            </div>
          )}
        </div>

        <div id="list">
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
                  })}
                </button>
              );
            })}
          </div>

          {/* 番組表 */}
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="space-y-2 max-h-[700px] overflow-y-auto">
              {programs.length > 0 ? (
                programs.map((program, index) => {
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
                      onClick={() =>
                        handleTimeFreePlay(selectedStation, program)
                      }
                      className={`
                        w-full p-2 text-left border rounded transition-all
                        ${
                          currentProgram === program
                            ? "bg-blue-100 border-blue-500 shadow-md"
                            : "hover:bg-gray-100 border-gray-200"
                        }
                        ${isPast ? "text-gray-900" : "text-gray-500"}
                      `}
                    >
                      <div
                        className={`font-medium ${
                          currentProgram === program ? "text-blue-700" : ""
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

      {/* audio */}
      <div
        className={`fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 ${
          playingType === "timefree" ? "block" : "hidden"
        }`}
      >
        <div className="container mx-auto max-w-7xl">
          {currentProgram && (
            <div className="text-sm text-gray-600">
              <span className="mr-2">
                {formatDisplayDate(currentProgram.startTime)}
                {"/"}
                {formatRadikoTime(currentProgram.startTime)} -{" "}
                {formatRadikoTime(currentProgram.endTime)}
              </span>
              <span className="text-lg font-semibold">
                {currentProgram.title}
              </span>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <audio
              ref={audioRef}
              controls
              className="w-full"
              onEnded={handleEnded}
            />
            <div className="flex items-center gap-2">
              <span className="text-sm">再生速度: {speed.toFixed(1)}x</span>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.1"
                value={speed}
                onChange={handleSpeedChange}
                className="flex-grow"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
