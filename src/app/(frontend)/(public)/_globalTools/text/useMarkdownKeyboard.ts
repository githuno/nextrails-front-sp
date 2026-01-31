/**
 * Markdown Keyboard Handler Hook
 * Provides GitHub-like editing experience with list/checkbox auto-continuation
 */

import { useCallback } from "react"

// Regex patterns for list detection
const ORDERED_LIST_REGEX = /^(\s*)(\d+)\.\s/
const UNORDERED_LIST_REGEX = /^(\s*)([-*])\s/
const CHECKBOX_REGEX = /^(\s*)([-*])\s\[([xX\s])\]\s/
const EMPTY_LIST_ITEM_REGEX = /^(\s*)([-*]|\d+\.)\s(\[[ xX]\]\s)?$/

interface UseMarkdownKeyboardOptions {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  value: string
  onChange: (newValue: string) => void
}

interface LineInfo {
  line: string
  lineStart: number
  lineEnd: number
}

function getCurrentLine(text: string, cursorPos: number): LineInfo {
  const beforeCursor = text.substring(0, cursorPos)
  const afterCursor = text.substring(cursorPos)

  const lineStart = beforeCursor.lastIndexOf("\n") + 1
  const lineEndOffset = afterCursor.indexOf("\n")
  const lineEnd = lineEndOffset === -1 ? text.length : cursorPos + lineEndOffset

  return {
    line: text.substring(lineStart, lineEnd),
    lineStart,
    lineEnd,
  }
}

function getNextListPrefix(line: string): string | null {
  // Check checkbox first (more specific)
  const checkboxMatch = line.match(CHECKBOX_REGEX)
  if (checkboxMatch) {
    const [, indent, bullet] = checkboxMatch
    return `${indent}${bullet} [ ] `
  }

  // Check ordered list
  const orderedMatch = line.match(ORDERED_LIST_REGEX)
  if (orderedMatch) {
    const [, indent, num] = orderedMatch
    return `${indent}${parseInt(num) + 1}. `
  }

  // Check unordered list
  const unorderedMatch = line.match(UNORDERED_LIST_REGEX)
  if (unorderedMatch) {
    const [, indent, bullet] = unorderedMatch
    return `${indent}${bullet} `
  }

  return null
}

function handleEnterKey(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  onChange: (newValue: string) => void,
  textarea: HTMLTextAreaElement,
): boolean {
  // Only handle if no text is selected
  if (selectionStart !== selectionEnd) return false

  const { line, lineStart, lineEnd } = getCurrentLine(text, selectionStart)

  // Check if cursor is at end of line
  const cursorAtLineEnd = selectionStart === lineEnd
  if (!cursorAtLineEnd) return false

  // Check for empty list item - should remove prefix
  if (EMPTY_LIST_ITEM_REGEX.test(line)) {
    const newText = text.substring(0, lineStart) + text.substring(lineEnd)
    onChange(newText)
    requestAnimationFrame(() => {
      textarea.setSelectionRange(lineStart, lineStart)
    })
    return true
  }

  // Get next list prefix
  const nextPrefix = getNextListPrefix(line)
  if (nextPrefix) {
    const newText = text.substring(0, selectionStart) + "\n" + nextPrefix + text.substring(selectionStart)
    const newCursorPos = selectionStart + 1 + nextPrefix.length
    onChange(newText)
    requestAnimationFrame(() => {
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    })
    return true
  }

  return false
}

function handleIndent(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  onChange: (newValue: string) => void,
  textarea: HTMLTextAreaElement,
): void {
  const INDENT = "  " // 2 spaces

  const beforeStart = text.substring(0, selectionStart)
  const afterEnd = text.substring(selectionEnd)
  const selectedText = text.substring(selectionStart, selectionEnd)

  const firstLineStart = beforeStart.lastIndexOf("\n") + 1

  if (!selectedText.includes("\n")) {
    // Single line - add indent at line start
    const newText = text.substring(0, firstLineStart) + INDENT + text.substring(firstLineStart)
    onChange(newText)
    requestAnimationFrame(() => {
      textarea.setSelectionRange(selectionStart + INDENT.length, selectionEnd + INDENT.length)
    })
  } else {
    // Multi-line - indent each line
    const textToIndent = text.substring(firstLineStart, selectionEnd)
    const indentedText = textToIndent
      .split("\n")
      .map((line) => INDENT + line)
      .join("\n")
    const newText = text.substring(0, firstLineStart) + indentedText + afterEnd
    const lineCount = textToIndent.split("\n").length
    onChange(newText)
    requestAnimationFrame(() => {
      textarea.setSelectionRange(selectionStart + INDENT.length, selectionEnd + INDENT.length * lineCount)
    })
  }
}

function handleOutdent(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  onChange: (newValue: string) => void,
  textarea: HTMLTextAreaElement,
): void {
  const INDENT = "  " // 2 spaces

  const beforeStart = text.substring(0, selectionStart)
  const afterEnd = text.substring(selectionEnd)
  const selectedText = text.substring(selectionStart, selectionEnd)

  const firstLineStart = beforeStart.lastIndexOf("\n") + 1

  if (!selectedText.includes("\n")) {
    // Single line
    const lineContent = text.substring(firstLineStart)
    if (lineContent.startsWith(INDENT)) {
      const newText = text.substring(0, firstLineStart) + lineContent.substring(INDENT.length)
      onChange(newText)
      requestAnimationFrame(() => {
        textarea.setSelectionRange(
          Math.max(firstLineStart, selectionStart - INDENT.length),
          Math.max(firstLineStart, selectionEnd - INDENT.length),
        )
      })
    }
  } else {
    // Multi-line
    const textToOutdent = text.substring(firstLineStart, selectionEnd)
    let removedCount = 0
    const outdentedText = textToOutdent
      .split("\n")
      .map((line) => {
        if (line.startsWith(INDENT)) {
          removedCount += INDENT.length
          return line.substring(INDENT.length)
        }
        return line
      })
      .join("\n")
    const newText = text.substring(0, firstLineStart) + outdentedText + afterEnd
    onChange(newText)
    requestAnimationFrame(() => {
      const firstLineRemoved = text.substring(firstLineStart).startsWith(INDENT) ? INDENT.length : 0
      textarea.setSelectionRange(
        Math.max(firstLineStart, selectionStart - firstLineRemoved),
        selectionEnd - removedCount,
      )
    })
  }
}

export function useMarkdownKeyboard({ textareaRef, value, onChange }: UseMarkdownKeyboardOptions) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const textarea = textareaRef.current
      if (!textarea) return

      const { selectionStart, selectionEnd } = textarea

      // Handle "[" key for checkbox auto-completion
      if (e.key === "[" && selectionStart === selectionEnd) {
        // Check if we should auto-complete after the "[" is inserted
        const { line, lineStart } = getCurrentLine(value, selectionStart)
        const lineUpToCursor = line.substring(0, selectionStart - lineStart)

        // Check if line matches "- " or "* " pattern (will become "- [" after keystroke)
        if (/^(\s*)([-*])\s$/.test(lineUpToCursor)) {
          e.preventDefault()
          const newText = value.substring(0, selectionStart) + "[ ] " + value.substring(selectionStart)
          const newCursorPos = selectionStart + 4 // After "[ ] "
          onChange(newText)
          requestAnimationFrame(() => {
            textarea.setSelectionRange(newCursorPos, newCursorPos)
          })
          return
        }
      }

      // Handle Enter key
      if (e.key === "Enter") {
        const handled = handleEnterKey(value, selectionStart, selectionEnd, onChange, textarea)
        if (handled) {
          e.preventDefault()
        }
        return
      }

      // Handle Tab key
      if (e.key === "Tab") {
        e.preventDefault()
        if (e.shiftKey) {
          handleOutdent(value, selectionStart, selectionEnd, onChange, textarea)
        } else {
          handleIndent(value, selectionStart, selectionEnd, onChange, textarea)
        }
      }
    },
    [textareaRef, value, onChange],
  )

  return { handleKeyDown }
}

/**
 * Toggle checkbox state in markdown text
 * @param text - Full markdown text
 * @param lineIndex - Line number (0-indexed)
 * @param checked - New checked state
 * @returns Updated text
 */
export function toggleCheckboxAtLine(text: string, lineIndex: number, checked: boolean): string {
  const lines = text.split("\n")
  if (lineIndex < 0 || lineIndex >= lines.length) return text

  const line = lines[lineIndex]
  if (checked) {
    lines[lineIndex] = line.replace(/\[[ ]\]/, "[x]")
  } else {
    lines[lineIndex] = line.replace(/\[[xX]\]/, "[ ]")
  }

  return lines.join("\n")
}

/**
 * Build a map of checkbox index to line index
 * @param text - Full markdown text
 * @returns Map<checkboxIndex, lineIndex>
 */
export function buildCheckboxLineMap(text: string): Map<number, number> {
  const lineMap = new Map<number, number>()
  const lines = text.split("\n")
  let cbIdx = 0

  lines.forEach((line, lineIdx) => {
    if (CHECKBOX_REGEX.test(line)) {
      lineMap.set(cbIdx, lineIdx)
      cbIdx++
    }
  })

  return lineMap
}
