-- Diagnostic script to check current RLS policies and understand the issue

-- 1. Show ALL current policies on asset_requests
SELECT 
  tablename,
  policyname,
  cmd as operation,
  permissive,
  roles,
  qual as condition
FROM pg_policies 
WHERE tablename = 'asset_requests' 
AND schemaname = 'public'
ORDER BY policyname;

-- 2. Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'asset_requests' 
AND schemaname = 'public';

-- 3. Show sample data for debugging
-- Replace 'TESTING_ACCOUNT_UUID' with the actual Testing Account UUID
SELECT 
  'Testing Account Info' as debug_section,
  u.id,
  u.full_name,
  r.name as role_name,
  u.manager_id
FROM users u
LEFT JOIN roles r ON u.role_id = r.id
WHERE u.full_name ILIKE '%testing%' OR u.full_name ILIKE '%test%'
ORDER BY u.full_name;

-- 4. Check direct reports for Testing Account
-- Replace 'TESTING_ACCOUNT_UUID' with actual UUID
SELECT 
  'Direct Reports Check' as debug_section,
  COUNT(*) as direct_reports_count,
  STRING_AGG(u.full_name, ', ') as report_names
FROM users u
WHERE u.manager_id = 'TESTING_ACCOUNT_UUID'; -- Replace with actual UUID

-- 5. Check all asset requests and their visibility
SELECT 
  'All Asset Requests' as debug_section,
  ar.id,
  u.full_name as requester_name,
  u.manager_id as requester_manager_id,
  ar.status,
  ar.created_at
FROM asset_requests ar
JOIN users u ON ar.user_id = u.id
ORDER BY ar.created_at DESC
LIMIT 10;

-- 6. Test the specific policy logic for Testing Account
-- Replace 'TESTING_ACCOUNT_UUID' with actual UUID
SELECT 
  'Policy Logic Test' as debug_section,
  ar.id as request_id,
  ar.user_id as request_user_id,
  requester.full_name as requester_name,
  requester.manager_id as requester_manager_id,
  manager_user.id as current_user_id,
  manager_user.full_name as current_user_name,
  manager_role.name as current_user_role,
  CASE 
    WHEN requester.manager_id = manager_user.id 
      AND manager_role.name IN ('sdm', 'bdm', 'qam', 'hrm') 
    THEN 'SHOULD_BE_VISIBLE'
    ELSE 'SHOULD_NOT_BE_VISIBLE'
  END as expected_visibility
FROM asset_requests ar
JOIN users requester ON ar.user_id = requester.id
CROSS JOIN users manager_user 
JOIN roles manager_role ON manager_user.role_id = manager_role.id
WHERE manager_user.id = 'TESTING_ACCOUNT_UUID' -- Replace with actual UUID
ORDER BY ar.created_at DESC;

-- Instructions:
-- 1. Replace 'TESTING_ACCOUNT_UUID' with the actual UUID of the Testing Account user
-- 2. Run each section to understand what's happening
-- 3. If ALL requests show 'SHOULD_NOT_BE_VISIBLE' but the user can still see them, 
--    then there's definitely a policy issue
