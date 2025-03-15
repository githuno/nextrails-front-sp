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

interface ProgramsByDate {
  [date: string]: Program[];
}
interface Favorite {
  stationId: string;
  title: string;
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

  // エリア情報の取得と認証
  const [currentAreaName, setCurrentAreaName] = useState<string>("未判定");
  const onAreaChange = async () => {
    const auth = await radikoClient.getAuthInfo();
    const name = await radikoClient.getAuthName();
    setAuth(auth);
    setCurrentAreaName(name);
  };

  useTrackedEffect(
    (changes) => {
      console.log(
        "🚀: 0.playingType",
        "1.currentAreaName",
        "1.currentProgram",
        changes
      );
    },
    [playingType, currentAreaName, currentProgram]
  );

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
  const PLAYBACK_PROGRAMS_KEY = "radiko_playback_programs";
  const PLAYBACK_SPEED_KEY = "radiko_playback_speed";

  // 再生速度の変更処理
  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSpeed = parseFloat(e.target.value);
    setSpeed(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
    // 現在の再生状態を取得して更新
    localStorage.setItem(PLAYBACK_SPEED_KEY, newSpeed.toString());
  };

  // ストレージから番組取得
  const getSavedPlaybackPrograms = useCallback((): Program[] => {
    try {
      const saved = localStorage.getItem(PLAYBACK_PROGRAMS_KEY);
      if (!saved) return [];
      return JSON.parse(saved);
    } catch (error) {
      console.error("Failed to parse saved programs:", error);
      return [];
    }
  }, []);

  // ストレージの番組を視聴済みとしてマーク
  const markAsProgramPlayed = useCallback(
    (stationId: string, startTime: string) => {
      console.log("📌 Marking program as played:", stationId, startTime);
      try {
        const savedPrograms = getSavedPlaybackPrograms();

        // 該当番組を検索
        const programIndex = savedPrograms.findIndex(
          (p) => p.station_id === stationId && p.startTime === startTime
        );

        if (programIndex >= 0) {
          // 視聴済みとしてマーク（currentTimeに-1を設定）
          savedPrograms[programIndex] = {
            ...savedPrograms[programIndex],
            currentTime: -1, // 視聴済みを示す特殊な値
          };

          // 更新されたプログラムリストを保存
          localStorage.setItem(
            PLAYBACK_PROGRAMS_KEY,
            JSON.stringify(savedPrograms)
          );
          console.log("📌 Program marked as played:", stationId, startTime);
        }
      } catch (error) {
        console.error("Failed to mark program as played:", error);
      }
    },
    [getSavedPlaybackPrograms]
  );

  // 再生可能な（未視聴または途中まで視聴した）番組のみを取得
  const getPlayablePrograms = useCallback((): Program[] => {
    const savedPrograms = getSavedPlaybackPrograms();
    // currentTimeが-1でない番組のみを返す
    return savedPrograms.filter((program) => program.currentTime !== -1);
  }, [getSavedPlaybackPrograms]);

  // ストレージから古い番組（1週間以上前）を削除
  const cleanupOldPrograms = useCallback(() => {
    try {
      const savedPrograms = getSavedPlaybackPrograms();
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const filteredPrograms = savedPrograms.filter((program) => {
        // 番組の日付をパース
        const year = parseInt(program.startTime.substring(0, 4));
        const month = parseInt(program.startTime.substring(4, 6)) - 1;
        const day = parseInt(program.startTime.substring(6, 8));
        const programDate = new Date(year, month, day);

        // 1週間より新しい番組のみ残す
        return programDate >= oneWeekAgo;
      });

      localStorage.setItem(
        PLAYBACK_PROGRAMS_KEY,
        JSON.stringify(filteredPrograms)
      );
      return filteredPrograms;
    } catch (error) {
      console.error("Failed to cleanup old programs:", error);
      return [];
    }
  }, [getSavedPlaybackPrograms]);

  // ストレージへの番組保存（追加または更新）
  const savePlaybackProgram = useCallback(
    (program: Program) => {
      if (!selectedStation || !audioRef.current) return;

      // 現在の再生時間を含む番組情報
      const updatedProgram = {
        ...program,
        currentTime: audioRef.current.currentTime,
      };

      try {
        // 既存の保存済み番組を取得
        const savedPrograms = getSavedPlaybackPrograms();
        // 既存の同一番組のインデックスを検索
        const existingIndex = savedPrograms.findIndex(
          (p) =>
            p.station_id === program.station_id &&
            p.startTime === program.startTime
        );
        if (existingIndex >= 0) {
          // 既存の番組を更新
          savedPrograms[existingIndex] = updatedProgram;
        } else {
          // 新しく追加
          savedPrograms.push(updatedProgram);
        }
        // 保存
        localStorage.setItem(
          PLAYBACK_PROGRAMS_KEY,
          JSON.stringify(savedPrograms)
        );
      } catch (error) {
        console.error("Failed to save program:", error);
      }
    },
    [selectedStation, getSavedPlaybackPrograms]
  );

  // 定期的な再生位置の保存
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || playingType !== "timefree") return;

    // AbortControllerを作成
    const controller = new AbortController();
    const { signal } = controller;

    // イベントリスナーの設定
    const events = [
      // "timeupdate",
      "pause",
      "seeking",
      "ratechange",
    ];
    // signal付きイベントリスナーの追加
    events.forEach((event) => {
      if (currentProgram) {
        audio.addEventListener(
          event,
          () => savePlaybackProgram(currentProgram),
          { signal }
        );
      }
    });

    // 定期的な保存
    const interval = setInterval(() => {
      if (currentProgram) {
        savePlaybackProgram(currentProgram);
      }
    }, 5000);

    // クリーンアップ
    return () => {
      // すべてのイベントリスナーを一度に中止
      controller.abort();
      clearInterval(interval);
    };
  }, [playingType, currentProgram, savePlaybackProgram]);

  /* ---------------------------------------------------------------お気に入り */
  // お気に入り関連の定数
  const RADIKO_FAVORITES_KEY = "radiko_favorites";
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  // お気に入り関連の関数
  const loadFavorites = useCallback(() => {
    try {
      const saved = localStorage.getItem(RADIKO_FAVORITES_KEY);
      if (!saved) return [];
      return JSON.parse(saved);
    } catch (error) {
      console.error("Failed to load favorites:", error);
      return [];
    }
  }, []);

  // お気に入り状態をチェック
  const isFavorite = useCallback(
    (title: string) => {
      return favorites.some((favorite) => favorite.title === title);
    },
    [favorites]
  );

  // お気に入りの追加・削除
  const toggleFavorite = useCallback(
    (event: React.MouseEvent, program: Program) => {
      // イベントの伝播を停止（親要素のクリックイベントを発火させない）
      event.stopPropagation();

      try {
        const newFavorites = [...favorites];

        // お気に入りに既に存在する場合は削除、なければ追加
        const index = newFavorites.findIndex(
          (favorite) => favorite.title === program.title
        );
        if (index >= 0) {
          newFavorites.splice(index, 1);
        } else {
          newFavorites.push({
            stationId: program.station_id,
            title: program.title,
          });
        }

        // 状態とローカルストレージを更新
        setFavorites(newFavorites);
        localStorage.setItem(
          RADIKO_FAVORITES_KEY,
          JSON.stringify(newFavorites)
        );
        console.log(
          `🌟 Favorite ${index >= 0 ? "removed" : "added"}: ${program.title}`
        );
      } catch (error) {
        console.error("Failed to toggle favorite:", error);
      }
    },
    [favorites]
  );

  // お気に入り番組を自動保存
  const saveFavoritePrograms = useCallback(
    async (stations: Station[]) => {
      const favs = loadFavorites();
      if (!favs.length || !auth) return;
      try {
        setIsLoading(true);

        // お気に入りに登録されている放送局のIDを取得 (Array.fromを使用してエラー修正)
        const favoriteStationIds = Array.from(
          new Set(favs.map((fav: Favorite) => fav.stationId))
        ).filter((id) =>
          // 現在アクセス可能な放送局のみを対象にする
          stations.some((station) => station.id === id)
        ) as string[];

        if (!favoriteStationIds.length) return;

        // 既存の保存済み番組を取得
        const savedPrograms = getSavedPlaybackPrograms();
        let updated = false;

        // 各放送局ごとに処理
        for (const stationId of favoriteStationIds) {
          // 該当放送局の1週間分の番組表を取得
          const weeklyPrograms = await radikoClient.getPrograms({
            token: auth.token,
            stationId,
            type: "weekly",
          });

          if (!weeklyPrograms || weeklyPrograms.length === 0) continue;

          // お気に入りに登録されているタイトルと一致する番組を探す
          const favoritePrograms = weeklyPrograms.filter((program) =>
            favs.some((favorite: Favorite) => favorite.title === program.title)
          );

          if (favoritePrograms.length === 0) continue;

          // お気に入り番組を保存対象に追加
          favoritePrograms.forEach((program) => {
            // 既存の同一番組のインデックスを検索
            const existingIndex = savedPrograms.findIndex(
              (p) =>
                p.station_id === program.station_id &&
                p.startTime === program.startTime
            );

            // 既に保存済みの場合はスキップ（視聴済みは上書きしない）
            if (existingIndex >= 0) {
              return;
            }

            // 新しく追加（初期再生位置は0）
            savedPrograms.push({
              ...program,
              currentTime: 0,
            });
            updated = true;
          });
        }

        // 更新があった場合のみ保存
        if (updated) {
          localStorage.setItem(
            PLAYBACK_PROGRAMS_KEY,
            JSON.stringify(savedPrograms)
          );
          console.log("🌟 Favorite programs saved to playback list");
        }
      } catch (error) {
        console.error("Failed to save favorite programs:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [auth, radikoClient, getSavedPlaybackPrograms]
  );

  /* --------------------------------------------------------------------操作 */
  // プログラムの取得
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
    [auth, organizeProgramsByDate, saveFavoritePrograms]
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
    setPrograms([]);
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

  // タイムフリー再生
  const handleTimeFreePlay = useCallback(
    async (program: Program, stateSpeed?: number) => {
      if (!auth) return;
      setPlayingType("timefree");

      // 番組がストレージに保存されている場合は再生位置を復元
      const savedPrograms = getSavedPlaybackPrograms();
      const savedProgram = savedPrograms.find(
        (p) =>
          p.station_id === program.station_id &&
          p.startTime === program.startTime
      );
      if (savedProgram) {
        program = savedProgram;
      }

      try {
        // ストリーミングURLを構築
        const streamUrl = url.timeFreeStreaming
          .replace("{stationId}", program.station_id)
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
          // 再生位置の設定
          audioRef.current.currentTime = program.currentTime || 0;

          // AbortControllerを使用してイベントリスナーを管理
          const controller = new AbortController();

          const handleCanPlay = () => {
            if (audioRef.current) {
              // 再生位置を設定
              audioRef.current.currentTime = program.currentTime || 0;
              // 再生速度を設定
              audioRef.current.playbackRate = stateSpeed || speed;
              setSpeed(stateSpeed || speed);
              // 初期状態を保存(必要？)
              savePlaybackProgram(program);
              // イベントが一度だけ必要なので、処理後にリスナーをアボート
              controller.abort();
            }
          };

          audioRef.current.addEventListener("canplay", handleCanPlay, {
            signal: controller.signal,
          });

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
  const restorePlaybackProgram = useCallback(
    async (stations: Station[]) => {
      try {
        // 一週間以上前の番組をクリーンアップ
        const activePrograms = cleanupOldPrograms();
        if (!activePrograms.length) return;

        // 保存されていた再生速度を取得
        const savedSpeed = localStorage.getItem(PLAYBACK_SPEED_KEY);

        // 現在アクセス可能な放送局に属する番組だけをフィルタリング
        const availablePrograms = getPlayablePrograms().filter((program) =>
          stations.some((station) => station.id === program.station_id)
        );
        if (!availablePrograms.length) return;

        // 放送日が最も古い番組を選択
        const oldestProgram = availablePrograms.reduce((oldest, current) => {
          const oldestTime = parseInt(oldest.startTime);
          const currentTime = parseInt(current.startTime);
          return currentTime < oldestTime ? current : oldest;
        }, availablePrograms[0]);
        console.log("⚡️⚡️ Oldest program:", oldestProgram);

        // 選択した番組の局を選択
        handleStationSelect(oldestProgram.station_id);
        // 選択した番組の日付タブを選択
        const oldestDate = new Date(
          parseInt(oldestProgram.startTime.substring(0, 4)),
          parseInt(oldestProgram.startTime.substring(4, 6)) - 1,
          parseInt(oldestProgram.startTime.substring(6, 8))
        );
        const oldestIndex = dates.findIndex(
          (date) =>
            date.getFullYear() === oldestDate.getFullYear() &&
            date.getMonth() === oldestDate.getMonth() &&
            date.getDate() === oldestDate.getDate()
        );
        setSelectedTab(oldestIndex);
        // 番組を再生
        handleTimeFreePlay(
          oldestProgram,
          savedSpeed ? parseFloat(savedSpeed) : 1.0
        );
      } catch (error) {
        console.error("Playback restore error:", error);
        localStorage.removeItem(PLAYBACK_PROGRAMS_KEY);
      }
    },
    [auth, cleanupOldPrograms, handleStationSelect, handleTimeFreePlay]
  );

  // 再生終了時の処理
  const onEnded = useCallback(() => {
    // 現在の再生中番組を取得してから停止処理
    const endingProgram = currentProgram;
    if (!endingProgram) return;

    // オーディオ要素を取得
    const audio = audioRef.current;
    if (audio) {
      // まず、イベントリスナーをAbortControllerで削除
      if (window.AbortController) {
        // 新しいAbortControllerを作成して即座に中止
        const controller = new AbortController();

        // 念のため、空のリスナーをsignalと共に追加してから中止する
        ["pause", "seeking", "ratechange"].forEach((event) => {
          audio.addEventListener(event, () => {}, {
            signal: controller.signal,
          });
        });

        // すべてのリスナーを中止
        controller.abort();
      }

      // 一時停止してからソースをクリア
      audio.pause();
      if (audio.src) {
        audio.src = "";
        audio.load(); // リソースの解放
      }
    }

    // プレイヤー状態のリセット
    setCurrentProgram(null);
    setPlayingType(null);

    // 番組を視聴済みとしてマーク
    markAsProgramPlayed(endingProgram.station_id, endingProgram.startTime);

    // 次の番組を取得（少し遅延させてステート更新を確実に）
    setTimeout(() => {
      restorePlaybackProgram(stations);
    }, 100);
  }, [currentProgram, markAsProgramPlayed, stations, restorePlaybackProgram]);

  // エリアが変更されたら放送局を取得
  useEffect(() => {
    const initialize = async () => {
      if (!auth || currentAreaName === "未判定") return;
      setIsLoading(true);
      setError("");
      setPrograms([]);
      setProgramsByDate({});
      setSelectedStation("");
      setNowOnAir(null);
      // 放送局を取得
      const stations = await radikoClient.getStations(auth.areaId);
      setStations(stations);
      // お気に入り番組を保存
      await saveFavoritePrograms(stations);
      // お気に入りを取得
      const favs = loadFavorites();
      setFavorites(favs);
      // リストア
      restorePlaybackProgram(stations);
      setIsLoading(false);
    };
    initialize();
    return () => {
      stopPlayer();
    };
  }, [currentAreaName]);

  /* -------------------------------------------------------------レンダリング */
  // SSRではnullを返す
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);
  if (!isClient) return null;

  // CSRではコンポーネントを返す
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
                <div className="text-lg font-semibold">
                  {nowOnAir.url ? (
                    <a
                      href={nowOnAir.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {nowOnAir.title}
                    </a>
                  ) : (
                    nowOnAir.title
                  )}
                </div>
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
                  const canPlay =
                    new Date(
                      parseInt(program.endTime.substring(0, 4)),
                      parseInt(program.endTime.substring(4, 6)) - 1,
                      parseInt(program.endTime.substring(6, 8)),
                      parseInt(program.endTime.substring(8, 10)),
                      parseInt(program.endTime.substring(10, 12))
                    ) < new Date();

                  // 視聴済み番組かどうかをチェック
                  const isPlayed = getSavedPlaybackPrograms().some(
                    (p) =>
                      p.station_id === program.station_id &&
                      p.startTime === program.startTime &&
                      p.currentTime === -1
                  );

                  const isPlaying =
                    playingType === "timefree" &&
                    currentProgram?.startTime === program.startTime &&
                    currentProgram?.station_id === program.station_id;

                  // お気に入りかどうかをチェック
                  const isFav = isFavorite(program.title);

                  return (
                    <div key={index} className="relative">
                      {/* お気に入りボタンをdivの外に配置 */}
                      <span
                        onClick={(e) => toggleFavorite(e, program)}
                        className={`absolute top-2 right-2 text-xl focus:outline-none cursor-pointer ${
                          isFav
                            ? "text-yellow-500"
                            : "text-gray-300 hover:text-gray-400"
                        }`}
                        aria-label={
                          isFav ? "お気に入りから削除" : "お気に入りに追加"
                        }
                      >
                        {isFav ? "★" : "☆"}
                      </span>

                      <button
                        onClick={() =>
                          canPlay ? handleTimeFreePlay(program) : null
                        }
                        className={`
                          relative w-full p-2 text-left border rounded transition-all
                          ${
                            isPlaying
                              ? "bg-blue-100 border-blue-500 shadow-md"
                              : isPlayed
                              ? "bg-gray-100 border-gray-300 opacity-70"
                              : canPlay
                              ? "hover:bg-gray-100 border-gray-200"
                              : "border-gray-200"
                          }
                          ${canPlay ? "text-gray-900" : "text-gray-500"}
                        `}
                        disabled={!canPlay}
                      >
                        <div
                          className={`font-medium ${
                            isPlaying ? "text-blue-700" : ""
                          } pr-8`}
                        >
                          {program.title}
                          {isPlayed && (
                            <span className="ml-2 text-xs text-gray-500">
                              ✓ 視聴済み
                            </span>
                          )}
                        </div>
                        <div
                          className={`text-sm ${
                            canPlay ? "text-gray-600" : "text-gray-400"
                          }`}
                        >
                          {formatRadikoTime(program.startTime)} -{" "}
                          {formatRadikoTime(program.endTime)}
                        </div>
                      </button>
                    </div>
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
                {currentProgram.url ? (
                  <a
                    href={currentProgram.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {currentProgram.title}
                  </a>
                ) : (
                  currentProgram.title
                )}
              </span>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <audio
              ref={audioRef}
              controls
              className="w-full"
              onEnded={onEnded}
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
