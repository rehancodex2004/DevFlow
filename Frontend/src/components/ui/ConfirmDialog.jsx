import Button from "./Button";
import Modal from "./Modal";

/** A shared confirmation pattern for irreversible workspace actions. */
export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm action",
  description,
  confirmLabel = "Confirm",
  tone = "danger",
  busy = false,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      closeDisabled={busy}
      className="ui-modal--confirm"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant={tone} onClick={onConfirm} loading={busy}>{confirmLabel}</Button>
        </>
      )}
    >
      <p className="ui-confirmation-copy">{description}</p>
    </Modal>
  );
}
