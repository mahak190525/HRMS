/*
  # Grievance Management System

  1. Tables
    - `complaint_categories` - Types of complaints
    - `complaints` - Employee complaints and grievances
    - `complaint_comments` - Comments/updates on complaints

  2. Security
    - Enable RLS on all tables
    - Employees can create and view their own complaints
    - HR can view and manage all complaints
*/

-- Create complaint categories table
CREATE TABLE IF NOT EXISTS complaint_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  priority_level text DEFAULT 'medium' CHECK (priority_level IN ('low', 'medium', 'high', 'urgent')),
  created_at timestamptz DEFAULT now()
);

-- Create complaints table
CREATE TABLE IF NOT EXISTS complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) NOT NULL,
  category_id uuid REFERENCES complaint_categories(id) NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status text DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  assigned_to uuid REFERENCES users(id),
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create complaint comments table
CREATE TABLE IF NOT EXISTS complaint_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid REFERENCES complaints(id) NOT NULL,
  user_id uuid REFERENCES users(id) NOT NULL,
  comment text NOT NULL,
  is_internal boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE complaint_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for complaint_categories
CREATE POLICY "Complaint categories readable by authenticated users"
  ON complaint_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Complaint categories manageable by HR and admins"
  ON complaint_categories FOR ALL
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

-- RLS Policies for complaints
CREATE POLICY "Users can read own complaints"
  ON complaints FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "HR can read all complaints"
  ON complaints FOR SELECT
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

CREATE POLICY "Users can create complaints"
  ON complaints FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own complaints"
  ON complaints FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "HR can manage all complaints"
  ON complaints FOR ALL
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

-- RLS Policies for complaint_comments
CREATE POLICY "Users can read comments on their complaints"
  ON complaint_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM complaints 
      WHERE complaints.id = complaint_comments.complaint_id 
      AND complaints.user_id = auth.uid()
    )
  );

CREATE POLICY "HR can read all complaint comments"
  ON complaint_comments FOR SELECT
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

CREATE POLICY "Users can comment on complaints they have access to"
  ON complaint_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND (
      EXISTS (
        SELECT 1 FROM complaints 
        WHERE complaints.id = complaint_comments.complaint_id 
        AND complaints.user_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role_id IN (
          SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'hr')
        )
      )
    )
  );

-- Insert default complaint categories
INSERT INTO complaint_categories (name, description, priority_level) VALUES
('Harassment', 'Workplace harassment complaints', 'high'),
('Discrimination', 'Discrimination based complaints', 'high'),
('Workplace Environment', 'Issues with workplace conditions', 'medium'),
('Management Issues', 'Problems with management practices', 'medium'),
('Policy Violations', 'Violations of company policies', 'high'),
('Technical Issues', 'IT and technical problems', 'low'),
('Benefits and Compensation', 'Issues with salary, benefits', 'medium'),
('Other', 'Other miscellaneous complaints', 'low');