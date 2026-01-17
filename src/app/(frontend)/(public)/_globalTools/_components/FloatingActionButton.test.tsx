import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import FloatingActionButton from "./FloatingActionButton"

afterEach(() => {
  cleanup()
})

// テストデータの一貫性を保つためのフィクスチャ
const createMockItems = () => [
  { id: "action-1", label: "アクション1", icon: null, onClick: vi.fn(), disabled: false },
  { id: "action-2", label: "アクション2", icon: null, onClick: vi.fn(), disabled: false },
  { id: "action-3", label: "アクション3", icon: null, onClick: vi.fn(), disabled: true },
]

type ItemType = ReturnType<typeof createMockItems>[0]

describe("FloatingActionButton", () => {
  describe("レンダリング", () => {
    it("トリガーボタンが正しいアクセシビリティ属性でレンダリングされる", () => {
      const items = createMockItems()
      render(
        <FloatingActionButton>
          <FloatingActionButton.Trigger items={items}>
            {({ isExpanded, toggle }) => (
              <button onClick={toggle} aria-expanded={isExpanded} aria-label="アクションを切り替え">
                {isExpanded ? "閉じる" : "開く"}
              </button>
            )}
          </FloatingActionButton.Trigger>
          <FloatingActionButton.ActionList>
            <div>アクションリスト</div>
          </FloatingActionButton.ActionList>
        </FloatingActionButton>,
      )

      const button = screen.getByRole("button", { name: /アクションを切り替え/i })
      expect(button).toBeVisible()
      expect(button).toHaveAttribute("aria-expanded", "false")
    })

    it("展開時にアクションリストがレンダリングされる", async () => {
      const user = userEvent.setup()
      const items = createMockItems()
      render(
        <FloatingActionButton>
          <FloatingActionButton.Trigger items={items}>
            {({ isExpanded, toggle }) => (
              <button onClick={toggle} aria-expanded={isExpanded}>
                {isExpanded ? "閉じる" : "開く"}
              </button>
            )}
          </FloatingActionButton.Trigger>
          <FloatingActionButton.ActionList>
            <div>アクションリストの内容</div>
          </FloatingActionButton.ActionList>
        </FloatingActionButton>,
      )

      const button = screen.getByRole("button")
      await user.click(button)

      // 展開アニメーションを待つ
      expect(await screen.findByText("アクションリストの内容")).toBeVisible()
    })
  })

  describe("インタラクション", () => {
    it("トリガーがクリックされたときに展開状態が切り替わる", async () => {
      const user = userEvent.setup()
      const items = createMockItems()
      render(
        <FloatingActionButton>
          <FloatingActionButton.Trigger items={items}>
            {({ isExpanded, toggle }) => (
              <button onClick={toggle} aria-expanded={isExpanded}>
                {isExpanded ? "閉じる" : "開く"}
              </button>
            )}
          </FloatingActionButton.Trigger>
          <FloatingActionButton.ActionList>
            <div>アクションリスト</div>
          </FloatingActionButton.ActionList>
        </FloatingActionButton>,
      )

      const button = screen.getByRole("button")

      // 初期状態は折りたたみ
      expect(button).toHaveAttribute("aria-expanded", "false")

      // クリックして展開
      await user.click(button)
      expect(button).toHaveAttribute("aria-expanded", "true")

      // クリックして折りたたみ
      await user.click(button)
      expect(button).toHaveAttribute("aria-expanded", "false")
    })

    it("フリックジェスチャーが実行されたときにアクションコールバックが実行される", async () => {
      const items = createMockItems()
      const mockOnClick = vi.fn()

      // 最初のアイテムをオーバーライド
      items[0].onClick = mockOnClick

      render(<FloatingActionButton.Simple items={items} />)

      // useIsClientがtrueになるまで待つ
      await waitFor(() => expect(screen.getAllByRole("button")).toHaveLength(4))

      // Triggerのdivを取得（タッチイベントハンドラーが付いている）
      const triggerButton = screen.getAllByRole("button").find((button) => button.classList.contains("h-16"))!
      const triggerDiv = triggerButton.parentElement as HTMLElement

      // フリックジェスチャーをシミュレート: タッチ開始 → 移動 → 終了
      // 最初のアイテムの方向（startAngle: -200度）に近い角度（-180度）でフリック
      const startX = 100
      const startY = 100
      const endX = startX - 51 // dx = -51, dy = 0, dist > 50
      const endY = startY

      // fireEventでタッチイベントを直接dispatch
      const touchStart = new Touch({ identifier: 0, target: triggerDiv, clientX: startX, clientY: startY })
      const touchEnd = new Touch({ identifier: 0, target: triggerDiv, clientX: endX, clientY: endY })
      fireEvent.touchStart(triggerDiv, {
        touches: [touchStart],
      })
      fireEvent.touchMove(triggerDiv, {
        touches: [touchEnd],
      })
      fireEvent.touchEnd(triggerDiv)

      // フリックによりonClickが呼ばれたことを確認
      expect(mockOnClick).toHaveBeenCalledTimes(1)
    })
  })

  describe("アクセシビリティ", () => {
    it("状態変化中に適切なARIA属性を維持する", async () => {
      const user = userEvent.setup()
      const items = createMockItems()
      render(
        <FloatingActionButton>
          <FloatingActionButton.Trigger items={items}>
            {({ isExpanded, toggle }) => (
              <button onClick={toggle} aria-expanded={isExpanded} aria-label="メニューを切り替え">
                メニュー
              </button>
            )}
          </FloatingActionButton.Trigger>
          <FloatingActionButton.ActionList>
            <div>アクション</div>
          </FloatingActionButton.ActionList>
        </FloatingActionButton>,
      )

      const button = screen.getByRole("button", { name: /メニューを切り替え/i })

      expect(button).toHaveAttribute("aria-expanded", "false")

      await user.click(button)
      expect(button).toHaveAttribute("aria-expanded", "true")
    })

    it("キーボードナビゲーションを適切に処理する", async () => {
      const user = userEvent.setup()
      const items = createMockItems()
      render(
        <FloatingActionButton>
          <FloatingActionButton.Trigger items={items}>
            {({ isExpanded, toggle }) => <button onClick={toggle}>{isExpanded ? "閉じる" : "開く"}</button>}
          </FloatingActionButton.Trigger>
          <FloatingActionButton.ActionList>
            <div>アクションリスト</div>
          </FloatingActionButton.ActionList>
        </FloatingActionButton>,
      )

      const button = screen.getByRole("button")

      // フォーカスしてEnterを押す
      button.focus()
      await user.keyboard("{Enter}")

      expect(button).toHaveTextContent("閉じる")
    })
  })

  describe("エラーハンドリング", () => {
    it("空のアイテム配列を適切に処理する", () => {
      render(
        <FloatingActionButton>
          <FloatingActionButton.Trigger items={[]}>
            {({ isExpanded, toggle }) => <button onClick={toggle}>{isExpanded ? "閉じる" : "開く"}</button>}
          </FloatingActionButton.Trigger>
          <FloatingActionButton.ActionList>
            <div>アクションリスト</div>
          </FloatingActionButton.ActionList>
        </FloatingActionButton>,
      )

      const button = screen.getByRole("button")
      expect(button).toBeVisible()
      expect(button).toHaveTextContent("開く")
    })

    it("アイテムに無効な構造がある場合でもクラッシュしない", () => {
      type InvalidItem = Partial<Omit<ItemType, "id">> & { id: null }
      const invalidItems: InvalidItem[] = [
        { id: null, label: "無効", onClick: vi.fn() }, // 無効なid
      ]

      render(
        <FloatingActionButton>
          <FloatingActionButton.Trigger items={invalidItems as unknown as ItemType[]}>
            {({ isExpanded, toggle }) => <button onClick={toggle}>{isExpanded ? "閉じる" : "開く"}</button>}
          </FloatingActionButton.Trigger>
          <FloatingActionButton.ActionList>
            <div>アクションリスト</div>
          </FloatingActionButton.ActionList>
        </FloatingActionButton>,
      )

      const button = screen.getByRole("button")
      expect(button).toBeVisible()
    })
  })
})
