// 環境変数から取得するYouTube API Key
export const YOUTUBE_API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY || ""

// API URLs
export const url = {
  search: "https://www.googleapis.com/youtube/v3/search",
  videos: "https://www.googleapis.com/youtube/v3/videos",
  channels: "https://www.googleapis.com/youtube/v3/channels",
  playlists: "https://www.googleapis.com/youtube/v3/playlists",
  playlistItems: "https://www.googleapis.com/youtube/v3/playlistItems",
}

// ローカルストレージのキー
export const YT_HISTORY_KEY = "youtube_history"
export const YT_FAVORITES_KEY = "youtube_favorites"
export const YT_CHANNEL_FAVORITES_KEY = "youtube_channel_favorites"
export const YT_PLAYLIST_FAVORITES_KEY = "youtube_playlist_favorites"

// YouTubeのサムネイルサイズ
export enum ThumbnailSize {
  Default = "default",
  Medium = "medium",
  High = "high",
  Standard = "standard",
  Maxres = "maxres",
}

// 検索結果の型定義
export interface SearchItem {
  id: {
    kind: string
    videoId?: string
    channelId?: string
    playlistId?: string
  }
  snippet: {
    publishedAt: string
    channelId: string
    title: string
    description: string
    thumbnails: {
      [key in ThumbnailSize]?: {
        url: string
        width: number
        height: number
      }
    }
    channelTitle: string
    liveBroadcastContent: string
  }
}

// ビデオ詳細情報の型定義
export interface VideoDetail {
  id: string
  snippet: {
    publishedAt: string
    channelId: string
    title: string
    description: string
    thumbnails: {
      [key in ThumbnailSize]?: {
        url: string
        width: number
        height: number
      }
    }
    channelTitle: string
    tags?: string[]
    categoryId: string
  }
  contentDetails: {
    duration: string
    dimension: string
    definition: string
    caption: string
    licensedContent: boolean
    contentRating: object
    projection: string
  }
  statistics: {
    viewCount: string
    likeCount: string
    favoriteCount: string
    commentCount: string
  }
}

// 検索パラメータの型定義
export interface SearchParams {
  q: string
  part?: string
  maxResults?: number
  type?: string
  videoDuration?: "any" | "long" | "medium" | "short"
  videoDefinition?: "any" | "high" | "standard"
  pageToken?: string
}

// 検索結果レスポンスの型定義
export interface SearchResponse {
  kind: string
  etag: string
  nextPageToken?: string
  prevPageToken?: string
  pageInfo: {
    totalResults: number
    resultsPerPage: number
  }
  items: SearchItem[]
}

// 視聴履歴アイテムの型定義
export interface HistoryItem {
  videoId: string
  title: string
  channelTitle: string
  thumbnailUrl: string
  watchedAt: number
  currentTime?: number // 再生位置（秒）を追加
  duration?: number // 動画の総時間（秒）
  channelId: string
}

// チャンネル詳細情報の型定義
export interface ChannelDetail {
  id: string
  snippet: {
    title: string
    description: string
    customUrl?: string
    publishedAt: string
    thumbnails: {
      [key in ThumbnailSize]?: {
        url: string
        width: number
        height: number
      }
    }
    country?: string
  }
  statistics: {
    viewCount: string
    subscriberCount: string
    hiddenSubscriberCount: boolean
    videoCount: string
  }
}

// プレイリスト詳細情報の型定義
export interface PlaylistDetail {
  id: string
  snippet: {
    publishedAt: string
    channelId: string
    title: string
    description: string
    thumbnails: {
      [key in ThumbnailSize]?: {
        url: string
        width: number
        height: number
      }
    }
    channelTitle: string
  }
  status: {
    privacyStatus: string
  }
  contentDetails: {
    itemCount: number
  }
}

// プレイリストアイテムの型定義
export interface PlaylistItem {
  id: string
  snippet: {
    publishedAt: string
    channelId: string
    title: string
    description: string
    thumbnails: {
      [key in ThumbnailSize]?: {
        url: string
        width: number
        height: number
      }
    }
    channelTitle: string
    playlistId: string
    position: number
    resourceId: {
      kind: string
      videoId: string
    }
  }
  contentDetails: {
    videoId: string
    startAt?: string
    endAt?: string
    note?: string
    videoPublishedAt: string
  }
}

// 視聴履歴から日付文字列を生成するヘルパー関数
export const formatWatchedDate = (timestamp: number): string => {
  const date = new Date(timestamp)
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  })
}

// 視聴時間をフォーマットするヘルパー関数
export const formatWatchedTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  return (
    date.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }) + " JST"
  )
}

// ISO 8601形式の動画時間を分:秒形式に変換
export const formatDuration = (isoDuration: string): string => {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return "0:00"

  const hours = match[1] ? parseInt(match[1]) : 0
  const minutes = match[2] ? parseInt(match[2]) : 0
  const seconds = match[3] ? parseInt(match[3]) : 0

  const totalSeconds = hours * 3600 + minutes * 60 + seconds
  const totalMinutes = Math.floor(totalSeconds / 60)
  const remainingSeconds = totalSeconds % 60

  return `${totalMinutes}:${remainingSeconds.toString().padStart(2, "0")}`
}

// YouTube Playerの型定義
export type YTPlayer = {
  destroy(): void
  loadVideoById(videoId: string, startSeconds?: number): void
  cueVideoById(videoId: string, startSeconds?: number): void
  playVideo(): void
  pauseVideo(): void
  stopVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  getVideoLoadedFraction(): number
  getPlayerState(): number
  getCurrentTime(): number
  getDuration(): number
  getVideoUrl(): string
  getVideoEmbedCode(): string
  getOptions(): string[]
  getOption(key: string): unknown
  setOption(key: string, value: unknown): void
  getVideoData(): {
    video_id: string
    author: string
    title: string
    [key: string]: unknown
  }
  mute(): void
  unMute(): void
  isMuted(): boolean
  setVolume(volume: number): void
  getVolume(): number
  setSize(width: number, height: number): void
  setPlaybackRate(rate: number): void
  getPlaybackRate(): number
  getAvailablePlaybackRates(): number[]
  setLoop(loopPlaylists: boolean): void
  setShuffle(shufflePlaylist: boolean): void
}

export interface YTPlayerOptions {
  height?: string | number
  width?: string | number
  videoId?: string
  playerVars?: YTPlayerVars
  events?: YTPlayerEvents
}

export interface YTPlayerVars {
  autoplay?: 0 | 1
  cc_load_policy?: 0 | 1
  color?: "red" | "white"
  controls?: 0 | 1
  disablekb?: 0 | 1
  enablejsapi?: 0 | 1
  end?: number
  fs?: 0 | 1
  hl?: string
  iv_load_policy?: 1 | 3
  list?: string
  listType?: "playlist" | "search" | "user_uploads"
  loop?: 0 | 1
  modestbranding?: 0 | 1
  origin?: string
  playlist?: string
  playsinline?: 0 | 1
  rel?: 0 | 1
  start?: number
  mute?: 0 | 1
}

export interface YTPlayerEvents {
  onReady?: (event: YTPlayerEvent) => void
  onStateChange?: (event: YTPlayerOnStateChangeEvent) => void
  onPlaybackQualityChange?: (event: YTPlayerEvent & { data: string }) => void
  onPlaybackRateChange?: (event: YTPlayerEvent & { data: number }) => void
  onError?: (event: YTPlayerEvent & { data: number }) => void
  onApiChange?: (event: YTPlayerEvent) => void
}

export interface YTPlayerEvent {
  target: YTPlayer
}

export interface YTPlayerOnStateChangeEvent {
  target: YTPlayer
  data: YTPlayerState
}

export enum YTPlayerState {
  UNSTARTED = -1,
  ENDED = 0,
  PLAYING = 1,
  PAUSED = 2,
  BUFFERING = 3,
  CUED = 5,
}

export interface YTPlayerConstructor {
  new (container: HTMLElement | string, options: YTPlayerOptions): YTPlayer
}
