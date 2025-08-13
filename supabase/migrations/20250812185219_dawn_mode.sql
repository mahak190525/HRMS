/*
  # Performance Management System

  1. Tables
    - `performance_goals` - Employee goals and objectives
    - `performance_evaluations` - Performance evaluations
    - `performance_appraisals` - Annual appraisals
    - `performance_feedback` - 360-degree feedback

  2. Security
    - Enable RLS on all tables
    - Employees can view their own performance data
    - Managers can view their team's performance
    - HR can view all performance data
*/

-- Create performance goals table
CREATE TABLE IF NOT EXISTS performance_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  target_date date NOT NULL,
  status text DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'overdue')),
  progress_percentage integer DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  weight numeric(3,2) DEFAULT 1.0,
  created_by uuid REFERENCES users(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create performance evaluations table
CREATE TABLE IF NOT EXISTS performance_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) NOT NULL,
  evaluator_id uuid REFERENCES users(id) NOT NULL,
  evaluation_period_start date NOT NULL,
  evaluation_period_end date NOT NULL,
  overall_rating numeric(3,2) CHECK (overall_rating >= 1.0 AND overall_rating <= 5.0),
  technical_skills_rating numeric(3,2) CHECK (technical_skills_rating >= 1.0 AND technical_skills_rating <= 5.0),
  communication_rating numeric(3,2) CHECK (communication_rating >= 1.0 AND communication_rating <= 5.0),
  teamwork_rating numeric(3,2) CHECK (teamwork_rating >= 1.0 AND teamwork_rating <= 5.0),
  leadership_rating numeric(3,2) CHECK (leadership_rating >= 1.0 AND leadership_rating <= 5.0),
  strengths text,
  areas_for_improvement text,
  comments text,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create performance appraisals table
CREATE TABLE IF NOT EXISTS performance_appraisals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) NOT NULL,
  appraisal_year integer NOT NULL,
  self_assessment text,
  manager_assessment text,
  hr_assessment text,
  final_rating numeric(3,2) CHECK (final_rating >= 1.0 AND final_rating <= 5.0),
  salary_increment_percentage numeric(5,2) DEFAULT 0,
  promotion_recommended boolean DEFAULT false,
  development_plan text,
  status text DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'approved')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id, appraisal_year)
);

-- Create performance feedback table
CREATE TABLE IF NOT EXISTS performance_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) NOT NULL,
  feedback_giver_id uuid REFERENCES users(id) NOT NULL,
  feedback_type text CHECK (feedback_type IN ('peer', 'subordinate', 'manager', 'self')),
  feedback_text text NOT NULL,
  rating numeric(3,2) CHECK (rating >= 1.0 AND rating <= 5.0),
  is_anonymous boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE performance_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_appraisals ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies for performance_goals
CREATE POLICY "Users can read own performance goals"
  ON performance_goals FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Managers can read team performance goals"
  ON performance_goals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u1, users u2
      WHERE u1.id = auth.uid() 
      AND u2.id = performance_goals.user_id
      AND u1.department_id = u2.department_id
      AND u1.role_id IN (
        SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'hr', 'sdm', 'bdm', 'qam')
      )
    )
  );

CREATE POLICY "Managers can create team performance goals"
  ON performance_goals FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role_id IN (
        SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'hr', 'sdm', 'bdm', 'qam')
      )
    )
  );

CREATE POLICY "Users can update own performance goals"
  ON performance_goals FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for performance_evaluations
CREATE POLICY "Users can read own performance evaluations"
  ON performance_evaluations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR evaluator_id = auth.uid());

CREATE POLICY "HR can read all performance evaluations"
  ON performance_evaluations FOR SELECT
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

CREATE POLICY "Managers can create evaluations for their team"
  ON performance_evaluations FOR INSERT
  TO authenticated
  WITH CHECK (
    evaluator_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role_id IN (
        SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'hr', 'sdm', 'bdm', 'qam')
      )
    )
  );

-- RLS Policies for performance_appraisals
CREATE POLICY "Users can read own performance appraisals"
  ON performance_appraisals FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "HR can read all performance appraisals"
  ON performance_appraisals FOR SELECT
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

CREATE POLICY "HR can manage performance appraisals"
  ON performance_appraisals FOR ALL
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

-- RLS Policies for performance_feedback
CREATE POLICY "Users can read feedback about themselves"
  ON performance_feedback FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can read feedback they gave"
  ON performance_feedback FOR SELECT
  TO authenticated
  USING (feedback_giver_id = auth.uid());

CREATE POLICY "HR can read all performance feedback"
  ON performance_feedback FOR SELECT
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

CREATE POLICY "Users can give feedback"
  ON performance_feedback FOR INSERT
  TO authenticated
  WITH CHECK (feedback_giver_id = auth.uid());