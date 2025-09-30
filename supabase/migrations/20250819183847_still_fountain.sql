/*
  # Add Finance Roles and Permissions

  1. New Roles
    - `finance` - Finance team member
    - `finance_manager` - Finance team manager

  2. Security
    - Finance roles can access finance dashboard
    - Finance managers have additional BD team access
    - Update role-based dashboard mappings
*/

-- Insert finance roles if they don't exist
INSERT INTO roles (name, description, default_dashboards, permissions) 
VALUES 
  ('finance', 'Finance Team Member', ARRAY['self', 'finance'], '{"finance": true}'),
  ('finance_manager', 'Finance Team Manager', ARRAY['self', 'finance', 'bd_team'], '{"finance": true, "manager": true}')
ON CONFLICT (name) DO NOTHING;

-- Update existing HR role to include finance dashboard access
UPDATE roles 
SET default_dashboards = array_append(default_dashboards, 'finance')
WHERE name = 'hr' AND NOT ('finance' = ANY(default_dashboards));

-- Create sample finance users for testing
DO $$
DECLARE
  finance_role_id uuid;
  finance_manager_role_id uuid;
  finance_dept_id uuid;
BEGIN
  -- Get role IDs
  SELECT id INTO finance_role_id FROM roles WHERE name = 'finance';
  SELECT id INTO finance_manager_role_id FROM roles WHERE name = 'finance_manager';
  SELECT id INTO finance_dept_id FROM departments WHERE name = 'Finance';
  
  -- Insert sample finance users if they don't exist
  INSERT INTO users (
    auth_provider, 
    provider_user_id, 
    email, 
    password_hash, 
    full_name, 
    employee_id, 
    role_id, 
    department_id, 
    position, 
    status,
    extra_permissions
  ) VALUES 
    (
      'manual', 
      'finance@company.com', 
      'finance@company.com', 
      encode(digest('finance123', 'sha256'), 'base64'), 
      'Finance Manager', 
      'FIN001', 
      finance_manager_role_id, 
      finance_dept_id, 
      'Finance Manager', 
      'active',
      '{"dashboards": {"finance": true, "bd_team": true}}'::jsonb
    ),
    (
      'manual', 
      'accountant@company.com', 
      'accountant@company.com', 
      encode(digest('accountant123', 'sha256'), 'base64'), 
      'Senior Accountant', 
      'FIN002', 
      finance_role_id, 
      finance_dept_id, 
      'Senior Accountant', 
      'active',
      '{"dashboards": {"finance": true}}'::jsonb
    )
  ON CONFLICT (email) DO NOTHING;
END $$;