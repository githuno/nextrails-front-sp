import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"

// inspired by: https://emilkowal.ski/ui/building-a-toast-component

/**
 * ==========================================
 * ICONS (Self-contained)
 * ==========================================
 */
const CheckCircle = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
)

const XCircle = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
)

const AlertTriangle = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

const Info = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
)

const Loader = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <line x1="12" y1="2" x2="12" y2="6" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
    <line x1="2" y1="12" x2="6" y2="12" />
    <line x1="18" y1="12" x2="22" y2="12" />
    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
  </svg>
)

const X = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

/**
 * ==========================================
 * TYPES & STORE
 * ==========================================
 */

export type ToastType = "success" | "error" | "info" | "warning" | "loading"

export interface ToastData {
  id: string
  title?: string
  description?: string
  type: ToastType
  duration?: number
  height?: number
  createdAt: number
  remainingTime: number
  lastStartedAt: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface ToastState {
  toasts: ToastData[]
  expanded: boolean
  isPaused: boolean
}

let state: ToastState = {
  toasts: [],
  expanded: false,
  isPaused: false,
}

let listeners: Array<() => void> = []
const emit = () => listeners.forEach((l) => l())

// Internal timers mapping
const timers = new Map<string, ReturnType<typeof setTimeout>>()

const clearTimer = (id: string) => {
  if (timers.has(id)) {
    clearTimeout(timers.get(id))
    timers.delete(id)
  }
}

export const toastStore = {
  subscribe: (listener: () => void) => {
    listeners.push(listener)
    return () => {
      listeners = listeners.filter((l) => l !== listener)
    }
  },
  getSnapshot: () => state,
  getServerSnapshot: () => state,

  add: (
    options: Omit<ToastData, "id" | "createdAt" | "height" | "remainingTime" | "lastStartedAt"> & {
      id?: string
    },
  ) => {
    const id = options.id || crypto.randomUUID()
    const existing = state.toasts.find((t) => t.id === id)
    const duration = options.duration ?? 4000

    const newToast: ToastData = {
      ...(existing || {}),
      ...options,
      id,
      createdAt: existing?.createdAt || Date.now(),
      remainingTime: duration,
      lastStartedAt: Date.now(),
    } as ToastData

    if (existing) {
      state = { ...state, toasts: state.toasts.map((t) => (t.id === id ? newToast : t)) }
    } else {
      state = { ...state, toasts: [newToast, ...state.toasts].slice(0, 5) }
    }

    clearTimer(id)
    if (newToast.type !== "loading" && duration !== Infinity && duration > 0 && !state.isPaused) {
      timers.set(
        id,
        setTimeout(() => toastStore.remove(id), duration),
      )
    }

    emit()
    return id
  },

  updateHeight: (id: string, height: number) => {
    if (state.toasts.find((t) => t.id === id)?.height === height) return
    state = { ...state, toasts: state.toasts.map((t) => (t.id === id ? { ...t, height } : t)) }
    emit()
  },

  setExpanded: (expanded: boolean) => {
    state = { ...state, expanded }
    emit()
  },

  remove: (id: string) => {
    clearTimer(id)
    state = { ...state, toasts: state.toasts.filter((t) => t.id !== id) }
    emit()
  },

  dismissAll: () => {
    state.toasts.forEach((t) => clearTimer(t.id))
    state = { ...state, toasts: [] }
    emit()
  },

  pause: () => {
    if (state.isPaused) return
    const now = Date.now()
    state = {
      ...state,
      isPaused: true,
      toasts: state.toasts.map((t) => {
        clearTimer(t.id)
        if (t.duration === Infinity) return t
        const elapsed = now - t.lastStartedAt
        return { ...t, remainingTime: Math.max(0, t.remainingTime - elapsed) }
      }),
    }
    emit()
  },

  resume: () => {
    if (!state.isPaused) return
    state = { ...state, isPaused: false }
    state.toasts.forEach((t) => {
      if (t.type === "loading" || t.duration === Infinity || t.remainingTime <= 0) return
      timers.set(
        t.id,
        setTimeout(() => toastStore.remove(t.id), t.remainingTime),
      )
    })
    state = {
      ...state,
      toasts: state.toasts.map((t) => ({ ...t, lastStartedAt: Date.now() })),
    }
    emit()
  },
}

/**
 * ==========================================
 * SINGLETON INTERFACE
 * ==========================================
 */
type ToastOptions = Partial<Omit<ToastData, "id" | "title">> & { id?: string }

export const toast = (title: string, options?: ToastOptions) => toastStore.add({ title, type: "info", ...options })
toast.success = (title: string, options?: ToastOptions) => toastStore.add({ title, type: "success", ...options })
toast.error = (title: string, options?: ToastOptions) => toastStore.add({ title, type: "error", ...options })
toast.warning = (title: string, options?: ToastOptions) => toastStore.add({ title, type: "warning", ...options })
toast.loading = (title: string, options?: ToastOptions) => toastStore.add({ title, type: "loading", ...options })
toast.dismiss = (id: string) => toastStore.remove(id)
toast.dismissAll = () => toastStore.dismissAll()

toast.promise = <T,>(
  promise: Promise<T>,
  msgs: { loading: string; success: (data: T) => string; error: (err: unknown) => string },
  options?: ToastOptions,
) => {
  const id = toast.loading(msgs.loading, options)
  promise
    .then((data) => toast.success(msgs.success(data), { ...options, id }))
    .catch((err) => toast.error(msgs.error(err), { ...options, id }))
  return promise
}

/**
 * ==========================================
 * COMPOUND COMPONENTS (UI)
 * ==========================================
 */
const ToastContext = React.createContext<{
  toast: ToastData
  index: number
  offset: number
  isExpanded: boolean
} | null>(null)

const useToastContext = () => {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error("Toast components must be within Toast.Root")
  return ctx
}

export const Toast = {
  Root: ({ children }: { children: React.ReactNode }) => {
    const { toast: t, index, offset, isExpanded } = useToastContext()
    const [dragX, setDragX] = useState(0)
    const isDragging = useRef(false)
    const startX = useRef(0)

    const ref = useCallback(
      (node: HTMLDivElement | null) => {
        if (node) {
          const observer = new ResizeObserver((entries) => {
            for (const entry of entries) toastStore.updateHeight(t.id, entry.contentRect.height)
          })
          observer.observe(node)
          toastStore.updateHeight(t.id, node.offsetHeight)
          return () => observer.disconnect()
        }
      },
      [t.id],
    )

    const onPointerDown = (e: React.PointerEvent) => {
      if (index !== 0) return
      isDragging.current = true
      startX.current = e.clientX - dragX
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    }

    const onPointerMove = (e: React.PointerEvent) => {
      if (!isDragging.current) return
      const x = e.clientX - startX.current
      if (x > 0) setDragX(x) // Only swipe right
    }

    const onPointerUp = () => {
      if (!isDragging.current) return
      isDragging.current = false
      if (dragX > 100) {
        toastStore.remove(t.id)
      } else {
        setDragX(0)
      }
    }

    return (
      <div
        ref={ref}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        role="status"
        aria-live="polite"
        className="absolute right-0 bottom-0 w-full touch-none transition-all duration-400 ease-[cubic-bezier(0.21,1.02,0.73,1)] select-none"
        style={
          {
            "--index": index,
            "--offset": offset,
            "--drag-x": `${dragX}px`,
            zIndex: 100 - index,
            pointerEvents: isExpanded || index === 0 ? "auto" : "none",
            opacity: isExpanded ? 1 : index > 2 ? 0 : 1 - index * 0.3,
            filter: isExpanded ? "blur(0)" : `blur(${index}px)`,
            transform: `translateY(calc(${
              isExpanded ? offset * -1 : index * -10
            }px)) scale(calc(1 - ${isExpanded ? 0 : index * 0.05})) translateX(var(--drag-x, 0px))`,
          } as React.CSSProperties
        }
      >
        <div className="group flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 px-4 font-sans shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-colors hover:bg-neutral-50 active:cursor-grabbing">
          {children}
        </div>
      </div>
    )
  },

  Icon: () => {
    const { toast: t } = useToastContext()
    const icon = useMemo(() => {
      switch (t.type) {
        case "success":
          return <CheckCircle className="h-5 w-5 text-emerald-500" />
        case "error":
          return <XCircle className="h-5 w-5 text-red-500" />
        case "warning":
          return <AlertTriangle className="h-5 w-5 text-amber-500" />
        case "loading":
          return <Loader className="h-5 w-5 animate-spin text-blue-500" />
        default:
          return <Info className="h-5 w-5 text-blue-500" />
      }
    }, [t.type])
    return <div className="flex h-5 w-5 shrink-0 items-center justify-center">{icon}</div>
  },

  Content: ({ children }: { children?: React.ReactNode }) => {
    const { toast: t } = useToastContext()
    return (
      <div className="min-w-0 grow">
        {children || (
          <>
            {t.title && <h3 className="m-0 text-[14px] leading-[1.4] font-medium text-neutral-900">{t.title}</h3>}
            {t.description && <p className="m-0 mt-0.5 truncate text-[13px] text-neutral-500">{t.description}</p>}
          </>
        )}
      </div>
    )
  },

  Close: () => {
    const { toast: t } = useToastContext()
    return (
      <button
        onClick={(e) => {
          e.stopPropagation()
          toastStore.remove(t.id)
        }}
        className="shrink-0 rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-neutral-100"
        aria-label="Close"
      >
        <X className="h-4 w-4 text-neutral-400 hover:text-neutral-500" />
      </button>
    )
  },

  Action: () => {
    const { toast: t } = useToastContext()
    if (!t.action) return null
    return (
      <button
        onClick={(e) => {
          e.stopPropagation()
          t.action?.onClick()
          toastStore.remove(t.id)
        }}
        className="ml-auto shrink-0 rounded-md bg-neutral-900 px-3 py-1.5 text-[12px] font-bold text-white transition-colors hover:bg-neutral-800 active:scale-95"
      >
        {t.action.label}
      </button>
    )
  },
}

/**
 * ==========================================
 * ORCHESTRATOR
 * ==========================================
 */
export const Toaster = ({
  portal = true,
  children,
}: {
  portal?: boolean
  children?: (data: ToastData) => React.ReactNode
}) => {
  const { toasts, expanded } = useSyncExternalStore(
    toastStore.subscribe,
    toastStore.getSnapshot,
    toastStore.getServerSnapshot,
  )

  const isClient = useSyncExternalStore(
    useCallback(() => () => {}, []),
    () => true,
    () => false,
  )

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") toastStore.dismissAll()
    }
    const onFocus = () => toastStore.resume()
    const onBlur = () => toastStore.pause()
    const onVisibilityChange = () => (document.hidden ? toastStore.pause() : toastStore.resume())

    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("focus", onFocus)
    window.addEventListener("blur", onBlur)
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("blur", onBlur)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [])

  if (!isClient) return null

  const handlers = {
    onMouseEnter: () => toastStore.setExpanded(true),
    onMouseLeave: () => toastStore.setExpanded(false),
    onTouchStart: () => toastStore.setExpanded(true),
  }

  const content = (
    <div
      {...handlers}
      className="pointer-events-none fixed right-8 bottom-8 z-9999 flex w-[calc(100%-64px)] max-w-90 flex-col-reverse sm:w-90"
    >
      {toasts.map((t, i) => {
        const offset = toasts.slice(0, i).reduce((acc, curr) => acc + (curr.height || 60) + 12, 0)
        return (
          <ToastContext.Provider key={t.id} value={{ toast: t, index: i, offset, isExpanded: expanded }}>
            {children ? (
              <Toast.Root>{children(t)}</Toast.Root>
            ) : (
              <Toast.Root>
                <Toast.Icon />
                <Toast.Content />
                <Toast.Action />
                <Toast.Close />
              </Toast.Root>
            )}
          </ToastContext.Provider>
        )
      })}
    </div>
  )

  if (!portal) return content

  return createPortal(content, document.body)
}
