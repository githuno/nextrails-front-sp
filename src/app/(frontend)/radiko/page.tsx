"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { RadikoClient } from "./lib/client";
import Hls from "hls.js";

const PROXY_URL = `${process.env.NEXT_PUBLIC_API_BASE}/proxy/radiko`;

interface Station {
  id: string;
  name: string;
  url: string;
}

interface Program {
  title: string;
  startTime: string;
  endTime: string;
  url: string;
}

// 再生状態を管理するインターフェースを追加
interface PlaybackState {
  stationId: string;
  programStartTime: string;
  programEndTime: string;
  currentTime: number;
  playbackRate: number;
}

// 日時フォーマット用のヘルパー関数
const formatRadikoTime = (timeStr: string): string => {
  if (!timeStr) return "";

  // タイムスタンプをJSTとして解釈
  const jstDate = new Date(
    parseInt(timeStr.substring(0, 4)),
    parseInt(timeStr.substring(4, 6)) - 1,
    parseInt(timeStr.substring(6, 8)),
    parseInt(timeStr.substring(8, 10)),
    parseInt(timeStr.substring(10, 12))
  );

  // オフセットを考慮して時刻を表示
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Tokyo",
  }).format(jstDate);
};

const getClientIP = async (): Promise<string> => {
  const response = await fetch("https://api64.ipify.org?format=json");
  const data = await response.json();
  return data.ip;
};

export default function RadikoPage() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [client] = useState(new RadikoClient());
  const [stations, setStations] = useState<Station[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedStation, setSelectedStation] = useState<string>("");
  const [audioUrl, setAudioUrl] = useState<{
    url: string;
    offset: number;
  } | null>(null);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [selectedTab, setSelectedTab] = useState<number>(6);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // LocalStorageのキー
  const PLAYBACK_STATE_KEY = "radiko_playback_state";

  // 日付タブの一覧を現在時刻から生成するように修正
  // dates配列を現在時刻から生成する部分を修正
  const getDates = () => {
    const now = new Date();
    const jstOffset = 9 * 60;
    const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
    const jstNow = new Date(utc + jstOffset * 60 * 1000);

    // 順序を逆にして生成（0が最新、6が7日前）
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(jstNow);
      date.setDate(date.getDate() - (6 - i)); // インデックスを逆にする
      return date;
    });
  };

  // dates配列を現在時刻から常に生成
  const dates = getDates();

  // selectedDateの初期値も現在時刻から設定
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const now = new Date();
    const jstOffset = 9 * 60;
    const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
    return new Date(utc + jstOffset * 60 * 1000);
  });

  const setupHls = useCallback(
    async (
      streamInfo: { url: string; offset: number },
      initialTime?: number
    ) => {
      if (!audioRef.current) return null;

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      const clientIP = await getClientIP();

      const hls = new Hls({
        enableWorker: true,
        debug: false,
        startPosition: initialTime || streamInfo.offset || -1, // offsetを使用
        xhrSetup: (xhr, requestUrl) => {
          const proxyUrl = new URL(PROXY_URL);
          proxyUrl.searchParams.set("path", requestUrl);
          proxyUrl.searchParams.set(
            "headers",
            JSON.stringify({
              "X-Radiko-AuthToken": client.getAuthToken(),
              "X-Client-IP": clientIP,
            })
          );
          xhr.open("GET", proxyUrl.toString(), true);
        },
      });

      return new Promise<Hls>((resolve, reject) => {
        hls.attachMedia(audioRef.current!);

        const onError = (_: any, data: { fatal: boolean }) => {
          if (data.fatal) {
            hls.destroy();
            reject(new Error("HLS setup failed"));
          }
        };

        hls.on(Hls.Events.ERROR, onError);
        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          hls.loadSource(streamInfo.url);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            hlsRef.current = hls;
            if (initialTime !== undefined && audioRef.current) {
              audioRef.current.currentTime = initialTime;
            }
            resolve(hls);
          });
        });
      });
    },
    [client]
  );

  // 再生状態を保存
  const savePlaybackState = (program: Program) => {
    if (!selectedStation) return;

    const state: PlaybackState = {
      stationId: selectedStation,
      programStartTime: program.startTime,
      programEndTime: program.endTime,
      currentTime: audioRef.current?.currentTime ?? 0,
      playbackRate,
    };
    localStorage.setItem(PLAYBACK_STATE_KEY, JSON.stringify(state));
  };

  // 再生状態をクリア
  const clearPlaybackState = useCallback(() => {
    localStorage.removeItem(PLAYBACK_STATE_KEY);
  }, []);

  // 再生状態を復元
  const restorePlaybackState = useCallback(async () => {
    try {
      const savedState = localStorage.getItem(PLAYBACK_STATE_KEY);
      if (!savedState) return;

      const state = JSON.parse(savedState) as PlaybackState;
      if (!state.stationId || !state.programStartTime || !state.programEndTime)
        return;

      setSelectedStation(state.stationId);
      setPlaybackRate(state.playbackRate);

      await client.init();
      const clientIP = await getClientIP();
      const streamInfo = await client.getStreamUrl(
        state.stationId,
        state.programStartTime,
        state.programEndTime,
        clientIP,
        state.currentTime // 現在の再生位置を渡す
      );

      const hls = await setupHls(streamInfo, state.currentTime);
      if (!hls || !audioRef.current) return;

      setAudioUrl(streamInfo);
      audioRef.current.playbackRate = state.playbackRate;
    } catch (error) {
      console.error("Error restoring playback state:", error);
      clearPlaybackState();
    }
  }, [client, clearPlaybackState, setupHls]);

  // ページ読み込み時に再生状態を復元
  useEffect(() => {
    restorePlaybackState();
  }, [restorePlaybackState]);

  // audioタグにイベントリスナーを追加
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const savePosition = () => {
      const savedState = localStorage.getItem(PLAYBACK_STATE_KEY);
      if (savedState) {
        const state = JSON.parse(savedState) as PlaybackState;
        state.currentTime = audio.currentTime;
        state.playbackRate = playbackRate;
        localStorage.setItem(PLAYBACK_STATE_KEY, JSON.stringify(state));
      }
    };

    // 以下のイベントで保存を実行
    audio.addEventListener("pause", savePosition);
    audio.addEventListener("seeking", savePosition);
    audio.addEventListener("volumechange", savePosition);
    window.addEventListener("beforeunload", savePosition);

    // 定期保存も維持
    const interval = setInterval(savePosition, 5000);

    return () => {
      audio.removeEventListener("pause", savePosition);
      audio.removeEventListener("seeking", savePosition);
      audio.removeEventListener("volumechange", savePosition);
      window.removeEventListener("beforeunload", savePosition);
      clearInterval(interval);
      // クリーンアップ時にも保存
      savePosition();
    };
  }, [audioRef.current, playbackRate]);

  useEffect(() => {
    const initializeStations = async () => {
      await client.init();
      const stationList = await client.getStations();
      setStations(stationList);
    };
    initializeStations();
  }, []);

  useEffect(() => {
    if (selectedStation && selectedDate) {
      loadPrograms();
    }
  }, [selectedStation, selectedDate]);

  const loadPrograms = async () => {
    if (selectedStation) {
      setIsLoading(true);
      setError("");
      try {
        const programList = await client.getPrograms(
          selectedStation,
          selectedDate
        );
        setPrograms(programList);
        if (programList.length === 0) {
          setError(
            "番組情報を取得できませんでした。後ほど再度お試しください。"
          );
        }
      } catch (err) {
        console.error("Program loading error:", err);
        setError("番組情報の取得中にエラーが発生しました。");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleStationSelect = (stationId: string) => {
    setSelectedStation(stationId);
  };

  const handleProgramSelect = useCallback(
    async (program: Program) => {
      try {
        if (!selectedStation || !audioRef.current) return;

        setError("");
        const clientIP = await getClientIP();
        const streamUrl = await client
          .getStreamUrl(
            selectedStation,
            program.startTime,
            program.endTime,
            clientIP
          )
          .catch((error) => {
            console.error("Stream URL error:", error);
            setError("ストリームURLの取得に失敗しました。");
            throw error;
          });

        // HLSのセットアップ
        const hls = await setupHls(streamUrl).catch((error) => {
          console.error("HLS setup error:", error);
          setError("ストリームの初期化に失敗しました。");
          throw error;
        });

        if (!hls) return;

        setAudioUrl(streamUrl);
        savePlaybackState(program);

        // マニフェスト解析完了後に自動再生
        await audioRef.current.play().catch((error) => {
          console.error("Playback error:", error);
          setError("再生の開始に失敗しました。");
          throw error;
        });

        audioRef.current.playbackRate = playbackRate;
      } catch (error) {
        console.error("Failed to play:", error);
        setError("再生の準備中にエラーが発生しました。");
      }
    },
    [client, selectedStation, setupHls, playbackRate]
  );

  // 再生速度の変更を処理（修正）
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

  // タブ切り替えの処理を修正
  const handleTabChange = (index: number) => {
    setSelectedTab(index);
    setSelectedDate(getDates()[index]);
  };

  // audioタグのイベントハンドラを追加
  const handleEnded = () => {
    clearPlaybackState();
  };

  // コンポーネントのクリーンアップ
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  // クライアントサイドでのみ状態を更新するために useEffect を使用
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    // DEBUG: ローカルストレージに保存された再生状態を確認
    console.log("Playback state:", localStorage.getItem(PLAYBACK_STATE_KEY));
  }, []);

  // タブのスクロール用のref
  const tabsRef = useRef<HTMLDivElement>(null);

  // 初期表示時に当日のタブまでスクロール
  useEffect(() => {
    if (tabsRef.current && programs.length > 0) {
      const scrollWidth = tabsRef.current.scrollWidth;
      const clientWidth = tabsRef.current.clientWidth;
      tabsRef.current.scrollTo({
        left: scrollWidth - clientWidth,
        behavior: 'smooth'
      });
    }
  }, [programs]);

  if (!isClient) return null;

  return (
    <div className="container mx-auto p-4 pb-32">
      <h1 className="text-2xl font-bold mb-4">Radiko Player</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
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

      {/* クライアントサイドでのみaudioを表示 */}
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
