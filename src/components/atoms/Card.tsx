type CardProps = {
  title: string;
  children: React.ReactNode;
  renderHeader?: (title: string) => React.ReactNode;
  renderFooter?: () => React.ReactNode;
  className?: string;
};

const Card = ({
  title,
  children,
  renderHeader,
  renderFooter,
  className = "",
}: CardProps) => (
  <div className={`card ${className}`.trim()}>
    {renderHeader ? (
      renderHeader(title)
    ) : (
      <div className="card-header">{title}</div>
    )}

    <div className="card-content">{children}</div>

    {renderFooter && renderFooter()}
  </div>
);