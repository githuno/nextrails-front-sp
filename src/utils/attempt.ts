// https://levelup.gitconnected.com/simplify-typescript-error-handling-with-the-attempt-pattern-4af4379afb6f

export type Success<T> = { data: T; error?: never }
export type Failure<E = unknown> = { data?: never; error: E }
export type Result<T, E = unknown> = Success<T> | Failure<E>

// Promiseかどうかを判定するヘルパー
export function isPromise<T>(value: unknown): value is Promise<T> {
  return !!value && typeof (value as any).then === "function"
}

// エラーハンドリングのメイン関数
export function attempt<T, E = unknown>(
  input: Promise<T> | (() => T) | (() => Promise<T>),
): Result<T, E> | Promise<Result<T, E>> {
  if (typeof input === "function") {
    try {
      const result = input()
      if (isPromise<T>(result)) {
        return attempt(result)
      }
      return { data: result }
    } catch (error) {
      return { error: error as E }
    }
  }

  return input.then(
    (data): Result<T, E> => ({ data }),
    (error): Result<T, E> => ({ error: error as E }),
  )
}

// フォールバック値を扱うヘルパー
export function withFallback<T, E = unknown>(
  result: Result<T, E> | Promise<Result<T, E>>,
  fallback: T,
): T | Promise<T> {
  if (isPromise<Result<T, E>>(result)) {
    return result.then((res) => ("error" in res ? fallback : res.data))
  }

  return "error" in result ? fallback : result.data
}

/**
 * 使用例
 
// 使用例
import { attempt, withFallback } from './utils/error-handling'

// 同期的な処理
const parseResult = attempt(() => JSON.parse(jsonString))
if ("error" in parseResult) {
  console.error("パース失敗:", parseResult.error)
  return
}
const data = parseResult.data

// 非同期処理
const fetchResult = await attempt(async () => {
  const response = await fetch('/api/users')
  return response.json()
})

if ("error" in fetchResult) {
  console.error("API呼び出し失敗:", fetchResult.error)
  return
}
const users = fetchResult.data

// フォールバック値の使用
const config = withFallback(
  attempt(() => JSON.parse(configString)), 
  defaultConfig
)

*
*/
