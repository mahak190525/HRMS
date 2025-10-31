-- Debug migration to ensure evidence access is working
-- This will help us understand what's happening with the policies

-- First, let's make sure the table has the right structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'kra_evidence_files' 
ORDER BY ordinal_position;

-- Check if there are any evidence files in the database
SELECT 
  kef.id,
  kef.assignment_id,
  kef.quarter,
  kef.original_name,
  kef.uploaded_by,
  kef.uploaded_at,
  ka.employee_id,
  u.full_name as employee_name
FROM kra_evidence_files kef
JOIN kra_assignments ka ON ka.id = kef.assignment_id
JOIN users u ON u.id = ka.employee_id
ORDER BY kef.uploaded_at DESC
LIMIT 10;

-- Check current policies on the table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'kra_evidence_files';

-- Add a comment to track this debug
COMMENT ON TABLE kra_evidence_files IS 'Debug: Checking evidence file access - run this migration to see current state';
