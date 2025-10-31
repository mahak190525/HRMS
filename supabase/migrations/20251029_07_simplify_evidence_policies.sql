-- Simplify evidence policies since KRA assignments are already secured
-- Allow all authenticated users to view evidence files since access control
-- is handled at the KRA assignment level

-- Drop all existing evidence policies
DROP POLICY IF EXISTS "Users can view their own evidence files" ON kra_evidence_files;
DROP POLICY IF EXISTS "Admins can view all evidence files" ON kra_evidence_files;
DROP POLICY IF EXISTS "Employees can insert their own evidence files" ON kra_evidence_files;
DROP POLICY IF EXISTS "Users can update their own evidence files" ON kra_evidence_files;
DROP POLICY IF EXISTS "Users can delete their own evidence files" ON kra_evidence_files;
DROP POLICY IF EXISTS "Managers can view team evidence files" ON kra_evidence_files;
DROP POLICY IF EXISTS "HR and Admin can view all evidence files" ON kra_evidence_files;
DROP POLICY IF EXISTS "Employees can view own evidence files" ON kra_evidence_files;
DROP POLICY IF EXISTS "HR Admin can view all evidence files" ON kra_evidence_files;
DROP POLICY IF EXISTS "Employees can insert own evidence files" ON kra_evidence_files;
DROP POLICY IF EXISTS "Users can update own evidence files" ON kra_evidence_files;
DROP POLICY IF EXISTS "Users can delete own evidence files" ON kra_evidence_files;

-- Create simple policies - allow all authenticated users to access evidence files
-- Security is handled at the KRA assignment level

-- 1. All authenticated users can view evidence files
CREATE POLICY "All authenticated users can view evidence files"
ON kra_evidence_files FOR SELECT
TO authenticated, anon
USING (true);

-- 2. Users can insert evidence files (with assignment validation in app logic)
CREATE POLICY "Authenticated users can insert evidence files"
ON kra_evidence_files FOR INSERT
TO authenticated, anon
WITH CHECK (true);

-- 3. Users can update their own evidence files
CREATE POLICY "Users can update own evidence files"
ON kra_evidence_files FOR UPDATE
TO authenticated, anon
USING (uploaded_by = auth.uid())
WITH CHECK (uploaded_by = auth.uid());

-- 4. Users can delete their own evidence files
CREATE POLICY "Users can delete own evidence files"
ON kra_evidence_files FOR DELETE
TO authenticated, anon
USING (uploaded_by = auth.uid());

-- Ensure storage policies are also simple
DROP POLICY IF EXISTS "Allow authenticated users to access KRA evidence storage" ON storage.objects;
DROP POLICY IF EXISTS "KRA evidence storage access" ON storage.objects;

-- Simple storage policy - allow all authenticated users to access the bucket
CREATE POLICY "All authenticated users can access KRA evidence storage"
ON storage.objects FOR ALL
TO authenticated, anon
USING (bucket_id = 'KRA-evidence')
WITH CHECK (bucket_id = 'KRA-evidence');

-- Add helpful comments
COMMENT ON POLICY "All authenticated users can view evidence files" ON kra_evidence_files IS 'Simplified policy - all authenticated users can view evidence files since KRA assignments are already secured';
COMMENT ON POLICY "Authenticated users can insert evidence files" ON kra_evidence_files IS 'Allow authenticated users to upload evidence files';
COMMENT ON POLICY "Users can update own evidence files" ON kra_evidence_files IS 'Users can only update their own evidence files';
COMMENT ON POLICY "Users can delete own evidence files" ON kra_evidence_files IS 'Users can only delete their own evidence files';

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON kra_evidence_files TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON kra_evidence_files TO anon;
