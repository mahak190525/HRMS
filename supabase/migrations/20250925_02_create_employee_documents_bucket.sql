-- Storage Bucket Creation for Employee Documents
-- Description: Creates the storage bucket for employee documents
-- Note: This should be run in Supabase SQL Editor or via CLI

-- Create the storage bucket for employee documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('employee-documents', 'employee-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for the employee-documents bucket
-- Note: Drop existing policies first to avoid conflicts, then recreate them

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can view employee documents" ON storage.objects;
DROP POLICY IF EXISTS "HR/Admin can upload employee documents" ON storage.objects;
DROP POLICY IF EXISTS "HR/Admin can update employee documents" ON storage.objects;
DROP POLICY IF EXISTS "HR/Admin can delete employee documents" ON storage.objects;
DROP POLICY IF EXISTS "Employees can view own documents" ON storage.objects;
DROP POLICY IF EXISTS "Employees can upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "Employees can update own documents" ON storage.objects;
DROP POLICY IF EXISTS "Employees can delete own documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated upload employee documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update employee documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete employee documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow public view employee documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow public upload employee documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update employee documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow public delete employee documents" ON storage.objects;

-- Allow public access to view files (since using custom auth)
CREATE POLICY "Allow public view employee documents" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'employee-documents');

-- Allow public upload of files (application handles auth and permissions)
CREATE POLICY "Allow public upload employee documents" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'employee-documents');

-- Allow public update of files (application handles auth and permissions)
CREATE POLICY "Allow public update employee documents" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'employee-documents');

-- Allow public delete of files (application handles auth and permissions)
CREATE POLICY "Allow public delete employee documents" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'employee-documents');

-- Note: Employee self-access removed since documents are now organized by document type
-- Employees can still view documents through the application's database-level permissions
