import { useEffect, useState } from "react";
import { api } from "../services/api";
import SelectField from "../components/ui/SelectField";
// .empty-state styling lives here (Projects.jsx relies on the
// same class without importing it, so this page imports it
// explicitly to make sure the empty states are actually styled).
import "../styles/project-detail.css";

export default function KnowledgeSearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  // =====================================================
  // ORGANIZATION / PROJECT CONTEXT
  // =====================================================
  //
  // The existing frontend has no global "current organization"
  // concept (AuthContext only tracks the logged-in user), so
  // knowledge search lets the user pick from the organizations
  // they actually belong to instead of hardcoding an ID.

  const [orgs, setOrgs] = useState([]);
  const [organizationId, setOrganizationId] = useState("");

  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");

  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    api
      .organizations()
      .then((response) => {
        const list = Array.isArray(response.data) ? response.data : [];
        setOrgs(list);

        if (list.length) {
          setOrganizationId(String(list[0].id));
        }
      })
      .catch((e) => {
        setLoadError(e.message || "Unable to load organizations.");
      });
  }, []);

  useEffect(() => {
    setProjectId("");
    setProjects([]);

    if (!organizationId) return;

    api
      .projects(organizationId)
      .then((response) => {
        setProjects(Array.isArray(response.data) ? response.data : []);
      })
      .catch(() => {
        // Project list is optional filtering; a failure here
        // shouldn't block knowledge search itself.
        setProjects([]);
      });
  }, [organizationId]);

  // =====================================================
  // SEARCH
  // =====================================================

  const handleSearch = async (e) => {
    e.preventDefault();

    if (!query.trim()) {
      setError("Please enter a search query.");
      return;
    }

    if (!organizationId) {
      setError("Select an organization to search.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setResults([]);
      setSearched(true);

      const data = await api.searchKnowledge({
        query: query.trim(),
        organizationId: Number(organizationId),
        projectId: projectId ? Number(projectId) : null,
      });

      setResults(data.results || []);
    } catch (err) {
      console.error("Knowledge search error:", err);
      setError(err.message || "Search failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">AI knowledge base</p>
          <h1>Knowledge Search</h1>
          <p className="muted">
            Search organizations, projects, and tasks using semantic search.
          </p>
        </div>
      </div>

      {(error || loadError) && (
        <div className="error-box">{error || loadError}</div>
      )}

      <div className="section-card">
        <form className="inline-form project-form" onSubmit={handleSearch}>
          <SelectField
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            placeholder="Organization"
            aria-label="Organization"
            options={orgs.map((o) => ({ value: o.id, label: o.name }))}
          />

          <SelectField
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={!organizationId || !projects.length}
            placeholder="All projects"
            aria-label="Project"
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
          />

          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search e.g. web app project"
          />

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </button>
        </form>
      </div>

      {!loading && searched && !error && results.length === 0 && (
        <div className="empty-state">
          <h2>No results</h2>
          <p>Try a different search term.</p>
        </div>
      )}

      {!searched && !error && (
        <div className="empty-state">
          <h2>Enter a query to search the knowledge base</h2>
          <p>Results are ranked by semantic similarity to your search.</p>
        </div>
      )}

      {results.length > 0 && (
        <div>
          <div className="section-header">
            <h2>Results</h2>
            <span className="count-badge">{results.length}</span>
          </div>

          <div className="card-grid">
            {results.map((item) => (
              <div className="section-card" key={item.id}>
                <div className="card-meta">
                  <span className="status-chip">{item.source_type}</span>
                  <span>
                    Similarity: {Number(item.similarity || 0).toFixed(3)}
                  </span>
                </div>

                <p className="muted" style={{ margin: "10px 0 0" }}>
                  Source ID: {item.source_id}
                </p>

                <p style={{ whiteSpace: "pre-wrap", marginTop: "10px" }}>
                  {item.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}