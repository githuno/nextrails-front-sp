// 参考：https://zenn.dev/kiyoshiro9446/scraps/46b4e4be23bcde
// asChild：https://blog.seitaro.work/p/aschild-pattern/

import { cloneElement, forwardRef, isValidElement } from "react"
import styles from "./style.module.css"

// HTML要素の制約を定義
type ValidElements = HTMLAnchorElement | HTMLButtonElement | HTMLInputElement
type ValidElementTags = "a" | "button" | "input"

// 基本的なプロパティの定義
type ButtonBaseProps = {
  variant?: "primary" | "secondary"
  disabled?: boolean
  leftIcon?: React.ReactElement
  rightIcon?: React.ReactElement
}

// asChild使用時のプロパティ
type ButtonAsChildProps<T extends ValidElementTags> = ButtonBaseProps & {
  asChild: true
  children: React.ReactElement<React.ComponentProps<T> & { className?: string }>
}

// 通常のボタンプロパティ
type ButtonDefaultProps = ButtonBaseProps & {
  asChild?: false
} & React.ComponentPropsWithRef<"button">

export type ButtonProps<T extends ValidElementTags = ValidElementTags> = ButtonAsChildProps<T> | ButtonDefaultProps

/**
 * 柔軟なボタンコンポーネント
 * @description HTMLの仕様に準拠し、型安全な実装を提供します
 * @example
 * // 標準的な使用方法
 * <Button variant="primary">ボタン</Button>
 *
 * // リンクとして使用（asChildが必須）
 * <Button asChild variant="primary">
 *   <a href="/">リンク</a>
 * </Button>
 *
 * // input要素として使用（asChildが必須）
 * <Button asChild variant="primary">
 *   <input type="submit" value="送信" />
 * </Button>
 */
const Button = forwardRef(function Button<T extends ValidElementTags>(
  { variant = "primary", disabled, leftIcon, rightIcon, asChild = false, children, ...buttonProps }: ButtonProps<T>,
  ref: React.Ref<ValidElements>,
) {
  const shouldActAsChild = asChild && isValidElement(children)

  // HTML仕様違反のチェック
  if (!shouldActAsChild && isValidElement(children) && ["a", "button", "input"].includes(children.type as string)) {
    console.warn(
      `Warning: Detected potential HTML specification violation. ` +
        `When using <${children.type}> inside Button, you must use the asChild prop.`,
    )
  }

  return cloneElement(
    shouldActAsChild ? (
      disabled ? (
        <div aria-disabled="true" role="button" />
      ) : (
        children
      )
    ) : (
      <button ref={ref as React.Ref<HTMLButtonElement>} type="button" disabled={disabled} {...buttonProps} />
    ),
    {
      "data-variant": variant,
      className: combineClassNames(
        styles.button,
        shouldActAsChild ? (children as React.ReactElement<{ className?: string }>).props.className : undefined,
        "className" in buttonProps ? buttonProps.className : undefined,
      ),
    },
    leftIcon ? <span className={styles.leftIcon}>{leftIcon}</span> : null,
    shouldActAsChild ? (children as React.ReactElement<{ children?: React.ReactNode }>).props.children : children,
    rightIcon ? <span className={styles.rightIcon}>{rightIcon}</span> : null,
  )
}) as <T extends ValidElementTags>(props: ButtonProps<T> & { ref?: React.Ref<ValidElements> }) => React.ReactElement

export default Button

const combineClassNames = (...classes: (string | undefined)[]) => {
  return classes.filter(Boolean).join(" ")
}
