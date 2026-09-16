import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import Button from "../components/ui/Button";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import EmptyState from "../components/ui/EmptyState";
import InlineNotice from "../components/ui/InlineNotice";
import Modal from "../components/ui/Modal";
import PageHeader from "../components/ui/PageHeader";
import SectionCard from "../components/ui/SectionCard";
import "../styles/organization.css";

const EMPTY_FORM = { name: "", description: "" };

/** Workspace list and organization settings are intentionally kept together. */
export default function Organizations() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadOrganizations = async () => {
    try {
      setError("");
      const response = await api.organizations();
      setItems(Array.isArray(response.data) ? response.data : []);
    } catch (requestError) {
      setError(requestError.message || "Unable to load organizations.");
    }
  };

  useEffect(() => {
    loadOrganizations();
  }, []);

  const createOrganization = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      await api.createOrganization({
        name: form.name.trim(),
        description: form.description.trim(),
      });
      setForm(EMPTY_FORM);
      await loadOrganizations();
    } catch (requestError) {
      setError(requestError.message || "Unable to create organization.");
    } finally {
      setBusy(false);
    }
  };

  const updateOrganization = async (event) => {
    event.preventDefault();
    if (!editing) return;

    setBusy(true);
    setError("");
    try {
      await api.updateOrganization(editing.id, {
        name: editing.name.trim(),
        description: editing.description.trim(),
      });
      setEditing(null);
      await loadOrganizations();
    } catch (requestError) {
      setError(requestError.message || "Unable to save organization changes.");
    } finally {
      setBusy(false);
    }
  };

  const deleteOrganization = async () => {
    if (!deleteTarget) return;

    setBusy(true);
    setError("");
    try {
      await api.deleteOrganization(deleteTarget.id);
      setDeleteTarget(null);
      await loadOrganizations();
    } catch (requestError) {
      setError(requestError.message || "Unable to delete organization.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="page">
      <PageHeader
        eyebrow="Workspace"
        title="Organizations"
        description="Choose a workspace to manage its projects, people, and work."
      />

      {error && <InlineNotice>{error}</InlineNotice>}

      <SectionCard className="ui-split-card">
        <div>
          <p className="eyebrow">New workspace</p>
          <h2>Create an organization</h2>
          <p className="muted">You will become its administrator and can invite your team.</p>
        </div>
        <form className="ui-form-row" onSubmit={createOrganization}>
          <label className="ui-field">
            Name
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Acme Studio" required />
          </label>
          <label className="ui-field">
            Description <span className="sr-only">(optional)</span>
            <input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What does this team work on?" />
          </label>
          <Button type="submit" loading={busy}>Create organization</Button>
        </form>
      </SectionCard>

      {items.length ? (
        <div className="ui-entity-grid">
          {items.map((organization) => {
            const isAdmin = organization.my_role === "admin";
            return (
              <SectionCard className="ui-entity-card" key={organization.id} as="article">
                <Link className="ui-entity-card__main" to={`/organizations/${organization.id}`} aria-label={`Open ${organization.name}`}>
                  <span className="ui-entity-card__icon">{organization.name?.[0]?.toUpperCase() || "O"}</span>
                  <div className="ui-entity-card__body">
                    <div className="ui-entity-card__label">{isAdmin ? "Administrator" : "Member"}</div>
                    <h2>{organization.name}</h2>
                    <p>{organization.description || "No description yet."}</p>
                    <div className="ui-entity-card__meta">
                      <span>{organization.member_count ?? 0} members</span>
                      <span>{organization.admin_count ?? 0} admins</span>
                    </div>
                  </div>
                </Link>
                {isAdmin && (
                  <div className="ui-entity-card__actions">
                    <Button variant="secondary" onClick={() => setEditing({ ...organization })} disabled={busy}>Edit</Button>
                    <Button variant="danger" onClick={() => setDeleteTarget(organization)} disabled={busy}>Delete</Button>
                  </div>
                )}
              </SectionCard>
            );
          })}
        </div>
      ) : (
        <EmptyState icon="⌂" title="Create your first organization" description="Organizations give your projects and teammates a shared home." />
      )}

      <Modal
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit organization"
        closeDisabled={busy}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={busy}>Cancel</Button>
            <Button type="submit" form="edit-organization-form" loading={busy}>Save changes</Button>
          </>
        )}
      >
        <form id="edit-organization-form" className="stack-form" onSubmit={updateOrganization}>
          <label className="ui-field">
            Organization name
            <input value={editing?.name || ""} onChange={(event) => setEditing({ ...editing, name: event.target.value })} required />
          </label>
          <label className="ui-field">
            Description
            <textarea rows="4" value={editing?.description || ""} onChange={(event) => setEditing({ ...editing, description: event.target.value })} placeholder="Tell teammates what this workspace is for." />
          </label>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteOrganization}
        busy={busy}
        title="Delete organization?"
        description={`Delete ${deleteTarget?.name || "this organization"}? This action cannot be undone.`}
        confirmLabel="Delete organization"
      />
    </section>
  );
}
