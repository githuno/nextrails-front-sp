import { useCallback, useEffect, useMemo, useReducer, useRef } from "react"
import { decodeState, encodeState } from "./utils/encodeUrlState"
import { getFallbackValue, setFallbackValue } from "./utils/localStorage"
import { usePathname, useRouter, useSearchParams } from "./utils/useRouting"
// import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { validate, type Validator } from "./utils/validator"

// グローバルキーマップのストレージキー
const URL_STATE_KEY_MAP = "urlState_keyMap"

// キーマップの永続化機能
function getStoredKeyMap(): Map<string, string> {
  if (typeof window === "undefined") return new Map()

  try {
    const stored = sessionStorage.getItem(URL_STATE_KEY_MAP)
    if (!stored) return new Map()
    return new Map(JSON.parse(stored))
  } catch {
    return new Map()
  }
}

function setStoredKeyMap(map: Map<string, string>): void {
  if (typeof window === "undefined") return

  try {
    sessionStorage.setItem(URL_STATE_KEY_MAP, JSON.stringify(Array.from(map.entries())))
  } catch {
    console.warn("[useUrlState] Failed to store key map")
  }
}

// グローバルにキーマップを保持（初期値をsessionStorageから復元）
const GLOBAL_KEY_MAP = getStoredKeyMap()

// ========= 基本型定義 =========
type HistoryMode = "push" | "replace"
type StateSource = "url" | "localStorage" | "sessionStorage" | "memory"
type StorageType = "local" | "session" | "memory"

// コア設定（シンプルな使用に必要な最小限のプロパティ）
interface CoreConfig<T> {
  key: string
  defaultValue: T
  validator?: Validator<T>
  debounceMs?: number
  history?: HistoryMode
  prefix?: string
}

// ストレージ設定（必要に応じて使用）
interface StorageOptions {
  type?: StorageType
  syncWithUrl?: boolean
  customKey?: string
}

// CoreConfig型とStorageOptionsの統合
interface FullConfig<T> extends CoreConfig<T> {
  storage?: StorageOptions
}

// 高度な設定（オプショナル）
interface AdvancedOptions<T> {
  compare?: (a: T, b: T) => boolean
  onChange?: (newValue: T, oldValue: T) => void
  onError?: (error: StateError) => void
  debug?: boolean
  transform?: {
    serialize?: (value: T) => string
    deserialize?: (raw: string, defaultValue: T) => T
  }
}

// エラー型
interface StateError {
  type: string
  message: string
  key: string
  details?: unknown
  timestamp: Date
}

// 基本セッター型
interface SetStateBase<T> {
  (value: T | ((prev: T) => T) | null): void
  reset: () => void
  clearStorage: () => void
  setStorageEnabled: (enabled: boolean) => void
}

// ブール値用拡張セッター
interface BooleanSetState extends SetStateBase<boolean> {
  toggle: () => void
}

// オブジェクト用拡張セッター
interface ObjectSetState<T extends Record<string, any>> extends SetStateBase<T> {
  patch: <K extends keyof T>(key: K, value: T[K]) => void
  remove: <K extends keyof T>(key: K) => void
}

// 配列用拡張セッター
interface ArraySetState<T extends any[]> extends SetStateBase<T> {
  push: (...items: T extends (infer U)[] ? U[] : never[]) => void
  filter: (predicate: (value: T extends (infer U)[] ? U : never, index: number) => boolean) => void
}

// 型に基づいた適切なセッター型を選択
type EnhancedSetState<T> = T extends boolean
  ? BooleanSetState
  : T extends any[]
    ? ArraySetState<T>
    : T extends Record<string, any>
      ? ObjectSetState<T>
      : SetStateBase<T>

// メタデータ型
interface StateMeta {
  source: StateSource
  lastUpdated: Date | null
  urlSize: number
}

// 拡張API型
interface UrlStateApi<T> {
  state: T
  setState: EnhancedSetState<T>
  error: StateError | null
  isLoading: boolean
  meta: StateMeta
}

// 内部アクション型
type StateAction<T> =
  | { type: "INIT"; payload: T }
  | { type: "SET"; payload: T | null }
  | { type: "PATCH"; key: keyof T; value: any }
  | { type: "REMOVE"; key: keyof T }
  | { type: "RESET" }
  | { type: "PUSH"; items: any[] }
  | { type: "FILTER"; predicate: (value: any, index: number) => boolean }

// 内部状態型
interface InternalState {
  fullKey: string
  error: StateError | null
  isLoading: boolean
  lastUpdated: Date | null
  source: StateSource
  initialized: boolean
  prevSearchParams: string
  lastUrlSize: number
  storageEnabled: boolean
}

// ========= API オーバーロード =========

/**
 * useState相当の最もシンプルな使い方
 * ```tsx
 * const [count, setCount] = useUrlState<number>(0);
 * ```
 */
export function useUrlState<T>(defaultValue: T): [T, EnhancedSetState<T>]

/**
 * キーを指定したシンプルな使い方
 * ```tsx
 * const [filters, setFilters] = useUrlState("filters", { category: "all" });
 * ```
 */
export function useUrlState<T>(key: string, defaultValue: T): [T, EnhancedSetState<T>]

/**
 * 設定オブジェクトによる詳細設定
 * ```tsx
 * const [state, setState] = useUrlState({
 *   key: "filters",
 *   defaultValue: { category: "all" },
 *   debounceMs: 300,
 *   storage: { type: "local" } // ストレージオプションも含む
 * });
 * ```
 */
export function useUrlState<T>(config: FullConfig<T> & Partial<AdvancedOptions<T>>): [T, EnhancedSetState<T>]

/**
 * 拡張APIによる高度な機能へのアクセス
 * ```tsx
 * const { state, setState, error, meta } = useUrlState({
 *   key: "settings",
 *   defaultValue: { theme: "light" },
 *   storage: { type: "local", syncWithUrl: true },
 *   debug: true
 * }, { extended: true });
 * ```
 */
export function useUrlState<T>(
  config: FullConfig<T> & Partial<AdvancedOptions<T>>,
  options: { extended: true },
): UrlStateApi<T>

/**
 * 実装
 */
export function useUrlState<T>(
  configOrKeyOrDefault?: string | T | (CoreConfig<T> & { storage?: StorageOptions } & Partial<AdvancedOptions<T>>),
  optionsOrDefault?: T | { extended: boolean },
): [T, EnhancedSetState<T>] | UrlStateApi<T> {
  // ======= 引数の処理 =======
  let config: CoreConfig<T> & { storage?: StorageOptions } & Partial<AdvancedOptions<T>>
  let returnExtendedApi = false

  // シンプルな使用法
  if (
    configOrKeyOrDefault !== undefined &&
    typeof configOrKeyOrDefault !== "string" &&
    !(configOrKeyOrDefault && typeof configOrKeyOrDefault === "object" && "key" in configOrKeyOrDefault)
  ) {
    const defaultValue = configOrKeyOrDefault as T
    const valueType = typeof defaultValue
    const valueKey = `${valueType}_${JSON.stringify(defaultValue)}`

    if (!GLOBAL_KEY_MAP.has(valueKey)) {
      const newKey = `urlState_${valueType}_${Math.random().toString(36).substring(2, 9)}`
      GLOBAL_KEY_MAP.set(valueKey, newKey)
      // キーマップの変更を保存
      setStoredKeyMap(GLOBAL_KEY_MAP)
    }

    config = {
      key: GLOBAL_KEY_MAP.get(valueKey)!,
      defaultValue,
      history: "replace" as const,
    }
  }
  // useUrlState("key", defaultValue) の使用法
  else if (typeof configOrKeyOrDefault === "string") {
    config = {
      key: configOrKeyOrDefault,
      defaultValue: optionsOrDefault as T,
    }
  }
  // useUrlState({ key: "key", defaultValue: value, ...options })
  else {
    config = configOrKeyOrDefault as CoreConfig<T> & {
      storage?: StorageOptions
    } & Partial<AdvancedOptions<T>>

    // 拡張APIを返すかチェック
    if (optionsOrDefault && typeof optionsOrDefault === "object" && "extended" in optionsOrDefault) {
      returnExtendedApi = optionsOrDefault.extended
    }
  }

  // ======= 設定の解析 =======
  const {
    key,
    defaultValue,
    validator,
    debounceMs,
    history = "replace",
    prefix,
    storage = {},
    compare,
    onChange,
    onError,
    debug = false,
    transform,
  } = config

  // ======= Core hooks =======
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const debounce = useDebounce(debounceMs)

  // ======= 内部状態管理 =======
  const internalState = useRef<InternalState>({
    fullKey: prefix ? `${prefix}.${key}` : key,
    error: null,
    isLoading: false,
    lastUpdated: null,
    source: "memory",
    initialized: false,
    prevSearchParams: "",
    lastUrlSize: 0,
    storageEnabled: storage.type !== undefined,
  })

  // ======= エラーハンドラー =======
  const handleError = useCallback(
    (type: string, message: string, details?: unknown): StateError => {
      const error: StateError = {
        type,
        message,
        key: internalState.current.fullKey,
        details,
        timestamp: new Date(),
      }

      internalState.current.error = error

      if (debug) {
        console.error(`[useUrlState] ${message}`, details)
      }

      if (onError) {
        onError(error)
      }

      return error
    },
    [debug, onError],
  )

  // ======= ステートレデューサー =======
  const reducer = useCallback(
    (state: T, action: StateAction<T>): T => {
      switch (action.type) {
        case "INIT":
          return action.payload

        case "SET":
          return action.payload === null ? defaultValue : action.payload

        case "PATCH": {
          // オブジェクト型のみ
          if (typeof state !== "object" || state === null) {
            handleError("type_error", `Cannot patch a non-object state of type ${typeof state}`, { state, action })
            return state
          }

          return {
            ...(state as object),
            [action.key]: action.value,
          } as T
        }

        case "REMOVE": {
          // オブジェクト型のみ
          if (typeof state !== "object" || state === null) {
            handleError("type_error", `Cannot remove property from a non-object state of type ${typeof state}`, {
              state,
              action,
            })
            return state
          }

          const newState = { ...(state as object) }
          delete (newState as any)[action.key as string]
          return newState as T
        }

        case "PUSH": {
          // 配列型のみ
          if (!Array.isArray(state)) {
            handleError("type_error", `Cannot push to a non-array state of type ${typeof state}`, { state, action })
            return state
          }

          return [...state, ...action.items] as unknown as T
        }

        case "FILTER": {
          // 配列型のみ
          if (!Array.isArray(state)) {
            handleError("type_error", `Cannot filter a non-array state of type ${typeof state}`, { state, action })
            return state
          }

          return state.filter(action.predicate) as unknown as T
        }

        case "RESET":
          return defaultValue

        default:
          return state
      }
    },
    [defaultValue, handleError],
  )

  // ======= 初期状態のロード =======
  const loadInitialState = useCallback((): T => {
    try {
      internalState.current.isLoading = true

      if (debug) {
        console.log(`[useUrlState] Loading state for ${internalState.current.fullKey}`)
      }

      // URLパラメータをチェック
      const raw = searchParams.get(internalState.current.fullKey)
      let value = defaultValue
      internalState.current.source = "memory"

      // ストレージからの読み込み
      if (storage.type === "local" || storage.type === "session") {
        const storageKey = storage.customKey || internalState.current.fullKey

        try {
          const storedValue =
            storage.type === "local"
              ? getFallbackValue(storageKey, null) // defaultValueではなくnullを渡してデフォルト値の混入を防ぐ
              : (() => {
                  if (typeof window === "undefined") return null
                  try {
                    const item = sessionStorage.getItem(storageKey)
                    return item ? JSON.parse(item) : null
                  } catch {
                    return null
                  }
                })()

          // 明示的に保存された値のみを使用
          if (storedValue !== null && storedValue !== undefined) {
            value = storedValue
            internalState.current.source = storage.type === "local" ? "localStorage" : "sessionStorage"

            if (debug) {
              console.log(`[useUrlState] Loaded value from ${internalState.current.source}:`, storedValue)
            }
          }
        } catch (err) {
          handleError("storage_error", "Failed to load from storage", err)
        }
      }

      // URLパラメータがあれば優先
      if (raw) {
        try {
          const decoded = transform?.deserialize ? transform.deserialize(raw, value) : decodeState(raw, value)

          value = decoded
          internalState.current.source = "url"

          // URL サイズを追跡
          internalState.current.lastUrlSize = raw.length
        } catch (err) {
          handleError("decode_error", "Failed to decode URL parameter", err)
        }
      }

      // バリデーション
      if (validator) {
        try {
          value = validate(value, validator, defaultValue)
        } catch (err) {
          handleError("validation_error", "Validation failed", err)
          value = defaultValue
        }
      }

      return value
    } catch (err) {
      handleError("load_error", "Failed to load state", err)
      return defaultValue
    } finally {
      internalState.current.isLoading = false
    }
  }, [searchParams, defaultValue, validator, storage, transform, handleError, debug])

  // ======= 状態ストア =======
  const [state, dispatch] = useReducer(reducer, defaultValue)

  // ======= 状態の永続化 =======
  const persistState = useCallback(
    (newState: T | null) => {
      try {
        const params = new URLSearchParams(searchParams.toString())

        // 値の比較関数
        const isDefaultValue = (): boolean => {
          // 厳密比較でデフォルト値と一致するか
          if (newState === defaultValue) return true
          // カスタム比較関数があればそれを使用
          if (compare && compare(newState as T, defaultValue)) return true
          // 空の配列や空のオブジェクトもデフォルト扱いにする追加チェック
          if (
            Array.isArray(newState) &&
            newState.length === 0 &&
            Array.isArray(defaultValue) &&
            defaultValue.length === 0
          )
            return true
          return false
        }

        // nullまたはデフォルト値と同等の場合はURLパラメータを削除
        if (newState === null || isDefaultValue()) {
          params.delete(internalState.current.fullKey)

          // ストレージからも削除
          if (storage.type === "local") {
            setFallbackValue(storage.customKey || internalState.current.fullKey, null)
          } else if (storage.type === "session") {
            try {
              if (typeof window !== "undefined") {
                sessionStorage.removeItem(storage.customKey || internalState.current.fullKey)
              }
            } catch (err) {
              handleError("storage_error", "Failed to remove from sessionStorage", err)
            }
          }

          internalState.current.source = "memory"
          internalState.current.lastUrlSize = 0
        } else {
          // エンコードしてURLに設定
          try {
            const encoded = transform?.serialize ? transform.serialize(newState) : encodeState(newState)

            params.set(internalState.current.fullKey, encoded)
            internalState.current.source = "url"
            internalState.current.lastUrlSize = encoded.length

            // ストレージオプションが有効な場合は保存
            if (storage.type && internalState.current.storageEnabled) {
              if (storage.type === "local") {
                setFallbackValue(storage.customKey || internalState.current.fullKey, newState)
              } else if (storage.type === "session") {
                try {
                  if (typeof window !== "undefined") {
                    sessionStorage.setItem(storage.customKey || internalState.current.fullKey, JSON.stringify(newState))
                  }
                } catch (err) {
                  handleError("storage_error", "Failed to save to storage", err)
                }
              }
            }
          } catch (err) {
            handleError("encode_error", "Failed to encode state", err)
          }
        }

        // URLを更新（スクロール防止オプションを追加）
        const query = params.toString()
        const newUrl = query ? `${pathname}?${query}` : pathname
        const options = {
          scroll: false, // スクロールを防止
        }

        history === "replace" ? router.replace(newUrl, options) : router.push(newUrl, options)

        // メタデータ更新
        internalState.current.lastUpdated = new Date()
      } catch (err) {
        handleError("persist_error", "Failed to persist state", err)
      }
    },
    [searchParams, pathname, router, history, storage, transform, handleError, compare, defaultValue],
  )

  // ======= URLからの状態同期 =======
  useEffect(() => {
    const currentParams = searchParams.toString()

    // 初回ロードまたはURLパラメータが変更された場合に更新
    if (!internalState.current.initialized || currentParams !== internalState.current.prevSearchParams) {
      internalState.current.prevSearchParams = currentParams
      internalState.current.initialized = true

      // 初期状態をロードしてreducerに通知
      const initialState = loadInitialState()
      dispatch({ type: "INIT", payload: initialState })

      // 初回ロード時にストレージから値を読み込んだ場合、URLにも反映させる
      // URLパラメータが存在せず、ストレージから値を読み込んだ場合
      if (
        !searchParams.has(internalState.current.fullKey) &&
        (internalState.current.source === "localStorage" || internalState.current.source === "sessionStorage") &&
        pathname !== "/" && // pathnameが初期値でないことを確認
        initialState !== defaultValue
      ) {
        // 少し遅延させてURLを更新（ハイドレーション完全完了後）
        setTimeout(() => {
          persistState(initialState)
        }, 0)
      }
    }
  }, [searchParams, loadInitialState, persistState, defaultValue, pathname])

  // ======= 状態更新の基本関数 =======
  const setStateBase = useCallback(
    (value: T | ((prev: T) => T) | null) => {
      // 新しい状態を計算
      const newState = value === null ? null : typeof value === "function" ? (value as (prev: T) => T)(state) : value

      // 変更がなければスキップ
      if (newState !== null) {
        const compareValues =
          compare ||
          ((a, b) => {
            if (typeof a !== typeof b) return false

            if (Array.isArray(a) && Array.isArray(b)) {
              if (a.length !== b.length) return false
              return a.every((item, i) => item === b[i])
            }

            if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) {
              const keysA = Object.keys(a)
              const keysB = Object.keys(b)

              if (keysA.length !== keysB.length) return false

              return keysA.every(
                (key) => Object.prototype.hasOwnProperty.call(b, key) && (a as any)[key] === (b as any)[key],
              )
            }

            return a === b
          })

        if (compareValues(newState, state)) {
          if (debug) {
            console.log("[useUrlState] State unchanged, skipping update")
          }
          return
        }
      }

      // 前の状態を保存
      const prevState = state

      // 状態を更新
      dispatch({ type: "SET", payload: newState })

      // 状態の永続化
      debounce(() => {
        persistState(newState)

        // 変更通知
        if (onChange) {
          onChange(newState as T, prevState)
        }
      })
    },
    [state, compare, persistState, onChange, debounce, debug],
  )

  // ======= リセット機能 =======
  const resetState = useCallback(() => {
    dispatch({ type: "RESET" })

    debounce(() => {
      persistState(defaultValue)
      if (onChange) onChange(defaultValue, state)
    })
  }, [defaultValue, state, persistState, onChange, debounce])

  // ======= パッチ機能（オブジェクト用） =======
  const patchState = useCallback(
    <K extends keyof T>(key: K, value: T[K]) => {
      if (typeof state !== "object" || state === null) {
        handleError("type_error", `Cannot patch a non-object state of type ${typeof state}`, { currentState: state })
        return
      }

      dispatch({ type: "PATCH", key, value })

      debounce(() => {
        const newState = { ...(state as object), [key]: value } as T
        persistState(newState)
        if (onChange) onChange(newState, state)
      })
    },
    [state, persistState, onChange, debounce, handleError],
  )

  // ======= プロパティ削除機能（オブジェクト用） =======
  const removeState = useCallback(
    <K extends keyof T>(key: K) => {
      if (typeof state !== "object" || state === null) {
        handleError("type_error", `Cannot remove property from a non-object state of type ${typeof state}`, {
          currentState: state,
        })
        return
      }

      dispatch({ type: "REMOVE", key })

      debounce(() => {
        const newState = { ...(state as object) } as any
        delete newState[key as string]
        persistState(newState as T)
        if (onChange) onChange(newState as T, state)
      })
    },
    [state, persistState, onChange, debounce, handleError],
  )

  // ======= 配列追加機能（配列用） =======
  const pushState = useCallback(
    (...items: any[]) => {
      if (!Array.isArray(state)) {
        handleError("type_error", `Cannot push to a non-array state of type ${typeof state}`, { currentState: state })
        return
      }

      dispatch({ type: "PUSH", items })

      debounce(() => {
        const newState = [...state, ...items] as unknown as T
        persistState(newState)
        if (onChange) onChange(newState, state)
      })
    },
    [state, persistState, onChange, debounce, handleError],
  )

  // ======= 配列フィルター機能（配列用） =======
  const filterState = useCallback(
    (predicate: (value: any, index: number) => boolean) => {
      if (!Array.isArray(state)) {
        handleError("type_error", `Cannot filter a non-array state of type ${typeof state}`, { currentState: state })
        return
      }

      dispatch({ type: "FILTER", predicate })

      debounce(() => {
        const newState = state.filter(predicate) as unknown as T
        persistState(newState)
        if (onChange) onChange(newState, state)
      })
    },
    [state, persistState, onChange, debounce, handleError],
  )

  // ======= トグル機能（ブール値用） =======
  const toggleState = useCallback(() => {
    if (typeof state !== "boolean") {
      handleError("type_error", `Cannot toggle a non-boolean state of type ${typeof state}`, { currentState: state })
      return
    }

    const newState = !state as unknown as T
    dispatch({ type: "SET", payload: newState })

    debounce(() => {
      persistState(newState)
      if (onChange) onChange(newState, state)
    })
  }, [state, persistState, onChange, debounce, handleError])

  // ======= ストレージクリア機能 =======
  const clearStorage = useCallback(() => {
    // ストレージから値のみを削除（URL状態は維持）
    if (storage.type === "local") {
      setFallbackValue(storage.customKey || internalState.current.fullKey, null)
      if (debug) {
        console.log(`[useUrlState] Cleared localStorage for ${internalState.current.fullKey}`)
      }
    } else if (storage.type === "session") {
      try {
        if (typeof window !== "undefined") {
          sessionStorage.removeItem(storage.customKey || internalState.current.fullKey)
          if (debug) {
            console.log(`[useUrlState] Cleared sessionStorage for ${internalState.current.fullKey}`)
          }
        }
      } catch (err) {
        handleError("storage_error", "Failed to remove from storage", err)
      }
    }
  }, [storage, handleError, debug])

  // ======= ストレージ有効・無効切り替え =======
  const setStorageEnabled = useCallback(
    (enabled: boolean) => {
      // フラグを更新
      internalState.current.storageEnabled = enabled
      if (debug) {
        console.log(`[useUrlState] Storage ${enabled ? "enabled" : "disabled"} for ${internalState.current.fullKey}`)
        console.log(`[useUrlState] Storage type: ${storage.type || "none"}`)
      }
      if (!storage.type) return

      // 無効: ストレージから削除
      if (!enabled) {
        clearStorage()
      }

      // 有効: 現在の状態をストレージに保存
      else {
        const storageKey = storage.customKey || internalState.current.fullKey
        switch (storage.type) {
          case "local":
            setFallbackValue(storageKey, state)
            if (debug) {
              console.log(`[useUrlState] Saved current state to localStorage for ${storageKey}`)
            }
            break
          case "session":
            try {
              if (typeof window !== "undefined") {
                sessionStorage.setItem(storageKey, JSON.stringify(state))
                if (debug) {
                  console.log(`[useUrlState] Saved current state to sessionStorage for ${storageKey}`)
                }
              }
            } catch (err) {
              handleError("storage_error", "Failed to save to sessionStorage", err)
            }
            break
          case "memory":
            // メモリストレージは特に何もしない
            break
          default:
            handleError("storage_error", `Unknown storage type: ${storage.type}`, { storageType: storage.type })
            break
        }
      }
    },
    [debug, clearStorage, storage, state, handleError],
  )

  // ======= 拡張セッター構築 =======
  const createEnhancedSetter = useCallback(
    <S extends T>(baseState: S): EnhancedSetState<S> => {
      // 基本セッター
      const setter = setStateBase as any
      setter.reset = resetState
      setter.clearStorage = clearStorage
      setter.setStorageEnabled = setStorageEnabled

      // 型ごとのメソッド追加
      if (typeof baseState === "boolean") {
        setter.toggle = toggleState
        return setter as EnhancedSetState<S>
      }

      if (Array.isArray(baseState)) {
        setter.push = pushState
        setter.filter = filterState
        return setter as EnhancedSetState<S>
      }

      if (typeof baseState === "object" && baseState !== null && !Array.isArray(baseState)) {
        setter.patch = patchState
        setter.remove = removeState
        return setter as EnhancedSetState<S>
      }

      return setter as EnhancedSetState<S>
    },
    [
      setStateBase,
      resetState,
      toggleState,
      pushState,
      filterState,
      patchState,
      removeState,
      clearStorage,
      setStorageEnabled,
    ],
  )

  // ======= メタデータ構築 =======
  const meta: StateMeta = useMemo(
    () => ({
      source: internalState.current.source,
      lastUpdated: internalState.current.lastUpdated,
      urlSize: internalState.current.lastUrlSize,
    }),
    [],
  )

  // ======= 拡張APIを構築 =======
  const api: UrlStateApi<T> = useMemo(
    () => ({
      state,
      setState: createEnhancedSetter(state),
      error: internalState.current.error,
      isLoading: internalState.current.isLoading,
      meta,
    }),
    [state, createEnhancedSetter, meta],
  )

  // ======= 拡張APIまたは標準形式を返す =======
  return returnExtendedApi ? api : [state, createEnhancedSetter(state)]
}

// ======== デバウンス関数 =======
function useDebounce(delay?: number) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  return (fn: () => void) => {
    if (!delay) {
      fn()
      return
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(fn, delay)
  }
}
