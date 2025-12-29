"use client"
import useMutationObserver, { MutationDetail } from "@/hooks/debug/useMutationObserver"
import useTrackedEffect from "@/hooks/debug/useTrackedEffect"
import React, { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  AnyDebugEvent,
  ConsoleDebugEvent,
  DebugTarget,
  DevDashboardSettings,
  NetworkDebugEvent,
  PerformanceDebugEvent,
  useDevDashboard,
} from "./devDashboardContext"

// XMLHttpRequestの拡張型を定義
interface ExtendedXMLHttpRequest extends XMLHttpRequest {
  _debugMethod?: string
  _debugUrl?: string | URL
  _debugStartTime?: number
}

// CSS スタイル
const styles = {
  container: (position: string, opacity: number, zIndex: number, theme: string, isVisible: boolean) => ({
    position: "fixed",
    ...(position === "top-right" && { top: "20px", right: "20px" }),
    ...(position === "top-left" && { top: "20px", left: "20px" }),
    ...(position === "bottom-right" && { bottom: "20px", right: "20px" }),
    ...(position === "bottom-left" && { bottom: "20px", left: "20px" }),
    backgroundColor: theme === "dark" ? "rgba(30, 30, 30, 0.95)" : "rgba(255, 255, 255, 0.95)",
    color: theme === "dark" ? "#f0f0f0" : "#333",
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
    width: "360px",
    fontFamily: "monospace",
    fontSize: "12px",
    transition: "all 0.3s ease",
    opacity: isVisible ? opacity : 0,
    transform: isVisible ? "translateY(0)" : "translateY(20px)",
    pointerEvents: isVisible ? "auto" : "none",
    maxHeight: "calc(100vh - 40px)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    zIndex,
  }),
  header: {
    padding: "10px",
    borderBottom: "1px solid rgba(127, 127, 127, 0.2)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    margin: 0,
    fontSize: "14px",
    fontWeight: "bold",
  },
  controls: {
    display: "flex",
    gap: "5px",
  },
  button: (theme: string) => ({
    background: "none",
    border: "none",
    color: theme === "dark" ? "#f0f0f0" : "#333",
    cursor: "pointer",
    fontSize: "14px",
    padding: "2px 5px",
    borderRadius: "4px",
    "&:hover": {
      backgroundColor: theme === "dark" ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.05)",
    },
  }),
  tabBar: {
    display: "flex",
    borderBottom: "1px solid rgba(127, 127, 127, 0.2)",
  },
  tab: (theme: string, isActive: boolean) => ({
    padding: "8px 12px",
    cursor: "pointer",
    borderBottom: isActive ? `2px solid ${theme === "dark" ? "#61dafb" : "#0066cc"}` : "2px solid transparent",
    color: isActive ? (theme === "dark" ? "#61dafb" : "#0066cc") : theme === "dark" ? "#ccc" : "#666",
    backgroundColor: isActive
      ? theme === "dark"
        ? "rgba(97, 218, 251, 0.1)"
        : "rgba(0, 102, 204, 0.05)"
      : "transparent",
  }),
  content: {
    overflowY: "auto",
    padding: "10px",
    flexGrow: 1,
  },
  eventList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
  },
  eventItem: (theme: string, severity: "info" | "warning" | "error" | "success") => {
    const colorMap = {
      info: theme === "dark" ? "#61dafb" : "#0066cc",
      warning: theme === "dark" ? "#f0ad4e" : "#f0ad4e",
      error: theme === "dark" ? "#f56c6c" : "#ff3333",
      success: theme === "dark" ? "#5cb85c" : "#28a745",
    }

    return {
      padding: "8px",
      marginBottom: "8px",
      borderRadius: "4px",
      borderLeft: `3px solid ${colorMap[severity]}`,
      backgroundColor: theme === "dark" ? "rgba(30, 30, 30, 0.5)" : "rgba(240, 240, 240, 0.5)",
    }
  },
  eventHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "4px",
    fontSize: "11px",
  },
  eventType: (theme: string) => ({
    padding: "2px 5px",
    borderRadius: "3px",
    backgroundColor: theme === "dark" ? "rgba(97, 218, 251, 0.2)" : "rgba(0, 102, 204, 0.1)",
    color: theme === "dark" ? "#61dafb" : "#0066cc",
  }),
  eventTime: {
    color: "rgba(127, 127, 127, 0.8)",
  },
  eventMessage: {
    wordBreak: "break-word" as const,
  },
  eventDetails: (theme: string) => ({
    marginTop: "5px",
    padding: "5px",
    borderRadius: "3px",
    backgroundColor: theme === "dark" ? "rgba(0, 0, 0, 0.2)" : "rgba(0, 0, 0, 0.05)",
    overflow: "auto",
    maxHeight: "200px",
    fontSize: "11px",
  }),
  footer: {
    padding: "8px 10px",
    borderTop: "1px solid rgba(127, 127, 127, 0.2)",
    display: "flex",
    justifyContent: "space-between",
    fontSize: "11px",
  },
  infoText: {
    color: "rgba(127, 127, 127, 0.8)",
  },
  badge: (theme: string, count: number) => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "15px",
    height: "15px",
    padding: "0 4px",
    borderRadius: "10px",
    fontSize: "10px",
    backgroundColor: count > 0 ? (theme === "dark" ? "#61dafb" : "#0066cc") : "rgba(127, 127, 127, 0.3)",
    color: count > 0 ? (theme === "dark" ? "#000" : "#fff") : theme === "dark" ? "#ccc" : "#666",
    marginLeft: "5px",
  }),
  settings: {
    padding: "10px",
  },
  settingsRow: {
    marginBottom: "10px",
  },
  settingsLabel: {
    display: "block",
    marginBottom: "5px",
    fontWeight: "bold",
  },
  select: (theme: string) => ({
    width: "100%",
    padding: "5px",
    borderRadius: "4px",
    border: `1px solid ${theme === "dark" ? "#555" : "#ddd"}`,
    backgroundColor: theme === "dark" ? "#333" : "#fff",
    color: theme === "dark" ? "#f0f0f0" : "#333",
  }),
  checkbox: {
    marginRight: "5px",
  },
  toggle: {
    position: "fixed",
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    backgroundColor: "#0066cc",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.2)",
    cursor: "pointer",
    zIndex: 10000,
  },
  collapseButton: {
    position: "absolute",
    right: "10px",
    top: "50%",
    transform: "translateY(-50%)",
    cursor: "pointer",
    fontSize: "20px",
    padding: "2px 5px",
    backgroundColor: "transparent",
    border: "none",
    color: "inherit",
  },
}

// タブ設定
interface TabConfig {
  id: DebugTarget | "all" | "settings"
  label: string
  icon: string
}

const tabs: TabConfig[] = [
  { id: "all", label: "All", icon: "🔍" },
  { id: "dom", label: "DOM", icon: "🌳" },
  { id: "state", label: "State", icon: "⚛️" },
  { id: "network", label: "Network", icon: "🌐" },
  { id: "performance", label: "Perf", icon: "⚡" },
  { id: "console", label: "Console", icon: "💬" },
  { id: "settings", label: "Settings", icon: "⚙️" },
]

// イベント表示コンポーネント
const EventItem: React.FC<{ event: AnyDebugEvent; theme: string }> = ({ event, theme }) => {
  const [expanded, setExpanded] = useState(false)

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    return `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}.${date.getMilliseconds()}`
  }

  const hasDetails = !!event.details

  return (
    <div style={styles.eventItem(theme, event.severity) as React.CSSProperties}>
      <div style={styles.eventHeader}>
        <span style={styles.eventType(theme) as React.CSSProperties}>{event.type.toUpperCase()}</span>
        <span style={styles.eventTime}>{formatTimestamp(event.timestamp)}</span>
      </div>
      <div style={styles.eventMessage}>{event.message}</div>
      {hasDetails && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: theme === "dark" ? "#61dafb" : "#0066cc",
              padding: "2px 0",
              fontSize: "11px",
            }}
          >
            {expanded ? "▼ Hide Details" : "▶ Show Details"}
          </button>
          {expanded && (
            <pre style={styles.eventDetails(theme) as React.CSSProperties}>
              {typeof event.details === "object" ? JSON.stringify(event.details, null, 2) : String(event.details)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

// 設定パネル
const SettingsPanel: React.FC = () => {
  const { settings, updateSettings } = useDevDashboard()

  return (
    <div style={styles.settings}>
      <div style={styles.settingsRow}>
        <label style={styles.settingsLabel}>Position</label>
        <select
          value={settings.position}
          onChange={(e) => updateSettings({ position: e.target.value as DevDashboardSettings["position"] })}
          style={styles.select(settings.theme === "dark" ? "dark" : "light") as React.CSSProperties}
        >
          <option value="top-right">Top Right</option>
          <option value="top-left">Top Left</option>
          <option value="bottom-right">Bottom Right</option>
          <option value="bottom-left">Bottom Left</option>
        </select>
      </div>

      <div style={styles.settingsRow}>
        <label style={styles.settingsLabel}>Theme</label>
        <select
          value={settings.theme}
          onChange={(e) => updateSettings({ theme: e.target.value as DevDashboardSettings["theme"] })}
          style={styles.select(settings.theme === "dark" ? "dark" : "light") as React.CSSProperties}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
      </div>

      <div style={styles.settingsRow}>
        <label style={styles.settingsLabel}>Max Events</label>
        <select
          value={settings.maxEvents}
          onChange={(e) => updateSettings({ maxEvents: Number(e.target.value) })}
          style={styles.select(settings.theme === "dark" ? "dark" : "light") as React.CSSProperties}
        >
          <option value="50">50</option>
          <option value="100">100</option>
          <option value="200">200</option>
          <option value="500">500</option>
        </select>
      </div>

      <div style={styles.settingsRow}>
        <label style={styles.settingsLabel}>Opacity</label>
        <input
          type="range"
          min="0.1"
          max="1"
          step="0.1"
          value={settings.opacity}
          onChange={(e) => updateSettings({ opacity: Number(e.target.value) })}
          style={{ width: "100%" }}
        />
      </div>

      <div style={styles.settingsRow}>
        <label style={{ display: "flex", alignItems: "center" }}>
          <input
            type="checkbox"
            checked={settings.autoExpand}
            onChange={(e) => updateSettings({ autoExpand: e.target.checked })}
            style={styles.checkbox as React.CSSProperties}
          />
          Auto Expand Details
        </label>
      </div>

      <div style={styles.settingsRow}>
        <label style={{ display: "flex", alignItems: "center" }}>
          <input
            type="checkbox"
            checked={settings.showTimestamps}
            onChange={(e) => updateSettings({ showTimestamps: e.target.checked })}
            style={styles.checkbox as React.CSSProperties}
          />
          Show Timestamps
        </label>
      </div>

      <div style={styles.settingsRow}>
        <label style={styles.settingsLabel}>Filter by Severity</label>
        <select
          value={settings.filterSeverity}
          onChange={(e) => updateSettings({ filterSeverity: e.target.value as DevDashboardSettings["filterSeverity"] })}
          style={styles.select(settings.theme === "dark" ? "dark" : "light") as React.CSSProperties}
        >
          <option value="all">All</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
          <option value="success">Success</option>
        </select>
      </div>

      <div style={styles.settingsRow}>
        <label style={styles.settingsLabel}>Enabled Targets</label>
        {(["dom", "state", "network", "performance", "console"] as DebugTarget[]).map((target) => (
          <label
            key={target}
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "5px",
            }}
          >
            <input
              type="checkbox"
              checked={settings.enabledTargets.includes(target)}
              onChange={(e) => {
                const newTargets = e.target.checked
                  ? [...settings.enabledTargets, target]
                  : settings.enabledTargets.filter((t) => t !== target)
                updateSettings({ enabledTargets: newTargets })
              }}
              style={styles.checkbox as React.CSSProperties}
            />
            {target.charAt(0).toUpperCase() + target.slice(1)}
          </label>
        ))}
      </div>
    </div>
  )
}

// メインコンポーネント
export const DevDashboard: React.FC = () => {
  const { events, settings, clearEvents, isVisible, toggleVisibility, addEvent } = useDevDashboard()
  const [activeTab, setActiveTab] = useState<TabConfig["id"]>("all")
  const [isCollapsed, setIsCollapsed] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const [isMounted, setIsMounted] = useState(false)

  // マウント状態の追跡
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // テーマの自動検出
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">("light")

  useEffect(() => {
    if (settings.theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
      setSystemTheme(mediaQuery.matches ? "dark" : "light")

      const handler = (e: MediaQueryListEvent) => {
        setSystemTheme(e.matches ? "dark" : "light")
      }

      mediaQuery.addEventListener("change", handler)
      return () => mediaQuery.removeEventListener("change", handler)
    }
  }, [settings.theme])

  // 実際に使用するテーマ
  const activeTheme = settings.theme === "system" ? systemTheme : settings.theme

  // フィルタリングされたイベント
  const filteredEvents = events.filter((event) => {
    // タブフィルター
    if (activeTab !== "all" && activeTab !== "settings" && event.type !== activeTab) {
      return false
    }

    // 有効なターゲットフィルター
    if (!settings.enabledTargets.includes(event.type)) {
      return false
    }

    // 深刻度フィルター
    if (settings.filterSeverity !== "all" && event.severity !== settings.filterSeverity) {
      return false
    }

    return true
  })

  // タブごとのイベント数
  const eventCounts = tabs.reduce(
    (acc, tab) => {
      if (tab.id !== "all" && tab.id !== "settings") {
        acc[tab.id] = events.filter(
          (event) => event.type === tab.id && settings.enabledTargets.includes(event.type as DebugTarget),
        ).length
      }
      return acc
    },
    {} as Record<string, number>,
  )

  // DOM変更の処理ハンドラー
  const handleDomMutation = useCallback(
    (mutations: MutationDetail[]) => {
      mutations.forEach((mutation) => {
        // DOMの変更イベントを追加
        const details = {
          target:
            mutation.target instanceof Element
              ? mutation.target.tagName + (mutation.target.id ? `#${mutation.target.id}` : "")
              : String(mutation.target),
          type: mutation.type,
        }

        if (mutation.type === "attributes") {
          Object.assign(details, {
            attribute: mutation.attributeName,
            oldValue: mutation.oldValue,
            newValue:
              mutation.target instanceof Element ? mutation.target.getAttribute(mutation.attributeName || "") : null,
          })
        } else if (mutation.type === "characterData") {
          Object.assign(details, {
            oldValue: mutation.oldValue,
            newValue: mutation.target.nodeValue,
          })
        } else if (mutation.type === "childList") {
          if (mutation.addedNodes && mutation.addedNodes.length > 0) {
            Object.assign(details, {
              addedNodes: Array.from(mutation.addedNodes).map((node) =>
                node instanceof Element ? node.tagName + (node.id ? `#${node.id}` : "") : String(node),
              ),
            })
          }
          if (mutation.removedNodes && mutation.removedNodes.length > 0) {
            Object.assign(details, {
              removedNodes: Array.from(mutation.removedNodes).map((node) =>
                node instanceof Element ? node.tagName + (node.id ? `#${node.id}` : "") : String(node),
              ),
            })
          }
        }

        addEvent({
          type: "dom",
          severity: "info",
          message: `DOM ${mutation.type} detected`,
          details,
        })
      })
    },
    [addEvent],
  )

  // useMutationObserverをコンポーネントのトップレベルで呼び出す
  const { disconnect, reconnect } = useMutationObserver(
    // マウント済みの場合のみドキュメントを指定
    isMounted && typeof document !== "undefined" ? document.documentElement : null,
    handleDomMutation,
    {
      childList: true,
      attributes: true,
      characterData: true,
      subtree: true,
      attributeOldValue: true,
      characterDataOldValue: true,
      // ダッシュボード自体の変更は無視
      mutationFilter: (mutation) => {
        if (
          rootRef.current &&
          (rootRef.current.contains(mutation.target as Node) || rootRef.current === mutation.target)
        ) {
          return false
        }
        return true
      },
    },
    // 依存配列
    [isMounted, handleDomMutation],
  )

  // DOM変更の監視
  useEffect(() => {
    if (!isMounted || !settings.enabledTargets.includes("dom")) {
      disconnect()
    } else {
      reconnect()
    }
  }, [isMounted, settings.enabledTargets, disconnect, reconnect])

  // コンソールAPIのオーバーライド
  useEffect(() => {
    if (!settings.enabledTargets.includes("console")) return

    const originalConsoleLog = console.log
    const originalConsoleInfo = console.info
    const originalConsoleWarn = console.warn
    const originalConsoleError = console.error
    const originalConsoleDebug = console.debug

    console.log = function (...args: unknown[]) {
      const event: Omit<ConsoleDebugEvent, "id" | "timestamp"> = {
        type: "console",
        severity: "info",
        message: args.map((arg) => String(arg)).join(" "),
        details: args,
        logLevel: "log",
        args,
      }
      addEvent(event)
      originalConsoleLog.apply(console, args)
    }

    console.info = function (...args: unknown[]) {
      const event: Omit<ConsoleDebugEvent, "id" | "timestamp"> = {
        type: "console",
        severity: "info",
        message: args.map((arg) => String(arg)).join(" "),
        details: args,
        logLevel: "info",
        args,
      }
      addEvent(event)
      originalConsoleInfo.apply(console, args)
    }

    console.warn = function (...args: unknown[]) {
      const event: Omit<ConsoleDebugEvent, "id" | "timestamp"> = {
        type: "console",
        severity: "warning",
        message: args.map((arg) => String(arg)).join(" "),
        details: args,
        logLevel: "warn",
        args,
      }
      addEvent(event)
      originalConsoleWarn.apply(console, args)
    }

    console.error = function (...args: unknown[]) {
      const event: Omit<ConsoleDebugEvent, "id" | "timestamp"> = {
        type: "console",
        severity: "error",
        message: args.map((arg) => String(arg)).join(" "),
        details: args,
        logLevel: "error",
        args,
      }
      addEvent(event)
      originalConsoleError.apply(console, args)
    }

    console.debug = function (...args: unknown[]) {
      const event: Omit<ConsoleDebugEvent, "id" | "timestamp"> = {
        type: "console",
        severity: "info",
        message: args.map((arg) => String(arg)).join(" "),
        details: args,
        logLevel: "debug",
        args,
      }
      addEvent(event)
      originalConsoleDebug.apply(console, args)
    }

    return () => {
      console.log = originalConsoleLog
      console.info = originalConsoleInfo
      console.warn = originalConsoleWarn
      console.error = originalConsoleError
      console.debug = originalConsoleDebug
    }
  }, [settings.enabledTargets, addEvent])

  // ネットワークリクエストの監視
  useEffect(() => {
    if (!settings.enabledTargets.includes("network")) return

    const originalFetch = window.fetch
    const originalXHROpen = XMLHttpRequest.prototype.open
    const originalXHRSend = XMLHttpRequest.prototype.send

    // Fetch APIの監視
    window.fetch = async function (input, init) {
      const startTime = performance.now()
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
      const method = init?.method || "GET"

      let requestPayload: unknown
      if (init?.body) {
        try {
          requestPayload = typeof init.body === "string" ? JSON.parse(init.body) : init.body
        } catch {
          requestPayload = init.body
        }
      }

      const pendingEvent: Omit<NetworkDebugEvent, "id" | "timestamp"> = {
        type: "network",
        severity: "info",
        message: `${method} ${url}`,
        details: { url, method, requestPayload, status: "pending" },
        url,
        method,
      }
      addEvent(pendingEvent)

      try {
        const response = await originalFetch.apply(window, [input, init])
        const duration = performance.now() - startTime
        const clonedResponse = response.clone()
        let responseData

        try {
          const contentType = clonedResponse.headers.get("content-type")
          if (contentType && contentType.includes("application/json")) {
            responseData = await clonedResponse.json()
          } else {
            responseData = await clonedResponse.text()
          }
        } catch {
          responseData = "Failed to parse response"
        }

        const successEvent: Omit<NetworkDebugEvent, "id" | "timestamp"> = {
          type: "network",
          severity: response.ok ? "success" : "error",
          message: `${method} ${url} - ${response.status} ${response.statusText}`,
          details: {
            url,
            method,
            requestPayload,
            status: response.status,
            statusText: response.statusText,
            duration: Math.round(duration),
            responseData,
          },
          url,
          method,
          status: response.status,
          duration: Math.round(duration),
          requestPayload,
          responseData,
        }
        addEvent(successEvent)

        return response
      } catch (error) {
        const duration = performance.now() - startTime

        const errorEvent: Omit<NetworkDebugEvent, "id" | "timestamp"> = {
          type: "network",
          severity: "error",
          message: `${method} ${url} - Failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          details: {
            url,
            method,
            requestPayload,
            error: error instanceof Error ? error.message : String(error),
            duration: Math.round(duration),
          },
          url,
          method,
          duration: Math.round(duration),
          requestPayload,
        }
        addEvent(errorEvent)

        throw error
      }
    }

    // XMLHttpRequestの監視
    XMLHttpRequest.prototype.open = function (method, url) {
      // 拡張プロパティを追加
      const xhr = this as ExtendedXMLHttpRequest
      xhr._debugMethod = method
      xhr._debugUrl = url
      xhr._debugStartTime = performance.now()
      return originalXHROpen.call(this, method, url, true)
    }

    XMLHttpRequest.prototype.send = function (body: Document | XMLHttpRequestBodyInit | null = null) {
      const xhr = this as ExtendedXMLHttpRequest
      let requestPayload: unknown
      if (body) {
        try {
          requestPayload = typeof body === "string" ? JSON.parse(body) : body
        } catch {
          requestPayload = body
        }
      }

      const pendingEvent: Omit<NetworkDebugEvent, "id" | "timestamp"> = {
        type: "network",
        severity: "info",
        message: `${xhr._debugMethod} ${xhr._debugUrl}`,
        details: {
          url: xhr._debugUrl,
          method: xhr._debugMethod,
          requestPayload,
          status: "pending",
        },
        url: xhr._debugUrl as string,
        method: xhr._debugMethod as string,
      }
      addEvent(pendingEvent)

      this.addEventListener("load", function () {
        const loadXhr = this as ExtendedXMLHttpRequest
        const duration = loadXhr._debugStartTime ? performance.now() - loadXhr._debugStartTime : 0
        let responseData

        try {
          const contentType = this.getResponseHeader("content-type")
          if (contentType && contentType.includes("application/json")) {
            responseData = JSON.parse(this.responseText)
          } else {
            responseData = this.responseText
          }
        } catch {
          responseData = this.responseText
        }

        const loadEvent: Omit<NetworkDebugEvent, "id" | "timestamp"> = {
          type: "network",
          severity: this.status >= 200 && this.status < 300 ? "success" : "error",
          message: `${loadXhr._debugMethod} ${loadXhr._debugUrl} - ${this.status}`,
          details: {
            url: loadXhr._debugUrl,
            method: loadXhr._debugMethod,
            requestPayload,
            status: this.status,
            statusText: this.statusText,
            duration: Math.round(duration),
            responseData,
          },
          url: loadXhr._debugUrl as string,
          method: loadXhr._debugMethod as string,
          status: this.status,
          duration: Math.round(duration),
          requestPayload,
          responseData,
        }
        addEvent(loadEvent)
      })

      this.addEventListener("error", function () {
        const errorXhr = this as ExtendedXMLHttpRequest
        const duration = errorXhr._debugStartTime ? performance.now() - errorXhr._debugStartTime : 0

        const errorEvent: Omit<NetworkDebugEvent, "id" | "timestamp"> = {
          type: "network",
          severity: "error",
          message: `${errorXhr._debugMethod} ${errorXhr._debugUrl} - Failed`,
          details: {
            url: errorXhr._debugUrl,
            method: errorXhr._debugMethod,
            requestPayload,
            duration: Math.round(duration),
          },
          url: errorXhr._debugUrl as string,
          method: errorXhr._debugMethod as string,
          duration: Math.round(duration),
          requestPayload,
        }
        addEvent(errorEvent)
      })

      return originalXHRSend.call(this, body as Parameters<XMLHttpRequest["send"]>[0])
    }

    return () => {
      window.fetch = originalFetch
      XMLHttpRequest.prototype.open = originalXHROpen
      XMLHttpRequest.prototype.send = originalXHRSend
    }
  }, [settings.enabledTargets, addEvent])

  // パフォーマンスメトリクスの定期的な収集
  useEffect(() => {
    if (!settings.enabledTargets.includes("performance")) return

    const intervalId = setInterval(() => {
      // ページのパフォーマンスメトリクスを収集
      if (window.performance) {
        // const perfData = window.performance.timing
        // const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart

        // メモリ使用量（Chrome のみ）
        const perf = performance as unknown as {
          memory?: {
            usedJSHeapSize: number
            totalJSHeapSize: number
            jsHeapSizeLimit: number
          }
        }
        if (perf.memory) {
          const memory = perf.memory
          const memoryEvent: Omit<PerformanceDebugEvent, "id" | "timestamp"> = {
            type: "performance",
            severity: "info",
            message: `メモリ使用量: ${Math.round(memory.usedJSHeapSize / 1024 / 1024)} MB`,
            details: {
              usedJSHeapSize: Math.round(memory.usedJSHeapSize / 1024 / 1024),
              totalJSHeapSize: Math.round(memory.totalJSHeapSize / 1024 / 1024),
              jsHeapSizeLimit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024),
            },
            metric: "memory",
            value: Math.round(memory.usedJSHeapSize / 1024 / 1024),
            unit: "MB",
          }
          addEvent(memoryEvent)
        }

        // FPS測定
        let frameCount = 0
        let lastTime = performance.now()
        let fps = 0

        const calculateFps = () => {
          frameCount++
          const currentTime = performance.now()

          if (currentTime - lastTime > 1000) {
            fps = Math.round((frameCount * 1000) / (currentTime - lastTime))
            frameCount = 0
            lastTime = currentTime

            const fpsEvent: Omit<PerformanceDebugEvent, "id" | "timestamp"> = {
              type: "performance",
              severity: fps < 30 ? "warning" : "info",
              message: `FPS: ${fps}`,
              details: { fps },
              metric: "fps",
              value: fps,
              unit: "fps",
              threshold: 30,
            }
            addEvent(fpsEvent)
          }

          requestAnimationFrame(calculateFps)
        }

        requestAnimationFrame(calculateFps)
      }
    }, 5000)

    return () => clearInterval(intervalId)
  }, [settings.enabledTargets, addEvent])

  // 開発環境でのみレンダリング
  if (process.env.NODE_ENV !== "development" || !isMounted) {
    return null
  }

  // ポータルを使ってDOMの最上位に追加
  return createPortal(
    <>
      {/* トグルボタン */}
      <div
        style={{
          ...(styles.toggle as React.CSSProperties),
          [settings.position.split("-")[0]]: "20px",
          [settings.position.split("-")[1]]: "20px",
          display: isVisible ? "none" : "flex",
        }}
        onClick={toggleVisibility}
      >
        🐞
      </div>

      {/* メインウィジェット */}
      <div
        ref={rootRef}
        style={
          styles.container(
            settings.position,
            settings.opacity,
            settings.zIndex,
            activeTheme,
            isVisible,
          ) as React.CSSProperties
        }
      >
        {/* ヘッダー */}
        <div style={styles.header as React.CSSProperties}>
          <h3 style={styles.title as React.CSSProperties}>
            🐞 DevDashboard {isCollapsed ? "" : `(${filteredEvents.length})`}
          </h3>
          <div style={styles.controls}>
            {!isCollapsed && (
              <>
                <button
                  onClick={clearEvents}
                  style={styles.button(activeTheme) as React.CSSProperties}
                  title="イベントをクリア"
                >
                  🗑️
                </button>
                <button
                  onClick={toggleVisibility}
                  style={styles.button(activeTheme) as React.CSSProperties}
                  title="閉じる"
                >
                  ✖️
                </button>
              </>
            )}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              style={styles.button(activeTheme) as React.CSSProperties}
              title={isCollapsed ? "展開" : "折りたたみ"}
            >
              {isCollapsed ? "▼" : "▲"}
            </button>
          </div>
        </div>

        {/* 折りたたまれていないときのみコンテンツを表示 */}
        {!isCollapsed && (
          <>
            {/* タブ */}
            <div style={styles.tabBar as React.CSSProperties}>
              {tabs.map((tab) => (
                <div
                  key={tab.id}
                  style={styles.tab(activeTheme, activeTab === tab.id) as React.CSSProperties}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.icon} {tab.label}
                  {tab.id !== "all" && tab.id !== "settings" && (
                    <span style={styles.badge(activeTheme, eventCounts[tab.id] || 0) as React.CSSProperties}>
                      {eventCounts[tab.id] || 0}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* コンテンツ */}
            <div style={styles.content as React.CSSProperties}>
              {activeTab === "settings" ? (
                <SettingsPanel />
              ) : (
                <>
                  {filteredEvents.length === 0 ? (
                    <div
                      style={{
                        padding: "20px",
                        textAlign: "center",
                        color: "gray",
                      }}
                    >
                      まだイベントはありません
                    </div>
                  ) : (
                    <div style={styles.eventList as React.CSSProperties}>
                      {filteredEvents.map((event) => (
                        <EventItem key={event.id} event={event} theme={activeTheme} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* フッター */}
            <div style={styles.footer as React.CSSProperties}>
              <span style={styles.infoText as React.CSSProperties}>DevDashboard v1.0.0</span>
              <span style={styles.infoText as React.CSSProperties}>{new Date().toLocaleTimeString()}</span>
            </div>
          </>
        )}
      </div>
    </>,
    document.body,
  )
}

interface StateChangeEvent extends Omit<AnyDebugEvent, "id" | "timestamp"> {
  type: "state"
  component: string
  propertyName: string
  previousValue: unknown
  currentValue: unknown
}

// トラッカーコンポーネント - useTrackedEffectを利用して状態変更を監視
export const StateTracker: React.FC<{
  componentName: string
  trackedStates: Record<string, unknown>
}> = ({ componentName, trackedStates }) => {
  const { addEvent } = useDevDashboard()

  useTrackedEffect(
    (changes) => {
      Object.keys(changes).forEach((indexStr) => {
        const index = Number(indexStr)
        const change = changes[index]
        const stateName = Object.keys(trackedStates)[index]

        const event: StateChangeEvent = {
          type: "state",
          severity: "info",
          message: `"${componentName}" の "${stateName}" が変更されました`,
          details: {
            component: componentName,
            property: stateName,
            from: change.trackedFrom,
            to: change.trackedTo,
          },
          component: componentName,
          propertyName: stateName,
          previousValue: change.trackedFrom,
          currentValue: change.trackedTo,
        }
        addEvent(event)
      })
    },
    [],
    { monitorMemory: true, memoryTag: componentName },
  )

  return null
}
