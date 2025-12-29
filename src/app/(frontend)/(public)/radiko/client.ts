import { useSyncExternalStore } from "react"
import { AreaId, Auth, Program, Station, areaIdToNameMap, url } from "./constants"

const RADIKO_AUTH_KEY = "radiko_auth"
const PLAYBACK_PROGRAMS_KEY = "radiko_playback_programs"
const PLAYBACK_SPEED_KEY = "radiko_playback_speed"
const FAVORITES_KEY = "radiko_favorites"

/** 型定義 ----------------------------------------------------------*/

export type ProgramsByDate = {
  [dateKey: string]: Program[]
}

// 状態タイプの定義
export type RadikoState = {
  isLoading: boolean
  error: string | null
  auth: Auth | null
  stations: Station[]
  selectedStation: string
  nowOnAir: Program | null
  programs: Program[]
  programsByDate: ProgramsByDate
  currentAreaName: string
  currentProgram: Program | null
  playingType: "live" | "timefree" | null
  speed: number
  manualEndTrigger: number
  favorites: Array<{ stationId: string; title: string }>
  playedPrograms: Set<string>
  history: Program[]
}

// エラーレスポンスの型定義
type ErrorResponse = {
  error: string
  message: string
  status: number
  details?: unknown
  phase?: "auth1" | "auth2" | "area_validation" | "header_validation"
  retry_recommended?: boolean
}

// カスタムエラー型
type RadikoAPIError = {
  name: string
  message: string
  status?: number
  details?: unknown
  retryRecommended: boolean
}

// リトライ設定の型
type RetryConfig = {
  readonly maxRetries: number
  readonly initialDelay: number
  readonly maxDelay: number
}

// 認証情報の型定義
type StoredAuthInfo = {
  token: string
  areaId: string
  timestamp: number
}

/** 定数 ----------------------------------------------------------*/

// 認証リトライ設定
export const RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 5000,
}

/** ユーティリティ関数 ---------------------------------------------*/

// APIエラー作成関数
const createRadikoAPIError = (
  message: string,
  status?: number,
  details?: unknown,
  retryRecommended = true,
): RadikoAPIError => ({
  name: "RadikoAPIError",
  message,
  status,
  details,
  retryRecommended,
})

// APIレスポンス処理関数
const handleApiResponse = async <T>(response: Response, signal?: AbortSignal): Promise<T> => {
  // シグナルがアボートされていたら中断
  if (signal?.aborted) {
    throw new DOMException("Request aborted", "AbortError")
  }

  if (!response.ok) {
    const error = (await response.json().catch(() => ({
      error: "予期せぬエラーが発生しました",
      status: response.status,
    }))) as ErrorResponse

    throw createRadikoAPIError(
      error.message || error.error,
      error.status || response.status,
      error.details,
      error.retry_recommended ?? true,
    )
  }

  return response.json()
}

// リトライ処理を実装
const withRetry = async <T>(operation: () => Promise<T>, retryCount = 0): Promise<T> => {
  try {
    return await operation()
  } catch (error) {
    // RadikoAPIErrorかどうかをチェック
    if (typeof error === "object" && error !== null && "name" in error && error.name === "RadikoAPIError") {
      const apiError = error as RadikoAPIError

      if (!apiError.retryRecommended || retryCount >= RETRY_CONFIG.maxRetries) {
        throw apiError
      }

      // 指数バックオフでリトライ
      const delay = Math.min(RETRY_CONFIG.initialDelay * 2 ** retryCount, RETRY_CONFIG.maxDelay)

      await new Promise((resolve) => setTimeout(resolve, delay))
      return withRetry(operation, retryCount + 1)
    }
    throw error
  }
}

// 認証情報をローカルストレージに保存
const saveAuthInfo = (token: string, areaId: string): void => {
  try {
    const authInfo: StoredAuthInfo = {
      token,
      areaId,
      timestamp: Date.now(),
    }
    localStorage.setItem(RADIKO_AUTH_KEY, JSON.stringify(authInfo))
  } catch (error) {
    console.warn("Failed to save auth info to localStorage:", error)
  }
}

// 認証情報の有効性を確認
const isAuthValid = (authInfo: StoredAuthInfo): boolean => {
  // 70分以内の認証情報のみ有効とする
  const EXPIRY_TIME = 70 * 60 * 1000 // 70 minutes
  return Date.now() - authInfo.timestamp < EXPIRY_TIME
}

// 認証情報をローカルストレージから取得
const getStoredAuthInfo = (): StoredAuthInfo | null => {
  try {
    const stored = localStorage.getItem(RADIKO_AUTH_KEY)
    if (!stored) return null

    const authInfo: StoredAuthInfo = JSON.parse(stored)
    return isAuthValid(authInfo) ? authInfo : null
  } catch {
    return null
  }
}

// ローカルストレージの認証情報から地域名を取得
const getStoredAuthName = (): string => {
  let areaName = "未判定"
  try {
    const stored = localStorage.getItem(RADIKO_AUTH_KEY)
    if (!stored) return areaName
    const authInfo: Auth = JSON.parse(stored)
    areaName = areaIdToNameMap[authInfo.areaId as AreaId] || areaName
  } catch (error) {
    console.warn("Failed to get auth name:", error)
  }
  return areaName
}

const authenticateWithIp = async (ip: string): Promise<Auth> => {
  try {
    // 認証処理をリトライ機能付きで実行
    const result = await withRetry(async () => {
      const response = await fetch(url.authIp.replace("{ip}", ip), {
        method: "POST",
      })
      return handleApiResponse<Auth>(response)
    })

    // 認証情報を保存
    saveAuthInfo(result.token, result.areaId)

    return result
  } catch (error) {
    console.error("Authentication error:", error)

    if (error && typeof error === "object" && "name" in error && error.name === "RadikoAPIError") {
      throw error
    }
    throw createRadikoAPIError("認証に失敗しました", 500, error)
  }
}

const customAuthenticate = async (areaId: AreaId): Promise<Auth> => {
  try {
    // 既存の有効な認証情報があれば再利用
    const storedAuth = getStoredAuthInfo()
    if (storedAuth && storedAuth.areaId === areaId) {
      return {
        token: storedAuth.token,
        areaId: storedAuth.areaId,
      }
    }

    // 認証処理をリトライ機能付きで実行
    const result = await withRetry(async () => {
      const response = await fetch(url.customAuth, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ areaId }),
      })

      const authResult = await handleApiResponse<Auth>(response)

      // レスポンスヘッダーからトークンとエリアIDを取得
      const token = response.headers.get("X-Radiko-AuthToken") || authResult.token
      const responseAreaId = response.headers.get("X-Radiko-AreaId") || authResult.areaId

      return {
        token,
        areaId: responseAreaId,
      }
    })

    // 認証情報を保存
    saveAuthInfo(result.token, result.areaId)

    return result
  } catch (error) {
    console.error("Authentication error:", error)

    if (error && typeof error === "object" && "name" in error && error.name === "RadikoAPIError") {
      throw error
    }
    throw createRadikoAPIError("認証に失敗しました", 500, error)
  }
}

const getStations = async (areaId: AreaId, signal?: AbortSignal): Promise<Station[]> => {
  try {
    const stationsRes = await fetch(url.stations.replace("{area}", areaId), {
      signal,
    })
    if (!stationsRes.ok) {
      throw createRadikoAPIError("放送局情報の取得に失敗しました", stationsRes.status)
    }
    const result = await stationsRes.json()
    // data プロパティから配列を抽出して返す
    return result.data || []
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error
    }
    console.error("Failed to fetch stations:", error)
    if (error && typeof error === "object" && "name" in error && error.name === "RadikoAPIError") {
      throw error
    }
    throw createRadikoAPIError("放送局情報の取得に失敗しました", 500, error)
  }
}

const getProgramNow = async ({
  token,
  area,
  stationId,
  signal,
}: {
  token: string
  area: AreaId
  stationId: string
  signal?: AbortSignal
}): Promise<Program> => {
  try {
    const programsRes = await fetch(url.programNow.replace("{area}", area).replace("{token}", token), { signal })
    if (!programsRes.ok) {
      throw createRadikoAPIError("番組情報の取得に失敗しました", programsRes.status)
    }
    const result = await programsRes.json()
    console.log("Program now:", result)
    // resultからstationIdの番組情報を抽出
    const program = result.data.find((p: Program) => p.station_id === stationId)
    if (!program) {
      throw createRadikoAPIError("番組情報が見つかりませんでした", 404)
    }
    return program
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error
    }
    console.error("Failed to fetch programs:", error)
    if (error && typeof error === "object" && "name" in error && error.name === "RadikoAPIError") {
      throw error
    }
    throw createRadikoAPIError("番組情報の取得に失敗しました", 500, error)
  }
}

const getPrograms = async ({
  token,
  stationId,
  type = "date",
  date,
  signal,
}: {
  token: string
  stationId: string
  type?: "today" | "weekly" | "date"
  date?: string
  signal?: AbortSignal
}): Promise<Program[]> => {
  try {
    const targetUrl = (() => {
      switch (type) {
        case "today":
          return url.programsToday
        case "weekly":
          return url.programsWeekly
        case "date":
          return url.programsDate
        default:
          return url.programsDate
      }
    })()
    const programsRes = await fetch(
      targetUrl
        .replace("{stationId}", stationId)
        .replace("{token}", token)
        .replace("{date}", date || ""),
      { signal },
    )
    if (!programsRes.ok) {
      throw createRadikoAPIError("番組表の取得に失敗しました", programsRes.status)
    }
    const result = await programsRes.json()
    return result.data || []
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error
    }
    console.error("Failed to fetch programs:", error)
    if (error && typeof error === "object" && "name" in error && error.name === "RadikoAPIError") {
      throw error
    }
    throw createRadikoAPIError("番組表の取得に失敗しました", 500, error)
  }
}

const funcGetErrorMessage = (err: unknown): string => {
  if (typeof err === "object" && err !== null && "message" in err) {
    return String(err.message)
  } else if (typeof err === "string") {
    return err
  }
  return "予期せぬエラーが発生しました"
}

// 状態タイプの定義を追加
export type RequestState = {
  isLoading: boolean
  error: string | null
}

// イベント購読用の型定義
type Listener = () => void

// 状態管理を関数ベースで実装
function createRadikoStateManager() {
  let state: RadikoState = {
    isLoading: false,
    error: null,
    auth: null,
    stations: [],
    selectedStation: "",
    nowOnAir: null,
    programs: [],
    programsByDate: {},
    currentAreaName: "未判定",
    currentProgram: null,
    playingType: null,
    speed: 1.0,
    manualEndTrigger: 0,
    favorites: [],
    playedPrograms: new Set(),
    history: [],
  }
  const listeners: Listener[] = []

  // クライアントサイドでのみ初期化
  if (typeof window !== "undefined") {
    const savedSpeed = localStorage.getItem(PLAYBACK_SPEED_KEY)
    if (savedSpeed) {
      state.speed = parseFloat(savedSpeed)
    }

    const savedFavs = localStorage.getItem(FAVORITES_KEY)
    if (savedFavs) {
      try {
        state.favorites = JSON.parse(savedFavs)
      } catch (e) {
        console.error("Failed to parse favorites", e)
      }
    }

    const savedHistory = localStorage.getItem(PLAYBACK_PROGRAMS_KEY)
    if (savedHistory) {
      try {
        state.history = JSON.parse(savedHistory)
      } catch (e) {
        console.error("Failed to parse history", e)
      }
    }
  }

  return {
    getState: (): RadikoState => state,
    setState: (newState: Partial<RadikoState>): void => {
      state = { ...state, ...newState }
      listeners.forEach((listener) => listener())
    },
    subscribe: (listener: Listener): (() => void) => {
      listeners.push(listener)
      return () => {
        const index = listeners.indexOf(listener)
        if (index > -1) listeners.splice(index, 1)
      }
    },
  }
}

// 状態管理のインスタンスを作成
const stateManager = createRadikoStateManager()

// 拡張したRadikoClientの実装
const RadikoClient = {
  // 既存のメソッド
  getErrorMessage: funcGetErrorMessage,
  getAuthName: getStoredAuthName,
  getAuthInfo: getStoredAuthInfo,

  // 状態管理関連のメソッド
  getState: () => stateManager.getState(),
  subscribe: (listener: Listener) => stateManager.subscribe(listener),
  setState: (newState: Partial<RadikoState>) => stateManager.setState(newState),

  // ユーティリティ
  organizeProgramsByDate(programs: Program[]): ProgramsByDate {
    return programs.reduce((acc: ProgramsByDate, program) => {
      const year = parseInt(program.startTime.substring(0, 4))
      const month = parseInt(program.startTime.substring(4, 6)) - 1
      const day = parseInt(program.startTime.substring(6, 8))
      const hour = parseInt(program.startTime.substring(8, 10))

      const date = new Date(year, month, day)
      if (hour < 5) {
        date.setDate(date.getDate() - 1)
      }

      const dateKey = date
        .toLocaleDateString("ja-JP", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
        .replace(/\D/g, "")

      if (!acc[dateKey]) {
        acc[dateKey] = []
      }
      acc[dateKey].push(program)
      return acc
    }, {})
  },

  // API呼び出しをラップして状態管理を組み込んだメソッド
  authenticate: async (ip: string): Promise<Auth> => {
    try {
      stateManager.setState({ isLoading: true, error: null })
      const result = await authenticateWithIp(ip)
      stateManager.setState({ isLoading: false, auth: result, currentAreaName: getStoredAuthName() })
      return result
    } catch (error) {
      const errorMessage = funcGetErrorMessage(error)
      stateManager.setState({ isLoading: false, error: errorMessage })
      throw error
    }
  },

  customAuthenticate: async (areaId: AreaId): Promise<Auth> => {
    try {
      stateManager.setState({ isLoading: true, error: null })
      const result = await customAuthenticate(areaId)
      stateManager.setState({ isLoading: false, auth: result, currentAreaName: getStoredAuthName() })
      return result
    } catch (error) {
      const errorMessage = funcGetErrorMessage(error)
      stateManager.setState({ isLoading: false, error: errorMessage })
      throw error
    }
  },

  getStations: async (areaId: string, signal?: AbortSignal): Promise<Station[]> => {
    try {
      stateManager.setState({ isLoading: true, error: null })
      const result = await getStations(areaId as AreaId, signal)
      stateManager.setState({ isLoading: false, stations: result })
      return result
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        stateManager.setState({ isLoading: false })
        throw error
      }
      const errorMessage = funcGetErrorMessage(error)
      stateManager.setState({ isLoading: false, error: errorMessage })
      throw error
    }
  },

  // 番組表の取得と状態更新
  fetchPrograms: async (stationId: string, auth: Auth, signal?: AbortSignal) => {
    try {
      const currentState = stateManager.getState()
      stateManager.setState({ isLoading: true, error: null, selectedStation: stationId })
      // 現在放送中の番組
      const nowOnAir = await getProgramNow({
        token: auth.token,
        area: auth.areaId as AreaId,
        stationId,
        signal,
      })
      // 週間番組表
      const programs = await getPrograms({
        token: auth.token,
        stationId,
        type: "weekly",
        signal,
      })
      const programsByDate = RadikoClient.organizeProgramsByDate(programs)
      // 放送局変更時はライブ再生を停止（状態矛盾を防ぐ）
      const shouldStopLivePlayback = currentState.playingType === "live" && currentState.selectedStation !== stationId
      stateManager.setState({
        isLoading: false,
        nowOnAir,
        programs,
        programsByDate,
        ...(shouldStopLivePlayback && { currentProgram: null, playingType: null }),
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      const errorMessage = funcGetErrorMessage(error)
      stateManager.setState({ isLoading: false, error: errorMessage })
    }
  },

  // お気に入り管理
  toggleFavorite: (program: Program) => {
    const state = stateManager.getState()
    const newFavorites = [...state.favorites]
    const existingIndex = newFavorites.findIndex((fav) => fav.title === program.title)

    if (existingIndex >= 0) {
      // 既存のお気に入りを削除
      newFavorites.splice(existingIndex, 1)
    } else {
      // 新しいお気に入りを追加
      newFavorites.push({ stationId: program.station_id, title: program.title })
    }

    localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites))
    stateManager.setState({ favorites: newFavorites })
  },

  // お気に入り番組を視聴履歴へ自動保存
  saveFavoritePrograms: async (stations: Station[]) => {
    if (typeof window === "undefined") return
    const state = stateManager.getState()
    const auth = state.auth

    const savedFavs = localStorage.getItem(FAVORITES_KEY)
    let favorites: Array<{ stationId: string; title: string }> = []
    if (savedFavs) {
      try {
        favorites = JSON.parse(savedFavs)
        stateManager.setState({ favorites })
      } catch (e) {
        console.error("Failed to parse favorites", e)
      }
    }

    if (!favorites.length || !auth) return

    try {
      // お気に入りに登録されている放送局のIDを取得
      const favoriteStationIds = Array.from(new Set(favorites.map((fav) => fav.stationId))).filter((id) =>
        stations.some((station) => station.id === id),
      )

      if (!favoriteStationIds.length) return

      const savedPrograms = RadikoClient.getSavedPlaybackPrograms()
      let updated = false
      const now = new Date()

      for (const stationId of favoriteStationIds) {
        const stationFavorites = favorites.filter((fav) => fav.stationId === stationId)

        const weeklyPrograms = await getPrograms({
          token: auth.token,
          stationId,
          type: "weekly",
        })

        if (!weeklyPrograms || weeklyPrograms.length === 0) continue

        const favoritePrograms = weeklyPrograms.filter((program) => {
          const isFavorite = stationFavorites.some((fav) => fav.title === program.title && fav.stationId === stationId)
          if (!isFavorite) return false

          const endTime = new Date(
            parseInt(program.endTime.substring(0, 4)),
            parseInt(program.endTime.substring(4, 6)) - 1,
            parseInt(program.endTime.substring(6, 8)),
            parseInt(program.endTime.substring(8, 10)),
            parseInt(program.endTime.substring(10, 12)),
          )
          return endTime < now
        })

        favoritePrograms.forEach((program) => {
          const exists = savedPrograms.some(
            (p) => p.station_id === program.station_id && p.startTime === program.startTime,
          )
          if (!exists) {
            savedPrograms.push({ ...program, currentTime: 0 })
            updated = true
          }
        })
      }

      if (updated) {
        localStorage.setItem(PLAYBACK_PROGRAMS_KEY, JSON.stringify(savedPrograms))
        stateManager.setState({ history: savedPrograms })
      }
    } catch (e) {
      console.error("Failed to auto-save favorite programs", e)
    }
  },

  // 再生位置の保存
  savePlaybackProgram: (program: Program, currentTime: number) => {
    if (typeof window === "undefined") return

    try {
      const saved = localStorage.getItem(PLAYBACK_PROGRAMS_KEY)
      let programs: Program[] = saved ? JSON.parse(saved) : []

      const index = programs.findIndex((p) => p.station_id === program.station_id && p.startTime === program.startTime)

      const updatedProgram = { ...program, currentTime }

      if (index >= 0) {
        programs[index] = updatedProgram
      } else {
        programs.push(updatedProgram)
      }

      // 1週間以上前の番組を削除
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
      programs = programs.filter((p) => {
        const pDate = new Date(
          parseInt(p.startTime.substring(0, 4)),
          parseInt(p.startTime.substring(4, 6)) - 1,
          parseInt(p.startTime.substring(6, 8)),
        )
        return pDate >= oneWeekAgo
      })

      localStorage.setItem(PLAYBACK_PROGRAMS_KEY, JSON.stringify(programs))

      // 視聴済みリストの更新
      const playedPrograms = new Set(stateManager.getState().playedPrograms)
      if (currentTime === -1) {
        playedPrograms.add(`${program.station_id}-${program.startTime}`)
      }
      stateManager.setState({ playedPrograms, history: programs })
    } catch (e) {
      console.error("Failed to save playback program", e)
    }
  },

  // 履歴から削除
  removeFromHistory: (stationId: string, startTime: string) => {
    if (typeof window === "undefined") return
    try {
      const saved = localStorage.getItem(PLAYBACK_PROGRAMS_KEY)
      if (!saved) return
      let programs: Program[] = JSON.parse(saved)
      programs = programs.filter((p) => !(p.station_id === stationId && p.startTime === startTime))
      localStorage.setItem(PLAYBACK_PROGRAMS_KEY, JSON.stringify(programs))

      const playedPrograms = new Set(stateManager.getState().playedPrograms)
      playedPrograms.delete(`${stationId}-${startTime}`)
      stateManager.setState({ playedPrograms, history: programs })
    } catch (e) {
      console.error("Failed to remove from history", e)
    }
  },

  // 視聴済みとしてマーク
  markAsProgramPlayed: (stationId: string, startTime: string) => {
    const playedPrograms = new Set(stateManager.getState().playedPrograms)
    playedPrograms.add(`${stationId}-${startTime}`)
    stateManager.setState({ playedPrograms })

    // localStorageにも反映（savePlaybackProgramを流用）
    const saved = localStorage.getItem(PLAYBACK_PROGRAMS_KEY)
    if (saved) {
      try {
        const programs: Program[] = JSON.parse(saved)
        const program = programs.find((p) => p.station_id === stationId && p.startTime === startTime)
        if (program) {
          RadikoClient.savePlaybackProgram(program, -1)
        }
      } catch (e) {
        console.error("Failed to mark as played", e)
      }
    }
  },

  // 再生情報の復元
  restorePlaybackProgram: async (stations: Station[]) => {
    if (typeof window === "undefined") return null
    try {
      const saved = localStorage.getItem(PLAYBACK_PROGRAMS_KEY)
      if (!saved) return null
      let programs: Program[] = JSON.parse(saved)
      if (programs.length === 0) return null

      // 1週間以上前の番組を削除
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
      programs = programs.filter((p) => {
        const pDate = new Date(
          parseInt(p.startTime.substring(0, 4)),
          parseInt(p.startTime.substring(4, 6)) - 1,
          parseInt(p.startTime.substring(6, 8)),
        )
        return pDate >= oneWeekAgo
      })
      localStorage.setItem(PLAYBACK_PROGRAMS_KEY, JSON.stringify(programs))

      // 現在のエリアで再生可能な番組のみに絞り込む
      const availablePrograms = programs.filter((p) => stations.some((s) => s.id === p.station_id))
      if (availablePrograms.length === 0) return null

      // 再生途中の番組（currentTime > 0）を抽出
      const inProgressPrograms = availablePrograms.filter((p) => (p.currentTime || 0) > 0)

      let programToPlay: Program
      if (inProgressPrograms.length > 0) {
        // 1. 再生途中の番組がある場合は、その中から放送日が最も古い番組を選択
        programToPlay = inProgressPrograms.reduce((oldest, current) => {
          return parseInt(current.startTime) < parseInt(oldest.startTime) ? current : oldest
        })
      } else {
        // 2. 再生途中の番組がない場合は、未視聴の番組から放送日が最も古い番組を選択
        // (currentTime === -1 は視聴済み)
        const unplayedPrograms = availablePrograms.filter((p) => (p.currentTime || 0) >= 0)
        if (unplayedPrograms.length === 0) return null
        programToPlay = unplayedPrograms.reduce((oldest, current) => {
          return parseInt(current.startTime) < parseInt(oldest.startTime) ? current : oldest
        })
      }

      const savedSpeed = localStorage.getItem(PLAYBACK_SPEED_KEY)
      const speed = savedSpeed ? parseFloat(savedSpeed) : 1.0

      return { program: programToPlay, speed }
    } catch (e) {
      console.error("Failed to restore playback program", e)
      return null
    }
  },

  // 保存された再生情報を取得
  getSavedPlaybackPrograms: (): Program[] => {
    if (typeof window === "undefined") return []
    try {
      const saved = localStorage.getItem(PLAYBACK_PROGRAMS_KEY)
      return saved ? JSON.parse(saved) : []
    } catch (e) {
      console.error("Failed to get saved playback programs", e)
      return []
    }
  },

  // 履歴に追加
  addToHistory: (program: Program) => {
    const state = stateManager.getState()
    const history = [
      program,
      ...state.history.filter((p) => !(p.station_id === program.station_id && p.startTime === program.startTime)),
    ].slice(0, 50)
    stateManager.setState({ history })
    if (typeof window !== "undefined") {
      localStorage.setItem(PLAYBACK_PROGRAMS_KEY, JSON.stringify(history))
    }
  },

  // 放送局選択（UIからの直接操作用）
  selectStation: (stationId: string) => {
    const currentState = stateManager.getState()
    stateManager.setState({ selectedStation: stationId })
    if (currentState.auth) {
      void RadikoClient.fetchPrograms(stationId, currentState.auth)
    }
  },

  // 再生状態の判定 (SSOT)
  isProgramPlaying: (program: Program, type: "live" | "timefree"): boolean => {
    const state = stateManager.getState()
    return (
      state.playingType === type &&
      state.currentProgram?.station_id === program.station_id &&
      state.currentProgram?.startTime === program.startTime
    )
  },

  // 再生開始
  playProgram: (program: Program, type: "live" | "timefree") => {
    stateManager.setState({ currentProgram: program, playingType: type })
  },

  // 再生停止
  stopPlayback: () => {
    stateManager.setState({ currentProgram: null, playingType: null })
  },
}

export default RadikoClient

// Reactフック：RadikoClientの状態を使用するためのカスタムフック
export function useRadikoState(): RadikoState {
  return useSyncExternalStore(
    RadikoClient.subscribe,
    RadikoClient.getState,
    RadikoClient.getState, // サーバーサイド用
  )
}
