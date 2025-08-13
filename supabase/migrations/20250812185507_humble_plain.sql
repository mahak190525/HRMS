/*
  # Time Tracking & Project Management

  1. Tables
    - `time_entries` - Daily project time logging
    - `project_assignments` - User-project assignments
    - `holidays` - Company holidays calendar
    - `attendance_summary` - Monthly attendance summaries

  2. Security
    - Enable RLS on all tables
    - Users can manage their own time entries
    - Managers can view team time entries
    - HR can view all time tracking data
*/

-- Create time entries table for daily project logging
CREATE TABLE IF NOT EXISTS time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) NOT NULL,
  project_id uuid REFERENCES projects(id) NOT NULL,
  entry_date date NOT NULL,
  hours_worked numeric(4,2) NOT NULL CHECK (hours_worked > 0 AND hours_worked <= 24),
  description text,
  task_type text DEFAULT 'development' CHECK (task_type IN ('development', 'testing', 'design', 'meeting', 'documentation', 'research', 'other')),
  is_billable boolean DEFAULT true,
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz,
  status text DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id, project_id, entry_date) -- One entry per user per project per day
);

-- Create project assignments table
CREATE TABLE IF NOT EXISTS project_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) NOT NULL,
  project_id uuid REFERENCES projects(id) NOT NULL,
  role text DEFAULT 'developer',
  hourly_rate numeric(8,2),
  start_date date DEFAULT CURRENT_DATE,
  end_date date,
  is_active boolean DEFAULT true,
  assigned_by uuid REFERENCES users(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id, project_id)
);

-- Create holidays table
CREATE TABLE IF NOT EXISTS holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  date date NOT NULL,
  is_optional boolean DEFAULT false,
  description text,
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(date)
);

-- Create attendance summary table
CREATE TABLE IF NOT EXISTS attendance_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) NOT NULL,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  year integer NOT NULL,
  total_working_days integer NOT NULL,
  days_present integer DEFAULT 0,
  days_absent integer DEFAULT 0,
  days_on_leave integer DEFAULT 0,
  total_hours_worked numeric(6,2) DEFAULT 0,
  overtime_hours numeric(6,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id, month, year)
);

-- Enable RLS
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_summary ENABLE ROW LEVEL SECURITY;

-- RLS Policies for time_entries
CREATE POLICY "Users can read own time entries"
  ON time_entries FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Managers can read team time entries"
  ON time_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u1, users u2
      WHERE u1.id = auth.uid() 
      AND u2.id = time_entries.user_id
      AND u1.department_id = u2.department_id
      AND u1.role_id IN (
        SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'hr', 'sdm', 'bdm', 'qam')
      )
    )
  );

CREATE POLICY "Users can manage own time entries"
  ON time_entries FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Managers can approve team time entries"
  ON time_entries FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u1, users u2
      WHERE u1.id = auth.uid() 
      AND u2.id = time_entries.user_id
      AND u1.department_id = u2.department_id
      AND u1.role_id IN (
        SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'hr', 'sdm', 'bdm', 'qam')
      )
    )
  );

-- RLS Policies for project_assignments
CREATE POLICY "Users can read own project assignments"
  ON project_assignments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Managers can read team project assignments"
  ON project_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u1, users u2
      WHERE u1.id = auth.uid() 
      AND u2.id = project_assignments.user_id
      AND u1.department_id = u2.department_id
      AND u1.role_id IN (
        SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'hr', 'sdm', 'bdm', 'qam')
      )
    )
  );

CREATE POLICY "Managers can manage project assignments"
  ON project_assignments FOR ALL
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

-- RLS Policies for holidays
CREATE POLICY "Holidays readable by authenticated users"
  ON holidays FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "HR can manage holidays"
  ON holidays FOR ALL
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

-- RLS Policies for attendance_summary
CREATE POLICY "Users can read own attendance summary"
  ON attendance_summary FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Managers can read team attendance summary"
  ON attendance_summary FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u1, users u2
      WHERE u1.id = auth.uid() 
      AND u2.id = attendance_summary.user_id
      AND u1.department_id = u2.department_id
      AND u1.role_id IN (
        SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'hr', 'sdm', 'bdm', 'qam')
      )
    )
  );

CREATE POLICY "HR can manage attendance summary"
  ON attendance_summary FOR ALL
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

-- Insert default holidays for 2025
INSERT INTO holidays (name, date, is_optional, description) VALUES
('New Year''s Day', '2025-01-01', false, 'New Year celebration'),
('Republic Day', '2025-01-26', false, 'Indian Republic Day'),
('Holi', '2025-03-14', false, 'Festival of Colors'),
('Good Friday', '2025-04-18', false, 'Christian holiday'),
('Independence Day', '2025-08-15', false, 'Indian Independence Day'),
('Gandhi Jayanti', '2025-10-02', false, 'Mahatma Gandhi''s Birthday'),
('Diwali', '2025-10-20', false, 'Festival of Lights'),
('Christmas Day', '2025-12-25', false, 'Christian holiday'),
('Dussehra', '2025-10-12', true, 'Hindu festival'),
('Karva Chauth', '2025-11-01', true, 'Hindu festival');

-- Function to calculate attendance summary
CREATE OR REPLACE FUNCTION calculate_attendance_summary(p_user_id uuid, p_month integer, p_year integer)
RETURNS void AS $$
DECLARE
  working_days integer;
  present_days integer;
  leave_days integer;
  total_hours numeric(6,2);
BEGIN
  -- Calculate working days (excluding weekends and holidays)
  SELECT COUNT(*)
  INTO working_days
  FROM generate_series(
    DATE(p_year || '-' || p_month || '-01'),
    (DATE(p_year || '-' || p_month || '-01') + INTERVAL '1 month - 1 day')::date,
    '1 day'::interval
  ) AS day_series(day)
  WHERE EXTRACT(DOW FROM day) NOT IN (0, 6) -- Exclude Sunday (0) and Saturday (6)
    AND day NOT IN (SELECT date FROM holidays WHERE EXTRACT(MONTH FROM date) = p_month AND EXTRACT(YEAR FROM date) = p_year);

  -- Calculate days present from time entries
  SELECT COUNT(DISTINCT entry_date)
  INTO present_days
  FROM time_entries
  WHERE user_id = p_user_id
    AND EXTRACT(MONTH FROM entry_date) = p_month
    AND EXTRACT(YEAR FROM entry_date) = p_year;

  -- Calculate leave days
  SELECT COALESCE(SUM(days_count), 0)
  INTO leave_days
  FROM leave_applications
  WHERE user_id = p_user_id
    AND status = 'approved'
    AND EXTRACT(MONTH FROM start_date) = p_month
    AND EXTRACT(YEAR FROM start_date) = p_year;

  -- Calculate total hours worked
  SELECT COALESCE(SUM(hours_worked), 0)
  INTO total_hours
  FROM time_entries
  WHERE user_id = p_user_id
    AND EXTRACT(MONTH FROM entry_date) = p_month
    AND EXTRACT(YEAR FROM entry_date) = p_year;

  -- Insert or update attendance summary
  INSERT INTO attendance_summary (user_id, month, year, total_working_days, days_present, days_absent, days_on_leave, total_hours_worked)
  VALUES (p_user_id, p_month, p_year, working_days, present_days, working_days - present_days - leave_days, leave_days, total_hours)
  ON CONFLICT (user_id, month, year)
  DO UPDATE SET
    total_working_days = EXCLUDED.total_working_days,
    days_present = EXCLUDED.days_present,
    days_absent = EXCLUDED.days_absent,
    days_on_leave = EXCLUDED.days_on_leave,
    total_hours_worked = EXCLUDED.total_hours_worked,
    updated_at = now();
END;
$$ LANGUAGE plpgsql;