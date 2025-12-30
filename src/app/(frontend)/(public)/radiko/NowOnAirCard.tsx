"use client"

import React from "react"
import RadikoClient from "./client"
import { Program, formatRadikoTime, sanitizeHtml } from "./constants"

interface NowOnAirCardProps {
  nowOnAir: Program | null
  selectedStation: string
}

export const NowOnAirCard: React.FC<NowOnAirCardProps> = ({ nowOnAir, selectedStation }) => {
  if (!nowOnAir) return null

  const isLivePlaying = nowOnAir ? RadikoClient.isProgramPlaying(nowOnAir, "live") : false

  const handlePlayToggle = () => {
    if (isLivePlaying) {
      RadikoClient.stopPlayback()
    } else if (nowOnAir) {
      RadikoClient.playProgram(nowOnAir, "live")
    }
  }

  return (
    <div className="mt-2 space-y-2">
      {/* Now On Air */}
      {nowOnAir && (
        <div className="relative grid rounded bg-gray-100 p-2 shadow-lg">
          <div className="md:row-start-2 md:pt-2">
            <div className="flex items-center">
              {nowOnAir.info && nowOnAir.info.includes("<img") && (
                <div className="mr-2 h-16 w-16 shrink-0 overflow-hidden">
                  <div
                    className="h-full w-full bg-contain bg-center bg-no-repeat"
                    style={{
                      backgroundImage: `url(${nowOnAir.info.match(/src="([^"]+)"/)?.[1] || ""})`,
                    }}
                  />
                </div>
              )}

              <div className="grow">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-red-500">● ON AIR</span>
                  <div className="text-sm text-gray-600">
                    {formatRadikoTime(nowOnAir.startTime)} - {formatRadikoTime(nowOnAir.endTime)}
                  </div>
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

            {nowOnAir.info && (
              <div className="mt-2">
                <input type="checkbox" id="accordion" className="peer invisible absolute" />
                <label
                  htmlFor="accordion"
                  className="flex cursor-pointer items-center justify-end pb-1 transition-all peer-checked:hidden hover:text-slate-500 md:py-1"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M12 5l0 14" />
                    <path d="M5 12l14 0" />
                  </svg>
                  <span className="ml-1 text-xs">詳細情報</span>
                </label>

                <label
                  htmlFor="accordion"
                  className="hidden cursor-pointer items-center justify-between border-b bg-white py-1 text-red-400 transition-all peer-checked:flex hover:text-red-300"
                >
                  <span className="pl-4 text-xs"> 詳細情報 </span>
                  <div className="flex items-center pr-4">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none">
                      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                      <path d="M5 12l14 0" />
                    </svg>
                  </div>
                </label>

                <div className="max-h-0 overflow-hidden bg-white px-2 transition-all duration-300 peer-checked:max-h-96 peer-checked:overflow-y-auto">
                  <div
                    className="mt-2 text-sm break-all text-gray-600"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeHtml(nowOnAir.info),
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {selectedStation && (
            <button
              onClick={handlePlayToggle}
              className={`rounded px-4 py-2 shadow-md transition-all md:row-start-1 ${
                isLivePlaying ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"
              } font-semibold text-white`}
            >
              {isLivePlaying ? "停止" : "リアルタイム再生"}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
