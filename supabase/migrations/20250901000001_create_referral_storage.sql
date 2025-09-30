-- ===================================================
-- MANUAL STORAGE SETUP FOR REFERRAL RESUMES BUCKET
-- ===================================================
-- Run these commands in your Supabase SQL Editor
-- (Dashboard > SQL Editor > New Query)
-- 
-- NOTE: This app uses custom users table in public schema,
-- not Supabase auth schema

-- 1. First, check if bucket exists (optional - just to verify)
SELECT * FROM storage.buckets WHERE id = 'referral-resumes';

-- 2. Create the bucket if it doesn't exist (you mentioned you already created it)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('referral-resumes', 'referral-resumes', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policy that allows anyone (including anonymous users) to access referral resumes
-- This works for apps that handle authentication separately
CREATE POLICY "Allow anyone to access referral resumes"
  ON storage.objects 
  FOR ALL 
  TO anon, authenticated 
  USING (bucket_id = 'referral-resumes')
  WITH CHECK (bucket_id = 'referral-resumes');

-- ===================================================
-- ALTERNATIVE: Simple approach for apps without Supabase auth
-- ===================================================

-- Drop the above policies if they don't work
-- DROP POLICY "Users can upload referral resumes" ON storage.objects;
-- DROP POLICY "Users can view referral resumes" ON storage.objects;
-- DROP POLICY "Users can update referral resume uploads" ON storage.objects;
-- DROP POLICY "Users can delete referral resume files" ON storage.objects;

-- Policy that allows anyone (including anonymous users) to access referral resumes
-- This works for apps that handle authentication separately
-- CREATE POLICY "Allow anyone to access referral resumes"
--   ON storage.objects 
--   FOR ALL 
--   TO anon, authenticated 
--   USING (bucket_id = 'referral-resumes')
--   WITH CHECK (bucket_id = 'referral-resumes');

-- ===================================================
-- FALLBACK: If RLS is causing too many issues, disable it temporarily
-- ===================================================
-- WARNING: Only use this for development/testing
-- ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
