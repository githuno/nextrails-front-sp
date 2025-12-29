import { useRef, useSyncExternalStore } from "react"

// https://dev.to/childrentime/building-a-usewindowsize-hook-from-scratch-a0f
// https://www.notion.so/useWindowSize-DEV-23c565e97d7c811496bfe454947bb4c0

interface WindowSize {
  width: number
  height: number
}

interface StateDependencies {
  width?: boolean
  height?: boolean
}

interface UseWindowSize {
  (): {
    readonly width: number
    readonly height: number
  }
}

function subscribe(callback: () => void) {
  window.addEventListener("resize", callback)
  return () => {
    window.removeEventListener("resize", callback)
  }
}

export const useWindowSize: UseWindowSize = () => {
  const stateDependencies = useRef<StateDependencies>({}).current
  const previous = useRef<WindowSize>({
    width: 0,
    height: 0,
  })

  const isEqual = (prev: WindowSize, current: WindowSize) => {
    for (const _ in stateDependencies) {
      const t = _ as keyof StateDependencies
      if (current[t] !== prev[t]) {
        return false
      }
    }
    return true
  }

  const cached = useSyncExternalStore(
    subscribe,
    () => {
      const data = {
        width: window.innerWidth,
        height: window.innerHeight,
      }
      if (!isEqual(previous.current, data)) {
        previous.current = data
        return data
      }
      return previous.current
    },
    () => {
      // SSR-safe initial value
      return { width: 0, height: 0 }
    },
  )

  return {
    get width() {
      stateDependencies.width = true
      return cached.width
    },
    get height() {
      stateDependencies.height = true
      return cached.height
    },
  }
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

import { useCallback } from "react"

export const useResizeObserver = <T extends HTMLElement>() => {
  const ref = useRef<T>(null)
  const subscribe = useCallback((onStoreChange: () => void) => {
    const observer = new ResizeObserver((entries) => {
      // 監視対象の要素がリサイズした際、useSyncExternalStoreフックから渡される、
      // 画面の再描画を行う関数を実行する。
      entries.forEach(() => onStoreChange())
    })
    if (ref.current) {
      observer.observe(ref.current)
    }
    return () => observer.disconnect()
  }, [])

  const height = useSyncExternalStore(subscribe, () => ref.current?.clientHeight || 0)
  const width = useSyncExternalStore(subscribe, () => ref.current?.clientWidth || 0)
  return { ref, width, height }
}
