import { useSyncExternalStore } from "react"

const emptySubscribe = () => () => {}
const getSnapshot = () => true
const getServerSnapshot = () => false

/**
 * クライアントサイド（ブラウザ）での実行かどうかを判定するカスタムフック。
 * React 18+ の useSyncExternalStore を使用しており、ハイドレーションエラーを回避しながら
 * 安全にクライアントサイドのみの処理（Portalやwindowオブジェクトへのアクセス）を制御できます。
 *
 * @returns {boolean} クライアントサイドであれば true、サーバーサイドであれば false
 */
export const useIsClient = (): boolean => {
  return useSyncExternalStore(emptySubscribe, getSnapshot, getServerSnapshot)
}
