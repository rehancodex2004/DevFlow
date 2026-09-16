import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import Button from "../components/ui/Button";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import EmptyState from "../components/ui/EmptyState";
import InlineNotice from "../components/ui/InlineNotice";
import Modal from "../components/ui/Modal";
import PageHeader from "../components/ui/PageHeader";
import SelectField from "../components/ui/SelectField";
import SectionCard from "../components/ui/SectionCard";

const EMPTY_CREATE_FORM = { organizationId: "", name: "", description: "" };

/**
 * A single projects view for all organizations the user can access. Management
 * controls are derived from organization role rather than duplicated in cards.
 */
export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadWorkspace = async () => {
    try {
      setError("");
      const [projectsResponse, organizationsResponse] = await Promise.all([
        api.projects(),
        api.organizations(),
      ]);
      setProjects(Array.isArray(projectsResponse.data) ? projectsResponse.data : []);
      setOrganizations(Array.isArray(organizationsResponse.data) ? organizationsResponse.data : []);
    } catch (requestError) {
      setError(requestError.message || "Unable to load projects.");
    }
  };

  useEffect(() => {
    loadWorkspace();
  }, []);

  const adminOrganizations = useMemo(
    () => organizations.filter((organization) => organization.my_role === "admin"),
    [organizations],
  );

  const canManageProject = (project) => organizations.some(
    (organization) => Number(organization.id) === Number(project.organization_id)
      && organization.my_role === "admin",
  );

  const createProject = async (event) => {
    event.preventDefault();
    if (!createForm.organizationId) {
      setError("Select an organization first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.createProject({
        organizationId: Number(createForm.organizationId),
        name: createForm.name.trim(),
        description: createForm.description.trim(),
      });
      setCreateForm(EMPTY_CREATE_FORM);
      await loadWorkspace();
    } catch (requestError) {
      setError(requestError.message || "Unable to create project.");
    } finally {
      setBusy(false);
    }
  };

  const updateProject = async (event) => {
    event.preventDefault();
    if (!editing) return;

    setBusy(true);
    setError("");
    try {
      await api.updateProject(editing.id, {
        name: editing.name.trim(),
        description: editing.description.trim(),
      });
      setEditing(null);
      await loadWorkspace();
    } catch (requestError) {
      setError(requestError.message || "Unable to save project changes.");
    } finally {
      setBusy(false);
    }
  };

  const deleteProject = async () => {
    if (!deleteTarget) return;

    setBusy(true);
    setError("");
    try {
      await api.deleteProject(deleteTarget.id);
      setDeleteTarget(null);
      await loadWorkspace();
    } catch (requestError) {
      setError(requestError.message || "Unable to delete project.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="page">
      <PageHeader
        eyebrow="All accessible work"
        title="Projects"
        description="Keep each initiative focused, visible, and connected to the right organization."
      />

      {error && <InlineNotice>{error}</InlineNotice>}

      {adminOrganizations.length > 0 && (
        <SectionCard className="ui-split-card">
          <div>
            <p className="eyebrow">Admin action</p>
            <h2>Start a project</h2>
            <p className="muted">Create a home for a goal, then organize its work in one place.</p>
          </div>
          <form className="ui-form-row ui-form-row--project" onSubmit={createProject}>
            <label className="ui-field">
              Organization
              <SelectField
                value={createForm.organizationId}
                onChange={(event) => setCreateForm({ ...createForm, organizationId: event.target.value })}
                placeholder="Select organization"
                required
                aria-label="Organization"
                options={adminOrganizations.map((organization) => ({ value: organization.id, label: organization.name }))}
              />
            </label>
            <label className="ui-field">
              Project name
              <input value={createForm.name} onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })} placeholder="e.g. Website refresh" required />
            </label>
            <label className="ui-field">
              Description <span className="sr-only">(optional)</span>
              <input value={createForm.description} onChange={(event) => setCreateForm({ ...createForm, description: event.target.value })} placeholder="What will this project achieve?" />
            </label>
            <Button type="submit" loading={busy}>Create project</Button>
          </form>
        </SectionCard>
      )}

      {projects.length ? (
        <div className="ui-entity-grid">
          {projects.map((project) => {
            const canManage = canManageProject(project);
            return (
              <SectionCard className="ui-entity-card" key={project.id} as="article">
                <Link className="ui-entity-card__main" to={`/projects/${project.id}`} aria-label={`Open ${project.name}`}>
                  <span className="ui-entity-card__icon">P</span>
                  <div className="ui-entity-card__body">
                    <div className="ui-entity-card__label">{project.organization_name || "Organization"}</div>
                    <h2>{project.name}</h2>
                    <p>{project.description || "No description yet."}</p>
                    <div className="ui-entity-card__meta">
                      <span>{project.member_count ?? 0} members</span>
                      <span className={`ui-badge ${project.status === "active" ? "ui-badge--active" : ""}`}>{project.status || "Active"}</span>
                    </div>
                  </div>
                </Link>
                {canManage && (
                  <div className="ui-entity-card__actions">
                    <Button variant="secondary" onClick={() => setEditing({ ...project })} disabled={busy}>Edit</Button>
                    <Button variant="danger" onClick={() => setDeleteTarget(project)} disabled={busy}>Delete</Button>
                  </div>
                )}
              </SectionCard>
            );
          })}
        </div>
      ) : (
        <EmptyState icon="◫" title="No projects yet" description="Projects you create or join will appear here automatically." />
      )}

      <Modal
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit project"
        closeDisabled={busy}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={busy}>Cancel</Button>
            <Button type="submit" form="edit-project-form" loading={busy}>Save changes</Button>
          </>
        )}
      >
        <form id="edit-project-form" className="stack-form" onSubmit={updateProject}>
          <label className="ui-field">
            Project name
            <input value={editing?.name || ""} onChange={(event) => setEditing({ ...editing, name: event.target.value })} required />
          </label>
          <label className="ui-field">
            Description
            <textarea rows="4" value={editing?.description || ""} onChange={(event) => setEditing({ ...editing, description: event.target.value })} placeholder="Describe the purpose and outcome of this project." />
          </label>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteProject}
        busy={busy}
        title="Delete project?"
        description={`Delete ${deleteTarget?.name || "this project"}? This action cannot be undone.`}
        confirmLabel="Delete project"
      />
    </section>
  );
}
