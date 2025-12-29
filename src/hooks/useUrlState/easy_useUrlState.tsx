import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

/**
 * シンプルな URL 状態管理フック
 *
 * @example
 * // 基本的な使い方
 * const [count, setCount] = useUrlState("count", 0);
 *
 * // フォーム入力で使用する場合（即時反映、URLの更新は遅延）
 * const [searchText, setSearchText] = useUrlState("q", "", {
 *   debounceUrl: 500,
 *   syncToUrl: false
 * });
 *
 * // オプション付きの使い方
 * const [filters, setFilters] = useUrlState("filters", { category: "all" }, {
 *   debounceUrl: 300,
 *   storage: "local"
 * });
 */
export function useUrlState<T>(
  key: string,
  defaultValue: T,
  options: {
    debounceUrl?: number // URLの更新だけを遅延させる
    history?: "push" | "replace"
    storage?: "local" | "session" | "none"
    syncToUrl?: boolean // 値の変更時に即座に状態を更新するか（URLは遅延可能）
  } = {},
): [T, (value: T | ((prev: T) => T)) => void] {
  // オプションの設定
  const { debounceUrl = 0, history = "replace", storage = "none", syncToUrl = true } = options

  // 必要なhooksの初期化
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const firstRenderRef = useRef(true)

  // 初期値を決定（URLパラメータ > ストレージ > デフォルト値）
  const getInitialValue = useCallback((): T => {
    try {
      // URLパラメータを最優先で確認
      const urlParam = searchParams.get(key)
      if (urlParam) {
        return JSON.parse(decodeURIComponent(urlParam))
      }

      // ブラウザ環境かつストレージが指定されている場合
      if (typeof window !== "undefined" && storage !== "none") {
        const storageApi = storage === "local" ? localStorage : sessionStorage
        const storedValue = storageApi.getItem(key)
        if (storedValue) {
          return JSON.parse(storedValue)
        }
      }
    } catch (error) {
      console.warn(`[useUrlState] 初期値の読み込みエラー:`, error)
    }

    // 上記で取得できなければデフォルト値を返す
    return defaultValue
  }, [searchParams, key, defaultValue, storage])

  // 状態の初期化
  const [state, setStateInternal] = useState<T>(getInitialValue)
  const stateRef = useRef<T>(state)

  // stateの変更をrefに同期
  useEffect(() => {
    stateRef.current = state
  }, [state])

  // ローカル状態とURL同期の分離（これが重要）
  const pendingUrlUpdateRef = useRef<T | null>(null)

  // 状態変更時のURL更新処理
  const updateUrl = useCallback(
    (value: T) => {
      try {
        const params = new URLSearchParams(searchParams.toString())
        const isDefault = JSON.stringify(value) === JSON.stringify(defaultValue)

        if (isDefault) {
          // デフォルト値の場合はURLパラメータから削除
          params.delete(key)
        } else {
          // それ以外の場合は値をURLに設定
          params.set(key, encodeURIComponent(JSON.stringify(value)))
        }

        // URLを更新
        const query = params.toString()
        const newUrl = query ? `${pathname}?${query}` : pathname

        if (history === "replace") {
          router.replace(newUrl, { scroll: false })
        } else {
          router.push(newUrl, { scroll: false })
        }

        // ストレージにも保存（指定がある場合）
        if (typeof window !== "undefined" && storage !== "none") {
          const storageApi = storage === "local" ? localStorage : sessionStorage
          if (isDefault) {
            storageApi.removeItem(key)
          } else {
            storageApi.setItem(key, JSON.stringify(value))
          }
        }

        // 保留中のURL更新をクリア
        pendingUrlUpdateRef.current = null
      } catch (error) {
        console.warn(`[useUrlState] URL更新エラー:`, error)
      }
    },
    [searchParams, key, defaultValue, pathname, router, history, storage],
  )

  // URLパラメータが変わったら状態を更新（ただし外部からの変更の場合のみ）
  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false
      return
    }

    // 保留中のURL更新がある場合はスキップ（ローカルで更新中）
    if (pendingUrlUpdateRef.current !== null) {
      return
    }

    const urlParam = searchParams.get(key)
    try {
      if (urlParam) {
        const parsedValue = JSON.parse(decodeURIComponent(urlParam))
        // 値が変わった場合のみ更新
        if (JSON.stringify(parsedValue) !== JSON.stringify(stateRef.current)) {
          // 同期的なsetStateを避けるためにマイクロタスクを使用
          queueMicrotask(() => {
            setStateInternal(parsedValue)
          })
        }
      } else if (JSON.stringify(stateRef.current) !== JSON.stringify(defaultValue)) {
        // URLパラメータが削除された場合はデフォルト値に戻す
        // 同期的なsetStateを避けるためにマイクロタスクを使用
        queueMicrotask(() => {
          setStateInternal(defaultValue)
        })
      }
    } catch (error) {
      console.warn(`[useUrlState] URLパラメータ解析エラー:`, error)
    }
  }, [searchParams, key, defaultValue])

  // 状態を更新し、URLに反映する関数
  const setState = useCallback(
    (value: T | ((prev: T) => T)) => {
      // 関数かそのままの値かを判定
      const newValue = typeof value === "function" ? (value as Function)(state) : value

      // 単純な文字列や数値の場合、入力の反応性を最大化するため比較をスキップ
      const skipCompare = typeof newValue === "string" || typeof newValue === "number"

      // 値が変わらなければ何もしない（ただし単純な型は常に更新、反応性向上のため）
      if (!skipCompare && JSON.stringify(newValue) === JSON.stringify(state)) {
        return
      }

      // 常に状態は即時更新（入力の遅延感をなくす）
      setStateInternal(newValue)

      // URLの同期が無効な場合は終了
      if (!syncToUrl) return

      // 直前の更新をキャンセル
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // URL更新を保留状態にする
      pendingUrlUpdateRef.current = newValue

      // URLの更新だけを遅延させる
      if (debounceUrl > 0) {
        timeoutRef.current = setTimeout(() => {
          updateUrl(newValue)
        }, debounceUrl)
      } else {
        updateUrl(newValue)
      }
    },
    [state, updateUrl, debounceUrl, syncToUrl],
  )

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)

        // コンポーネントがアンマウントされる前に保留中の更新を実行
        if (pendingUrlUpdateRef.current !== null) {
          updateUrl(pendingUrlUpdateRef.current)
        }
      }
    }
  }, [updateUrl])

  return [state, setState]
}

/** 使用例
 * 
function SearchForm() {
  // 検索テキストはタイピング中にすぐ反映するが、URLは500ms後に更新
  const [searchText, setSearchText] = useUrlState("q", "", {
    debounceUrl: 500
  });
  
  // 入力中は状態だけを更新し、URLはBlurかEnterキー押下時のみ反映
  const [draftText, setDraftText] = useUrlState("draft", "", {
    syncToUrl: false
  });
  
  const handleSubmit = () => {
    // draftTextをURL状態に反映する場合は別途更新処理が必要
    const [_, updateSearchParam] = useUrlState("q", "");
    updateSearchParam(draftText);
  };
  
  return (
    <div>
      == タイピング中もURLが更新されるが、デバウンスされる ==
      <input
        type="text"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        placeholder="リアルタイム検索（デバウンスあり）" 
      />
      
      == フォーカスが外れるまでURLは更新されない ==
      <input
        type="text"
        value={draftText}
        onChange={(e) => setDraftText(e.target.value)}
        onBlur={handleSubmit}
        placeholder="URL同期なし（Blurでだけ反映）" 
      />
      
      <button onClick={handleSubmit}>検索</button>
    </div>
  );
}
 */
