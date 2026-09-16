/** Friendly zero-state that explains what the user can do next. */
export default function EmptyState({
  title,
  description,
  action,
  icon = "○",
  className = "",
}) {
  return (
    <div className={`ui-empty-state ${className}`.trim()}>
      <span className="ui-empty-state__icon" aria-hidden="true">{icon}</span>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action && <div className="ui-empty-state__action">{action}</div>}
    </div>
  );
}
