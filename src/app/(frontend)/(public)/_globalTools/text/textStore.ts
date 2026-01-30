/**
 * Text Editor State Management
 * Follows Camera/Microphone useExternalStore pattern
 */

import { useExternalStore } from "../_hooks/atoms/useExternalStore"
import { type SavedToolFileResult } from "../_hooks/useToolActionStore"
import { createTextClient } from "./textClient"

/**
 * Text Editor State
 */
export interface TextState {
  isAvailable: boolean | null // null: initializing, true/false: availability
  isEditing: boolean
  isPreviewEnabled: boolean
  currentText: string
  editingIdbKey: string | null

  // Metadata
  title: string
  tags: string[]

  // Metrics
  wordCount: number
  charCount: number

  // Auto-save tracking
  lastSavedContent: string // Content signature of last saved state

  // Preview cache for gallery
  previewCache: Record<string, string>

  // Error handling
  error: Error | null
}

/**
 * External Actions (database operations)
 */
export interface TextExternalActions {
  saveFile?: (
    markdown: string,
    metadata: { title: string; tags: string[] },
    options?: { fileName?: string; idbKey?: string; category?: string },
  ) => Promise<SavedToolFileResult>
  getFileWithUrl?: (idbKey: string) => Promise<string | null>
  deleteFile?: (idbKey: string, dbId: string) => Promise<void>
}

/**
 * Internal State (includes private fields)
 */
interface TextStateInternal extends TextState {
  externalActions: TextExternalActions
  autoSaveTimer: NodeJS.Timeout | null
  callbacks: {
    onSave?: (result: SavedToolFileResult) => void
    onLoad?: (content: string, metadata: { title: string; tags: string[] }) => void
    onError?: (error: Error) => void
  }
}

/**
 * Singleton state
 */
const textClient = createTextClient()
const state: TextStateInternal = {
  isAvailable: true, // Optimistic
  isEditing: false,
  isPreviewEnabled: false, // Preview is opt-in
  currentText: "",
  editingIdbKey: null,
  title: "Untitled",
  tags: [],
  wordCount: 0,
  charCount: 0,
  lastSavedContent: "",
  previewCache: {},
  error: null,
  externalActions: {},
  autoSaveTimer: null,
  callbacks: {},
}

const listeners: Set<() => void> = new Set()

// Server snapshot (static - server can't edit text)
const serverSnapshot: TextState = {
  isAvailable: false,
  isEditing: false,
  isPreviewEnabled: false,
  currentText: "",
  editingIdbKey: null,
  title: "",
  tags: [],
  wordCount: 0,
  charCount: 0,
  lastSavedContent: "",
  previewCache: {},
  error: null,
}

// Snapshot cache
let snapshotCache: TextState = serverSnapshot
let snapshotVersion = 0
let currentVersion = 0

const notify = () => {
  currentVersion++
  listeners.forEach((l) => l())
}

const getSnapshot = (): TextState => {
  if (snapshotVersion !== currentVersion) {
    snapshotCache = {
      isAvailable: state.isAvailable,
      isEditing: state.isEditing,
      isPreviewEnabled: state.isPreviewEnabled,
      currentText: state.currentText,
      editingIdbKey: state.editingIdbKey,
      title: state.title,
      tags: state.tags,
      wordCount: state.wordCount,
      charCount: state.charCount,
      lastSavedContent: state.lastSavedContent,
      previewCache: state.previewCache,
      error: state.error,
    }
    snapshotVersion = currentVersion
  }
  return snapshotCache
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Generate content signature for change tracking
 */
const generateContentSignature = (): string => {
  return `${state.title}|${state.currentText}|${state.tags.join(",")}`
}

/**
 * Check if there are unsaved changes
 */
const hasUnsavedChanges = (): boolean => {
  if (!state.editingIdbKey) return false
  const currentSignature = generateContentSignature()
  return currentSignature !== state.lastSavedContent
}

const triggerAutoSave = () => {
  if (state.autoSaveTimer) {
    clearTimeout(state.autoSaveTimer)
  }

  // Only auto-save if:
  // 1. Editing an existing file (editingIdbKey is set)
  // 2. There's actual content
  // 3. There are unsaved changes
  if (!state.editingIdbKey) return
  if (!state.currentText && !state.title) return
  if (!hasUnsavedChanges()) return

  state.autoSaveTimer = setTimeout(async () => {
    try {
      if (hasUnsavedChanges()) {
        await textActions.saveText()
      }
    } catch (err) {
      console.error("Auto-save failed:", err)
    } finally {
      state.autoSaveTimer = null
    }
  }, 2000)
}

/**
 * Export actions
 */
export const textActions = {
  // Setup/Cleanup
  setup: async () => {
    try {
      state.isAvailable = true
      state.isEditing = true // Start in editing mode for immediate input
      notify()
    } catch (err) {
      state.error = err instanceof Error ? err : new Error("Setup failed")
      state.isAvailable = false
      notify()
    }
  },

  // Change tracking
  hasUnsavedChanges,

  cleanup: () => {
    if (state.autoSaveTimer) {
      clearTimeout(state.autoSaveTimer)
      state.autoSaveTimer = null
    }
    state.currentText = ""
    state.title = "Untitled"
    state.tags = []
    state.editingIdbKey = null
    state.wordCount = 0
    state.charCount = 0
    state.lastSavedContent = ""
    state.isEditing = false
    state.error = null
    notify()
  },

  /**
   * テスト用: 全状態を初期値にリセット
   */
  _internal_reset: () => {
    if (state.autoSaveTimer) {
      clearTimeout(state.autoSaveTimer)
      state.autoSaveTimer = null
    }
    state.isAvailable = true
    state.isEditing = false
    state.isPreviewEnabled = false
    state.currentText = ""
    state.editingIdbKey = null
    state.title = "Untitled"
    state.tags = []
    state.wordCount = 0
    state.charCount = 0
    state.lastSavedContent = ""
    state.previewCache = {}
    state.error = null
    state.externalActions = {}
    state.callbacks = {}
    // バージョンもリセットして確実に新しいスナップショットを生成
    currentVersion++
    snapshotVersion = -1
    notify()
  },

  // Editor state mutations
  setText: (text: string) => {
    state.currentText = text
    state.wordCount = textClient.countWords(text)
    state.charCount = text.length
    notify()
    triggerAutoSave()
  },

  setTitle: (title: string) => {
    state.title = title
    notify()
    triggerAutoSave()
  },

  setTags: (tags: string[]) => {
    state.tags = tags
    notify()
    triggerAutoSave()
  },

  setEditing: (isEditing: boolean) => {
    state.isEditing = isEditing
    notify()
  },

  setPreviewEnabled: (enabled: boolean) => {
    state.isPreviewEnabled = enabled
    notify()
  },

  setError: (error: Error | null) => {
    state.error = error
    notify()
  },

  // File operations
  newText: () => {
    state.currentText = ""
    state.title = "Untitled"
    state.tags = []
    state.editingIdbKey = null
    state.wordCount = 0
    state.charCount = 0
    state.lastSavedContent = ""
    state.isEditing = true
    state.error = null
    notify()
  },

  loadText: async (idbKey: string) => {
    try {
      const actions = state.externalActions
      if (!actions.getFileWithUrl) throw new Error("getFileWithUrl not implemented")
      const url = await actions.getFileWithUrl(idbKey)
      if (!url) throw new Error("File not found")
      const response = await fetch(url)
      const markdown = await response.text()
      const parsed = textClient.parseMarkdown(markdown)
      state.currentText = parsed.body
      state.title = parsed.metadata.title
      state.tags = parsed.metadata.tags
      state.editingIdbKey = idbKey
      state.wordCount = textClient.countWords(parsed.body)
      state.charCount = parsed.body.length
      state.isEditing = true
      state.error = null
      // Update lastSavedContent signature after loading
      state.lastSavedContent = generateContentSignature()
      state.callbacks.onLoad?.(parsed.body, {
        title: parsed.metadata.title,
        tags: parsed.metadata.tags,
      })
      notify()
    } catch (err) {
      state.error = err instanceof Error ? err : new Error("Failed to load text")
      state.callbacks.onError?.(state.error)
      notify()
    }
  },

  saveText: async () => {
    try {
      const actions = state.externalActions
      if (!actions.saveFile) throw new Error("saveFile not implemented")
      const markdown = textClient.serializeMarkdown({
        title: state.title,
        tags: state.tags,
        body: state.currentText,
        wordCount: state.wordCount,
      })
      // upsert: idbKey があれば UPDATE、なければ INSERT
      const result = await actions.saveFile(
        markdown,
        { title: state.title, tags: state.tags },
        {
          fileName: `${state.title.replace(/\s+/g, "_")}.md`,
          idbKey: state.editingIdbKey || undefined,
          category: "text",
        },
      )
      state.editingIdbKey = result.idbKey
      state.isEditing = false
      state.error = null
      // Update lastSavedContent signature after successful save
      state.lastSavedContent = generateContentSignature()
      state.callbacks.onSave?.(result)
      notify()
      return result
    } catch (err) {
      state.error = err instanceof Error ? err : new Error("Failed to save")
      state.callbacks.onError?.(state.error)
      notify()
      throw state.error
    }
  },

  // Preview cache management
  loadPreview: async (idbKey: string) => {
    // Skip if already cached
    if (state.previewCache[idbKey]) return
    try {
      const actions = state.externalActions
      if (!actions.getFileWithUrl) return
      const url = await actions.getFileWithUrl(idbKey)
      if (!url) return
      const response = await fetch(url)
      const markdown = await response.text()
      const preview = textClient.extractPreview(markdown, 60)
      state.previewCache = { ...state.previewCache, [idbKey]: preview }
      notify()
    } catch (err) {
      console.error(`Failed to load preview for ${idbKey}:`, err)
    }
  },

  setPreviewCache: (idbKey: string, preview: string) => {
    state.previewCache = { ...state.previewCache, [idbKey]: preview }
    notify()
  },

  getPreview: (idbKey: string): string | undefined => {
    return state.previewCache[idbKey]
  },

  // External action registration
  setExternalActions: (actions: TextExternalActions) => {
    state.externalActions = actions
  },

  setCallbacks: (callbacks: typeof state.callbacks) => {
    state.callbacks = callbacks
  },
}

/**
 * React Hook
 */
export const useTextState = () => {
  return useExternalStore({
    subscribe,
    getSnapshot,
    getServerSnapshot: () => serverSnapshot,
  })
}
