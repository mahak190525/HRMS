-- Migration to update job_positions table with comprehensive fields
-- Date: 2025-09-01
-- Description: Adding structured fields for Job Basics, Role Overview, Candidate Requirements, and Application Process

-- Job Basics (update existing fields and add new ones)
ALTER TABLE job_positions ADD COLUMN IF NOT EXISTS job_title text;
ALTER TABLE job_positions ADD COLUMN IF NOT EXISTS work_type text CHECK (work_type IN ('full_time', 'part_time', 'contract', 'probation/internship'));

-- Role Overview
ALTER TABLE job_positions ADD COLUMN IF NOT EXISTS key_responsibilities text;

-- Candidate Requirements  
ALTER TABLE job_positions ADD COLUMN IF NOT EXISTS experience_level_description text;
ALTER TABLE job_positions ADD COLUMN IF NOT EXISTS technical_skills_required text;
ALTER TABLE job_positions ADD COLUMN IF NOT EXISTS soft_skills text;

-- Application Process
ALTER TABLE job_positions ADD COLUMN IF NOT EXISTS how_to_apply text;
ALTER TABLE job_positions ADD COLUMN IF NOT EXISTS application_deadline date;
ALTER TABLE job_positions ADD COLUMN IF NOT EXISTS referral_encouraged boolean DEFAULT true;

-- Update existing fields for better organization
-- Rename title to be more specific if needed (keeping both for backward compatibility)
UPDATE job_positions SET job_title = title WHERE job_title IS NULL;

-- Update work_type to match employment_type for consistency
UPDATE job_positions SET work_type = employment_type WHERE work_type IS NULL;

-- Add comments to document the new structure
COMMENT ON COLUMN job_positions.job_title IS 'Clear and accurate job title (e.g., Software Engineer – React.js)';
COMMENT ON COLUMN job_positions.department_id IS 'Department/Team (references departments table)';
COMMENT ON COLUMN job_positions.location IS 'Work location including city information';
COMMENT ON COLUMN job_positions.is_remote IS 'Remote work availability (true/false)';
COMMENT ON COLUMN job_positions.work_type IS 'Work arrangement type (full_time, part_time, contract, probation/internship)';
COMMENT ON COLUMN job_positions.key_responsibilities IS '5-8 bullet points describing key responsibilities';
COMMENT ON COLUMN job_positions.experience_level_description IS 'Detailed experience requirements (e.g., 2-4 years in relevant field)';
COMMENT ON COLUMN job_positions.technical_skills_required IS 'Required technical skills';
COMMENT ON COLUMN job_positions.soft_skills IS 'Required soft skills (e.g., Communication, Teamwork, Problem-Solving)';
COMMENT ON COLUMN job_positions.how_to_apply IS 'Application instructions (HR email, portal, etc.)';
COMMENT ON COLUMN job_positions.application_deadline IS 'Application deadline date (if applicable)';
COMMENT ON COLUMN job_positions.referral_encouraged IS 'Whether employee referrals are encouraged for this position';
