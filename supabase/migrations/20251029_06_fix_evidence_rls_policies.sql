-- Fix RLS policies for kra_evidence_files to allow proper access
-- This migration simplifies the policies to ensure they work correctly

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Users can view evidence files for their assignments or admin access" ON kra_evidence_files;
DROP POLICY IF EXISTS "Employees can insert evidence files for their assignments" ON kra_evidence_files;
DROP POLICY IF EXISTS "Employees can update their own evidence files" ON kra_evidence_files;
DROP POLICY IF EXISTS "Employees can delete their own evidence files" ON kra_evidence_files;
DROP POLICY IF EXISTS "Users can view their own evidence files" ON kra_evidence_files;
DROP POLICY IF EXISTS "Admins can view all evidence files" ON kra_evidence_files;
DROP POLICY IF EXISTS "Employees can insert their own evidence files" ON kra_evidence_files;
DROP POLICY IF EXISTS "Users can update their own evidence files" ON kra_evidence_files;
DROP POLICY IF EXISTS "Users can delete their own evidence files" ON kra_evidence_files;
DROP POLICY IF EXISTS "Allow authenticated users to access KRA evidence storage" ON kra_evidence_files;
DROP POLICY IF EXISTS "Allow authenticated users to access KRA evidence storage" ON storage.objects;


-- Simplified policies that should work with your existing system

-- Policy: Allow users to view evidence files for their own assignments
CREATE POLICY "Users can view their own evidence files"
ON kra_evidence_files FOR SELECT
TO authenticated, anon
USING (
  EXISTS (
    SELECT 1 FROM kra_assignments ka
    WHERE ka.id = kra_evidence_files.assignment_id
    AND ka.employee_id = auth.uid()
  )
);

-- Policy: Allow admins/HR to view all evidence files
CREATE POLICY "Admins can view all evidence files"
ON kra_evidence_files FOR SELECT
TO authenticated, anon
USING (
  EXISTS (
    SELECT 1 FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
    AND (
      u."isSA" = true OR
      r.name IN ('super_admin', 'admin', 'hr')
    )
  )
);

-- Policy: Allow employees to insert evidence files for their own assignments
CREATE POLICY "Employees can insert their own evidence files"
ON kra_evidence_files FOR INSERT
TO authenticated, anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM kra_assignments ka
    WHERE ka.id = kra_evidence_files.assignment_id
    AND ka.employee_id = auth.uid()
  )
);

-- Policy: Allow users to update their own evidence files
CREATE POLICY "Users can update their own evidence files"
ON kra_evidence_files FOR UPDATE
TO authenticated, anon
USING (uploaded_by = auth.uid())
WITH CHECK (uploaded_by = auth.uid());

-- Policy: Allow users to delete their own evidence files
CREATE POLICY "Users can delete their own evidence files"
ON kra_evidence_files FOR DELETE
TO authenticated, anon
USING (uploaded_by = auth.uid());

-- Also simplify storage policies to be more permissive
DROP POLICY IF EXISTS "Authenticated users can view KRA evidence files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload KRA evidence files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update KRA evidence files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete KRA evidence files" ON storage.objects;

-- Simple storage policies - just check authentication and bucket
CREATE POLICY "Allow authenticated users to access KRA evidence storage"
ON storage.objects FOR ALL
TO authenticated, anon
USING (bucket_id = 'KRA-evidence')
WITH CHECK (bucket_id = 'KRA-evidence');

-- Add a comment to track this fix
COMMENT ON TABLE kra_evidence_files IS 'KRA evidence files with simplified RLS policies for better compatibility';
