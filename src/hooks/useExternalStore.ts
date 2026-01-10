import { useSyncExternalStore } from "react"

// reactとの仲介役として動作し、外部ストアの変更をReactコンポーネントに反映させる
// https://www.notion.so/useSyncExternalStore-React-localStorage-DEV-Community-2e4565e97d7c8146a13ddb8ebfaeaaef
// https://dev.to/muhammed_fayazts_e35676/usesyncexternalstore-the-right-way-to-sync-react-with-localstorage-3c5f
export function useExternalStore<T>(store: {
  subscribe: (callback: () => void) => () => void
  getSnapshot: () => T
  getServerSnapshot: () => T
}) {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
}
