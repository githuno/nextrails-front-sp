import {
  ChannelDetail,
  HistoryItem,
  PlaylistDetail,
  PlaylistItem,
  SearchParams,
  SearchResponse,
  VideoDetail,
  YOUTUBE_API_KEY,
  YT_CHANNEL_FAVORITES_KEY,
  YT_FAVORITES_KEY,
  YT_HISTORY_KEY,
  YT_PLAYLIST_FAVORITES_KEY,
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
      const existingItem = history.find((h) => h.videoId === item.videoId)

      // 既存の再生位置などのデータを保持しつつ更新
      const updatedItem: HistoryItem = {
        ...existingItem,
        ...item,
        // 新しいアイテムに値がない場合は既存の値を保持
        currentTime: item.currentTime !== undefined ? item.currentTime : existingItem?.currentTime,
        duration: item.duration !== undefined ? item.duration : existingItem?.duration,
      }

      // 同じ動画がすでに履歴にある場合は削除（後で新しいタイムスタンプで追加）
      const filteredHistory = history.filter((h) => h.videoId !== item.videoId)

      // 履歴の先頭に追加
      filteredHistory.unshift(updatedItem)

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

  // プレイリスト詳細情報の取得
  async getPlaylistDetails(playlistIds: string[]): Promise<PlaylistDetail[]> {
    try {
      if (!playlistIds.length) return []

      const queryParams = new URLSearchParams({
        key: YOUTUBE_API_KEY,
        part: "snippet,status,contentDetails",
        id: playlistIds.join(","),
      })

      const response = await fetch(`${url.playlists}?${queryParams.toString()}`)

      if (!response.ok) {
        throw new Error(`プレイリスト詳細取得に失敗しました: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      return data.items
    } catch (error) {
      console.error("プレイリスト詳細取得エラー:", error)
      throw error
    }
  }

  // プレイリストアイテムの取得
  async getPlaylistItems(
    playlistId: string,
    pageToken?: string,
  ): Promise<{ items: PlaylistItem[]; nextPageToken?: string }> {
    try {
      const queryParams = new URLSearchParams({
        key: YOUTUBE_API_KEY,
        part: "snippet,contentDetails",
        playlistId: playlistId,
        maxResults: "50",
      })

      if (pageToken) {
        queryParams.append("pageToken", pageToken)
      }

      const response = await fetch(`${url.playlistItems}?${queryParams.toString()}`)

      if (!response.ok) {
        throw new Error(`プレイリストアイテム取得に失敗しました: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      return { items: data.items, nextPageToken: data.nextPageToken }
    } catch (error) {
      console.error("プレイリストアイテム取得エラー:", error)
      throw error
    }
  }

  // お気に入りプレイリストの管理
  getFavoritePlaylists(): string[] {
    try {
      const storedPlaylists = localStorage.getItem(YT_PLAYLIST_FAVORITES_KEY)
      if (!storedPlaylists) return []

      return JSON.parse(storedPlaylists)
    } catch (error) {
      console.error("お気に入りプレイリストの取得に失敗しました:", error)
      return []
    }
  }

  toggleFavoritePlaylist(playlistId: string): boolean {
    try {
      const favorites = this.getFavoritePlaylists()
      const isFavorite = favorites.includes(playlistId)

      if (isFavorite) {
        // お気に入りから削除
        const updatedFavorites = favorites.filter((id) => id !== playlistId)
        localStorage.setItem(YT_PLAYLIST_FAVORITES_KEY, JSON.stringify(updatedFavorites))
        return false
      } else {
        // お気に入りに追加
        favorites.push(playlistId)
        localStorage.setItem(YT_PLAYLIST_FAVORITES_KEY, JSON.stringify(favorites))
        return true
      }
    } catch (error) {
      console.error("お気に入りプレイリストの切り替えに失敗しました:", error)
      return false
    }
  }

  isFavoritePlaylist(playlistId: string): boolean {
    try {
      const favorites = this.getFavoritePlaylists()
      return favorites.includes(playlistId)
    } catch (error) {
      console.error("お気に入りプレイリストのチェックに失敗しました:", error)
      return false
    }
  }

  // 動画が属しているプレイリストを検索
  async findPlaylistsContainingVideo(videoId: string): Promise<PlaylistDetail[]> {
    try {
      // まず、この動画のチャンネルを取得
      const videoDetails = await this.getVideoDetails([videoId])
      if (!videoDetails.length) {
        return []
      }

      const channelId = videoDetails[0].snippet.channelId

      // チャンネルのプレイリストを取得
      const { items: playlists } = await this.getChannelPlaylists(channelId)

      // 各プレイリストについて、この動画が含まれているかをチェック（並行処理）
      const checkPromises = playlists.map(async (playlist) => {
        try {
          const { items: playlistItems } = await this.getPlaylistItems(playlist.id)
          const containsVideo = playlistItems.some((item) => item.contentDetails.videoId === videoId)
          if (containsVideo) {
            return playlist
          }
        } catch (error) {
          // プレイリストが非公開などの場合はスキップ
          console.warn(`プレイリスト ${playlist.id} のチェックに失敗しました:`, error)
        }
        return null
      })

      // 並行処理で全てのチェックを実行
      const results = await Promise.all(checkPromises)

      // nullを除去して有効なプレイリストのみを返す
      const containingPlaylists = results.filter((playlist): playlist is PlaylistDetail => playlist !== null)
      return containingPlaylists
    } catch (error) {
      console.error("動画が属しているプレイリストの検索に失敗しました:", error)
      return []
    }
  }

  // チャンネルのプレイリストを取得
  async getChannelPlaylists(
    channelId: string,
    pageToken?: string,
  ): Promise<{ items: PlaylistDetail[]; nextPageToken?: string }> {
    try {
      const queryParams = new URLSearchParams({
        key: YOUTUBE_API_KEY,
        part: "snippet,status,contentDetails",
        channelId: channelId,
        maxResults: "50",
      })

      if (pageToken) {
        queryParams.append("pageToken", pageToken)
      }

      const response = await fetch(`${url.playlists}?${queryParams.toString()}`)

      if (!response.ok) {
        throw new Error(`チャンネルプレイリスト取得に失敗しました: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      return { items: data.items, nextPageToken: data.nextPageToken }
    } catch (error) {
      console.error("チャンネルプレイリスト取得エラー:", error)
      throw error
    }
  }
}

const youtubeClient = new YouTubeClient()
export default youtubeClient
