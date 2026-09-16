/** A predictable heading block used across workspace-level pages. */
export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
  className = "",
}) {
  return (
    <header className={`ui-page-header ${className}`.trim()}>
      <div className="ui-page-header__content">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
        {children}
      </div>
      {actions && <div className="ui-page-header__actions">{actions}</div>}
    </header>
  );
}
