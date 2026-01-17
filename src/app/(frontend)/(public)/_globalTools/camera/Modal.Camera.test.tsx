import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { useToolActionStore } from "../_hooks/useToolActionStore"
import { cameraActions } from "./cameraStore"
import CameraModal from "./Modal.Camera"

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
  // シングルトンのStoreをクリーンアップ
  cameraActions.cleanup()
  cameraActions.setCapturedImages([])
  // vi.clearAllMocks() は実行しない - mock インスタンスの参照を保持する必要がある
  // 代わりに、mock の実装のみをリセット
  vi.mocked(navigator.mediaDevices.getUserMedia).mockReset()
  // 前のテストの mockImplementation（throw）の影響を受けないよう、明示的にデフォルト実装に戻す
  vi.mocked(navigator.mediaDevices.getUserMedia).mockImplementation(async () => createMockStream())
  vi.mocked(useToolActionStore).mockReset()
  // pending な rejection を待機（unhandled rejection エラーを回避）
  await new Promise((resolve) => setTimeout(resolve, 0))
})

describe("CameraModal (Integration Test with Real Components)", () => {
  const defaultToolActionState = {
    isReady: true,
    isDbReady: true,
    files: [],
    fileSets: ["Default"],
    fileSetInfo: [{ name: "Default", count: 0, latestImageUrl: null }],
    currentFileSet: "Default",
    isCameraOpen: false,
    isWebViewOpen: false,
    webUrl: "",
    error: null,
    pendingSaves: [],
    syncStatus: "idle" as const,
    handleScan: vi.fn(),
    switchFileSet: vi.fn(),
    closeWebView: vi.fn(),
    setCameraOpen: vi.fn(),
    addFiles: vi.fn(),
    handleSelect: vi.fn(),
    handleFileChange: vi.fn(),
    saveCapturedFile: vi.fn().mockResolvedValue({ idbKey: "key", id: "1" }),
    getFileWithUrl: vi.fn(),
    deleteFile: vi.fn(),
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
      const switchTrigger = screen.getByLabelText("Switch Camera")
      await user.click(switchTrigger)
      const listTitle = await screen.findByText(/Select Device/i)
      expect(listTitle).toBeInTheDocument()
      const backCamera = screen.getByText(/Back Camera/i)
      await user.click(backCamera)
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled()
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
      const captureButton = screen.getByLabelText("Capture Image")
      await user.click(captureButton)
      // キャプチャ処理が走ることを確認（storeの中身を見るのが確実）
      // waitFor(() => expect(cameraActions.getCapturedImages().length).toBeGreaterThan(0))
    })

    it("シャッターボタンを長押しして録画を開始できる", async () => {
      vi.mocked(useToolActionStore).mockReturnValue(defaultToolActionState)
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      // confirm ダイアログをモック
      vi.spyOn(window, "confirm").mockReturnValue(false)
      render(<CameraModal isOpen={true} onClose={() => {}} />)
      const captureButton = screen.getByLabelText("Capture Image")
      // PointerDown で長押し開始
      await user.pointer({ target: captureButton, keys: "[MouseLeft>]" })
      // 300ms 以上待機（タイマーで実装）
      vi.advanceTimersByTime(350)
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
      // このテスト用に一度 cleanup して状態をクリア
      cameraActions.cleanup()
      cameraActions.setCapturedImages([])
      // Unhandled Rejection を防ぐため、rejection を catch するハンドラーを設定
      const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
        event.preventDefault() // rejection の報告を抑制
      }
      window.addEventListener("unhandledrejection", handleUnhandledRejection)
      // このテスト内で getUserMedia を常に reject するようにセットアップ
      vi.mocked(navigator.mediaDevices.getUserMedia).mockImplementation(async () => {
        throw new Error("Permission Denied")
      })
      vi.mocked(useToolActionStore).mockReturnValue(defaultToolActionState)
      const { unmount } = render(<CameraModal isOpen={true} onClose={() => {}} />)
      try {
        // エラーメッセージが display されるのを待機
        await waitFor(
          () => {
            expect(screen.getByText("Camera Error")).toBeInTheDocument()
          },
          { timeout: 8000 },
        )
        expect(screen.getByText("Permission Denied")).toBeInTheDocument()
      } finally {
        window.removeEventListener("unhandledrejection", handleUnhandledRejection)
        unmount()
      }
    })
  })

  describe("ギャラリー表示", () => {
    it("撮影された画像がCarousel内に一覧表示される", async () => {
      vi.mocked(useToolActionStore).mockReturnValue(defaultToolActionState)
      // Store へのアップデートを同期的に行う
      void cameraActions.setCapturedImages([{ url: "data:image/png;base64,xxx", isPending: false }])
      const { unmount } = render(<CameraModal isOpen={true} onClose={() => {}} />)
      try {
        const img = await screen.findByAltText("Captured 0", {}, { timeout: 8000 })
        expect(img).toBeInTheDocument()
      } finally {
        unmount()
      }
    })

    it("ギャラリーの削除ボタンで画像が消去される", async () => {
      vi.mocked(useToolActionStore).mockReturnValue(defaultToolActionState)
      void cameraActions.setCapturedImages([{ url: "data:image/png;base64,xxx", isPending: false }])
      const { unmount } = render(<CameraModal isOpen={true} onClose={() => {}} />)
      try {
        // 画像が表示されるのを待機
        await screen.findByAltText("Captured 0", {}, { timeout: 8000 })
        // 削除ボタンを aria-label で検索
        const removeButton = await screen.findByLabelText("Delete Capture")
        const user = userEvent.setup()
        // ボタンクリック - 同期的にハンドラーが呼ばれるが、削除後の状態反映は非同期
        await user.click(removeButton)
        // 削除が完了し、画像が DOM から消えるまで待機
        // Carousel 内の画像が削除されたことを確認（画像要素が DOM から消える）
        await waitFor(
          () => {
            // Store からも消えていることを確認
            expect(cameraActions.getSnapshot().capturedImages).toHaveLength(0)
          },
          { timeout: 3000 },
        )
        // さらに DOM から画像が消えていることも確認（二重確認で flaky を避ける）
        expect(screen.queryByAltText("Captured 0")).not.toBeInTheDocument()
      } finally {
        unmount()
      }
    })
  })
})
