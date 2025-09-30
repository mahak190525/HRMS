-- Migration: Create Work Experience Table
-- Description: Creates table to track employee work experience with document attachments
-- Date: 2024-09-25

-- Create work experience table
CREATE TABLE IF NOT EXISTS employee_work_experience (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  employer_name TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'Not Verified' CHECK (verification_status IN ('Verified', 'Not Verified', 'N/A')),
  comments TEXT,
  attachment_file_url TEXT,
  attachment_file_name TEXT,
  attachment_file_size INTEGER,
  attachment_mime_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_employee_work_experience_employee_id ON employee_work_experience(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_work_experience_verification_status ON employee_work_experience(verification_status);
CREATE INDEX IF NOT EXISTS idx_employee_work_experience_created_at ON employee_work_experience(created_at DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE employee_work_experience ENABLE ROW LEVEL SECURITY;

-- RLS Policies for employee_work_experience (using public schema, app handles permissions)
-- Allow public access to employee work experience (application handles permissions)
CREATE POLICY "Allow public access employee work experience" ON employee_work_experience
  FOR ALL USING (true);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_employee_work_experience_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP trigger "trigger_update_employee_work_experience_updated_at" on "employee_work_experience";
CREATE TRIGGER trigger_update_employee_work_experience_updated_at
  BEFORE UPDATE ON employee_work_experience
  FOR EACH ROW
  EXECUTE FUNCTION update_employee_work_experience_updated_at();

-- Add comments to document the table
COMMENT ON TABLE employee_work_experience IS 'Stores employee work experience history with verification status and attachments';
COMMENT ON COLUMN employee_work_experience.employee_id IS 'Reference to the employee (users table)';
COMMENT ON COLUMN employee_work_experience.employer_name IS 'Name of the previous employer';
COMMENT ON COLUMN employee_work_experience.verification_status IS 'Status of employment verification (Verified/Not Verified/N/A)';
COMMENT ON COLUMN employee_work_experience.comments IS 'Additional comments about the work experience';
COMMENT ON COLUMN employee_work_experience.attachment_file_url IS 'URL of uploaded verification document';
COMMENT ON COLUMN employee_work_experience.attachment_file_name IS 'Original name of uploaded file';
COMMENT ON COLUMN employee_work_experience.attachment_file_size IS 'Size of uploaded file in bytes';
COMMENT ON COLUMN employee_work_experience.attachment_mime_type IS 'MIME type of uploaded file';
