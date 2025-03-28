"use client";

import React, { useState, useEffect } from 'react';

interface SpeedControllerProps {
  player: YT.Player | null;
  onChange?: (speed: number) => void;
  currentSpeed: number;
}

const SpeedController: React.FC<SpeedControllerProps> = ({ player, onChange, currentSpeed }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [displayValue, setDisplayValue] = useState(currentSpeed.toFixed(1));

  // 現在の速度を表示値に反映
  useEffect(() => {
    setDisplayValue(currentSpeed.toFixed(1));
  }, [currentSpeed]);

  const handleSpeedChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newSpeed = parseFloat(event.target.value);
    
    if (player) {
      player.setPlaybackRate(newSpeed);
    }
    
    setDisplayValue(newSpeed.toFixed(1));
    
    if (onChange) {
      onChange(newSpeed);
    }
  };

  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  return (
    <>
      {/* スピードコントローラーボタン */}
      <button
        onClick={toggleVisibility}
        className="fixed bottom-20 left-4 z-30 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 shadow-lg flex items-center justify-center"
        aria-label="再生速度"
      >
        <span className="text-sm font-semibold">{currentSpeed.toFixed(1)}x</span>
      </button>

      {/* スピードコントローラーパネル */}
      {isVisible && (
        <div className="fixed bottom-40 left-0 right-0 z-30 px-4 pb-4">
          <div className="bg-white rounded-lg shadow-lg p-4 mx-auto max-w-md border border-gray-200">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-medium">再生速度: {displayValue}x</h3>
              <button
                onClick={toggleVisibility}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
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
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <span className="ml-2 text-xs">3.0x</span>
            </div>
            
            <div className="mt-3 grid grid-cols-5 gap-2">
              {[0.5, 1.0, 1.5, 2.0, 3.0].map(speed => (
                <button
                  key={speed}
                  onClick={() => {
                    if (onChange) onChange(speed);
                    if (player) player.setPlaybackRate(speed);
                  }}
                  className={`text-xs py-1 rounded ${
                    Math.abs(currentSpeed - speed) < 0.05 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {speed === 1.0 ? '標準' : `${speed}x`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SpeedController;