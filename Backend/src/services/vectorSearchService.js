// ============================================================
// VECTOR SEARCH SERVICE
// ============================================================
//
// Pure semantic search over knowledge_embeddings. Every caller
// MUST already know (and have authorized) the organizationId -
// this service enforces the organization filter itself so a
// caller can never accidentally search across organizations,
// but it does NOT authorize the user - that happens one layer
// up, before this is ever called (see retrievalService.js).
// ============================================================

const pool = require("../config/database");
const { createEmbedding, toVectorLiteral } = require("./embeddingService");

async function searchKnowledge({
  query,
  organizationId,
  projectId = null,
  taskId = null,
  sourceTypes = null, // e.g. ["task", "comment"]
  limit = 8,
}) {
  if (!query || !String(query).trim()) {
    throw new Error("Search query is required.");
  }

  if (!organizationId) {
    throw new Error("Organization ID is required.");
  }

  const embedding = await createEmbedding(query);
  const vector = toVectorLiteral(embedding);

  const result = await pool.query(
    `
    SELECT
      id,
      organization_id,
      project_id,
      task_id,
      comment_id,
      source_type,
      source_id,
      content,
      metadata,
      1 - (embedding <=> $1::vector) AS similarity
    FROM knowledge_embeddings
    WHERE organization_id = $2
      AND ($3::bigint IS NULL OR project_id = $3 OR project_id IS NULL)
      AND ($4::bigint IS NULL OR task_id = $4)
      AND ($5::text[] IS NULL OR source_type = ANY($5::text[]))
      AND embedding IS NOT NULL
    ORDER BY embedding <=> $1::vector
    LIMIT $6
    `,
    [vector, organizationId, projectId, taskId, sourceTypes, limit]
  );

  return result.rows;
}

async function searchKnowledgeAcrossOrganizations({
  query,
  organizationIds,
  sourceTypes = null,
  limit = 8,
}) {
  if (!query || !String(query).trim()) {
    throw new Error("Search query is required.");
  }

  if (!Array.isArray(organizationIds) || organizationIds.length === 0) {
    return [];
  }

  const embedding = await createEmbedding(query);
  const vector = toVectorLiteral(embedding);

  const result = await pool.query(
    `
    SELECT
      id,
      organization_id,
      project_id,
      task_id,
      comment_id,
      source_type,
      source_id,
      content,
      metadata,
      1 - (embedding <=> $1::vector) AS similarity
    FROM knowledge_embeddings
    WHERE organization_id = ANY($2::bigint[])
      AND ($3::text[] IS NULL OR source_type = ANY($3::text[]))
      AND embedding IS NOT NULL
    ORDER BY embedding <=> $1::vector
    LIMIT $4
    `,
    [vector, organizationIds, sourceTypes, limit]
  );

  return result.rows;
}

module.exports = {
  searchKnowledge,
  searchKnowledgeAcrossOrganizations,
};
