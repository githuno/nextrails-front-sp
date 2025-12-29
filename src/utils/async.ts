/**
 * 非同期処理を安全に実行するためのユーティリティ関数
 * https://chatgpt.com/share/67dec2fd-d0bc-800a-a5ee-ec584ea87f39
 * https://jsdev.space/ts-error-handling/
 *
 * この関数は、非同期処理を実行し、その結果をラップしたオブジェクトを返します。
 * また、処理がキャンセルされた場合やエラーが発生した場合のハンドリングも行います。
 *
 * @template T - 成功時のデータ型
 * @template E - エラー時のデータ型
 *
 * @param {(() => T | Promise<T>) | Promise<T>} input - 実行する非同期処理
 * @param {Object} [options] - オプション設定
 * @param {function} [options.handler] - エラー発生時のコールバック関数
 * @param {boolean} [options.throwOnError=false] - エラー発生時に例外をスローするかどうか
 * @param {AbortSignal} [options.signal] - 外部からのキャンセルシグナル
 * @param {number} [options.timeoutMs] - タイムアウト時間（ミリ秒）
 * @param {new (message: string) => E} [options.abortErrorClass] - アボートエラーのクラス
 *
 * @returns {{ promise: Promise<Result<T, E>>, abort: () => void }} - 実行結果とキャンセル関数
 */

/*
// 基本的な使用法
const { promise, abort } = enhancedSafeAsync(fetchData);
const result = await promise;

// タイムアウト付き
const { promise } = enhancedSafeAsync(fetchData, { timeoutMs: 5000 });

// 外部シグナルとの連携
const controller = new AbortController();
const { promise } = enhancedSafeAsync(fetchData, { signal: controller.signal });

// カスタムエラーハンドリング
const { promise } = enhancedSafeAsync(fetchData, {
  handler: (err) => console.error('処理エラー:', err),
  throwOnError: true
});

// カスタムアボートエラークラス
class ApiCancelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiCancelError';
  }
}

const { promise, abort } = enhancedSafeAsync(fetchData, {
  abortErrorClass: ApiCancelError
});

// 結果の処理
const result = await promise;
if (result.aborted) {
  console.log('処理は中断されました', result.error);
} else if (result.error) {
  console.error('エラーが発生しました', result.error);
} else {
  console.log('成功しました', result.data);
}
 */

type Success<T> = { data: T; error: null; aborted: false }
type Failure<E> = { data: null; error: E; aborted: false }
type Aborted<E = Error> = { data: null; error: E | null; aborted: true }
type Result<T, E = Error> = Success<T> | Failure<E> | Aborted<E>

export function safeAsync<T, E = Error>(
  input: (() => T | Promise<T>) | Promise<T>,
  options?: {
    handler?: (error: E) => void
    throwOnError?: boolean
    signal?: AbortSignal
    timeoutMs?: number
    abortErrorClass?: new (message: string) => E
  },
): {
  promise: Promise<Result<T, E>>
  abort: () => void
} {
  const { handler, throwOnError = false, signal: externalSignal, timeoutMs, abortErrorClass } = options ?? {}

  // 内部コントローラー - タイムアウトとこの関数から返されるabort()用
  const controller = new AbortController()

  // 外部シグナルの変化を監視して内部コントローラーに伝播
  const cleanup: Array<() => void> = []
  if (externalSignal) {
    const handleAbort = () => controller.abort()
    externalSignal.addEventListener("abort", handleAbort)
    cleanup.push(() => externalSignal.removeEventListener("abort", handleAbort))
  }

  // タイムアウト設定
  let timeoutId: number | null = null
  if (timeoutMs && timeoutMs > 0) {
    timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)
    cleanup.push(() => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    })
  }

  // クリーンアップ関数
  const performCleanup = () => {
    cleanup.forEach((fn) => fn())

    if (timeoutId !== null) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  // 内部シグナル
  const { signal } = controller

  // 実行関数
  const execute = async (): Promise<Result<T, E>> => {
    try {
      // アボート状態の確認（外部＋内部）
      if (signal.aborted || (externalSignal && externalSignal.aborted)) {
        const abortError = abortErrorClass
          ? new abortErrorClass("操作がキャンセルされました")
          : (new DOMException("操作がキャンセルされました", "AbortError") as unknown as E)

        return { data: null, error: abortError, aborted: true }
      }

      // Promiseの準備
      const promiseToExecute = input instanceof Promise ? input : Promise.resolve().then(input)

      // アボート監視用のPromiseを作成
      const abortPromise = new Promise<never>((_, reject) => {
        const abortHandler = () => {
          const abortError = abortErrorClass
            ? new abortErrorClass("操作がキャンセルされました")
            : (new DOMException("操作がキャンセルされました", "AbortError") as unknown as E)

          reject(abortError)
        }

        signal.addEventListener("abort", abortHandler, { once: true })
      })

      // 処理実行（メインの処理とアボートを競争）
      const result = await Promise.race([promiseToExecute, abortPromise])

      return { data: result, error: null, aborted: false }
    } catch (error) {
      // エラーの正規化
      const normalizedError =
        error instanceof Error ? (error as unknown as E) : (new Error(String(error)) as unknown as E)

      // アボートかどうかを確認
      const isAborted =
        signal.aborted ||
        (externalSignal && externalSignal.aborted) ||
        (error instanceof DOMException && error.name === "AbortError")

      // エラーハンドリング
      if (isAborted) {
        // アボートエラーの場合
        if (throwOnError) {
          throw normalizedError
        }

        if (handler) {
          handler(normalizedError)
        }

        return { data: null, error: normalizedError, aborted: true }
      } else {
        // 通常のエラーの場合
        if (throwOnError) {
          throw normalizedError
        }

        if (handler) {
          handler(normalizedError)
        }

        return { data: null, error: normalizedError, aborted: false }
      }
    } finally {
      performCleanup()
    }
  }

  // 実行とアボート機能を返す
  return {
    promise: execute(),
    abort: () => controller.abort(),
  }
}
