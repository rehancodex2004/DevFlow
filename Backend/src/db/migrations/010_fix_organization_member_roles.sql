-- Align organization membership roles with the RBAC model.
-- This is a forward migration for databases where 009 was not applied.
DO $$
BEGIN
  ALTER TABLE organization_members
    DROP CONSTRAINT IF EXISTS organization_members_role_check;

  UPDATE organization_members
  SET role = 'user', updated_at = NOW()
  WHERE role = 'member';

  UPDATE organization_members om
  SET role = 'owner', updated_at = NOW()
  FROM organizations o
  WHERE o.id = om.organization_id
    AND o.created_by = om.user_id;

  IF EXISTS (
    SELECT 1
    FROM organization_members
    WHERE role NOT IN ('owner', 'admin', 'user')
  ) THEN
    RAISE EXCEPTION
      'organization_members contains an unsupported role; refusing to install the RBAC role constraint';
  END IF;

  ALTER TABLE organization_members
    ADD CONSTRAINT organization_members_role_check
    CHECK (role IN ('owner', 'admin', 'user'));
END
$$;
