"use client"

import Hls from "hls.js"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AreaSelect } from "./AreaSelect"
import RadikoClient, { useRadikoState } from "./client"
import { AreaId, url } from "./constants"
import HistoryDrawer from "./HistoryDrawer"
import { NowOnAirCard } from "./NowOnAirCard"
import { PlayerControls } from "./PlayerControls"
import { ProgramList } from "./ProgramList"
import { StationList } from "./StationList"

export default function Page() {
  const state: ReturnType<typeof useRadikoState> = useRadikoState()
  const [isClient, setIsClient] = useState(false)
  const [selectedTab, setSelectedTab] = useState(7)
  const [isHistoryDrawerOpen, setHistoryDrawerOpen] = useState(false)

  // refs
  const audioRef = useRef<HTMLAudioElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const tabsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsClient(true)
  }, [])

  // HLSストリームの初期化
  const initializeHLS = useCallback((streamUrl: string) => {
    if (!audioRef.current) return

    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 600,
        maxBufferSize: 60 * 1000 * 1000,
        maxBufferHole: 0.5,
      })
      hlsRef.current = hls
      hls.loadSource(streamUrl)
      hls.attachMedia(audioRef.current)
    } else if (audioRef.current.canPlayType("application/vnd.apple.mpegurl")) {
      audioRef.current.src = streamUrl
    }
  }, [])

  // 再生停止
  const stopPlayer = useCallback(() => {
    RadikoClient.stopPlayback()
  }, [])

  // オーディオの物理的な停止とクリーンアップ
  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ""
      audioRef.current.load()
    }
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }
  }, [])

  // スキップ操作
  const handleSkip = useCallback((seconds: number) => {
    if (!audioRef.current) return
    const audio = audioRef.current
    audio.currentTime = Math.max(0, Math.min(audio.duration || Infinity, audio.currentTime + seconds))
  }, [])

  // 速度変更
  const handleSpeedChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    RadikoClient.setState({ speed: val })
    if (audioRef.current) audioRef.current.playbackRate = val
  }, [])

  // エリア変更時の処理
  const handleAreaChange = useCallback(() => {
    const auth = RadikoClient.getAuthInfo()
    const name = RadikoClient.getAuthName()
    RadikoClient.setState({ auth, currentAreaName: name })
  }, [])

  // タブの初期選択（データ読み込み時）
  useEffect(() => {
    const dateKeys = Object.keys(state.programsByDate).sort((a, b) => parseInt(a) - parseInt(b))
    if (dateKeys.length > 0 && selectedTab >= dateKeys.length) {
      setSelectedTab(dateKeys.length - 1)
    }
  }, [state.programsByDate, selectedTab])

  // 再生状態の監視とHLS初期化
  useEffect(() => {
    if (!state.currentProgram || !state.playingType || !state.auth) {
      cleanupAudio()
      return
    }

    const program = state.currentProgram
    let streamUrl = ""

    if (state.playingType === "live") {
      streamUrl = url.liveStreaming.replace("{stationId}", program.station_id).replace("{token}", state.auth.token)
    } else {
      streamUrl = url.timeFreeStreaming
        .replace("{stationId}", program.station_id)
        .replace("{ft}", program.startTime)
        .replace("{to}", program.endTime)
        .replace("{token}", state.auth.token)
    }

    initializeHLS(streamUrl)

    // タイムフリーの場合は履歴に追加
    if (state.playingType === "timefree") {
      RadikoClient.addToHistory(program)
    }
  }, [state.currentProgram, state.playingType, state.auth, initializeHLS, cleanupAudio])

  // 再生開始の制御（Auto-play）
  useEffect(() => {
    if (state.playingType && state.currentProgram && audioRef.current) {
      const audio = audioRef.current
      const program = state.currentProgram
      const speed = state.speed
      const isTimeFree = state.playingType === "timefree"

      const handleCanPlay = () => {
        if (isTimeFree) {
          audio.currentTime = program.currentTime || 0
          audio.playbackRate = speed
        } else {
          audio.playbackRate = 1.0
        }
        void audio.play().catch((err) => console.debug("Auto-play blocked or failed:", err))
      }

      audio.addEventListener("canplay", handleCanPlay, { once: true })
      return () => audio.removeEventListener("canplay", handleCanPlay)
    }
  }, [state.currentProgram, state.playingType, state.speed])

  // 再生終了時の処理
  const handleNextProgram = useCallback(() => {
    const currentState = RadikoClient.getState()
    const endingProgram = currentState.currentProgram
    if (!endingProgram) return

    stopPlayer()
    RadikoClient.markAsProgramPlayed(endingProgram.station_id, endingProgram.startTime)

    // 次の番組を自動再生
    setTimeout(() => {
      const stations = currentState.stations
      if (stations.length > 0) {
        void RadikoClient.restorePlaybackProgram(stations).then((result) => {
          if (result) {
            RadikoClient.setState({
              currentProgram: result.program,
              playingType: "timefree",
              speed: result.speed,
            })
          }
        })
      }
    }, 100)
  }, [stopPlayer])

  // オーディオイベント管理
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleSave = () => {
      const currentState = RadikoClient.getState()
      if (currentState.playingType === "timefree" && currentState.currentProgram) {
        RadikoClient.savePlaybackProgram(currentState.currentProgram, audio.currentTime)
      }
    }

    const handleEnded = () => handleNextProgram()

    const events = ["pause", "seeking", "ratechange"]
    events.forEach((e) => audio.addEventListener(e, handleSave))
    audio.addEventListener("ended", handleEnded)

    let interval: NodeJS.Timeout | null = null
    if (state.playingType === "timefree") {
      interval = setInterval(() => {
        if (!audio.paused) handleSave()
      }, 5000)
    }

    return () => {
      events.forEach((e) => audio.removeEventListener(e, handleSave))
      audio.removeEventListener("ended", handleEnded)
      if (interval) clearInterval(interval)
    }
  }, [state.playingType, handleNextProgram])

  // 初期化とエリア変更
  const lastAuthToken = useRef<string | null>(null)
  const { auth, currentAreaName } = state
  useEffect(() => {
    if (!auth || currentAreaName === "未判定") return
    if (auth.token === lastAuthToken.current) return
    lastAuthToken.current = auth.token

    const init = async () => {
      stopPlayer()
      RadikoClient.setState({ isLoading: true })
      try {
        const stations = await RadikoClient.getStations(auth.areaId as AreaId)
        RadikoClient.setState({ stations })

        await RadikoClient.saveFavoritePrograms(stations)
        const result = await RadikoClient.restorePlaybackProgram(stations)
        if (result) {
          // 復元時は selectedStation をセットし、番組表をフェッチ
          RadikoClient.setState({ selectedStation: result.program.station_id })
          await RadikoClient.fetchPrograms(result.program.station_id, auth)
          // 少し待ってから再生（DOMの準備を待つ）
          setTimeout(() => {
            RadikoClient.setState({
              currentProgram: result.program,
              playingType: "timefree",
              speed: result.speed,
            })
          }, 500)
        } else if (stations.length > 0) {
          // デフォルトの放送局を選択
          RadikoClient.selectStation(stations[0].id)
        }
      } finally {
        RadikoClient.setState({ isLoading: false })
      }
    }
    init()
  }, [auth, currentAreaName, stopPlayer])

  // 番組表の日付リストをメモ化
  const programDates = useMemo(() => {
    return Object.keys(state.programsByDate)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map((d) => {
        const y = parseInt(d.substring(0, 4))
        const m = parseInt(d.substring(4, 6)) - 1
        const d_ = parseInt(d.substring(6, 8))
        return new Date(y, m, d_)
      })
  }, [state.programsByDate])

  // 現在のタブ（日付）に対応する番組リストをメモ化
  const currentTabPrograms = useMemo(() => {
    const dateKeys = Object.keys(state.programsByDate).sort((a, b) => parseInt(a) - parseInt(b))
    const selectedDateKey = dateKeys[selectedTab]
    return selectedDateKey ? state.programsByDate[selectedDateKey] : []
  }, [state.programsByDate, selectedTab])

  if (!isClient) return null

  return (
    <div className="container mx-auto p-4 pb-32">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Radiko Player</h1>
        <button
          onClick={() => setHistoryDrawerOpen(!isHistoryDrawerOpen)}
          className="fixed right-4 bottom-20 z-60 rounded-full bg-blue-600 p-3 text-white shadow-lg hover:bg-blue-700"
          aria-label="視聴履歴"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </button>
      </div>

      {state.error && !state.playingType && (
        <div className="mb-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">{state.error}</div>
      )}

      <div className="grid grid-cols-1 gap-4 pb-16 md:grid-cols-2">
        <div id="info">
          <AreaSelect
            radikoClient={RadikoClient}
            currentAreaName={state.currentAreaName}
            onAreaChange={handleAreaChange}
          />

          <h2 className="mb-2 text-xl font-semibold">放送局</h2>
          <StationList stations={state.stations} selectedStation={state.selectedStation} />

          <NowOnAirCard nowOnAir={state.nowOnAir} selectedStation={state.selectedStation} />
        </div>

        {/* データエクスポート/インポート */}
        <div className="mt-4 flex gap-4">
          <button
            onClick={() => {
              const data = RadikoClient.exportData()
              const blob = new Blob([data], { type: "application/json" })
              const url = URL.createObjectURL(blob)
              const a = document.createElement("a")
              a.href = url
              a.download = "radiko-data.json"
              a.click()
              URL.revokeObjectURL(url)
            }}
            className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
          >
            データエクスポート
          </button>
          <label className="cursor-pointer rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
            データインポート
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  const reader = new FileReader()
                  reader.onload = (e) => {
                    const content = e.target?.result as string
                    if (content) {
                      RadikoClient.importData(content)
                      alert("データをインポートしました")
                    }
                  }
                  reader.readAsText(file)
                }
              }}
            />
          </label>
        </div>

        <div id="list">
          <h2 className="mb-2 text-xl font-semibold">
            番組表：
            {state.stations.find((s) => s.id === state.selectedStation)?.name || "未選択"}
          </h2>

          <ProgramList
            programs={currentTabPrograms}
            dates={programDates}
            selectedTab={selectedTab}
            playedPrograms={state.playedPrograms}
            favorites={state.favorites}
            isLoading={state.isLoading}
            error={state.error}
            tabsRef={tabsRef}
            setSelectedTab={setSelectedTab}
          />
        </div>
      </div>

      <PlayerControls
        currentProgram={state.currentProgram}
        playingType={state.playingType}
        speed={state.speed}
        onSpeedChange={handleSpeedChange}
        onSkipBackward={() => handleSkip(-60)}
        onSkipForward={() => handleSkip(60)}
        onNextProgram={handleNextProgram}
        audioRef={audioRef}
      />

      <HistoryDrawer isOpen={isHistoryDrawerOpen} onClose={() => setHistoryDrawerOpen(false)} />
    </div>
  )
}
