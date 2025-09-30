/*
  # KRA (Key Result Areas) Management System

  1. Tables
    - `kra_templates` - KRA templates created by managers
    - `kra_goals` - Individual KRA goals within templates
    - `kra_assignments` - Assignment of KRA templates to employees
    - `kra_evaluation_levels` - Evaluation level definitions (1-5 scale)
    - `kra_evaluations` - Employee evaluations of assigned KRAs
    - `kra_categories` - Categories for organizing KRA goals

  2. Security
    - Enable RLS on all tables
    - Managers can create and manage KRA templates
    - Employees can view assigned KRAs and add comments
    - HR can view all KRA data

  3. Features
    - Template-based KRA system
    - 5-level evaluation system (Poor Performance → Far Exceeded Expectations)
    - SMART goal structure
    - Employee and manager comments
    - Dependency tracking
    - Weight-based scoring
*/

-- Create KRA categories table (simple lookup for category names)
CREATE TABLE IF NOT EXISTS kra_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create KRA evaluation levels table (defines the 5-level rating system - just for reference)
CREATE TABLE IF NOT EXISTS kra_evaluation_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_number integer NOT NULL CHECK (level_number >= 1 AND level_number <= 5),
  level_name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(level_number)
);

-- Create KRA templates table (created by managers)
CREATE TABLE IF NOT EXISTS kra_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL,
  description text,
  evaluation_period_start date NOT NULL,
  evaluation_period_end date NOT NULL,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  created_by uuid REFERENCES users(id) NOT NULL,
  department_id uuid REFERENCES departments(id),
  total_weight numeric(5,2) DEFAULT 100.0, -- Total weight should equal 100%
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create KRA goals table (individual goals within templates)
CREATE TABLE IF NOT EXISTS kra_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES kra_templates(id) ON DELETE CASCADE NOT NULL,
  goal_id text NOT NULL, -- Custom goal identifier (e.g., "G001", "G002")
  strategic_goal_title text NOT NULL,
  category_id uuid REFERENCES kra_categories(id),
  smart_goal text NOT NULL, -- SMART goal description
  weight numeric(5,2) NOT NULL CHECK (weight > 0 AND weight <= 100),
  max_score numeric(5,2) DEFAULT 100.0,
  target text NOT NULL,
  dependencies text, -- Dependencies on other goals or external factors
  
  -- Evaluation scoring for each level (1-5)
  level_1_marks numeric(5,2) DEFAULT 0, -- Poor Performance
  level_2_marks numeric(5,2) DEFAULT 0, -- Below Expectations  
  level_3_marks numeric(5,2) DEFAULT 0, -- Meets Expectations
  level_4_marks numeric(5,2) DEFAULT 0, -- Exceeds Expectations
  level_5_marks numeric(5,2) DEFAULT 0, -- Far Exceeded Expectations
  
  level_1_points numeric(5,2) DEFAULT 0,
  level_2_points numeric(5,2) DEFAULT 0,
  level_3_points numeric(5,2) DEFAULT 0,
  level_4_points numeric(5,2) DEFAULT 0,
  level_5_points numeric(5,2) DEFAULT 0,
  
  level_1_rating text DEFAULT 'Poor Performance',
  level_2_rating text DEFAULT 'Below Expectations',
  level_3_rating text DEFAULT 'Meets Expectations', 
  level_4_rating text DEFAULT 'Exceeds Expectations',
  level_5_rating text DEFAULT 'Far Exceeded Expectations',
  
  -- Manager comments set during template creation
  manager_comments text,
  
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(template_id, goal_id)
);

-- Create KRA assignments table (assigns templates to employees)
CREATE TABLE IF NOT EXISTS kra_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES kra_templates(id) NOT NULL,
  employee_id uuid REFERENCES users(id) NOT NULL,
  assigned_by uuid REFERENCES users(id) NOT NULL,
  assigned_date date DEFAULT CURRENT_DATE,
  due_date date,
  status text DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'submitted', 'evaluated', 'approved')),
  
  -- Overall scores
  total_score numeric(7,2) DEFAULT 0,
  total_possible_score numeric(7,2) DEFAULT 0,
  overall_percentage numeric(5,2) DEFAULT 0,
  overall_rating text,
  
  -- Submission tracking
  submitted_at timestamptz,
  submitted_by uuid REFERENCES users(id),
  evaluated_at timestamptz,
  evaluated_by uuid REFERENCES users(id),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(template_id, employee_id)
);

-- Create KRA evaluations table (employee responses and evaluations)
CREATE TABLE IF NOT EXISTS kra_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid REFERENCES kra_assignments(id) ON DELETE CASCADE NOT NULL,
  goal_id uuid REFERENCES kra_goals(id) NOT NULL,
  
  -- Employee input
  employee_comments text, -- Detailed evidence provided by employee
  employee_submitted_at timestamptz,
  
  -- Manager evaluation
  selected_level integer CHECK (selected_level >= 1 AND selected_level <= 5),
  awarded_marks numeric(5,2) DEFAULT 0,
  awarded_points numeric(5,2) DEFAULT 0,
  final_rating text,
  manager_evaluation_comments text, -- Manager's evaluation comments
  manager_evaluated_at timestamptz,
  manager_evaluated_by uuid REFERENCES users(id),
  
  -- Calculated scores
  weighted_score numeric(7,2) DEFAULT 0, -- (awarded_points * weight) / 100
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(assignment_id, goal_id)
);

-- Insert evaluation level names (marks will be set by manager for each goal)
INSERT INTO kra_evaluation_levels (level_number, level_name, description) VALUES
(1, 'Poor Performance', 'Performance significantly below expectations'),
(2, 'Below Expectations', 'Performance below expected standards'),
(3, 'Meets Expectations', 'Performance meets expected standards'),
(4, 'Exceeds Expectations', 'Performance exceeds expected standards'),
(5, 'Far Exceeded Expectations', 'Performance significantly exceeds expectations');

-- Note: Categories will be populated based on actual KRA data
-- No default categories inserted - will be managed by business requirements

-- Enable RLS
ALTER TABLE kra_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE kra_evaluation_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE kra_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE kra_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE kra_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE kra_evaluations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for kra_categories (readable by all authenticated users)
CREATE POLICY "All users can read KRA categories"
  ON kra_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can manage KRA categories"
  ON kra_categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role_id IN (
        SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'hr', 'hrm', 'sdm', 'bdm', 'qam')
      )
    )
  );

-- RLS Policies for kra_evaluation_levels (readable by all authenticated users)
CREATE POLICY "All users can read KRA evaluation levels"
  ON kra_evaluation_levels FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage KRA evaluation levels"
  ON kra_evaluation_levels FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role_id IN (
        SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'hr', 'hrm')
      )
    )
  );

-- RLS Policies for kra_templates
CREATE POLICY "Managers can read own templates"
  ON kra_templates FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "HR can read all templates"
  ON kra_templates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role_id IN (
        SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'hr', 'hrm')
      )
    )
  );

CREATE POLICY "Employees can read assigned templates"
  ON kra_templates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM kra_assignments 
      WHERE kra_assignments.template_id = kra_templates.id 
      AND kra_assignments.employee_id = auth.uid()
    )
  );

CREATE POLICY "Managers can create templates"
  ON kra_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role_id IN (
        SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'hr', 'hrm', 'sdm', 'bdm', 'qam')
      )
    )
  );

CREATE POLICY "Managers can update own templates"
  ON kra_templates FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- RLS Policies for kra_goals (inherit from templates)
CREATE POLICY "Users can read KRA goals if they can read the template"
  ON kra_goals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM kra_templates 
      WHERE kra_templates.id = kra_goals.template_id
    )
  );

CREATE POLICY "Template creators can manage KRA goals"
  ON kra_goals FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM kra_templates 
      WHERE kra_templates.id = kra_goals.template_id 
      AND kra_templates.created_by = auth.uid()
    )
  );

-- RLS Policies for kra_assignments
CREATE POLICY "Employees can read own assignments"
  ON kra_assignments FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

CREATE POLICY "Managers can read assignments they created"
  ON kra_assignments FOR SELECT
  TO authenticated
  USING (assigned_by = auth.uid());

CREATE POLICY "HR can read all assignments"
  ON kra_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role_id IN (
        SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'hr', 'hrm')
      )
    )
  );

CREATE POLICY "Managers can create assignments"
  ON kra_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    assigned_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role_id IN (
        SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'hr', 'hrm', 'sdm', 'bdm', 'qam')
      )
    )
  );

CREATE POLICY "Managers can update assignments they created"
  ON kra_assignments FOR UPDATE
  TO authenticated
  USING (assigned_by = auth.uid())
  WITH CHECK (assigned_by = auth.uid());

CREATE POLICY "Employees can update own assignments (limited fields)"
  ON kra_assignments FOR UPDATE
  TO authenticated
  USING (employee_id = auth.uid())
  WITH CHECK (employee_id = auth.uid());

-- RLS Policies for kra_evaluations
CREATE POLICY "Users can read evaluations for their assignments"
  ON kra_evaluations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM kra_assignments 
      WHERE kra_assignments.id = kra_evaluations.assignment_id 
      AND (kra_assignments.employee_id = auth.uid() OR kra_assignments.assigned_by = auth.uid())
    )
  );

CREATE POLICY "HR can read all evaluations"
  ON kra_evaluations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role_id IN (
        SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'hr', 'hrm')
      )
    )
  );

CREATE POLICY "Users can create evaluations for their assignments"
  ON kra_evaluations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM kra_assignments 
      WHERE kra_assignments.id = kra_evaluations.assignment_id 
      AND (kra_assignments.employee_id = auth.uid() OR kra_assignments.assigned_by = auth.uid())
    )
  );

CREATE POLICY "Users can update evaluations for their assignments"
  ON kra_evaluations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM kra_assignments 
      WHERE kra_assignments.id = kra_evaluations.assignment_id 
      AND (kra_assignments.employee_id = auth.uid() OR kra_assignments.assigned_by = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM kra_assignments 
      WHERE kra_assignments.id = kra_evaluations.assignment_id 
      AND (kra_assignments.employee_id = auth.uid() OR kra_assignments.assigned_by = auth.uid())
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_kra_templates_created_by ON kra_templates(created_by);
CREATE INDEX idx_kra_templates_department ON kra_templates(department_id);
CREATE INDEX idx_kra_templates_status ON kra_templates(status);
CREATE INDEX idx_kra_goals_template_id ON kra_goals(template_id);
CREATE INDEX idx_kra_goals_category ON kra_goals(category_id);
CREATE INDEX idx_kra_assignments_template ON kra_assignments(template_id);
CREATE INDEX idx_kra_assignments_employee ON kra_assignments(employee_id);
CREATE INDEX idx_kra_assignments_assigned_by ON kra_assignments(assigned_by);
CREATE INDEX idx_kra_assignments_status ON kra_assignments(status);
CREATE INDEX idx_kra_evaluations_assignment ON kra_evaluations(assignment_id);
CREATE INDEX idx_kra_evaluations_goal ON kra_evaluations(goal_id);

-- Create functions for score calculations
CREATE OR REPLACE FUNCTION calculate_kra_weighted_score()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate weighted score: (awarded_points * goal_weight) / 100
  NEW.weighted_score := (
    NEW.awarded_points * (
      SELECT weight FROM kra_goals WHERE id = NEW.goal_id
    )
  ) / 100;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-calculate weighted scores
CREATE TRIGGER trigger_calculate_weighted_score
  BEFORE INSERT OR UPDATE ON kra_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION calculate_kra_weighted_score();

-- Create function to update assignment totals
CREATE OR REPLACE FUNCTION update_assignment_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Update assignment totals when evaluations change
  UPDATE kra_assignments 
  SET 
    total_score = (
      SELECT COALESCE(SUM(weighted_score), 0) 
      FROM kra_evaluations 
      WHERE assignment_id = COALESCE(NEW.assignment_id, OLD.assignment_id)
    ),
    total_possible_score = (
      SELECT COALESCE(SUM((level_5_points * weight) / 100), 0)
      FROM kra_goals g
      JOIN kra_evaluations e ON g.id = e.goal_id
      WHERE e.assignment_id = COALESCE(NEW.assignment_id, OLD.assignment_id)
    ),
    updated_at = now()
  WHERE id = COALESCE(NEW.assignment_id, OLD.assignment_id);
  
  -- Update overall percentage
  UPDATE kra_assignments 
  SET 
    overall_percentage = CASE 
      WHEN total_possible_score > 0 THEN (total_score / total_possible_score) * 100 
      ELSE 0 
    END,
    overall_rating = CASE 
      WHEN total_possible_score = 0 THEN 'Not Evaluated'
      WHEN (total_score / total_possible_score) >= 0.9 THEN 'Far Exceeded Expectations'
      WHEN (total_score / total_possible_score) >= 0.75 THEN 'Exceeds Expectations'
      WHEN (total_score / total_possible_score) >= 0.6 THEN 'Meets Expectations'
      WHEN (total_score / total_possible_score) >= 0.4 THEN 'Below Expectations'
      ELSE 'Poor Performance'
    END
  WHERE id = COALESCE(NEW.assignment_id, OLD.assignment_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update assignment totals
CREATE TRIGGER trigger_update_assignment_totals
  AFTER INSERT OR UPDATE OR DELETE ON kra_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION update_assignment_totals();
