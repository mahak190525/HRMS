/*
  # Leave Management System

  1. Tables
    - `leave_types` - Different types of leaves
    - `leave_applications` - Employee leave requests
    - `leave_balances` - Employee leave balances

  2. Security
    - Enable RLS on all tables
    - Employees can manage their own leave applications
    - HR and managers can approve/reject leaves
*/

-- Create leave types table
CREATE TABLE IF NOT EXISTS leave_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  max_days_per_year integer DEFAULT 0,
  carry_forward boolean DEFAULT false,
  requires_approval boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create leave applications table
CREATE TABLE IF NOT EXISTS leave_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) NOT NULL,
  leave_type_id uuid REFERENCES leave_types(id) NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  days_count integer NOT NULL,
  reason text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  applied_at timestamptz DEFAULT now(),
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz,
  comments text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create leave balances table
CREATE TABLE IF NOT EXISTS leave_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) NOT NULL,
  leave_type_id uuid REFERENCES leave_types(id) NOT NULL,
  year integer NOT NULL,
  allocated_days integer DEFAULT 0,
  used_days integer DEFAULT 0,
  remaining_days integer GENERATED ALWAYS AS (allocated_days - used_days) STORED,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id, leave_type_id, year)
);

-- Enable RLS
ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;

-- RLS Policies for leave_types
CREATE POLICY "Leave types readable by authenticated users"
  ON leave_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Leave types manageable by HR and admins"
  ON leave_types FOR ALL
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

-- RLS Policies for leave_applications
CREATE POLICY "Users can read own leave applications"
  ON leave_applications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "HR and managers can read all leave applications"
  ON leave_applications FOR SELECT
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

CREATE POLICY "Users can create own leave applications"
  ON leave_applications FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own pending leave applications"
  ON leave_applications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND status = 'pending')
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "HR and managers can approve/reject leave applications"
  ON leave_applications FOR UPDATE
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

-- RLS Policies for leave_balances
CREATE POLICY "Users can read own leave balances"
  ON leave_balances FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "HR can read all leave balances"
  ON leave_balances FOR SELECT
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

CREATE POLICY "HR can manage leave balances"
  ON leave_balances FOR ALL
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

-- Insert default leave types
INSERT INTO leave_types (name, description, max_days_per_year, carry_forward, requires_approval) VALUES
('Sick Leave', 'Medical leave for illness', 12, false, true),
('Casual Leave', 'General purpose leave', 12, false, true),
('Annual Leave', 'Vacation leave', 21, true, true),
('Maternity Leave', 'Maternity leave for mothers', 180, false, true),
('Paternity Leave', 'Paternity leave for fathers', 15, false, true),
('Emergency Leave', 'Emergency situations', 5, false, true),
('Compensatory Off', 'Compensation for overtime work', 0, false, true);