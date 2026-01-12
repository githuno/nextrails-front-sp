"use client"

// TODO: 再生速度の復元
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react"
import ChannelFavoriteButton from "./ChannelFavoriteButton"
import ChannelFavoriteDrawer from "./ChannelFavoriteDrawer"
import FavoriteButton from "./FavoriteButton"
import FavoriteDrawer from "./FavoriteDrawer"
import HistoryButton from "./HistoryButton"
import HistoryDrawer from "./HistoryDrawer"
import PlaylistButton from "./PlaylistButton"
import PlaylistDrawer from "./PlaylistDrawer"
import Search from "./Search"
import SpeedController from "./SpeedController"
import youtubeClient from "./client"
import type { YTPlayer, YTPlayerConstructor, YTPlayerEvent, YTPlayerOnStateChangeEvent } from "./constants"
import { formatDuration, HistoryItem, PlaylistDetail, SearchItem, VideoDetail, YTPlayerState } from "./constants"

// YouTube APIの型安全なアクセサー（2026年スタイル）
type YTAPI = {
  Player: YTPlayerConstructor
  PlayerState: typeof YTPlayerState
}

const getYT = () => (globalThis as unknown as { YT?: YTAPI }).YT
const setYTReadyCallback = (fn: () => void) => {
  if (typeof window !== "undefined") {
    ;(window as unknown as { onYouTubeIframeAPIReady: () => void }).onYouTubeIframeAPIReady = fn
  }
}

// 再生速度保存用のキー
const YT_SPEED_KEY = "youtube_playback_speed"

// 状態の型定義
type AppState = {
  ui: {
    isLoading: boolean
    error: string | null
    drawers: {
      history: boolean
      favorite: boolean
      channelFavorite: boolean
      playlist: boolean
    }
    playlistModal: {
      isOpen: boolean
      playlist: PlaylistDetail | null
      videos: SearchItem[]
      loading: boolean
    }
  }
  video: {
    selected: SearchItem | null
    details: VideoDetail | null
    favorites: {
      video: boolean
      channel: boolean
      playlists: string[]
    }
  }
  playlists: {
    channel: {
      items: PlaylistDetail[]
      loading: boolean
      filter: string
    }
    video: {
      items: PlaylistDetail[]
      loading: boolean
    }
  }
  player: {
    speed: number
    isApiReady: boolean
    isReady: boolean
    pendingVideo: { videoId: string; startTime?: number } | null
  }
}

// アクションの型定義
type AppAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_SELECTED_VIDEO"; payload: SearchItem | null }
  | { type: "SET_VIDEO_DETAILS"; payload: VideoDetail | null }
  | { type: "SET_VIDEO_FAVORITE"; payload: boolean }
  | { type: "SET_CHANNEL_FAVORITE"; payload: boolean }
  | { type: "SET_CHANNEL_PLAYLISTS"; payload: PlaylistDetail[] }
  | { type: "SET_CHANNEL_PLAYLISTS_LOADING"; payload: boolean }
  | { type: "SET_CHANNEL_PLAYLIST_FILTER"; payload: string }
  | { type: "SET_VIDEO_PLAYLISTS"; payload: PlaylistDetail[] }
  | { type: "SET_VIDEO_PLAYLISTS_LOADING"; payload: boolean }
  | { type: "TOGGLE_DRAWER"; payload: keyof AppState["ui"]["drawers"] }
  | { type: "SET_PLAYBACK_SPEED"; payload: number }
  | { type: "SET_YOUTUBE_API_READY"; payload: boolean }
  | { type: "SET_PLAYER_READY"; payload: boolean }
  | { type: "OPEN_PLAYLIST_MODAL"; payload: PlaylistDetail }
  | { type: "CLOSE_PLAYLIST_MODAL" }
  | { type: "SET_PLAYLIST_MODAL_LOADING"; payload: boolean }
  | { type: "SET_PLAYLIST_MODAL_VIDEOS"; payload: SearchItem[] }
  | { type: "SET_PENDING_VIDEO"; payload: { videoId: string; startTime?: number } }
  | { type: "CLEAR_PENDING_VIDEO" }

// Reducer関数
const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, ui: { ...state.ui, isLoading: action.payload } }
    case "SET_ERROR":
      return { ...state, ui: { ...state.ui, error: action.payload } }
    case "SET_SELECTED_VIDEO":
      return { ...state, video: { ...state.video, selected: action.payload } }
    case "SET_VIDEO_DETAILS":
      return { ...state, video: { ...state.video, details: action.payload } }
    case "SET_VIDEO_FAVORITE":
      return { ...state, video: { ...state.video, favorites: { ...state.video.favorites, video: action.payload } } }
    case "SET_CHANNEL_FAVORITE":
      return { ...state, video: { ...state.video, favorites: { ...state.video.favorites, channel: action.payload } } }
    case "SET_CHANNEL_PLAYLISTS":
      return {
        ...state,
        playlists: { ...state.playlists, channel: { ...state.playlists.channel, items: action.payload } },
      }
    case "SET_CHANNEL_PLAYLISTS_LOADING":
      return {
        ...state,
        playlists: { ...state.playlists, channel: { ...state.playlists.channel, loading: action.payload } },
      }
    case "SET_CHANNEL_PLAYLIST_FILTER":
      return {
        ...state,
        playlists: { ...state.playlists, channel: { ...state.playlists.channel, filter: action.payload } },
      }
    case "SET_VIDEO_PLAYLISTS":
      return { ...state, playlists: { ...state.playlists, video: { ...state.playlists.video, items: action.payload } } }
    case "SET_VIDEO_PLAYLISTS_LOADING":
      return {
        ...state,
        playlists: { ...state.playlists, video: { ...state.playlists.video, loading: action.payload } },
      }
    case "TOGGLE_DRAWER":
      return {
        ...state,
        ui: { ...state.ui, drawers: { ...state.ui.drawers, [action.payload]: !state.ui.drawers[action.payload] } },
      }
    case "SET_PLAYBACK_SPEED":
      return { ...state, player: { ...state.player, speed: action.payload } }
    case "SET_YOUTUBE_API_READY":
      return { ...state, player: { ...state.player, isApiReady: action.payload } }
    case "SET_PLAYER_READY":
      return { ...state, player: { ...state.player, isReady: action.payload } }
    case "OPEN_PLAYLIST_MODAL":
      return {
        ...state,
        ui: {
          ...state.ui,
          playlistModal: {
            ...state.ui.playlistModal,
            isOpen: true,
            playlist: action.payload,
            videos: [],
            loading: true,
          },
        },
      }
    case "CLOSE_PLAYLIST_MODAL":
      return {
        ...state,
        ui: {
          ...state.ui,
          playlistModal: { ...state.ui.playlistModal, isOpen: false, playlist: null, videos: [], loading: false },
        },
      }
    case "SET_PLAYLIST_MODAL_LOADING":
      return {
        ...state,
        ui: { ...state.ui, playlistModal: { ...state.ui.playlistModal, loading: action.payload } },
      }
    case "SET_PLAYLIST_MODAL_VIDEOS":
      return {
        ...state,
        ui: { ...state.ui, playlistModal: { ...state.ui.playlistModal, videos: action.payload, loading: false } },
      }
    case "SET_PENDING_VIDEO":
      return { ...state, player: { ...state.player, pendingVideo: action.payload } }
    case "CLEAR_PENDING_VIDEO":
      return { ...state, player: { ...state.player, pendingVideo: null } }
    default:
      return state
  }
}

// 初期状態
const initialState: AppState = {
  ui: {
    isLoading: false,
    error: null,
    drawers: {
      history: false,
      favorite: false,
      channelFavorite: false,
      playlist: false,
    },
    playlistModal: {
      isOpen: false,
      playlist: null,
      videos: [],
      loading: false,
    },
  },
  video: {
    selected: null,
    details: null,
    favorites: {
      video: false,
      channel: false,
      playlists: [],
    },
  },
  playlists: {
    channel: {
      items: [],
      loading: false,
      filter: "",
    },
    video: {
      items: [],
      loading: false,
    },
  },
  player: {
    speed: 1.0,
    isApiReady: false,
    isReady: false,
    pendingVideo: null,
  },
}

export default function YoutubePage() {
  // useReducerで状態管理
  const [state, dispatch] = useReducer(appReducer, initialState)

  // 状態のエイリアス（読みやすさのため）
  const {
    ui: { isLoading, error, drawers, playlistModal },
    video: { selected: selectedVideo, details: videoDetails, favorites },
    playlists: { channel: channelPlaylistsState, video: videoPlaylistsState },
    player: { speed: playbackSpeed, isApiReady: isYouTubeApiReady, isReady: isPlayerReady, pendingVideo },
  } = state

  // ドロワー状態のエイリアス
  const {
    history: isHistoryDrawerOpen,
    favorite: isFavoriteDrawerOpen,
    channelFavorite: isChannelFavoriteDrawerOpen,
    playlist: isPlaylistDrawerOpen,
  } = drawers
  const { video: isFavorite, channel: isChannelFavorite } = favorites
  const {
    items: channelPlaylists,
    loading: isLoadingChannelPlaylists,
    filter: channelPlaylistFilter,
  } = channelPlaylistsState
  const { items: videoPlaylists, loading: isLoadingVideoPlaylists } = videoPlaylistsState

  // 外部イベント用の最新状態保持リファレンス
  const selectedVideoRef = useRef(selectedVideo)
  const isPlayerReadyRef = useRef(isPlayerReady)

  useEffect(() => {
    selectedVideoRef.current = selectedVideo
  }, [selectedVideo])

  useEffect(() => {
    isPlayerReadyRef.current = isPlayerReady
  }, [isPlayerReady])

  // 他の状態（useRef）
  const playerRef = useRef<YTPlayer | null>(null)
  const playerContainerRef = useRef<HTMLDivElement>(null)

  // Router
  const router = useRouter()

  // フィルタされたチャンネルプレイリスト
  const filteredChannelPlaylists = useMemo(() => {
    if (!channelPlaylistFilter.trim()) {
      return channelPlaylists
    }
    return channelPlaylists.filter((playlist) =>
      playlist.snippet.title.toLowerCase().includes(channelPlaylistFilter.toLowerCase()),
    )
  }, [channelPlaylists, channelPlaylistFilter])

  // youtubeClient の変更を監視して、現在表示中の動画のお気に入り状態などを同期する
  useEffect(() => {
    return youtubeClient.subscribe(() => {
      if (selectedVideo) {
        // お気に入り状態を更新
        const isFav = youtubeClient.isFavorite(selectedVideo.id.videoId!)
        dispatch({ type: "SET_VIDEO_FAVORITE", payload: isFav })

        // チャンネルのお気に入り状態を更新
        const isChannelFav = youtubeClient.isFavoriteChannel(selectedVideo.snippet.channelId)
        dispatch({ type: "SET_CHANNEL_FAVORITE", payload: isChannelFav })
      }
    })
  }, [selectedVideo])

  // ユーティリティ関数（先に宣言）
  const loadChannelPlaylists = useCallback(async (channelId: string) => {
    dispatch({ type: "SET_CHANNEL_PLAYLISTS_LOADING", payload: true })
    try {
      const { items } = await youtubeClient.getChannelPlaylists(channelId)
      dispatch({ type: "SET_CHANNEL_PLAYLISTS", payload: items || [] })
    } catch (err) {
      console.error("チャンネルプレイリストの取得に失敗しました:", err)
      dispatch({ type: "SET_CHANNEL_PLAYLISTS", payload: [] })
    } finally {
      dispatch({ type: "SET_CHANNEL_PLAYLISTS_LOADING", payload: false })
    }
  }, [])

  const loadVideoPlaylists = useCallback(async (videoId: string) => {
    dispatch({ type: "SET_VIDEO_PLAYLISTS_LOADING", payload: true })
    try {
      const playlists = await youtubeClient.findPlaylistsContainingVideo(videoId)
      dispatch({ type: "SET_VIDEO_PLAYLISTS", payload: playlists })
    } catch (err) {
      console.error("動画が属しているプレイリストの検索に失敗しました:", err)
      dispatch({ type: "SET_VIDEO_PLAYLISTS", payload: [] })
    } finally {
      dispatch({ type: "SET_VIDEO_PLAYLISTS_LOADING", payload: false })
    }
  }, [])

  // 再生位置を保存する関数
  const saveCurrentPosition = useCallback(() => {
    // refを使用して最新の状態を確認
    const currentVideo = selectedVideoRef.current
    if (!playerRef.current || !isPlayerReadyRef.current || !currentVideo) return
    if (typeof playerRef.current.getCurrentTime !== "function") return

    try {
      // プレーヤーが実際に再生している動画IDを取得
      const playerVideoData = playerRef.current.getVideoData?.()
      const playerVideoId = playerVideoData?.video_id
      const stateVideoId = currentVideo.id.videoId

      // IDが一致しない場合は保存しない（切り替え時の不整合防止）
      if (playerVideoId && stateVideoId && playerVideoId !== stateVideoId) {
        return
      }

      const videoId = stateVideoId!
      const currentTime = playerRef.current.getCurrentTime()
      const duration = playerRef.current.getDuration()

      if (currentTime >= 0 && duration > 0) {
        console.log(`再生位置を保存: ${currentTime}/${duration}秒`)

        // HistoryItemのcurrentTimeとdurationを更新
        const historyItem: HistoryItem = {
          videoId,
          title: currentVideo.snippet.title,
          channelTitle: currentVideo.snippet.channelTitle,
          thumbnailUrl:
            currentVideo.snippet.thumbnails.medium?.url || currentVideo.snippet.thumbnails.default?.url || "",
          watchedAt: Date.now(),
          currentTime,
          duration,
          channelId: currentVideo.snippet.channelId, // チャンネルIDを追加
        }
        youtubeClient.addToHistory(historyItem)
      }
    } catch (error) {
      console.error("再生位置の保存に失敗しました:", error)
    }
  }, [])

  // プレイヤーの初期化
  const initializePlayer = useCallback(
    (videoId: string, startTime?: number) => {
      if (!isYouTubeApiReady || !playerContainerRef.current) return
      if (playerRef.current && isPlayerReady) {
        // プレイヤーが準備済みの場合、動画をロード
        playerRef.current.loadVideoById(videoId)

        // 再生位置を設定
        setTimeout(() => {
          if (playerRef.current) {
            try {
              if (startTime !== undefined) {
                playerRef.current.seekTo(startTime, true)
              } else {
                // 履歴から復元
                const history = youtubeClient.getHistory()
                const savedItem = history.find((item) => item.videoId === videoId)
                if (savedItem && savedItem.currentTime && savedItem.duration) {
                  // 95%以上再生した動画は最初から再生
                  if (savedItem.currentTime < savedItem.duration * 0.95) {
                    playerRef.current.seekTo(savedItem.currentTime, true)
                  }
                }
              }
            } catch (error) {
              console.error("再生位置の設定に失敗しました:", error)
            }
          }
        }, 1000) // 少し遅延を入れて確実に設定されるようにする
        return
      }

      if (!playerRef.current) {
        const YT = getYT()
        if (!YT) return

        // 新しいプレイヤーを作成
        playerRef.current = new YT.Player(playerContainerRef.current, {
          height: "100%",
          width: "100%",
          videoId: videoId,
          playerVars: {
            autoplay: 1,
            modestbranding: 1,
            rel: 0,
          },
          events: {
            onReady: (event: YTPlayerEvent) => {
              dispatch({ type: "SET_PLAYER_READY", payload: true })

              // 再生位置を復元
              try {
                if (startTime !== undefined) {
                  event.target.seekTo(startTime, true)
                } else {
                  // 履歴から復元
                  const history = youtubeClient.getHistory()
                  const savedItem = history.find((item) => item.videoId === videoId)

                  if (savedItem && savedItem.currentTime && savedItem.duration) {
                    // 95%以上再生した動画は最初から再生
                    if (savedItem.currentTime < savedItem.duration * 0.95) {
                      event.target.seekTo(savedItem.currentTime, true)
                    }
                  }
                }
              } catch (error) {
                console.error("再生位置の復元に失敗しました:", error)
              }
            },
            onStateChange: (event: YTPlayerOnStateChangeEvent) => {
              // プレーヤーの状態変更時（再生、一時停止、バッファリング、終了など）
              if (event.data === YTPlayerState.PAUSED) {
                // 一時停止時に再生位置を保存
                saveCurrentPosition()
              }
              // 動画再生開始時に履歴に追加
              const currentVideo = selectedVideoRef.current
              const YT = getYT()
              if (YT && event.data === YT.PlayerState.PLAYING && currentVideo) {
                const historyItem: HistoryItem = {
                  videoId: currentVideo.id.videoId!,
                  title: currentVideo.snippet.title,
                  channelTitle: currentVideo.snippet.channelTitle,
                  thumbnailUrl:
                    currentVideo.snippet.thumbnails.medium?.url || currentVideo.snippet.thumbnails.default?.url || "",
                  watchedAt: Date.now(),
                  channelId: currentVideo.snippet.channelId, // チャンネルIDを追加
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
      }
    },
    [isYouTubeApiReady, isPlayerReady, saveCurrentPosition],
  )

  // 動画IDから再生する処理（先に宣言）
  const playVideoFromId = useCallback(
    async (videoId: string, startTime?: number) => {
      dispatch({ type: "SET_LOADING", payload: true })
      dispatch({ type: "SET_ERROR", payload: null })

      try {
        // 動画詳細情報を取得
        const details = await youtubeClient.getVideoDetails([videoId])

        if (details.length > 0) {
          const detail = details[0]
          dispatch({ type: "SET_VIDEO_DETAILS", payload: detail })

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

          dispatch({ type: "SET_SELECTED_VIDEO", payload: video })

          // お気に入り状態を確認
          const isFav = youtubeClient.isFavorite(videoId)
          dispatch({ type: "SET_VIDEO_FAVORITE", payload: isFav })

          // チャンネルのお気に入り状態を確認
          const isChannelFav = youtubeClient.isFavoriteChannel(detail.snippet.channelId)
          dispatch({ type: "SET_CHANNEL_FAVORITE", payload: isChannelFav })

          // チャンネルのプレイリストを取得
          loadChannelPlaylists(detail.snippet.channelId)

          // この動画が属しているプレイリストを検索
          loadVideoPlaylists(videoId)

          // 履歴に追加
          const existingItem = youtubeClient.getHistory().find((h) => h.videoId === videoId)
          youtubeClient.addToHistory({
            videoId,
            title: detail.snippet.title,
            channelTitle: detail.snippet.channelTitle,
            channelId: detail.snippet.channelId,
            thumbnailUrl: detail.snippet.thumbnails.medium?.url || detail.snippet.thumbnails.default?.url || "",
            watchedAt: Date.now(),
            currentTime: existingItem?.currentTime,
            duration: existingItem?.duration,
          })

          // URLに動画IDと時間をセット
          const url = startTime !== undefined ? `/yt?v=${videoId}&t=${startTime}` : `/yt?v=${videoId}`
          router.push(url)

          // プレイヤーを初期化（API準備ができていない場合は保留）
          if (!isYouTubeApiReady || !playerContainerRef.current) {
            dispatch({ type: "SET_PENDING_VIDEO", payload: { videoId, startTime } })
          } else {
            initializePlayer(videoId, startTime)
          }
        } else {
          dispatch({ type: "SET_ERROR", payload: "動画が見つかりませんでした。" })
        }
      } catch (err) {
        console.error("動画詳細の取得に失敗しました:", err)
        dispatch({ type: "SET_ERROR", payload: "動画情報の取得に失敗しました。" })
      } finally {
        dispatch({ type: "SET_LOADING", payload: false })
      }
    },
    [loadChannelPlaylists, loadVideoPlaylists, router, isYouTubeApiReady, initializePlayer],
  )

  // ページロード時にクエリパラメータから動画IDを取得して自動再生
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const videoId = urlParams.get("v")
    const time = urlParams.get("t")
    if (videoId && !selectedVideo) {
      // localStorageに保存されている再生位置がある場合、URLに追加
      const history = youtubeClient.getHistory()
      const savedItem = history.find((item) => item.videoId === videoId)

      if (savedItem && savedItem.currentTime && savedItem.duration && !time) {
        // 95%以上再生済みでない場合のみURLに追加
        if (savedItem.currentTime < savedItem.duration * 0.95) {
          router.replace(`/yt?v=${videoId}&t=${savedItem.currentTime}`)
          playVideoFromId(videoId, savedItem.currentTime)
        } else {
          playVideoFromId(videoId, undefined)
        }
      } else {
        playVideoFromId(videoId, time ? parseFloat(time) : undefined)
      }
    }
  }, [playVideoFromId, selectedVideo, router])

  // YouTube APIの読み込み
  useEffect(() => {
    if (!getYT()) {
      // グローバルコールバック関数を定義
      setYTReadyCallback(() => {
        dispatch({ type: "SET_YOUTUBE_API_READY", payload: true })
      })

      // スクリプトタグを作成してYouTube IFrame APIを読み込む
      const tag = document.createElement("script")
      tag.src = "https://www.youtube.com/iframe_api"
      const firstScriptTag = document.getElementsByTagName("script")[0]
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)
    } else {
      dispatch({ type: "SET_YOUTUBE_API_READY", payload: true })
    }

    // クリーンアップ関数
    return () => {
      if (playerRef.current) {
        playerRef.current.destroy()
        dispatch({ type: "SET_PLAYER_READY", payload: false })
      }
    }
  }, [])

  // API準備完了時にpendingVideoを処理
  useEffect(() => {
    if (isYouTubeApiReady && selectedVideo && playerContainerRef.current && pendingVideo) {
      const { videoId, startTime } = pendingVideo
      dispatch({ type: "CLEAR_PENDING_VIDEO" })
      initializePlayer(videoId, startTime)
    }
  }, [isYouTubeApiReady, selectedVideo, pendingVideo, initializePlayer])

  // 再生速度変更時の処理
  const handleSpeedChange = useCallback(
    (newSpeed: number) => {
      // まず状態を更新
      dispatch({ type: "SET_PLAYBACK_SPEED", payload: newSpeed })

      // ローカルストレージに保存（この部分は常に行う）
      try {
        localStorage.setItem(YT_SPEED_KEY, newSpeed.toString())
      } catch (err) {
        console.error("再生速度の保存に失敗しました:", err)
      }

      // プレイヤーが存在し、かつ初期化済みの場合のみ速度変更を行う
      if (playerRef.current && isPlayerReady && typeof playerRef.current.setPlaybackRate === "function") {
        try {
          // 再生速度を変更
          playerRef.current.setPlaybackRate(newSpeed)
        } catch (error) {
          console.error("再生速度の設定に失敗しました:", error)
        }
      }
    },
    [isPlayerReady],
  )

  // 再生位置保存用のタイマー参照
  const savePositionTimerRef = useRef<NodeJS.Timeout | null>(null)

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

  // 動画選択時の処理
  const handleVideoSelect = useCallback(
    (video: SearchItem) => {
      // 現在の動画の再生位置を保存
      if (selectedVideo && selectedVideo.id.videoId !== video.id.videoId) {
        saveCurrentPosition()
      }

      // 既存の再生位置を確認
      const existingItem = youtubeClient.getHistory().find((h) => h.videoId === video.id.videoId!)
      dispatch({ type: "SET_SELECTED_VIDEO", payload: video })
      // 履歴に追加（既存の再生位置を保持）
      const historyItem: HistoryItem = {
        videoId: video.id.videoId!,
        title: video.snippet.title,
        channelTitle: video.snippet.channelTitle,
        channelId: video.snippet.channelId,
        thumbnailUrl: video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url || "",
        watchedAt: Date.now(),
        currentTime: existingItem?.currentTime,
        duration: existingItem?.duration,
      }
      youtubeClient.addToHistory(historyItem)
      // エラーをリセット
      dispatch({ type: "SET_ERROR", payload: null })

      // 動画詳細情報を取得
      const fetchVideoDetails = async () => {
        dispatch({ type: "SET_LOADING", payload: true })

        try {
          const details = await youtubeClient.getVideoDetails([video.id.videoId!])
          if (details.length > 0) {
            dispatch({ type: "SET_VIDEO_DETAILS", payload: details[0] })

            // お気に入り状態を確認
            const isFav = youtubeClient.isFavorite(video.id.videoId!)
            dispatch({ type: "SET_VIDEO_FAVORITE", payload: isFav })

            // チャンネルのお気に入り状態を確認
            const isChannelFav = youtubeClient.isFavoriteChannel(video.snippet.channelId)
            dispatch({ type: "SET_CHANNEL_FAVORITE", payload: isChannelFav })

            // チャンネルのプレイリストを取得
            loadChannelPlaylists(video.snippet.channelId)

            // この動画が属しているプレイリストを検索
            loadVideoPlaylists(video.id.videoId!)
          }
        } catch (err) {
          console.error("動画詳細の取得に失敗しました:", err)
          dispatch({ type: "SET_ERROR", payload: "動画情報の取得に失敗しました。" })
        } finally {
          dispatch({ type: "SET_LOADING", payload: false })
        }
      }

      fetchVideoDetails()

      // URLに動画IDをセット
      router.push(`/yt?v=${video.id.videoId}`)

      // プレイヤーを初期化
      initializePlayer(video.id.videoId!)
    },
    [selectedVideo, saveCurrentPosition, loadChannelPlaylists, loadVideoPlaylists, router, initializePlayer],
  )

  // プレイリスト選択時の処理
  const handlePlaylistSelect = useCallback(
    async (playlist: SearchItem) => {
      try {
        if (playlist.id.playlistId) {
          // PlaylistDetailを取得
          const playlistDetails = await youtubeClient.getPlaylistDetails([playlist.id.playlistId])
          if (playlistDetails.length > 0) {
            const detail = playlistDetails[0]
            // プレイリストの最初の動画を取得して再生
            const { items } = await youtubeClient.getPlaylistItems(detail.id)
            if (items.length > 0) {
              const firstVideoId = items[0].contentDetails.videoId
              playVideoFromId(firstVideoId)
            }
          }
        }
      } catch (err) {
        console.error("プレイリストの再生に失敗しました:", err)
        dispatch({ type: "SET_ERROR", payload: "プレイリストの再生に失敗しました。" })
      }
    },
    [playVideoFromId],
  )

  // プレイリストクリック時の処理
  const handlePlaylistClick = useCallback(async (playlist: PlaylistDetail) => {
    dispatch({ type: "OPEN_PLAYLIST_MODAL", payload: playlist })

    try {
      const { items } = await youtubeClient.getPlaylistItems(playlist.id)
      const videos: SearchItem[] = items.map((item) => ({
        id: {
          kind: "youtube#video",
          videoId: item.contentDetails.videoId,
        },
        snippet: {
          publishedAt: item.snippet.publishedAt,
          channelId: item.snippet.channelId,
          title: item.snippet.title,
          description: item.snippet.description,
          thumbnails: item.snippet.thumbnails,
          channelTitle: item.snippet.channelTitle,
          liveBroadcastContent: "",
        },
      }))
      dispatch({ type: "SET_PLAYLIST_MODAL_VIDEOS", payload: videos })
    } catch (err) {
      console.error("プレイリスト動画の取得に失敗しました:", err)
      dispatch({ type: "SET_PLAYLIST_MODAL_LOADING", payload: false })
    }
  }, [])

  const closePlaylistModal = useCallback(() => {
    dispatch({ type: "CLOSE_PLAYLIST_MODAL" })
  }, [])

  // ドロワー開閉関数
  const toggleHistoryDrawer = useCallback(() => {
    dispatch({ type: "TOGGLE_DRAWER", payload: "history" })
  }, [])
  const toggleFavoriteDrawer = useCallback(() => {
    dispatch({ type: "TOGGLE_DRAWER", payload: "favorite" })
  }, [])
  const toggleChannelFavoriteDrawer = useCallback(() => {
    dispatch({ type: "TOGGLE_DRAWER", payload: "channelFavorite" })
  }, [])
  const togglePlaylistDrawer = useCallback(() => {
    dispatch({ type: "TOGGLE_DRAWER", payload: "playlist" })
  }, [])

  // お気に入りトグル関数
  const toggleFavorite = useCallback(() => {
    if (!selectedVideo) return
    const newFavorite = !isFavorite
    dispatch({ type: "SET_VIDEO_FAVORITE", payload: newFavorite })
    youtubeClient.toggleFavorite(selectedVideo.id.videoId!)
  }, [selectedVideo, isFavorite, dispatch])

  const toggleChannelFavorite = useCallback(() => {
    if (!selectedVideo) return
    const newChannelFavorite = !isChannelFavorite
    dispatch({ type: "SET_CHANNEL_FAVORITE", payload: newChannelFavorite })
    youtubeClient.toggleFavoriteChannel(selectedVideo.snippet.channelId)
  }, [selectedVideo, isChannelFavorite, dispatch])

  return (
    <div className="container mx-auto px-2 pb-32 sm:px-4">
      <div className="flex items-center justify-between">
        <h1 className="my-2 text-xl font-bold sm:my-4 sm:text-2xl">YouTube Player</h1>
        {selectedVideo && (
          <button
            onClick={() => {
              if (window.confirm("動画を閉じて検索画面に戻りますか？")) {
                dispatch({ type: "SET_SELECTED_VIDEO", payload: null })
                router.push("/yt")
              }
            }}
            className="rounded bg-gray-200 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-300"
          >
            検索に戻る
          </button>
        )}
      </div>

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
                  <button onClick={toggleFavorite} className="ml-2 shrink-0 text-yellow-500 hover:text-yellow-600">
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
                  <div className="flex items-center gap-4">
                    {videoDetails && (
                      <span className="text-sm">
                        {parseInt(videoDetails.statistics.viewCount).toLocaleString()}
                        回視聴
                      </span>
                    )}
                    {/* プレイリスト確認ボタン */}
                    {(videoPlaylists.length > 0 || isLoadingVideoPlaylists) && (
                      <button
                        onClick={() => {
                          const playlistSection = document.getElementById("video-playlists-section")
                          if (playlistSection) {
                            playlistSection.scrollIntoView({ behavior: "smooth" })
                          }
                        }}
                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                        title="この動画が含まれるプレイリストを表示"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {isLoadingVideoPlaylists ? (
                          <span className="animate-pulse">検索中...</span>
                        ) : (
                          <span>{videoPlaylists.length}件のプレイリスト</span>
                        )}
                      </button>
                    )}
                  </div>
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

                    {/* この動画が属しているプレイリスト */}
                    {selectedVideo && (
                      <div id="video-playlists-section" className="mt-3 rounded-lg bg-blue-50 p-3 sm:mt-4 sm:p-4">
                        <h3 className="mb-2 text-sm font-medium sm:mb-3 sm:text-base">
                          この動画が含まれるプレイリスト
                        </h3>
                        {isLoadingVideoPlaylists ? (
                          <div className="flex items-center justify-center py-4">
                            <div className="h-6 w-6 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
                            <span className="ml-2 text-sm">プレイリスト検索中...</span>
                          </div>
                        ) : videoPlaylists.length > 0 ? (
                          <div className="max-h-60 space-y-2 overflow-y-auto">
                            {videoPlaylists.map((playlist) => (
                              <div
                                key={playlist.id}
                                className="flex items-center justify-between rounded border bg-white p-2 hover:bg-gray-50"
                              >
                                <div className="min-w-0 flex-1">
                                  <h4 className="truncate text-sm font-medium">{playlist.snippet.title}</h4>
                                  <p className="text-xs text-gray-600">{playlist.contentDetails.itemCount} 動画</p>
                                </div>
                                <button
                                  onClick={() => {
                                    const isAlreadyFavorite = youtubeClient.isFavoritePlaylist(playlist.id)
                                    if (!isAlreadyFavorite) {
                                      youtubeClient.toggleFavoritePlaylist(playlist.id)
                                      alert("プレイリストをお気に入りに追加しました")
                                      // 状態更新のために再読み込み
                                      dispatch({
                                        type: "SET_VIDEO_PLAYLISTS",
                                        payload: videoPlaylists.map((p) =>
                                          p.id === playlist.id ? { ...p, isFavorite: true } : p,
                                        ),
                                      })
                                    } else {
                                      alert("このプレイリストは既にお気に入りに登録されています")
                                    }
                                  }}
                                  className={`ml-2 rounded px-2 py-1 text-xs ${
                                    youtubeClient.isFavoritePlaylist(playlist.id)
                                      ? "bg-green-500 text-white"
                                      : "bg-blue-500 text-white hover:bg-blue-600"
                                  }`}
                                >
                                  {youtubeClient.isFavoritePlaylist(playlist.id) ? "お気に入り済み" : "お気に入り"}
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="py-4 text-center text-sm text-gray-500">プレイリスト所属なし</p>
                        )}
                      </div>
                    )}

                    {/* チャンネルプレイリスト */}
                    {channelPlaylists.length > 0 && (
                      <div className="mt-3 rounded-lg bg-purple-50 p-3 sm:mt-4 sm:p-4">
                        <h3 className="mb-2 text-sm font-medium sm:mb-3 sm:text-base">このチャンネルのプレイリスト</h3>
                        {/* 検索ボックス */}
                        <div className="mb-3">
                          <input
                            type="text"
                            placeholder="プレイリストを検索..."
                            value={channelPlaylistFilter}
                            onChange={(e) => dispatch({ type: "SET_CHANNEL_PLAYLIST_FILTER", payload: e.target.value })}
                            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                          />
                        </div>
                        <div className="max-h-60 space-y-2 overflow-y-auto">
                          {filteredChannelPlaylists.map((playlist) => (
                            <div
                              key={playlist.id}
                              className="flex items-center justify-between rounded border bg-white p-2 hover:bg-gray-50"
                            >
                              <div className="min-w-0 flex-1">
                                <button
                                  onClick={() => handlePlaylistClick(playlist)}
                                  className="truncate text-left text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  {playlist.snippet.title}
                                </button>
                                <p className="text-xs text-gray-600">{playlist.contentDetails.itemCount} 動画</p>
                              </div>
                              <button
                                onClick={() => {
                                  const isAlreadyFavorite = youtubeClient.isFavoritePlaylist(playlist.id)
                                  if (!isAlreadyFavorite) {
                                    youtubeClient.toggleFavoritePlaylist(playlist.id)
                                    alert("プレイリストをお気に入りに追加しました")
                                    // 状態更新のために再読み込み
                                    dispatch({
                                      type: "SET_CHANNEL_PLAYLISTS",
                                      payload: channelPlaylists.map((p) =>
                                        p.id === playlist.id ? { ...p, isFavorite: true } : p,
                                      ),
                                    })
                                  } else {
                                    alert("このプレイリストは既にお気に入りに登録されています")
                                  }
                                }}
                                className="ml-2 rounded bg-purple-500 px-2 py-1 text-xs text-white hover:bg-purple-600"
                              >
                                {youtubeClient.isFavoritePlaylist(playlist.id) ? "登録済み" : "お気に入り"}
                              </button>
                            </div>
                          ))}
                          {filteredChannelPlaylists.length === 0 && channelPlaylistFilter.trim() && (
                            <p className="py-4 text-center text-sm text-gray-500">
                              「{channelPlaylistFilter}」に一致するプレイリストが見つかりません
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {isLoadingChannelPlaylists && (
                      <div className="mt-3 flex items-center justify-center rounded-lg bg-gray-50 p-4 sm:mt-4">
                        <div className="h-6 w-6 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
                        <span className="ml-2 text-sm">プレイリストを読み込み中...</span>
                      </div>
                    )}

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
              <Search onVideoSelect={handleVideoSelect} onPlaylistSelect={handlePlaylistSelect} />
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
            <Search onVideoSelect={handleVideoSelect} onPlaylistSelect={handlePlaylistSelect} />
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
      {/* プレイリストボタンとドロワー */}
      <PlaylistButton onClick={togglePlaylistDrawer} />
      <PlaylistDrawer isOpen={isPlaylistDrawerOpen} onClose={togglePlaylistDrawer} onVideoSelect={playVideoFromId} />

      {/* プレイリストモーダル */}
      {playlistModal.isOpen && playlistModal.playlist && (
        <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl">
            {/* ヘッダー */}
            <div className="flex items-center justify-between border-b p-4">
              <div>
                <h3 className="text-lg font-semibold">{playlistModal.playlist.snippet.title}</h3>
                <p className="text-sm text-gray-600">{playlistModal.playlist.contentDetails.itemCount} 動画</p>
              </div>
              <button onClick={closePlaylistModal} className="rounded p-1 hover:bg-gray-100">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* コンテンツ */}
            <div className="max-h-96 overflow-y-auto p-4">
              {playlistModal.loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
                  <span className="ml-2">読み込み中...</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {playlistModal.videos.map((video, index) => (
                    <div
                      key={video.id.videoId}
                      onClick={() => {
                        handleVideoSelect(video)
                        closePlaylistModal()
                      }}
                      className="flex cursor-pointer items-center rounded border p-3 hover:bg-gray-50"
                    >
                      <div className="mr-3 text-sm font-medium text-gray-500">{index + 1}</div>
                      <div className="mr-3 h-12 w-20 shrink-0">
                        <img
                          src={video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url}
                          alt={video.snippet.title}
                          className="h-full w-full rounded object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="line-clamp-2 text-sm font-medium">{video.snippet.title}</div>
                        <div className="text-xs text-gray-600">{video.snippet.channelTitle}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
