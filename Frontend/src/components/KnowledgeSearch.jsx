import React, { useState } from "react";
import { searchKnowledge } from "../services/api";

const KnowledgeSearch = ({ organizationId, projectId = null }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async (e) => {
    e.preventDefault();

    if (!query.trim()) {
      return;
    }

    try {
      setLoading(true);
      setError("");

      const data = await searchKnowledge({
        query: query.trim(),
        organizationId,
        projectId,
      });

      setResults(data.results || []);
    } catch (err) {
      console.error("Knowledge search error:", err);
      setError(err.message || "Search failed.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="knowledge-search">
      <form onSubmit={handleSearch}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search projects, tasks, organizations..."
        />

        <button type="submit" disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {error && (
        <div className="knowledge-search-error">
          {error}
        </div>
      )}

      <div className="knowledge-search-results">
        {results.length === 0 && !loading && query && (
          <p>No results found.</p>
        )}

        {results.map((item) => (
          <div
            key={item.id}
            className="knowledge-search-result"
          >
            <div>
              <strong>
                {item.source_type}
              </strong>

              <span>
                Similarity:{" "}
                {Number(item.similarity).toFixed(3)}
              </span>
            </div>

            <p>{item.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KnowledgeSearch;