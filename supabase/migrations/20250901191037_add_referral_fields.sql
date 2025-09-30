-- Migration to add new fields to referrals table
-- Date: 2025-09-01
-- Description: Adding LinkedIn profile, company details, experience, CTC, notice period, skills, and location fields

ALTER TABLE referrals ADD COLUMN IF NOT EXISTS linkedin_profile text;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS current_company text;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS current_job_title text;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS total_experience_years integer DEFAULT 0;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS total_experience_months integer DEFAULT 0;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS current_ctc numeric(12,2);
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS expected_ctc numeric(12,2);
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS notice_period_availability text;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS reason_for_change text;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS key_skills text;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS domain_expertise text;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS location_preference text DEFAULT 'Mohali' CHECK (location_preference IN ('Mohali', 'Kota'));

-- Add comment to document the new fields
COMMENT ON COLUMN referrals.linkedin_profile IS 'LinkedIn profile URL of the candidate';
COMMENT ON COLUMN referrals.current_company IS 'Current company where the candidate works';
COMMENT ON COLUMN referrals.current_job_title IS 'Current job title/position of the candidate';
COMMENT ON COLUMN referrals.total_experience_years IS 'Total work experience in years';
COMMENT ON COLUMN referrals.total_experience_months IS 'Additional months of experience (0-11)';
COMMENT ON COLUMN referrals.current_ctc IS 'Current Cost to Company (salary package)';
COMMENT ON COLUMN referrals.expected_ctc IS 'Expected Cost to Company (desired salary)';
COMMENT ON COLUMN referrals.notice_period_availability IS 'Notice period or immediate availability information';
COMMENT ON COLUMN referrals.reason_for_change IS 'Reason why the candidate is looking for a job change';
COMMENT ON COLUMN referrals.key_skills IS 'Key technical/functional skills of the candidate';
COMMENT ON COLUMN referrals.domain_expertise IS 'Domain expertise if any';
COMMENT ON COLUMN referrals.location_preference IS 'Preferred work location (Mohali or Kota)';
