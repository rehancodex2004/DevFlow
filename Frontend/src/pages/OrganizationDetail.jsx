import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../services/api";
import Button from "../components/ui/Button";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import EmptyState from "../components/ui/EmptyState";
import InlineNotice from "../components/ui/InlineNotice";
import Modal from "../components/ui/Modal";
import SectionCard from "../components/ui/SectionCard";
import "../styles/organization.css";

/** Manages an organization and shows its members and projects in one place. */
export default function OrganizationDetail() {
  const { id } = useParams();
  const [organization, setOrganization] = useState(null);
  const [members, setMembers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [memberForm, setMemberForm] = useState({ email: "", role: "member" });
  const [settingsForm, setSettingsForm] = useState({
    name: "",
    description: "",
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Fetch related records together so counts and permissions describe one snapshot.
  const loadOrganization = async () => {
    try {
      setError("");
      const [organizationResponse, membersResponse, projectsResponse] =
        await Promise.all([
          api.getOrganization(id),
          api.members(id),
          api.projects(id),
        ]);
      const nextOrganization =
        organizationResponse.data || organizationResponse;
      setOrganization(nextOrganization);
      setSettingsForm({
        name: nextOrganization.name || "",
        description: nextOrganization.description || "",
      });
      setMembers(membersResponse.data || []);
      setProjects(projectsResponse.data || []);
    } catch (requestError) {
      setError(requestError.message || "Unable to load organization.");
    }
  };

  useEffect(() => {
    loadOrganization();
  }, [id]);

  const saveOrganization = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.updateOrganization(id, {
        name: settingsForm.name.trim(),
        description: settingsForm.description.trim(),
      });
      await loadOrganization();
      setSettingsOpen(false);
    } catch (requestError) {
      setError(requestError.message || "Unable to save organization changes.");
    } finally {
      setBusy(false);
    }
  };

  const addMember = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.addMember(id, {
        email: memberForm.email.trim(),
        role: memberForm.role,
      });
      setMemberForm({ email: "", role: "member" });
      await loadOrganization();
    } catch (requestError) {
      setError(requestError.message || "Unable to add member.");
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async () => {
    if (!removeTarget) return;
    setBusy(true);
    setError("");
    try {
      await api.removeMember(id, removeTarget.user_id);
      setRemoveTarget(null);
      await loadOrganization();
    } catch (requestError) {
      setError(requestError.message || "Unable to remove member.");
    } finally {
      setBusy(false);
    }
  };

  if (!organization) {
    return (
      <section className="page">
        <EmptyState
          icon={error ? "!" : "…"}
          title={error ? "Organization unavailable" : "Loading organization"}
          description={error || "Gathering your workspace details."}
        />
      </section>
    );
  }

  const isAdmin = organization.my_role === "admin";

  return (
    <section className="page">
      <header className="ui-page-header">
        <div className="ui-page-header__content">
          <Link to="/organizations" className="back-link">
            ← Organizations
          </Link>
          <p className="eyebrow">Organization</p>
          <h1>{organization.name}</h1>
          <p className="muted">
            {organization.description || "Your organization workspace"}
          </p>
        </div>
        <span className="ui-badge">{isAdmin ? "Administrator" : "Member"}</span>
      </header>

      {error && <InlineNotice>{error}</InlineNotice>}

      <div className="project-summary">
        <div>
          <span>Members</span>
          <b>{members.length}</b>
        </div>
        <div>
          <span>Projects</span>
          <b>{projects.length}</b>
        </div>
        <div>
          <span>Your access</span>
          <b>{isAdmin ? "Admin" : "Member"}</b>
        </div>
      </div>

      {isAdmin && (
        <div className="two-col">
          <SectionCard>
            <p className="eyebrow">Settings</p>
            <h2>Organization details</h2>

            <div className="organization-details">
              <div className="organization-detail-item">
                <span className="organization-detail-label">Name</span>
                <strong>{organization.name}</strong>
              </div>

              <div className="organization-detail-item">
                <span className="organization-detail-label">Description</span>
                <p className="organization-detail-description">
                  {organization.description || "No description added yet."}
                </p>
              </div>
            </div>

            <Button variant="secondary" onClick={() => setSettingsOpen(true)}>
              Edit organization
            </Button>
          </SectionCard>
          <SectionCard>
            <p className="eyebrow">Admin action</p>
            <h2>Add a member</h2>
            <p className="muted">
              Invite a registered account by email, then choose their access
              level.
            </p>
            <form className="stack-form" onSubmit={addMember}>
              <label className="ui-field">
                Email address
                <input
                  type="email"
                  value={memberForm.email}
                  onChange={(event) =>
                    setMemberForm({ ...memberForm, email: event.target.value })
                  }
                  placeholder="person@example.com"
                  required
                />
              </label>
              <label className="ui-field">
                Role
                <select
                  value={memberForm.role}
                  onChange={(event) =>
                    setMemberForm({ ...memberForm, role: event.target.value })
                  }
                >
                  <option value="member">Member</option>
                  <option value="admin">Administrator</option>
                </select>
              </label>
              <Button type="submit" loading={busy}>
                Add member
              </Button>
            </form>
          </SectionCard>
        </div>
      )}

      <div className="two-col">
        <SectionCard>
          <div className="section-header">
            <div>
              <p className="eyebrow">People</p>
              <h2>Members</h2>
            </div>
            <span className="count-badge">{members.length}</span>
          </div>
          <div className="member-grid">
            {members.map((member) => (
              <div className="member-item" key={member.user_id}>
                <div className="avatar">
                  {member.name?.[0]?.toUpperCase() || "U"}
                </div>
                <div>
                  <b>{member.name}</b>
                  <p>{member.email}</p>
                </div>
                <span className="role-pill">{member.role}</span>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    className="organization-remove-member"
                    onClick={() => setRemoveTarget(member)}
                    disabled={busy}
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard>
          <div className="section-header">
            <div>
              <p className="eyebrow">Work</p>
              <h2>Projects</h2>
            </div>
            <span className="count-badge">{projects.length}</span>
          </div>
          {projects.length ? (
            <div className="compact-list">
              {projects.map((project) => (
                <Link
                  to={`/projects/${project.id}`}
                  className="list-row"
                  key={project.id}
                >
                  <div>
                    <b>{project.name}</b>
                    <span>{project.description || "No description"}</span>
                  </div>
                  <span>→</span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="◫"
              title="No projects yet"
              description="Projects created for this organization will appear here."
            />
          )}
        </SectionCard>
      </div>

      <Modal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Edit organization"
        closeDisabled={busy}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setSettingsOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="organization-settings-form"
              loading={busy}
            >
              Save changes
            </Button>
          </>
        }
      >
        <form
          id="organization-settings-form"
          className="stack-form"
          onSubmit={saveOrganization}
        >
          <label className="ui-field">
            Name
            <input
              value={settingsForm.name}
              onChange={(event) =>
                setSettingsForm({ ...settingsForm, name: event.target.value })
              }
              required
            />
          </label>
          <label className="ui-field">
            Description
            <textarea
              value={settingsForm.description}
              onChange={(event) =>
                setSettingsForm({
                  ...settingsForm,
                  description: event.target.value,
                })
              }
              placeholder="Describe your team or workspace."
            />
          </label>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        onConfirm={removeMember}
        busy={busy}
        title="Remove member"
        description={`Remove ${removeTarget?.name || "this member"} from the organization? This action can't be undone.`}
        confirmLabel="Remove member"
      />
    </section>
  );
}
