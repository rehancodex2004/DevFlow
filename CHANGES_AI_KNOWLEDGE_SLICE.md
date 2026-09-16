# AI / Knowledge slice — what changed

This is the first working slice of the RAG/vector-embeddings system: a real,
grounded, task-scoped AI chat, on top of a fixed knowledge schema.

## The root bug that was fixed

`Backend/src/db/migrations/002_vector_knowledge.sql` created a table called
`knowledge_base`. All the actual application code
(`knowledgeBaseService.js`, `vectorSearchService.js`) read/wrote a
**different, never-created** table called `knowledge_embeddings`. Every
embedding insert and every vector search was throwing
`relation "knowledge_embeddings" does not exist`.

`003_fix_knowledge_schema.sql` drops the broken table (it never held real
data — every write to it would have failed) and creates the one correct
`knowledge_embeddings` table that the code actually uses, with:

- `content_hash` for idempotent re-indexing (no duplicate embeddings)
- `chunk_index` (ready for chunking long content later)
- proper foreign keys + HNSW cosine index
- a new `ai_task_messages` table for per-user, per-task chat memory

## New/changed backend files

- `src/services/embeddingService.js` — now only does embedding + hashing
- `src/services/knowledgeBaseService.js` — single source of truth for
  indexing (task/project/organization/comment), idempotent upserts,
  `deleteSource`, bulk `indexAllKnowledge`
- `src/services/vectorSearchService.js` — aligned to the fixed schema
- `src/services/retrievalService.js` — **new**. Authorization-first
  (`assertTaskAccess`) + structured task facts + hybrid vector search
- `src/services/aiService.js` — **new task-scoped RAG chat**. Lightweight
  intent router (FACT / SEMANTIC / SUMMARY), grounding rules, fact vs.
  recommendation separation, inline source citations, calls OpenRouter
- `src/controllers/aiController.js` + `src/routes/aiRoutes.js` — replaced
  the old dead `/api/ai/task` (unused duplicate of `/api/tasks/analyze`)
  with:
  - `POST /api/ai/task/:taskId/chat`
  - `GET  /api/ai/task/:taskId/chat/history`
- Auto re-index hooks added (fire-and-forget, never block the request):
  - `taskController.js`: create/update/delete
  - `commentController.js`: add/delete
  - `organizationController.js`, `projectController.js`: create/update
- `src/scripts/indexKnowledge.js` + `npm run knowledge:index` — one-time
  backfill for data that already exists in your database

## New/changed frontend files

- `src/services/api.js` — `api.taskChat(taskId, message)`,
  `api.taskChatHistory(taskId)`
- `src/components/TaskAIPanel.jsx` — **new**. Linear-styled chat panel:
  history, streaming-style bubbles, source chips, suggested questions,
  Enter-to-send
- `src/styles.css` — appended `.ai-panel` styles using the existing design
  tokens (`--bg`, `--surface`, `--border`, `--accent`) so it matches the
  rest of the app instead of introducing a new visual language
- `src/pages/TaskDetail.jsx` — renders `<TaskAIPanel taskId={id} />` in the
  task sidebar

## What is NOT done yet (next slices)

- Project AI / Organization AI / Global AI (same pattern, new retrieval
  functions — `retrievalService.js` and `aiService.js` are structured so
  these can be added without touching Task AI)
- Chunking for very long descriptions/comments (schema supports it via
  `chunk_index`, the indexer doesn't split yet)
- AI actions with confirm-before-mutate UI (the model will *propose*
  changes in text per its system prompt, but nothing gets created/updated
  automatically yet)
- Daily/weekly/monthly reports
- Full Linear-style visual redesign of the rest of the app (this slice
  only styled the new AI panel to match the existing dark theme)

## How to run this

```bash
cd Backend
npm install
npm run db:migrate        # applies 001, 002, 003 in order
npm run knowledge:index   # backfills embeddings for existing data
npm run dev

cd ../Frontend
npm install
npm run dev
```

Make sure `Backend/.env` has both:

```
OPENROUTER_API_KEY=...
EMBEDDING_MODEL=openai/text-embedding-3-small
```

(`EMBEDDING_MODEL` was missing before — `OPENROUTER_MODEL` alone is only
used for chat completions, not embeddings.)

I could not run/test this live in this environment (no network or
Postgres access here), so please run the steps above and tell me what you
see — especially any errors from `npm run knowledge:index` or from the
chat panel — and I'll fix forward from there.

---

# Slice 2 — Repair migration + Linear-style shell (Dashboard + Command Palette)

## Repair migration
`004_repair_knowledge_embeddings.sql` — patches an already-existing
`knowledge_embeddings` table (adds missing columns, backfills
`content_hash`, adds the unique constraint) instead of assuming the table
was created fresh by migration 003. Run `npm run db:migrate` again, then
`npm run knowledge:index`.

## New: Dashboard (`/`)
- `src/pages/Dashboard.jsx` + `src/styles/dashboard.css`
- Real data only — built from `api.getMyTasks()` and `api.projects()`
  (both pre-existing, already-authorized endpoints, no new backend code
  needed here)
- Stat row: active / overdue / due today / completed today, computed
  client-side from real task data
- "My work" list: overdue + due-today tasks, linking to each task
- "Projects" list: real completion % and a health label (Healthy / At
  risk / Needs attention) computed from actual task counts, not guessed
- Login/Signup now redirect to `/` instead of `/organizations`; unknown
  routes redirect to `/` as well

## New: Command Palette (Ctrl+K / Cmd+K)
- `src/components/CommandPalette.jsx` + `src/styles/command-palette.css`
- Global shortcut (works from any page), Esc to close
- Searches: static navigation commands, organizations, projects, and your
  own tasks — all from data the user is already authorized to see (same
  endpoints as above)
- Arrow keys + Enter to navigate, mounted once in `Layout.jsx`
- Small "⌘K" hint badge added to the topbar

## Still not done (next slices, per the master prompt's own phases)
- Project AI / Organization AI / Global AI panels
- AI action confirmation UI (create/update via AI with a review step)
- Kanban drag/drop persistence audit
- Full responsive pass at all the listed breakpoints
- Reports (daily/weekly/monthly)
- Accessibility pass

---

# Slice 3 — Global AI Assistant (search across everything) + Dashboard reverted to optional

## Per your feedback
- `/` no longer forces the Dashboard — your existing Organizations page is
  the home/overview again. Dashboard is still there at `/dashboard` if you
  ever want it, just removed from the sidebar nav.

## New: Global AI Assistant
Reachable three ways, all opening the same chat drawer:
- Floating "✦" button, bottom-right, on every page
- "AI Assistant" item in the sidebar
- `Ctrl+K` → "Open AI Assistant"

This is a genuinely different, more powerful assistant than the per-task
one — it can search and answer across **every task, project, and
organization you're a member of**, not just one open task.

### Backend (new)
- `005_global_ai_chat.sql` — `ai_global_messages` table (same idea as
  `ai_task_messages`, scoped to just the user)
- `vectorSearchService.searchKnowledgeAcrossOrganizations()` — semantic
  search across all of a user's organizations (previous version only
  searched one org at a time)
- `retrievalService.js` additions:
  - `getUserOrganizationIds()` — the hard authorization boundary
  - `getGlobalFacts()` — real counts: pending / overdue / completed today,
    computed directly from the database, never guessed
  - `keywordSearchTasks()` — ILIKE search on title/description (the
    "keyword" half of hybrid search — good for "find the task about X")
  - `getGlobalKnowledgeContext()` — combines facts + keyword + semantic
- `aiService.globalChat()` — same grounding rules as Task AI (facts vs.
  recommendations, cite sources, refuse instead of guessing, confirm
  before any mutation)
- `POST /api/ai/global/chat`, `GET /api/ai/global/chat/history`

### Frontend (new)
- `components/GlobalAIChat.jsx` + `styles/ai-global.css` — a proper
  drawer: glass/blur background, gradient orb header, glowing floating
  launcher with a pulse animation, source chips that navigate you
  straight to the task/project/org they came from
- Wired into `Layout.jsx`: floating button, sidebar entry, and a new
  "Open AI Assistant" command in the palette

## Try asking it
- "Show my overdue tasks"
- "How many tasks are pending?"
- "What should I work on next?"
- "Find the task about authentication"

Same rule as Task AI: if it can't find enough to answer reliably, it says
so instead of guessing — and it will only ever discuss organizations you
actually belong to.
