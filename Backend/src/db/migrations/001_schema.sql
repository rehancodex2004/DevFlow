-- ============================================================
-- CMS DATABASE SCHEMA
-- PostgreSQL
--
-- Main structure:
--
-- User
--   ↓
-- Organization
--   ↓
-- Project
--   ↓
-- Task
--
-- Membership:
--
-- users <-> organization_members <-> organizations
-- users <-> project_members      <-> projects
--
-- Organization:
-- - Creator automatically becomes admin in backend
-- - Maximum 3 admins
--
-- Project:
-- - Belongs to one organization
-- - Only organization members can join
--
-- Task:
-- - Belongs to one project
-- - Assignee must be a project member
-- ============================================================


-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,

    name VARCHAR(120) NOT NULL,

    email VARCHAR(255) NOT NULL UNIQUE,

    password VARCHAR(255) NOT NULL,

    -- This is the SYSTEM role.
    --
    -- admin = system-level administrator
    -- user  = normal application user
    --
    -- Organization admin is NOT stored here.
    -- Organization admin is stored in organization_members.role.
    role VARCHAR(30) NOT NULL DEFAULT 'user'
        CHECK (role IN ('admin', 'user')),

    status VARCHAR(30) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'pending', 'disabled')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- ORGANIZATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS organizations (
    id BIGSERIAL PRIMARY KEY,

    name VARCHAR(160) NOT NULL,

    description TEXT NOT NULL DEFAULT '',

    -- User who created the organization.
    created_by BIGINT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_organization_creator
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE RESTRICT
);


-- ============================================================
-- ORGANIZATION MEMBERS
-- ============================================================

CREATE TABLE IF NOT EXISTS organization_members (
    id BIGSERIAL PRIMARY KEY,

    organization_id BIGINT NOT NULL,

    user_id BIGINT NOT NULL,

    -- Organization-specific role.
    --
    -- admin  = organization administrator
    -- member = normal organization member
    role VARCHAR(30) NOT NULL DEFAULT 'member'
        CHECK (role IN ('admin', 'member')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_org_member_organization
        FOREIGN KEY (organization_id)
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_org_member_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    -- Same user cannot be added twice to same organization.
    CONSTRAINT unique_organization_member
        UNIQUE (organization_id, user_id)
);


-- Organization member indexes
CREATE INDEX IF NOT EXISTS idx_org_members_org
    ON organization_members(organization_id);

CREATE INDEX IF NOT EXISTS idx_org_members_user
    ON organization_members(user_id);

CREATE INDEX IF NOT EXISTS idx_org_members_role
    ON organization_members(organization_id, role);


-- ============================================================
-- PROJECTS
-- ============================================================

CREATE TABLE IF NOT EXISTS projects (
    id BIGSERIAL PRIMARY KEY,

    -- Every project belongs to exactly one organization.
    organization_id BIGINT NOT NULL,

    name VARCHAR(160) NOT NULL,

    description TEXT NOT NULL DEFAULT '',

    status VARCHAR(30) NOT NULL DEFAULT 'active'
        CHECK (
            status IN (
                'active',
                'completed',
                'archived'
            )
        ),

    -- User who created the project.
    created_by BIGINT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_project_organization
        FOREIGN KEY (organization_id)
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_project_creator
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE RESTRICT
);


CREATE INDEX IF NOT EXISTS idx_projects_org
    ON projects(organization_id);

CREATE INDEX IF NOT EXISTS idx_projects_created_by
    ON projects(created_by);

CREATE INDEX IF NOT EXISTS idx_projects_status
    ON projects(organization_id, status);


-- ============================================================
-- PROJECT MEMBERS
-- ============================================================

CREATE TABLE IF NOT EXISTS project_members (
    id BIGSERIAL PRIMARY KEY,

    project_id BIGINT NOT NULL,

    user_id BIGINT NOT NULL,

    -- Project-specific role.
    role VARCHAR(30) NOT NULL DEFAULT 'member'
        CHECK (
            role IN (
                'project_admin',
                'member'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_project_member_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_project_member_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT unique_project_member
        UNIQUE (project_id, user_id)
);


CREATE INDEX IF NOT EXISTS idx_project_members_project
    ON project_members(project_id);

CREATE INDEX IF NOT EXISTS idx_project_members_user
    ON project_members(user_id);

CREATE INDEX IF NOT EXISTS idx_project_members_role
    ON project_members(project_id, role);


-- ============================================================
-- TASKS
-- ============================================================

CREATE TABLE IF NOT EXISTS tasks (
    id BIGSERIAL PRIMARY KEY,

    project_id BIGINT NOT NULL,

    title VARCHAR(240) NOT NULL,

    description TEXT NOT NULL DEFAULT '',

    status VARCHAR(30) NOT NULL DEFAULT 'todo'
        CHECK (
            status IN (
                'backlog',
                'todo',
                'in_progress',
                'in_review',
                'done',
                'cancelled'
            )
        ),

    priority VARCHAR(30) NOT NULL DEFAULT 'no_priority'
        CHECK (
            priority IN (
                'no_priority',
                'low',
                'medium',
                'high',
                'urgent'
            )
        ),

    -- User assigned to this task.
    --
    -- Database trigger below will make sure
    -- the user belongs to the project.
    assignee_id BIGINT,

    -- User who created the task.
    created_by BIGINT NOT NULL,

    due_date DATE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_task_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_task_assignee
        FOREIGN KEY (assignee_id)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_task_creator
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE RESTRICT
);


CREATE INDEX IF NOT EXISTS idx_tasks_project
    ON tasks(project_id);

CREATE INDEX IF NOT EXISTS idx_tasks_assignee
    ON tasks(assignee_id);

CREATE INDEX IF NOT EXISTS idx_tasks_status
    ON tasks(project_id, status);

CREATE INDEX IF NOT EXISTS idx_tasks_priority
    ON tasks(project_id, priority);

CREATE INDEX IF NOT EXISTS idx_tasks_due_date
    ON tasks(due_date);


-- ============================================================
-- TASK COMMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS task_comments (
    id BIGSERIAL PRIMARY KEY,

    task_id BIGINT NOT NULL,

    user_id BIGINT NOT NULL,

    content TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_task_comment_task
        FOREIGN KEY (task_id)
        REFERENCES tasks(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_task_comment_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);


CREATE INDEX IF NOT EXISTS idx_task_comments_task
    ON task_comments(task_id);

CREATE INDEX IF NOT EXISTS idx_task_comments_user
    ON task_comments(user_id);


-- ============================================================
-- TASK ACTIVITY
-- ============================================================

CREATE TABLE IF NOT EXISTS task_activity (
    id BIGSERIAL PRIMARY KEY,

    task_id BIGINT NOT NULL,

    user_id BIGINT,

    action VARCHAR(100) NOT NULL,

    old_value TEXT,

    new_value TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_task_activity_task
        FOREIGN KEY (task_id)
        REFERENCES tasks(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_task_activity_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE SET NULL
);


CREATE INDEX IF NOT EXISTS idx_task_activity_task
    ON task_activity(task_id);

CREATE INDEX IF NOT EXISTS idx_task_activity_user
    ON task_activity(user_id);


-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL,

    title VARCHAR(255) NOT NULL,

    message TEXT NOT NULL,

    type VARCHAR(50),

    is_read BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_notification_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);


CREATE INDEX IF NOT EXISTS idx_notifications_user
    ON notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
    ON notifications(user_id, is_read);


-- ============================================================
-- LABELS
-- ============================================================

CREATE TABLE IF NOT EXISTS labels (
    id BIGSERIAL PRIMARY KEY,

    organization_id BIGINT NOT NULL,

    name VARCHAR(100) NOT NULL,

    color VARCHAR(20),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_label_organization
        FOREIGN KEY (organization_id)
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    CONSTRAINT unique_organization_label
        UNIQUE (organization_id, name)
);


CREATE INDEX IF NOT EXISTS idx_labels_organization
    ON labels(organization_id);


-- ============================================================
-- TASK LABELS
-- ============================================================

CREATE TABLE IF NOT EXISTS task_labels (
    task_id BIGINT NOT NULL,

    label_id BIGINT NOT NULL,

    PRIMARY KEY (task_id, label_id),

    CONSTRAINT fk_task_label_task
        FOREIGN KEY (task_id)
        REFERENCES tasks(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_task_label_label
        FOREIGN KEY (label_id)
        REFERENCES labels(id)
        ON DELETE CASCADE
);


-- ============================================================
-- UPDATED_AT FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS users_updated_at_trigger
ON users;

CREATE TRIGGER users_updated_at_trigger
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


DROP TRIGGER IF EXISTS organizations_updated_at_trigger
ON organizations;

CREATE TRIGGER organizations_updated_at_trigger
BEFORE UPDATE ON organizations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


DROP TRIGGER IF EXISTS organization_members_updated_at_trigger
ON organization_members;

CREATE TRIGGER organization_members_updated_at_trigger
BEFORE UPDATE ON organization_members
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


DROP TRIGGER IF EXISTS projects_updated_at_trigger
ON projects;

CREATE TRIGGER projects_updated_at_trigger
BEFORE UPDATE ON projects
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


DROP TRIGGER IF EXISTS project_members_updated_at_trigger
ON project_members;

CREATE TRIGGER project_members_updated_at_trigger
BEFORE UPDATE ON project_members
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


DROP TRIGGER IF EXISTS tasks_updated_at_trigger
ON tasks;

CREATE TRIGGER tasks_updated_at_trigger
BEFORE UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


DROP TRIGGER IF EXISTS task_comments_updated_at_trigger
ON task_comments;

CREATE TRIGGER task_comments_updated_at_trigger
BEFORE UPDATE ON task_comments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- ORGANIZATION ADMIN LIMIT
--
-- Maximum 3 organization admins.
--
-- IMPORTANT:
-- users.role is NOT used for organization administration.
-- organization_members.role is used.
-- ============================================================

CREATE OR REPLACE FUNCTION check_organization_admin_limit()
RETURNS TRIGGER AS $$
DECLARE
    admin_count INTEGER;
BEGIN

    IF NEW.role = 'admin' THEN

        SELECT COUNT(*)
        INTO admin_count
        FROM organization_members
        WHERE organization_id = NEW.organization_id
          AND role = 'admin'
          AND id <> COALESCE(NEW.id, -1);

        IF admin_count >= 3 THEN

            RAISE EXCEPTION
                'Organization already has the maximum of 3 administrators';

        END IF;

    END IF;

    RETURN NEW;

END;
$$ LANGUAGE plpgsql;


DROP TRIGGER IF EXISTS organization_admin_limit_trigger
ON organization_members;


CREATE TRIGGER organization_admin_limit_trigger
BEFORE INSERT OR UPDATE OF role
ON organization_members
FOR EACH ROW
EXECUTE FUNCTION check_organization_admin_limit();


-- ============================================================
-- PROJECT MEMBER VALIDATION
--
-- A project member MUST already be an organization member.
--
-- Example:
--
-- ABC Organization
--      |
--      +--- Ali
--      +--- Ahmed
--      +--- Rehan
--
-- Website Project
--
-- Only Ali/Ahmed/Rehan can be project members.
-- ============================================================

CREATE OR REPLACE FUNCTION validate_project_member_organization()
RETURNS TRIGGER AS $$
DECLARE
    project_organization_id BIGINT;

    member_exists BOOLEAN;
BEGIN

    SELECT organization_id
    INTO project_organization_id
    FROM projects
    WHERE id = NEW.project_id;

    IF project_organization_id IS NULL THEN

        RAISE EXCEPTION
            'Project does not exist';

    END IF;


    SELECT EXISTS (
        SELECT 1
        FROM organization_members
        WHERE organization_id = project_organization_id
          AND user_id = NEW.user_id
    )
    INTO member_exists;


    IF NOT member_exists THEN

        RAISE EXCEPTION
            'User must belong to the project organization';

    END IF;


    RETURN NEW;

END;
$$ LANGUAGE plpgsql;


DROP TRIGGER IF EXISTS project_member_organization_trigger
ON project_members;


CREATE TRIGGER project_member_organization_trigger
BEFORE INSERT OR UPDATE
ON project_members
FOR EACH ROW
EXECUTE FUNCTION validate_project_member_organization();


-- ============================================================
-- TASK ASSIGNEE VALIDATION
--
-- A task assignee must be a member of the project.
-- ============================================================

CREATE OR REPLACE FUNCTION validate_task_assignee()
RETURNS TRIGGER AS $$
DECLARE
    member_exists BOOLEAN;
BEGIN

    -- NULL assignee is allowed.
    IF NEW.assignee_id IS NULL THEN

        RETURN NEW;

    END IF;


    SELECT EXISTS (
        SELECT 1
        FROM project_members
        WHERE project_id = NEW.project_id
          AND user_id = NEW.assignee_id
    )
    INTO member_exists;


    IF NOT member_exists THEN

        RAISE EXCEPTION
            'Task assignee must be a member of the project';

    END IF;


    RETURN NEW;

END;
$$ LANGUAGE plpgsql;


DROP TRIGGER IF EXISTS task_assignee_validation_trigger
ON tasks;


CREATE TRIGGER task_assignee_validation_trigger
BEFORE INSERT OR UPDATE
ON tasks
FOR EACH ROW
EXECUTE FUNCTION validate_task_assignee();


-- ============================================================
-- REAL-TIME COMMENTS / REPLIES UPGRADE
-- ============================================================

ALTER TABLE task_comments
  ADD COLUMN IF NOT EXISTS parent_id BIGINT REFERENCES task_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_task_comments_parent
  ON task_comments(parent_id);

-- A task can be assigned to any active member of the same organization.
-- This replaces the older project-members-only rule.
CREATE OR REPLACE FUNCTION validate_task_assignee()
RETURNS TRIGGER AS $$
DECLARE
    org_id BIGINT;
    member_exists BOOLEAN;
BEGIN
    IF NEW.assignee_id IS NULL THEN RETURN NEW; END IF;

    SELECT p.organization_id INTO org_id
    FROM projects p WHERE p.id = NEW.project_id;

    IF org_id IS NULL THEN RAISE EXCEPTION 'Project does not exist'; END IF;

    SELECT EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = org_id AND user_id = NEW.assignee_id
    ) INTO member_exists;

    IF NOT member_exists THEN
      RAISE EXCEPTION 'Task assignee must belong to the project organization';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS task_assignee_validation_trigger ON tasks;
CREATE TRIGGER task_assignee_validation_trigger
BEFORE INSERT OR UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION validate_task_assignee();

-- ============================================================
-- END OF CMS SCHEMA
-- ============================================================