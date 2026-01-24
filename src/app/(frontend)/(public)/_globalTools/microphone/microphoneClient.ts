interface MicrophoneConfig {
  AUDIO_CONSTRAINTS?: MediaTrackConstraints
}

const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  sampleRate: { ideal: 44100 },
  channelCount: { ideal: 1 }, // mono
  echoCancellation: true,
  noiseSuppression: true,
}

const createMicrophoneClient = (config: MicrophoneConfig = {}) => {
  const defaultConfig: Required<MicrophoneConfig> = {
    AUDIO_CONSTRAINTS: AUDIO_CONSTRAINTS,
  }
  const finalConfig = { ...defaultConfig, ...config }

  const getMicrophoneStream = async (): Promise<MediaStream> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: finalConfig.AUDIO_CONSTRAINTS,
        video: false,
      })
      return stream
    } catch (error) {
      throw new Error(`Microphone access denied: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  const createRecorder = (stream: MediaStream): MediaRecorder => {
    // まずMP3を試し、WebMにフォールバック
    const mimeType = MediaRecorder.isTypeSupported("audio/mpeg")
      ? "audio/mpeg"
      : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : ""
    if (!mimeType) {
      throw new Error("No supported audio format found")
    }
    const recorder = new MediaRecorder(stream, { mimeType })
    return recorder
  }
  const checkAvailability = async (): Promise<boolean> => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return false
    }
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.some((device) => device.kind === "audioinput")
  }

  return {
    getMicrophoneStream,
    createRecorder,
    checkAvailability,
  }
}

export { createMicrophoneClient }
export type { MicrophoneConfig }
