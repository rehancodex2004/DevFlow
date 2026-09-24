-- Migrate legacy organization roles without changing system-level users.role.
UPDATE organization_members om
SET role = 'owner', updated_at = NOW()
FROM organizations o
WHERE o.id = om.organization_id
  AND o.created_by = om.user_id;

UPDATE organization_members
SET role = 'user', updated_at = NOW()
WHERE role = 'member';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organization_members_role_check'
  ) THEN
    ALTER TABLE organization_members DROP CONSTRAINT organization_members_role_check;
  END IF;
END $$;

ALTER TABLE organization_members
  ADD CONSTRAINT organization_members_role_check
  CHECK (role IN ('owner', 'admin', 'user'));

CREATE UNIQUE INDEX IF NOT EXISTS one_owner_per_organization
  ON organization_members (organization_id)
  WHERE role = 'owner';

CREATE TABLE IF NOT EXISTS organization_invitations (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(30) NOT NULL CHECK (role IN ('admin', 'user')),
  token_hash VARCHAR(128) NOT NULL UNIQUE,
  invited_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_invitations_organization
  ON organization_invitations (organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email
  ON organization_invitations (email);
CREATE INDEX IF NOT EXISTS idx_org_invitations_status
  ON organization_invitations (status);
