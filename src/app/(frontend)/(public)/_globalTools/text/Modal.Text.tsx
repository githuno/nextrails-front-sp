/**
 * Text Editor Modal Component
 * Provides text input, metadata form, and showcase gallery
 * Refined with "Wabi-Sabi Editorial" aesthetic (2026)
 */

"use client"

import React, { useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Carousel } from "../_components/atoms/Carousel"
import { Modal } from "../_components/atoms/Modal"
import { Tool } from "../_components/GlobalTool"
import { CheckIcon, DocumentIcon, LoadingSpinner, PenIcon, TrashIcon } from "../_components/Icons"
import { useToolActionStore, type ToolFile } from "../_hooks/useToolActionStore"
import { createTextClient } from "./textClient"
import { textActions, useTextState } from "./textStore"

const SABI_GOLD = "#9f890e"

const hexToRgb = (hex: string): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : "159, 137, 14"
}

interface TextModalProps {
  isOpen: boolean
  onClose: () => void
  standalone?: boolean
  showShowcase?: boolean
  onCapture?: (
    result:
      | { type: "text"; content: string; metadata: { title: string; tags: string[] } }
      | { type: "file"; files: File[] },
  ) => void
}

const textClient = createTextClient()

const TextModal: React.FC<TextModalProps> = ({ isOpen, onClose, standalone, showShowcase, onCapture }) => {
  const {
    textFiles: files,
    deleteFiles,
    saveFile,
    currentFileSet,
    getFileWithUrl,
    fileSetInfo,
    switchFileSet,
  } = useToolActionStore()

  const textState = useTextState()
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [tagInput, setTagInput] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isLibraryOpen, setIsLibraryOpen] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // FileSet切り替え時の選択リセット
  const [prevFileSet, setPrevFileSet] = useState(currentFileSet)
  if (currentFileSet !== prevFileSet) {
    setPrevFileSet(currentFileSet)
    setSelectedKeys(new Set())
  }

  // Register external actions (once on mount)
  useEffect(() => {
    if (!isOpen || !saveFile) return
    textActions.setExternalActions({
      saveFile: (markdown, _metadata, options) => {
        const blob = new Blob([markdown], { type: "text/markdown" })
        return saveFile(blob, {
          fileName: options?.fileName,
          idbKey: options?.idbKey,
          category: options?.category || "text",
        })
      },
      getFileWithUrl,
      deleteFile: (idbKey, dbId) => deleteFiles([{ idbKey, id: dbId }]),
    })
  }, [isOpen, saveFile, getFileWithUrl, deleteFiles])

  // Standalone mode callback registration
  useEffect(() => {
    if (!isOpen || !standalone || !onCapture) return
    textActions.setCallbacks({
      onSave: (result) => {
        // Update preview cache
        textActions.setPreviewCache(result.idbKey, textClient.extractPreview(textState.currentText, 60))
        onCapture({
          type: "text",
          content: textState.currentText,
          metadata: { title: textState.title, tags: textState.tags },
        })
        onClose()
      },
    })
    return () => textActions.setCallbacks({})
  }, [isOpen, standalone, onCapture, onClose, textState.currentText, textState.title, textState.tags])

  // Setup (only when opening)
  useEffect(() => {
    if (isOpen) {
      textActions.setup()
    }
  }, [isOpen])

  // Load previews for gallery files (delegated to textStore)
  useEffect(() => {
    if (!isOpen) return
    files.forEach((file: ToolFile) => {
      textActions.loadPreview(file.idbKey)
    })
  }, [isOpen, files])

  const handleNew = () => {
    textActions.newText()
    setTagInput("")
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await textActions.saveText()
    } catch (err) {
      console.error("Save failed:", err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleMainAction = async () => {
    if (textState.editingIdbKey) {
      // 保存済み → 新規作成
      handleNew()
    } else {
      // 未保存 → 保存
      await handleSave()
    }
  }

  const handleLoadFile = async (file: ToolFile) => {
    await textActions.loadText(file.idbKey)
  }

  const handleAddTag = (tag: string) => {
    if (tag.trim() && !textState.tags.includes(tag.trim())) {
      textActions.setTags([...textState.tags, tag.trim()])
      setTagInput("")
    }
  }

  const handleRemoveTag = (index: number) => {
    textActions.setTags(textState.tags.filter((_, i: number) => i !== index))
  }

  const toggleSelection = (idbKey: string) => {
    const next = new Set(selectedKeys)
    if (next.has(idbKey)) next.delete(idbKey)
    else next.add(idbKey)
    setSelectedKeys(next)
  }

  const handleBulkDelete = async () => {
    if (selectedKeys.size === 0) return
    if (confirm(`Delete ${selectedKeys.size} selected notes?`)) {
      const fileMap = new Map(files.map((f) => [f.idbKey, f]))
      const itemsToDelete = Array.from(selectedKeys)
        .map((idbKey) => {
          const file = fileMap.get(idbKey)
          return file ? { idbKey: file.idbKey, id: file.id } : null
        })
        .filter((item): item is { idbKey: string; id: string } => item !== null)
      await deleteFiles(itemsToDelete)
      setSelectedKeys(new Set())
    }
  }

  const handleDecision = async () => {
    if (selectedKeys.size === 0 || !onCapture) return
    if (confirm(`Select ${selectedKeys.size} notes and set to input?`)) {
      const fileMap = new Map(files.map((f) => [f.idbKey, f]))
      const selectedIdbKeys = Array.from(selectedKeys)
      const { idbStore } = await import("../_hooks/db/useIdbStore")
      const store = idbStore()
      const results = await Promise.all(
        selectedIdbKeys.map(async (key) => {
          const fileInfo = fileMap.get(key)
          if (!fileInfo) return null
          const blob = await store.get(key)
          if (!blob) return null
          const text = await blob.text()
          return { text, info: fileInfo, blob }
        }),
      )
      const validResults = results.filter((r): r is { text: string; info: (typeof files)[0]; blob: Blob } => r !== null)
      if (validResults.length === 0) return
      if (validResults.length === 1) {
        const { text } = validResults[0]
        const parsed = textClient.parseMarkdown(text)
        onCapture({
          type: "text",
          content: parsed.body,
          metadata: { title: parsed.metadata.title, tags: parsed.metadata.tags },
        })
      } else {
        const filesArray = validResults.map((r) => new File([r.blob], r.info.fileName, { type: r.info.mimeType }))
        onCapture({ type: "file", files: filesArray })
      }
      onClose()
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="h-full w-full p-0">
      <style>{`
        .wabi-grain {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 50;
          opacity: 0.03;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
        }
        .editorial-title {
          font-family: serif;
          letter-spacing: -0.05em;
          line-height: 0.9;
        }
        .markdown-hint {
          font-family: monospace;
          font-size: 0.65rem;
          color: rgba(159, 137, 14, 0.4);
        }
      `}</style>

      <div className="wabi-grain" />

      <Tool className="bg-zinc-950" enableBackgroundTap onBackgroundTap={() => console.log("expand")}>
        {/* Main Editor Area */}
        <Tool.Main className="relative overflow-hidden px-8 sm:px-12">
          <div className="mx-auto flex h-full w-full max-w-4xl flex-col space-y-4">
            {/* Header: Title & Meta */}
            <div className="flex flex-col space-y-4">
              <div className="group relative">
                <input
                  type="text"
                  value={textState.title}
                  onChange={(e) => textActions.setTitle(e.target.value)}
                  placeholder="UNTITLED THOUGHT"
                  className="editorial-title w-full bg-transparent pt-4 text-2xl font-black text-zinc-100 transition-all placeholder:text-zinc-900 focus:outline-none sm:text-3xl"
                  onClick={(e) => e.stopPropagation()}
                />
                <div
                  className="absolute bottom-0 left-0 h-0.5 w-0 bg-[rgba(var(--sabi-gold),0.6)] transition-all duration-700 group-focus-within:w-full"
                  style={{ "--sabi-gold": hexToRgb(SABI_GOLD) } as React.CSSProperties}
                />
              </div>
            </div>

            {/* Markdown Input / Editor */}
            <div className="group relative flex-1">
              <textarea
                ref={textareaRef}
                value={textState.currentText}
                onChange={(e) => textActions.setText(e.target.value)}
                placeholder="--- Begin your narrative here ---"
                className="custom-scrollbar h-full min-h-[45svh] w-full resize-none bg-transparent py-4 font-mono text-base leading-relaxed text-zinc-400 transition-colors placeholder:text-zinc-900 focus:text-zinc-200 focus:outline-none"
                onClick={(e) => e.stopPropagation()}
              />
              {/* Subtle background decoration */}
              <div className="pointer-events-none absolute top-0 right-0 p-4 opacity-5 select-none">
                <PenIcon size="120px" color="#fff" />
              </div>
            </div>

            {/* Tags & Footer */}
            <div className="flex flex-col justify-between gap-4 border-t border-zinc-900 pt-4 pb-2 sm:flex-row sm:items-center">
              <div className="flex flex-wrap items-center gap-3">
                {textState.tags.map((tag: string, i: number) => (
                  <span
                    key={i}
                    className="group flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-[10px] font-bold tracking-widest text-zinc-500 uppercase transition-all hover:border-zinc-700 hover:text-zinc-300"
                  >
                    <span style={{ color: SABI_GOLD }}>#</span>
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(i)}
                      aria-label={`Remove tag ${tag}`}
                      className="ml-1 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleAddTag(tagInput)
                    }
                  }}
                  placeholder="+ APPEND TAG"
                  className="bg-transparent px-2 text-xs font-bold tracking-widest text-zinc-400 uppercase transition-all placeholder:text-zinc-600 focus:text-zinc-400 focus:outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              <div className="flex items-center gap-4 text-xs font-black tracking-widest text-zinc-600 uppercase">
                <span className="flex items-center gap-2" aria-label="Word count">
                  <div className="h-px w-2 bg-zinc-800" />
                  {textState.wordCount} WDS
                </span>
                <span className="flex items-center gap-2" aria-label="Character count">
                  <div className="h-px w-2 bg-zinc-800" />
                  {textState.charCount} CHR
                </span>
              </div>
            </div>
          </div>
        </Tool.Main>

        {/* Controller */}
        <Tool.Controller className="border-none bg-transparent">
          <div className="mx-auto flex max-w-md items-center justify-center gap-16 px-4">
            {/* Main Action: Save or New (The Centerpiece) */}
            <div className="group relative">
              <div className="absolute -inset-4 rounded-full bg-[rgba(var(--sabi-gold),0.15)] opacity-0 blur-2xl transition-opacity duration-1000 group-hover:opacity-100" />
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleMainAction()
                }}
                disabled={isSaving}
                aria-label={textState.editingIdbKey ? "Create new note" : "Save note"}
                className={`relative flex h-12 w-12 items-center justify-center rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-500 active:scale-95 disabled:opacity-50 ${
                  isSaving ? "bg-zinc-800" : "bg-zinc-100 hover:-translate-y-1 hover:bg-white"
                }`}
              >
                {isSaving ? (
                  <LoadingSpinner size="24px" color={SABI_GOLD} />
                ) : textState.editingIdbKey ? (
                  <div className="relative h-8 w-8">
                    <div className="absolute top-1/2 left-1/2 h-px w-6 -translate-x-1/2 -translate-y-1/2 bg-black" />
                    <div className="absolute top-1/2 left-1/2 h-6 w-px -translate-x-1/2 -translate-y-1/2 bg-black" />
                  </div>
                ) : (
                  <CheckIcon size="24px" color="#000" />
                )}
              </button>
            </div>

            {/* Preview Toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                textActions.setPreviewEnabled(!textState.isPreviewEnabled)
              }}
              aria-label="Toggle preview"
              className={`flex h-12 w-12 items-center justify-center rounded-full border transition-all ${
                textState.charCount < 1 ? "cursor-not-allowed opacity-50" : "hover:scale-110 active:scale-95"
              } ${
                textState.isPreviewEnabled
                  ? "border-white bg-zinc-100 text-zinc-950"
                  : "border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-zinc-100"
              }`}
              disabled={textState.charCount < 1}
            >
              <DocumentIcon size="24px" color="currentColor" />
            </button>
          </div>
        </Tool.Controller>

        {/* Showcase: Saved Notes Archive */}
        {(!standalone || showShowcase) && (
          <Tool.Showcase>
            <div className="grid grid-rows-[auto_1fr] gap-2">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-6">
                  {selectedKeys.size > 0 && (
                    <div className="animate-in fade-in slide-in-from-left-4 flex items-center gap-4">
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (standalone) {
                              handleDecision()
                            } else {
                              handleBulkDelete()
                            }
                          }}
                          aria-label={
                            standalone
                              ? `Select ${selectedKeys.size} items`
                              : `Delete ${selectedKeys.size} selected notes`
                          }
                          className={`flex h-7 w-7 items-center justify-center rounded-xl bg-zinc-900 text-zinc-400 ring-1 ring-white/10 transition-all hover:bg-zinc-800 hover:text-white active:scale-90 ${standalone ? "text-green-500" : ""}`}
                        >
                          {standalone ? (
                            <CheckIcon size="14px" color="currentColor" />
                          ) : (
                            <TrashIcon size="14px" color="currentColor" />
                          )}
                        </button>
                        {/* Numeric Badge */}
                        <div
                          style={{ backgroundColor: SABI_GOLD }}
                          className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-black text-white shadow-sm ring-1 ring-zinc-950"
                        >
                          {selectedKeys.size}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedKeys(new Set())
                        }}
                        className="text-[9px] font-black tracking-widest text-zinc-600 uppercase transition-colors hover:text-zinc-400"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                {/* Right Side: FileSet Navigation */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsLibraryOpen(true)
                  }}
                  aria-label="Open FileSet Library"
                  className="group relative -top-2 -right-2 float-right flex flex-col items-end rounded-2xl bg-white/50 shadow-lg transition-all hover:scale-110"
                >
                  <div className="flex items-center gap-1.5">
                    <div className="flex h-6 max-w-64 min-w-12 cursor-pointer items-center justify-center-safe truncate px-2 text-sm font-bold text-zinc-800">
                      {currentFileSet}
                    </div>
                  </div>
                </button>
              </div>

              {files.length > 0 ? (
                <Carousel containerClassName="gap-x-2 h-16">
                  {files.map((file, index) => {
                    const isSelected = !!file.idbKey && selectedKeys.has(file.idbKey)
                    const isCurrent = textState.editingIdbKey === file.idbKey
                    const preview = isCurrent
                      ? textClient.extractPreview(textState.currentText, 60)
                      : textState.previewCache[file.idbKey] || "Loading preview..."
                    const fileNameBase = file.fileName.replace(".md", "")

                    return (
                      <Carousel.Item key={file.idbKey || index} className="group relative">
                        <div
                          role="button"
                          aria-label={`Load note ${fileNameBase}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleLoadFile(file)
                          }}
                          className={`relative flex h-full w-32 flex-col justify-between overflow-hidden border p-2 transition-all duration-700 ${
                            isSelected
                              ? "scale-95 border-zinc-800 bg-zinc-900"
                              : isCurrent
                                ? "border-white bg-zinc-100 shadow-[0_10px_30px_rgba(255,255,255,0.1)]"
                                : "border-zinc-900 bg-zinc-900/40 hover:border-zinc-800 hover:bg-zinc-900/60"
                          }`}
                        >
                          <div className="space-y-2">
                            <h4
                              className={`truncate text-xs font-black tracking-widest uppercase ${isCurrent ? "text-zinc-950" : "text-zinc-400"}`}
                            >
                              {fileNameBase}
                            </h4>
                            <div className={`h-px w-8 ${isCurrent ? "bg-zinc-950" : "bg-zinc-800"}`} />
                            <p
                              className={`line-clamp-2 font-serif text-[10px] leading-relaxed italic ${isCurrent ? "text-zinc-700" : "text-zinc-600"}`}
                            >
                              {preview}
                            </p>
                          </div>
                          <div className={`text-[8px] font-bold ${isCurrent ? "text-zinc-400" : "text-zinc-800"}`}>
                            {new Date(file.createdAt).toLocaleDateString()}
                          </div>
                        </div>

                        {/* Select Toggle */}
                        {file.idbKey && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleSelection(file.idbKey!)
                            }}
                            aria-label={`Select note ${fileNameBase}`}
                            className={`absolute top-1 right-1 z-20 cursor-pointer transition-all duration-500`}
                          >
                            <div
                              style={{
                                backgroundColor: isSelected ? SABI_GOLD : "rgba(255,255,255,0.1)",
                                borderColor: isSelected ? SABI_GOLD : "rgba(0,0,0,0.8)",
                              }}
                              className="flex h-5 w-5 items-center justify-center rounded-full border shadow-2xl transition-all"
                            >
                              <CheckIcon size="12px" color={isSelected ? "#fff" : "transparent"} />
                            </div>
                          </button>
                        )}
                      </Carousel.Item>
                    )
                  })}
                </Carousel>
              ) : (
                <div className="flex h-16 w-full items-center justify-center">
                  <p className="text-[10px] font-black tracking-[0.5em] text-zinc-900 uppercase italic">
                    Empty Fragments
                  </p>
                </div>
              )}
            </div>
          </Tool.Showcase>
        )}
      </Tool>

      {/* Preview Overlay (Wabi-Sabi Editorial Style) */}
      <Modal
        isOpen={textState.isPreviewEnabled && !!textState.currentText}
        onClose={() => textActions.setPreviewEnabled(false)}
        className="h-[90vh] w-[90vw] overflow-hidden border-none bg-zinc-100 p-0 text-zinc-900 shadow-2xl"
      >
        <div className="wabi-grain opacity-10" />
        <div className="custom-scrollbar relative z-10 h-full w-full overflow-y-auto p-4 sm:p-6">
          <article className="mx-auto max-w-4xl space-y-12">
            <header className="space-y-6">
              <h1 className="editorial-title text-3xl font-black text-zinc-950 sm:text-4xl">
                {textState.title || "Untitled Fragment"}
              </h1>
              <div className="flex flex-wrap gap-2">
                {textState.tags.map((tag: string, i: number) => (
                  <span key={i} className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
                    #{tag}
                  </span>
                ))}
              </div>
            </header>
            <div className="prose prose-zinc min-h-[50svh] max-w-none font-serif text-lg leading-relaxed text-zinc-800 sm:text-xl">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{textState.currentText}</ReactMarkdown>
            </div>
            <footer className="border-t border-zinc-200 pt-8 pb-4">
              <div className="flex items-center justify-between text-[10px] font-black tracking-[0.2em] text-zinc-300 uppercase">
                <span>( End of Fragment )</span>
                <span>{textState.wordCount} Words</span>
              </div>
            </footer>
          </article>
        </div>
      </Modal>

      {/* FileSet Library Modal */}
      <Modal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        className="w-[90vw] max-w-lg border border-white/5 bg-zinc-700/80 p-0 shadow-[0_40px_100px_rgba(0,0,0,0.8)]"
      >
        <div className="flex max-h-[85vh] flex-col overflow-hidden">
          {/* Header Area */}
          <div className="relative border-b border-white/5 px-8 pt-10 pb-6">
            <h3
              style={{ color: SABI_GOLD }}
              className="flex items-center gap-2 text-[10px] font-black tracking-[0.4em] uppercase"
            >
              Collection Library
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                const newName = formData.get("setName") as string
                if (newName.trim()) {
                  switchFileSet(newName.trim())
                  setIsLibraryOpen(false)
                }
              }}
              className="mt-6 flex items-baseline gap-4"
            >
              <div className="group relative flex-1">
                <input
                  key={isLibraryOpen ? currentFileSet : "closed"}
                  type="text"
                  name="setName"
                  defaultValue={currentFileSet}
                  autoFocus
                  className="w-full bg-transparent py-2 text-xl font-bold text-zinc-100 placeholder:text-zinc-700 focus:outline-none"
                  placeholder="Name collection..."
                />
                <div
                  className="absolute bottom-0 left-0 h-0.5 w-full bg-zinc-800 transition-all group-focus-within:bg-current"
                  style={{ backgroundColor: "rgba(159, 137, 14, 0.3)" }}
                />
                <div
                  className="absolute bottom-0 left-0 h-0.5 w-0 bg-current transition-all duration-500 group-focus-within:w-full"
                  style={{ backgroundColor: SABI_GOLD }}
                />
              </div>
              <button
                type="submit"
                style={{ color: SABI_GOLD }}
                className="text-[10px] font-black tracking-widest uppercase transition-opacity hover:opacity-50"
              >
                Create / Switch
              </button>
            </form>
          </div>

          {/* Library Grid */}
          <div className="custom-scrollbar flex-1 overflow-y-auto bg-zinc-950/20 px-4 py-6 sm:px-8">
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-2">
              {fileSetInfo.map((set) => (
                <button
                  key={set.name}
                  onClick={() => {
                    switchFileSet(set.name)
                    setIsLibraryOpen(false)
                  }}
                  className={`group flex flex-col items-start transition-all ${
                    currentFileSet === set.name ? "opacity-100" : "opacity-60 hover:opacity-100"
                  }`}
                >
                  <div
                    className={`relative aspect-video w-full overflow-hidden transition-all duration-500 ${
                      currentFileSet === set.name
                        ? "border border-zinc-500 shadow-[0_0_20px_rgba(159,137,14,0.1)]"
                        : "border border-zinc-800 hover:border-zinc-500"
                    }`}
                  >
                    {set.latestImageUrl ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/40 p-4">
                        <p className="line-clamp-3 font-serif text-xs text-zinc-400 italic">
                          {textState.previewCache[set.latestIdbKey || ""] || "Preview loading..."}
                        </p>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/40">
                        <PenIcon size="16px" color="rgba(255,255,255,0.05)" />
                      </div>
                    )}

                    <div className="absolute top-2 right-2">
                      <div className="rounded-xs bg-black/40 px-1.5 py-0.5 text-[7px] font-bold tracking-widest text-zinc-300 uppercase backdrop-blur-md">
                        {set.count} Notes
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex w-full flex-col px-0.5">
                    <div className="flex items-center justify-between">
                      <span
                        className={`truncate text-[10px] font-black tracking-[0.2em] uppercase transition-colors ${
                          currentFileSet === set.name ? "text-zinc-100" : "text-zinc-500"
                        }`}
                      >
                        {set.name}
                      </span>
                      {currentFileSet === set.name && (
                        <div style={{ backgroundColor: SABI_GOLD }} className="h-1 w-1 animate-pulse rounded-full" />
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-white/5 p-6 text-center">
            <button
              onClick={() => setIsLibraryOpen(false)}
              className="text-[9px] font-bold tracking-[0.3em] text-zinc-600 uppercase transition-colors hover:text-zinc-300"
            >
              Close Archive
            </button>
          </div>
        </div>
      </Modal>
    </Modal>
  )
}

export default TextModal
