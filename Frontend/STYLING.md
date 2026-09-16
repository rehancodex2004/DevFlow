# Frontend Styling Architecture

The stylesheet is intentionally split by responsibility:

- `src/styles/base.css` — variables, typography, forms, buttons, shared panels and utilities.
- `src/styles/layout.css` — sidebar, navigation, application shell and loading screen.
- `src/styles/auth.css` — login and signup pages only.
- `src/styles/organization.css` — organization list/detail, members and organization projects.
- `src/styles/project.css` — project-specific styling and future project components.
- `src/styles/task.css` — task creation, Kanban columns and task cards.
- `src/styles/responsive.css` — responsive rules shared across pages.
- `src/styles.css` — only imports the modules above.

## Adding a new page

For example, when adding a Reports page:

1. Create `src/pages/Reports.jsx`.
2. Create `src/styles/reports.css`.
3. Add `@import "./styles/reports.css";` to `src/styles.css`.
4. Keep only Reports-specific selectors in `reports.css`.
5. Put reusable styles in `base.css` instead of duplicating them.

This keeps the project easy to extend and avoids a single huge CSS file.
