-- Quick check to see what RLS policies are currently active
SELECT 
  policyname,
  cmd as operation,
  qual as condition
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'asset_requests'
ORDER BY policyname;

-- Also check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'asset_requests';
