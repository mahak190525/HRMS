/*
  # Create Sample ATS Data

  1. Sample Data
    - Job positions for different departments
    - Sample candidates with various statuses
    - Interview questions for the question bank
    - Sample interviews and assessments

  2. Features
    - Realistic candidate pipeline
    - Diverse question bank with coding problems
    - Interview scheduling examples
    - Assessment tracking
*/

-- Insert sample job positions
INSERT INTO job_positions (title, department_id, description, requirements, experience_level, employment_type, salary_range_min, salary_range_max, location, is_remote, status, posted_by) 
SELECT 
  pos.title,
  d.id,
  pos.description,
  pos.requirements,
  pos.experience_level,
  pos.employment_type,
  pos.salary_range_min,
  pos.salary_range_max,
  pos.location,
  pos.is_remote,
  'open',
  u.id
FROM (VALUES
  ('Senior Full Stack Developer', 'Engineering', 'Lead development of web applications using React and Node.js', 'React, Node.js, TypeScript, 5+ years experience', 'senior', 'full_time', 120000, 150000, 'New York', true),
  ('Frontend Developer', 'Engineering', 'Build responsive user interfaces with React and modern CSS', 'React, JavaScript, CSS, 2+ years experience', 'mid', 'full_time', 80000, 100000, 'San Francisco', true),
  ('Backend Developer', 'Engineering', 'Develop scalable APIs and microservices', 'Node.js, Python, PostgreSQL, 3+ years experience', 'mid', 'full_time', 90000, 120000, 'Remote', true),
  ('DevOps Engineer', 'Engineering', 'Manage cloud infrastructure and CI/CD pipelines', 'AWS, Docker, Kubernetes, 4+ years experience', 'senior', 'full_time', 110000, 140000, 'Austin', false),
  ('QA Engineer', 'Quality Assurance', 'Design and execute comprehensive testing strategies', 'Automation testing, Selenium, 3+ years experience', 'mid', 'full_time', 70000, 90000, 'Chicago', true),
  ('Product Manager', 'Engineering', 'Drive product strategy and roadmap execution', 'Product management, Agile, 5+ years experience', 'senior', 'full_time', 130000, 160000, 'Seattle', false)
) AS pos(title, dept_name, description, requirements, experience_level, employment_type, salary_range_min, salary_range_max, location, is_remote)
JOIN departments d ON d.name = pos.dept_name
JOIN users u ON u.role_id IN (SELECT id FROM roles WHERE name = 'hr')
LIMIT 1;

-- Insert sample candidates
INSERT INTO candidates (full_name, email, phone, position_applied, resume_url, cover_letter, linkedin_url, github_url, experience_years, current_company, current_position, expected_salary, notice_period, status, source) VALUES
('Alice Johnson', 'alice.johnson@email.com', '+1-555-0101', 'Senior Full Stack Developer', 'https://example.com/resume1.pdf', 'I am excited to apply for this position...', 'https://linkedin.com/in/alicejohnson', 'https://github.com/alicejohnson', 6, 'TechCorp Inc', 'Senior Developer', 135000, 30, 'interview_scheduled', 'direct'),
('Bob Smith', 'bob.smith@email.com', '+1-555-0102', 'Frontend Developer', 'https://example.com/resume2.pdf', 'Passionate frontend developer with React expertise...', 'https://linkedin.com/in/bobsmith', 'https://github.com/bobsmith', 3, 'StartupXYZ', 'Frontend Developer', 85000, 15, 'screening', 'job_board'),
('Carol Davis', 'carol.davis@email.com', '+1-555-0103', 'Backend Developer', 'https://example.com/resume3.pdf', 'Experienced backend engineer specializing in APIs...', 'https://linkedin.com/in/caroldavis', 'https://github.com/caroldavis', 4, 'DataSoft', 'Backend Engineer', 105000, 30, 'assessment_pending', 'referral'),
('David Wilson', 'david.wilson@email.com', '+1-555-0104', 'DevOps Engineer', 'https://example.com/resume4.pdf', 'DevOps professional with extensive cloud experience...', 'https://linkedin.com/in/davidwilson', 'https://github.com/davidwilson', 5, 'CloudTech', 'DevOps Lead', 125000, 45, 'selected', 'linkedin'),
('Eva Martinez', 'eva.martinez@email.com', '+1-555-0105', 'QA Engineer', 'https://example.com/resume5.pdf', 'Quality assurance engineer with automation expertise...', 'https://linkedin.com/in/evamartinez', 'https://github.com/evamartinez', 4, 'QualityFirst', 'Senior QA', 75000, 30, 'interviewed', 'direct'),
('Frank Brown', 'frank.brown@email.com', '+1-555-0106', 'Product Manager', 'https://example.com/resume6.pdf', 'Product manager with proven track record...', 'https://linkedin.com/in/frankbrown', NULL, 7, 'ProductCo', 'Senior PM', 145000, 60, 'hired', 'referral');

-- Insert sample questions into question bank
INSERT INTO question_bank (category, subcategory, difficulty, question_type, title, description, sample_input, sample_output, solution, time_limit_minutes, tags, created_by) 
SELECT 
  q.category,
  q.subcategory,
  q.difficulty,
  q.question_type,
  q.title,
  q.description,
  q.sample_input,
  q.sample_output,
  q.solution,
  q.time_limit_minutes,
  q.tags,
  u.id
FROM (VALUES
  ('Arrays', 'Sorting', 'easy', 'coding', 'Two Sum', 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.', '[2,7,11,15], target = 9', '[0,1]', 'Use hash map for O(n) solution', 30, ARRAY['array', 'hash-table', 'two-pointers']),
  ('Strings', 'Manipulation', 'medium', 'coding', 'Longest Palindromic Substring', 'Given a string s, return the longest palindromic substring in s.', 'babad', 'bab', 'Expand around centers approach', 45, ARRAY['string', 'palindrome', 'dynamic-programming']),
  ('Trees', 'Traversal', 'medium', 'coding', 'Binary Tree Level Order Traversal', 'Given the root of a binary tree, return the level order traversal of its nodes values.', '[3,9,20,null,null,15,7]', '[[3],[9,20],[15,7]]', 'Use BFS with queue', 40, ARRAY['tree', 'bfs', 'queue']),
  ('Dynamic Programming', 'Optimization', 'hard', 'coding', 'Edit Distance', 'Given two strings word1 and word2, return the minimum number of operations required to convert word1 to word2.', 'horse, ros', '3', 'DP table approach', 60, ARRAY['dynamic-programming', 'string', 'edit-distance']),
  ('System Design', 'Scalability', 'hard', 'system_design', 'Design a URL Shortener', 'Design a URL shortening service like bit.ly. Consider scalability, reliability, and performance.', 'N/A', 'N/A', 'Discuss load balancing, database sharding, caching', 90, ARRAY['system-design', 'scalability', 'databases']),
  ('Algorithms', 'Graph', 'medium', 'coding', 'Course Schedule', 'There are numCourses courses labeled from 0 to numCourses - 1. Return true if you can finish all courses.', '2, [[1,0]]', 'true', 'Topological sort using DFS', 45, ARRAY['graph', 'topological-sort', 'dfs'])
) AS q(category, subcategory, difficulty, question_type, title, description, sample_input, sample_output, solution, time_limit_minutes, tags)
CROSS JOIN (SELECT id FROM users WHERE role_id IN (SELECT id FROM roles WHERE name = 'hr') LIMIT 1) u;

-- Insert sample interviews
INSERT INTO interviews (candidate_id, interviewer_id, interview_type, scheduled_at, duration_minutes, meeting_link, status)
SELECT 
  c.id,
  u.id,
  i.interview_type,
  i.scheduled_at,
  i.duration_minutes,
  i.meeting_link,
  i.status
FROM (VALUES
  ('alice.johnson@email.com', 'technical', '2025-01-22 14:00:00+00'::timestamptz, 90, 'https://meet.google.com/abc-defg-hij', 'scheduled'),
  ('bob.smith@email.com', 'screening', '2025-01-20 10:00:00+00'::timestamptz, 30, 'https://meet.google.com/xyz-uvwx-rst', 'completed'),
  ('eva.martinez@email.com', 'behavioral', '2025-01-19 15:30:00+00'::timestamptz, 60, 'https://meet.google.com/lmn-opqr-stu', 'completed')
) AS i(candidate_email, interview_type, scheduled_at, duration_minutes, meeting_link, status)
JOIN candidates c ON c.email = i.candidate_email
CROSS JOIN (SELECT id FROM users WHERE role_id IN (SELECT id FROM roles WHERE name IN ('hr', 'admin')) LIMIT 1) u;

-- Insert sample assessments
INSERT INTO assessments (candidate_id, assessment_type, title, description, time_limit_minutes, status, created_at)
SELECT 
  c.id,
  a.assessment_type,
  a.title,
  a.description,
  a.time_limit_minutes,
  a.status,
  now()
FROM (VALUES
  ('alice.johnson@email.com', 'coding', 'Senior Developer Coding Challenge', 'Complete 3 coding problems of varying difficulty', 120, 'assigned'),
  ('bob.smith@email.com', 'coding', 'Frontend Skills Assessment', 'React and JavaScript problem solving', 90, 'submitted'),
  ('carol.davis@email.com', 'coding', 'Backend API Challenge', 'Design and implement REST API endpoints', 150, 'assigned')
) AS a(candidate_email, assessment_type, title, description, time_limit_minutes, status)
JOIN candidates c ON c.email = a.candidate_email;

-- Create sample admin user for ATS if not exists
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
) 
SELECT 
  'manual', 
  'admin@company.com', 
  'admin@company.com', 
  encode(digest('admin123', 'sha256'), 'base64'), 
  'System Administrator', 
  'ADM001', 
  r.id, 
  d.id, 
  'System Administrator', 
  'active',
  '{"dashboards": {"self": true, "employee_management": true, "performance": true, "grievance": true, "bd_team": true, "finance": true, "ats": true, "lms": true, "exit": true}}'::jsonb
FROM roles r, departments d
WHERE r.name = 'admin' AND d.name = 'Human Resources'
ON CONFLICT (email) DO NOTHING;