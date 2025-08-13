/*
  # Exit Management System

  1. Tables
    - `exit_processes` - Employee exit process tracking
    - `exit_clearance_items` - Clearance checklist items
    - `exit_interviews` - Exit interview scheduling and feedback
    - `exit_documents` - Documents for departing employees

  2. Security
    - Enable RLS on all tables
    - Employees can view their own exit process
    - HR can manage all exit processes
*/

-- Create exit processes table
CREATE TABLE IF NOT EXISTS exit_processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) NOT NULL,
  resignation_date date NOT NULL,
  last_working_day date NOT NULL,
  notice_period_days integer NOT NULL,
  reason_for_leaving text,
  new_company text,
  new_position text,
  exit_type text DEFAULT 'resignation' CHECK (exit_type IN ('resignation', 'termination', 'retirement', 'contract_end')),
  status text DEFAULT 'initiated' CHECK (status IN ('initiated', 'in_progress', 'clearance_pending', 'completed')),
  initiated_by uuid REFERENCES users(id) NOT NULL,
  hr_approved boolean DEFAULT false,
  hr_approved_by uuid REFERENCES users(id),
  hr_approved_at timestamptz,
  final_settlement_amount numeric(10,2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id) -- One exit process per user
);

-- Create exit clearance items table
CREATE TABLE IF NOT EXISTS exit_clearance_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exit_process_id uuid REFERENCES exit_processes(id) NOT NULL,
  item_name text NOT NULL,
  description text,
  responsible_department text,
  responsible_person uuid REFERENCES users(id),
  is_completed boolean DEFAULT false,
  completed_at timestamptz,
  completed_by uuid REFERENCES users(id),
  comments text,
  is_mandatory boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create exit interviews table
CREATE TABLE IF NOT EXISTS exit_interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exit_process_id uuid REFERENCES exit_processes(id) NOT NULL,
  interviewer_id uuid REFERENCES users(id) NOT NULL,
  scheduled_at timestamptz,
  completed_at timestamptz,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  overall_satisfaction_rating numeric(3,2) CHECK (overall_satisfaction_rating >= 1.0 AND overall_satisfaction_rating <= 5.0),
  work_environment_rating numeric(3,2) CHECK (work_environment_rating >= 1.0 AND work_environment_rating <= 5.0),
  management_rating numeric(3,2) CHECK (management_rating >= 1.0 AND management_rating <= 5.0),
  growth_opportunities_rating numeric(3,2) CHECK (growth_opportunities_rating >= 1.0 AND growth_opportunities_rating <= 5.0),
  compensation_rating numeric(3,2) CHECK (compensation_rating >= 1.0 AND compensation_rating <= 5.0),
  what_did_you_like_most text,
  what_could_be_improved text,
  reason_for_leaving_detailed text,
  would_recommend_company boolean,
  would_consider_returning boolean,
  additional_feedback text,
  testimonial text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create exit documents table
CREATE TABLE IF NOT EXISTS exit_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exit_process_id uuid REFERENCES exit_processes(id) NOT NULL,
  document_type text NOT NULL,
  document_name text NOT NULL,
  file_url text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'generated', 'sent', 'acknowledged')),
  generated_by uuid REFERENCES users(id),
  generated_at timestamptz,
  sent_at timestamptz,
  acknowledged_at timestamptz,
  is_required boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE exit_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE exit_clearance_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE exit_interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE exit_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for exit_processes
CREATE POLICY "Users can read own exit process"
  ON exit_processes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "HR can read all exit processes"
  ON exit_processes FOR SELECT
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

CREATE POLICY "Users can initiate own exit process"
  ON exit_processes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND initiated_by = auth.uid());

CREATE POLICY "Users can update own exit process"
  ON exit_processes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "HR can manage all exit processes"
  ON exit_processes FOR ALL
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

-- RLS Policies for exit_clearance_items
CREATE POLICY "Users can read own exit clearance items"
  ON exit_clearance_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM exit_processes
      WHERE exit_processes.id = exit_clearance_items.exit_process_id
      AND exit_processes.user_id = auth.uid()
    )
  );

CREATE POLICY "HR can read all exit clearance items"
  ON exit_clearance_items FOR SELECT
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

CREATE POLICY "Responsible persons can update clearance items"
  ON exit_clearance_items FOR UPDATE
  TO authenticated
  USING (
    responsible_person = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role_id IN (
        SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'hr')
      )
    )
  );

CREATE POLICY "HR can manage exit clearance items"
  ON exit_clearance_items FOR ALL
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

-- RLS Policies for exit_interviews
CREATE POLICY "Users can read own exit interviews"
  ON exit_interviews FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM exit_processes
      WHERE exit_processes.id = exit_interviews.exit_process_id
      AND exit_processes.user_id = auth.uid()
    )
  );

CREATE POLICY "Interviewers can read their exit interviews"
  ON exit_interviews FOR SELECT
  TO authenticated
  USING (interviewer_id = auth.uid());

CREATE POLICY "HR can read all exit interviews"
  ON exit_interviews FOR SELECT
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

CREATE POLICY "HR and interviewers can manage exit interviews"
  ON exit_interviews FOR ALL
  TO authenticated
  USING (
    interviewer_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role_id IN (
        SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'hr')
      )
    )
  );

-- RLS Policies for exit_documents
CREATE POLICY "Users can read own exit documents"
  ON exit_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM exit_processes
      WHERE exit_processes.id = exit_documents.exit_process_id
      AND exit_processes.user_id = auth.uid()
    )
  );

CREATE POLICY "HR can read all exit documents"
  ON exit_documents FOR SELECT
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

CREATE POLICY "HR can manage exit documents"
  ON exit_documents FOR ALL
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

-- Function to create default clearance items when exit process is created
CREATE OR REPLACE FUNCTION create_default_clearance_items()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert default clearance items
  INSERT INTO exit_clearance_items (exit_process_id, item_name, description, responsible_department, is_mandatory) VALUES
  (NEW.id, 'Return Company Laptop', 'Return assigned laptop and accessories', 'IT', true),
  (NEW.id, 'Return Access Cards', 'Return office access cards and keys', 'Security', true),
  (NEW.id, 'Knowledge Transfer', 'Complete knowledge transfer documentation', 'Manager', true),
  (NEW.id, 'Project Handover', 'Hand over ongoing projects and responsibilities', 'Manager', true),
  (NEW.id, 'Clear Pending Expenses', 'Submit and clear all pending expense claims', 'Finance', true),
  (NEW.id, 'Return Company Assets', 'Return any other company assets', 'HR', true),
  (NEW.id, 'Update Emergency Contacts', 'Provide updated contact information', 'HR', false),
  (NEW.id, 'Library Clearance', 'Return any borrowed books or materials', 'Admin', false);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for default clearance items
CREATE TRIGGER create_clearance_items_trigger
  AFTER INSERT ON exit_processes
  FOR EACH ROW
  EXECUTE FUNCTION create_default_clearance_items();

-- Function to update exit process status based on clearance completion
CREATE OR REPLACE FUNCTION update_exit_process_status()
RETURNS TRIGGER AS $$
DECLARE
  total_mandatory_items integer;
  completed_mandatory_items integer;
BEGIN
  -- Count mandatory clearance items
  SELECT COUNT(*) INTO total_mandatory_items
  FROM exit_clearance_items
  WHERE exit_process_id = NEW.exit_process_id AND is_mandatory = true;
  
  -- Count completed mandatory items
  SELECT COUNT(*) INTO completed_mandatory_items
  FROM exit_clearance_items
  WHERE exit_process_id = NEW.exit_process_id AND is_mandatory = true AND is_completed = true;
  
  -- Update exit process status
  IF completed_mandatory_items = total_mandatory_items THEN
    UPDATE exit_processes 
    SET status = 'completed', updated_at = now()
    WHERE id = NEW.exit_process_id;
  ELSIF completed_mandatory_items > 0 THEN
    UPDATE exit_processes 
    SET status = 'clearance_pending', updated_at = now()
    WHERE id = NEW.exit_process_id AND status = 'initiated';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for exit process status updates
CREATE TRIGGER update_exit_status_trigger
  AFTER UPDATE ON exit_clearance_items
  FOR EACH ROW
  WHEN (OLD.is_completed IS DISTINCT FROM NEW.is_completed)
  EXECUTE FUNCTION update_exit_process_status();