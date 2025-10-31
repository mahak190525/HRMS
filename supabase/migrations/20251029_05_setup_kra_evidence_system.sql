-- Setup KRA Evidence System
-- Creates bucket, table, and policies for storing employee evidence documents

-- Create the KRA-evidence storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('KRA-evidence', 'KRA-evidence', false)
ON CONFLICT (id) DO NOTHING;

-- Create table to track evidence files metadata
CREATE TABLE IF NOT EXISTS kra_evidence_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES kra_assignments(id) ON DELETE CASCADE,
  quarter TEXT NOT NULL CHECK (quarter IN ('Q1', 'Q2', 'Q3', 'Q4')),
  file_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  folder_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_kra_evidence_files_assignment_id ON kra_evidence_files(assignment_id);
CREATE INDEX IF NOT EXISTS idx_kra_evidence_files_quarter ON kra_evidence_files(quarter);
CREATE INDEX IF NOT EXISTS idx_kra_evidence_files_uploaded_by ON kra_evidence_files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_kra_evidence_files_assignment_quarter ON kra_evidence_files(assignment_id, quarter);

-- Add constraint to limit files per quarter (5 files max)
-- Note: This constraint is enforced in application logic due to PostgreSQL limitations with subqueries in CHECK constraints

-- Enable RLS
ALTER TABLE kra_evidence_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies for kra_evidence_files table

-- Policy: Users can view evidence files for their own assignments or if they have admin permissions
CREATE POLICY "Users can view evidence files for their assignments or admin access"
ON kra_evidence_files FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM kra_assignments ka
    WHERE ka.id = kra_evidence_files.assignment_id
    AND (
      ka.employee_id = auth.uid() OR  -- Employee can see their own files
      EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = auth.uid()
        AND (
          u."isSA" = true OR
          r.name IN ('super_admin', 'admin', 'hr')
        )
      )
    )
  )
);

-- Policy: Only employees can insert evidence files for their own assignments
CREATE POLICY "Employees can insert evidence files for their assignments"
ON kra_evidence_files FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM kra_assignments ka
    WHERE ka.id = kra_evidence_files.assignment_id
    AND ka.employee_id = auth.uid()
  )
  AND uploaded_by = auth.uid()
);

-- Policy: Only employees can update their own evidence files
CREATE POLICY "Employees can update their own evidence files"
ON kra_evidence_files FOR UPDATE
USING (uploaded_by = auth.uid())
WITH CHECK (uploaded_by = auth.uid());

-- Policy: Only employees can delete their own evidence files
CREATE POLICY "Employees can delete their own evidence files"
ON kra_evidence_files FOR DELETE
USING (uploaded_by = auth.uid());

-- Storage Policies for KRA-evidence bucket
-- Simple policies - let the kra_evidence_files table RLS handle the complex logic

-- Policy: Allow authenticated users to view files (RLS on kra_evidence_files controls access)
CREATE POLICY "Authenticated users can view KRA evidence files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'KRA-evidence');

-- Policy: Allow authenticated users to upload files (RLS on kra_evidence_files controls access)
CREATE POLICY "Authenticated users can upload KRA evidence files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'KRA-evidence');

-- Policy: Allow authenticated users to update files (RLS on kra_evidence_files controls access)
CREATE POLICY "Authenticated users can update KRA evidence files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'KRA-evidence');

-- Policy: Allow authenticated users to delete files (RLS on kra_evidence_files controls access)
CREATE POLICY "Authenticated users can delete KRA evidence files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'KRA-evidence');

-- Function to automatically set uploaded_by when inserting evidence files
CREATE OR REPLACE FUNCTION set_evidence_file_uploaded_by()
RETURNS TRIGGER AS $$
BEGIN
  NEW.uploaded_by = auth.uid();
  NEW.uploaded_at = now();
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically set uploaded_by
DROP TRIGGER IF EXISTS trigger_set_evidence_file_uploaded_by ON kra_evidence_files;
CREATE TRIGGER trigger_set_evidence_file_uploaded_by
  BEFORE INSERT ON kra_evidence_files
  FOR EACH ROW
  EXECUTE FUNCTION set_evidence_file_uploaded_by();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_evidence_file_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS trigger_update_evidence_file_updated_at ON kra_evidence_files;
CREATE TRIGGER trigger_update_evidence_file_updated_at
  BEFORE UPDATE ON kra_evidence_files
  FOR EACH ROW
  EXECUTE FUNCTION update_evidence_file_updated_at();

-- Add comments for documentation
COMMENT ON TABLE kra_evidence_files IS 'Stores metadata for evidence documents uploaded by employees for KRA evaluations';
COMMENT ON COLUMN kra_evidence_files.assignment_id IS 'Reference to the KRA assignment';
COMMENT ON COLUMN kra_evidence_files.quarter IS 'Quarter for which the evidence is uploaded (Q1, Q2, Q3, Q4)';
COMMENT ON COLUMN kra_evidence_files.file_name IS 'Unique file name in storage (with timestamp)';
COMMENT ON COLUMN kra_evidence_files.original_name IS 'Original file name as uploaded by user';
COMMENT ON COLUMN kra_evidence_files.file_path IS 'Full path in storage bucket';
COMMENT ON COLUMN kra_evidence_files.folder_path IS 'Folder path: {employee_name}/{template_name}_{quarter}';

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON kra_evidence_files TO authenticated;
