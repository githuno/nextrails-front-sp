"use client"

import React, { useCallback, useEffect, useState } from "react"
import { Program, formatDisplayDate, formatRadikoTime } from "./constants"

interface PlayerControlsProps {
  currentProgram: Program | null
  playingType: "live" | "timefree" | null
  speed: number
  onSpeedChange: React.ChangeEventHandler<HTMLInputElement>
  onSkipBackward: () => void
  onSkipForward: () => void
  onNextProgram: () => void
  audioRef: React.RefObject<HTMLAudioElement | null>
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  currentProgram,
  playingType,
  speed,
  onSpeedChange,
  onSkipBackward,
  onSkipForward,
  onNextProgram,
  audioRef,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateTime = () => setCurrentTime(audio.currentTime)
    const updateDuration = () => setDuration(audio.duration)
    const updatePlaying = () => setIsPlaying(!audio.paused)
    const updateVolume = () => setVolume(audio.volume)

    audio.addEventListener("timeupdate", updateTime)
    audio.addEventListener("loadedmetadata", updateDuration)
    audio.addEventListener("play", updatePlaying)
    audio.addEventListener("pause", updatePlaying)
    audio.addEventListener("volumechange", updateVolume)

    return () => {
      audio.removeEventListener("timeupdate", updateTime)
      audio.removeEventListener("loadedmetadata", updateDuration)
      audio.removeEventListener("play", updatePlaying)
      audio.removeEventListener("pause", updatePlaying)
      audio.removeEventListener("volumechange", updateVolume)
    }
  }, [audioRef])

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
  }, [audioRef, isPlaying])

  const handleProgressChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const audio = audioRef.current
      if (!audio) return
      const newTime = (parseFloat(e.target.value) / 100) * duration
      audio.currentTime = newTime
      setCurrentTime(newTime)
    },
    [audioRef, duration],
  )

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const audio = audioRef.current
      if (!audio) return
      const newVolume = parseFloat(e.target.value)
      audio.volume = newVolume
      setVolume(newVolume)
    },
    [audioRef],
  )

  const formatTime = (time: number) => {
    const hours = Math.floor(time / 3600)
    const minutes = Math.floor((time % 3600) / 60)
    const seconds = Math.floor(time % 60)
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  const speedPresets = [0.5, 1, 1.5, 2]

  return (
    <div
      className={`fixed right-0 bottom-0 left-0 z-30 border-t bg-slate-50/95 px-2 shadow-xl backdrop-blur-sm transition-transform duration-500 ease-in-out ${
        playingType ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="relative container mx-auto max-w-7xl">
        {/* トグルボタン - 中央上に回り込み配置 */}
        <div className="absolute top-0 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 transform">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="rounded-full bg-white/80 p-2 shadow-lg transition-all duration-200 hover:scale-110 hover:bg-white hover:shadow-xl"
            title={isCollapsed ? "展開" : "折り畳み"}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-5 w-5 transition-transform duration-300 ${isCollapsed ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* コントロール部分 */}
        <div
          className={`overflow-hidden pt-2 transition-all duration-500 ease-in-out ${isCollapsed ? "max-h-0 pb-0 opacity-0" : "max-h-64 pb-2 opacity-100"}`}
        >
          {playingType === "timefree" && currentProgram && (
            <div className="mb-1 flex items-center justify-between">
              <div className="min-w-0 flex-1 md:pl-12">
                <div className="flex items-center gap-1 text-xs text-gray-600 md:gap-2">
                  <span className="truncate">
                    {formatDisplayDate(currentProgram.startTime)} / {formatRadikoTime(currentProgram.startTime)} -{" "}
                    {formatRadikoTime(currentProgram.endTime)}
                  </span>
                  {currentProgram.pfm && <span className="truncate text-gray-500">({currentProgram.pfm})</span>}
                </div>
                <div className="truncate text-sm leading-tight font-semibold md:text-base">
                  {currentProgram.url ? (
                    <a
                      href={currentProgram.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 transition-colors hover:text-blue-800 hover:underline"
                    >
                      {currentProgram.title}
                    </a>
                  ) : (
                    currentProgram.title
                  )}
                </div>
              </div>

              <div className="ml-2 flex items-center gap-1 md:gap-3 md:pr-24">
                <button
                  onClick={onSkipBackward}
                  className="group flex h-8 w-10 items-center justify-center rounded-full bg-gray-100 shadow-sm transition-all duration-150 hover:scale-105 hover:bg-gray-200 hover:shadow-md active:scale-95 active:bg-gray-300"
                  title="1分戻る"
                >
                  -1m
                </button>

                <button
                  onClick={onSkipForward}
                  className="group flex h-8 w-10 items-center justify-center rounded-full bg-gray-100 shadow-sm transition-all duration-150 hover:scale-105 hover:bg-gray-200 hover:shadow-md active:scale-95 active:bg-gray-300"
                  title="1分進む"
                >
                  +1m
                </button>

                <button
                  onClick={onNextProgram}
                  className="group flex h-10 w-12 items-center justify-center rounded-full bg-blue-500 text-white shadow-sm transition-all duration-150 hover:scale-105 hover:bg-blue-600 hover:shadow-md active:scale-95 active:bg-blue-700"
                  title="次の番組"
                >
                  next
                  {/* <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg> */}
                </button>
              </div>
            </div>
          )}

          {playingType === "live" && currentProgram && (
            <div className="mb-1 flex items-center justify-between">
              <div className="inline-flex items-center gap-2 rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-500">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500"></div>
                LIVE
              </div>
              <div className="ml-2 truncate text-sm font-semibold">{currentProgram.title}</div>
            </div>
          )}

          {/* Compact Audio Controls */}
          <div className="rounded-md bg-white/50 px-2 shadow-inner">
            {/* Progress Bar & Time - Full width on mobile */}
            <div className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
              <div className="flex items-center justify-center gap-2 sm:w-auto">
                <span className="w-16 text-center text-xs font-medium text-gray-700 sm:text-right">
                  {formatTime(currentTime)}
                </span>
                <span className="hidden sm:inline"> / </span>
                <span className="w-16 text-center text-xs font-medium text-gray-700 sm:w-auto">
                  {formatTime(duration)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={duration ? (currentTime / duration) * 100 : 0}
                onChange={handleProgressChange}
                className="slider h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-200 sm:h-1"
              />
            </div>

            {/* Controls Row - Horizontal on mobile */}
            <div className="flex flex-row items-center justify-between">
              {/* Volume & Play Button Row */}
              <div className="flex items-center gap-3 sm:gap-3">
                <div className="flex items-center gap-1">
                  <svg
                    className="h-4 w-4 text-gray-600 sm:h-3 sm:w-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5L6 9H2v6h4l5 4V5z" />
                  </svg>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="slider h-2 w-16 cursor-pointer appearance-none rounded-lg bg-gray-200 sm:h-1 sm:w-12"
                  />
                </div>
                <button
                  onClick={togglePlayPause}
                  className="group flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 shadow-sm transition-all duration-150 hover:scale-105 hover:bg-blue-600 hover:shadow-md active:scale-95 active:bg-blue-700 sm:h-10 sm:w-10"
                >
                  {isPlaying ? (
                    <svg className="h-4 w-4 text-white sm:h-5 sm:w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4 text-white sm:h-5 sm:w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Speed Controls - Horizontal on mobile */}
              {playingType === "timefree" && (
                <div className="flex w-full flex-col gap-2 pl-8 sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      {speedPresets.map((preset) => (
                        <button
                          key={preset}
                          onClick={() => {
                            const event = {
                              target: { value: preset.toString() },
                            } as React.ChangeEvent<HTMLInputElement>
                            onSpeedChange(event)
                          }}
                          className={`rounded px-1 text-xs font-medium transition-all duration-150 sm:px-1.5 ${
                            Math.abs(speed - preset) < 0.05
                              ? "bg-blue-500 text-white"
                              : "bg-gray-400 text-gray-100 hover:bg-gray-600"
                          }`}
                        >
                          {preset}x
                        </button>
                      ))}
                    </div>
                    <span className="text-xs font-medium text-gray-600 sm:text-sm">{speed.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="3.0"
                    step="0.1"
                    value={speed}
                    onChange={onSpeedChange}
                    className="slider h-1 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-200"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Hidden native audio for fallback */}
          <audio ref={audioRef} className="hidden" />
        </div>
      </div>
    </div>
  )
}
