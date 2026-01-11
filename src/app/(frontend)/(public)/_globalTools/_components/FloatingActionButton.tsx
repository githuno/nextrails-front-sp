"use client"

import React, { createContext, useContext, useEffect, useMemo, useState } from "react"

// --- 型定義 ---

interface FloatingActionButtonContextType {
  isExpanded: boolean
  setIsExpanded: React.Dispatch<React.SetStateAction<boolean>>
  toggle: () => void
  flickIndex: number | null
  setFlickIndex: (index: number | null) => void
  isDragging: boolean
  setIsDragging: (value: boolean) => void
  // フリック検知の一貫性を保つための共有設定
  config: ActionListConfig
}

interface FloatingActionButtonProps {
  children: React.ReactNode
  initialExpanded?: boolean
  // より良い同期のためにルートに設定を渡すことを許可
  total?: number
  distance?: number
  startAngle?: number
  sweepAngle?: number
}

interface TriggerProps {
  children: (props: {
    isExpanded: boolean
    toggle: () => void
    isDragging: boolean
    flickIndex: number | null
    items?: FloatingActionButtonItem[]
  }) => React.ReactNode
  // itemsを渡すことで、フリック時にindexではなく一意のidを使用し、複数のFABが共存できるようにする
  items?: FloatingActionButtonItem[]
}

interface ActionListProps {
  children: React.ReactNode
  distance?: number
  startAngle?: number
  sweepAngle?: number
  className?: string
}

interface ActionItemProps {
  index?: number
  children: (props: {
    x: number
    y: number
    isExpanded: boolean
    setIsExpanded: React.Dispatch<React.SetStateAction<boolean>>
  }) => React.ReactNode
}

interface FloatingActionButtonItem {
  id: string | number
  label: React.ReactNode
  icon?: React.ReactNode
  onClick: () => void
  disabled?: boolean
}

interface SimplifiedFloatingActionButtonProps {
  items: FloatingActionButtonItem[]
  triggerIcon?: React.ReactNode
  position?: {
    right?: string
    bottom?: string
    top?: string
    left?: string
  }
}

// --- コンテキスト ---

const FloatingActionButtonContext = createContext<FloatingActionButtonContextType | undefined>(undefined)

interface ActionListConfig {
  total: number
  distance: number
  startAngle: number
  sweepAngle: number
}

const DEFAULT_CONFIG: ActionListConfig = {
  total: 5,
  distance: 110,
  startAngle: -200,
  sweepAngle: 120,
}

const useFloatingActionButton = () => {
  const context = useContext(FloatingActionButtonContext)
  if (!context) {
    throw new Error("FloatingActionButton components must be used within a FloatingActionButton")
  }
  return context
}

// --- コンポーネント ---

/**
 * 展開状態を管理するルートコンポーネント。
 */
export const FloatingActionButton: React.FC<FloatingActionButtonProps> & {
  Trigger: React.FC<TriggerProps>
  ActionList: React.FC<ActionListProps>
  ActionItem: React.FC<ActionItemProps>
  Simple: React.FC<SimplifiedFloatingActionButtonProps & { className?: string }>
} = ({
  children,
  initialExpanded = false,
  total = DEFAULT_CONFIG.total,
  distance = DEFAULT_CONFIG.distance,
  startAngle = DEFAULT_CONFIG.startAngle,
  sweepAngle = DEFAULT_CONFIG.sweepAngle,
}) => {
  const [isExpanded, setIsExpanded] = useState(initialExpanded)
  const [flickIndex, setFlickIndex] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const toggle = () => setIsExpanded((prev) => !prev)

  const config = useMemo(() => ({ total, distance, startAngle, sweepAngle }), [total, distance, startAngle, sweepAngle])

  const value = useMemo(
    () => ({ isExpanded, setIsExpanded, toggle, flickIndex, setFlickIndex, isDragging, setIsDragging, config }),
    [isExpanded, flickIndex, isDragging, config],
  )

  return <FloatingActionButtonContext.Provider value={value}>{children}</FloatingActionButtonContext.Provider>
}

/**
 * Render Propsを使用して展開状態を切り替えるトリガーコンポーネント。
 * また、上級ユーザー向けのフリックジェスチャーを処理します。
 */
const Trigger: React.FC<TriggerProps> = ({ children, items }) => {
  const { isExpanded, toggle, flickIndex, setFlickIndex, isDragging, setIsDragging, setIsExpanded, config } =
    useFloatingActionButton()

  const [startPos, setStartPos] = useState({ x: 0, y: 0 })

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    setStartPos({ x: touch.clientX, y: touch.clientY })
    setFlickIndex(null)
    setIsDragging(true)
    // 注意: クリックとフリックの区別を可能にするため、ここで即座にisExpandedを設定しない
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!setIsExpanded || !config) return
    const touch = e.touches[0]
    const dx = touch.clientX - startPos.x
    const dy = touch.clientY - startPos.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    // マイクロジッターを無視するのに十分な閾値
    if (dist > 50) {
      if (!isExpanded) setIsExpanded(true)
      // 角度を度数で計算
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI
      const { total, startAngle, sweepAngle } = config
      if (total === 0) return
      const step = total > 1 ? sweepAngle / (total - 1) : 0
      let normalizedAngle = angle
      if (normalizedAngle > 0 && startAngle < 0) {
        normalizedAngle -= 360
      }
      let closestIndex = -1
      let minDiff = Infinity
      for (let i = 0; i < total; i++) {
        const itemAngle = startAngle + i * step
        const diff = Math.abs(normalizedAngle - itemAngle)
        if (diff < minDiff) {
          minDiff = diff
          closestIndex = i
        }
      }
      // 選択が意図的であることを確実にするために角度許容範囲を狭くする（30度）
      if (minDiff < 30) {
        setFlickIndex(closestIndex)
      } else {
        setFlickIndex(null)
      }
    } else {
      setFlickIndex(null)
    }
  }

  const handleTouchEnd = () => {
    if (flickIndex !== null && items) {
      const itemId = items[flickIndex]?.id
      if (itemId !== undefined) {
        // indexではなくidを使用することで、複数のFABが同じページに存在しても、意図したFABのアクションのみを実行できる
        const event = new CustomEvent("fab-flick-execute", { detail: { id: itemId } })
        window.dispatchEvent(event)
        setIsExpanded(false)
      }
    }
    setIsDragging(false)
    setFlickIndex(null)
  }

  return (
    <div
      className="relative z-10 transition-transform duration-500 active:scale-90"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {children({ isExpanded, toggle, isDragging, flickIndex, items })}
    </div>
  )
}

/**
 * アクションアイテムのコンテナコンポーネント。
 */
const ActionList: React.FC<ActionListProps> = ({ children, className = "" }) => {
  const { isExpanded, isDragging } = useFloatingActionButton()
  const showOverlay = isExpanded || isDragging
  return (
    <>
      <div
        className={`fixed inset-0 z-0 transition-all duration-700 ${
          showOverlay
            ? "pointer-events-auto bg-black/10 backdrop-blur-[2px]"
            : "pointer-events-none bg-transparent opacity-0"
        }`}
      />
      <div className={className}>{children}</div>
    </>
  )
}

/**
 * 個別のアクションアイテム。位置を計算します。
 */
const ActionItem: React.FC<ActionItemProps> = ({ index = 0, children }) => {
  const { isExpanded, flickIndex, isDragging, config, setIsExpanded } = useFloatingActionButton()
  const { total, distance, startAngle, sweepAngle } = config
  const isFlicked = flickIndex === index
  const { x, y } = useMemo(() => {
    const angleRad =
      (startAngle * Math.PI) / 180 + (total > 1 ? index / (total - 1) : 0) * (2 * Math.PI * (sweepAngle / 360))
    return {
      x: distance * Math.cos(angleRad),
      y: distance * Math.sin(angleRad),
    }
  }, [index, total, distance, startAngle, sweepAngle])

  // スプリング動作のイージング
  const springEasing = "cubic-bezier(0.34, 1.56, 0.64, 1)"
  const visible = isExpanded || isDragging
  return (
    <div
      style={{
        position: "absolute",
        top: "calc(50%)",
        left: "calc(50%)",
        opacity: visible ? 1 : 0,
        scale: isFlicked ? "1.3" : visible ? "1" : "0.5",
        transform: visible
          ? `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`
          : "translate(calc(-50%), calc(-50%))",
        transition: `all 0.4s ${springEasing}`,
        transitionDelay: visible && !isFlicked ? `${index * 40}ms` : "0ms",
        pointerEvents: visible ? "auto" : "none",
        zIndex: isFlicked ? 20 : 10,
      }}
    >
      {children({ x, y, isExpanded: visible, setIsExpanded })}
    </div>
  )
}

/**
 * 一般的なユースケースのための簡略化されたラッパー。
 * 呼び出し側からレイアウトの複雑さを隠蔽します。
 */
const Simple: React.FC<SimplifiedFloatingActionButtonProps & { className?: string }> = ({
  items,
  triggerIcon,
  className,
  position = { right: "8%", bottom: "12%" },
}) => {
  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => {
    setIsMounted(true)
  }, [])

  const defaultIcon = (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )

  // フリック選択をリッスン
  useEffect(() => {
    const handleFlickExecute = (e: Event) => {
      const customEvent = e as CustomEvent<{ id: string | number }>
      const id = customEvent.detail.id
      // idでアイテムを特定することで、複数のFABが同じページに存在しても正しいアクションを実行できる
      const item = items.find((item) => item.id === id)
      if (item && !item.disabled) {
        item.onClick()
      }
    }
    window.addEventListener("fab-flick-execute", handleFlickExecute)
    return () => window.removeEventListener("fab-flick-execute", handleFlickExecute)
  }, [items])

  // ハイドレーションが完了するまで非表示
  if (!isMounted) return null
  return (
    <FloatingActionButton total={items.length} distance={110}>
      <div
        className={`pointer-events-auto absolute ${className || ""}`}
        style={{
          right: position.right,
          bottom: position.bottom,
          top: position.top,
          left: position.left,
        }}
      >
        {/* itemsを渡すことでTriggerがidベースのイベントを発火できるようにする */}
        <Trigger items={items}>
          {({ isExpanded, toggle, isDragging, flickIndex }) => (
            <button
              onClick={toggle}
              className={`relative flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-blue-500 to-indigo-600 text-white shadow-[0_8px_32px_rgba(37,99,235,0.4)] transition-all duration-500 hover:scale-105 hover:shadow-[0_12px_48px_rgba(37,99,235,0.6)] active:scale-95 ${
                isDragging ? "scale-110 shadow-[0_12px_48px_rgba(37,99,235,0.6)]" : ""
              }`}
            >
              <div
                className={`transition-transform duration-500 ${isExpanded || isDragging ? "rotate-135" : "rotate-0"}`}
              >
                {triggerIcon || defaultIcon}
              </div>
              {/* フリック方向の視覚ガイド */}
              {isDragging && flickIndex === null && (
                <div className="absolute inset-0 animate-ping rounded-full bg-white/20" />
              )}
              <div className="pointer-events-none absolute inset-0 rounded-full bg-linear-to-tr from-white/20 to-transparent" />
            </button>
          )}
        </Trigger>

        <ActionList className="absolute top-8 left-8">
          {items.map((item, index) => (
            <ActionItem key={item.id} index={index}>
              {({ setIsExpanded }) => (
                <button
                  onClick={() => {
                    setIsExpanded(false)
                    item.onClick()
                  }}
                  disabled={item.disabled}
                  className={`group flex h-13 w-13 items-center justify-center rounded-full border border-white/40 bg-white/80 text-slate-700 shadow-xl backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:scale-110 hover:bg-blue-500 hover:text-white disabled:opacity-30 disabled:grayscale`}
                >
                  {item.icon ? item.icon : <span className="text-xs font-bold">{item.label}</span>}
                </button>
              )}
            </ActionItem>
          ))}
        </ActionList>
      </div>
    </FloatingActionButton>
  )
}

FloatingActionButton.Trigger = Trigger
FloatingActionButton.ActionList = ActionList
FloatingActionButton.ActionItem = ActionItem
FloatingActionButton.Simple = Simple

export default FloatingActionButton
