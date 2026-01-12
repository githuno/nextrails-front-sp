"use client"

import React, { useEffect, useState } from "react"
import type { YTPlayer } from "./constants"

interface SpeedControllerProps {
  player: YTPlayer | null
  onChange?: (speed: number) => void
  currentSpeed: number
}

const SpeedController: React.FC<SpeedControllerProps> = ({ player, onChange, currentSpeed }) => {
  const [isVisible, setIsVisible] = useState(false)
  const [displayValue, setDisplayValue] = useState(currentSpeed.toFixed(1))

  // 現在の速度を表示値に反映
  useEffect(() => {
    setDisplayValue(currentSpeed.toFixed(1))
  }, [currentSpeed])

  const handleSpeedChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newSpeed = parseFloat(event.target.value)

    if (player) {
      player.setPlaybackRate(newSpeed)
    }

    setDisplayValue(newSpeed.toFixed(1))

    if (onChange) {
      onChange(newSpeed)
    }
  }

  const toggleVisibility = () => {
    setIsVisible(!isVisible)
  }

  return (
    <>
      {/* スピードコントローラーボタン */}
      <button
        onClick={toggleVisibility}
        className="fixed bottom-20 left-4 z-30 flex items-center justify-center rounded-full bg-blue-600 p-3 text-white shadow-lg hover:bg-blue-700"
        aria-label="再生速度"
      >
        <span className="text-sm font-semibold">{currentSpeed.toFixed(1)}x</span>
      </button>

      {/* スピードコントローラーパネル */}
      {isVisible && (
        <div className="fixed right-0 bottom-40 left-0 z-30 px-4 pb-4">
          <div className="mx-auto max-w-md rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium">再生速度: {displayValue}x</h3>
              <button onClick={toggleVisibility} className="text-gray-500 hover:text-gray-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            <div className="flex items-center">
              <span className="mr-2 text-xs">0.5x</span>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.1"
                value={currentSpeed}
                onChange={handleSpeedChange}
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-blue-600"
              />
              <span className="ml-2 text-xs">3.0x</span>
            </div>

            <div className="mt-3 grid grid-cols-5 gap-2">
              {[0.5, 1.0, 1.5, 2.0, 3.0].map((speed) => (
                <button
                  key={speed}
                  onClick={() => {
                    // 再生速度を設定
                    if (player) {
                      player.setPlaybackRate(speed)
                    }

                    // 親コンポーネントに変更を通知
                    if (onChange) {
                      onChange(speed)
                    }
                  }}
                  className={`rounded py-1 text-xs ${
                    Math.abs(currentSpeed - speed) < 0.05
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {speed === 1.0 ? "標準" : `${speed}x`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default SpeedController
