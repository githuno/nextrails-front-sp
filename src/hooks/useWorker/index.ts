import { pubSub } from "@/utils/pubsub"
import { ServiceWorkerContextType, ServiceWorkerProvider, useServiceWorker } from "./useServiceWorker"
import { useWebWorker, UseWebWorkerOptions } from "./useWebWorker"
import { JobOptions, JobResult, JobState } from "./utils/job"

export {
  pubSub,
  ServiceWorkerProvider,
  useServiceWorker,
  useWebWorker,
  type JobOptions,
  type JobResult,
  type JobState,
  type ServiceWorkerContextType,
  type UseWebWorkerOptions,
}

// Service WorkerでのTransferable Objectsの使用
// 1.基本的な使用方法
// Service Workerからメインスレッドへ

// const buffer = new ArrayBuffer(1024);
// self.clients.get(clientId).then(client => {
//   client.postMessage({ data: buffer }, [buffer]);
// });

// メインスレッドからService Workerへ
// navigator.serviceWorker.controller.postMessage({ data: buffer }, [buffer]);

// 2.対応している転送可能オブジェクト
// - ArrayBuffer
// - MessagePort
// - ImageBitmap
// - OffscreenCanvas
// - ReadableStream
// - WritableStream
// - TransformStream

// 3.注意点
// - 転送されたオブジェクトは、元のスレッドでは使用できなくなる
// - Service Workerのライフサイクルを考慮した設計が必要
// - クロスオリジンの考慮が必要な場合がある
