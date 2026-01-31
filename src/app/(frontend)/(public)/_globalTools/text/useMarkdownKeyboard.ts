/**
 * Markdown Keyboard Handler Hook
 * Provides GitHub-like editing experience with list/checkbox auto-continuation
 */

import React, { useCallback } from "react"

// Regex patterns for list detection - Standard Markdown only supports numeric ordered lists
const ORDERED_LIST_REGEX = /^(\s*)(\d+)(\.|\))\s/
const UNORDERED_LIST_REGEX = /^(\s*)([-*])\s/
const CHECKBOX_REGEX = /^(\s*)([-*])\s\[([xX\s])\]\s/
const EMPTY_LIST_ITEM_REGEX = /^(\s*)([-*]|\d+\.)\s(\[[ xX]\]\s)?$/

interface UseMarkdownKeyboardOptions {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
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

  // Check ordered list - Always use numbers for standard MD compatibility
  const orderedMatch = line.match(ORDERED_LIST_REGEX)
  if (orderedMatch) {
    const [, indent, num, delimiter] = orderedMatch
    return `${indent}${parseInt(num) + 1}${delimiter} `
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
  const INDENT = "    " // 4 spaces for standard MD compatibility

  const beforeStart = text.substring(0, selectionStart)
  const afterEnd = text.substring(selectionEnd)
  const selectedText = text.substring(selectionStart, selectionEnd)

  const firstLineStart = beforeStart.lastIndexOf("\n") + 1

  if (!selectedText.includes("\n")) {
    // Single line
    const lineContent = text.substring(firstLineStart)
    let newContent = INDENT + lineContent
    const cursorOffset = INDENT.length
    // Standard Markdown compatibility: always use numbers for ordered lists.
    // When indenting, we reset to "1." to ensure it's recognized as a new nested list.
    const match = lineContent.match(ORDERED_LIST_REGEX)
    if (match) {
      const [, indent, , delimiter] = match
      newContent = indent + INDENT + "1" + delimiter + " " + lineContent.substring(match[0].length)
    }
    const newText = text.substring(0, firstLineStart) + newContent
    onChange(newText)
    requestAnimationFrame(() => {
      textarea.setSelectionRange(selectionStart + cursorOffset, selectionEnd + cursorOffset)
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
  const INDENT = "    " // 4 spaces
  const beforeStart = text.substring(0, selectionStart)
  const afterEnd = text.substring(selectionEnd)
  const selectedText = text.substring(selectionStart, selectionEnd)
  const firstLineStart = beforeStart.lastIndexOf("\n") + 1
  if (!selectedText.includes("\n")) {
    // Single line
    const lineContent = text.substring(firstLineStart)
    if (lineContent.startsWith(INDENT)) {
      const newContent = lineContent.substring(INDENT.length)
      const newText = text.substring(0, firstLineStart) + newContent
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

function handleCheckboxAutocomplete(
  text: string,
  selectionStart: number,
  textarea: HTMLTextAreaElement,
  onChange: (newValue: string) => void,
): boolean {
  const { line, lineStart } = getCurrentLine(text, selectionStart)
  const lineUpToCursor = line.substring(0, selectionStart - lineStart)
  // Case 1: Before input (cursor is at "- ")
  // Match "- " or "* " (allowing optional indentation)
  const matchBefore = lineUpToCursor.match(/^(\s*)([-*])\s+$/)
  if (matchBefore) {
    const prefix = matchBefore[0]
    const newText = text.substring(0, lineStart) + prefix + "[ ] " + text.substring(selectionStart)
    const newCursorPos = lineStart + prefix.length + 4
    onChange(newText)
    setTimeout(() => {
      if (textarea) {
        textarea.setSelectionRange(newCursorPos, newCursorPos)
        textarea.focus()
      }
    }, 10)
    return true
  }
  // Case 2: After input (cursor is at "- [" or "* [")
  // Sometimes beforeinput preventDefault doesn't work, so we check if we just typed the bracket
  const matchAfter = lineUpToCursor.match(/^(\s*)([-*])\s+[[［]$/)
  if (matchAfter) {
    const prefix = matchAfter[0].slice(0, -1) // remove the bracket
    const newText = text.substring(0, lineStart) + prefix + "[ ] " + text.substring(selectionStart)
    const newCursorPos = lineStart + prefix.length + 4
    onChange(newText)
    setTimeout(() => {
      if (textarea) {
        textarea.setSelectionRange(newCursorPos, newCursorPos)
        textarea.focus()
      }
    }, 10)
    return true
  }
  return false
}

export function useMarkdownKeyboard({ textareaRef, onChange }: UseMarkdownKeyboardOptions) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const textarea = textareaRef.current
      if (!textarea) return
      const { selectionStart, selectionEnd } = textarea
      const currentText = textarea.value
      // Handle "[" key for checkbox auto-completion
      if (e.key === "[" && selectionStart === selectionEnd) {
        const handled = handleCheckboxAutocomplete(currentText, selectionStart, textarea, onChange)
        if (handled) {
          e.preventDefault()
          return
        }
      }

      // Handle Enter key
      if (e.key === "Enter" || e.keyCode === 13) {
        const handled = handleEnterKey(currentText, selectionStart, selectionEnd, onChange, textarea)
        if (handled) {
          e.preventDefault()
        }
        return
      }
      // Handle Tab key
      if (e.key === "Tab") {
        e.preventDefault()
        if (e.shiftKey) {
          handleOutdent(currentText, selectionStart, selectionEnd, onChange, textarea)
        } else {
          handleIndent(currentText, selectionStart, selectionEnd, onChange, textarea)
        }
      }
    },
    [textareaRef, onChange],
  )

  const handleBeforeInput = useCallback(
    (e: React.FormEvent<HTMLTextAreaElement>) => {
      const textarea = textareaRef.current
      if (!textarea) return
      const { selectionStart, selectionEnd } = textarea
      const currentText = textarea.value
      const nativeEvent = e.nativeEvent as InputEvent
      // Handle Enter on mobile
      if (
        nativeEvent.inputType === "insertLineBreak" ||
        (nativeEvent.inputType === "insertText" && nativeEvent.data === "\n")
      ) {
        const handled = handleEnterKey(currentText, selectionStart, selectionEnd, onChange, textarea)
        if (handled) {
          e.preventDefault()
        }
        return
      }
      // Handle "[" on mobile
      // data might be "[" (standard) or "［" (full-width) or even part of composition
      const isBracket = nativeEvent.data === "[" || nativeEvent.data === "［"
      if (isBracket && selectionStart === selectionEnd) {
        const handled = handleCheckboxAutocomplete(currentText, selectionStart, textarea, onChange)
        if (handled) {
          e.preventDefault()
        }
      }
    },
    [textareaRef, onChange],
  )

  const handleInput = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const { selectionStart } = textarea
    const currentText = textarea.value
    // If the last character entered was "[" and it wasn't handled by beforeinput
    // (meaning preventDefault failed or wasn't called), try to fix it up now.
    const { line, lineStart } = getCurrentLine(currentText, selectionStart)
    const lineUpToCursor = line.substring(0, selectionStart - lineStart)
    if (/^(\s*)([-*])\s+[[［]$/.test(lineUpToCursor)) {
      handleCheckboxAutocomplete(currentText, selectionStart, textarea, onChange)
    }
  }, [textareaRef, onChange])

  return { handleKeyDown, handleBeforeInput, handleInput }
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
