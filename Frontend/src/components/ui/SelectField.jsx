import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function SelectField({
  value,
  onChange,
  options,
  placeholder = "Select an option",
  disabled = false,
  required = false,
  "aria-label": ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState(null);

  const selectedOption = options.find((option) => String(option.value) === String(value));

  useLayoutEffect(() => {
    function updatePosition() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const left = rect.left + window.scrollX;

      // Estimate desired menu height (each option ~44px including padding)
      const optionHeight = 44;
      const estimatedHeight = Math.min(220, (options.length + (required && placeholder ? 1 : 0)) * optionHeight + 8);

      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      let top;
      let maxHeight = estimatedHeight;

      // If there's not enough space below and more space above, open upward
      if (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) {
        top = rect.top + window.scrollY - estimatedHeight - 6;
        if (spaceAbove < estimatedHeight) {
          // Limit menu to available space above
          maxHeight = Math.max(80, spaceAbove - 12);
          top = rect.top + window.scrollY - maxHeight - 6;
        }
      } else {
        // Open downward, but constrain height to available space below
        top = rect.bottom + window.scrollY + 6;
        if (spaceBelow < estimatedHeight) {
          maxHeight = Math.max(80, spaceBelow - 12);
        }
      }

      setMenuStyle({ left, top, width: rect.width, maxHeight });
    }

    if (open) {
      updatePosition();
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
    }

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, options.length, required, placeholder]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      const target = event.target;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };

    const handleKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  function selectOption(nextValue) {
    onChange({ target: { value: String(nextValue) } });
    setOpen(false);
  }

  function handleKeyDown(event) {
    if (disabled) return;
    if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
    }
    if (event.key === "Escape") setOpen(false);
  }

  const menu = (
    <div
      ref={menuRef}
      className="ui-select__menu"
      role="listbox"
      aria-label={ariaLabel}
      style={menuStyle ? { position: "absolute", left: `${menuStyle.left}px`, top: `${menuStyle.top}px`, width: `${menuStyle.width}px`, maxHeight: `${menuStyle.maxHeight}px`, overflowY: "auto", zIndex: 20000 } : { zIndex: 20000 }}
    >
      {required && placeholder && (
        <button type="button" className={`ui-select__option ${!value ? "is-selected" : ""}`} onClick={() => selectOption("")} role="option" aria-selected={!value}>
          {placeholder}
        </button>
      )}

      {options.map((option) => (
        <button
          type="button"
          className={`ui-select__option ${String(option.value) === String(value) ? "is-selected" : ""}`}
          key={option.value}
          onClick={() => selectOption(option.value)}
          role="option"
          aria-selected={String(option.value) === String(value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className={`ui-select ${open ? "is-open" : ""}`} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="ui-select__trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleKeyDown}
      >
        <span>{selectedOption?.label || placeholder}</span>
        <span className="ui-select__chevron" aria-hidden="true" />
      </button>

      {open && createPortal(menu, document.body)}
    </div>
  );
}
