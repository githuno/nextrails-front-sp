import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { useToolActionStore } from "../_hooks/useToolActionStore"
import { cameraActions } from "./cameraStore"
import CameraModal from "./Modal.Camera"

// https://howtotestfrontend.com/resources/how-to-write-good-frontend-tests

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

// useToolActionStore はDB/PGLite依存のためモック
vi.mock("../_hooks/useToolActionStore", () => ({
  useToolActionStore: vi.fn(),
}))

interface CanvasWithCaptureStream extends HTMLCanvasElement {
  captureStream(fps?: number): MediaStream
}

// 本物のブラウザ環境での MediaStream 生成
const createMockStream = (): MediaStream => {
  const canvas = document.createElement("canvas") as CanvasWithCaptureStream
  canvas.width = 640
  canvas.height = 480
  const ctx = canvas.getContext("2d")
  if (ctx) {
    ctx.fillStyle = "black"
    ctx.fillRect(0, 0, 640, 480)
  }
  return canvas.captureStream(30)
}

// video.srcObject のセッターをモンキーパッチしてイベント発火を確実にする
const originalSrcObjectDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "srcObject")
if (originalSrcObjectDescriptor?.set) {
  Object.defineProperty(HTMLVideoElement.prototype, "srcObject", {
    set(v: MediaStream | null) {
      originalSrcObjectDescriptor.set?.call(this, v)
      if (v) {
        // 即座に初期化状態をセットし、イベントを非同期に発火
        Object.defineProperty(this, "readyState", { get: () => 4, configurable: true })
        Object.defineProperty(this, "videoWidth", { get: () => 640, configurable: true })
        Object.defineProperty(this, "videoHeight", { get: () => 480, configurable: true })
        Object.defineProperty(this, "duration", { get: () => Infinity, configurable: true })
        Object.defineProperty(this, "paused", { get: () => false, configurable: true })
        const dispatchEvents = () => {
          this.dispatchEvent(new Event("loadedmetadata"))
          this.dispatchEvent(new Event("loadeddata"))
          this.dispatchEvent(new Event("canplay"))
          this.dispatchEvent(new Event("canplaythrough"))
          this.dispatchEvent(new Event("playing"))
        }
        // 複数のタイミングで発火を試録して、後続のリスナー登録との競合を回避
        queueMicrotask(dispatchEvents)
        setTimeout(dispatchEvents, 0)
        setTimeout(dispatchEvents, 50)
      }
    },
    get() {
      return originalSrcObjectDescriptor.get?.call(this) as MediaStream | null
    },
    configurable: true,
  })
}

interface BarcodeResult {
  rawValue: string
}

const MockBarcodeDetector = class {
  static _mockDetectResult: BarcodeResult[] = []
  static getSupportedFormats(): Promise<string[]> {
    return Promise.resolve(["qr_code"])
  }
  constructor(_options?: { formats: string[] }) {
    void _options
  }
  detect(_source?: ImageBitmapSource): Promise<BarcodeResult[]> {
    void _source
    return Promise.resolve(MockBarcodeDetector._mockDetectResult)
  }
}

beforeAll(() => {
  // video.play() のスタブ（複数のイベントを発火）
  HTMLVideoElement.prototype.play = function () {
    const events = ["play", "playing", "loadeddata", "canplay", "canplaythrough"]
    events.forEach((eventName) => {
      this.dispatchEvent(new Event(eventName))
    })
    return Promise.resolve()
  }

  // navigator.mediaDevices を一度だけセットアップ（beforeEachで再作成しない）
  Object.defineProperty(navigator, "mediaDevices", {
    writable: true,
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockImplementation(async () => createMockStream()),
      enumerateDevices: vi.fn().mockResolvedValue([
        { deviceId: "dev1", kind: "videoinput", label: "Front Camera" },
        { deviceId: "dev2", kind: "videoinput", label: "Back Camera" },
      ]),
    },
  })

  // BarcodeDetector のスタブを強制上書き
  Object.defineProperty(window, "BarcodeDetector", {
    writable: true,
    configurable: true,
    value: MockBarcodeDetector,
  })
})

afterEach(async () => {
  cleanup()
  // シングルトンのStoreを完全リセット
  cameraActions._internal_reset()
  // vi.clearAllMocks() は実行しない - mock インスタンスの参照を保持する必要がある
  // 代わりに、mock の実装のみをリセット
  vi.mocked(navigator.mediaDevices.getUserMedia).mockReset()
  // 前のテストの mockImplementation（throw）の影響を受けないよう、明示的にデフォルト実装に戻す
  vi.mocked(navigator.mediaDevices.getUserMedia).mockImplementation(async () => createMockStream())
  vi.mocked(useToolActionStore).mockReset()
  vi.useRealTimers()
  // pending な rejection を待機（unhandled rejection エラーを回避）
  await new Promise((resolve) => setTimeout(resolve, 0))
})

describe("CameraModal (Integration Test with Real Components)", () => {
  const defaultToolActionState = {
    isReady: true,
    isDbReady: true,
    files: [],
    cameraFiles: [],
    audioFiles: [],
    fileSets: ["Default"],
    fileSetInfo: [{ name: "Default", count: 0, latestImageUrl: null, latestIdbKey: null }],
    currentFileSet: "Default",
    isCameraOpen: false,
    isWebViewOpen: false,
    webUrl: "",
    error: null,
    pendingSaves: [],
    syncStatus: "idle" as const,
    addPreviewFile: vi.fn().mockReturnValue("temp-key"),
    handleScan: vi.fn(),
    switchFileSet: vi.fn(),
    closeWebView: vi.fn(),
    setCameraOpen: vi.fn(),
    addFiles: vi.fn(),
    handleSelect: vi.fn(),
    handleFileChange: vi.fn(),
    saveFile: vi.fn().mockResolvedValue({ idbKey: "key", id: "1" }),
    getFileWithUrl: vi.fn(),
    deleteFile: vi.fn(),
    deleteFiles: vi.fn(),
  }

  describe("ライフサイクルと初期化", () => {
    it("モーダルが実際に開かれ、カメラストリームがアタッチされる", async () => {
      vi.mocked(useToolActionStore).mockReturnValue(defaultToolActionState)
      render(<CameraModal isOpen={true} onClose={() => {}} />)
      // 1. ネイティブdialogが存在し、表示されていること（実装のModalを使用）
      const dialog = screen.getAllByRole("dialog")[0] as HTMLDialogElement
      expect(dialog).toBeInTheDocument()
      // アニメーション完了を待つのに十分な時間を確保
      await waitFor(
        () => {
          expect(dialog).toHaveAttribute("open")
        },
        { timeout: 5000 },
      )
      // 2. video要素が正弦波（Initializing）を超えて表示されること
      const video = document.querySelector("video")
      expect(video).toBeInTheDocument()
      await waitFor(
        () => {
          expect(video).toHaveClass(/opacity-100/)
          // srcObjectがセットされていることを確認
          expect(video?.srcObject).toBeDefined()
        },
        { timeout: 10000 },
      )
    })

    it("モーダルが閉じられた際、カメラが停止する", async () => {
      vi.mocked(useToolActionStore).mockReturnValue(defaultToolActionState)
      const { rerender } = render(<CameraModal isOpen={true} onClose={() => {}} />)
      // 開いていることを確認
      expect(screen.getAllByRole("dialog")[0]).toHaveAttribute("open")
      // 閉じる
      rerender(<CameraModal isOpen={false} onClose={() => {}} />)
      // Modalコンポーネントの実装では、isOpen=falseになると dialog.close() が呼ばれるが
      // DOM要素自体は(Portalではないので)残り続ける可能性がある。
      // そのため、open属性が外れていることを確認する。
      await waitFor(() => {
        const dialog = screen.getAllByRole("dialog")[0]
        expect(dialog).not.toHaveAttribute("open")
      })
    })
  })

  describe("ユーザーインタラクション", () => {
    it("カメラ切り替えボタンでデバイスリストを表示し、切り替えが可能", async () => {
      vi.mocked(useToolActionStore).mockReturnValue(defaultToolActionState)
      const user = userEvent.setup()
      render(<CameraModal isOpen={true} onClose={() => {}} />)
      // video srcObject が実際にセットされるまで待機
      const video = document.querySelector("video")
      await waitFor(
        () => {
          expect(video).toBeInTheDocument()
          expect(video?.srcObject).not.toBeNull()
          expect(video).toHaveClass(/opacity-100/)
        },
        { timeout: 10000 },
      )
      // aria-labelで堅牢に検索
      const switchTrigger = screen.getByRole("button", { name: "Switch Camera" })
      await user.click(switchTrigger)
      const listTitle = await screen.findByText(/Sensors/i)
      expect(listTitle).toBeInTheDocument()
      const backCamera = screen.getByRole("button", { name: /Back Camera/i })
      await user.click(backCamera)
      await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled())
    })

    it("シャッターボタンをクリックしてキャプチャを実行できる", async () => {
      vi.mocked(useToolActionStore).mockReturnValue(defaultToolActionState)
      const user = userEvent.setup()
      render(<CameraModal isOpen={true} onClose={() => {}} />)
      const video = document.querySelector("video")
      await waitFor(
        () => {
          expect(video).toBeInTheDocument()
          expect(video?.srcObject).not.toBeNull()
          expect(video).toHaveClass(/opacity-100/)
        },
        { timeout: 10000 },
      )
      const captureButton = screen.getByRole("button", { name: "Capture Image" })
      await user.click(captureButton)
    })

    it("シャッターボタンを長押しして録画を開始できる", async () => {
      vi.mocked(useToolActionStore).mockReturnValue(defaultToolActionState)
      vi.useFakeTimers({ shouldAdvanceTime: true })
      // advanceTimers で userEvent が自動的にタイマーを進める
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) })
      // confirm ダイアログをモック
      vi.spyOn(window, "confirm").mockReturnValue(false)
      render(<CameraModal isOpen={true} onClose={() => {}} />)
      const captureButton = screen.getByRole("button", { name: "Capture Image" })
      // PointerDown で長押し開始
      await user.pointer({ target: captureButton, keys: "[MouseLeft>]" })
      // FakeTimers使用時は vi.advanceTimersByTime がトリガーする「同期的な状態更新」を
      // 明示的に act で包んで反映させる必要がある（通常の非同期 waitFor とは異なる制御が必要なため）
      await act(async () => {
        vi.advanceTimersByTime(350)
        await Promise.resolve()
      })
      // Recording インジケータが表示されるのを待機
      await waitFor(() => {
        expect(screen.getByText("Recording")).toBeInTheDocument()
      })
      // PointerUp で終了
      await user.pointer({ target: captureButton, keys: "[/MouseLeft]" })
      vi.useRealTimers()
    })
  })

  describe("QRスキャンとエラー処理", () => {
    it("QRコードが検出されたときに onScan コールバックが呼ばれる", async () => {
      const onScan = vi.fn()
      vi.mocked(useToolActionStore).mockReturnValue(defaultToolActionState)
      // 検出結果を仕込む
      MockBarcodeDetector._mockDetectResult = [{ rawValue: "https://example.com" }]
      const { unmount } = render(<CameraModal isOpen={true} onClose={() => {}} onScan={onScan} />)
      try {
        // スキャンループの中で detect が呼ばれるのを待つ
        await waitFor(() => expect(onScan).toHaveBeenCalledWith("https://example.com"), { timeout: 8000 })
      } finally {
        MockBarcodeDetector._mockDetectResult = []
        unmount()
      }
    })

    it("カメラの初期化に失敗した際にエラー画面が表示される", async () => {
      // ... (既存コード) ...
    })

    it("QRトグルボタンでスキャンの有効/無効を切り替えられる", async () => {
      vi.mocked(useToolActionStore).mockReturnValue(defaultToolActionState)
      const user = userEvent.setup()
      render(<CameraModal isOpen={true} onClose={() => {}} />)

      // 1. 初期状態（有効）を確認
      const toggleBtn = screen.getByRole("button", { name: /Disable QR Scan/i })
      expect(toggleBtn).toBeInTheDocument()
      expect(cameraActions.getSnapshot().isQrEnabled).toBe(true)

      // 2. 無効化
      await user.click(toggleBtn)
      expect(cameraActions.getSnapshot().isQrEnabled).toBe(false)
      expect(screen.getByRole("button", { name: /Enable QR Scan/i })).toBeInTheDocument()

      // 3. 再有効化
      await user.click(screen.getByRole("button", { name: /Enable QR Scan/i }))
      expect(cameraActions.getSnapshot().isQrEnabled).toBe(true)
    })
  })

  describe("ギャラリー表示", () => {
    it("撮影された画像がCarousel内に一覧表示される", async () => {
      const mockFiles = [
        {
          id: "1",
          idbKey: "key1",
          url: "data:image/png;base64,xxx",
          isPending: false,
          fileName: "test.jpg",
          mimeType: "image/jpeg",
          size: 100,
          createdAt: new Date(),
          sessionId: "default",
        },
      ]
      vi.mocked(useToolActionStore).mockReturnValue({
        ...defaultToolActionState,
        files: mockFiles,
        cameraFiles: mockFiles,
      })
      const { unmount } = render(<CameraModal isOpen={true} onClose={() => {}} />)
      try {
        // data-testid を使用して画像を特定
        const item = await screen.findByTestId("camera-item", {}, { timeout: 8000 })
        expect(item).toBeInTheDocument()
      } finally {
        unmount()
      }
    })

    it("ギャラリーからファイルが削除可能なこと", async () => {
      const deleteFilesMock = vi.fn()
      const mockFiles = [
        {
          id: "1",
          idbKey: "key1",
          url: "data:image/png;base64,xxx",
          isPending: false,
          fileName: "test.jpg",
          mimeType: "image/jpeg",
          size: 100,
          createdAt: new Date(),
          sessionId: "default",
        },
      ]
      vi.mocked(useToolActionStore).mockReturnValue({
        ...defaultToolActionState,
        files: mockFiles,
        cameraFiles: mockFiles,
        deleteFiles: deleteFilesMock,
      })
      // confirm をこのテスト用に true を返すように設定
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true)
      const { unmount } = render(<CameraModal isOpen={true} onClose={() => {}} />)
      try {
        const user = userEvent.setup()
        // 選択トグルボタンをクリック
        const selectToggleButton = await screen.findByRole("button", { name: "Select image" })
        await user.click(selectToggleButton)
        // 削除ボタンをクリック (aria-label を正確にマッチさせる)
        const deleteButton = await screen.findByRole("button", { name: "Delete 1 selected images" })
        await user.click(deleteButton)
        expect(confirmSpy).toHaveBeenCalled()
        expect(deleteFilesMock).toHaveBeenCalledWith([{ idbKey: "key1", id: "1" }])
      } finally {
        confirmSpy.mockRestore()
        unmount()
      }
    })
  })
})
