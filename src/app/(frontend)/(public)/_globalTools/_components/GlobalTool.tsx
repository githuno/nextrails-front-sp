import React, { createContext, useContext, useState } from "react"

/**
 * Tool Component (Compound Component Pattern with Context)
 * 再利用可能なモーダル/ツール用ヘッドレスUI
 * Contextを使用することでDOM要素への不正な属性漏洩を防ぐ
 */

type ToolContextType = {
  isMaximized: boolean
  setIsMaximized: React.Dispatch<React.SetStateAction<boolean>>
  enableBackgroundTap: boolean
  onBackgroundTap?: () => void
}

const ToolContext = createContext<ToolContextType | undefined>(undefined)

type ToolProps = React.HTMLAttributes<HTMLDivElement> & {
  enableBackgroundTap?: boolean
  onBackgroundTap?: () => void
}

const ToolRoot = ({ children, className, enableBackgroundTap = false, onBackgroundTap, ...props }: ToolProps) => {
  const [isMaximized, setIsMaximized] = useState(false)

  const value = {
    isMaximized,
    setIsMaximized,
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

const ToolMain = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  const context = useContext(ToolContext)
  const isMaximized = context?.isMaximized ?? false

  return (
    <div
      className={`${isMaximized ? "mt-[5svh] max-h-screen" : "mt-[20svh] max-h-[75svh]"} flex justify-center ${className || ""}`}
      {...props}
    >
      {children}
    </div>
  )
}

const ToolController = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  const context = useContext(ToolContext)
  if (!context) return null
  const { isMaximized, setIsMaximized, enableBackgroundTap, onBackgroundTap } = context
  const handleBackgroundClick = () => {
    if (enableBackgroundTap) {
      setIsMaximized(!isMaximized)
      onBackgroundTap?.()
    }
  }
  return (
    <div
      className={`fixed bottom-0 left-0 w-full border-t border-white/10 p-4 shadow-xl transition-opacity duration-300 ${
        isMaximized ? "bg-transparent" : "bg-zinc-900/10 backdrop-blur-xs"
      } ${className || ""}`}
      onClick={handleBackgroundClick}
      {...props}
    >
      {children}
    </div>
  )
}

const ToolShowcase = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  const context = useContext(ToolContext)
  if (!context) return null
  const { isMaximized, setIsMaximized, enableBackgroundTap, onBackgroundTap } = context
  const handleBackgroundClick = () => {
    if (enableBackgroundTap) {
      setIsMaximized(!isMaximized)
      onBackgroundTap?.()
    }
  }
  return (
    <div
      className={`fixed top-0 left-0 w-full border-white/10 bg-zinc-900/30 p-2 shadow-xl backdrop-blur-xs transition-all duration-300 ease-in-out ${
        isMaximized ? "h-8 cursor-pointer overflow-hidden" : "h-auto"
      } ${className || ""}`}
      onClick={handleBackgroundClick}
      {...props}
    >
      {isMaximized ? (
        <div className="flex h-full items-center justify-center">
          <div className="flex h-3.5 w-5 flex-col justify-around">
            <span className="block h-0.5 rounded bg-zinc-400"></span>
            <span className="block h-0.5 rounded bg-zinc-400"></span>
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  )
}

// コンパウンドコンポーネントとしてエクスポート
export const Tool = Object.assign(ToolRoot, {
  Showcase: ToolShowcase,
  Main: ToolMain,
  Controller: ToolController,
})
