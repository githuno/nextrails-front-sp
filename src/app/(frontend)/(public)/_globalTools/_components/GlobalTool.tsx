import React from "react"

/**
 * Tool Component (Compound Component Pattern)
 * 再利用可能なモーダル/ツール用ヘッドレスUI
 */

type ToolProps = React.HTMLAttributes<HTMLDivElement>

const ToolRoot = ({ children, className, ...props }: ToolProps) => (
  <div className={`bg-black text-white ${className || ""}`} {...props}>
    {children}
  </div>
)

const ToolMain = ({ children, className, ...props }: ToolProps) => (
  <div className={`flex max-h-[70vh] justify-center ${className || ""}`} {...props}>
    {children}
  </div>
)

const ToolController = ({ children, className, ...props }: ToolProps) => (
  <div
    className={`fixed bottom-[5%] left-0 w-full border-t border-white/10 bg-zinc-900/10 p-4 shadow-xl backdrop-blur-xs ${className || ""}`}
    {...props}
  >
    {children}
  </div>
)

const ToolShowcase = ({ children, className, ...props }: ToolProps) => (
  <div
    className={`fixed top-1 left-0 w-full border-white/10 bg-zinc-900/30 p-2 shadow-xl backdrop-blur-xs ${className || ""}`}
    {...props}
  >
    {children}
  </div>
)

// コンパウンドコンポーネントとしてエクスポート
export const Tool = Object.assign(ToolRoot, {
  Showcase: ToolShowcase,
  Main: ToolMain,
  Controller: ToolController,
})
