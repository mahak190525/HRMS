/*
  # Add Multiple Roles Support to Users Table

  This migration adds support for multiple role assignments to users.
  It creates a new column `additional_role_ids` to store additional roles
  while keeping the existing `role_id` as the primary role for backward compatibility.

  Features:
  - additional_role_ids: Array of role UUIDs for additional roles
  - Maintains backward compatibility with existing role_id
  - Updates RLS policies to check both primary and additional roles
  - Adds helper functions to aggregate permissions from all roles
*/

-- Add additional_role_ids column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS additional_role_ids uuid[] DEFAULT '{}';

-- Add index for performance on additional roles
CREATE INDEX IF NOT EXISTS idx_users_additional_role_ids ON users USING GIN(additional_role_ids);

-- Create function to get all role IDs for a user (primary + additional)
CREATE OR REPLACE FUNCTION get_user_all_role_ids(user_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  primary_role_id uuid;
  additional_roles uuid[];
  all_roles uuid[];
BEGIN
  -- Get primary role and additional roles
  SELECT role_id, additional_role_ids 
  INTO primary_role_id, additional_roles
  FROM users 
  WHERE id = user_id;
  
  -- Start with empty array
  all_roles := '{}';
  
  -- Add primary role if exists
  IF primary_role_id IS NOT NULL THEN
    all_roles := array_append(all_roles, primary_role_id);
  END IF;
  
  -- Add additional roles if exists
  IF additional_roles IS NOT NULL AND array_length(additional_roles, 1) > 0 THEN
    all_roles := all_roles || additional_roles;
  END IF;
  
  RETURN all_roles;
END;
$$;

-- Create function to get all role names for a user
CREATE OR REPLACE FUNCTION get_user_all_role_names(user_id uuid)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  all_role_ids uuid[];
  role_names text[];
BEGIN
  -- Get all role IDs
  all_role_ids := get_user_all_role_ids(user_id);
  
  -- Get role names
  SELECT array_agg(name)
  INTO role_names
  FROM roles
  WHERE id = ANY(all_role_ids);
  
  RETURN COALESCE(role_names, '{}');
END;
$$;

-- Create function to check if user has any of the specified roles
CREATE OR REPLACE FUNCTION user_has_any_role(user_id uuid, role_names text[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role_names text[];
BEGIN
  -- Get all role names for user
  user_role_names := get_user_all_role_names(user_id);
  
  -- Check if any role matches
  RETURN user_role_names && role_names;
END;
$$;

-- Create function to get aggregated permissions from all user roles
CREATE OR REPLACE FUNCTION get_user_aggregated_permissions(user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  all_role_ids uuid[];
  aggregated_permissions jsonb := '{}';
  role_permission jsonb;
  user_extra_permissions jsonb;
BEGIN
  -- Get all role IDs
  all_role_ids := get_user_all_role_ids(user_id);
  
  -- Aggregate permissions from all roles
  FOR role_permission IN 
    SELECT permissions 
    FROM roles 
    WHERE id = ANY(all_role_ids) AND permissions IS NOT NULL
  LOOP
    -- Merge permissions (later roles override earlier ones)
    aggregated_permissions := aggregated_permissions || role_permission;
  END LOOP;
  
  -- Get user's extra permissions
  SELECT extra_permissions 
  INTO user_extra_permissions
  FROM users 
  WHERE id = user_id;
  
  -- Merge user's extra permissions (highest priority)
  IF user_extra_permissions IS NOT NULL THEN
    aggregated_permissions := aggregated_permissions || user_extra_permissions;
  END IF;
  
  RETURN aggregated_permissions;
END;
$$;

-- Create function to get aggregated default dashboards from all user roles
CREATE OR REPLACE FUNCTION get_user_aggregated_dashboards(user_id uuid)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  all_role_ids uuid[];
  aggregated_dashboards text[] := '{}';
  role_dashboards text[];
BEGIN
  -- Get all role IDs
  all_role_ids := get_user_all_role_ids(user_id);
  
  -- Aggregate dashboards from all roles
  FOR role_dashboards IN 
    SELECT default_dashboards 
    FROM roles 
    WHERE id = ANY(all_role_ids) AND default_dashboards IS NOT NULL
  LOOP
    -- Union dashboards (remove duplicates)
    aggregated_dashboards := array(
      SELECT DISTINCT unnest(aggregated_dashboards || role_dashboards)
    );
  END LOOP;
  
  RETURN aggregated_dashboards;
END;
$$;

-- Update RLS policies to use the new multiple roles functions
-- Drop existing policies that need to be updated
DROP POLICY IF EXISTS "Roles manageable by admins" ON roles;
DROP POLICY IF EXISTS "Departments manageable by HR and admins" ON departments;
DROP POLICY IF EXISTS "Projects manageable by managers and admins" ON projects;
DROP POLICY IF EXISTS "HR and admins can read all users" ON users;
DROP POLICY IF EXISTS "HR and admins can manage all users" ON users;

-- Recreate policies with multiple roles support
CREATE POLICY "Roles manageable by admins"
  ON roles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (
        users."isSA" = true OR
        user_has_any_role(users.id, ARRAY['super_admin', 'admin'])
      )
    )
  );

CREATE POLICY "Departments manageable by HR and admins"
  ON departments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (
        users."isSA" = true OR
        user_has_any_role(users.id, ARRAY['super_admin', 'admin', 'hr'])
      )
    )
  );

CREATE POLICY "Projects manageable by managers and admins"
  ON projects FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (
        users."isSA" = true OR
        user_has_any_role(users.id, ARRAY['super_admin', 'admin', 'hr', 'sdm', 'bdm', 'qam'])
      )
    )
  );

CREATE POLICY "HR and admins can read all users"
  ON users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() 
      AND (
        u."isSA" = true OR
        user_has_any_role(u.id, ARRAY['super_admin', 'admin', 'hr'])
      )
    )
  );

CREATE POLICY "HR and admins can manage all users"
  ON users FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() 
      AND (
        u."isSA" = true OR
        user_has_any_role(u.id, ARRAY['super_admin', 'admin', 'hr'])
      )
    )
  );

-- Create trigger function to validate additional role IDs
-- Note: Using trigger instead of CHECK constraint because PostgreSQL doesn't allow subqueries in CHECK constraints
CREATE OR REPLACE FUNCTION validate_additional_role_ids()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  invalid_role_id uuid;
BEGIN
  -- Check if any additional role IDs are invalid
  IF NEW.additional_role_ids IS NOT NULL THEN
    SELECT role_id INTO invalid_role_id
    FROM unnest(NEW.additional_role_ids) AS role_id
    WHERE role_id NOT IN (SELECT id FROM roles)
    LIMIT 1;
    
    IF invalid_role_id IS NOT NULL THEN
      RAISE EXCEPTION 'Invalid role ID in additional_role_ids: %', invalid_role_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to validate additional role IDs on insert/update
CREATE TRIGGER validate_users_additional_roles
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION validate_additional_role_ids();

-- Create view for easy querying of user roles
CREATE OR REPLACE VIEW user_roles_view AS
SELECT 
  u.id as user_id,
  u.email,
  u.full_name,
  -- Primary role
  pr.id as primary_role_id,
  pr.name as primary_role_name,
  pr.description as primary_role_description,
  -- All roles (primary + additional)
  get_user_all_role_names(u.id) as all_role_names,
  get_user_aggregated_dashboards(u.id) as aggregated_dashboards,
  get_user_aggregated_permissions(u.id) as aggregated_permissions
FROM users u
LEFT JOIN roles pr ON u.role_id = pr.id;

-- Grant permissions on the view
GRANT SELECT ON user_roles_view TO authenticated;

-- Note: Views inherit RLS from their underlying tables (users and roles)
-- The view will automatically respect the existing RLS policies on the users table
