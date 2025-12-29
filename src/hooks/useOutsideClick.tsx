// https://jsdev.space/snippets/outside-click-react/
import { RefObject, useCallback, useEffect, useRef } from "react"

type EventType = "mousedown" | "touchstart" | "mouseup" | "touchend"

export interface UseOutsideClickOptions {
  /** 監視する要素のref */
  ref: RefObject<HTMLElement | null | undefined>
  /** 外部クリック時に実行するコールバック関数 */
  callback: () => void
  /** 監視するイベントタイプ (デフォルトは全て) */
  events?: EventType[]
  /** フックを有効にするかどうか (デフォルト: true) */
  enabled?: boolean
}

/**
 * 指定された要素の外側をクリックした時にコールバックを実行するカスタムフック
 *
 * @example
 * ```tsx
 * const ref = useRef<HTMLDivElement>(null);
 * useOutsideClick({
 *   ref,
 *   callback: () => setIsOpen(false),
 *   events: ['mousedown'],
 *   enabled: isOpen,
 * });
 * ```
 */
export const useOutsideClick = ({
  ref,
  callback,
  events = ["mousedown", "touchstart", "mouseup", "touchend"],
  enabled = true,
}: UseOutsideClickOptions): void => {
  // コールバック関数をメモ化して不要な再レンダリングを防ぐ
  const savedCallback = useRef(callback)

  // callbackが変更されたら保存された参照を更新
  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  // イベントハンドラをメモ化
  const handleClickOutside = useCallback(
    (event: MouseEvent | TouchEvent) => {
      // refが存在し、かつevent.targetがrefの中に含まれていない場合
      if (ref.current && !ref.current.contains(event.target as Node)) {
        savedCallback.current()
      }
    },
    [ref],
  )

  useEffect(() => {
    // SSR環境では実行しない
    if (typeof window === "undefined" || !enabled) {
      return
    }

    // イベントリスナーを追加
    for (const event of events) {
      document.addEventListener(event, handleClickOutside)
    }

    // クリーンアップ関数
    return () => {
      for (const event of events) {
        document.removeEventListener(event, handleClickOutside)
      }
    }
  }, [events, enabled, handleClickOutside])
}

/**
 * useOutsideClickの使用例
 * ```tsx
 * const ref = useRef<HTMLDivElement>(null);
 * useOutsideClick({
 *   ref,
 *   callback: () => setIsOpen(false),
 *   events: ['mousedown'],
 *   enabled: isOpen,
 * });
 * ```
 * この例では、`ref`で指定された要素の外側をクリックしたときに`setIsOpen(false)`が実行されます。
 * `events`には、監視するイベントタイプを指定できます。デフォルトでは全てのイベントが監視されます。
 * `enabled`を`false`にすると、フックは何も実行しません。
 * これにより、特定の条件下でフックを無効化することができます。
 */
