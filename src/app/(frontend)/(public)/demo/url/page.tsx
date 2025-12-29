"use client"

import { SimpleValidator, useUrlState } from "@/hooks/useUrlState"
import Link from "next/link"
import { useMemo, useState } from "react"

// 検索フィルターの型定義
interface SearchFilters {
  query: string
  category: string
  minPrice: number
  maxPrice: number
  inStock: boolean
  tags: string[]
}

// ユーザー設定の型定義
interface UserSettings {
  theme: "light" | "dark" | "system"
  fontSize: number
  notifications: boolean
  language: string
  autoSave: boolean
}

// フォームデータの型定義
interface FormData {
  name: string
  email: string
  age: number
  remarks?: string
}

export default function UrlStateDemo() {
  // タブ管理用の通常のuseState
  const [activeTab, setActiveTab] = useState<string>("filters")
  const [activeCodeTab, setActiveCodeTab] = useState<string>("usage")
  const [activeFeatureTab, setActiveFeatureTab] = useState<string>("basic")
  const [showErrors, setShowErrors] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // ----- 基本的な使用例 -----

  // 1. オブジェクト型（検索フィルター）
  const [filters, setFilters] = useUrlState<SearchFilters>({
    key: "filters",
    defaultValue: {
      query: "",
      category: "all",
      minPrice: 0,
      maxPrice: 1000,
      inStock: false,
      tags: [],
    },
    prefix: "search", // プレフィックスを付けてURLパラメータをグループ化
    debounceMs: 400, // 入力を400ms遅延してURLを更新
  })

  // 2. 詳細設定とストレージオプション
  const [settings, setSettings] = useUrlState<UserSettings>({
    key: "settings",
    defaultValue: {
      theme: "system",
      fontSize: 16,
      notifications: true,
      language: "ja",
      autoSave: true,
    },
    storage: {
      type: "local", // ローカルストレージにも保存
      syncWithUrl: true, // URL更新時にストレージも更新
    },
    history: "replace", // URLの履歴を残さない
    debug: true, // デバッグモード有効
  })

  // 3. バリデーション付きフォーム（SimpleValidatorを使用）
  const formValidator = new SimpleValidator<FormData>({
    name: "string",
    email: "string",
    age: "number",
    remarks: "string",
  })

  const [formData, setFormData] = useUrlState<FormData>({
    key: "formData",
    defaultValue: {
      name: "",
      email: "",
      age: 20,
      remarks: "",
    },
    validator: formValidator,
    onError: (error) => {
      console.error("バリデーションエラー:", error)
      setShowErrors(true)

      // 3秒後にエラー表示を消す
      setTimeout(() => setShowErrors(false), 3000)
    },
  })

  // 4. 拡張APIを使用した高度な使用例
  const {
    state: product,
    setState: setProduct,
    error: productError,
    meta: productMeta,
  } = useUrlState(
    {
      key: "product",
      defaultValue: {
        id: 1,
        name: "商品名",
        price: 2000,
        description: "商品の説明",
        options: ["サイズS", "サイズM", "サイズL"],
      },
      transform: {
        // カスタムシリアライズ処理（圧縮など）
        serialize: (value) => {
          return encodeURIComponent(
            JSON.stringify(value)
              .replace(/"id":/g, '"i":')
              .replace(/"name":/g, '"n":')
              .replace(/"price":/g, '"p":')
              .replace(/"description":/g, '"d":')
              .replace(/"options":/g, '"o":'),
          )
        },
        // カスタムデシリアライズ処理
        deserialize: (raw, defaultValue) => {
          try {
            const compressed = JSON.parse(decodeURIComponent(raw))
              .replace(/"i":/g, '"id":')
              .replace(/"n":/g, '"name":')
              .replace(/"p":/g, '"price":')
              .replace(/"d":/g, '"description":')
              .replace(/"o":/g, '"options":')
            return JSON.parse(compressed)
          } catch (e) {
            return defaultValue
          }
        },
      },
      onChange: (newValue, oldValue) => {
        console.log(`商品データが変更されました: ${oldValue.name} → ${newValue.name}`)
        setSuccessMessage("商品データが更新されました")
        setTimeout(() => setSuccessMessage(null), 2000)
      },
    },
    { extended: true },
  )

  // タグ入力フィールド用の状態
  const [tagInput, setTagInput] = useState("")

  // タグ配列を直接操作する関数
  const addTag = () => {
    if (tagInput.trim() && !filters.tags.includes(tagInput)) {
      setFilters({
        ...filters,
        tags: [...filters.tags, tagInput],
      })
      setTagInput("")
    }
  }

  // タグを削除する関数
  const removeTag = (tag: string) => {
    setFilters({
      ...filters,
      tags: filters.tags.filter((t) => t !== tag),
    })
  }

  // 現在のURLパラメータを表示
  const currentUrlParams = useMemo(() => {
    if (typeof window === "undefined") return ""
    const params = new URLSearchParams(window.location.search)
    return Array.from(params.entries())
      .map(([key, value]) => {
        let displayValue = value
        try {
          // JSONとしてパースできる場合は整形して表示
          const parsed = JSON.parse(decodeURIComponent(value))
          displayValue = JSON.stringify(parsed, null, 2)
        } catch {
          // パースできない場合はそのまま表示
        }
        return `${key}:\n  ${displayValue}`
      })
      .join("\n\n")
    // }, [filters, settings, formData, product]);
  }, [])

  // useUrlStateのコード例
  const codeExamples: Record<string, string> = {
    usage: `// 基本的な使用方法
const [count, setCount] = useUrlState<number>(0);

// キーを指定した使用方法
const [text, setText] = useUrlState("textParam", "初期値");

// オプション指定
const [filters, setFilters] = useUrlState<FiltersType>({
  key: "filters",
  defaultValue: { category: "all", price: 100 },
  debounceMs: 300,
  prefix: "search"
});`,

    enhanced: `// 型に応じた拡張メソッド

// ブール値の場合 (.toggle)
const [enabled, setEnabled] = useUrlState<boolean>("enabled", false);
setEnabled.toggle(); // true ⇔ false の切り替え

// オブジェクトの場合 (.patch, .remove)
const [user, setUser] = useUrlState<User>("user", defaultUser);
setUser.patch("name", "新しい名前"); // 特定のプロパティのみ更新
setUser.remove("temporary"); // プロパティを削除

// 配列の場合 (.push, .filter)
const [items, setItems] = useUrlState<string[]>("items", []);
setItems.push("新しいアイテム"); // 配列に追加
setItems.filter(item => item !== "削除するアイテム"); // フィルタリング`,

    advanced: `// 拡張APIの使用例
const { 
  state: product,          // 現在の状態
  setState: setProduct,    // 状態を設定する関数
  error,                   // エラー情報
  isLoading,               // 読み込み中かどうか
  meta                     // メタデータ (データソース、最終更新時刻など)
} = useUrlState({
  key: "product",
  defaultValue: { id: 1, name: "商品名" },
  storage: { type: "local", syncWithUrl: true },
  validator: new SimpleValidator(productShape),
  transform: {
    serialize: (value) => customSerialize(value),
    deserialize: (raw, defaultValue) => customDeserialize(raw, defaultValue)
  },
  onChange: (newValue, oldValue) => {
    console.log(\`商品が更新されました: \${oldValue.name} → \${newValue.name}\`);
  }
}, { extended: true });`,
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between border-b pb-4">
        <h1 className="text-3xl font-bold">useUrlState 詳細デモ</h1>
        <Link href="/demo/url/simple" className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600">
          シンプルデモへ
        </Link>
      </div>

      {/* 説明セクション */}
      <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h2 className="mb-2 text-lg font-semibold">useUrlStateフックについて</h2>
        <p className="mb-2">
          このカスタムフックを使用すると、Reactの状態をURLクエリパラメータと同期させることができます。
          これにより、ページの状態をURLに保存し、ページをリロードしたり共有したりしても状態が保持されます。
        </p>
        <p>主な機能:</p>
        <ul className="list-disc pl-5 text-sm">
          <li>数値、文字列、ブール値、オブジェクト、配列などの複雑な型をサポート</li>
          <li>型に応じた拡張メソッド（toggle, patch, push, filterなど）</li>
          <li>ローカルストレージやセッションストレージとの同期</li>
          <li>バリデーション、デバウンス、カスタムシリアライズなどの高度な機能</li>
        </ul>
      </div>

      {/* タブナビゲーション */}
      <div className="mb-6">
        <div className="border-b">
          <ul className="-mb-px flex flex-wrap">
            <li className="mr-2">
              <button
                onClick={() => setActiveTab("filters")}
                className={`inline-block px-4 py-2 text-sm font-medium ${
                  activeTab === "filters"
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "border-b-2 border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                検索フィルター
              </button>
            </li>
            <li className="mr-2">
              <button
                onClick={() => setActiveTab("settings")}
                className={`inline-block px-4 py-2 text-sm font-medium ${
                  activeTab === "settings"
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "border-b-2 border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                ユーザー設定
              </button>
            </li>
            <li className="mr-2">
              <button
                onClick={() => setActiveTab("form")}
                className={`inline-block px-4 py-2 text-sm font-medium ${
                  activeTab === "form"
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "border-b-2 border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                バリデーション
              </button>
            </li>
            <li>
              <button
                onClick={() => setActiveTab("advanced")}
                className={`inline-block px-4 py-2 text-sm font-medium ${
                  activeTab === "advanced"
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "border-b-2 border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                高度な機能
              </button>
            </li>
          </ul>
        </div>
      </div>

      {/* 現在のURLパラメータ表示 */}
      <div className="mb-6 overflow-x-auto rounded-lg border bg-gray-50 p-3">
        <h3 className="mb-1 text-sm font-medium">現在のURLパラメータ:</h3>
        <pre className="rounded border bg-white p-2 font-mono text-xs whitespace-pre-wrap">
          {currentUrlParams || "(なし)"}
        </pre>
      </div>

      {/* 成功メッセージ */}
      {successMessage && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-3 text-green-800">{successMessage}</div>
      )}

      {/* エラーメッセージ */}
      {showErrors && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
          フォームの検証エラーが発生しました。詳細はコンソールを確認してください。
        </div>
      )}

      {/* タブコンテンツ */}
      <div className="mb-8">
        {/* 検索フィルタータブ */}
        {activeTab === "filters" && (
          <div className="rounded-lg border bg-white p-5">
            <h2 className="mb-4 text-xl font-semibold">検索フィルター</h2>
            <div className="space-y-4">
              {/* 検索クエリ */}
              <div>
                <label className="mb-1 block text-sm font-medium">検索クエリ</label>
                <input
                  type="text"
                  value={filters.query}
                  onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                  className="w-full rounded border p-2"
                  placeholder="検索キーワードを入力"
                />
              </div>

              {/* カテゴリ選択 */}
              <div>
                <label className="mb-1 block text-sm font-medium">カテゴリ</label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                  className="w-full rounded border p-2"
                >
                  <option value="all">すべて</option>
                  <option value="electronics">電子機器</option>
                  <option value="clothing">衣類</option>
                  <option value="books">書籍</option>
                  <option value="home">ホーム&キッチン</option>
                </select>
              </div>

              {/* 価格範囲 */}
              <div>
                <label className="mb-1 block text-sm font-medium">
                  価格範囲: {filters.minPrice}円 - {filters.maxPrice}円
                </label>
                <div className="flex space-x-4">
                  <input
                    type="range"
                    min="0"
                    max="5000"
                    value={filters.minPrice}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        minPrice: parseInt(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                  <input
                    type="range"
                    min={filters.minPrice}
                    max="10000"
                    value={filters.maxPrice}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        maxPrice: parseInt(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                </div>
              </div>

              {/* 在庫フィルター */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="inStock"
                  checked={filters.inStock}
                  onChange={(e) => setFilters({ ...filters, inStock: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                <label htmlFor="inStock" className="ml-2 text-sm">
                  在庫あり商品のみ表示
                </label>
                <button
                  onClick={() => setFilters({ ...filters, inStock: !filters.inStock })}
                  className="ml-4 rounded bg-gray-100 px-2 py-1 text-xs"
                >
                  切り替え
                </button>
              </div>

              {/* タグフィルター */}
              <div>
                <label className="mb-1 block text-sm font-medium">タグ</label>
                <div className="flex">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    className="flex-grow rounded-l border p-2"
                    placeholder="タグを追加"
                    onKeyPress={(e) => e.key === "Enter" && addTag()}
                  />
                  <button onClick={addTag} className="rounded-r bg-blue-500 px-4 py-2 text-white">
                    追加
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {filters.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded bg-blue-100 px-2 py-1 text-xs text-blue-800"
                    >
                      {tag}
                      <button onClick={() => removeTag(tag)} className="ml-1 text-blue-500 hover:text-blue-700">
                        &times;
                      </button>
                    </span>
                  ))}
                  {filters.tags.length === 0 && <span className="text-xs text-gray-500">タグが追加されていません</span>}
                </div>
              </div>

              {/* アクションボタン */}
              <div className="flex justify-end space-x-2 border-t pt-4">
                <button
                  onClick={() => setFilters.reset()}
                  className="rounded bg-gray-100 px-4 py-2 text-gray-800 hover:bg-gray-200"
                >
                  リセット
                </button>
                <button
                  onClick={() => {
                    // 全フィールドを一度に更新する例
                    setFilters({
                      query: "サンプル検索",
                      category: "electronics",
                      minPrice: 1000,
                      maxPrice: 5000,
                      inStock: true,
                      tags: ["セール", "人気商品"],
                    })
                  }}
                  className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
                >
                  サンプル設定
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ユーザー設定タブ */}
        {activeTab === "settings" && (
          <div className="rounded-lg border bg-white p-5">
            <h2 className="mb-4 text-xl font-semibold">ユーザー設定</h2>
            <div className="space-y-4">
              {/* テーマ選択 */}
              <div>
                <label className="mb-1 block text-sm font-medium">テーマ</label>
                <div className="flex space-x-2">
                  {["light", "dark", "system"].map((theme) => (
                    <button
                      key={theme}
                      onClick={() =>
                        setSettings({
                          ...settings,
                          theme: theme as "light" | "dark" | "system",
                        })
                      }
                      className={`rounded px-4 py-2 ${
                        settings.theme === theme
                          ? "bg-blue-500 text-white"
                          : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                      }`}
                    >
                      {theme === "light" && "ライト"}
                      {theme === "dark" && "ダーク"}
                      {theme === "system" && "システム"}
                    </button>
                  ))}
                </div>
              </div>

              {/* フォントサイズ */}
              <div>
                <label className="mb-1 block text-sm font-medium">フォントサイズ: {settings.fontSize}px</label>
                <input
                  type="range"
                  min="12"
                  max="24"
                  value={settings.fontSize}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      fontSize: parseInt(e.target.value),
                    })
                  }
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>小</span>
                  <span>中</span>
                  <span>大</span>
                </div>
              </div>

              {/* 通知設定 */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="notifications"
                  checked={settings.notifications}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      notifications: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                <label htmlFor="notifications" className="ml-2 text-sm">
                  通知を有効にする
                </label>
              </div>

              {/* 言語設定 */}
              <div>
                <label className="mb-1 block text-sm font-medium">言語</label>
                <select
                  value={settings.language}
                  onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                  className="w-full rounded border p-2"
                >
                  <option value="ja">日本語</option>
                  <option value="en">English</option>
                  <option value="zh">中文</option>
                  <option value="ko">한국어</option>
                  <option value="fr">Français</option>
                </select>
              </div>

              {/* 自動保存設定 */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="autoSave"
                  checked={settings.autoSave}
                  onChange={(e) => {
                    const newAutoSave = e.target.checked
                    setSettings.setStorageEnabled(newAutoSave)

                    // setSettings({ ...settings, autoSave: newAutoSave });
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                <label htmlFor="autoSave" className="ml-2 text-sm">
                  自動保存を有効にする
                </label>
                <Link href="/demo/url" className="ml-4 text-xs text-blue-500 hover:underline" target="_blank">
                  新しいタブで開いて確認
                </Link>
              </div>

              {/* ストレージ情報表示 */}
              <div className="rounded bg-gray-50 p-3 text-sm">
                <p>
                  これらの設定はURLパラメータとローカルストレージの両方に保存されます。
                  ブラウザを閉じても設定は保持されます。
                </p>
              </div>

              {/* アクションボタン */}
              <div className="flex justify-end space-x-2 border-t pt-4">
                <button
                  onClick={() => setSettings.reset()}
                  className="rounded bg-gray-100 px-4 py-2 text-gray-800 hover:bg-gray-200"
                >
                  リセット
                </button>
                <button
                  onClick={() => {
                    // これは実際には効果がありませんが、メソッド例として表示
                    const newSettings = { ...settings }
                    delete (newSettings as any).remarks
                    setSettings(newSettings)
                  }}
                  className="rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-600"
                >
                  備考削除
                </button>
              </div>
            </div>
          </div>
        )}

        {/* バリデーションフォームタブ */}
        {activeTab === "form" && (
          <div className="rounded-lg border bg-white p-5">
            <h2 className="mb-4 text-xl font-semibold">バリデーション付きフォーム</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                // 実際の送信処理がここに入る
                setSuccessMessage("フォームデータが正常に検証されました")
                setTimeout(() => setSuccessMessage(null), 3000)
              }}
              className="space-y-4"
            >
              {/* 名前フィールド */}
              <div>
                <label className="mb-1 block text-sm font-medium">
                  名前 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded border p-2"
                  placeholder="名前を入力"
                />
                <p className="mt-1 text-xs text-gray-500">必須入力項目です</p>
              </div>

              {/* Eメールフィールド */}
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Eメール <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded border p-2"
                  placeholder="email@example.com"
                />
                <p className="mt-1 text-xs text-gray-500">有効なメールアドレスを入力してください</p>
              </div>

              {/* 年齢フィールド */}
              <div>
                <label className="mb-1 block text-sm font-medium">
                  年齢 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.age}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      age: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full rounded border p-2"
                  placeholder="年齢を入力"
                />
                <p className="mt-1 text-xs text-gray-500">18歳以上である必要があります</p>
              </div>

              {/* 備考フィールド */}
              <div>
                <label className="mb-1 block text-sm font-medium">備考</label>
                <textarea
                  value={formData.remarks || ""}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  className="w-full rounded border p-2"
                  placeholder="備考があれば入力してください"
                  rows={3}
                />
                <p className="mt-1 text-xs text-gray-500">オプション</p>
              </div>

              {/* アクションボタン */}
              <div className="flex justify-end space-x-2 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setFormData.reset()}
                  className="rounded bg-gray-100 px-4 py-2 text-gray-800 hover:bg-gray-200"
                >
                  リセット
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // わざと不正な値を設定（バリデーションエラーが発生する）
                    setFormData({
                      name: "",
                      email: "invalid-email",
                      age: 15,
                      remarks: "",
                    })
                  }}
                  className="rounded bg-red-500 px-4 py-2 text-white hover:bg-red-600"
                >
                  不正な値を設定
                </button>
                <button type="submit" className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600">
                  検証
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 高度な機能タブ */}
        {activeTab === "advanced" && (
          <div className="rounded-lg border bg-white p-5">
            <h2 className="mb-4 text-xl font-semibold">高度な機能</h2>

            {/* 機能ごとのサブタブ */}
            <div className="mb-4">
              <div className="mb-4 flex space-x-2 border-b">
                <button
                  onClick={() => setActiveFeatureTab("basic")}
                  className={`px-3 py-2 text-sm ${
                    activeFeatureTab === "basic" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500"
                  }`}
                >
                  拡張API
                </button>
                <button
                  onClick={() => setActiveFeatureTab("transform")}
                  className={`px-3 py-2 text-sm ${
                    activeFeatureTab === "transform" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500"
                  }`}
                >
                  変換処理
                </button>
                <button
                  onClick={() => setActiveFeatureTab("code")}
                  className={`px-3 py-2 text-sm ${
                    activeFeatureTab === "code" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500"
                  }`}
                >
                  コード例
                </button>
              </div>

              {/* 拡張API機能 */}
              {activeFeatureTab === "basic" && (
                <div>
                  <div className="mb-4 rounded border border-blue-100 bg-blue-50 p-3 text-sm">
                    <p>
                      拡張APIモードでは、基本的な<code>[state, setState]</code>
                      タプルの代わりに、より多くの情報と機能を提供するオブジェクトが返されます。
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* 商品情報編集 */}
                    <div>
                      <label className="mb-1 block text-sm font-medium">商品名</label>
                      <input
                        type="text"
                        value={product.name}
                        onChange={(e) => setProduct({ ...product, name: e.target.value })}
                        className="w-full rounded border p-2"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">価格</label>
                      <input
                        type="number"
                        value={product.price}
                        onChange={(e) =>
                          setProduct({
                            ...product,
                            price: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full rounded border p-2"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">説明</label>
                      <textarea
                        value={product.description}
                        onChange={(e) =>
                          setProduct({
                            ...product,
                            description: e.target.value,
                          })
                        }
                        className="w-full rounded border p-2"
                        rows={2}
                      />
                    </div>

                    {/* オプション管理 */}
                    <div>
                      <label className="mb-1 block text-sm font-medium">オプション</label>
                      <div className="mb-2 flex flex-wrap gap-2">
                        {product.options.map((option, index) => (
                          <div key={index} className="flex items-center rounded bg-gray-100 px-2 py-1">
                            <span className="text-sm">{option}</span>
                            <button
                              onClick={() =>
                                setProduct({
                                  ...product,
                                  options: product.options.filter((_, i) => i !== index),
                                })
                              }
                              className="ml-2 text-red-500 hover:text-red-700"
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() =>
                            setProduct({
                              ...product,
                              options: [...product.options, `オプション${product.options.length + 1}`],
                            })
                          }
                          className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-800"
                        >
                          + 追加
                        </button>
                      </div>
                    </div>

                    {/* メタデータ表示 */}
                    <div className="rounded bg-gray-50 p-3 text-sm">
                      <h3 className="mb-1 font-medium">状態メタデータ:</h3>
                      <ul className="space-y-1">
                        <li>
                          データソース: <span className="font-mono">{productMeta.source || "未設定"}</span>
                        </li>
                        <li>
                          最終更新:{" "}
                          <span className="font-mono">
                            {productMeta.lastUpdated ? new Date(productMeta.lastUpdated).toLocaleTimeString() : "なし"}
                          </span>
                        </li>
                        <li>
                          URLサイズ: <span className="font-mono">{productMeta.urlSize || 0} バイト</span>
                        </li>
                      </ul>
                    </div>

                    {/* エラー表示 */}
                    {productError && (
                      <div className="rounded border border-red-100 bg-red-50 p-3 text-sm text-red-800">
                        <h3 className="mb-1 font-medium">エラー:</h3>
                        <p>{productError.message}</p>
                        <p className="mt-1 text-xs">
                          タイプ: {productError.type}, 時刻: {new Date(productError.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    )}

                    {/* アクションボタン */}
                    <div className="flex justify-end space-x-2 border-t pt-4">
                      <button
                        onClick={() => setProduct.reset()}
                        className="rounded bg-gray-100 px-4 py-2 text-gray-800 hover:bg-gray-200"
                      >
                        リセット
                      </button>
                      <button
                        onClick={() => {
                          // シンプルな方法で全オブジェクトを更新
                          setProduct({
                            id: Date.now(),
                            name: "新商品 " + Math.floor(Math.random() * 100),
                            price: Math.floor(Math.random() * 10000) + 1000,
                            description: "新しい商品の説明文です。",
                            options: ["新オプション1", "新オプション2"],
                          })
                        }}
                        className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
                      >
                        ランダム更新
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 変換処理サブタブ */}
              {activeFeatureTab === "transform" && (
                <div>
                  <div className="mb-4 rounded border border-yellow-100 bg-yellow-50 p-3 text-sm">
                    <p>
                      <code>transform</code>
                      オプションを使用すると、URLとの間でデータを
                      シリアライズ/デシリアライズする方法をカスタマイズできます。
                      これにより、URLサイズの削減や暗号化などが可能になります。
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded bg-gray-50 p-4">
                      <h3 className="mb-2 font-medium">オリジナルデータ</h3>
                      <pre className="overflow-x-auto rounded border bg-white p-2 text-xs">
                        {JSON.stringify(product, null, 2)}
                      </pre>
                    </div>

                    <div className="rounded bg-gray-50 p-4">
                      <h3 className="mb-2 font-medium">圧縮・変換後</h3>
                      <pre className="overflow-x-auto rounded border bg-white p-2 text-xs">
                        {JSON.stringify(
                          {
                            i: product.id,
                            n: product.name,
                            p: product.price,
                            d: product.description,
                            o: product.options,
                          },
                          null,
                          2,
                        )}
                      </pre>
                    </div>
                  </div>

                  <div className="mt-4 rounded bg-gray-50 p-3 text-sm">
                    <h3 className="mb-1 font-medium">圧縮によるURLサイズ削減効果:</h3>
                    <p>このデモでは、長いキー名を短い名前に置き換える単純な圧縮を行っています。</p>
                    <ul className="mt-2 list-disc pl-5 text-xs">
                      <li>&quot;id&quot; → &quot;i&quot; (1バイト節約)</li>
                      <li>&quot;name&quot; → &quot;n&quot; (3バイト節約)</li>
                      <li>&quot;price&quot; → &quot;p&quot; (4バイト節約)</li>
                      <li>&quot;description&quot; → &quot;d&quot; (10バイト節約)</li>
                      <li>&quot;options&quot; → &quot;o&quot; (6バイト節約)</li>
                    </ul>
                    <p className="mt-2">
                      合計で約24バイト削減。複雑なオブジェクトや長い配列では、 より大幅な削減が可能です。
                    </p>
                  </div>
                </div>
              )}

              {/* コード例サブタブ */}
              {activeFeatureTab === "code" && (
                <div>
                  <div className="mb-4">
                    <div className="flex space-x-2 border-b">
                      <button
                        onClick={() => setActiveCodeTab("usage")}
                        className={`px-3 py-2 text-xs ${
                          activeCodeTab === "usage" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500"
                        }`}
                      >
                        基本的な使い方
                      </button>
                      <button
                        onClick={() => setActiveCodeTab("enhanced")}
                        className={`px-3 py-2 text-xs ${
                          activeCodeTab === "enhanced" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500"
                        }`}
                      >
                        拡張メソッド
                      </button>
                      <button
                        onClick={() => setActiveCodeTab("advanced")}
                        className={`px-3 py-2 text-xs ${
                          activeCodeTab === "advanced" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500"
                        }`}
                      >
                        拡張API
                      </button>
                    </div>
                  </div>

                  <div className="overflow-auto rounded-lg bg-gray-800 p-4 text-white">
                    <pre className="text-xs">
                      <code>{codeExamples[activeCodeTab]}</code>
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ナビゲーションリンク */}
      <div className="flex justify-between">
        <Link href="/demo" className="rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-600">
          デモ一覧に戻る
        </Link>
        <Link href="/demo/url/simple" className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600">
          シンプルデモへ
        </Link>
      </div>
    </div>
  )
}
