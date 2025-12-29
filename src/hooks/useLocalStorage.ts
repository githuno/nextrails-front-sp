import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react"

// https://jsdev.space/10-custom-react-hooks/
interface UseLocalStorageOptions {
  sync?: boolean
  global?: boolean
}

type SetValue<T> = Dispatch<SetStateAction<T>>

function useLocalStorage<T>(key: string, initialValue: T, options?: UseLocalStorageOptions): [T, SetValue<T>] {
  const storageKey = useMemo(() => {
    if (options?.global || typeof window === "undefined") {
      return key
    }
    return `${window.location.pathname}:${key}`
  }, [key, options?.global])

  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue
    }
    try {
      const item = window.localStorage.getItem(storageKey)
      return item ? (JSON.parse(item) as T) : initialValue
    } catch (error) {
      console.error(error)
      return initialValue
    }
  })

  const setValue: SetValue<T> = (value) => {
    try {
      // stateを更新するための値（関数または直接の値）を解決
      const valueToStore = value instanceof Function ? value(storedValue) : value

      // 1. Reactのstateを更新
      setStoredValue(valueToStore)

      // 2. localStorageを更新
      if (typeof window !== "undefined") {
        // もし新しい値がundefinedなら、localStorageからキーを削除
        if (valueToStore === undefined) {
          window.localStorage.removeItem(storageKey)
        } else {
          // そうでなければ、値をJSON文字列化して保存
          window.localStorage.setItem(storageKey, JSON.stringify(valueToStore))
        }
      }
    } catch (error) {
      console.error(error)
    }
  }

  useEffect(() => {
    if (!options?.sync || typeof window === "undefined") {
      return
    }
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === storageKey) {
        try {
          // 他タブで削除された場合 (event.newValueはnull)、初期値に戻す
          setStoredValue(event.newValue ? (JSON.parse(event.newValue) as T) : initialValue)
        } catch (error) {
          console.error(error)
        }
      }
    }
    window.addEventListener("storage", handleStorageChange)
    return () => {
      window.removeEventListener("storage", handleStorageChange)
    }
  }, [storageKey, initialValue, options?.sync])

  return [storedValue, setValue]
}

export default useLocalStorage
