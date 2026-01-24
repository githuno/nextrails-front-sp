import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FlickInput } from "./FlickInput"

// モックの定義
interface MockCameraModalProps {
  isOpen: boolean
  standalone: boolean
  showShowcase: boolean
  onCapture: (
    result:
      | { type: "image"; blob: Blob; url: string }
      | { type: "video"; blob: Blob; url: string }
      | { type: "qr"; data: string }
      | { type: "file"; files: File[] },
  ) => void
  onSelect: (accept?: string) => void
}

vi.mock("./camera/Modal.Camera", () => ({
  default: ({ isOpen, onCapture, onSelect, showShowcase }: MockCameraModalProps) =>
    isOpen ? (
      <div data-testid="camera-modal" data-showcase={showShowcase.toString()}>
        <button onClick={() => onCapture({ type: "image", blob: new Blob(), url: "mock-img-url" })}>
          Capture Image
        </button>
        <button onClick={() => onCapture({ type: "video", blob: new Blob(), url: "mock-video-url" })}>
          Capture Video
        </button>
        <button onClick={() => onCapture({ type: "qr", data: "mock-qr-data" })}>Capture QR</button>
        <button
          onClick={() =>
            onCapture({
              type: "file",
              files: [new File([], "showcase1.jpg"), new File([], "showcase2.jpg")],
            })
          }
        >
          Select Multiple from Showcase
        </button>
        <button onClick={() => onSelect("image/*")}>Select Gallery</button>
      </div>
    ) : null,
}))

interface MockMicrophoneModalProps {
  isOpen: boolean
  showShowcase: boolean
  onCapture: (result: { type: "audio"; blob: Blob; url: string } | { type: "file"; files: File[] }) => void
  onSelect: (accept?: string) => void
}

vi.mock("./microphone/Modal.Microphone", () => ({
  default: ({ isOpen, onCapture, onSelect, showShowcase }: MockMicrophoneModalProps) =>
    isOpen ? (
      <div data-testid="microphone-modal" data-showcase={showShowcase.toString()}>
        <button onClick={() => onCapture({ type: "audio", blob: new Blob(), url: "mock-audio-url" })}>
          Capture Audio
        </button>
        <button onClick={() => onSelect("audio/*")}>Select Gallery</button>
      </div>
    ) : null,
}))

// useFlickGesture のモック
vi.mock("./_hooks/useFlickGesture", () => ({
  useFlickGesture: vi.fn(() => ({
    isDragging: false,
    flickIndex: null,
    handleTouchStart: vi.fn(),
    handleTouchMove: vi.fn(),
    handleTouchEnd: () => {
      // テストでは手動でcbを呼ぶ必要があるため、ここでは何もしない（userEventでclickをシミュレートするため）
    },
  })),
}))

describe("FlickInput", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("初期状態でボタンが表示されている", () => {
    render(<FlickInput onCapture={() => {}} />)
    expect(screen.getByRole("button")).toBeInTheDocument()
  })

  it("クリックするとツールリストが展開される", async () => {
    const user = userEvent.setup()
    render(<FlickInput onCapture={() => {}} />)
    const trigger = screen.getByRole("button")
    await user.click(trigger)
    // ツールアイテムが表示されることを確認
    expect(screen.getByRole("button", { name: "Camera" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Mic" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "File" })).toBeInTheDocument()
  })

  it("showShowcase プロパティがモーダルに正しく伝播される", async () => {
    const user = userEvent.setup()
    const { rerender } = render(<FlickInput onCapture={() => {}} showShowcase={true} />)
    await user.click(screen.getByRole("button"))
    await user.click(screen.getByRole("button", { name: "Camera" }))
    expect(screen.getByTestId("camera-modal")).toHaveAttribute("data-showcase", "true")
    // prop を変更して再描画（モーダルが開いたまま属性が変わることを確認）
    rerender(<FlickInput onCapture={() => {}} showShowcase={false} />)
    expect(screen.getByTestId("camera-modal")).toHaveAttribute("data-showcase", "false")
  })

  it("CameraModalから動画キャプチャを受け取れる", async () => {
    const onCaptureMock = vi.fn()
    const user = userEvent.setup()
    render(<FlickInput onCapture={onCaptureMock} />)
    await user.click(screen.getByRole("button"))
    await user.click(screen.getByRole("button", { name: "Camera" }))
    await user.click(screen.getByRole("button", { name: "Capture Video" }))
    expect(onCaptureMock).toHaveBeenCalledWith(expect.objectContaining({ type: "video", url: "mock-video-url" }))
  })

  it("CameraModalでQRコードが検出された際、スキャンされた文字列データが onCapture に渡される", async () => {
    const onCaptureMock = vi.fn()
    const user = userEvent.setup()
    render(<FlickInput onCapture={onCaptureMock} />)
    await user.click(screen.getByRole("button"))
    await user.click(screen.getByRole("button", { name: "Camera" }))
    await user.click(screen.getByRole("button", { name: "Capture QR" }))
    expect(onCaptureMock).toHaveBeenCalledWith({
      type: "qr",
      data: "mock-qr-data",
    })
  })

  it("Cameraギャラリー選択時に accept='image/*' がセットされる", async () => {
    const user = userEvent.setup()
    render(<FlickInput onCapture={() => {}} />)
    await user.click(screen.getByRole("button"))
    await user.click(screen.getByRole("button", { name: "Camera" }))
    await user.click(screen.getByRole("button", { name: "Select Gallery" }))
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(input).toHaveAttribute("accept", "image/*")
  })

  it("Micギャラリー選択時に accept='audio/*' がセットされる", async () => {
    const user = userEvent.setup()
    render(<FlickInput onCapture={() => {}} />)
    await user.click(screen.getByRole("button"))
    await user.click(screen.getByRole("button", { name: "Mic" }))
    await user.click(screen.getByRole("button", { name: "Select Gallery" }))
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(input).toHaveAttribute("accept", "audio/*")
  })

  it("直接Fileツールを選択した際は accept 属性がリセットされる", async () => {
    const user = userEvent.setup()
    render(<FlickInput onCapture={() => {}} />)
    // 一度Cameraで制限をかける
    await user.click(screen.getByRole("button"))
    await user.click(screen.getByRole("button", { name: "Camera" }))
    await user.click(screen.getByRole("button", { name: "Select Gallery" }))
    // 次にFileを選択
    await user.click(screen.getByRole("button"))
    await user.click(screen.getByRole("button", { name: "File" }))
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    // requestAnimationFrame を挟んでいるので少し待機が必要な場合があるが、
    // Testing Libraryの waitFor で担保
    await waitFor(() => {
      expect(input).not.toHaveAttribute("accept")
    })
  })

  it("Showcaseから複数ファイルを選択すると type: 'file' として親に返される", async () => {
    const onCaptureMock = vi.fn()
    const user = userEvent.setup()
    render(<FlickInput onCapture={onCaptureMock} showShowcase={true} />)
    await user.click(screen.getByRole("button"))
    await user.click(screen.getByRole("button", { name: "Camera" }))
    await user.click(screen.getByRole("button", { name: "Select Multiple from Showcase" }))
    expect(onCaptureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "file",
        files: expect.arrayContaining([expect.objectContaining({ name: "showcase1.jpg" })]),
      }),
    )
  })

  it("MicModalで録音されると type: 'audio' として onCapture が呼ばれる", async () => {
    const onCaptureMock = vi.fn()
    const user = userEvent.setup()
    render(<FlickInput onCapture={onCaptureMock} />)
    await user.click(screen.getByRole("button"))
    await user.click(screen.getByRole("button", { name: "Mic" }))
    await user.click(screen.getByRole("button", { name: "Capture Audio" }))
    expect(onCaptureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "audio",
        url: "mock-audio-url",
      }),
    )
  })

  it("ネイティブのファイル入力で複数ファイルを選択すると type: 'file' として返される", async () => {
    const onCaptureMock = vi.fn()
    render(<FlickInput onCapture={onCaptureMock} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file1 = new File(["f1"], "file1.txt", { type: "text/plain" })
    const file2 = new File(["f2"], "file2.jpg", { type: "image/jpeg" })
    fireEvent.change(input, { target: { files: [file1, file2] } })
    expect(onCaptureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "file",
        files: expect.arrayContaining([file1, file2]),
      }),
    )
  })

  it("ファイル入力で単一画像を選択すると type: 'image' として返される", async () => {
    const onCaptureMock = vi.fn()
    render(<FlickInput onCapture={onCaptureMock} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(["hello"], "hello.png", { type: "image/png" })
    window.URL.createObjectURL = vi.fn(() => "mock-blob-url")
    fireEvent.change(input, { target: { files: [file] } })
    expect(onCaptureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "image",
        url: "mock-blob-url",
      }),
    )
  })
})
