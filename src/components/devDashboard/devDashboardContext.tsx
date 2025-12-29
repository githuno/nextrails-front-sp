import React, { createContext, ReactNode, useContext, useState } from "react"

// デバッグ可能な対象の種類を定義
export type DebugTarget = "dom" | "state" | "network" | "performance" | "console"

// デバッグメッセージの優先度
export type DebugSeverity = "info" | "warning" | "error" | "success"

// デバッグイベントのベース構造
export interface DebugEvent {
  id: string
  timestamp: number
  type: DebugTarget
  severity: DebugSeverity
  message: string
  details?: unknown
}

// DOM変更イベント
export interface DomDebugEvent extends DebugEvent {
  type: "dom"
  elementSelector?: string
  mutationType?: string
  oldValue?: string | null
  newValue?: string | null
}

// 状態変更イベント
export interface StateDebugEvent extends DebugEvent {
  type: "state"
  component: string
  propertyName: string
  previousValue?: unknown
  currentValue?: unknown
}

// ネットワークイベント
export interface NetworkDebugEvent extends DebugEvent {
  type: "network"
  url: string
  method: string
  status?: number
  duration?: number
  requestPayload?: unknown
  responseData?: unknown
}

// パフォーマンスイベント
export interface PerformanceDebugEvent extends DebugEvent {
  type: "performance"
  metric: string
  value: number
  unit: string
  threshold?: number
}

// コンソールイベント
export interface ConsoleDebugEvent extends DebugEvent {
  type: "console"
  logLevel: "log" | "info" | "warn" | "error" | "debug"
  args: unknown[]
}

// すべてのデバッグイベントタイプを統合
export type AnyDebugEvent =
  | DomDebugEvent
  | StateDebugEvent
  | NetworkDebugEvent
  | PerformanceDebugEvent
  | ConsoleDebugEvent

// ダッシュボード設定
export interface DevDashboardSettings {
  position: "top-right" | "top-left" | "bottom-right" | "bottom-left"
  theme: "light" | "dark" | "system"
  maxEvents: number
  enabledTargets: DebugTarget[]
  autoExpand: boolean
  opacity: number
  zIndex: number
  showTimestamps: boolean
  persistEvents: boolean
  filterSeverity: DebugSeverity | "all"
}

// コンテキスト内容
interface DevDashboardContextType {
  events: AnyDebugEvent[]
  settings: DevDashboardSettings
  addEvent: (event: Omit<AnyDebugEvent, "id" | "timestamp">) => void
  clearEvents: () => void
  updateSettings: (settings: Partial<DevDashboardSettings>) => void
  isVisible: boolean
  toggleVisibility: () => void
}

// デフォルト設定
const defaultSettings: DevDashboardSettings = {
  position: "bottom-right",
  theme: "system",
  maxEvents: 100,
  enabledTargets: ["dom", "state", "network", "performance", "console"],
  autoExpand: false,
  opacity: 0.9,
  zIndex: 9999,
  showTimestamps: true,
  persistEvents: false,
  filterSeverity: "all",
}

// コンテキスト作成
const DevDashboardContext = createContext<DevDashboardContextType | undefined>(undefined)

export const DevDashboardProvider: React.FC<{
  children: ReactNode
  initialSettings?: Partial<DevDashboardSettings>
}> = ({ children, initialSettings }) => {
  const [events, setEvents] = useState<AnyDebugEvent[]>([])
  const [settings, setSettings] = useState<DevDashboardSettings>({
    ...defaultSettings,
    ...initialSettings,
  })
  const [isVisible, setIsVisible] = useState(true)

  // イベント追加
  const addEvent = (event: Omit<AnyDebugEvent, "id" | "timestamp">) => {
    const newEvent = {
      ...event,
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    } as AnyDebugEvent

    setEvents((prevEvents) => {
      const updatedEvents = [...prevEvents, newEvent]
      // 最大イベント数を超えた場合、古いイベントを削除
      return updatedEvents.slice(-settings.maxEvents)
    })
  }

  // イベントクリア
  const clearEvents = () => setEvents([])

  // 設定更新
  const updateSettings = (newSettings: Partial<DevDashboardSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }))
  }

  // 表示/非表示切り替え
  const toggleVisibility = () => setIsVisible((prev) => !prev)

  return (
    <DevDashboardContext.Provider
      value={{
        events,
        settings,
        addEvent,
        clearEvents,
        updateSettings,
        isVisible,
        toggleVisibility,
      }}
    >
      {children}
    </DevDashboardContext.Provider>
  )
}

// フック
export const useDevDashboard = () => {
  const context = useContext(DevDashboardContext)
  if (context === undefined) {
    throw new Error("useDevDashboard must be used within a DevDashboardProvider")
  }
  return context
}
