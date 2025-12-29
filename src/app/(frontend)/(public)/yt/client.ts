import {
  ChannelDetail,
  HistoryItem,
  SearchParams,
  SearchResponse,
  VideoDetail,
  YOUTUBE_API_KEY,
  YT_CHANNEL_FAVORITES_KEY,
  YT_FAVORITES_KEY,
  YT_HISTORY_KEY,
  url,
} from "./constants"

// YouTube APIクライアント
class YouTubeClient {
  // 検索API呼び出し
  async search(params: SearchParams): Promise<SearchResponse> {
    try {
      const queryParams = new URLSearchParams({
        key: YOUTUBE_API_KEY,
        part: params.part || "snippet",
        maxResults: params.maxResults?.toString() || "25",
        q: params.q,
        type: params.type || "video",
      })

      // オプショナルパラメータの追加
      if (params.videoDuration) {
        queryParams.append("videoDuration", params.videoDuration)
      }

      if (params.videoDefinition) {
        queryParams.append("videoDefinition", params.videoDefinition)
      }

      if (params.pageToken) {
        queryParams.append("pageToken", params.pageToken)
      }

      const response = await fetch(`${url.search}?${queryParams.toString()}`)

      if (!response.ok) {
        throw new Error(`検索に失敗しました: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error("検索エラー:", error)
      throw error
    }
  }

  // 動画詳細情報の取得
  async getVideoDetails(videoIds: string[]): Promise<VideoDetail[]> {
    try {
      if (!videoIds.length) return []

      const queryParams = new URLSearchParams({
        key: YOUTUBE_API_KEY,
        part: "snippet,contentDetails,statistics",
        id: videoIds.join(","),
      })

      const response = await fetch(`${url.videos}?${queryParams.toString()}`)

      if (!response.ok) {
        throw new Error(`動画情報の取得に失敗しました: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      return data.items
    } catch (error) {
      console.error("動画詳細取得エラー:", error)
      throw error
    }
  }

  // 視聴履歴の管理
  getHistory(): HistoryItem[] {
    try {
      const storedHistory = localStorage.getItem(YT_HISTORY_KEY)
      if (!storedHistory) return []

      return JSON.parse(storedHistory)
    } catch (error) {
      console.error("履歴の取得に失敗しました:", error)
      return []
    }
  }

  addToHistory(item: HistoryItem): void {
    try {
      const history = this.getHistory()

      // 同じ動画がすでに履歴にある場合は削除（後で新しいタイムスタンプで追加）
      const filteredHistory = history.filter((h) => h.videoId !== item.videoId)

      // 履歴の先頭に追加
      filteredHistory.unshift(item)

      // 履歴は最大100件まで保存
      const trimmedHistory = filteredHistory.slice(0, 100)

      localStorage.setItem(YT_HISTORY_KEY, JSON.stringify(trimmedHistory))
    } catch (error) {
      console.error("履歴の保存に失敗しました:", error)
    }
  }

  clearHistory(): void {
    try {
      localStorage.removeItem(YT_HISTORY_KEY)
    } catch (error) {
      console.error("履歴のクリアに失敗しました:", error)
    }
  }

  removeFromHistory(videoId: string): void {
    try {
      const history = this.getHistory()
      const filteredHistory = history.filter((h) => h.videoId !== videoId)
      localStorage.setItem(YT_HISTORY_KEY, JSON.stringify(filteredHistory))
    } catch (error) {
      console.error("履歴からの削除に失敗しました:", error)
    }
  }

  // お気に入りの管理
  getFavorites(): string[] {
    try {
      const storedFavorites = localStorage.getItem(YT_FAVORITES_KEY)
      if (!storedFavorites) return []

      return JSON.parse(storedFavorites)
    } catch (error) {
      console.error("お気に入りの取得に失敗しました:", error)
      return []
    }
  }

  toggleFavorite(videoId: string): boolean {
    try {
      const favorites = this.getFavorites()
      const index = favorites.indexOf(videoId)

      if (index >= 0) {
        // お気に入りから削除
        favorites.splice(index, 1)
        localStorage.setItem(YT_FAVORITES_KEY, JSON.stringify(favorites))
        return false
      } else {
        // お気に入りに追加
        favorites.push(videoId)
        localStorage.setItem(YT_FAVORITES_KEY, JSON.stringify(favorites))
        return true
      }
    } catch (error) {
      console.error("お気に入りの更新に失敗しました:", error)
      return false
    }
  }

  isFavorite(videoId: string): boolean {
    try {
      const favorites = this.getFavorites()
      return favorites.includes(videoId)
    } catch (error) {
      console.error("お気に入りの確認に失敗しました:", error)
      return false
    }
  }

  // チャンネル詳細情報の取得
  async getChannelDetails(channelIds: string[]): Promise<ChannelDetail[]> {
    try {
      if (!channelIds.length) return []

      const queryParams = new URLSearchParams({
        key: YOUTUBE_API_KEY,
        part: "snippet,statistics",
        id: channelIds.join(","),
      })

      const response = await fetch(`${url.channels}?${queryParams.toString()}`)

      if (!response.ok) {
        throw new Error(`チャンネル情報の取得に失敗しました: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      return data.items
    } catch (error) {
      console.error("チャンネル詳細取得エラー:", error)
      throw error
    }
  }

  // チャンネルのお気に入り機能
  getFavoriteChannels(): string[] {
    try {
      const storedFavorites = localStorage.getItem(YT_CHANNEL_FAVORITES_KEY)
      if (!storedFavorites) return []

      return JSON.parse(storedFavorites)
    } catch (error) {
      console.error("お気に入りチャンネルの取得に失敗しました:", error)
      return []
    }
  }

  toggleFavoriteChannel(channelId: string): boolean {
    try {
      const favorites = this.getFavoriteChannels()
      const index = favorites.indexOf(channelId)

      if (index >= 0) {
        // お気に入りから削除
        favorites.splice(index, 1)
        localStorage.setItem(YT_CHANNEL_FAVORITES_KEY, JSON.stringify(favorites))
        return false
      } else {
        // お気に入りに追加
        favorites.push(channelId)
        localStorage.setItem(YT_CHANNEL_FAVORITES_KEY, JSON.stringify(favorites))
        return true
      }
    } catch (error) {
      console.error("お気に入りチャンネルの更新に失敗しました:", error)
      return false
    }
  }

  isFavoriteChannel(channelId: string): boolean {
    try {
      const favorites = this.getFavoriteChannels()
      return favorites.includes(channelId)
    } catch (error) {
      console.error("お気に入りチャンネルの確認に失敗しました:", error)
      return false
    }
  }

  // チャンネルの動画を検索
  async searchChannelVideos(channelId: string, pageToken?: string): Promise<SearchResponse> {
    try {
      const queryParams = new URLSearchParams({
        key: YOUTUBE_API_KEY,
        part: "snippet",
        maxResults: "10",
        channelId: channelId,
        type: "video",
        order: "date",
      })

      if (pageToken) {
        queryParams.append("pageToken", pageToken)
      }

      const response = await fetch(`${url.search}?${queryParams.toString()}`)

      if (!response.ok) {
        throw new Error(`チャンネル動画の検索に失敗しました: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error("チャンネル動画検索エラー:", error)
      throw error
    }
  }
}

const youtubeClient = new YouTubeClient()
export default youtubeClient
