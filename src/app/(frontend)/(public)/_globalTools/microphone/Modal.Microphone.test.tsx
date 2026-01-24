import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { useToolActionStore } from "../_hooks/useToolActionStore"
import { microphoneActions } from "./microphoneStore"
import MicrophoneModal from "./Modal.Microphone"

// next/image のモック
vi.mock("next/image", () => ({
  __esModule: true,
  default: ({
    fill,
    alt,
    priority,
    unoptimized,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean
    priority?: boolean
    unoptimized?: boolean
  }) => {
    void priority
    void unoptimized
    return (
      <img
        alt={alt}
        {...props}
        style={
          {
            width: props.width || "100%",
            height: props.height || "auto",
            objectFit: fill ? "cover" : undefined,
            ...props.style,
          } as React.CSSProperties
        }
      />
    )
  },
}))

// https://howtotestfrontend.com/resources/how-to-write-good-frontend-tests

type MockFile = {
  id: string
  idbKey: string
  url: string
  isPending: boolean
  fileName: string
  mimeType: string
  size: number
  createdAt: Date
  sessionId: string
}

// useToolActionStore はDB/PGLite依存のためモック
vi.mock("../_hooks/useToolActionStore", () => ({
  useToolActionStore: vi.fn(),
}))

// window.confirm のモック
Object.defineProperty(window, "confirm", {
  writable: true,
  value: vi.fn(() => true),
})

// HTMLAudioElement のモック
Object.defineProperty(window.HTMLAudioElement.prototype, "play", {
  writable: true,
  value: vi.fn().mockResolvedValue(undefined),
})
Object.defineProperty(window.HTMLAudioElement.prototype, "pause", {
  writable: true,
  value: vi.fn(),
})
Object.defineProperty(window.HTMLAudioElement.prototype, "load", {
  writable: true,
  value: vi.fn(),
})

// MediaRecorder のモック
class MockMediaRecorder {
  static isTypeSupported = vi.fn(() => true)
  static readonly NOT_STARTED = 0
  static readonly RECORDING = 1
  static readonly PAUSED = 2
  static readonly INACTIVE = 3
  state = MockMediaRecorder.INACTIVE
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  onerror: ((event: { error: Error }) => void) | null = null
  constructor() {
    // コンストラクタは何もしない
  }
  start() {
    this.state = MockMediaRecorder.RECORDING
  }
  stop() {
    this.state = MockMediaRecorder.INACTIVE
    // モックデータを提供（ストリーム保存をシミュレート）
    if (this.ondataavailable) {
      const mockBlob = new Blob(["audio data"], { type: "audio/wav" })
      this.ondataavailable({ data: mockBlob })
    }
    if (this.onstop) {
      this.onstop()
    }
  }
  pause() {
    this.state = MockMediaRecorder.PAUSED
  }
  resume() {
    this.state = MockMediaRecorder.RECORDING
  }
}

// MediaStream のモック生成関数
const createMockAudioStream = (): MediaStream => {
  // ブラウザ環境（Chromium）では実際にトラックを持つストリームが必要
  const AudioContextClass =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new AudioContextClass()
  const dest = ctx.createMediaStreamDestination()
  return dest.stream
}

beforeAll(() => {
  // navigator.mediaDevices をセットアップ
  Object.defineProperty(navigator, "mediaDevices", {
    writable: true,
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockImplementation(async () => createMockAudioStream()),
    },
  })
  // MediaRecorder をグローバルにモック
  Object.defineProperty(window, "MediaRecorder", {
    writable: true,
    configurable: true,
    value: MockMediaRecorder,
  })
})

describe("MicrophoneModal (Integration Test with Real Components)", () => {
  const user = userEvent.setup()
  const defaultToolActionState = {
    currentFileSet: "test-set",
    files: [] as MockFile[],
    cameraFiles: [] as MockFile[],
    audioFiles: [] as MockFile[],
    fileSetInfo: [{ name: "test-set", count: 0, latestImageUrl: null, latestIdbKey: null }],
    deleteFiles: vi.fn(),
    saveFile: vi.fn(),
    switchFileSet: vi.fn(),
    getFileWithUrl: vi.fn(),
    isDbReady: true,
  }

  beforeEach(() => {
    // 各テストでモックを設定
    defaultToolActionState.files = [] as MockFile[]
    defaultToolActionState.audioFiles = [] as MockFile[]
    defaultToolActionState.cameraFiles = [] as MockFile[]
    vi.mocked(useToolActionStore).mockReturnValue(defaultToolActionState)
  })

  afterEach(async () => {
    cleanup()
    // シングルトンのStoreをクリーンアップ
    microphoneActions.cleanup()
    vi.clearAllMocks()
    // pending な rejection を待機（unhandled rejection エラーを回避）
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  describe("初期表示", () => {
    it("モーダルが実際に開かれ、マイクが利用可能な場合、録音開始ボタンが表示される", async () => {
      render(<MicrophoneModal isOpen={true} onClose={() => {}} />)
      // 1. ネイティブdialogが存在し、表示されていること（実装のModalを使用）
      const dialog = screen.getAllByRole("dialog")[0] as HTMLDialogElement
      expect(dialog).toBeInTheDocument()
      // 初期化を待機
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Start recording" })).toBeInTheDocument()
      })
    })

    it("マイクが利用不可の場合、エラーメッセージが表示される", async () => {
      // getUserMedia を reject するようにモック
      vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(new Error("Microphone not available"))
      render(<MicrophoneModal isOpen={true} onClose={() => {}} />)
      await waitFor(() => {
        expect(screen.getByText(/microphone not available/i)).toBeInTheDocument()
      })
    })

    it("初期化中の場合、ローディング表示がされる", () => {
      render(<MicrophoneModal isOpen={true} onClose={() => {}} />)
      // 初期化中はローディングが表示されるはず
      expect(screen.getByText(/initializing/i)).toBeInTheDocument()
      // テスト終了後に setup() の state 更新が残って act 警告にならないよう、初期化完了まで待つ
      // （role/label は初期表示でも存在し得るため「enabled になる」ことを条件にする）
      return waitFor(() => {
        expect(screen.getByRole("button", { name: "Start recording" })).toBeEnabled()
      })
    })
  })

  describe("録音機能", () => {
    it("録音開始ボタンをクリックすると録音が開始される", async () => {
      render(<MicrophoneModal isOpen={true} onClose={() => {}} />)
      const startButton = await screen.findByRole("button", { name: "Start recording" })
      await user.click(startButton)
      // 実装で録音が開始されることを確認（状態変化を待機）
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Stop recording" })).toBeInTheDocument()
      })
    })

    it("録音中の場合、停止ボタンが表示される", async () => {
      render(<MicrophoneModal isOpen={true} onClose={() => {}} />)
      const startButton = await screen.findByRole("button", { name: "Start recording" })
      await user.click(startButton)
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Stop recording" })).toBeInTheDocument()
      })
    })

    it("録音停止ボタンをクリックすると録音が停止され、自動的に保存されて再生可能状態になる", async () => {
      const saveFileMock = vi.fn().mockImplementation(async (blob: Blob, options?: { fileName?: string }) => {
        const result = { idbKey: "new-key", id: "new-id" }
        const newFile = {
          id: result.id,
          idbKey: result.idbKey,
          url: "data:audio/wav;base64,xxx",
          isPending: false,
          fileName: options?.fileName || "recording.mp3",
          mimeType: "audio/mp3",
          size: blob.size,
          createdAt: new Date(),
          sessionId: "default",
        }
        defaultToolActionState.files.push(newFile)
        defaultToolActionState.audioFiles.push(newFile)
        return result
      })
      vi.mocked(useToolActionStore).mockReturnValue({
        ...defaultToolActionState,
        saveFile: saveFileMock,
      })
      render(<MicrophoneModal isOpen={true} onClose={() => {}} />)
      const startButton = await screen.findByRole("button", { name: "Start recording" })
      await user.click(startButton)
      const stopButton = await screen.findByRole("button", { name: "Stop recording" })
      await user.click(stopButton)
      // 保存確認ダイアログは表示されず、そのまま保存される
      expect(window.confirm).not.toHaveBeenCalled()
      // 保存処理が開始されることを確認（実装で saveFile が呼ばれる）
      await waitFor(() => {
        expect(saveFileMock).toHaveBeenCalled()
        // 再生ボタンが表示される（選択状態）
        expect(screen.getByRole("button", { name: "Play recording" })).toBeInTheDocument()
      })
    })
  })

  describe("ファイル選択と再生", () => {
    it("ShowcaseのファイルをクリックするとselectedFileがセットされ、メインプレビューに表示される", async () => {
      const mockFile = {
        id: "1",
        idbKey: "key1",
        url: "data:audio/wav;base64,xxx",
        isPending: false,
        fileName: "recording_1.wav",
        mimeType: "audio/wav",
        size: 1000,
        createdAt: new Date(),
        sessionId: "default",
      }
      vi.mocked(useToolActionStore).mockReturnValue({
        ...defaultToolActionState,
        files: [mockFile],
        audioFiles: [mockFile],
      })
      render(<MicrophoneModal isOpen={true} onClose={() => {}} />)
      // Showcaseのアイテムをクリック
      const audioItem = screen.getByTestId("audio-item")
      await user.click(audioItem)
      // メインプレビューにファイル名が表示される
      await waitFor(() => {
        expect(screen.getByText("recording_1.wav")).toBeInTheDocument()
      })
    })

    it("ファイル選択状態でメインボタンをクリックすると再生が開始される", async () => {
      const mockFile = {
        id: "1",
        idbKey: "key1",
        url: "data:audio/wav;base64,xxx",
        isPending: false,
        fileName: "recording_1.wav",
        mimeType: "audio/wav",
        size: 1000,
        createdAt: new Date(),
        sessionId: "default",
      }
      vi.mocked(useToolActionStore).mockReturnValue({
        ...defaultToolActionState,
        files: [mockFile],
        audioFiles: [mockFile],
      })
      render(<MicrophoneModal isOpen={true} onClose={() => {}} />)
      // ファイルをクリックして選択
      const audioItem = screen.getByTestId("audio-item")
      await user.click(audioItem)
      // 再生ボタンをクリック
      const playButton = await screen.findByRole("button", { name: "Play recording" })
      await user.click(playButton)
      // 停止ボタンに変わる
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Stop playing" })).toBeInTheDocument()
        expect(window.HTMLAudioElement.prototype.play).toHaveBeenCalled()
      })
    })

    it("再生中のファイルを停止できること", async () => {
      const mockFile = {
        id: "1",
        idbKey: "key1",
        url: "data:audio/wav;base64,xxx",
        isPending: false,
        fileName: "recording_1.wav",
        mimeType: "audio/wav",
        size: 1000,
        createdAt: new Date(),
        sessionId: "default",
      }
      vi.mocked(useToolActionStore).mockReturnValue({
        ...defaultToolActionState,
        files: [mockFile],
        audioFiles: [mockFile],
      })
      render(<MicrophoneModal isOpen={true} onClose={() => {}} />)
      // ファイルをクリックして選択
      const audioItem = screen.getByTestId("audio-item")
      await user.click(audioItem)
      // 再生ボタンをクリック
      const playButton = await screen.findByRole("button", { name: "Play recording" })
      await user.click(playButton)
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Stop playing" })).toBeInTheDocument()
      })
      // 停止ボタンをクリック
      const stopButton = screen.getByRole("button", { name: "Stop playing" })
      await user.click(stopButton)
      // 再生ボタンに戻る
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Play recording" })).toBeInTheDocument()
        expect(window.HTMLAudioElement.prototype.pause).toHaveBeenCalled()
      })
    })

    it("選択解除ボタンをクリックするとselectedFileがnullになる", async () => {
      const mockFile = {
        id: "1",
        idbKey: "key1",
        url: "data:audio/wav;base64,xxx",
        isPending: false,
        fileName: "recording_1.wav",
        mimeType: "audio/wav",
        size: 1000,
        createdAt: new Date(),
        sessionId: "default",
      }
      vi.mocked(useToolActionStore).mockReturnValue({
        ...defaultToolActionState,
        files: [mockFile],
        audioFiles: [mockFile],
      })
      render(<MicrophoneModal isOpen={true} onClose={() => {}} />)
      // ファイルをクリックして選択
      const audioItem = screen.getByTestId("audio-item")
      await user.click(audioItem)
      const deselectButton = await screen.findByRole("button", { name: "Deselect file" })
      await user.click(deselectButton)
      // 選択解除ボタンが消え、録音開始ボタンが表示される
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Start recording" })).toBeInTheDocument()
        expect(screen.queryByRole("button", { name: "Deselect file" })).not.toBeInTheDocument()
      })
    })
  })

  describe("ギャラリー表示", () => {
    it("録音されたファイルがCarousel内に一覧表示される", async () => {
      const mockFiles = [
        {
          id: "1",
          idbKey: "key1",
          url: "data:audio/wav;base64,xxx",
          isPending: false,
          fileName: "recording_1.wav",
          mimeType: "audio/wav",
          size: 1000,
          createdAt: new Date(),
          sessionId: "default",
        },
      ]
      vi.mocked(useToolActionStore).mockReturnValue({
        ...defaultToolActionState,
        files: mockFiles,
        audioFiles: mockFiles,
      })
      render(<MicrophoneModal isOpen={true} onClose={() => {}} />)
      // Showcase内にファイルが表示される（コンテナの存在を確認）
      expect(screen.getByTestId("audio-item")).toBeInTheDocument()
      // Microphone の初期化が走るため、更新が残らないよう待機
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Start recording" })).toBeEnabled()
      })
    })

    it("ギャラリーからファイルが削除可能なこと", async () => {
      const deleteFilesMock = vi.fn()
      const mockFiles = [
        {
          id: "1",
          idbKey: "key1",
          url: "data:audio/wav;base64,xxx",
          isPending: false,
          fileName: "recording_1.wav",
          mimeType: "audio/wav",
          size: 1000,
          createdAt: new Date(),
          sessionId: "default",
        },
      ]
      vi.mocked(useToolActionStore).mockReturnValue({
        ...defaultToolActionState,
        files: mockFiles,
        audioFiles: mockFiles,
        deleteFiles: deleteFilesMock,
      })
      render(<MicrophoneModal isOpen={true} onClose={() => {}} />)
      // 選択トグルボタンをクリック
      const selectToggleButton = screen.getByRole("button", { name: "Select audio file" })
      await user.click(selectToggleButton)
      // 削除ボタンが表示される
      const deleteButton = screen.getByRole("button", { name: "Delete 1 selected audio files" })
      await user.click(deleteButton)
      // confirm が呼ばれる
      expect(window.confirm).toHaveBeenCalledWith("Delete 1 selected audio files?")
      expect(deleteFilesMock).toHaveBeenCalled()
    })

    it("メインプレビューにセットされているファイルを削除すると、メインプレビューからも除去される", async () => {
      const deleteFilesMock = vi.fn()
      const mockFile = {
        id: "1",
        idbKey: "key1",
        url: "data:audio/wav;base64,xxx",
        isPending: false,
        fileName: "recording_1.wav",
        mimeType: "audio/wav",
        size: 1000,
        createdAt: new Date(),
        sessionId: "default",
      }
      vi.mocked(useToolActionStore).mockReturnValue({
        ...defaultToolActionState,
        files: [mockFile],
        audioFiles: [mockFile],
        deleteFiles: deleteFilesMock,
      })
      const { rerender } = render(<MicrophoneModal isOpen={true} onClose={() => {}} />)
      // ファイルをクリックして選択
      const audioItem = screen.getByTestId("audio-item")
      await user.click(audioItem)
      // selectedFile がセットされていることを確認
      await waitFor(() => {
        expect(screen.getByText("recording_1.wav")).toBeInTheDocument()
      })
      // 選択トグルボタンをクリック
      const selectToggleButtons = screen.getAllByRole("button", { name: "Select audio file" })
      await user.click(selectToggleButtons[0])
      // 削除ボタンをクリック
      const deleteButton = screen.getByRole("button", { name: "Delete 1 selected audio files" })
      await user.click(deleteButton)
      // deleteFiles が呼ばれたことを確認
      expect(deleteFilesMock).toHaveBeenCalled()
      // 削除後に files を空にする
      vi.mocked(useToolActionStore).mockReturnValue({
        ...defaultToolActionState,
        files: [],
        audioFiles: [],
        deleteFiles: deleteFilesMock,
      })
      // 再レンダリング
      rerender(<MicrophoneModal isOpen={true} onClose={() => {}} />)
      // 削除後に selectedFile が null になることを確認
      await waitFor(() => {
        expect(screen.getByText("Ready to Record")).toBeInTheDocument()
      })
    })
  })
})
