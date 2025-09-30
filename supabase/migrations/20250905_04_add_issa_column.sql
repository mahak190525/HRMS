/*
  # Add isSA (Super Admin) Column to Users Table

  This migration adds an `isSA` boolean column to the users table.
  When set to true, this column grants a user all admin permissions
  without displaying this status anywhere in the frontend UI.

  Features:
  - isSA column defaults to false
  - Users with isSA=true get full admin permissions
  - isSA status is never exposed in frontend components
  - Database policies updated to include isSA checks
*/

-- Add isSA column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS "isSA" boolean DEFAULT false;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_users_issa ON users("isSA") WHERE "isSA" = true;

-- Update RLS policies to include isSA checks
-- Drop existing policies that need to be updated
DROP POLICY IF EXISTS "Roles manageable by admins" ON roles;
DROP POLICY IF EXISTS "Departments manageable by HR and admins" ON departments;
DROP POLICY IF EXISTS "Projects manageable by managers and admins" ON projects;
DROP POLICY IF EXISTS "HR and admins can read all users" ON users;
DROP POLICY IF EXISTS "HR and admins can manage all users" ON users;

-- Recreate policies with isSA support
CREATE POLICY "Roles manageable by admins"
  ON roles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (
        users."isSA" = true OR
        users.role_id IN (
          SELECT id FROM roles WHERE name IN ('super_admin', 'admin')
        )
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
        users.role_id IN (
          SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'hr')
        )
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
        users.role_id IN (
          SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'hr', 'sdm', 'bdm', 'qam')
        )
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
        u.role_id IN (
          SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'hr')
        )
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
        u.role_id IN (
          SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'hr')
        )
      )
    )
  );