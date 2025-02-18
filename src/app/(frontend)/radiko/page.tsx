"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { RadikoClient } from "./lib/client";
import Hls from "hls.js";

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
  // Radikoの時刻フォーマット（YYYYMMDDHHmmss）をDateオブジェクトに変換
  const year = parseInt(timeStr.substring(0, 4));
  const month = parseInt(timeStr.substring(4, 6)) - 1;
  const day = parseInt(timeStr.substring(6, 8));
  const hour = parseInt(timeStr.substring(8, 10));
  const minute = parseInt(timeStr.substring(10, 12));

  const date = new Date(year, month, day, hour, minute);
  return date.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function RadikoPage() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [client] = useState(new RadikoClient());
  const [stations, setStations] = useState<Station[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedStation, setSelectedStation] = useState<string>("");
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTab, setSelectedTab] = useState<number>(0);

  // LocalStorageのキー
  const PLAYBACK_STATE_KEY = "radiko_playback_state";

  // 過去7日分の日付を生成
  const dates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return date;
  });

  const setupHls = useCallback(
    async (url: string, initialTime?: number) => {
      if (!audioRef.current) return null;

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      const hls = new Hls({
        enableWorker: true,
        debug: false,
        manifestLoadingTimeOut: 10000,
        manifestLoadingMaxRetry: 2,
        xhrSetup: (xhr, url) => {
          if (url.includes(".m3u8") || url.includes(".aac")) {
            const proxyUrl = new URL(
              "/api/proxy/radiko",
              window.location.origin
            );
            proxyUrl.searchParams.set("path", url);
            proxyUrl.searchParams.set("authToken", client.getAuthToken());
            xhr.open("GET", proxyUrl.toString(), true);
          }
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
          hls.loadSource(url);
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
      const streamUrl = await client.getStreamUrl(
        state.stationId,
        state.programStartTime,
        state.programEndTime
      );

      const hls = await setupHls(streamUrl, state.currentTime);
      if (!hls || !audioRef.current) return;

      setAudioUrl(streamUrl);
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

  // 定期的に再生位置を保存（修正）
  useEffect(() => {
    if (!audioUrl) return;

    const saveCurrentPosition = () => {
      if (audioRef.current && !audioRef.current.paused) {
        const savedState = localStorage.getItem(PLAYBACK_STATE_KEY);
        if (savedState) {
          const state = JSON.parse(savedState) as PlaybackState;
          state.currentTime = audioRef.current.currentTime;
          state.playbackRate = playbackRate; // 再生速度も保存
          localStorage.setItem(PLAYBACK_STATE_KEY, JSON.stringify(state));
        }
      }
    };

    const interval = setInterval(saveCurrentPosition, 5000);
    return () => clearInterval(interval);
  }, [audioUrl, playbackRate]); // playbackRateを依存配列に追加

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
      const programList = await client.getPrograms(
        selectedStation,
        selectedDate
      );
      setPrograms(programList);
    }
  };

  const handleStationSelect = (stationId: string) => {
    setSelectedStation(stationId);
  };

  const handleProgramSelect = useCallback(
    async (program: Program) => {
      try {
        if (!selectedStation || !audioRef.current) return;

        const streamUrl = await client.getStreamUrl(
          selectedStation,
          program.startTime,
          program.endTime
        );

        // HLSのセットアップ
        const hls = await setupHls(streamUrl);
        if (!hls) return;

        setAudioUrl(streamUrl);
        savePlaybackState(program);

        // マニフェスト解析完了後に自動再生
        await audioRef.current.play();
        audioRef.current.playbackRate = playbackRate;
      } catch (error) {
        console.error("Failed to play:", error);
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

  // タブ切り替えの処理
  const handleTabChange = (index: number) => {
    setSelectedTab(index);
    setSelectedDate(dates[index]);
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

  return (
    <div className="container mx-auto p-4 pb-32">
      <h1 className="text-2xl font-bold mb-4">Radiko Player</h1>

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
          <div className="flex overflow-x-auto mb-4 border-b">
            {dates.map((date, index) => (
              <button
                key={date.toISOString()}
                onClick={() => handleTabChange(index)}
                className={`px-4 py-2 whitespace-nowrap ${
                  selectedTab === index
                    ? "border-b-2 border-blue-500 text-blue-500"
                    : "text-gray-500"
                }`}
              >
                {date.toLocaleDateString("ja-JP", {
                  month: "numeric",
                  day: "numeric",
                  weekday: "short",
                })}
              </button>
            ))}
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {programs.map((program, index) => (
              <button
                key={index}
                onClick={() => handleProgramSelect(program)}
                className="w-full p-2 text-left border rounded hover:bg-gray-100"
              >
                {program.title}
                <div className="text-sm text-gray-600">
                  {formatRadikoTime(program.startTime)} -
                  {formatRadikoTime(program.endTime)}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* クライアントサイドでのみaudioを表示 */}
      {isClient && (
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
      )}
    </div>
  );
}
