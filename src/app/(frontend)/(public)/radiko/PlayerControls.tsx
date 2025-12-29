"use client"

import React from "react"
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
  return (
    <div
      className={`fixed right-0 bottom-0 left-0 z-20 border-t bg-slate-50/90 p-4 shadow-lg transition-transform duration-300 ${
        playingType ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="container mx-auto max-w-7xl pb-1">
        {playingType === "timefree" && currentProgram && (
          <div className="grid-cols-3 md:grid md:gap-2">
            <div className="col-span-2 text-sm text-gray-600">
              <span className="mr-2">
                {formatDisplayDate(currentProgram.startTime)}
                {"/"}
                {formatRadikoTime(currentProgram.startTime)} - {formatRadikoTime(currentProgram.endTime)}
              </span>
              <span className="font-semibold md:text-lg">
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
              {currentProgram.pfm && <span className="ml-2 text-xs text-gray-500">({currentProgram.pfm})</span>}
            </div>

            <div className="flex items-center justify-center gap-2 py-1">
              <button
                onClick={onSkipBackward}
                className="flex items-center rounded-md bg-gray-200 px-4 py-1 text-gray-800 hover:bg-gray-300"
                title="1分戻る"
              >
                <span className="ml-1">-1分 &lt;&lt;</span>
              </button>

              <button
                onClick={onSkipForward}
                className="flex items-center rounded-md bg-gray-200 px-4 py-1 text-gray-800 hover:bg-gray-300"
                title="1分進む"
              >
                <span className="ml-1">&gt;&gt; +1分</span>
              </button>

              <button
                onClick={onNextProgram}
                className="flex items-center rounded-md bg-blue-500 px-4 py-1 text-white hover:bg-blue-600"
                title="次の番組"
              >
                <span>次へ</span>
                <span className="ml-1 text-lg">▶</span>
              </button>
            </div>
          </div>
        )}

        {playingType === "live" && currentProgram && (
          <div className="mb-2 text-sm text-gray-600">
            <span className="mr-2 font-bold text-red-500">● LIVE</span>
            <span className="font-semibold md:text-lg">{currentProgram.title}</span>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <audio ref={audioRef} controls className="w-full" />
          {playingType === "timefree" && (
            <div className="flex items-center gap-2">
              <span className="text-sm">再生速度: {speed.toFixed(1)}x</span>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.1"
                value={speed}
                onChange={onSpeedChange}
                className="grow"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
