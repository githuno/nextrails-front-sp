/**
 * HTML文字列を安全にサニタイズするユーティリティ
 */
export function sanitizeHtml(html: string): string {
  if (typeof window === "undefined") return html

  // シンプルなサニタイズ実装（タグを除去してテキストのみを抽出）
  // より高度なサニタイズが必要な場合は DOMPurify などのライブラリを検討してください
  const doc = new DOMParser().parseFromString(html, "text/html")
  return doc.body.textContent || ""
}
