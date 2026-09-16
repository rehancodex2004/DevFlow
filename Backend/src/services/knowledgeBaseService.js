// ============================================================
// KNOWLEDGE BASE SERVICE
// ============================================================
//
// Single, clean indexing layer for the RAG knowledge table
// (knowledge_embeddings). Responsible for:
//
//   - converting CMS records into plain text
//   - creating/skipping embeddings (idempotent, content-hash based)
//   - upserting rows into knowledge_embeddings
//   - removing embeddings when a source is deleted
//   - bulk (re)indexing everything that exists today
//
// This is the ONLY place that writes to knowledge_embeddings.
// ============================================================

const pool = require("../config/database");
const {
  createEmbedding,
  hashContent,
  toVectorLiteral,
} = require("./embeddingService");

// ============================================================
// TEXT BUILDERS
// ============================================================

function taskToText(task) {
  return `
Type: Task

Title: ${task.title || ""}

Description: ${task.description || ""}

Status: ${task.status || ""}

Priority: ${task.priority || ""}

Project: ${task.project_name || ""}

Organization: ${task.organization_name || ""}

Assignee: ${task.assignee_name || "Unassigned"}

Due date: ${task.due_date || "No due date"}
`.trim();
}

function projectToText(project) {
  return `
Type: Project

Project Name: ${project.name || ""}

Description: ${project.description || ""}

Status: ${project.status || ""}

Organization: ${project.organization_name || ""}
`.trim();
}

function organizationToText(organization) {
  return `
Type: Organization

Organization Name: ${organization.name || ""}

Description: ${organization.description || ""}
`.trim();
}

function commentToText(comment) {
  return `
Type: Task Comment

Task: ${comment.task_title || ""}

Comment:
${comment.content || ""}

Author: ${comment.user_name || ""}
`.trim();
}

// ============================================================
// UPSERT ONE KNOWLEDGE ROW (idempotent)
// ============================================================
//
// Skips calling the embedding API entirely if the content
// hasn't changed since the last time this exact source was
// indexed (content_hash match) - see spec section 16/69.

async function upsertKnowledge({
  organizationId,
  projectId = null,
  taskId = null,
  commentId = null,
  sourceType,
  sourceId,
  chunkIndex = 0,
  content,
  metadata = {},
}) {
  if (!content || !String(content).trim()) {
    return null;
  }

  const contentHash = hashContent(content);

  const existing = await pool.query(
    `
    SELECT id, content_hash
    FROM knowledge_embeddings
    WHERE source_type = $1
      AND source_id = $2
      AND chunk_index = $3
    `,
    [sourceType, sourceId, chunkIndex]
  );

  if (existing.rowCount && existing.rows[0].content_hash === contentHash) {
    // Nothing changed - do not re-embed.
    return { skipped: true, id: existing.rows[0].id };
  }

  const embedding = await createEmbedding(content);
  const vector = toVectorLiteral(embedding);

  const result = await pool.query(
    `
    INSERT INTO knowledge_embeddings
      (organization_id, project_id, task_id, comment_id,
       source_type, source_id, chunk_index,
       content, content_hash, embedding, metadata)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::vector, $11::jsonb)
    ON CONFLICT (source_type, source_id, chunk_index)
    DO UPDATE SET
      organization_id = EXCLUDED.organization_id,
      project_id = EXCLUDED.project_id,
      task_id = EXCLUDED.task_id,
      comment_id = EXCLUDED.comment_id,
      content = EXCLUDED.content,
      content_hash = EXCLUDED.content_hash,
      embedding = EXCLUDED.embedding,
      metadata = EXCLUDED.metadata,
      updated_at = NOW()
    RETURNING id
    `,
    [
      organizationId,
      projectId,
      taskId,
      commentId,
      sourceType,
      sourceId,
      chunkIndex,
      content,
      contentHash,
      vector,
      JSON.stringify(metadata),
    ]
  );

  return { skipped: false, id: result.rows[0].id };
}

// ============================================================
// DELETE A SOURCE'S EMBEDDINGS
// ============================================================

async function deleteSource(sourceType, sourceId) {
  await pool.query(
    `DELETE FROM knowledge_embeddings WHERE source_type = $1 AND source_id = $2`,
    [sourceType, sourceId]
  );
}

// ============================================================
// INDEX ONE TASK
// ============================================================

async function indexTask(taskId) {
  const result = await pool.query(
    `
    SELECT
      t.id, t.title, t.description, t.status, t.priority, t.due_date,
      p.id AS project_id, p.name AS project_name,
      o.id AS organization_id, o.name AS organization_name,
      u.name AS assignee_name
    FROM tasks t
    INNER JOIN projects p ON p.id = t.project_id
    INNER JOIN organizations o ON o.id = p.organization_id
    LEFT JOIN users u ON u.id = t.assignee_id
    WHERE t.id = $1
    `,
    [taskId]
  );

  if (!result.rowCount) {
    await deleteSource("task", taskId);
    return null;
  }

  const task = result.rows[0];
  const content = taskToText(task);

  return upsertKnowledge({
    organizationId: task.organization_id,
    projectId: task.project_id,
    taskId: task.id,
    sourceType: "task",
    sourceId: task.id,
    content,
    metadata: { title: task.title, status: task.status },
  });
}

// ============================================================
// INDEX ONE PROJECT
// ============================================================

async function indexProject(projectId) {
  const result = await pool.query(
    `
    SELECT p.id, p.name, p.description, p.status,
           o.id AS organization_id, o.name AS organization_name
    FROM projects p
    INNER JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = $1
    `,
    [projectId]
  );

  if (!result.rowCount) {
    await deleteSource("project", projectId);
    return null;
  }

  const project = result.rows[0];
  const content = projectToText(project);

  return upsertKnowledge({
    organizationId: project.organization_id,
    projectId: project.id,
    sourceType: "project",
    sourceId: project.id,
    content,
    metadata: { name: project.name, status: project.status },
  });
}

// ============================================================
// INDEX ONE ORGANIZATION
// ============================================================

async function indexOrganization(organizationId) {
  const result = await pool.query(
    `SELECT id, name, description FROM organizations WHERE id = $1`,
    [organizationId]
  );

  if (!result.rowCount) {
    await deleteSource("organization", organizationId);
    return null;
  }

  const organization = result.rows[0];
  const content = organizationToText(organization);

  return upsertKnowledge({
    organizationId: organization.id,
    sourceType: "organization",
    sourceId: organization.id,
    content,
    metadata: { name: organization.name },
  });
}

// ============================================================
// INDEX ONE COMMENT
// ============================================================

async function indexComment(commentId) {
  const result = await pool.query(
    `
    SELECT
      c.id, c.content, c.task_id,
      t.title AS task_title,
      p.id AS project_id,
      o.id AS organization_id,
      u.name AS user_name
    FROM task_comments c
    INNER JOIN tasks t ON t.id = c.task_id
    INNER JOIN projects p ON p.id = t.project_id
    INNER JOIN organizations o ON o.id = p.organization_id
    INNER JOIN users u ON u.id = c.user_id
    WHERE c.id = $1
    `,
    [commentId]
  );

  if (!result.rowCount) {
    await deleteSource("comment", commentId);
    return null;
  }

  const comment = result.rows[0];
  const content = commentToText(comment);

  return upsertKnowledge({
    organizationId: comment.organization_id,
    projectId: comment.project_id,
    taskId: comment.task_id,
    commentId: comment.id,
    sourceType: "comment",
    sourceId: comment.id,
    content,
    metadata: { author: comment.user_name },
  });
}

// ============================================================
// INDEX ALL EXISTING DATA (npm run knowledge:index)
// ============================================================

async function indexAllKnowledge() {
  console.log("================================");
  console.log("STARTING KNOWLEDGE BASE INDEX");
  console.log("================================");

  const stats = { organizations: 0, projects: 0, tasks: 0, comments: 0, skipped: 0, failed: 0 };

  async function safeRun(label, id, fn) {
    try {
      const result = await fn(id);
      if (result?.skipped) stats.skipped += 1;
      console.log(`  ok   ${label} ${id}${result?.skipped ? " (unchanged, skipped)" : ""}`);
    } catch (error) {
      stats.failed += 1;
      console.error(`  FAIL ${label} ${id}:`, error.message);
    }
  }

  const organizations = await pool.query(`SELECT id FROM organizations ORDER BY id`);
  for (const row of organizations.rows) {
    await safeRun("organization", row.id, indexOrganization);
    stats.organizations += 1;
  }

  const projects = await pool.query(`SELECT id FROM projects ORDER BY id`);
  for (const row of projects.rows) {
    await safeRun("project", row.id, indexProject);
    stats.projects += 1;
  }

  const tasks = await pool.query(`SELECT id FROM tasks ORDER BY id`);
  for (const row of tasks.rows) {
    await safeRun("task", row.id, indexTask);
    stats.tasks += 1;
  }

  const comments = await pool.query(`SELECT id FROM task_comments ORDER BY id`);
  for (const row of comments.rows) {
    await safeRun("comment", row.id, indexComment);
    stats.comments += 1;
  }

  console.log("================================");
  console.log("KNOWLEDGE BASE INDEX COMPLETE");
  console.log(stats);
  console.log("================================");

  return stats;
}

module.exports = {
  taskToText,
  projectToText,
  organizationToText,
  commentToText,

  upsertKnowledge,
  deleteSource,

  indexTask,
  indexProject,
  indexOrganization,
  indexComment,

  indexAllKnowledge,
};
