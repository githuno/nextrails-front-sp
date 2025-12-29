"use client"

// TODO: 再生速度の復元
import { useCallback, useEffect, useRef, useState } from "react"
import ChannelFavoriteButton from "./ChannelFavoriteButton"
import ChannelFavoriteDrawer from "./ChannelFavoriteDrawer"
import FavoriteButton from "./FavoriteButton"
import FavoriteDrawer from "./FavoriteDrawer"
import HistoryButton from "./HistoryButton"
import HistoryDrawer from "./HistoryDrawer"
import Search from "./Search"
import SpeedController from "./SpeedController"
import youtubeClient from "./client"
import { formatDuration, HistoryItem, SearchItem, VideoDetail } from "./constants"

// 再生速度保存用のキー
const YT_SPEED_KEY = "youtube_playback_speed"

export default function YoutubePage() {
  // 状態管理
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedVideo, setSelectedVideo] = useState<SearchItem | null>(null)
  const [videoDetails, setVideoDetails] = useState<VideoDetail | null>(null)
  const [isFavorite, setIsFavorite] = useState<boolean>(false)
  const [isChannelFavorite, setIsChannelFavorite] = useState<boolean>(false)
  // ドロワーの状態
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState<boolean>(false)
  const [isFavoriteDrawerOpen, setIsFavoriteDrawerOpen] = useState<boolean>(false)
  const [isChannelFavoriteDrawerOpen, setIsChannelFavoriteDrawerOpen] = useState<boolean>(false)

  // 再生速度の状態
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0)

  // YouTube Player APIのための参照
  const playerRef = useRef<YT.Player | null>(null)
  const playerContainerRef = useRef<HTMLDivElement>(null)

  // YouTube API読み込みフラグ
  const [isYouTubeApiReady, setIsYouTubeApiReady] = useState<boolean>(false)

  // YouTube APIの読み込み
  useEffect(() => {
    if (!window.YT) {
      // グローバルコールバック関数を定義
      ;(window as any).onYouTubeIframeAPIReady = () => {
        setIsYouTubeApiReady(true)
      }

      // スクリプトタグを作成してYouTube IFrame APIを読み込む
      const tag = document.createElement("script")
      tag.src = "https://www.youtube.com/iframe_api"
      const firstScriptTag = document.getElementsByTagName("script")[0]
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)
    } else {
      setIsYouTubeApiReady(true)
    }

    // クリーンアップ関数
    return () => {
      if (playerRef.current) {
        playerRef.current.destroy()
      }
    }
  }, [])

  // 再生速度変更時の処理
  const handleSpeedChange = useCallback((newSpeed: number) => {
    // まず状態を更新
    setPlaybackSpeed(newSpeed)

    // ローカルストレージに保存（この部分は常に行う）
    try {
      localStorage.setItem(YT_SPEED_KEY, newSpeed.toString())
      console.log(`再生速度を保存しました: ${newSpeed}x`)
    } catch (err) {
      console.error("再生速度の保存に失敗しました:", err)
    }

    // プレイヤーが存在し、かつ初期化済みの場合のみ速度変更を行う
    if (playerRef.current && typeof playerRef.current.setPlaybackRate === "function") {
      try {
        // 再生速度を変更
        playerRef.current.setPlaybackRate(newSpeed)
        console.log(`プレーヤーの再生速度を設定しました: ${newSpeed}x`)
      } catch (error) {
        console.error("再生速度の設定に失敗しました:", error)
      }
    } else {
      console.log("プレーヤーが準備できていないため、再生速度を設定できません")
    }
  }, [])

  // 再生位置保存用のタイマー参照
  const savePositionTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 再生位置を保存する関数
  const saveCurrentPosition = useCallback(() => {
    if (!playerRef.current || !selectedVideo) return

    try {
      const videoId = selectedVideo.id.videoId!
      const currentTime = playerRef.current.getCurrentTime()
      const duration = playerRef.current.getDuration()

      if (currentTime > 0 && duration > 0) {
        console.log(`再生位置を保存: ${currentTime}/${duration}秒`)

        // HistoryItemのcurrentTimeとdurationを更新
        const historyItem: HistoryItem = {
          videoId,
          title: selectedVideo.snippet.title,
          channelTitle: selectedVideo.snippet.channelTitle,
          thumbnailUrl:
            selectedVideo.snippet.thumbnails.medium?.url || selectedVideo.snippet.thumbnails.default?.url || "",
          watchedAt: Date.now(),
          currentTime,
          duration,
          channelId: selectedVideo.snippet.channelId, // チャンネルIDを追加
        }
        youtubeClient.addToHistory(historyItem)
      }
    } catch (error) {
      console.error("再生位置の保存に失敗しました:", error)
    }
  }, [selectedVideo])

  // 定期的に再生位置を保存するタイマーを設定
  useEffect(() => {
    // 動画が選択されているときのみ実行
    if (!selectedVideo || !selectedVideo.id.videoId) return

    // 5秒ごとに再生位置を保存
    savePositionTimerRef.current = setInterval(() => {
      saveCurrentPosition()
    }, 5000)

    return () => {
      // コンポーネントのクリーンアップ時にタイマーをクリア
      if (savePositionTimerRef.current) {
        clearInterval(savePositionTimerRef.current)

        // 最後の再生位置を保存
        saveCurrentPosition()
      }
    }
  }, [selectedVideo, saveCurrentPosition])

  // プレイヤーの初期化
  const initializePlayer = useCallback(
    (videoId: string) => {
      if (!isYouTubeApiReady || !playerContainerRef.current) return

      if (playerRef.current) {
        playerRef.current.loadVideoById(videoId)

        setTimeout(() => {
          if (playerRef.current) {
            // 履歴から再生位置を復元
            try {
              const history = youtubeClient.getHistory()
              const savedItem = history.find((item) => item.videoId === videoId)

              if (savedItem && savedItem.currentTime && savedItem.duration) {
                // 95%以上再生した動画は最初から再生
                if (savedItem.currentTime < savedItem.duration * 0.95) {
                  console.log(`再生位置を復元: ${savedItem.currentTime}秒`)
                  playerRef.current.seekTo(savedItem.currentTime, true)
                }
              }
            } catch (error) {
              console.error("再生位置の復元に失敗しました:", error)
            }
          }
        }, 1000) // 少し遅延を入れて確実に設定されるようにする
        return
      }

      playerRef.current = new window.YT.Player(playerContainerRef.current, {
        height: "100%",
        width: "100%",
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: (event) => {
            // 履歴から再生位置を復元
            try {
              const history = youtubeClient.getHistory()
              const savedItem = history.find((item) => item.videoId === videoId)

              if (savedItem && savedItem.currentTime && savedItem.duration) {
                // 95%以上再生した動画は最初から再生
                if (savedItem.currentTime < savedItem.duration * 0.95) {
                  console.log(`再生位置を復元: ${savedItem.currentTime}秒`)
                  event.target.seekTo(savedItem.currentTime, true)
                }
              }
            } catch (error) {
              console.error("再生位置の復元に失敗しました:", error)
            }
          },
          onStateChange: (event: YT.OnStateChangeEvent) => {
            // プレーヤーの状態変更時（再生、一時停止、バッファリング、終了など）
            if (event.data === YT.PlayerState.PAUSED) {
              // 一時停止時に再生位置を保存
              saveCurrentPosition()
            }
            // 動画再生開始時に履歴に追加
            if (event.data === window.YT.PlayerState.PLAYING && selectedVideo) {
              const historyItem: HistoryItem = {
                videoId: selectedVideo.id.videoId!,
                title: selectedVideo.snippet.title,
                channelTitle: selectedVideo.snippet.channelTitle,
                thumbnailUrl:
                  selectedVideo.snippet.thumbnails.medium?.url || selectedVideo.snippet.thumbnails.default?.url || "",
                watchedAt: Date.now(),
                channelId: selectedVideo.snippet.channelId, // チャンネルIDを追加
              }
              youtubeClient.addToHistory(historyItem)
            }
          },
          // 再生レート変更時
          onPlaybackRateChange: () => {
            // 再生速度変更時に再生位置を保存
            saveCurrentPosition()
          },
        },
      })
    },
    [isYouTubeApiReady, selectedVideo],
  )

  // 動画選択時の処理
  const handleVideoSelect = useCallback((video: SearchItem) => {
    setSelectedVideo(video)
    // 履歴に追加
    const historyItem: HistoryItem = {
      videoId: video.id.videoId!,
      title: video.snippet.title,
      channelTitle: video.snippet.channelTitle,
      channelId: video.snippet.channelId,
      thumbnailUrl: video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url || "",
      watchedAt: Date.now(),
    }
    youtubeClient.addToHistory(historyItem)
    // エラーをリセット
    setError(null)

    // 動画詳細情報を取得
    const fetchVideoDetails = async () => {
      setIsLoading(true)

      try {
        const details = await youtubeClient.getVideoDetails([video.id.videoId!])
        if (details.length > 0) {
          setVideoDetails(details[0])

          // お気に入り状態を確認
          const isFav = youtubeClient.isFavorite(video.id.videoId!)
          setIsFavorite(isFav)

          // チャンネルのお気に入り状態を確認
          const isChannelFav = youtubeClient.isFavoriteChannel(video.snippet.channelId)
          setIsChannelFavorite(isChannelFav)
        }
      } catch (err) {
        console.error("動画詳細の取得に失敗しました:", err)
        setError("動画情報の取得に失敗しました。")
      } finally {
        setIsLoading(false)
      }
    }

    fetchVideoDetails()
  }, [])

  // 動画IDから再生する処理（履歴からの再生用）
  const playVideoFromId = useCallback(async (videoId: string) => {
    setIsLoading(true)
    setError(null)

    try {
      // 動画詳細情報を取得
      const details = await youtubeClient.getVideoDetails([videoId])

      if (details.length > 0) {
        const detail = details[0]
        setVideoDetails(detail)

        // SearchItem形式に変換して設定
        const video: SearchItem = {
          id: {
            kind: "youtube#video",
            videoId: videoId,
          },
          snippet: {
            publishedAt: detail.snippet.publishedAt,
            channelId: detail.snippet.channelId,
            title: detail.snippet.title,
            description: detail.snippet.description,
            thumbnails: detail.snippet.thumbnails,
            channelTitle: detail.snippet.channelTitle,
            liveBroadcastContent: "",
          },
        }

        setSelectedVideo(video)

        // お気に入り状態を確認
        const isFav = youtubeClient.isFavorite(videoId)
        setIsFavorite(isFav)
      } else {
        setError("動画が見つかりませんでした。")
      }
    } catch (err) {
      console.error("動画詳細の取得に失敗しました:", err)
      setError("動画情報の取得に失敗しました。")
    } finally {
      setIsLoading(false)
    }
  }, [])

  // お気に入り切り替え
  const toggleFavorite = useCallback(() => {
    if (!selectedVideo) return

    const videoId = selectedVideo.id.videoId!
    const newFavoriteStatus = youtubeClient.toggleFavorite(videoId)
    setIsFavorite(newFavoriteStatus)
  }, [selectedVideo])

  // チャンネルのお気に入り切り替え
  const toggleChannelFavorite = useCallback(() => {
    if (!selectedVideo) return

    const channelId = selectedVideo.snippet.channelId
    const newFavoriteStatus = youtubeClient.toggleFavoriteChannel(channelId)
    setIsChannelFavorite(newFavoriteStatus)
  }, [selectedVideo])

  // プレイヤーの初期化
  useEffect(() => {
    if (selectedVideo && selectedVideo.id.videoId) {
      initializePlayer(selectedVideo.id.videoId)
      handleSpeedChange(1.0) // 初期速度を1.0に設定 ※この時点ではplayerRefはnullのため保存された速度を渡しても適用されない
    }
  }, [selectedVideo, initializePlayer, isYouTubeApiReady])

  // 履歴ドロワーの開閉
  const toggleHistoryDrawer = useCallback(() => {
    setIsHistoryDrawerOpen((prev) => !prev)
  }, [])
  // お気に入りドロワーの開閉
  const toggleFavoriteDrawer = useCallback(() => {
    setIsFavoriteDrawerOpen((prev) => !prev)
  }, [])
  // チャンネルお気に入りドロワーの開閉
  const toggleChannelFavoriteDrawer = useCallback(() => {
    setIsChannelFavoriteDrawerOpen((prev) => !prev)
  }, [])

  // クライアントサイドのみでレンダリング
  const [isClient, setIsClient] = useState(false)
  useEffect(() => {
    setIsClient(true)
  }, [])
  if (!isClient) return null

  return (
    <div className="container mx-auto px-2 pb-32 sm:px-4">
      <h1 className="my-2 text-xl font-bold sm:my-4 sm:text-2xl">YouTube Player</h1>

      {/* 動画プレイヤーと詳細情報 */}
      {selectedVideo ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
            {/* プレイヤーエリア - 大画面で2/3を占める */}
            <div className="space-y-3 sm:space-y-4 lg:col-span-2">
              {/* プレイヤーコンテナ */}
              <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                <div ref={playerContainerRef} className="absolute inset-0"></div>
              </div>

              {/* 動画情報 */}
              <div>
                <div className="flex items-start justify-between">
                  <h2 className="text-lg font-semibold sm:text-xl">{selectedVideo.snippet.title}</h2>
                  <button onClick={toggleFavorite} className="ml-2 flex-shrink-0 text-yellow-500 hover:text-yellow-600">
                    {isFavorite ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 sm:h-6 sm:w-6"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 sm:h-6 sm:w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                        />
                      </svg>
                    )}
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between text-gray-600">
                  <div className="flex items-center">
                    <span className="mr-2 text-sm">{selectedVideo.snippet.channelTitle}</span>
                    {/* チャンネルお気に入りボタン */}
                    <button
                      onClick={toggleChannelFavorite}
                      className="text-red-500 hover:text-red-600"
                      title={isChannelFavorite ? "チャンネルのお気に入りを解除" : "チャンネルをお気に入りに追加"}
                    >
                      {isChannelFavorite ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                  {videoDetails && (
                    <span className="text-sm">
                      {parseInt(videoDetails.statistics.viewCount).toLocaleString()}
                      回視聴
                    </span>
                  )}
                </div>

                {videoDetails && (
                  <div className="mt-3 sm:mt-4">
                    <div className="text-xs text-gray-600 sm:text-sm">
                      <div className="mb-2 flex flex-wrap gap-y-1">
                        <span className="mr-4">再生時間: {formatDuration(videoDetails.contentDetails.duration)}</span>
                        <span>投稿日: {new Date(videoDetails.snippet.publishedAt).toLocaleDateString()}</span>
                      </div>
                      {videoDetails.statistics.likeCount && (
                        <span className="flex items-center">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="mr-1 h-3 w-3 sm:h-4 sm:w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
                            />
                          </svg>
                          {parseInt(videoDetails.statistics.likeCount).toLocaleString()}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 rounded-lg bg-gray-50 p-3 sm:mt-4 sm:p-4">
                      <h3 className="mb-1 text-sm font-medium sm:mb-2 sm:text-base">説明</h3>
                      <p className="max-h-40 overflow-y-auto text-xs whitespace-pre-line sm:max-h-48 sm:text-sm">
                        {selectedVideo.snippet.description}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 検索エリア - 大画面で1/3を占める */}
            <div className="space-y-4 sm:space-y-6">
              <Search onVideoSelect={handleVideoSelect} />
            </div>
          </div>
        </>
      ) : (
        // 検索画面時のレイアウト - 修正版
        <div className="mx-auto w-full max-w-3xl">
          {/* エラー表示 */}
          {error && <div className="mb-4 rounded bg-red-100 p-3 text-sm text-red-700">{error}</div>}

          {/* 検索フォームは常に表示 */}
          <div className={`w-full ${!isLoading && !error ? "mt-20 mb-10" : ""}`}>
            <Search onVideoSelect={handleVideoSelect} />
          </div>
        </div>
      )}

      {/* ナビゲーションコントロール */}
      {selectedVideo && (
        <SpeedController player={playerRef.current} currentSpeed={playbackSpeed} onChange={handleSpeedChange} />
      )}

      {/* 履歴ボタンとドロワー */}
      <HistoryButton onClick={toggleHistoryDrawer} />
      <HistoryDrawer isOpen={isHistoryDrawerOpen} onClose={toggleHistoryDrawer} onVideoSelect={playVideoFromId} />
      {/* お気に入りボタンとドロワー */}
      <FavoriteButton onClick={toggleFavoriteDrawer} />
      <FavoriteDrawer isOpen={isFavoriteDrawerOpen} onClose={toggleFavoriteDrawer} onVideoSelect={playVideoFromId} />
      {/* チャンネルお気に入りボタンとドロワー */}
      <ChannelFavoriteButton onClick={toggleChannelFavoriteDrawer} />
      <ChannelFavoriteDrawer
        isOpen={isChannelFavoriteDrawerOpen}
        onClose={toggleChannelFavoriteDrawer}
        onVideoSelect={playVideoFromId}
      />
    </div>
  )
}
