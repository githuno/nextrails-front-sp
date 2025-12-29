"use client"

import React, { useLayoutEffect } from "react"
import { sanitizeHtml } from "../../../../utils/sanitize"
import RadikoClient, { useRadikoState } from "./client"
import { Program, formatRadikoTime } from "./constants"

interface ProgramListProps {
  programs: Program[]
  dates: Date[]
  selectedTab: number
  playedPrograms: Set<string>
  favorites: Array<{ stationId: string; title: string }>
  isLoading: boolean
  error: string | null
  tabsRef: React.RefObject<HTMLDivElement | null>
  setSelectedTab: React.Dispatch<React.SetStateAction<number>>
}

export const ProgramList: React.FC<ProgramListProps> = ({
  programs,
  dates,
  selectedTab,
  playedPrograms,
  favorites,
  isLoading,
  error,
  tabsRef,
  setSelectedTab,
}) => {
  const state = useRadikoState()

  // 日付タブの自動スクロール（次のアニメーションフレームで実行）
  useLayoutEffect(() => {
    if (tabsRef.current) {
      const tabElement = tabsRef.current.children[selectedTab] as HTMLElement
      if (tabElement) {
        requestAnimationFrame(() => {
          tabElement.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
        })
      }
    }
  }, [selectedTab, tabsRef, dates])

  // 番組一覧の自動スクロール（現在時刻の番組に）
  useLayoutEffect(() => {
    const now = new Date()
    const currentProgramIndex = programs.findIndex((p) => {
      const start = new Date(
        parseInt(p.startTime.substring(0, 4)),
        parseInt(p.startTime.substring(4, 6)) - 1,
        parseInt(p.startTime.substring(6, 8)),
        parseInt(p.startTime.substring(8, 10)),
        parseInt(p.startTime.substring(10, 12)),
      )
      const end = new Date(
        parseInt(p.endTime.substring(0, 4)),
        parseInt(p.endTime.substring(4, 6)) - 1,
        parseInt(p.endTime.substring(6, 8)),
        parseInt(p.endTime.substring(8, 10)),
        parseInt(p.endTime.substring(10, 12)),
      )
      return now >= start && now < end
    })

    if (currentProgramIndex >= 0) {
      requestAnimationFrame(() => {
        const programElement = document.querySelector(`[data-program-index="${currentProgramIndex}"]`) as HTMLElement
        if (programElement) {
          programElement.scrollIntoView({ behavior: "smooth", block: "center" })
        }
      })
    }
  }, [programs])

  const getTimeSlotBackgroundClass = (startTime: string) => {
    const hour = parseInt(startTime.substring(8, 10))
    if (hour >= 5 && hour < 12) return "bg-orange-50/30" // 朝
    if (hour >= 12 && hour < 18) return "bg-blue-50/30" // 昼
    if (hour >= 18 && hour < 24) return "bg-indigo-50/30" // 夜
    return "bg-slate-100/30" // 深夜
  }

  return (
    <div id="list">
      <div className="mb-4 flex overflow-x-auto border-b" ref={tabsRef}>
        {dates.map((date, index) => {
          const isToday = date.toDateString() === new Date().toDateString()
          const playingDateKey = state.currentProgram?.startTime.substring(0, 8)
          const tabDateKey =
            date.getFullYear().toString() +
            (date.getMonth() + 1).toString().padStart(2, "0") +
            date.getDate().toString().padStart(2, "0")
          const isPlayingDate = playingDateKey === tabDateKey
          const isLivePlaying = isPlayingDate && state.playingType === "live"

          return (
            <button
              key={date.toISOString()}
              onClick={() => {
                setSelectedTab(index)
              }}
              className={`border px-2 py-2 text-xs whitespace-nowrap transition-all ${
                selectedTab === index
                  ? "border-b-2 border-blue-500 bg-blue-50/30 text-blue-500"
                  : isPlayingDate
                    ? isLivePlaying
                      ? "animate-pulse border-b-2 border-red-300 bg-red-50 text-red-400"
                      : "animate-pulse border-b-2 border-blue-300 bg-blue-50 text-blue-400"
                    : "text-gray-500"
              } ${isToday ? "font-bold" : ""}`}
            >
              {date.toLocaleDateString("ja-JP", {
                month: "numeric",
                day: "numeric",
                weekday: "short",
              })}
            </button>
          )
        })}
      </div>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="max-h-96 space-y-1 overflow-y-auto">
          {programs.length > 0 ? (
            programs.map((program, index) => {
              const canPlay =
                new Date(
                  parseInt(program.endTime.substring(0, 4)),
                  parseInt(program.endTime.substring(4, 6)) - 1,
                  parseInt(program.endTime.substring(6, 8)),
                  parseInt(program.endTime.substring(8, 10)),
                  parseInt(program.endTime.substring(10, 12)),
                ) < new Date()

              const isPlayed = playedPrograms.has(`${program.station_id}-${program.startTime}`)
              const isPlaying =
                state.currentProgram?.station_id === program.station_id &&
                state.currentProgram?.startTime === program.startTime

              const isFav = favorites.some((fav) => fav.title === program.title)
              const timeSlotClass = getTimeSlotBackgroundClass(program.startTime)
              const isLive = state.playingType === "live"

              return (
                <div
                  key={index}
                  className={`relative ${isPlaying ? "sticky top-0 bottom-0 z-30 shadow-lg" : "z-0"}`}
                  data-program-index={index}
                >
                  <div className="absolute top-2 right-2 z-20 flex items-center gap-3">
                    {isPlaying && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          RadikoClient.stopPlayback()
                        }}
                        className={`rounded-full p-1.5 text-white shadow-sm ${
                          isLive ? "bg-red-500 hover:bg-red-600" : "bg-blue-500 hover:bg-blue-600"
                        }`}
                        title="停止"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                          <rect x="6" y="6" width="12" height="12" />
                        </svg>
                      </button>
                    )}
                    <span
                      onClick={(e) => {
                        e.stopPropagation()
                        RadikoClient.toggleFavorite(program)
                      }}
                      className={`cursor-pointer text-xl leading-none focus:outline-none ${
                        isFav ? "text-yellow-500" : "text-gray-300 hover:text-gray-400"
                      }`}
                    >
                      {isFav ? "★" : "☆"}
                    </span>
                  </div>

                  <div
                    className={`relative w-full rounded border p-2 text-left transition-all ${
                      isPlaying
                        ? isLive
                          ? "border-red-500 bg-red-100"
                          : "border-blue-500 bg-blue-100"
                        : isPlayed
                          ? "border-gray-300 bg-gray-100 opacity-70"
                          : canPlay
                            ? `border-gray-200 hover:bg-gray-100 ${timeSlotClass}`
                            : `border-gray-200`
                    } ${canPlay ? "text-gray-900" : "text-gray-500"} `}
                  >
                    <button
                      onClick={() => {
                        if (canPlay) {
                          RadikoClient.playProgram(program, "timefree")
                        }
                      }}
                      className="w-full text-left"
                      disabled={!canPlay || isPlaying}
                    >
                      <div className="flex items-center gap-2 pr-20">
                        {isPlaying && (
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold text-white ${
                              isLive ? "bg-red-500" : "bg-blue-500"
                            }`}
                          >
                            再生中
                          </span>
                        )}
                        <div
                          className={`text-sm ${
                            isPlaying ? (isLive ? "font-bold text-red-700" : "font-bold text-blue-700") : ""
                          }`}
                        >
                          {program.title}
                          {isPlayed && <span className="ml-2 text-xs text-gray-500">✓ 視聴済み</span>}
                        </div>
                      </div>
                      <div className={`text-sm ${canPlay ? "text-gray-600" : "text-gray-400"}`}>
                        {formatRadikoTime(program.startTime)} - {formatRadikoTime(program.endTime)}
                      </div>
                      {program.pfm && <div className="text-xs text-gray-500">{program.pfm}</div>}
                    </button>

                    {isPlaying && program.info && (
                      <div className="mt-2 border-t border-blue-200 pt-1">
                        <input type="checkbox" id={`accordion-${index}`} className="peer invisible absolute" />
                        <label
                          htmlFor={`accordion-${index}`}
                          className="flex cursor-pointer items-center justify-end text-blue-500 transition-all peer-checked:hidden hover:text-blue-600"
                        >
                          <svg
                            className="h-3 w-3"
                            viewBox="0 0 24 24"
                            strokeWidth="2"
                            stroke="currentColor"
                            fill="none"
                          >
                            <path d="M12 5l0 14" />
                            <path d="M5 12l14 0" />
                          </svg>
                          <span className="ml-1 text-[10px]">詳細を表示</span>
                        </label>

                        <label
                          htmlFor={`accordion-${index}`}
                          className="hidden cursor-pointer items-center justify-between border-b border-blue-100 py-1 text-blue-400 transition-all peer-checked:flex hover:text-blue-300"
                        >
                          <span className="text-[10px]">詳細を閉じる</span>
                          <svg
                            className="h-3 w-3"
                            viewBox="0 0 24 24"
                            strokeWidth="2"
                            stroke="currentColor"
                            fill="none"
                          >
                            <path d="M5 12l14 0" />
                          </svg>
                        </label>

                        <div className="max-h-0 overflow-hidden transition-all duration-300 peer-checked:max-h-60 peer-checked:overflow-y-auto">
                          <div
                            className="mt-1 text-xs break-all text-gray-700"
                            dangerouslySetInnerHTML={{
                              __html: sanitizeHtml(program.info),
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          ) : (
            <div className="py-4 text-center text-gray-500">{error || "番組情報がありません"}</div>
          )}
        </div>
      )}
    </div>
  )
}
