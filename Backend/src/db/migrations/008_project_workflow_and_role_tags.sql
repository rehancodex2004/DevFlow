-- Project-owned workflow and discipline metadata. This migration is deliberately
-- idempotent because the existing migration runner replays SQL files.

CREATE TABLE IF NOT EXISTS project_statuses (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    key VARCHAR(60) NOT NULL,
    label VARCHAR(80) NOT NULL,
    color VARCHAR(20) NOT NULL DEFAULT '#6d5dfc',
    position INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_project_status_key UNIQUE (project_id, key),
    CONSTRAINT unique_project_status_position UNIQUE (project_id, position)
);

CREATE INDEX IF NOT EXISTS idx_project_statuses_project_position
    ON project_statuses(project_id, position);

-- Seed each existing project with the established workflow. New projects are
-- seeded by projectController in the same transaction as their creation.
INSERT INTO project_statuses (project_id, key, label, color, position)
SELECT p.id, defaults.key, defaults.label, defaults.color, defaults.position
FROM projects p
CROSS JOIN (
    VALUES
      ('backlog', 'Backlog', '#7d8797', 0),
      ('todo', 'To do', '#6fa8ff', 1),
      ('in_progress', 'In progress', '#d7b66f', 2),
      ('in_review', 'In review', '#c58bff', 3),
      ('done', 'Done', '#59d68c', 4),
      ('cancelled', 'Cancelled', '#ef8e99', 5)
) AS defaults(key, label, color, position)
ON CONFLICT (project_id, key) DO NOTHING;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status_id BIGINT;

-- The original check only allows the six default keys. Keep the readable
-- status key for backwards compatibility, but make the project status record
-- the authoritative validation source in the application.
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

UPDATE tasks t
SET status_id = ps.id
FROM project_statuses ps
WHERE ps.project_id = t.project_id
  AND ps.key = t.status
  AND t.status_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_task_status'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT fk_task_status
      FOREIGN KEY (status_id) REFERENCES project_statuses(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tasks_project_status_id
    ON tasks(project_id, status_id);

CREATE TABLE IF NOT EXISTS task_role_tags (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    label VARCHAR(100) NOT NULL,
    description_template TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_project_role_tag UNIQUE (project_id, label)
);

CREATE INDEX IF NOT EXISTS idx_task_role_tags_project
    ON task_role_tags(project_id);

INSERT INTO task_role_tags (project_id, label, description_template)
SELECT p.id, defaults.label, defaults.description_template
FROM projects p
CROSS JOIN (
    VALUES
      ('UX Designer', 'User goal:\n\nUser flow:\n\nAcceptance criteria:\n'),
      ('UI Designer', 'Design scope:\n\nScreens/components:\n\nVisual acceptance criteria:\n'),
      ('Frontend Dev', 'Implementation scope:\n\nComponents and states:\n\nAcceptance criteria:\n\nTesting notes:\n'),
      ('Backend Dev', 'API/data scope:\n\nImplementation notes:\n\nAcceptance criteria:\n\nTest coverage:\n'),
      ('QA Tester', 'Test objective:\n\nTest scenarios:\n\nExpected results:\n\nRegression coverage:\n')
) AS defaults(label, description_template)
ON CONFLICT (project_id, label) DO NOTHING;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS role_tag_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_task_role_tag'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT fk_task_role_tag
      FOREIGN KEY (role_tag_id) REFERENCES task_role_tags(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tasks_role_tag_id ON tasks(role_tag_id);

DROP TRIGGER IF EXISTS project_statuses_updated_at_trigger ON project_statuses;
CREATE TRIGGER project_statuses_updated_at_trigger
BEFORE UPDATE ON project_statuses
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS task_role_tags_updated_at_trigger ON task_role_tags;
CREATE TRIGGER task_role_tags_updated_at_trigger
BEFORE UPDATE ON task_role_tags
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Historic installations may contain assignees who were organization members
-- but not project members because an older trigger allowed that. Preserve those
-- assignments by backfilling valid project memberships before tightening it.
INSERT INTO project_members (project_id, user_id, role)
SELECT DISTINCT t.project_id, t.assignee_id, 'member'
FROM tasks t
JOIN projects p ON p.id = t.project_id
JOIN organization_members om
  ON om.organization_id = p.organization_id
 AND om.user_id = t.assignee_id
WHERE t.assignee_id IS NOT NULL
ON CONFLICT (project_id, user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION validate_task_assignee()
RETURNS TRIGGER AS $$
DECLARE
    member_exists BOOLEAN;
BEGIN
    IF NEW.assignee_id IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM project_members
      WHERE project_id = NEW.project_id AND user_id = NEW.assignee_id
    ) INTO member_exists;

    IF NOT member_exists THEN
      RAISE EXCEPTION 'Task assignee must be a member of the project';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS task_assignee_validation_trigger ON tasks;
CREATE TRIGGER task_assignee_validation_trigger
BEFORE INSERT OR UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION validate_task_assignee();
