/*
  # Add Role-Level Dashboard and Page Permissions with CRUD Operations

  This migration adds support for role-level permissions for dashboards and pages
  with granular CRUD operations (read, write, view, delete).

  Features:
  - dashboard_permissions: JSONB field storing dashboard-level CRUD permissions
  - page_permissions: JSONB field storing page-level CRUD permissions per dashboard
  - Structure: { dashboard_id: { read: boolean, write: boolean, view: boolean, delete: boolean } }
*/

-- Add dashboard_permissions column to roles table
ALTER TABLE roles ADD COLUMN IF NOT EXISTS dashboard_permissions jsonb DEFAULT '{}';

-- Add page_permissions column to roles table  
ALTER TABLE roles ADD COLUMN IF NOT EXISTS page_permissions jsonb DEFAULT '{}';

-- Create index for performance on JSONB fields
CREATE INDEX IF NOT EXISTS idx_roles_dashboard_permissions ON roles USING GIN(dashboard_permissions);
CREATE INDEX IF NOT EXISTS idx_roles_page_permissions ON roles USING GIN(page_permissions);

-- Create function to get role dashboard permissions
CREATE OR REPLACE FUNCTION get_role_dashboard_permissions(role_id uuid, dashboard_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  permissions jsonb;
BEGIN
  SELECT dashboard_permissions->dashboard_id
  INTO permissions
  FROM roles
  WHERE id = role_id;
  
  RETURN COALESCE(permissions, '{"read": false, "write": false, "view": false, "delete": false}'::jsonb);
END;
$$;

-- Create function to get role page permissions
CREATE OR REPLACE FUNCTION get_role_page_permissions(role_id uuid, dashboard_id text, page_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  permissions jsonb;
BEGIN
  SELECT page_permissions->dashboard_id->page_id
  INTO permissions
  FROM roles
  WHERE id = role_id;
  
  RETURN COALESCE(permissions, '{"read": false, "write": false, "view": false, "delete": false}'::jsonb);
END;
$$;

-- Create function to aggregate dashboard permissions from all user roles
CREATE OR REPLACE FUNCTION get_user_role_dashboard_permissions(user_id uuid, dashboard_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  all_role_ids uuid[];
  role_permissions jsonb;
  aggregated_permissions jsonb := '{"read": false, "write": false, "view": false, "delete": false}'::jsonb;
BEGIN
  -- Get all role IDs for the user
  all_role_ids := get_user_all_role_ids(user_id);
  
  -- Aggregate permissions from all roles (OR logic - if any role has permission, user has it)
  FOR role_permissions IN 
    SELECT dashboard_permissions->dashboard_id
    FROM roles
    WHERE id = ANY(all_role_ids)
    AND dashboard_permissions->dashboard_id IS NOT NULL
  LOOP
    -- Aggregate: if any role has a permission, grant it
    aggregated_permissions := jsonb_build_object(
      'read', (aggregated_permissions->>'read')::boolean OR COALESCE((role_permissions->>'read')::boolean, false),
      'write', (aggregated_permissions->>'write')::boolean OR COALESCE((role_permissions->>'write')::boolean, false),
      'view', (aggregated_permissions->>'view')::boolean OR COALESCE((role_permissions->>'view')::boolean, false),
      'delete', (aggregated_permissions->>'delete')::boolean OR COALESCE((role_permissions->>'delete')::boolean, false)
    );
  END LOOP;
  
  RETURN aggregated_permissions;
END;
$$;

-- Create function to aggregate page permissions from all user roles
CREATE OR REPLACE FUNCTION get_user_role_page_permissions(user_id uuid, dashboard_id text, page_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  all_role_ids uuid[];
  role_permissions jsonb;
  aggregated_permissions jsonb := '{"read": false, "write": false, "view": false, "delete": false}'::jsonb;
BEGIN
  -- Get all role IDs for the user
  all_role_ids := get_user_all_role_ids(user_id);
  
  -- Aggregate permissions from all roles (OR logic)
  FOR role_permissions IN 
    SELECT page_permissions->dashboard_id->page_id
    FROM roles
    WHERE id = ANY(all_role_ids)
    AND page_permissions->dashboard_id->page_id IS NOT NULL
  LOOP
    -- Aggregate: if any role has a permission, grant it
    aggregated_permissions := jsonb_build_object(
      'read', (aggregated_permissions->>'read')::boolean OR COALESCE((role_permissions->>'read')::boolean, false),
      'write', (aggregated_permissions->>'write')::boolean OR COALESCE((role_permissions->>'write')::boolean, false),
      'view', (aggregated_permissions->>'view')::boolean OR COALESCE((role_permissions->>'view')::boolean, false),
      'delete', (aggregated_permissions->>'delete')::boolean OR COALESCE((role_permissions->>'delete')::boolean, false)
    );
  END LOOP;
  
  RETURN aggregated_permissions;
END;
$$;

-- Add comment to explain the structure
COMMENT ON COLUMN roles.dashboard_permissions IS 'JSONB structure: { "dashboard_id": { "read": boolean, "write": boolean, "view": boolean, "delete": boolean } }';
COMMENT ON COLUMN roles.page_permissions IS 'JSONB structure: { "dashboard_id": { "page_id": { "read": boolean, "write": boolean, "view": boolean, "delete": boolean } } }';

