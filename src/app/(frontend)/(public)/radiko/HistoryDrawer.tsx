import React, { useCallback, useMemo } from "react"
import RadikoClient, { useRadikoState } from "./client"
import { formatDisplayDate, formatRadikoTime, Program } from "./constants"

const HistoryDrawer: React.FC<{
  isOpen: boolean
  onClose: () => void
}> = ({ isOpen, onClose }) => {
  const state = useRadikoState()

  const handlePlayProgram = (program: Program) => {
    RadikoClient.playProgram(program, "timefree")
    onClose()
  }

  const removeFromHistory = useCallback((event: React.MouseEvent, program: Program) => {
    event.stopPropagation()
    RadikoClient.removeFromHistory(program.station_id, program.startTime)
  }, [])

  const historyData = useMemo(() => {
    if (!isOpen || typeof window === "undefined") {
      return { byDate: {}, sortedDates: [], total: 0, played: 0 }
    }

    const allPrograms = state.history
    const byDate: { [date: string]: Program[] } = {}

    allPrograms.forEach((program) => {
      const dateKey = program.startTime.substring(0, 8)
      if (!byDate[dateKey]) byDate[dateKey] = []
      byDate[dateKey].push(program)
    })

    const sortedDates = Object.keys(byDate).sort((a, b) => parseInt(b) - parseInt(a))
    sortedDates.forEach((date) => {
      byDate[date].sort((a, b) => parseInt(b.startTime) - parseInt(a.startTime))
    })

    const played = allPrograms.filter((p) => p.currentTime === -1).length

    return {
      byDate,
      sortedDates,
      total: allPrograms.length,
      played,
    }
  }, [isOpen, state.history])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end overflow-hidden">
      <div className="absolute inset-0 bg-black/50 transition-opacity" onClick={onClose} />

      <div className="relative w-full max-w-md bg-white shadow-xl transition-transform">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="text-xl font-bold">視聴履歴</h2>
            <button onClick={onClose} className="rounded-full p-2 hover:bg-gray-100">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-4 flex gap-4 text-sm text-gray-600">
              <div>全 {historyData.total} 番組</div>
              <div>視聴済み {historyData.played} 番組</div>
            </div>

            {historyData.sortedDates.length === 0 ? (
              <div className="py-8 text-center text-gray-500">履歴がありません</div>
            ) : (
              historyData.sortedDates.map((date) => (
                <div key={date} className="mb-6">
                  <h3 className="mb-2 border-b pb-1 font-semibold text-gray-700">
                    {formatDisplayDate(date + "000000")}
                  </h3>
                  <div className="space-y-2">
                    {historyData.byDate[date].map((program) => {
                      const station = state.stations.find((s) => s.id === program.station_id)
                      const isPlayed = program.currentTime === -1
                      const isFav = state.favorites.some((fav) => fav.title === program.title)
                      const isCurrentPlaying =
                        state.currentProgram?.station_id === program.station_id &&
                        state.currentProgram?.startTime === program.startTime

                      return (
                        <div
                          key={`${program.station_id}-${program.startTime}`}
                          onClick={() => handlePlayProgram(program)}
                          className={`group relative cursor-pointer rounded border p-3 transition-all hover:bg-gray-50 ${
                            isCurrentPlaying ? "border-blue-500 bg-blue-50/50" : ""
                          } ${isPlayed ? "opacity-60" : ""}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 pr-16">
                              <div className="flex items-center gap-2">
                                <div className="text-xs text-gray-500">
                                  {station?.name || program.station_id} | {formatRadikoTime(program.startTime)} -{" "}
                                  {formatRadikoTime(program.endTime)}
                                </div>
                                {isCurrentPlaying && (
                                  <span className="animate-pulse rounded bg-blue-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                    再生中
                                  </span>
                                )}
                              </div>
                              <div className="font-medium">{program.title}</div>
                              {program.currentTime !== undefined && program.currentTime > 0 && (
                                <div className="mt-1 h-1 w-full rounded-full bg-gray-200">
                                  <div
                                    className="h-full rounded-full bg-blue-500"
                                    style={{
                                      width: `${Math.min(100, (program.currentTime / 7200) * 100)}%`,
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                            <div className="absolute top-2 right-2 flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  RadikoClient.toggleFavorite(program)
                                }}
                                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-gray-100 ${
                                  isFav ? "text-yellow-500" : "text-gray-300 hover:text-gray-400"
                                }`}
                                title={isFav ? "お気に入り解除" : "お気に入り登録"}
                              >
                                <span className="text-lg leading-none">{isFav ? "★" : "☆"}</span>
                              </button>
                              <button
                                onClick={(e) => removeFromHistory(e, program)}
                                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                                title="履歴から削除"
                              >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default HistoryDrawer
