export function getFallbackValue<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback

  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : fallback
  } catch {
    return fallback
  }
}

export function setFallbackValue<T>(key: string, value: T | null) {
  if (typeof window === "undefined") return
  if (value === null) {
    localStorage.removeItem(key)
  } else {
    localStorage.setItem(key, JSON.stringify(value))
  }
}
