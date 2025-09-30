-- Debug script for manager isolation issue
-- Run this to understand why a manager might not see requests from their direct reports

-- 1. Check current RLS policies on asset_requests
SELECT 
  tablename,
  policyname,
  cmd as operation,
  qual as policy_condition
FROM pg_policies 
WHERE tablename = 'asset_requests' 
AND schemaname = 'public'
ORDER BY policyname;

-- 2. Find the manager and their direct reports
-- Replace 'MANAGER_ID_HERE' with the actual manager's UUID
WITH manager_info AS (
  SELECT 
    u.id as manager_id,
    u.full_name as manager_name,
    r.name as manager_role
  FROM users u
  JOIN roles r ON u.role_id = r.id
  WHERE u.id = 'MANAGER_ID_HERE'  -- Replace with actual manager UUID
),
direct_reports AS (
  SELECT 
    u.id as report_id,
    u.full_name as report_name,
    u.manager_id
  FROM users u
  WHERE u.manager_id = 'MANAGER_ID_HERE'  -- Replace with actual manager UUID
)
SELECT 
  mi.manager_name,
  mi.manager_role,
  dr.report_name,
  dr.report_id
FROM manager_info mi
LEFT JOIN direct_reports dr ON mi.manager_id = dr.manager_id;

-- 3. Check asset requests from direct reports
SELECT 
  ar.id as request_id,
  ar.user_id,
  u.full_name as requester_name,
  u.manager_id,
  ar.status,
  ar.created_at,
  ac.name as category
FROM asset_requests ar
JOIN users u ON ar.user_id = u.id
LEFT JOIN asset_categories ac ON ar.category_id = ac.id
WHERE u.manager_id = 'MANAGER_ID_HERE'  -- Replace with actual manager UUID
ORDER BY ar.created_at DESC;

-- 4. Test the RLS policy manually
-- This should show what the manager can see when they query asset_requests
-- You need to run this as the manager user (set their JWT token)
-- SELECT * FROM asset_requests;

-- 5. Check if the manager role validation is working
SELECT 
  u.id,
  u.full_name,
  r.name as role_name,
  CASE 
    WHEN r.name IN ('sdm', 'bdm', 'qam', 'hrm') THEN 'IS_MANAGER'
    ELSE 'NOT_MANAGER'
  END as manager_status
FROM users u
JOIN roles r ON u.role_id = r.id
WHERE u.id = 'MANAGER_ID_HERE';  -- Replace with actual manager UUID

-- 6. Debug the RLS policy logic step by step
-- This simulates what the RLS policy is checking
SELECT 
  'Policy Check Results' as debug_step,
  ar.id as request_id,
  ar.user_id as request_user_id,
  requester.full_name as requester_name,
  requester.manager_id as requester_manager_id,
  manager_user.id as current_manager_id,
  manager_user.full_name as current_manager_name,
  manager_role.name as current_manager_role,
  CASE 
    WHEN requester.manager_id = manager_user.id 
      AND manager_role.name IN ('sdm', 'bdm', 'qam', 'hrm') 
    THEN 'SHOULD_BE_VISIBLE'
    ELSE 'SHOULD_NOT_BE_VISIBLE'
  END as visibility_status
FROM asset_requests ar
JOIN users requester ON ar.user_id = requester.id
CROSS JOIN users manager_user 
JOIN roles manager_role ON manager_user.role_id = manager_role.id
WHERE manager_user.id = 'MANAGER_ID_HERE'  -- Replace with actual manager UUID
ORDER BY ar.created_at DESC;

-- Instructions:
-- 1. Replace 'MANAGER_ID_HERE' with the actual manager's UUID
-- 2. Run each query separately to understand the issue
-- 3. Pay attention to the visibility_status in query #6
