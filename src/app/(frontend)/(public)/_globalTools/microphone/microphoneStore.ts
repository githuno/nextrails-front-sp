import { useExternalStore } from "../_hooks/atoms/useExternalStore"
import { idbStore } from "../_hooks/db/useIdbStore"
import { type SavedToolFileResult } from "../_hooks/useToolActionStore"
import { createMicrophoneClient, type MicrophoneConfig } from "./microphoneClient"

interface MicrophoneState {
  isAvailable: boolean | null // null:初期化中、true:利用可能、false:利用不可
  isRecording: boolean
  isPlaying: boolean
  recordedBlob: Blob | null
  audioUrl: string | null
  error: Error | null
  duration: number // 録音時間
  currentTime: number // 再生中の時間
  stream: MediaStream | null // Added for visualization
}

export interface MicrophoneExternalActions {
  saveFile?: (
    file: Blob | File,
    options?: { fileName?: string; idbKey?: string; category?: string },
  ) => Promise<SavedToolFileResult>
  getFileWithUrl?: (idbKey: string) => Promise<string | null>
  deleteFile?: (idbKey: string, dbId: string) => Promise<void>
}

interface MicrophoneStateInternal extends MicrophoneState {
  mediaRecorder: MediaRecorder | null
  audioElement: HTMLAudioElement | null
  stream: MediaStream | null
  recordedChunks: string[] // チャンクキーの配列
  externalActions: MicrophoneExternalActions
  callbacks: {
    onRecordComplete?: (result: SavedToolFileResult) => void
    onSelect?: () => void
  }
}

let microphoneClient: ReturnType<typeof createMicrophoneClient> | null = null
const state: MicrophoneStateInternal = {
  isAvailable: true, // Optimistic display
  isRecording: false,
  isPlaying: false,
  recordedBlob: null,
  audioUrl: null,
  error: null,
  duration: 0,
  currentTime: 0,
  mediaRecorder: null,
  audioElement: null,
  stream: null,
  recordedChunks: [],
  externalActions: {},
  callbacks: {},
}
const listeners: Set<() => void> = new Set()

// サーバーはマイクにアクセスできないため、サーバースナップショットは静的
const serverSnapshot: MicrophoneState = {
  isAvailable: false,
  isRecording: false,
  isPlaying: false,
  recordedBlob: null,
  audioUrl: null,
  error: null,
  duration: 0,
  currentTime: 0,
  stream: null,
}

// 無限ループを避けるためのgetSnapshotキャッシュ
let snapshotCache: MicrophoneState = serverSnapshot
let snapshotVersion = 0
let currentVersion = 0

const getMicrophoneClient = (config?: MicrophoneConfig) => {
  if (!microphoneClient) {
    microphoneClient = createMicrophoneClient(config)
  }
  return microphoneClient
}

const notify = () => {
  currentVersion++
  listeners.forEach((listener) => listener())
}

const getSnapshot = (): MicrophoneState => {
  if (snapshotVersion !== currentVersion) {
    snapshotCache = {
      isAvailable: state.isAvailable,
      isRecording: state.isRecording,
      isPlaying: state.isPlaying,
      recordedBlob: state.recordedBlob,
      audioUrl: state.audioUrl,
      error: state.error,
      duration: state.duration,
      currentTime: state.currentTime,
      stream: state.stream,
    }
    snapshotVersion = currentVersion
  }
  return snapshotCache
}

const getServerSnapshot = (): MicrophoneState => serverSnapshot

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const useMicrophoneState = (): MicrophoneState => {
  return useExternalStore<MicrophoneState>({
    subscribe,
    getSnapshot,
    getServerSnapshot,
  })
}

const updateState = (updater: Partial<MicrophoneStateInternal>) => {
  Object.assign(state, updater)
  notify()
}

const actions = {
  setExternalActions: (actions: MicrophoneExternalActions) => {
    state.externalActions = actions
  },

  setCallbacks: (callbacks: Partial<MicrophoneStateInternal["callbacks"]>) => {
    state.callbacks = { ...state.callbacks, ...callbacks }
  },

  checkAvailability: async () => {
    try {
      const client = getMicrophoneClient()
      const isAvailable = await client.checkAvailability()
      updateState({ isAvailable })
    } catch {
      updateState({ isAvailable: false })
    }
  },

  setup: async () => {
    try {
      updateState({ error: null })
      const client = getMicrophoneClient()
      const stream = await client.getMicrophoneStream()
      updateState({
        stream,
        isAvailable: true,
        error: null,
      })
    } catch (error) {
      updateState({
        isAvailable: false,
        error: error instanceof Error ? error : new Error("Microphone setup failed"),
      })
    }
  },

  startRecord: () => {
    if (!state.stream || state.isRecording) return
    try {
      const client = getMicrophoneClient()
      const mediaRecorder = client.createRecorder(state.stream)
      state.recordedChunks = []
      state.mediaRecorder = mediaRecorder
      mediaRecorder.ondataavailable = async (event: BlobEvent) => {
        if (event.data.size > 0) {
          const idb = idbStore()
          const chunkKey = `chunk_${Date.now()}_${Math.random()}`
          await idb.put(chunkKey, event.data)
          state.recordedChunks.push(chunkKey)
        }
      }
      mediaRecorder.onstop = async () => {
        const idb = idbStore()
        const chunks: Blob[] = []
        for (const key of state.recordedChunks) {
          const chunk = (await idb.get(key)) as Blob
          chunks.push(chunk)
          await idb.remove(key) // クリーンアップ
        }
        const blob = new Blob(chunks, { type: "audio/mp3" })
        const url = URL.createObjectURL(blob)
        updateState({
          recordedBlob: blob,
          audioUrl: url,
          isRecording: false,
          duration: 0, // TODO: 再生時間を計算
        })
      }
      mediaRecorder.start(1000) // 1秒ごとにストリーム
      updateState({ isRecording: true, error: null })
    } catch (error) {
      updateState({
        error: error instanceof Error ? error : new Error("Recording failed"),
        isRecording: false,
      })
    }
  },

  stopRecord: (
    onComplete?: (blob: Blob) => Promise<SavedToolFileResult | undefined>,
  ): Promise<SavedToolFileResult | undefined> => {
    if (!state.mediaRecorder || !state.isRecording) return Promise.resolve(undefined)
    state.isRecording = false
    state.error = null
    const mediaRecorder = state.mediaRecorder
    return new Promise((resolve) => {
      mediaRecorder.onstop = async () => {
        const idb = idbStore()
        const chunks: Blob[] = []
        for (const key of state.recordedChunks) {
          const chunk = (await idb.get(key)) as Blob
          chunks.push(chunk)
          await idb.remove(key) // クリーンアップ
        }
        const blob = new Blob(chunks, { type: "audio/mp3" })
        if (onComplete) {
          onComplete(blob).then((result) => {
            if (result) state.callbacks.onRecordComplete?.(result)
            resolve(result)
          })
        } else {
          const url = URL.createObjectURL(blob)
          updateState({
            recordedBlob: blob,
            audioUrl: url,
            isRecording: false,
            duration: 0, // TODO: 再生時間を計算
          })
          resolve(undefined)
        }
      }
      mediaRecorder.stop()
      notify()
    })
  },

  playAudio: () => {
    if (!state.audioUrl || state.isPlaying) return
    if (!state.audioElement) {
      state.audioElement = new Audio(state.audioUrl)
      state.audioElement.onended = () => {
        updateState({ isPlaying: false, currentTime: 0 })
      }
      state.audioElement.ontimeupdate = () => {
        updateState({ currentTime: state.audioElement?.currentTime || 0 })
      }
    }
    state.audioElement.play()
    updateState({ isPlaying: true })
  },

  stopAudio: () => {
    if (!state.audioElement || !state.isPlaying) return
    state.audioElement.pause()
    state.audioElement.currentTime = 0
    updateState({ isPlaying: false, currentTime: 0 })
  },

  saveFile: async (blob: Blob, options?: { fileName?: string }) => {
    if (!state.externalActions.saveFile) return
    try {
      const result = await state.externalActions.saveFile(blob, {
        fileName: options?.fileName || `recording_${Date.now()}.mp3`,
      })
      // 保存後に録音されたblobをクリア
      updateState({ recordedBlob: null, audioUrl: null })
      return result
    } catch (error) {
      updateState({
        error: error instanceof Error ? error : new Error("Save failed"),
      })
    }
  },

  cleanup: () => {
    if (state.stream) {
      state.stream.getTracks().forEach((track) => track.stop())
    }
    if (state.audioUrl) {
      URL.revokeObjectURL(state.audioUrl)
    }
    if (state.audioElement) {
      state.audioElement.pause()
    }
    updateState({
      isAvailable: null,
      isRecording: false,
      isPlaying: false,
      recordedBlob: null,
      audioUrl: null,
      stream: null,
      mediaRecorder: null,
      audioElement: null,
      recordedChunks: [],
      error: null,
      duration: 0,
      currentTime: 0,
    })
  },
  setAudioUrl: (url: string | null) => {
    updateState({ audioUrl: url })
  },
}

export const microphoneActions = actions

if (typeof window !== "undefined") {
  actions.checkAvailability()
}
