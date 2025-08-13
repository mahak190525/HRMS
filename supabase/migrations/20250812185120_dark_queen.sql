/*
  # HRMS Core Database Schema

  1. Core Tables
    - `roles` - User roles and permissions
    - `users` - Custom user management (no Supabase auth.users)
    - `departments` - Company departments
    - `projects` - Company projects for time tracking

  2. Security
    - Enable RLS on all tables
    - Add appropriate policies for role-based access
    - Secure data access based on user roles and permissions

  3. Key Features
    - Custom authentication system
    - Three-level permission model (role, dashboard, feature)
    - Multi-provider SSO support (Microsoft, Google, Manual)
    - Comprehensive user management
*/

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  default_dashboards text[] DEFAULT '{}',
  permissions jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create departments table
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  manager_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  client_name text,
  description text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on_hold', 'cancelled')),
  start_date date,
  end_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create users table (custom authentication)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_provider text NOT NULL CHECK (auth_provider IN ('microsoft', 'google', 'manual')),
  provider_user_id text NOT NULL,
  email text UNIQUE NOT NULL,
  password_hash text, -- Only for manual auth
  full_name text NOT NULL,
  employee_id text UNIQUE,
  role_id uuid REFERENCES roles(id),
  department_id uuid REFERENCES departments(id),
  position text,
  avatar_url text,
  phone text,
  address text,
  date_of_birth date,
  date_of_joining date,
  salary numeric(10,2),
  extra_permissions jsonb DEFAULT '{}',
  status text DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'inactive')),
  last_login timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Unique constraint for provider + provider_user_id
  UNIQUE(auth_provider, provider_user_id)
);

-- Add foreign key constraint for department manager
ALTER TABLE departments ADD CONSTRAINT fk_departments_manager 
  FOREIGN KEY (manager_id) REFERENCES users(id);

-- Enable RLS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for roles
CREATE POLICY "Roles readable by authenticated users"
  ON roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Roles manageable by admins"
  ON roles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role_id IN (
        SELECT id FROM roles WHERE name IN ('super_admin', 'admin')
      )
    )
  );

-- RLS Policies for departments
CREATE POLICY "Departments readable by authenticated users"
  ON departments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Departments manageable by HR and admins"
  ON departments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role_id IN (
        SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'hr')
      )
    )
  );

-- RLS Policies for projects
CREATE POLICY "Projects readable by authenticated users"
  ON projects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Projects manageable by managers and admins"
  ON projects FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role_id IN (
        SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'hr', 'sdm', 'bdm', 'qam')
      )
    )
  );

-- RLS Policies for users
CREATE POLICY "Users can read own data"
  ON users FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "HR and admins can read all users"
  ON users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() 
      AND u.role_id IN (
        SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'hr')
      )
    )
  );

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "HR and admins can manage all users"
  ON users FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() 
      AND u.role_id IN (
        SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'hr')
      )
    )
  );

-- Insert default roles
INSERT INTO roles (name, description, default_dashboards, permissions) VALUES
('super_admin', 'Super Administrator', ARRAY['self', 'employee_management', 'performance', 'grievance', 'bd_team', 'finance', 'ats', 'lms', 'exit'], '{"all": true}'),
('admin', 'Administrator', ARRAY['self', 'employee_management', 'performance', 'grievance', 'bd_team', 'finance', 'ats', 'lms', 'exit'], '{"all": true}'),
('hr', 'Human Resources', ARRAY['self', 'ats', 'grievance', 'employee_management', 'performance'], '{"hr": true}'),
('sdm', 'Service Delivery Manager', ARRAY['self', 'performance', 'lms'], '{"manager": true}'),
('bdm', 'Business Development Manager', ARRAY['self', 'performance', 'lms', 'bd_team'], '{"manager": true}'),
('qam', 'Quality Assurance Manager', ARRAY['self', 'performance', 'lms'], '{"manager": true}'),
('employee', 'Employee', ARRAY['self'], '{"employee": true}'),
('candidate', 'Candidate', ARRAY['ats', 'lms'], '{"candidate": true}'),
('ex_employee', 'Ex Employee', ARRAY['exit'], '{"ex_employee": true}');

-- Insert default departments
INSERT INTO departments (name, description) VALUES
('Human Resources', 'HR Department'),
('Finance', 'Finance Department'),
('Business Development', 'BD Department'),
('Service Delivery', 'SD Department'),
('Quality Assurance', 'QA Department'),
('Engineering', 'Engineering Department'),
('Marketing', 'Marketing Department');