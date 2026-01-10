import React, { useState } from "react"

/**
 * Tool Component (Compound Component Pattern)
 * 再利用可能なモーダル/ツール用ヘッドレスUI
 */

type CommonProps = {
  enableBackgroundTap?: boolean
  isMaximized?: boolean
  onBackgroundTap?: () => void
}

type ToolProps = React.HTMLAttributes<HTMLDivElement> & CommonProps

const ToolRoot = ({ children, className, enableBackgroundTap = false, onBackgroundTap, ...props }: ToolProps) => {
  const [isMaximized, setIsMaximized] = useState(false)
  const handleBackgroundTap = () => {
    if (enableBackgroundTap) {
      setIsMaximized(!isMaximized)
      onBackgroundTap?.()
    }
  }
  return (
    <div className={`bg-black text-white ${className || ""}`} {...props}>
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<CommonProps & React.HTMLAttributes<HTMLDivElement>>, {
              isMaximized,
              enableBackgroundTap,
              onBackgroundTap: handleBackgroundTap,
            })
          : child,
      )}
    </div>
  )
}

type ToolMainProps = React.HTMLAttributes<HTMLDivElement> & CommonProps

const ToolMain = ({ children, className, isMaximized = false, ...props }: ToolMainProps) => (
  <div
    className={`${isMaximized ? "max-h-screen" : "mt-[10svh] max-h-[75svh]"} flex justify-center ${className || ""}`}
    {...props}
  >
    {children}
  </div>
)

type ToolControllerProps = React.HTMLAttributes<HTMLDivElement> & CommonProps

const ToolController = ({
  children,
  className,
  enableBackgroundTap = false,
  isMaximized = false,
  onBackgroundTap,
  ...props
}: ToolControllerProps) => {
  const handleBackgroundClick = () => {
    if (enableBackgroundTap) {
      onBackgroundTap?.()
    }
  }
  return (
    <div
      className={`fixed bottom-[5%] left-0 w-full border-t border-white/10 p-4 shadow-xl transition-opacity duration-300 ${
        isMaximized ? "bg-transparent" : "bg-zinc-900/10 backdrop-blur-xs"
      } ${className || ""}`}
      onClick={handleBackgroundClick}
      {...props}
    >
      {children}
    </div>
  )
}

type ToolShowcaseProps = React.HTMLAttributes<HTMLDivElement> & CommonProps

const ToolShowcase = ({
  children,
  className,
  enableBackgroundTap = false,
  isMaximized = false,
  onBackgroundTap,
  ...props
}: ToolShowcaseProps) => {
  const handleBackgroundClick = () => {
    if (enableBackgroundTap) {
      onBackgroundTap?.()
    }
  }
  return (
    <div
      className={`fixed top-1 left-0 w-full border-white/10 bg-zinc-900/30 p-2 shadow-xl backdrop-blur-xs transition-all duration-300 ease-in-out ${
        isMaximized ? "h-8 cursor-pointer overflow-hidden" : "h-auto"
      } ${className || ""}`}
      onClick={handleBackgroundClick}
      {...props}
    >
      {isMaximized ? (
        <div className="flex h-full items-center justify-center">
          <div className="text-xs text-zinc-400">▼ Tap to expand</div>
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
