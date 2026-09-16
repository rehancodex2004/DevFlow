// ============================================================
// AI SERVICE
// ============================================================
//
// Task-scoped RAG chat.
// ============================================================

const {
  getTaskFacts,
  getTaskKnowledgeContext,
  getGlobalKnowledgeContext,
} = require("./retrievalService");
const pool = require("../config/database");

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openrouter/free";

// ============================================================
// TINY INTENT ROUTER
// ============================================================

const SEMANTIC_HINTS = [
  "discuss",
  "said",
  "mention",
  "comment",
  "conversation",
  "blocking",
  "blocked",
  "why",
  "tried",
  "history",
  "context",
  "similar",
  "related",
  "background",
];

function classifyIntent(message) {
  const text = String(message || "").toLowerCase();

  if (SEMANTIC_HINTS.some((hint) => text.includes(hint))) {
    return "SEMANTIC";
  }

  if (
    /summari|acceptance criteria|subtask|next step|implementation/.test(text)
  ) {
    return "SUMMARY";
  }

  if (
    /how many|count|overdue|status|priority|assignee|due date|who is/.test(text)
  ) {
    return "FACT";
  }

  return "SUMMARY";
}

// ============================================================
// PROMPT BUILDING
// ============================================================

function formatFacts(facts) {
  if (!facts) return "No task data found.";

  const { task, isOverdue, comments, activity } = facts;

  const commentLines = comments.length
    ? comments
        .map(
          (c) =>
            `- [comment:${c.id}] ${c.user_name} (${new Date(
              c.created_at,
            ).toISOString()}): ${c.content}`,
        )
        .join("\n")
    : "(no comments yet)";

  const activityLines = activity.length
    ? activity
        .map(
          (a) =>
            `- [activity:${a.id}] ${a.action}${
              a.old_value ? ` (${a.old_value} -> ${a.new_value})` : ""
            } at ${new Date(a.created_at).toISOString()}`,
        )
        .join("\n")
    : "(no recorded activity)";

  return `
TASK FACTS (ground truth, from the database - use these for any factual claim):
- [task:${task.id}] Title: ${task.title}
- Description: ${task.description || "(none)"}
- Status: ${task.status}
- Priority: ${task.priority}
- Assignee: ${task.assignee_name || "Unassigned"}
- Created by: ${task.creator_name}
- Due date: ${task.due_date || "None"}
- Overdue: ${isOverdue ? "YES" : "No"}
- Project: [project:${task.project_id}] ${task.project_name}
- Organization: [organization:${task.organization_id}] ${task.organization_name}

RECENT COMMENTS (most recent first):
${commentLines}

RECENT ACTIVITY (most recent first):
${activityLines}
`.trim();
}

function formatSemanticHits(hits) {
  if (!hits || !hits.length) {
    return "(no additional related knowledge found)";
  }

  return hits
    .map(
      (h) =>
        `- [${h.source_type}:${h.source_id}] (similarity ${Number(
          h.similarity,
        ).toFixed(2)}) ${h.content}`,
    )
    .join("\n");
}

// ============================================================
// TASK SYSTEM PROMPT
// ============================================================

const SYSTEM_PROMPT = `
You are the AI assistant for ONE specific task inside a project-management app.

Ground rules (must follow all of them):

1. Only use information given to you in "TASK FACTS", "RECENT COMMENTS", "RECENT ACTIVITY" and "RELATED KNOWLEDGE" below.

2. Never invent data about this task, project, or organization.

3. Clearly separate FACTS (from the database) from RECOMMENDATIONS (your own suggestions). Label recommendations as such.

4. If the available context is not enough to answer reliably, say so plainly instead of guessing.

5. When you reference a specific task, comment, or activity entry, cite it inline using its bracketed id exactly as given to you, e.g. [comment:12] or [task:5].

6. Never discuss or reveal information about any other task, project, or organization.

7. If asked to create tasks, change status, assign someone, or otherwise modify data, respond with a clear proposed plan and say it requires the user's confirmation before anything is actually changed.

8. Be concise and direct. Use short paragraphs or bullet points.

9. Only answer questions related to the current task, its project/work context, requirements, implementation, testing, bugs, progress, comments, activity, or next steps.

10. Questions clearly unrelated to the current task must not be answered as general questions.
`.trim();

// ============================================================
// OPENROUTER CALL
// ============================================================

async function callOpenRouter(messages) {
  if (
    !process.env.OPENROUTER_API_KEY ||
    !process.env.OPENROUTER_API_KEY.trim()
  ) {
    throw new Error("OPENROUTER_API_KEY is missing.");
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",

    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.FRONTEND_URL || "http://localhost:5173",
      "X-Title": "DevFlow Task AI",
    },

    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("OPENROUTER ERROR:", data);

    throw new Error(data?.error?.message || "OpenRouter request failed.");
  }

  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("AI returned an empty response.");
  }

  return content.trim();
}

// ============================================================
// TASK QUESTION SCOPE CLASSIFICATION
// ============================================================

async function classifyTaskQuestion({ message, facts }) {
  const task = facts.task;

  const prompt = `
Determine whether the user's question is related to the current task.

CURRENT TASK:
- Task ID: ${task.id}
- Title: ${task.title}
- Description: ${task.description || "(none)"}
- Status: ${task.status}
- Priority: ${task.priority}
- Assignee: ${task.assignee_name || "Unassigned"}
- Project: ${task.project_name}

USER QUESTION:
${message}

A question is RELATED if it is about:

- this task
- the work represented by this task
- the project/work context of this task
- task status
- task priority
- task assignee
- task deadline
- task progress
- task comments
- task activity
- task requirements
- task implementation
- task testing
- bugs or issues related to this task
- solving a problem related to this task
- how to complete this task
- next steps for this task
- recommendations for completing or improving this task

A question is OUT_OF_SCOPE if it is clearly unrelated to the current task or project-management work.

Examples of OUT_OF_SCOPE:

"How can I make tea?"
"How do I cook chicken?"
"What is the weather today?"
"Who won the cricket match?"
"Tell me a joke."
"Recommend a movie."

IMPORTANT:

- Do not reject a question just because the exact words are not present in the task.
- Judge whether the question is reasonably connected to the current task/work.
- Do not answer the question.
- Return ONLY one of these two values:

RELATED
OUT_OF_SCOPE
`.trim();

  const result = await callOpenRouter([
    {
      role: "system",
      content:
        "You are a strict task-scope classifier. Return ONLY RELATED or OUT_OF_SCOPE.",
    },
    {
      role: "user",
      content: prompt,
    },
  ]);

  const normalized = result.trim().toUpperCase();

  if (normalized === "RELATED") {
    return "RELATED";
  }

  return "OUT_OF_SCOPE";
}

// ============================================================
// TASK CHAT
// ============================================================

async function taskChat({
  taskId,
  projectId,
  organizationId,
  message,
  history = [],
}) {
  // ----------------------------------------------------------
  // STEP 1: Get task facts first
  // ----------------------------------------------------------

  const facts = await getTaskFacts(taskId);

  if (!facts) {
    const error = new Error("Task not found.");
    error.status = 404;
    throw error;
  }

  // ----------------------------------------------------------
  // STEP 2: Check question scope
  // ----------------------------------------------------------

  const scopeResult = await classifyTaskQuestion({
    message,
    facts,
  });

  // ----------------------------------------------------------
  // STEP 3: If unrelated, stop here
  // ----------------------------------------------------------

  if (scopeResult === "OUT_OF_SCOPE") {
    return {
      answer:
        "This question is outside the scope of the current task. Please ask something related to this task, project, or its activity.",

      sources: [
        {
          type: "task",
          id: facts.task.id,
          label: `Task #${facts.task.id}`,
        },
      ],

      intent: "OUT_OF_SCOPE",
    };
  }

  // ----------------------------------------------------------
  // STEP 4: Classify normal task question
  // ----------------------------------------------------------

  const intent = classifyIntent(message);

  let semanticHits = [];

  // ----------------------------------------------------------
  // STEP 5: Semantic search only when needed
  // ----------------------------------------------------------

  if (intent === "SEMANTIC") {
    try {
      const knowledge = await getTaskKnowledgeContext({
        taskId,
        projectId,
        organizationId,
        query: message,
      });

      semanticHits = knowledge?.semanticHits || [];
    } catch (error) {
      console.error("Task semantic search error:", error);

      // Continue with task facts if semantic search fails.
      semanticHits = [];
    }
  }

  // ----------------------------------------------------------
  // STEP 6: Build context
  // ----------------------------------------------------------

  const contextBlock = `
${formatFacts(facts)}

RELATED KNOWLEDGE (semantic search results, may or may not be relevant):
${formatSemanticHits(semanticHits)}
`.trim();

  // ----------------------------------------------------------
  // STEP 7: Prepare AI messages
  // ----------------------------------------------------------

  const messages = [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },

    {
      role: "system",
      content: contextBlock,
    },

    ...history.slice(-6).map((m) => ({
      role: m.role,
      content: m.content,
    })),

    {
      role: "user",
      content: message,
    },
  ];

  // ----------------------------------------------------------
  // STEP 8: Generate answer
  // ----------------------------------------------------------

  const answer = await callOpenRouter(messages);

  // ----------------------------------------------------------
  // STEP 9: Build sources
  // ----------------------------------------------------------

  const sources = [
    {
      type: "task",
      id: facts.task.id,
      label: `Task #${facts.task.id}`,
    },

    ...facts.comments.slice(0, 5).map((c) => ({
      type: "comment",
      id: c.id,
      label: `Comment by ${c.user_name}`,
    })),

    ...semanticHits.map((h) => ({
      type: h.source_type,
      id: h.source_id,
      label: `${h.source_type} #${h.source_id}`,
      similarity: Number(Number(h.similarity).toFixed(3)),
    })),
  ];

  return {
    answer,
    sources,
    intent,
  };
}

// ============================================================
// GLOBAL CHAT
// ============================================================

const GLOBAL_SYSTEM_PROMPT = `
You are the global AI assistant for a project-management app, reachable from anywhere in the product.

Ground rules (must follow all of them):

1. Only use information in "YOUR TASKS", "KEYWORD MATCHES", and "RELATED KNOWLEDGE" below. Never invent counts, task names, projects, or organizations.

2. This user is a member of a specific, limited set of organizations. Only ever discuss those.

3. If asked about something outside the available organization context, say you don't have access to that.

4. Clearly separate FACTS (from the database) from RECOMMENDATIONS (your own suggestions), labeling recommendations as such.

5. If the available context is not enough to answer reliably, say so plainly instead of guessing.

6. When you reference a specific task, cite it inline using its bracketed id exactly as given to you, e.g. [task:12].

7. If asked to create/update/assign/delete anything, respond with a clear proposed plan and say it requires the user's confirmation.

8. Be concise. Use short paragraphs or bullet points.
`.trim();

function formatGlobalFacts(facts) {
  const overdueLines = facts.myOverdue.length
    ? facts.myOverdue
        .map(
          (t) =>
            `- [task:${t.id}] ${t.title} (${t.project_name}) — due ${t.due_date}`,
        )
        .join("\n")
    : "(none)";

  const completedLines = facts.myCompletedToday.length
    ? facts.myCompletedToday
        .map((t) => `- [task:${t.id}] ${t.title} (${t.project_name})`)
        .join("\n")
    : "(none)";

  return `
YOUR TASKS (ground truth, from the database):
- Total tasks assigned to you: ${facts.myTasksTotal}
- Pending (not done/cancelled): ${facts.myPending}
- Overdue:
${overdueLines}
- Completed today:
${completedLines}
`.trim();
}

function formatKeywordHits(hits) {
  if (!hits || !hits.length) return "(no keyword matches)";

  return hits
    .map(
      (t) =>
        `- [task:${t.id}] ${t.title} — ${t.status}, ${t.priority} (${t.project_name} / ${t.organization_name})`,
    )
    .join("\n");
}

async function globalChat({ userId, message, history = [], context = null }) {
  const { facts, semanticHits, keywordHits } = await getGlobalKnowledgeContext(
    userId,
    message,
  );

  const pageContext = await getPageContext(userId, context);

  const contextBlock = `
${formatGlobalFacts(facts)}

CURRENT PAGE CONTEXT:
${pageContext}

KEYWORD MATCHES:
${formatKeywordHits(keywordHits)}

RELATED KNOWLEDGE (semantic search results, may or may not be relevant):
${formatSemanticHits(semanticHits)}
`.trim();

  const messages = [
    {
      role: "system",
      content: GLOBAL_SYSTEM_PROMPT,
    },

    {
      role: "system",
      content: contextBlock,
    },

    ...history.slice(-6).map((m) => ({
      role: m.role,
      content: m.content,
    })),

    {
      role: "user",
      content: message,
    },
  ];

  const answer = await callOpenRouter(messages);

  const sources = [
    ...keywordHits.map((t) => ({
      type: "task",
      id: t.id,
      label: t.title,
    })),

    ...semanticHits.map((h) => ({
      type: h.source_type,
      id: h.source_id,
      label: `${h.source_type} #${h.source_id}`,
      similarity: Number(Number(h.similarity).toFixed(3)),
    })),
  ];

  return {
    answer,
    sources,
  };
}

/**
 * Resolve page context on the server instead of trusting a name or arbitrary
 * object supplied by the browser. The requested entity must be visible to the
 * authenticated user before it is added to the AI prompt.
 */
async function getPageContext(userId, context) {
  const entityType = context?.entityType;
  const entityId = Number(context?.entityId);
  if (!Number.isInteger(entityId) || !["organization", "project", "task"].includes(entityType)) {
    return "(no specific page is open)";
  }

  const queries = {
    organization: `SELECT o.id, o.name, o.description
      FROM organizations o
      JOIN organization_members om ON om.organization_id = o.id
      WHERE o.id = $1 AND om.user_id = $2`,
    project: `SELECT p.id, p.name, p.description, o.name AS organization_name
      FROM projects p
      JOIN organizations o ON o.id = p.organization_id
      JOIN organization_members om ON om.organization_id = p.organization_id
      WHERE p.id = $1 AND om.user_id = $2`,
    task: `SELECT t.id, t.title, t.description, t.status, p.name AS project_name,
        o.name AS organization_name
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      JOIN organizations o ON o.id = p.organization_id
      JOIN organization_members om ON om.organization_id = p.organization_id
      WHERE t.id = $1 AND om.user_id = $2`,
  };

  const result = await pool.query(queries[entityType], [entityId, userId]);
  if (!result.rowCount) return "(the requested page is not available to this user)";

  const entity = result.rows[0];
  return `${entityType.toUpperCase()} OPEN NOW:\n${Object.entries(entity)
    .filter(([, value]) => value !== null && value !== "")
    .map(([key, value]) => `- ${key.replaceAll("_", " ")}: ${value}`)
    .join("\n")}`;
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  taskChat,
  globalChat,
  classifyIntent,
  classifyTaskQuestion,
};
