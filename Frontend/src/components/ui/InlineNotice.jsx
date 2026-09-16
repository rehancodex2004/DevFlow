/** Communicates success or errors without forcing each page to recreate alert markup. */
export default function InlineNotice({ children, tone = "error", className = "" }) {
  return (
    <div className={`ui-notice ui-notice--${tone} ${className}`.trim()} role={tone === "error" ? "alert" : "status"}>
      <span aria-hidden="true">{tone === "error" ? "!" : "✓"}</span>
      <div>{children}</div>
    </div>
  );
}
