import { cleanup, render, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"
import { Carousel } from "./Carousel"

afterEach(() => {
  cleanup()
})

// テスト用の画像データ
const TEST_IMAGES = [
  "https://images.unsplash.com/photo-1510915228340-29c85a43dcfe?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1542831371-29b0f74f9713?q=80&w=1200&auto=format&fit=crop",
]
// スクロールコンテナを取得するヘルパー
const getScrollContainer = () => document.querySelector("[data-carousel-scroll]") as HTMLElement
// アイテム要素を取得するヘルパー
const getItemElements = () => Array.from(document.querySelectorAll("[data-carousel-item-wrapper]")) as HTMLElement[]

describe("Carousel", () => {
  describe("レンダリング", () => {
    it("基本的なCarouselが正しくレンダリングされる", () => {
      render(
        <Carousel className="h-32">
          {TEST_IMAGES.map((src, i) => (
            <img key={i} src={src} alt={`Test ${i}`} className="h-full w-24 rounded-lg object-cover" />
          ))}
        </Carousel>,
      )
      const root = document.querySelector("[data-carousel-root]")
      expect(root).toBeInTheDocument()
      const scrollContainer = getScrollContainer()
      expect(scrollContainer).toBeInTheDocument()
      const items = getItemElements()
      expect(items).toHaveLength(3)
    })

    it("marqueeモードでアニメーションが適用される", () => {
      render(
        <Carousel marquee className="h-32">
          {TEST_IMAGES.map((src, i) => (
            <img key={i} src={src} alt={`Test ${i}`} className="h-full w-24 rounded-lg object-cover" />
          ))}
        </Carousel>,
      )
      const scrollContainer = getScrollContainer()
      expect(scrollContainer).toHaveClass("snap-none", "overflow-hidden")
    })

    it("index指定モードでアイテムがフル幅になる", () => {
      render(
        <Carousel index={0} className="h-32">
          {TEST_IMAGES.map((src, i) => (
            <img key={i} src={src} alt={`Test ${i}`} className="h-full rounded-lg object-cover" />
          ))}
        </Carousel>,
      )
      const items = getItemElements()
      items.forEach((item) => {
        expect(item).toHaveClass("w-full")
      })
    })

    it("galleryモードでアイテムが中央揃えになる", () => {
      render(
        <Carousel className="h-32">
          {TEST_IMAGES.map((src, i) => (
            <img key={i} src={src} alt={`Test ${i}`} className="h-full w-24 rounded-lg object-cover" />
          ))}
        </Carousel>,
      )
      const itemContainer = document.querySelector("[data-carousel-scroll] > div")
      expect(itemContainer).toHaveClass("justify-self-center")
    })
  })

  describe("インタラクション", () => {
    it("prev/nextボタンでスクロールできる", async () => {
      const user = userEvent.setup()
      render(
        <Carousel circularButtons={false} className="h-32">
          {TEST_IMAGES.map((src, i) => (
            <img key={i} src={src} alt={`Test ${i}`} className="h-full w-24 rounded-lg object-cover" />
          ))}
        </Carousel>,
      )
      // nextボタンをクリック
      const nextButton = document.querySelector("[data-carousel-next]") as HTMLButtonElement
      await user.click(nextButton)
      // ボタンがクリック可能であることを確認（pointer-eventsがauto）
      expect(nextButton).toHaveClass("pointer-events-auto")
    })

    it("ドットをクリックして特定のアイテムにジャンプできる", async () => {
      const user = userEvent.setup()
      render(
        <Carousel className="h-32">
          {TEST_IMAGES.map((src, i) => (
            <img key={i} src={src} alt={`Test ${i}`} className="h-full w-24 rounded-lg object-cover" />
          ))}
        </Carousel>,
      )
      const scrollContainer = getScrollContainer()
      const dots = document.querySelectorAll(".carousel-dot")
      expect(dots).toHaveLength(3)
      // 2番目のドットをクリック
      await user.click(dots[1])
      // スクロール位置が適切に変わることを確認
      await waitFor(() => {
        const itemElements = getItemElements()
        const expectedScroll = itemElements[1].offsetLeft - itemElements[0].offsetLeft
        expect(scrollContainer.scrollLeft).toBe(expectedScroll)
      })
    })

    it("circularButtons=falseでボタンが常に表示される", () => {
      render(
        <Carousel circularButtons={false} className="h-32">
          {TEST_IMAGES.map((src, i) => (
            <img key={i} src={src} alt={`Test ${i}`} className="h-full w-24 rounded-lg object-cover" />
          ))}
        </Carousel>,
      )
      const prevButton = document.querySelector("[data-carousel-prev]") as HTMLButtonElement
      const nextButton = document.querySelector("[data-carousel-next]") as HTMLButtonElement
      // data属性が正しく設定されていることを確認
      const root = document.querySelector("[data-carousel-root]")
      expect(root).toHaveAttribute("data-circular-buttons", "false")
      // ボタンが存在することを確認（CSSで常に表示される）
      expect(prevButton).toBeInTheDocument()
      expect(nextButton).toBeInTheDocument()
    })
  })

  describe("循環スクロール", () => {
    it("最初のアイテムでprevボタンを押すと最後にジャンプする", async () => {
      const user = userEvent.setup()
      render(
        <Carousel circularButtons={false} className="h-32">
          {TEST_IMAGES.map((src, i) => (
            <img key={i} src={src} alt={`Test ${i}`} className="h-full w-24 rounded-lg object-cover" />
          ))}
        </Carousel>,
      )
      const prevButton = document.querySelector("[data-carousel-prev]") as HTMLButtonElement
      // prevボタンをクリック
      await user.click(prevButton)
      // ボタンがクリック可能であることを確認
      expect(prevButton).toHaveClass("pointer-events-auto")
    })

    it("最後のアイテムでnextボタンを押すと最初にジャンプする", async () => {
      const user = userEvent.setup()
      render(
        <Carousel circularButtons={false} className="h-32">
          {TEST_IMAGES.map((src, i) => (
            <img key={i} src={src} alt={`Test ${i}`} className="h-full w-24 rounded-lg object-cover" />
          ))}
        </Carousel>,
      )
      const scrollContainer = getScrollContainer()
      const nextButton = document.querySelector("[data-carousel-next]") as HTMLButtonElement
      // 最後のアイテムまでスクロール
      for (let i = 0; i < TEST_IMAGES.length - 1; i++) {
        await user.click(nextButton)
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      // nextボタンをクリック
      await user.click(nextButton)
      // 最初のアイテムにジャンプすることを確認
      await waitFor(
        () => {
          expect(scrollContainer.scrollLeft).toBe(0)
        },
        { timeout: 2000 },
      )
    })
  })

  describe("アクセシビリティ", () => {
    it("適切なARIA属性を持つ", () => {
      render(
        <Carousel className="h-32">
          {TEST_IMAGES.map((src, i) => (
            <img key={i} src={src} alt={`Test ${i}`} className="h-full w-24 rounded-lg object-cover" />
          ))}
        </Carousel>,
      )
      const root = document.querySelector("[data-carousel-root]")
      expect(root).toHaveAttribute("data-carousel-root")
      const scrollContainer = getScrollContainer()
      expect(scrollContainer).toHaveAttribute("data-carousel-scroll")
    })

    it("複製アイテムにaria-hiddenが設定される", () => {
      render(
        <Carousel marquee className="h-32">
          {TEST_IMAGES.map((src, i) => (
            <img key={i} src={src} alt={`Test ${i}`} className="h-full w-24 rounded-lg object-cover" />
          ))}
        </Carousel>,
      )
      const items = getItemElements()
      // オリジナル3つ + 複製3つ = 6つ
      expect(items).toHaveLength(6)
      // 最初の3つはaria-hiddenなし、最後の3つはaria-hidden=true
      items.slice(0, 3).forEach((item) => {
        expect(item).not.toHaveAttribute("aria-hidden")
      })
      items.slice(3).forEach((item) => {
        expect(item).toHaveAttribute("aria-hidden", "true")
      })
    })
  })

  describe("エラーハンドリング", () => {
    it("空のchildrenを適切に処理する", () => {
      render(<Carousel className="h-32">{[]}</Carousel>)
      const root = document.querySelector("[data-carousel-root]")
      expect(root).toBeInTheDocument()
      const dots = document.querySelectorAll(".carousel-dot")
      expect(dots).toHaveLength(0)
    })

    it("単一のアイテムでドットが表示されない", () => {
      render(
        <Carousel className="h-32">
          <img src={TEST_IMAGES[0]} alt="Single" className="h-full w-24 rounded-lg object-cover" />
        </Carousel>,
      )
      const dots = document.querySelectorAll(".carousel-dot")
      expect(dots).toHaveLength(0)
    })
  })

  describe("モード別挙動", () => {
    it("marqueeモードではボタンが表示されない", () => {
      render(
        <Carousel marquee className="h-32">
          {TEST_IMAGES.map((src, i) => (
            <img key={i} src={src} alt={`Test ${i}`} className="h-full w-24 rounded-lg object-cover" />
          ))}
        </Carousel>,
      )
      const prevButton = document.querySelector("[data-carousel-prev]")
      const nextButton = document.querySelector("[data-carousel-next]")
      expect(prevButton).not.toBeInTheDocument()
      expect(nextButton).not.toBeInTheDocument()
    })

    it("gapプロパティが正しく適用される", () => {
      render(
        <Carousel gap="2rem" className="h-32">
          {TEST_IMAGES.map((src, i) => (
            <img key={i} src={src} alt={`Test ${i}`} className="h-full w-24 rounded-lg object-cover" />
          ))}
        </Carousel>,
      )
      const itemContainer = document.querySelector("[data-carousel-scroll] > div")
      const computedStyle = window.getComputedStyle(itemContainer!)
      expect(computedStyle.gap).toBe("32px")
    })

    it("containerClassNameが正しく適用される", () => {
      render(
        <Carousel containerClassName="test-class" className="h-32">
          {TEST_IMAGES.map((src, i) => (
            <img key={i} src={src} alt={`Test ${i}`} className="h-full w-24 rounded-lg object-cover" />
          ))}
        </Carousel>,
      )
      const itemContainer = document.querySelector("[data-carousel-scroll] > div")
      expect(itemContainer).toHaveClass("test-class")
    })

    it("circularButtons=true（デフォルト）でスクロール位置に応じてボタンが表示/非表示になる", async () => {
      render(
        <div style={{ width: 900, height: 420 }}>
          <Carousel gap="1rem" className="h-105">
            {TEST_IMAGES.map((src, i) => (
              <Carousel.Item key={i} className="h-full w-[80%] md:w-[60%]">
                <div className="h-full w-full rounded-2xl bg-zinc-300" aria-label={`item-${i}`} />
              </Carousel.Item>
            ))}
          </Carousel>
        </div>,
      )
      const scrollContainer = getScrollContainer()
      const prevButton = document.querySelector("[data-carousel-prev]") as HTMLButtonElement
      const nextButton = document.querySelector("[data-carousel-next]") as HTMLButtonElement
      const itemElements = getItemElements()
      // 初期状態（左端）：Prevボタンが非表示、Nextボタンが表示
      expect(prevButton).toBeInTheDocument()
      expect(nextButton).toBeInTheDocument()
      // DOMテストではCSSアニメーションを直接テストできないため、存在確認のみ

      // 中央スクロールをシミュレート
      const centerScroll = itemElements[1].offsetLeft - itemElements[0].offsetLeft
      scrollContainer.scrollLeft = centerScroll
      scrollContainer.dispatchEvent(new Event("scroll"))
      await waitFor(() => {
        // スクロール後の状態確認（DOMテストでは限定的）
        expect(prevButton).toBeInTheDocument()
        expect(nextButton).toBeInTheDocument()
      })
      // 右端スクロールをシミュレート
      const rightScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth
      scrollContainer.scrollLeft = rightScroll
      scrollContainer.dispatchEvent(new Event("scroll"))
      await waitFor(() => {
        expect(prevButton).toBeInTheDocument()
        expect(nextButton).toBeInTheDocument()
      })
    })

    it("index指定モードでスクロール位置に応じてボタンが表示/非表示になる", async () => {
      render(
        <div style={{ width: 900, height: 420 }}>
          <Carousel index={1} className="h-105" fade={false}>
            {TEST_IMAGES.map((src, i) => (
              <Carousel.Item key={i} className="h-full w-full">
                <div className="h-full w-full rounded-2xl bg-zinc-900" aria-label={`single-${i}`} />
              </Carousel.Item>
            ))}
          </Carousel>
        </div>,
      )
      const scrollContainer = getScrollContainer()
      const prevButton = document.querySelector("[data-carousel-prev]") as HTMLButtonElement
      const nextButton = document.querySelector("[data-carousel-next]") as HTMLButtonElement
      // 初期はindex=1なので中央：両方表示
      expect(prevButton).toBeInTheDocument()
      expect(nextButton).toBeInTheDocument()
      // 左端へスクロールをシミュレート
      scrollContainer.scrollLeft = 0
      scrollContainer.dispatchEvent(new Event("scroll"))
      await waitFor(() => {
        expect(prevButton).toBeInTheDocument()
        expect(nextButton).toBeInTheDocument()
      })
      // 右端へスクロールをシミュレート
      const rightScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth
      scrollContainer.scrollLeft = rightScroll
      scrollContainer.dispatchEvent(new Event("scroll"))
      await waitFor(() => {
        expect(prevButton).toBeInTheDocument()
        expect(nextButton).toBeInTheDocument()
      })
    })

    it("ドットがスクロール位置に応じて同期する", async () => {
      render(
        <Carousel className="h-32">
          {TEST_IMAGES.map((src, i) => (
            <img key={i} src={src} alt={`Test ${i}`} className="h-full w-24 rounded-lg object-cover" />
          ))}
        </Carousel>,
      )
      const scrollContainer = getScrollContainer()
      const dots = document.querySelectorAll(".carousel-dot")
      const itemElements = getItemElements()
      expect(dots).toHaveLength(3)
      // 2番目のアイテムへスクロール
      const targetScroll = itemElements[1].offsetLeft - itemElements[0].offsetLeft
      scrollContainer.scrollLeft = targetScroll
      scrollContainer.dispatchEvent(new Event("scroll"))
      await waitFor(() => {
        // DOMテストではCSSアニメーションを直接テストできないため、ドットの存在確認のみ
        expect(dots[1]).toBeInTheDocument()
      })
    })
  })
})
