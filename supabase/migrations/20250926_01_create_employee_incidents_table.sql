-- Migration: Create employee_incidents table
-- Description: Table to store employee incidents with attachments support
-- Date: 2024-12-20

-- Create employee_incidents table
CREATE TABLE IF NOT EXISTS employee_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  incident_date DATE NOT NULL,
  comments TEXT,
  attachment_file_url TEXT,
  attachment_file_name VARCHAR(255),
  attachment_file_size BIGINT,
  attachment_mime_type VARCHAR(100),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_employee_incidents_employee_id ON employee_incidents(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_incidents_created_by ON employee_incidents(created_by);
CREATE INDEX IF NOT EXISTS idx_employee_incidents_incident_date ON employee_incidents(incident_date);

-- Enable RLS
ALTER TABLE employee_incidents ENABLE ROW LEVEL SECURITY;

-- Note: Since we're not using auth schema, RLS policies are simplified
-- Application-level security will be handled in the backend/API layer

-- Create basic RLS policies (these can be adjusted based on your specific auth implementation)
CREATE POLICY "Allow all operations for authenticated users" ON employee_incidents
  FOR ALL USING (true);

-- Create function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_employee_incidents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER employee_incidents_updated_at_trigger
  BEFORE UPDATE ON employee_incidents
  FOR EACH ROW
  EXECUTE FUNCTION update_employee_incidents_updated_at();

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON employee_incidents TO authenticated;
