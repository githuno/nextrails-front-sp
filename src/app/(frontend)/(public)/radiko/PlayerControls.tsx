"use client"

import React, { useState } from "react"
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

  return (
    <div
      className={`fixed right-0 bottom-0 left-0 z-30 border-t bg-slate-50/90 shadow-lg transition-transform duration-300 ${
        playingType ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="relative container mx-auto max-w-7xl">
        {/* トグルボタン - 中央上に回り込み配置 */}
        <div className="absolute top-0 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 transform">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="rounded-full bg-gray-200 p-1 shadow-md transition-colors hover:bg-gray-300"
            title={isCollapsed ? "展開" : "折り畳み"}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-4 w-4 transition-transform ${isCollapsed ? "rotate-180" : ""}`}
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
          className={`overflow-hidden pt-4 transition-all duration-300 ${isCollapsed ? "max-h-0 pb-0" : "max-h-96 pb-4"}`}
        >
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
    </div>
  )
}
