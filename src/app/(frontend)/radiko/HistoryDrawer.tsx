import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Program, formatRadikoTime, formatDisplayDate, Station } from './constants';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onPlayFromHistory: (program: Program) => void;
  stations: Station[];
  getSavedPlaybackPrograms: () => Program[];
  playbackProgramsKey: string;
}

const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  onPlayFromHistory,
  stations,
  getSavedPlaybackPrograms,
  playbackProgramsKey
}) => {
  // 履歴更新のトリガー用state
  const [historyUpdateTrigger, setHistoryUpdateTrigger] = useState<number>(0);

  // ドロワーが開かれたときにデータを再読み込み
  useEffect(() => {
    if (isOpen) {
      // 画面を更新するためのトリガーをインクリメント
      setHistoryUpdateTrigger(prev => prev + 1);
    }
  }, [isOpen]);

  // 履歴を削除する関数
  const removeFromHistory = useCallback((event: React.MouseEvent, program: Program) => {
    event.stopPropagation(); // クリックイベントの伝播を停止
    
    try {
      const savedPrograms = getSavedPlaybackPrograms();
      const updatedPrograms = savedPrograms.filter(
        p => !(p.station_id === program.station_id && p.startTime === program.startTime)
      );
      
      localStorage.setItem(playbackProgramsKey, JSON.stringify(updatedPrograms));
      
      // 画面を更新するためのトリガー
      setHistoryUpdateTrigger(prev => prev + 1);
    } catch (error) {
      console.error("Failed to remove program from history:", error);
    }
  }, [getSavedPlaybackPrograms, playbackProgramsKey]);

  // 番組の時間（秒数）を計算する関数
  const calculateDuration = useCallback((startTime: string, endTime: string): number => {
    const startDate = new Date(
      parseInt(startTime.substring(0, 4)),
      parseInt(startTime.substring(4, 6)) - 1,
      parseInt(startTime.substring(6, 8)),
      parseInt(startTime.substring(8, 10)),
      parseInt(startTime.substring(10, 12))
    );

    const endDate = new Date(
      parseInt(endTime.substring(0, 4)),
      parseInt(endTime.substring(4, 6)) - 1,
      parseInt(endTime.substring(6, 8)),
      parseInt(endTime.substring(8, 10)),
      parseInt(endTime.substring(10, 12))
    );
    
    // 秒単位の差分を返す
    return (endDate.getTime() - startDate.getTime()) / 1000;
  }, []);

  // 視聴履歴データを取得・整理するためのメモ化されたデータ
  const historyData = useMemo(() => {
    // ドロワーが開かれているときだけデータを取得することでパフォーマンスを最適化
    if (!isOpen) {
      return { byDate: {}, sortedDates: [], total: 0, played: 0, future: 0 };
    }

    const allPrograms = getSavedPlaybackPrograms();
    const now = new Date(); // 現在日時
    
    // 放送局情報をマッピング
    const programsWithStationInfo = allPrograms.map(program => {
      const station = stations.find(s => s.id === program.station_id);
      
      // 終了時刻を日付オブジェクトに変換
      const endTime = new Date(
        parseInt(program.endTime.substring(0, 4)),
        parseInt(program.endTime.substring(4, 6)) - 1,
        parseInt(program.endTime.substring(6, 8)),
        parseInt(program.endTime.substring(8, 10)),
        parseInt(program.endTime.substring(10, 12))
      );
      
      // 番組の総再生時間（秒）
      const duration = calculateDuration(program.startTime, program.endTime);
      
      return {
        ...program,
        stationName: station?.name || program.station_id,
        stationBanner: station?.banner || '',
        isPlayed: program.currentTime === -1,
        isFuture: endTime > now, // 終了時刻が現在より未来かどうか
        duration: duration // 番組の総再生時間を秒単位で保持
      };
    });
    
    // 日付ごとにグループ化
    const byDate = programsWithStationInfo.reduce((acc: {[date: string]: any[]}, program) => {
      // 番組の日付を取得
      const dateKey = formatDisplayDate(program.startTime);
      
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      
      acc[dateKey].push(program);
      return acc;
    }, {});
    
    // 日付ごとのグループを日付の古い順にソート（昇順）
    const sortedDates = Object.keys(byDate).sort();
    
    // 各日付内で開始時間順にソート（古い順）
    for (const date of sortedDates) {
      byDate[date].sort((a, b) => parseInt(a.startTime) - parseInt(b.startTime));
    }
    
    return { 
      byDate,
      sortedDates,
      total: programsWithStationInfo.length,
      played: programsWithStationInfo.filter(p => p.isPlayed).length,
      future: programsWithStationInfo.filter(p => p.isFuture).length
    };
  }, [isOpen, getSavedPlaybackPrograms, stations, historyUpdateTrigger, calculateDuration]);

  return (
    <div className={`fixed inset-0 z-40 ${isOpen ? 'visible' : 'invisible'}`}>
      {/* オーバーレイ */}
      <div 
        className={`absolute inset-0 bg-black transition-opacity duration-300 ${isOpen ? 'opacity-50' : 'opacity-0'}`}
        onClick={onClose}
      />
      
      {/* ドロワー本体 */}
      <div 
        className={`absolute top-0 right-0 bottom-0 w-full sm:w-96 bg-white shadow-xl transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } flex flex-col`}
      >
        {/* ヘッダー - 削除ボタン */}
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h3 className="text-lg font-medium">視聴履歴 ({historyData.total}件)</h3>
          <button
            onClick={() => {
              if (window.confirm('すべての視聴履歴を削除しますか？')) {
                localStorage.removeItem(playbackProgramsKey);
                setHistoryUpdateTrigger(prev => prev + 1);
              }
            }}
            className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
          >
            履歴を削除
          </button>
        </div>
        
        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-4">
          {historyData.total === 0 ? (
            <p className="text-gray-500 text-center py-8">視聴履歴がありません</p>
          ) : (
            historyData.sortedDates.map(date => (
              <div key={date} className="mb-6">
                <h4 className="text-sm font-semibold text-gray-600 mb-2 sticky top-0 bg-white py-1">{date}</h4>
                <div className="space-y-2">
                  {historyData.byDate[date].map((program, idx) => (
                    <div
                      key={`${program.station_id}-${program.startTime}-${idx}`}
                      onClick={() => program.isFuture ? null : onPlayFromHistory(program)}
                      className={`p-3 rounded-lg border relative
                        ${program.isFuture 
                          ? 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-60 grayscale' 
                          : program.isPlayed 
                            ? 'bg-gray-50 border-gray-200 cursor-pointer' 
                            : 'bg-blue-50/70 border-blue-200 cursor-pointer'}`}
                    >
                      <div className="flex items-start">
                        {/* 放送局ロゴ（あれば表示） */}
                        {program.stationBanner && (
                          <div className="flex-shrink-0 mr-2 w-10">
                            <img 
                              src={program.stationBanner} 
                              alt={program.stationName} 
                              className="w-full"
                            />
                          </div>
                        )}
                        
                        <div className="flex-grow pr-6">
                          <div className="text-sm font-medium">
                            {program.title}
                            {program.isPlayed && (
                              <span className="ml-1 text-xs text-gray-500">✓</span>
                            )}
                            {program.isFuture && (
                              <span className="ml-1 text-xs text-gray-500">未放送</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-600 flex justify-between">
                            <span>{formatRadikoTime(program.startTime)} - {formatRadikoTime(program.endTime)}</span>
                            <span>{program.stationName}</span>
                          </div>
                          
                          {/* 再生位置表示（視聴済み以外かつ未来ではない） */}
                          {!program.isPlayed && !program.isFuture && program.currentTime > 0 && (
                            <div className="mt-1">
                              <div className="h-1 w-full bg-gray-200 rounded-full">
                                <div 
                                  className="h-1 bg-blue-500 rounded-full" 
                                  style={{
                                    width: `${Math.min(
                                      (program.currentTime / program.duration) * 100, 
                                      100
                                    )}%`
                                  }}
                                />
                              </div>
                              <div className="text-xs text-gray-500 text-right mt-0.5">
                                {Math.floor(program.currentTime / 60)}分 / {Math.floor(program.duration / 60)}分
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* 削除ボタン */}
                      <button
                        onClick={(e) => removeFromHistory(e, program)}
                        className="absolute top-2 right-2 text-gray-400 hover:text-red-500 p-1"
                        title="履歴から削除"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* フッター - 閉じるボタン */}
        <div className="p-4 border-t bg-gray-50">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-sm text-gray-600">
                視聴済み: {historyData.played}件 / 未視聴: {historyData.total - historyData.played - historyData.future}件
                {historyData.future > 0 && ` / 未放送: ${historyData.future}件`}
              </span>
            </div>
            <button 
              onClick={onClose} 
              className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryDrawer;