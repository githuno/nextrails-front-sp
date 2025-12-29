/**
 * URLパラメータをエンコードする
 */
export function encodeState<T>(value: T): string {
  return encodeURIComponent(JSON.stringify(value))
}

/**
 * URLパラメータをデコードする
 */
export function decodeState<T>(value: string | null, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(decodeURIComponent(value))
  } catch (e) {
    console.warn("Failed to decode URL param:", e)
    return fallback
  }
}
/**
 * Zodを使用して値を検証する
 */
export function validateWithZod<T>(value: T, schema: any, fallback: T): T {
  try {
    return schema.parse(value)
  } catch (e) {
    console.warn("Validation failed:", e)
    return fallback
  }
}
/**
 * 状態を圧縮する
 */
export function compressState<T>(value: T, compressionLevel?: number): string {
  const jsonString = JSON.stringify(value)

  // 実際の環境では、LZUTF8やpako等のライブラリを使用して実装します
  // ここではシンプルなBase64エンコーディングで代用
  return btoa(encodeURIComponent(jsonString))
}

/**
 * 圧縮された状態を復元する
 */
export function decompressState<T>(value: string, fallback: T): T {
  try {
    // 同様に、実際には圧縮ライブラリを使用します
    return JSON.parse(decodeURIComponent(atob(value)))
  } catch (e) {
    console.warn("Failed to decompress state:", e)
    return fallback
  }
}
