/*
  # Application Tracking System (ATS)

  1. Tables
    - `job_positions` - Available job positions
    - `candidates` - Candidate information
    - `interviews` - Interview scheduling and results
    - `assessments` - Technical assessments
    - `question_bank` - Interview questions
    - `referrals` - Employee referrals

  2. Security
    - Enable RLS on all tables
    - HR can manage all ATS data
    - Candidates can view their own data
    - Employees can submit referrals
*/

-- Create job positions table
CREATE TABLE IF NOT EXISTS job_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  department_id uuid REFERENCES departments(id),
  description text,
  requirements text,
  experience_level text CHECK (experience_level IN ('entry', 'mid', 'senior', 'lead')),
  employment_type text DEFAULT 'full_time' CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'internship')),
  salary_range_min numeric(10,2),
  salary_range_max numeric(10,2),
  location text,
  is_remote boolean DEFAULT false,
  status text DEFAULT 'open' CHECK (status IN ('open', 'closed', 'on_hold')),
  posted_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create candidates table
CREATE TABLE IF NOT EXISTS candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id), -- Links to users table if they get an account
  full_name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text,
  position_applied_id uuid REFERENCES job_positions(id),
  position_applied text NOT NULL, -- Fallback if position is deleted
  resume_url text,
  cover_letter text,
  linkedin_url text,
  github_url text,
  portfolio_url text,
  experience_years integer DEFAULT 0,
  current_company text,
  current_position text,
  expected_salary numeric(10,2),
  notice_period integer, -- in days
  status text DEFAULT 'applied' CHECK (status IN ('applied', 'screening', 'interview_scheduled', 'interviewed', 'assessment_pending', 'assessment_completed', 'selected', 'rejected', 'hired', 'withdrawn')),
  interview_date timestamptz,
  interview_notes text,
  assessment_score numeric(5,2),
  assessment_feedback text,
  referred_by uuid REFERENCES users(id),
  source text DEFAULT 'direct' CHECK (source IN ('direct', 'referral', 'job_board', 'linkedin', 'other')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create interviews table
CREATE TABLE IF NOT EXISTS interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid REFERENCES candidates(id) NOT NULL,
  interviewer_id uuid REFERENCES users(id) NOT NULL,
  interview_type text DEFAULT 'technical' CHECK (interview_type IN ('screening', 'technical', 'behavioral', 'final')),
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer DEFAULT 60,
  meeting_link text,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  technical_rating numeric(3,2) CHECK (technical_rating >= 1.0 AND technical_rating <= 5.0),
  communication_rating numeric(3,2) CHECK (communication_rating >= 1.0 AND communication_rating <= 5.0),
  problem_solving_rating numeric(3,2) CHECK (problem_solving_rating >= 1.0 AND problem_solving_rating <= 5.0),
  overall_rating numeric(3,2) CHECK (overall_rating >= 1.0 AND overall_rating <= 5.0),
  feedback text,
  recommendation text CHECK (recommendation IN ('strong_hire', 'hire', 'no_hire', 'strong_no_hire')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create assessments table
CREATE TABLE IF NOT EXISTS assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid REFERENCES candidates(id) NOT NULL,
  assessment_type text DEFAULT 'coding' CHECK (assessment_type IN ('coding', 'system_design', 'aptitude', 'personality')),
  title text NOT NULL,
  description text,
  questions jsonb, -- Array of questions with answers
  time_limit_minutes integer DEFAULT 120,
  started_at timestamptz,
  submitted_at timestamptz,
  score numeric(5,2),
  max_score numeric(5,2) DEFAULT 100,
  auto_graded boolean DEFAULT false,
  graded_by uuid REFERENCES users(id),
  feedback text,
  status text DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'submitted', 'graded')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create question bank table
CREATE TABLE IF NOT EXISTS question_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  subcategory text,
  difficulty text DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  question_type text DEFAULT 'coding' CHECK (question_type IN ('coding', 'mcq', 'descriptive', 'system_design')),
  title text NOT NULL,
  description text NOT NULL,
  sample_input text,
  sample_output text,
  test_cases jsonb,
  solution text,
  time_limit_minutes integer DEFAULT 30,
  tags text[],
  created_by uuid REFERENCES users(id),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create referrals table
CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referred_by uuid REFERENCES users(id) NOT NULL,
  candidate_name text NOT NULL,
  candidate_email text NOT NULL,
  candidate_phone text,
  position text NOT NULL,
  resume_url text,
  additional_info text,
  relationship text, -- How they know the candidate
  status text DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'contacted', 'interviewed', 'hired', 'rejected')),
  bonus_eligible boolean DEFAULT true,
  bonus_amount numeric(8,2),
  bonus_paid boolean DEFAULT false,
  hr_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE job_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for job_positions
CREATE POLICY "Job positions readable by all"
  ON job_positions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "HR can manage job positions"
  ON job_positions FOR ALL
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

-- RLS Policies for candidates
CREATE POLICY "Candidates can read own data"
  ON candidates FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "HR can read all candidates"
  ON candidates FOR SELECT
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

CREATE POLICY "HR can manage candidates"
  ON candidates FOR ALL
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

-- RLS Policies for interviews
CREATE POLICY "Candidates can read own interviews"
  ON interviews FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM candidates 
      WHERE candidates.id = interviews.candidate_id 
      AND candidates.user_id = auth.uid()
    )
  );

CREATE POLICY "Interviewers can read their interviews"
  ON interviews FOR SELECT
  TO authenticated
  USING (interviewer_id = auth.uid());

CREATE POLICY "HR can read all interviews"
  ON interviews FOR SELECT
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

CREATE POLICY "HR and interviewers can manage interviews"
  ON interviews FOR ALL
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

-- RLS Policies for assessments
CREATE POLICY "Candidates can read own assessments"
  ON assessments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM candidates 
      WHERE candidates.id = assessments.candidate_id 
      AND candidates.user_id = auth.uid()
    )
  );

CREATE POLICY "HR can read all assessments"
  ON assessments FOR SELECT
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

CREATE POLICY "HR can manage assessments"
  ON assessments FOR ALL
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

-- RLS Policies for question_bank
CREATE POLICY "HR can read all questions"
  ON question_bank FOR SELECT
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

CREATE POLICY "HR can manage questions"
  ON question_bank FOR ALL
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

-- RLS Policies for referrals
CREATE POLICY "Users can read own referrals"
  ON referrals FOR SELECT
  TO authenticated
  USING (referred_by = auth.uid());

CREATE POLICY "HR can read all referrals"
  ON referrals FOR SELECT
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

CREATE POLICY "Users can create referrals"
  ON referrals FOR INSERT
  TO authenticated
  WITH CHECK (referred_by = auth.uid());

CREATE POLICY "Users can update own referrals"
  ON referrals FOR UPDATE
  TO authenticated
  USING (referred_by = auth.uid())
  WITH CHECK (referred_by = auth.uid());

CREATE POLICY "HR can manage all referrals"
  ON referrals FOR ALL
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