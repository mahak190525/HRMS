-- Migration: Create incident_attachments table for multiple attachments per incident
-- Description: Separate table to store multiple attachments for each incident
-- Date: 2024-12-23

-- Create incident_attachments table
CREATE TABLE IF NOT EXISTS incident_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES employee_incidents(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_incident_attachments_incident_id ON incident_attachments(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_attachments_uploaded_by ON incident_attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_incident_attachments_created_at ON incident_attachments(created_at DESC);

-- Enable RLS
ALTER TABLE incident_attachments ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Allow all operations for authenticated users" ON incident_attachments
  FOR ALL USING (true);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON incident_attachments TO authenticated;

-- Add constraint to limit attachments per incident (10 max)
-- Note: This will be enforced at application level for better UX
