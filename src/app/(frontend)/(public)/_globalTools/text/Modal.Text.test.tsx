import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { useToolActionStore, type ToolActionState, type ToolActions } from "../_hooks/useToolActionStore"
import TextModal from "./Modal.Text"
import { textActions } from "./textStore"

// useToolActionStore モック
vi.mock("../_hooks/useToolActionStore", () => ({
  useToolActionStore: vi.fn(),
}))

// window globals モック
Object.defineProperty(window, "confirm", {
  writable: true,
  value: vi.fn(() => true),
})

Object.defineProperty(window, "fetch", {
  writable: true,
  value: vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      text: () => Promise.resolve("# Test\n\nContent"),
    }),
  ),
})

beforeAll(() => {
  // ブラウザ環境でのアニメーションによるタイミング問題を回避するため無効化
  const style = document.createElement("style")
  style.innerHTML = `
    * {
      transition: none !important;
      animation: none !important;
    }
  `
  document.head.appendChild(style)
})

beforeEach(() => {
  // ブラウザ状態をリセット
  document.body.focus()
})

afterEach(() => {
  cleanup()
  textActions._internal_reset() // 全状態を完全リセット
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe("TextModal (Clean and Semantic Test)", () => {
  let user: ReturnType<typeof userEvent.setup>
  const defaultState: Partial<ToolActionState & ToolActions> = {
    currentFileSet: "test-set",
    textFiles: [],
    fileSetInfo: [{ name: "test-set", count: 0, latestImageUrl: null, latestIdbKey: null }],
    deleteFiles: vi.fn(),
    saveFile: vi.fn().mockResolvedValue({ idbKey: "key1", id: "id1" }),
    getFileWithUrl: vi.fn().mockResolvedValue("blob:url"),
    switchFileSet: vi.fn(),
    isDbReady: true,
  }

  beforeEach(() => {
    user = userEvent.setup()
  })

  const renderModal = (props = {}) => {
    vi.mocked(useToolActionStore).mockReturnValue(defaultState as unknown as ToolActionState & ToolActions)
    return render(<TextModal isOpen={true} onClose={() => {}} {...props} />)
  }

  // モーダルが完全にレンダリングされるまで待機
  const waitForModalReady = async () => {
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Begin your narrative/i)).toBeInTheDocument()
    })
  }

  it("入力に応じて文字数と単語数が更新される", async () => {
    renderModal()
    await waitForModalReady()
    const textarea = screen.getByPlaceholderText(/Begin your narrative/i)
    await user.click(textarea)
    // ブラウザ環境では一気流し込むより type の方がイベントが確実に飛ぶ
    await user.type(textarea, "Hello World")
    await waitFor(
      () => {
        expect(textarea).toHaveValue("Hello World")
        expect(screen.getByLabelText(/word count/i)).toHaveTextContent("2")
        expect(screen.getByLabelText(/character count/i)).toHaveTextContent("11")
      },
      { timeout: 3000 },
    )
  })

  it("タグの追加と削除ができる", async () => {
    renderModal()
    await waitForModalReady()
    const tagInput = screen.getByPlaceholderText(/APPEND TAG/i)
    await user.click(tagInput)
    await user.type(tagInput, "idea")
    await user.keyboard("{Enter}")
    // findByText で出現を待機 -> remove button の出現で確認（重複回避）
    const removeBtn = await screen.findByRole("button", { name: /remove tag idea/i }, { timeout: 3000 })
    expect(removeBtn).toBeInTheDocument()
    await user.click(removeBtn)
    await waitFor(() => {
      expect(screen.queryByText(/idea/)).not.toBeInTheDocument()
    })
  })

  it("新規保存ができる", async () => {
    renderModal()
    const textarea = screen.getByPlaceholderText(/Begin your narrative/i)
    await user.click(textarea)
    await user.type(textarea, "My new note")
    const saveBtn = screen.getByRole("button", { name: "Save note" })
    await user.click(saveBtn)
    expect(defaultState.saveFile).toHaveBeenCalled()
  })

  it("既存ファイル編集時に saveFile が idbKey 付きで呼ばれる (upsert)", async () => {
    // Classical Approach: textActions を直接操作、モックは外部境界のみ
    const mockSaveFile = vi.fn().mockResolvedValue({ idbKey: "existing-key", id: "id1" })
    // textActions に外部アクションを設定（外部依存のみモック）
    textActions.setExternalActions({
      saveFile: mockSaveFile,
      getFileWithUrl: vi.fn().mockResolvedValue("blob:test-url"),
    })

    // 1. ファイルをロード（editingIdbKey が設定される）
    await textActions.loadText("existing-key")
    // 2. 編集
    textActions.setText("Updated content")
    textActions.setTitle("Updated Title")
    // 3. 保存
    await textActions.saveText()
    // 4. saveFile が idbKey 付きで呼ばれたことを確認（upsert）
    expect(mockSaveFile).toHaveBeenCalledWith(
      expect.stringContaining("Updated Title"),
      expect.objectContaining({ title: "Updated Title" }),
      expect.objectContaining({
        idbKey: "existing-key", // upsert: 既存キーが渡される
        category: "text",
      }),
    )
  })

  it("FileSetを切り替えると選択がリセットされる", async () => {
    const mockFile = {
      id: "id1",
      idbKey: "key1",
      fileName: "note.md",
      mimeType: "text/markdown",
      size: 100,
      createdAt: new Date(),
      sessionId: "s1",
    }
    vi.mocked(useToolActionStore).mockReturnValue({
      ...defaultState,
      textFiles: [mockFile],
    } as unknown as ToolActionState & ToolActions)
    const { rerender } = render(<TextModal isOpen={true} onClose={() => {}} />)
    // 選択
    const selectBtn = await screen.findByRole("button", { name: /select note note/i })
    await user.click(selectBtn)
    // バッジが表示されるのを待つ
    expect(await screen.findByText("1")).toBeInTheDocument()
    // FileSetを切り替え
    vi.mocked(useToolActionStore).mockReturnValue({
      ...defaultState,
      currentFileSet: "new-set",
      textFiles: [],
    } as unknown as ToolActionState & ToolActions)
    rerender(<TextModal isOpen={true} onClose={() => {}} />)
    // バッジが消えるのを待つ
    await waitFor(() => {
      expect(screen.queryByText("1")).not.toBeInTheDocument()
    })
  })

  describe("Preview", () => {
    it("テキスト入力後にプレビューボタンでプレビューモーダルが開く", async () => {
      renderModal()
      await waitForModalReady()
      // テキストを入力
      const textarea = screen.getByPlaceholderText(/Begin your narrative/i)
      await user.click(textarea)
      await user.type(textarea, "Preview test content")
      // プレビューボタンをクリック
      const previewBtn = screen.getByRole("button", { name: /toggle preview/i })
      await user.click(previewBtn)
      // プレビューモーダル内のフッターが表示されることを確認
      await screen.findByText("( End of Fragment )", {}, { timeout: 3000 })
      // プレビューモーダル内のコンテンツを確認（textarea 以外を探す）
      await screen.findByText(/Preview test content/, { selector: ":not(textarea)" }, { timeout: 3000 })
    })

    it("プレビューにタイトルとタグが正しく表示される", async () => {
      renderModal()
      await waitForModalReady()
      // タイトルを入力
      const titleInput = screen.getByPlaceholderText(/UNTITLED THOUGHT/i)
      await user.click(titleInput)
      await user.clear(titleInput)
      await user.type(titleInput, "My Test Title")
      // タグを追加
      const tagInput = screen.getByPlaceholderText(/APPEND TAG/i)
      await user.click(tagInput)
      await user.type(tagInput, "test-tag")
      await user.keyboard("{Enter}")
      // タグが追加されるまで待機（remove button の出現で確認）
      await screen.findByRole("button", { name: /remove tag test-tag/i }, { timeout: 3000 })
      // テキストを入力
      const textarea = screen.getByPlaceholderText(/Begin your narrative/i)
      await user.click(textarea)
      await user.type(textarea, "Preview body content")
      // プレビューを開く
      const previewBtn = screen.getByRole("button", { name: /toggle preview/i })
      await user.click(previewBtn)
      // プレビュー内にタイトルが表示される
      await screen.findByText("My Test Title", { selector: "h1" }, { timeout: 3000 })
      // プレビュー内にタグが表示される（#test-tag 形式、複数を許容）
      const tags = await screen.findAllByText(/#test-tag/)
      expect(tags.length).toBeGreaterThan(0)
    })
  })

  describe("FileSet Library", () => {
    it("ライブラリボタンでモーダルが開く", async () => {
      renderModal()
      // ライブラリボタンをクリック
      const libraryBtn = screen.getByRole("button", { name: /open fileset library/i })
      await user.click(libraryBtn)
      // Collection Library が表示される
      await screen.findByText("Collection Library", {}, { timeout: 3000 })
    })

    it("既存 FileSet をクリックで切替", async () => {
      const mockSwitchFileSet = vi.fn()
      vi.mocked(useToolActionStore).mockReturnValue({
        ...defaultState,
        fileSetInfo: [
          { name: "test-set", count: 0, latestImageUrl: null, latestIdbKey: null },
          { name: "other-set", count: 2, latestImageUrl: null, latestIdbKey: null },
        ],
        switchFileSet: mockSwitchFileSet,
      } as unknown as ToolActionState & ToolActions)

      render(<TextModal isOpen={true} onClose={() => {}} />)
      // ライブラリを開く
      const libraryBtn = screen.getByRole("button", { name: /open fileset library/i })
      await user.click(libraryBtn)
      // other-set をクリック
      const otherSetBtn = await screen.findByText("other-set")
      await user.click(otherSetBtn)
      // switchFileSet が呼ばれる
      expect(mockSwitchFileSet).toHaveBeenCalledWith("other-set")
    })
  })

  describe("File Selection and Deletion", () => {
    const mockFile = {
      id: "id1",
      idbKey: "key1",
      fileName: "note.md",
      mimeType: "text/markdown",
      size: 100,
      createdAt: new Date(),
      sessionId: "s1",
    }

    it("ファイルカードの選択ボタンで選択状態になる", async () => {
      vi.mocked(useToolActionStore).mockReturnValue({
        ...defaultState,
        textFiles: [mockFile],
      } as unknown as ToolActionState & ToolActions)
      render(<TextModal isOpen={true} onClose={() => {}} />)
      // 選択ボタンをクリック
      const selectBtn = await screen.findByRole("button", { name: /select note note/i })
      await user.click(selectBtn)
      // バッジに "1" が表示される
      expect(await screen.findByText("1")).toBeInTheDocument()
    })

    it("Clear ボタンで選択解除", async () => {
      vi.mocked(useToolActionStore).mockReturnValue({
        ...defaultState,
        textFiles: [mockFile],
      } as unknown as ToolActionState & ToolActions)
      render(<TextModal isOpen={true} onClose={() => {}} />)
      // 選択
      const selectBtn = await screen.findByRole("button", { name: /select note note/i })
      await user.click(selectBtn)
      expect(await screen.findByText("1")).toBeInTheDocument()
      // Clear をクリック
      const clearBtn = screen.getByText("Clear")
      await user.click(clearBtn)
      // バッジが消える
      await waitFor(() => {
        expect(screen.queryByText("1")).not.toBeInTheDocument()
      })
    })

    it("削除ボタンで confirm 後に deleteFiles が呼ばれる", async () => {
      const mockDeleteFiles = vi.fn()
      vi.mocked(useToolActionStore).mockReturnValue({
        ...defaultState,
        textFiles: [mockFile],
        deleteFiles: mockDeleteFiles,
      } as unknown as ToolActionState & ToolActions)
      render(<TextModal isOpen={true} onClose={() => {}} />)
      // 選択
      const selectBtn = await screen.findByRole("button", { name: /select note note/i })
      await user.click(selectBtn)
      // 削除ボタンをクリック
      const deleteBtn = screen.getByRole("button", { name: /delete 1 selected notes/i })
      await user.click(deleteBtn)
      // confirm=true なので deleteFiles が呼ばれる
      expect(mockDeleteFiles).toHaveBeenCalledWith([{ idbKey: "key1", id: "id1" }])
    })
  })

  describe("Main Action Button", () => {
    it("未保存時は Save ボタンが表示される", async () => {
      renderModal()
      expect(screen.getByRole("button", { name: "Save note" })).toBeInTheDocument()
    })

    it("保存後は Create new note ボタンに変わる", async () => {
      // Classical Approach: textActions を直接操作
      const mockSaveFile = vi.fn().mockResolvedValue({ idbKey: "new-key", id: "new-id" })
      textActions.setExternalActions({
        saveFile: mockSaveFile,
        getFileWithUrl: vi.fn().mockResolvedValue("blob:test-url"),
      })
      renderModal()
      // テキストを入力して保存
      const textarea = screen.getByPlaceholderText(/Begin your narrative/i)
      await user.click(textarea)
      await user.type(textarea, "Test content")
      const saveBtn = screen.getByRole("button", { name: "Save note" })
      await user.click(saveBtn)
      // 保存後は Create new note に変わる
      await screen.findByRole("button", { name: "Create new note" }, { timeout: 3000 })
    })

    it("Create new note で新規作成状態にリセットされる", async () => {
      // Classical Approach: textActions を直接操作
      const mockSaveFile = vi.fn().mockResolvedValue({ idbKey: "new-key", id: "new-id" })
      textActions.setExternalActions({
        saveFile: mockSaveFile,
        getFileWithUrl: vi.fn().mockResolvedValue("blob:test-url"),
      })
      renderModal()
      // テキストを入力して保存
      const textarea = screen.getByPlaceholderText(/Begin your narrative/i)
      await user.click(textarea)
      await user.type(textarea, "Test content for new")
      const saveBtn = screen.getByRole("button", { name: "Save note" })
      await user.click(saveBtn)
      const newBtn = await screen.findByRole("button", { name: "Create new note" }, { timeout: 3000 })
      // Create new note をクリック
      await user.click(newBtn)
      // テキストがクリアされ、Save note に戻る
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Save note" })).toBeInTheDocument()
        expect(screen.getByPlaceholderText(/Begin your narrative/i)).toHaveValue("")
      })
    })
  })

  describe("Markdown Keyboard Features", () => {
    it("リスト項目入力後にEnterで自動継続される", async () => {
      renderModal()
      await waitForModalReady()
      const textarea = screen.getByPlaceholderText(/Begin your narrative/i)
      await user.click(textarea)
      // "- item" と入力
      await user.type(textarea, "- item")
      // Enter を押す
      await user.keyboard("{Enter}")
      // 次の行に "- " が自動挿入される
      await waitFor(() => {
        expect(textarea).toHaveValue("- item\n- ")
      })
    })

    it("番号付きリストで自動的に番号がインクリメントされる", async () => {
      renderModal()
      await waitForModalReady()
      const textarea = screen.getByPlaceholderText(/Begin your narrative/i)
      await user.click(textarea)
      await user.type(textarea, "1. first")
      await user.keyboard("{Enter}")
      await waitFor(() => {
        expect(textarea).toHaveValue("1. first\n2. ")
      })
    })

    it("'- [' と入力すると '- [ ] ' に自動補完される", async () => {
      renderModal()
      await waitForModalReady()
      const textarea = screen.getByPlaceholderText(/Begin your narrative/i)
      await user.click(textarea)
      // "- " と入力
      await user.type(textarea, "- ")
      // "[" を入力 (特殊文字なので {[} でエスケープ)
      await user.keyboard("{[}")
      // "- [ ] " に自動補完される
      await waitFor(() => {
        expect(textarea).toHaveValue("- [ ] ")
      })
    })

    it("チェックボックス項目でEnterすると未チェックのチェックボックスが継続される", async () => {
      renderModal()
      await waitForModalReady()
      const textarea = screen.getByPlaceholderText(/Begin your narrative/i)
      await user.click(textarea)
      // 自動補完機能を使用: "- " + "[" で "- [ ] " に補完される
      await user.type(textarea, "- ")
      await user.keyboard("{[}")
      // 補完後に task1 を入力
      await user.type(textarea, "task1")
      await user.keyboard("{Enter}")
      await waitFor(() => {
        expect(textarea).toHaveValue("- [ ] task1\n- [ ] ")
      })
    })

    it("空のリスト項目でEnterするとプレフィックスが削除される", async () => {
      renderModal()
      await waitForModalReady()
      const textarea = screen.getByPlaceholderText(/Begin your narrative/i)
      await user.click(textarea)
      await user.type(textarea, "- item")
      await user.keyboard("{Enter}")
      // 空の "- " 状態で Enter
      await user.keyboard("{Enter}")
      await waitFor(() => {
        // プレフィックスが削除され、空行になる
        expect(textarea).toHaveValue("- item\n")
      })
    })

    it("Tabでインデントが追加される", async () => {
      renderModal()
      await waitForModalReady()
      const textarea = screen.getByPlaceholderText(/Begin your narrative/i)
      await user.click(textarea)
      await user.type(textarea, "text")
      // カーソルを行頭に移動
      await user.keyboard("{Home}")
      await user.keyboard("{Tab}")
      await waitFor(() => {
        expect(textarea).toHaveValue("  text")
      })
    })
  })

  describe("Preview Checkbox Toggle", () => {
    it("プレビューのチェックボックスをクリックするとソーステキストが更新される", async () => {
      renderModal()
      await waitForModalReady()
      const textarea = screen.getByPlaceholderText(/Begin your narrative/i)
      await user.click(textarea)
      // 自動補完を使用してチェックボックスを入力
      await user.type(textarea, "- ")
      await user.keyboard("{[}")
      await user.type(textarea, "unchecked task")
      // プレビューを開く
      const previewBtn = screen.getByRole("button", { name: /toggle preview/i })
      await user.click(previewBtn)
      // プレビュー内のチェックボックスを探してクリック
      const checkbox = await screen.findByRole("checkbox", {}, { timeout: 3000 })
      expect(checkbox).not.toBeChecked()
      await user.click(checkbox)
      // ソーステキストが更新される
      await waitFor(() => {
        expect(textarea).toHaveValue("- [x] unchecked task")
      })
    })
  })

  describe("Markdown Preview Rendering", () => {
    // 包括的なMarkdownサンプルで全ての要素が正しくレンダリングされることを確認
    const COMPREHENSIVE_MARKDOWN = `# Heading 1

## Heading 2

### Heading 3

This is a **bold** text and *italic* text. Also ~~strikethrough~~ and \`inline code\`.

- Unordered list item 1
- Unordered list item 2
  - Nested item

1. Ordered list item 1
2. Ordered list item 2

- [ ] Task unchecked
- [x] Task checked

> This is a blockquote

| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |

\`\`\`javascript
const code = "block";
\`\`\`

[Link text](https://example.com)

---

End of sample.`

    it("包括的なMarkdownが正しくプレビューされる", async () => {
      // textActions を直接使用してテキストを設定
      textActions.setText(COMPREHENSIVE_MARKDOWN)
      textActions.setTitle("Markdown Test")
      renderModal()
      await waitForModalReady()

      // プレビューを開く
      const previewBtn = screen.getByRole("button", { name: /toggle preview/i })
      await user.click(previewBtn)

      // 各要素が表示されることを確認
      await waitFor(
        () => {
          // ヘッダー
          expect(screen.getByRole("heading", { level: 1, name: "Heading 1" })).toBeInTheDocument()
          expect(screen.getByRole("heading", { level: 2, name: "Heading 2" })).toBeInTheDocument()
          expect(screen.getByRole("heading", { level: 3, name: "Heading 3" })).toBeInTheDocument()
        },
        { timeout: 5000 },
      )

      // リスト
      expect(screen.getByText("Unordered list item 1")).toBeInTheDocument()
      expect(screen.getByText("Ordered list item 1")).toBeInTheDocument()

      // チェックボックス
      const checkboxes = screen.getAllByRole("checkbox")
      expect(checkboxes.length).toBe(2)
      expect(checkboxes[0]).not.toBeChecked() // unchecked
      expect(checkboxes[1]).toBeChecked() // checked

      // テーブル
      expect(screen.getByRole("table")).toBeInTheDocument()
      expect(screen.getByText("Header 1")).toBeInTheDocument()
      expect(screen.getByText("Cell 1")).toBeInTheDocument()

      // 引用
      expect(screen.getByText("This is a blockquote")).toBeInTheDocument()

      // コードブロック (プレビュー内の pre > code 要素を確認)
      const codeBlocks = screen.getAllByText(/const code/)
      // textarea以外にもコードブロックがあることを確認
      expect(codeBlocks.length).toBeGreaterThanOrEqual(2) // textarea内とプレビュー内

      // リンク
      expect(screen.getByRole("link", { name: "Link text" })).toHaveAttribute("href", "https://example.com")

      // 水平線
      expect(document.querySelector("hr")).toBeInTheDocument()
    })

    it("インラインコードがバッククォートなしでレンダリングされる", async () => {
      const inlineCodeMarkdown = "This is `inline code` text"

      textActions.setText(inlineCodeMarkdown)
      renderModal()
      await waitForModalReady()

      const previewBtn = screen.getByRole("button", { name: /toggle preview/i })
      await user.click(previewBtn)

      await waitFor(
        () => {
          // インラインコードが <code> 要素としてレンダリングされる
          const codeElement = document.querySelector(".prose code")
          expect(codeElement).toBeInTheDocument()
          expect(codeElement?.textContent).toBe("inline code")
          // バッククォートが表示されていないことを確認
          const proseContent = document.querySelector(".prose")?.textContent
          expect(proseContent).not.toContain("`")
        },
        { timeout: 3000 },
      )
    })

    it("テーブルがGitHub風にスタイリングされる", async () => {
      const tableMarkdown = `| Name | Age | City |
|------|-----|------|
| John | 30  | NYC  |
| Jane | 25  | LA   |`

      textActions.setText(tableMarkdown)
      renderModal()
      await waitForModalReady()

      const previewBtn = screen.getByRole("button", { name: /toggle preview/i })
      await user.click(previewBtn)

      await waitFor(
        () => {
          const table = screen.getByRole("table")
          expect(table).toBeInTheDocument()
          // テーブルのスタイルを確認（prose クラスによるスタイリング）
          expect(table.closest(".prose")).toBeInTheDocument()
        },
        { timeout: 3000 },
      )
    })
  })

  describe("Lifecycle", () => {
    it("isOpen=false から true に変わると setup が呼ばれる", async () => {
      const setupSpy = vi.spyOn(textActions, "setup")
      const { rerender } = render(<TextModal isOpen={false} onClose={() => {}} />)
      // 初期は setup が呼ばれない
      expect(setupSpy).not.toHaveBeenCalled()
      // isOpen=true に変更
      rerender(<TextModal isOpen={true} onClose={() => {}} />)
      await waitFor(() => {
        expect(setupSpy).toHaveBeenCalled()
      })
      setupSpy.mockRestore()
    })

    it("isOpen=false で cleanup が呼ばれない（状態維持）", async () => {
      const cleanupSpy = vi.spyOn(textActions, "cleanup")
      const { rerender } = render(<TextModal isOpen={true} onClose={() => {}} />)
      // isOpen=false に変更
      rerender(<TextModal isOpen={false} onClose={() => {}} />)
      // 状態維持のため cleanup は呼ばれないはず
      await waitFor(() => {
        expect(cleanupSpy).not.toHaveBeenCalled()
      })
      cleanupSpy.mockRestore()
    })
  })
})
