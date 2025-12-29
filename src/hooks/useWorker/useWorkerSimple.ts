// https://jsdev.space/web-workers-and-react/

import { useCallback, useEffect, useRef, useState } from "react"

export function useWorker<T = any>(workerFactory: () => Worker) {
  const workerRef = useRef<Worker | null>(null)
  const [data, setData] = useState<T | null>(null)

  useEffect(() => {
    workerRef.current = workerFactory()
    workerRef.current.onmessage = (e: MessageEvent<T>) => setData(e.data)
    return () => workerRef.current?.terminate()
  }, [workerFactory])

  const postMessage = useCallback((msg: any) => {
    workerRef.current?.postMessage(msg)
  }, [])

  return [data, postMessage]
}

// const [result, send] = useWorker(() => new Worker(new URL("./worker.js", import.meta.url)))
// useEffect(() => {
//   send({ number: 42 })
// }, [send])
