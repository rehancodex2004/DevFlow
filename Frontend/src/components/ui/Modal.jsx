import { useEffect, useId, useRef } from "react";

/**
 * Shared dialog shell. It closes on Escape and on an intentional backdrop
 * click, while leaving page-specific forms in control of their own state.
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  closeDisabled = false,
  className = "",
}) {
  const dialogRef = useRef(null);
  const titleId = useId();

  const onCloseRef = useRef(onClose);
  const closeDisabledRef = useRef(closeDisabled);

  onCloseRef.current = onClose;
  closeDisabledRef.current = closeDisabled;

  useEffect(() => {
    if (!isOpen) return undefined;

    const previouslyFocused = document.activeElement;
    const dialog = dialogRef.current;
    const focusableSelector = [
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "button:not([disabled])",
  "[href]",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

    const focusFirstControl = () => {
      const focusable = dialog?.querySelectorAll(focusableSelector);
      (focusable?.[0] || dialog)?.focus();
    };

    // Keep keyboard users in the dialog and return them to the trigger on close.
    focusFirstControl();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !closeDisabledRef.current) {
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !dialog) return;

      const focusable = [...dialog.querySelectorAll(focusableSelector)];
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="ui-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !closeDisabled) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className={`ui-modal ${className}`.trim()}
        role="dialog"
        tabIndex="-1"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="ui-modal__header">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="ui-modal__close"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label={`Close ${title}`}
          >
            ×
          </button>
        </div>
        <div className="ui-modal__body">{children}</div>
        {footer && <div className="ui-modal__footer">{footer}</div>}
      </section>
    </div>
  );
}
