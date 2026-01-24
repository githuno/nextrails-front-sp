import React, { createContext, useCallback, useContext, useState } from "react"

/**
 * Tool Component (Compound Component Pattern with Context)
 * 2026 Accessibility & Semantic Refinement
 */

type ToolContextType = {
  isExpanded: boolean
  setIsExpanded: React.Dispatch<React.SetStateAction<boolean>>
  enableBackgroundTap: boolean
  onBackgroundTap?: () => void
}

const ToolContext = createContext<ToolContextType | undefined>(undefined)

type ToolProps = React.HTMLAttributes<HTMLDivElement> & {
  enableBackgroundTap?: boolean
  onBackgroundTap?: () => void
  defaultExpanded?: boolean
}

const ToolRoot = ({
  children,
  className,
  enableBackgroundTap = false,
  onBackgroundTap,
  defaultExpanded = false,
  ...props
}: ToolProps) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const value = {
    isExpanded,
    setIsExpanded,
    enableBackgroundTap,
    onBackgroundTap,
  }

  return (
    <ToolContext.Provider value={value}>
      <div className={`pointer-events-auto bg-black text-white ${className || ""}`} {...props}>
        {children}
      </div>
    </ToolContext.Provider>
  )
}

interface ToolMainProps extends React.HTMLAttributes<HTMLDivElement> {
  miniHeight?: string // e.g. "mt-[20svh] max-h-[75svh]"
  fullHeight?: string // e.g. "mt-[5svh] max-h-screen"
}

const ToolMain = ({
  children,
  className,
  miniHeight = "mt-[20svh] max-h-[75svh]",
  fullHeight = "mt-[5svh] max-h-screen",
  ...props
}: ToolMainProps) => {
  const context = useContext(ToolContext)
  const isExpanded = context?.isExpanded ?? false

  return (
    <div
      className={`${isExpanded ? fullHeight : miniHeight} flex justify-center transition-all duration-500 ease-in-out ${className || ""}`}
      {...props}
    >
      {children}
    </div>
  )
}

/**
 * アクセシブルな背景タップ領域用のラップ
 */
const BackgroundTapWrapper = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  const context = useContext(ToolContext)
  const isExpanded = context?.isExpanded ?? false
  const setIsExpanded = context?.setIsExpanded
  const enableBackgroundTap = context?.enableBackgroundTap ?? false
  const onBackgroundTap = context?.onBackgroundTap
  const handleToggle = useCallback(() => {
    if (enableBackgroundTap && setIsExpanded) {
      setIsExpanded(!isExpanded)
      onBackgroundTap?.()
    }
  }, [enableBackgroundTap, isExpanded, setIsExpanded, onBackgroundTap])
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      handleToggle()
    }
  }
  if (!context || !enableBackgroundTap)
    return (
      <div className={className} {...props}>
        {children}
      </div>
    )
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={isExpanded ? "Collapse tool" : "Expand tool"}
      aria-expanded={isExpanded}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      className={`outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${className || ""}`}
      {...props}
    >
      {children}
    </div>
  )
}

const ToolController = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  const context = useContext(ToolContext)
  const isExpanded = context?.isExpanded ?? false
  return (
    <BackgroundTapWrapper
      className={`fixed bottom-0 left-0 w-full border-t border-white/10 p-4 shadow-xl transition-opacity duration-300 ${
        isExpanded ? "bg-transparent" : "bg-zinc-900/10 backdrop-blur-xs"
      } ${className || ""}`}
      {...props}
    >
      {children}
    </BackgroundTapWrapper>
  )
}

const ToolShowcase = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  const context = useContext(ToolContext)
  const isExpanded = context?.isExpanded ?? false
  return (
    <BackgroundTapWrapper
      className={`fixed top-0 left-0 w-full border-white/10 bg-zinc-900/30 p-1 shadow-xl backdrop-blur-xs transition-all duration-300 ease-in-out ${
        isExpanded ? "h-8 cursor-pointer overflow-hidden" : "h-auto"
      } ${className || ""}`}
      {...props}
    >
      {isExpanded ? (
        <div className="flex h-full items-center justify-center">
          <div className="flex h-3.5 w-5 flex-col justify-around">
            <span className="block h-0.5 rounded bg-zinc-400"></span>
            <span className="block h-0.5 rounded bg-zinc-400"></span>
          </div>
        </div>
      ) : (
        children
      )}
    </BackgroundTapWrapper>
  )
}

// コンパウンドコンポーネントとしてエクスポート
export const Tool = Object.assign(ToolRoot, {
  Showcase: ToolShowcase,
  Main: ToolMain,
  Controller: ToolController,
})
