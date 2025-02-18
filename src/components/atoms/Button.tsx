import React from 'react';

interface ButtonBaseProps {
  label?: string;
  onClick: () => void;
  className?: string;
  children?: React.ReactNode;
}

const ButtonBase = ({
  label,
  onClick,
  className = "",
  children,
}: ButtonBaseProps) => (
  // trim()は文字列の両端の空白を削除するメソッド
  <button className={`button ${className}`.trim()} onClick={onClick}>
    {children || label}
  </button>
);

const PrimaryButton = (props: ButtonBaseProps) => (
  <ButtonBase {...props} className="button-primary" />
);

const SecondaryButton = (props: ButtonBaseProps) => (
  <ButtonBase {...props} className="button-secondary" />
);

const DangerButton = (props: ButtonBaseProps) => (
  <ButtonBase {...props} className="button-danger" />
);

const OutlineButton = (props: ButtonBaseProps) => (
  <ButtonBase {...props} className="button-outline" />
);

type ButtonProps = ButtonBaseProps & {
  Icon?: React.ElementType;
  RenderPrefix?: () => React.ReactNode;
  RenderSuffix?: () => React.ReactNode;
};

const Button = ({
  label,
  Icon,
  RenderPrefix,
  RenderSuffix,
  ...props
}: ButtonProps) => (
  <ButtonBase {...props}>
    {/* ?.()はオプショナルチェーン演算子で、存在する場合にのみそのプロパティやメソッドにアクセスする */}
    {RenderPrefix?.()}
    {Icon && <Icon />}
    {label}
    {RenderSuffix?.()}
  </ButtonBase>
);

export { PrimaryButton, SecondaryButton, DangerButton, OutlineButton, Button };