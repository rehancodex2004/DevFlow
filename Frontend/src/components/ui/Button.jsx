/**
 * Shared action button. Keeping button states here gives create, save, and
 * destructive actions a consistent accessible loading treatment.
 */
export default function Button({
  children,
  className = "",
  variant = "primary",
  loading = false,
  disabled = false,
  type = "button",
  ...props
}) {
  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      type={type}
      className={`ui-button ui-button--${variant} ${className}`.trim()}
      disabled={isDisabled}
      aria-busy={loading || undefined}
    >
      {loading && <span className="ui-button__spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}
