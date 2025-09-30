-- Debug the specific manager issue
-- Replace 'MANAGER_UUID' with the actual manager's UUID: 8bc2d108-047c-45ba-8e59-e27c95ccc924

-- 1. Show all asset requests and their relationship to the manager
SELECT 
  'All Asset Requests Analysis' as section,
  ar.id as request_id,
  ar.user_id,
  u.full_name as requester_name,
  u.manager_id as requester_manager_id,
  CASE 
    WHEN u.manager_id = '8bc2d108-047c-45ba-8e59-e27c95ccc924' THEN 'FROM_DIRECT_REPORT'
    WHEN ar.user_id = '8bc2d108-047c-45ba-8e59-e27c95ccc924' THEN 'FROM_MANAGER_THEMSELVES'
    ELSE 'FROM_OTHER_USER'
  END as relationship_to_manager,
  ar.status,
  ar.created_at
FROM asset_requests ar
JOIN users u ON ar.user_id = u.id
ORDER BY ar.created_at DESC;

-- 2. Test the exact policy logic for each request
SELECT 
  'Policy Logic Test' as section,
  ar.id as request_id,
  ar.user_id as request_user_id,
  u.full_name as requester_name,
  u.manager_id as requester_manager_id,
  
  -- Test the manager role check
  (SELECT EXISTS (
    SELECT 1 FROM users mgr_user
    JOIN roles mgr_role ON mgr_user.role_id = mgr_role.id
    WHERE mgr_user.id = '8bc2d108-047c-45ba-8e59-e27c95ccc924'
    AND mgr_role.name IN ('sdm', 'bdm', 'qam', 'hrm')
  )) as manager_role_check_passes,
  
  -- Test the direct report check
  (SELECT EXISTS (
    SELECT 1 FROM users requester
    WHERE ar.user_id = requester.id
    AND requester.manager_id = '8bc2d108-047c-45ba-8e59-e27c95ccc924'
  )) as direct_report_check_passes,
  
  -- Combined result
  CASE 
    WHEN (SELECT EXISTS (
      SELECT 1 FROM users mgr_user
      JOIN roles mgr_role ON mgr_user.role_id = mgr_role.id
      WHERE mgr_user.id = '8bc2d108-047c-45ba-8e59-e27c95ccc924'
      AND mgr_role.name IN ('sdm', 'bdm', 'qam', 'hrm')
    )) AND (SELECT EXISTS (
      SELECT 1 FROM users requester
      WHERE ar.user_id = requester.id
      AND requester.manager_id = '8bc2d108-047c-45ba-8e59-e27c95ccc924'
    )) THEN 'SHOULD_BE_VISIBLE'
    ELSE 'SHOULD_NOT_BE_VISIBLE'
  END as policy_result
  
FROM asset_requests ar
JOIN users u ON ar.user_id = u.id
ORDER BY ar.created_at DESC;

-- 3. Check the manager's direct reports
SELECT 
  'Manager Direct Reports' as section,
  u.id as report_id,
  u.full_name as report_name,
  u.manager_id,
  COUNT(ar.id) as asset_requests_count
FROM users u
LEFT JOIN asset_requests ar ON u.id = ar.user_id
WHERE u.manager_id = '8bc2d108-047c-45ba-8e59-e27c95ccc924'
GROUP BY u.id, u.full_name, u.manager_id;

-- 4. Check if there are multiple users with the same name causing confusion
SELECT 
  'Duplicate Name Check' as section,
  full_name,
  COUNT(*) as count,
  STRING_AGG(id::text, ', ') as user_ids
FROM users 
WHERE full_name ILIKE '%mahak%'
GROUP BY full_name
HAVING COUNT(*) > 1;

-- Instructions:
-- Run this and look for:
-- 1. In section 1: How many requests exist and their relationships
-- 2. In section 2: Which requests the policy logic says should be visible
-- 3. In section 3: How many direct reports the manager actually has
-- 4. In section 4: If there are duplicate users causing confusion
