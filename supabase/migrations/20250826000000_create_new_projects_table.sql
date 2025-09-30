-- Create new projects table with the requested structure
CREATE TABLE IF NOT EXISTS new_projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on-hold', 'cancelled')),
  start_date DATE,
  end_date DATE
);

-- Modify existing project_assignments table to support the new structure
-- Add role_type column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'project_assignments' AND column_name = 'role_type') THEN
    ALTER TABLE project_assignments ADD COLUMN role_type VARCHAR(50) DEFAULT NULL;
  END IF;
END $$;

-- Add custom_role_name column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'project_assignments' AND column_name = 'custom_role_name') THEN
    ALTER TABLE project_assignments ADD COLUMN custom_role_name VARCHAR(255);
  END IF;
END $$;

-- Add assigned_at column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'project_assignments' AND column_name = 'assigned_at') THEN
    ALTER TABLE project_assignments ADD COLUMN assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- Add is_active column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'project_assignments' AND column_name = 'is_active') THEN
    ALTER TABLE project_assignments ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Update existing records to have role_type = 'Development' if they don't have it
UPDATE project_assignments SET role_type = 'Development' WHERE role_type IS NULL;

-- Add constraint for role_type if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                 WHERE constraint_name = 'project_assignments_role_type_check') THEN
    ALTER TABLE project_assignments ADD CONSTRAINT project_assignments_role_type_check 
    CHECK (role_type IS NULL OR role_type IN ('QA', 'Development', 'Design', 'Testing', 'Management', 'Support', 'Other'));
  END IF;
END $$;

-- Add unique constraint if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE constraint_name = 'project_assignments_project_user_unique') THEN
    ALTER TABLE project_assignments ADD CONSTRAINT project_assignments_project_user_unique 
    UNIQUE(project_id, user_id);
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_new_projects_created_by ON new_projects(created_by);
CREATE INDEX IF NOT EXISTS idx_new_projects_status ON new_projects(status);
CREATE INDEX IF NOT EXISTS idx_new_projects_created_at ON new_projects(created_at);

-- Update foreign key reference to point to new_projects table
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
             WHERE constraint_name = 'project_assignments_project_id_fkey') THEN
    ALTER TABLE project_assignments DROP CONSTRAINT project_assignments_project_id_fkey;
  END IF;
END $$;

ALTER TABLE project_assignments ADD CONSTRAINT project_assignments_project_id_fkey 
FOREIGN KEY (project_id) REFERENCES new_projects(id) ON DELETE CASCADE;

-- Create indexes for project_assignments
CREATE INDEX IF NOT EXISTS idx_project_assignments_project_id ON project_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_assignments_user_id ON project_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_project_assignments_role_type ON project_assignments(role_type);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_new_projects_updated_at 
  BEFORE UPDATE ON new_projects 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE new_projects ENABLE ROW LEVEL SECURITY;

-- Policy for users to view projects they are assigned to or manage
CREATE POLICY "Users can view projects they are assigned to or manage" ON new_projects
  FOR SELECT USING (
    created_by = (SELECT id FROM public.users WHERE email = current_setting('request.jwt.claims', true)::json->>'email') OR
    EXISTS (
      SELECT 1 FROM project_assignments 
      WHERE project_id = new_projects.id 
      AND user_id = (SELECT id FROM public.users WHERE email = current_setting('request.jwt.claims', true)::json->>'email')
    )
  );

-- Policy for users to insert projects
CREATE POLICY "Users can create projects" ON new_projects
  FOR INSERT WITH CHECK (created_by = (SELECT id FROM public.users WHERE email = current_setting('request.jwt.claims', true)::json->>'email'));

-- Policy for users to update projects they created or manage
CREATE POLICY "Users can update projects they created or manage" ON new_projects
  FOR UPDATE USING (
    created_by = (SELECT id FROM public.users WHERE email = current_setting('request.jwt.claims', true)::json->>'email') OR
    EXISTS (
      SELECT 1 FROM project_assignments 
      WHERE project_id = new_projects.id 
      AND user_id = (SELECT id FROM public.users WHERE email = current_setting('request.jwt.claims', true)::json->>'email')
      AND role_type = 'Management'
    )
  );

-- Policy for users to delete projects they created
CREATE POLICY "Users can delete projects they created" ON new_projects
  FOR DELETE USING (created_by = (SELECT id FROM public.users WHERE email = current_setting('request.jwt.claims', true)::json->>'email'));

-- Add RLS policies for project_assignments table
ALTER TABLE project_assignments ENABLE ROW LEVEL SECURITY;

-- Simple policy: users can view assignments for projects they created or are assigned to
CREATE POLICY "Users can view project assignments they have access to" ON project_assignments
  FOR SELECT USING (
    user_id = (SELECT id FROM public.users WHERE email = current_setting('request.jwt.claims', true)::json->>'email') OR
    EXISTS (
      SELECT 1 FROM new_projects 
      WHERE id = project_assignments.project_id 
      AND created_by = (SELECT id FROM public.users WHERE email = current_setting('request.jwt.claims', true)::json->>'email')
    )
  );

-- Simple policy: users can insert assignments for projects they created
CREATE POLICY "Users can create project assignments for projects they manage" ON project_assignments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM new_projects 
      WHERE id = project_assignments.project_id 
      AND created_by = (SELECT id FROM public.users WHERE email = current_setting('request.jwt.claims', true)::json->>'email')
    )
  );

-- Simple policy: users can update assignments for projects they created
CREATE POLICY "Users can update project assignments for projects they manage" ON project_assignments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM new_projects 
      WHERE id = project_assignments.project_id 
      AND created_by = (SELECT id FROM public.users WHERE email = current_setting('request.jwt.claims', true)::json->>'email')
    )
  );

-- Simple policy: users can delete assignments for projects they created
CREATE POLICY "Users can delete project assignments for projects they manage" ON project_assignments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM new_projects 
      WHERE id = project_assignments.project_id 
      AND created_by = (SELECT id FROM public.users WHERE email = current_setting('request.jwt.claims', true)::json->>'email')
    )
  );

-- Grant permissions
GRANT ALL ON new_projects TO authenticated;
GRANT ALL ON project_assignments TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
