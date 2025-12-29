import React from "react"

interface TooltipProps {
  tip: string
  children: React.ReactNode
  className?: string
}

// 記事：https://www.notion.so/JavaScript-HTML-CSS-Stop-Reaching-for-JavaScript-Modern-HTML-CSS-28b565e97d7c81de8ca1cdc63498bd21

/**
 * CSS-only Tooltip using Tailwind. No JS needed — the component
 * renders a single wrapper element with `data-tip="..."`.
 * Tailwind's arbitrary variants are used to style the ::after pseudo-element.
 *
 * Note: Tailwind must allow arbitrary variants in your config for
 * the `after:` and `group-hover:after:` style utilities to work.
 *
 * @example
 * <Tooltip tip="Copies the link">
 *   <button>Copy</button>
 * </Tooltip>
 */
export const Tooltip: React.FC<TooltipProps> = ({ tip, children, className }) => {
  // Render a single element; tooltip text is provided via data-tip and
  // shown using the element's ::after pseudo-element in Tailwind.
  return (
    <div
      // `group` enables group-hover/focus-visible targeting for child pseudo
      // elements. We attach the tip text to data-tip so the CSS content can
      // read it with `content: attr(data-tip)`.
      className={`group relative ${className || ""} [&::after]:inset-block-end-[calc(100%_+_8px)] [&::after]:pointer-events-none [&::after]:absolute [&::after]:left-1/2 [&::after]:-translate-x-1/2 [&::after]:translate-y-0 [&::after]:transform [&::after]:rounded-[0.4rem] [&::after]:bg-[rgba(0,0,0,0.85)] [&::after]:px-[0.35em] [&::after]:py-[0.55em] [&::after]:text-[0.85rem] [&::after]:whitespace-nowrap [&::after]:text-white [&::after]:opacity-0 [&::after]:transition-[opacity_0.15s,transform_0.15s] [&::after]:content-[attr(data-tip)] group-hover:[&::after]:-translate-y-[2px] group-hover:[&::after]:opacity-100 group-focus-visible:[&::after]:-translate-y-[2px] group-focus-visible:[&::after]:opacity-100`}
      data-tip={tip}
    >
      {children}
      {/*
        The visual tooltip is implemented with the ::after pseudo-element.
        Tailwind classes below use arbitrary variants for the after selector.
      */}
      <span className="sr-only">{tip}</span>
    </div>
  )
}
