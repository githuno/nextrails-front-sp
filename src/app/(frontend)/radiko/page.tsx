"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import Hls from "hls.js";
import RadikoClient from "./client";
import { AreaSelect } from "./AreaSelect";
import HistoryDrawer from "./HistoryDrawer";
import HistoryButton from "./HistoryButton";
import {
  url,
  Auth,
  Station,
  Program,
  formatRadikoTime,
  formatDisplayDate,
  AreaId,
} from "./constants";
import DOMPurify from "isomorphic-dompurify";
// トレース＆メモリ監視用のカスタムフック
import useTrackedEffect from "@/hooks/useTrackedEffect";

// import { useToast } from "@/hooks/toast";

interface ProgramsByDate {
  [date: string]: Program[];
}
interface Favorite {
  stationId: string;
  title: string;
}
/** TODO: コード構造について責任分離と関心の分離を通じたリファクタリングが必要
 *
 * // 再生コントロールを別コンポーネントに分離
 * const PlaybackControls...
 *
 * // 再生状態管理のカスタムフック
 * function usePlaybackState...
 *
 * // useLocalStorageカスタムフックの追加
 * function useLocalStorage...
 *
 * // コンポーネントを分割
 * const ProgramList = ({ programs, onProgramSelect }) => {
 *   // ...
 * }
 *
 * const NowPlayingInfo = ({ program, onSkipBackward, onSkipForward, onNext }) => {
 *   // ...
 * }
 *
 * // カスタムフックで状態管理をカプセル化
 * function usePlaybackState() {
 *   const [currentProgram, setCurrentProgram] = useState<Program | null>(null);
 *   const [playingType, setPlayingType] = useState<"live" | "timefree" | null>(null);
 *
 *   // その他の関連状態...
 *
 *   return {
 *     currentProgram,
 *     playingType,
 *     setCurrentProgram,
 *     setPlayingType,
 *     // その他のメソッド...
 *   };
 * }
 *
 * // データアクセスレイヤーの分離
 * const programRepository = {
 *   saveProgram(program: Program): void {
 *     // ストレージへの保存ロジック
 *   },
 *
 *   getPlayablePrograms(): Program[] {
 *     // 再生可能番組の取得ロジック
 *   }
 * }; */

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
  // const radikoClient = new RadikoClient();
  const abortControllerRef = useRef<AbortController | null>(null);

  // エリア情報の取得と認証
  const [currentAreaName, setCurrentAreaName] = useState<string>("未判定");
  const onAreaChange = async () => {
    const auth = await RadikoClient.getAuthInfo();
    const name = await RadikoClient.getAuthName();
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
    [playingType, currentAreaName, currentProgram],
    {
      monitorMemory: true, // メモリ監視を有効化
      monitorInterval: 3000, // 30秒ごとに監視
      memoryTag: "RadikoPlayer", // ログの識別用タグ
    }
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

    // 既存のHLSインスタンスを完全に破棄
    if (hlsRef.current) {
      try {
        console.log("Destroying previous HLS instance");

        // まずメディアを切り離す
        hlsRef.current.detachMedia();

        // ストリームの読み込みを停止
        hlsRef.current.stopLoad();

        // 特定のイベントリスナーだけを削除（removeAllListenersは使わない）
        const events = [
          Hls.Events.ERROR,
          Hls.Events.MANIFEST_PARSED,
          Hls.Events.LEVEL_LOADED,
          Hls.Events.MEDIA_ATTACHED,
        ];

        events.forEach((event) => {
          hlsRef.current?.off(event);
        });

        // インスタンスを破棄
        hlsRef.current.destroy();
        hlsRef.current = null;
      } catch (error) {
        console.error("HLS cleanup error:", error);
      }
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        // 基本設定
        maxBufferLength: 30,
        maxMaxBufferLength: 600,
        maxBufferSize: 60 * 1000 * 1000,
        maxBufferHole: 0.5,
      });

      hlsRef.current = hls;

      // エラーハンドリング
      hls.on(Hls.Events.ERROR, (event, data) => {
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

      hls.loadSource(url);
      if (audioRef.current) {
        hls.attachMedia(audioRef.current);
      }
    } else if (audioRef.current.canPlayType("application/vnd.apple.mpegurl")) {
      audioRef.current.src = url;
    }
  }, []);

  // イベントハンドラーの参照を保存するためのrefを使用
  const eventHandlersRef = useRef<{ [key: string]: EventListener }>({});

  // オーディオ要素のイベントリスナーをクリア
  const clearAudioEventListeners = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // 保存されたイベントハンドラーを使って削除
    if (eventHandlersRef.current) {
      Object.entries(eventHandlersRef.current).forEach(([event, handler]) => {
        if (event === "timefreeController" || event === "saveInterval") {
          // 特殊なハンドラー（関数呼び出し）
          (handler as () => void)();
        } else {
          // 通常のイベントリスナー
          audio.removeEventListener(event, handler);
        }
      });
      // リファレンスをクリア
      eventHandlersRef.current = {};
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
    // クライアントサイドでのみ実行
    if (typeof window === "undefined") {
      return [];
    }

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

  /* ---------------------------------------------------------------お気に入り */
  // お気に入り関連の定数
  const RADIKO_FAVORITES_KEY = "radiko_favorites";
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  // お気に入りの取得
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

  // お気に入り番組をPlAYBACK_PROGRAMへ自動保存
  const saveFavoritePrograms = useCallback(
    async (stations: Station[]) => {
      const favs = loadFavorites();
      if (!favs.length || !auth) return;
      try {
        setIsLoading(true);

        // お気に入りに登録されている放送局のIDを取得
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
        const now = new Date();

        // 各放送局ごとに処理
        for (const stationId of favoriteStationIds) {
          // この局のお気に入り番組タイトルのみを取得
          const stationFavorites = favs.filter(
            (fav: Favorite) => fav.stationId === stationId
          );

          // 該当放送局の1週間分の番組表を取得
          const weeklyPrograms = await RadikoClient.getPrograms({
            token: auth.token,
            stationId,
            type: "weekly",
          });

          if (!weeklyPrograms || weeklyPrograms.length === 0) continue;

          // お気に入りに一致する番組を探す
          const favoritePrograms = weeklyPrograms.filter((program) => {
            // 1. この放送局の番組で、お気に入りに登録されたタイトルと局が一致するものを探す
            const isFavorite = stationFavorites.some(
              (fav: Favorite) =>
                fav.title === program.title && fav.stationId === stationId
            );
            if (!isFavorite) return false;

            // 2. 番組終了時間が現在時刻より過去（再生可能）か確認
            const endTime = new Date(
              parseInt(program.endTime.substring(0, 4)),
              parseInt(program.endTime.substring(4, 6)) - 1,
              parseInt(program.endTime.substring(6, 8)),
              parseInt(program.endTime.substring(8, 10)),
              parseInt(program.endTime.substring(10, 12))
            );

            return endTime < now; // 終了時間が現在より前なら再生可能
          });

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
    [auth, RadikoClient, getSavedPlaybackPrograms]
  );

  /* --------------------------------------------------------------------操作 */
  const updateProgramsByDate = useCallback((newData: ProgramsByDate) => {
    setProgramsByDate((prev) => {
      const result = { ...prev, ...newData };

      // 最大エントリ数を制限
      const MAX_DATES = 14;
      const keys = Object.keys(result).sort().reverse();
      if (keys.length > MAX_DATES) {
        const keysToRemove = keys.slice(MAX_DATES);
        keysToRemove.forEach((key) => {
          delete result[key];
        });
      }

      return result;
    });
  }, []);

  // プログラムの取得
  const getProgramsByDate = useCallback(
    async (stationId: string, date: string) => {
      if (!auth) return;
      setIsLoading(true);

      // 既存のリクエストをキャンセル
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      // 新しい AbortController を作成
      abortControllerRef.current = new AbortController();
      try {
        const programs = await RadikoClient.getPrograms({
          token: auth.token,
          stationId,
          date,
          signal: abortControllerRef.current.signal,
        });
        const organized = organizeProgramsByDate(programs || []);
        updateProgramsByDate(organized);

        // 現在のタブの日付のプログラムを表示
        if (organized[date]) {
          setPrograms(organized[date]);
        }
        return organized;
      } catch (error) {
        // AbortError は正常なキャンセル処理なのでエラー表示しない
        if (error instanceof DOMException && error.name === "AbortError") {
          console.log("Request aborted");
          return;
        }
        // その他のエラー処理
        console.error("Failed to fetch programs:", error);
        setError(
          error instanceof Error ? error.message : "番組表の取得に失敗しました"
        );
        return {};
      } finally {
        setIsLoading(false);
      }
    },
    [auth, organizeProgramsByDate, saveFavoritePrograms]
  );

  // タブ切り替え時の処理
  const handleTabChange = useCallback(
    async (index: number, program?: Program) => {
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

      if (program) {
        // programが渡された場合は番組取得して表示
        const pdata = await getProgramsByDate(program.station_id, dateStr);
        if (pdata) updateProgramsByDate(pdata);
        setPrograms(pdata ? pdata[dateStr] || [] : []);
      } else if (programsByDate[dateStr]?.length > 0) {
        // タブの日付に該当する番組を表示
        setPrograms(programsByDate[dateStr]);
      } else {
        setPrograms([]);
      }
    },
    [dates, selectedStation, programsByDate, getProgramsByDate]
  );

  // 放送局の選択
  const handleStationSelect = async (stationId: string) => {
    if (!auth) return;
    if (stationId === selectedStation) {
      setSelectedStation("");
      setSelectedTab(7);
      setPrograms([]);
      return;
    }
    setPrograms([]);
    setSelectedStation(stationId);
    setSelectedTab(7); // 最新の日付をデフォルトで選択
    setError("");

    try {
      // 1.現在放送中の番組を取得
      const nowOnAir = await RadikoClient.getProgramNow({
        token: auth.token,
        area: auth.areaId as AreaId,
        stationId,
      });
      setNowOnAir(nowOnAir);

      // 2.選択された局の番組表を取得
      const weeklyPrograms = await RadikoClient.getPrograms({
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
    console.log("Stopping player");

    // まず状態をリセット
    setCurrentProgram(null);
    setPlayingType(null);
    setSelectedTab(7);

    // オーディオ要素の処理
    if (audioRef.current) {
      // イベントリスナーをクリア
      clearAudioEventListeners();

      // 一時停止
      audioRef.current.pause();

      // ソースをクリア
      audioRef.current.src = "";
      audioRef.current.load();
    }

    // HLSインスタンスの破棄は少し遅延させる
    setTimeout(() => {
      if (hlsRef.current) {
        try {
          // メディアを切り離す
          hlsRef.current.detachMedia();

          // ストリームの読み込みを停止
          hlsRef.current.stopLoad();

          // 特定のイベントリスナーだけを削除
          const events = [
            Hls.Events.ERROR,
            Hls.Events.MANIFEST_PARSED,
            Hls.Events.LEVEL_LOADED,
            Hls.Events.MEDIA_ATTACHED,
          ];

          events.forEach((event) => {
            hlsRef.current?.off(event);
          });

          // インスタンスを破棄
          hlsRef.current.destroy();
          hlsRef.current = null;
        } catch (error) {
          console.error("HLS cleanup error:", error);
        }
      }
    }, 100);
  }, [clearAudioEventListeners]);

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

      // 使用する再生速度を決定（引数があればそれを優先）
      const targetSpeed = stateSpeed !== undefined ? stateSpeed : speed;
      // 状態を更新
      setSpeed(targetSpeed);

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
          // 以前のイベントリスナーをクリア
          clearAudioEventListeners();

          // AbortControllerを使用してイベントリスナーを管理
          const controller = new AbortController();
          // コントローラーを参照として保存
          const currentController = controller;

          // 定期的な再生位置保存のインターバル
          const saveInterval = setInterval(() => {
            if (audioRef.current && !audioRef.current.paused) {
              savePlaybackProgram(program);
            }
          }, 5000);

          // イベントハンドラを定義
          const handleEvent = () => savePlaybackProgram(program);

          // すべてのハンドラをまとめて保存（インターバルIDと、AbortControllerも含む）
          eventHandlersRef.current = {
            timefreeController: () => {
              currentController.abort();
              clearInterval(saveInterval);
            },
            saveInterval: (() =>
              clearInterval(saveInterval)) as unknown as EventListener,
            pause: handleEvent,
            seeking: handleEvent,
            ratechange: handleEvent,
            // 'timeupdate': handleEvent,
          };

          // canplayイベントで一度だけ実行される処理
          const handleCanPlay = () => {
            const audio = audioRef.current;
            if (!audio) return;

            // 再生位置を設定
            audio.currentTime = program.currentTime || 0;
            // 再生速度を設定
            audio.playbackRate = targetSpeed;
            // 初期状態を保存
            savePlaybackProgram(program);
          };

          // loadedmetadataイベントでも再生速度を設定
          const handleLoadedMetadata = () => {
            if (audioRef.current) {
              audioRef.current.playbackRate = targetSpeed;
            }
          };

          // 定期的なイベントリスナーを追加
          Object.entries(eventHandlersRef.current).forEach(
            ([event, handler]) => {
              if (event !== "timefreeController" && event !== "saveInterval") {
                audioRef.current?.addEventListener(event, handler);
              }
            }
          );

          // 一回限りのイベントリスナーを追加
          audioRef.current.addEventListener("canplay", handleCanPlay, {
            signal: controller.signal,
            once: true,
          });
          audioRef.current.addEventListener(
            "loadedmetadata",
            handleLoadedMetadata,
            {
              signal: controller.signal,
              once: true,
            }
          );

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
    [
      auth,
      selectedStation,
      initializeHLS,
      speed,
      savePlaybackProgram,
      getSavedPlaybackPrograms,
      clearAudioEventListeners,
    ]
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

        // 再生途中の番組（currentTime > 0）を抽出
        const inProgressPrograms = availablePrograms.filter(
          (program) => program.currentTime && program.currentTime > 0
        );

        let programToPlay;

        if (inProgressPrograms.length > 0) {
          // 1.再生途中の番組がある場合は、その中から放送日が最も古い番組を選択
          programToPlay = inProgressPrograms.reduce((oldest, current) => {
            const oldestTime = parseInt(oldest.startTime);
            const currentTime = parseInt(current.startTime);
            return currentTime < oldestTime ? current : oldest;
          }, inProgressPrograms[0]);
        } else {
          // 2.再生途中の番組がない場合は、未視聴の番組から放送日が最も古い番組を選択
          programToPlay = availablePrograms.reduce((oldest, current) => {
            const oldestTime = parseInt(oldest.startTime);
            const currentTime = parseInt(current.startTime);
            return currentTime < oldestTime ? current : oldest;
          }, availablePrograms[0]);
        }

        // 選択した番組の局を選択
        await handleStationSelect(programToPlay.station_id);
        // 選択した番組の日付タブを選択
        const oldestDate = new Date(
          parseInt(programToPlay.startTime.substring(0, 4)),
          parseInt(programToPlay.startTime.substring(4, 6)) - 1,
          parseInt(programToPlay.startTime.substring(6, 8))
        );
        const oldestIndex = dates.findIndex(
          (date) =>
            date.getFullYear() === oldestDate.getFullYear() &&
            date.getMonth() === oldestDate.getMonth() &&
            date.getDate() === oldestDate.getDate()
        );
        // 該当日を選択
        handleTabChange(oldestIndex, programToPlay);
        // 番組を再生
        handleTimeFreePlay(
          programToPlay,
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
      // まず、イベントリスナーを削除
      clearAudioEventListeners();

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
      // 注: window.gc()は標準ブラウザでは利用できません。
      // メモリプロファイリング時にのみ特別なフラグで有効化されます。
      // メモリリークを防ぐために、windowメモリを明示的に全解放
      if (typeof window !== "undefined" && window.gc) {
        window.gc();
      }
      // 放送局を取得
      const stations = await RadikoClient.getStations(auth.areaId as AreaId);
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

  useEffect(() => {
    if (!playingType) return;

    // メモリ解放のための処理（間隔を延長）
    const cleanupInterval = setInterval(() => {
      // 未使用のバッファをクリア
      if (hlsRef.current) {
        try {
          // バッファをフラッシュ
          hlsRef.current.trigger(Hls.Events.BUFFER_FLUSHING, {
            startOffset: 0,
            endOffset: Number.POSITIVE_INFINITY,
            type: null,
          });

          // 注: window.gc()は標準ブラウザでは利用できません。
          // メモリプロファイリング時にのみ特別なフラグで有効化されます。
          // 明示的なGCのトリガー
          if (typeof window !== "undefined" && window.gc) {
            window.gc();
          }
        } catch (error) {
          console.error("Error during buffer flush:", error);
        }
      }
    }, 60000); // 1分間隔に変更

    return () => {
      clearInterval(cleanupInterval);
    };
  }, [playingType]);

  // コンポーネントのアンマウント時にすべてのリソースを解放
  useEffect(() => {
    return () => {
      // AbortControllerの中断
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      // オーディオ要素のリソース解放
      if (audioRef.current) {
        // まずイベントリスナーをクリア
        clearAudioEventListeners();

        // メディアを停止してリソース解放
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current.load();
      }

      // HLSインスタンスの確実な破棄
      if (hlsRef.current) {
        try {
          // メディアを切り離す
          hlsRef.current.detachMedia();

          // ストリームの読み込みを停止
          hlsRef.current.stopLoad();

          // イベントリスナーを削除
          const events = [
            Hls.Events.ERROR,
            Hls.Events.MANIFEST_PARSED,
            Hls.Events.LEVEL_LOADED,
            Hls.Events.MEDIA_ATTACHED,
          ];

          events.forEach((event) => {
            hlsRef.current?.off(event);
          });

          // インスタンスを破棄
          hlsRef.current.destroy();
          hlsRef.current = null;
        } catch (error) {
          console.error("HLS cleanup error:", error);
        }
      }

      // 状態をクリア
      setCurrentProgram(null);
      setPlayingType(null);
    };
  }, [clearAudioEventListeners]);

  /* -----------------------------------------------------カスタムコントロール */
  // 1分間戻る処理
  const handleSkipBackward = useCallback(() => {
    if (!audioRef.current) return;

    // 現在の再生位置から60秒戻る（0秒未満にならないように制限）
    const newTime = Math.max(0, audioRef.current.currentTime - 60);
    audioRef.current.currentTime = newTime;
  }, []);

  // 1分間スキップ処理
  const handleSkipForward = useCallback(() => {
    if (!audioRef.current) return;

    // 現在の再生位置から60秒進む（曲の長さを超えないように制限）
    const newTime = Math.min(
      audioRef.current.duration || Infinity,
      audioRef.current.currentTime + 60
    );
    audioRef.current.currentTime = newTime;
  }, []);

  // 許可するHTMLタグとその属性を制限
  const config = {
    ALLOWED_TAGS: ["p", "br", "a", "span", "img", "div"],
    ALLOWED_ATTR: [
      "href",
      "target",
      "rel",
      "src",
      "alt",
      "width",
      "height",
      "style", //style属性は特に危険で、XSS攻撃の経路になり得ます
      "class",
    ],
  };
  // HTMLコンテンツをサニタイズする関数
  const sanitizeHtml = (html: string): string => {
    return DOMPurify.sanitize(html, config);
  };

  // 再生済み番組のセットを取得
  const playedPrograms = useMemo(() => {
    const savedPrograms = getSavedPlaybackPrograms();
    return new Set(
      savedPrograms
        .filter((p) => p.currentTime === -1)
        .map((p) => `${p.station_id}-${p.startTime}`)
    );
  }, [getSavedPlaybackPrograms]);

  // プログラム一覧のメモ化
  const memoizedPrograms = useMemo(() => {
    return programs.map((program) => {
      // 視聴済み番組かどうかをチェック
      const isPlayed = playedPrograms.has(
        `${program.station_id}-${program.startTime}`
      );

      // お気に入りかどうかをチェック
      const isFavorite = favorites.some((fav) => fav.title === program.title);

      return {
        ...program,
        isPlayed,
        isFavorite,
      };
    });
  }, [programs, playedPrograms, favorites]);

  // 時間帯に基づいて背景色クラスを決定する関数
  const getTimeSlotBackgroundClass = (startTime: string): string => {
    const hour = parseInt(startTime.substring(8, 10));

    if (hour >= 5 && hour < 12) {
      return "bg-green-50/50"; // 朝（5:00-12:00）
    } else if (hour >= 12 && hour < 18) {
      return "bg-yellow-50/50"; // 昼（12:00-18:00）
    } else if (hour >= 18 && hour < 24) {
      return "bg-orange-50/50"; // 夕方/夜（18:00-24:00）
    } else {
      return "bg-purple-50/50"; // 深夜（24:00-5:00）
    }
  };

  /* -----------------------------------------------------------視聴履歴の管理 */
  // 視聴履歴ドロワーの状態
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] =
    useState<boolean>(false);

  // 視聴履歴ドロワーの開閉
  const toggleHistoryDrawer = useCallback(() => {
    setIsHistoryDrawerOpen((prev) => !prev);
  }, []);

  // 視聴履歴から番組を再生する関数
  const playFromHistory = useCallback(
    (program: Program) => {
      // ドロワーを閉じる
      setIsHistoryDrawerOpen(false);

      // 対応する放送局を選択
      handleStationSelect(program.station_id).then(() => {
        // 対応する日付タブを選択
        const programDate = new Date(
          parseInt(program.startTime.substring(0, 4)),
          parseInt(program.startTime.substring(4, 6)) - 1,
          parseInt(program.startTime.substring(6, 8))
        );

        const tabIndex = dates.findIndex(
          (date) =>
            date.getFullYear() === programDate.getFullYear() &&
            date.getMonth() === programDate.getMonth() &&
            date.getDate() === programDate.getDate()
        );

        // 該当日を選択し、その後番組を再生
        if (tabIndex !== -1) {
          handleTabChange(tabIndex, program);
          handleTimeFreePlay(program);
        } else {
          // 該当する日付タブが見つからない場合は直接再生
          handleTimeFreePlay(program);
        }
      });
    },
    [dates, handleStationSelect, handleTabChange, handleTimeFreePlay]
  );

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
            radikoClient={RadikoClient}
            currentAreaName={currentAreaName}
            onAreaChange={onAreaChange}
          />

          {/* 放送局 */}
          <h2 className="text-xl font-semibold mb-2">放送局</h2>
          <div className="grid grid-cols-4 md:grid-cols-5 gap-1 text-sm">
            {stations &&
              stations.map((station) => (
                <button
                  key={station.id}
                  onClick={() => handleStationSelect(station.id)}
                  className={`p-1 rounded ${
                    // 選択中以外は画像を色なし
                    selectedStation === station.id
                      ? "bg-blue-500 text-white shadow-md"
                      : "border"
                  }`}
                >
                  <img
                    src={station.banner}
                    alt={station.name}
                    className={`${
                      selectedStation &&
                      selectedStation !== station.id &&
                      "grayscale-[80%]"
                    }`}
                  />
                  <div className="text-[0.5rem] truncate">{station.name}</div>
                </button>
              ))}
          </div>

          {/* 現在放送中の番組情報 */}
          {nowOnAir && (
            <div className="grid row-span-2 mt-2 bg-gray-100 p-2 rounded relative shadow-lg">
              {/* 番組詳細 - アコーディオン形式 */}
              <div className="md:row-start-2 md:pt-2">
                <div className="flex items-center">
                  {/* 番組イメージがある場合に表示するエリア */}
                  {nowOnAir.info && nowOnAir.info.includes("<img") && (
                    <div className="flex-shrink-0 mr-2 w-16 h-16 overflow-hidden">
                      <div
                        className="w-full h-full bg-contain bg-no-repeat bg-center"
                        style={{
                          backgroundImage: `url(${
                            nowOnAir.info.match(/src="([^"]+)"/)?.[1] || ""
                          })`,
                        }}
                      />
                    </div>
                  )}

                  <div className="flex-grow">
                    <div className="text-sm text-gray-600">
                      {formatRadikoTime(nowOnAir.startTime)} -{" "}
                      {formatRadikoTime(nowOnAir.endTime)}
                    </div>
                    <div className="text-sm font-semibold">
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
                    <div className="text-xs text-gray-600">{nowOnAir.pfm}</div>
                  </div>
                </div>

                {/* アコーディオン実装（CSS only） */}
                {nowOnAir.info && (
                  <div className="mt-2">
                    <input
                      type="checkbox"
                      id="accordion"
                      className="peer absolute invisible"
                    />

                    {/* プラスアイコン */}
                    <label
                      htmlFor="accordion"
                      className="flex justify-end items-center pb-1 md:py-1 cursor-pointer hover:text-slate-500 transition-all peer-checked:hidden"
                    >
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        strokeWidth="2"
                        stroke="currentColor"
                        fill="none"
                      >
                        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                        <path d="M12 5l0 14" />
                        <path d="M5 12l14 0" />
                      </svg>

                      <span className="ml-1 text-xs">詳細情報</span>
                    </label>

                    {/* マイナスアイコン */}
                    <label
                      htmlFor="accordion"
                      className="justify-between items-center py-1 cursor-pointer bg-white border-b text-red-400 hover:text-red-300 transition-all hidden peer-checked:flex"
                    >
                      <span className="text-xs pl-4"> 詳細情報 </span>
                      <div className="flex items-center pr-4">
                        <svg
                          className="w-4 h-4"
                          viewBox="0 0 24 24"
                          strokeWidth="2"
                          stroke="currentColor"
                          fill="none"
                        >
                          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                          <path d="M5 12l14 0" />
                        </svg>
                      </div>
                    </label>

                    {/* コンテンツ部分 */}
                    <div className="overflow-hidden max-h-0 px-2 bg-white peer-checked:max-h-[400px] transition-all duration-300 peer-checked:overflow-y-auto">
                      <div
                        className="text-sm break-words text-gray-600 mt-2"
                        dangerouslySetInnerHTML={{
                          __html: sanitizeHtml(nowOnAir.info),
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* リアルタイム再生ボタン */}
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
          <h2 className="text-xl font-semibold mb-2">
            番組表：
            {stations.find((station) => station.id === selectedStation)?.name} -
            {selectedStation}
          </h2>

          {/* 日付タブ */}
          <div className="flex overflow-x-auto mb-4 border-b" ref={tabsRef}>
            {dates.map((date, index) => {
              const isToday = date.toDateString() === new Date().toDateString();
              return (
                <button
                  key={date.toISOString()}
                  onClick={() => handleTabChange(index)}
                  className={`px-2 py-2 whitespace-nowrap text-xs border ${
                    selectedTab === index
                      ? "border-b-2 border-blue-500 text-blue-500"
                      : "text-gray-500"
                  } ${isToday ? "bg-slate-50 font-bold" : ""}`}
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
            <div className="space-y-1 max-h-[700px] overflow-y-auto">
              {programs.length > 0 ? (
                programs.map((program, index) => {
                  // 視聴可能かどうかをチェック
                  const canPlay =
                    new Date(
                      parseInt(program.endTime.substring(0, 4)),
                      parseInt(program.endTime.substring(4, 6)) - 1,
                      parseInt(program.endTime.substring(6, 8)),
                      parseInt(program.endTime.substring(8, 10)),
                      parseInt(program.endTime.substring(10, 12))
                    ) < new Date();

                  // 視聴済み番組かどうかをチェック
                  const isPlayed = playedPrograms.has(
                    `${program.station_id}-${program.startTime}`
                  );

                  // 現在再生中の番組かどうかをチェック
                  const isPlaying =
                    playingType === "timefree" &&
                    currentProgram?.startTime === program.startTime &&
                    currentProgram?.station_id === program.station_id;

                  // お気に入りかどうかをチェック
                  const isFav = memoizedPrograms[index].isFavorite;

                  // 時間帯に応じた背景色クラスを取得
                  const timeSlotClass = getTimeSlotBackgroundClass(
                    program.startTime
                  );

                  return (
                    <div key={index} className="relative">
                      {/* お気に入りボタンをdivの外に配置 */}
                      <span
                        onClick={(e) => toggleFavorite(e, program)}
                        className={`absolute top-2 right-2 text-xl focus:outline-none z-10 cursor-pointer ${
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
                              ? `hover:bg-gray-100 border-gray-200 ${timeSlotClass}`
                              : `border-gray-200`
                          }
                          ${canPlay ? "text-gray-900" : "text-gray-500"}
                        `}
                        disabled={!canPlay}
                      >
                        <div
                          className={`text-sm ${
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
        className={`fixed bottom-0 left-0 right-0 border-t shadow-lg z-20 p-4 bg-slate-50/90 ${
          playingType === "timefree" ? "block" : "hidden"
        }`}
      >
        <div className="container mx-auto max-w-7xl pb-1">
          {currentProgram && (
            <div className="md:grid grid-cols-3 md:gap-2">
              <div className="col-span-2 text-sm text-gray-600">
                <span className="mr-2">
                  {formatDisplayDate(currentProgram.startTime)}
                  {"/"}
                  {formatRadikoTime(currentProgram.startTime)} -{" "}
                  {formatRadikoTime(currentProgram.endTime)}
                </span>
                <span className="md:text-lg font-semibold">
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

              {/* カスタムコントロールボタン */}
              <div className="flex justify-center items-center gap-2 py-1">
                <button
                  onClick={handleSkipBackward}
                  className="px-4 py-1 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md flex items-center"
                  title="1分戻る"
                >
                  <span className="ml-1">-1分 &lt;&lt;</span>
                </button>

                <button
                  onClick={handleSkipForward}
                  className="px-4 py-1 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md flex items-center"
                  title="1分進む"
                >
                  <span className="ml-1">&gt;&gt; +1分</span>
                </button>

                <button
                  onClick={onEnded}
                  className={
                    "px-4 py-1 rounded-md flex items-center bg-blue-500 hover:bg-blue-600 text-white"
                  }
                  title="次の番組"
                >
                  <span>次へ</span>
                  <span className="text-lg ml-1">▶</span>
                </button>
              </div>
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
      {/* 視聴履歴ボタンとドロワー */}
      <HistoryButton onClick={toggleHistoryDrawer} />
      <HistoryDrawer
        isOpen={isHistoryDrawerOpen}
        onClose={toggleHistoryDrawer}
        onPlayFromHistory={playFromHistory}
        stations={stations}
        getSavedPlaybackPrograms={getSavedPlaybackPrograms}
        playbackProgramsKey={PLAYBACK_PROGRAMS_KEY}
      />
    </div>
  );
}
