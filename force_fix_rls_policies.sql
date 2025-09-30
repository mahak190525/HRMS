-- FORCE FIX: Completely reset and rebuild RLS policies for asset_requests
-- This script is more aggressive and should definitively fix the issue

-- 1. DISABLE RLS temporarily to ensure clean slate
ALTER TABLE asset_requests DISABLE ROW LEVEL SECURITY;

-- 2. DROP ALL POLICIES (more comprehensive approach)
DO $$ 
DECLARE
    pol_record RECORD;
BEGIN
    -- Get all policies for this table
    FOR pol_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'asset_requests' 
        AND schemaname = 'public'
    LOOP
        -- Force drop each policy
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.asset_requests CASCADE', pol_record.policyname);
        RAISE NOTICE 'Dropped policy: %', pol_record.policyname;
    END LOOP;
END $$;

-- 3. VERIFY all policies are dropped
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count 
    FROM pg_policies 
    WHERE tablename = 'asset_requests' AND schemaname = 'public';
    
    IF policy_count > 0 THEN
        RAISE EXCEPTION 'Failed to drop all policies. % policies remain.', policy_count;
    ELSE
        RAISE NOTICE 'SUCCESS: All policies dropped. Count: %', policy_count;
    END IF;
END $$;

-- 4. RE-ENABLE RLS
ALTER TABLE asset_requests ENABLE ROW LEVEL SECURITY;

-- 5. CREATE ONLY THE EXACT POLICIES WE NEED

-- Policy A: Users can create their own requests
CREATE POLICY "allow_insert_own_requests" ON asset_requests
  FOR INSERT 
  WITH CHECK (user_id = auth.uid());

-- Policy B: Users can update their own pending requests  
CREATE POLICY "allow_update_own_pending_requests" ON asset_requests
  FOR UPDATE 
  USING (user_id = auth.uid() AND status = 'pending')
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

-- Policy C: MANAGERS can view ONLY direct reports' requests (NOT their own)
CREATE POLICY "managers_view_direct_reports_only" ON asset_requests
  FOR SELECT 
  USING (
    -- Must be a manager role
    EXISTS (
      SELECT 1 FROM users mgr_user
      JOIN roles mgr_role ON mgr_user.role_id = mgr_role.id
      WHERE mgr_user.id = auth.uid()
      AND mgr_role.name IN ('sdm', 'bdm', 'qam', 'hrm')
    )
    AND
    -- Request must be from a direct report
    EXISTS (
      SELECT 1 FROM users requester
      WHERE asset_requests.user_id = requester.id
      AND requester.manager_id = auth.uid()
    )
  );

-- Policy D: HR/Admin can view ALL requests
CREATE POLICY "hr_admin_view_all_requests" ON asset_requests
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND (u."isSA" = true OR r.name IN ('hr', 'admin', 'super_admin'))
    )
  );

-- Policy E: HR/Admin and Managers can update requests appropriately
CREATE POLICY "allow_authorized_updates" ON asset_requests
  FOR UPDATE 
  USING (
    -- HR/Admin can update all requests
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND (u."isSA" = true OR r.name IN ('hr', 'admin', 'super_admin'))
    )
    OR
    -- Managers can update direct reports' requests
    (
      EXISTS (
        SELECT 1 FROM users mgr_user
        JOIN roles mgr_role ON mgr_user.role_id = mgr_role.id
        WHERE mgr_user.id = auth.uid()
        AND mgr_role.name IN ('sdm', 'bdm', 'qam', 'hrm')
      )
      AND
      EXISTS (
        SELECT 1 FROM users requester
        WHERE asset_requests.user_id = requester.id
        AND requester.manager_id = auth.uid()
      )
    )
  );

-- 6. VERIFY the new policies
SELECT 
  'NEW POLICIES CREATED' as status,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename = 'asset_requests' AND schemaname = 'public';

-- 7. LIST all new policies
SELECT 
  policyname,
  cmd as operation,
  CASE 
    WHEN policyname LIKE '%insert%' OR policyname LIKE '%create%' THEN '✏️ Create Policy'
    WHEN policyname LIKE '%update%' THEN '📝 Update Policy'
    WHEN policyname LIKE '%manager%' THEN '👔 Manager View Policy'
    WHEN policyname LIKE '%hr%' OR policyname LIKE '%admin%' THEN '👑 Admin View Policy'
    ELSE '❓ Other Policy'
  END as policy_type
FROM pg_policies 
WHERE tablename = 'asset_requests' AND schemaname = 'public'
ORDER BY policyname;

-- 8. Add comments for clarity
COMMENT ON POLICY "managers_view_direct_reports_only" ON asset_requests IS 
'CRITICAL: Managers can ONLY see requests from users where requester.manager_id = current_user.id. Managers CANNOT see their own requests.';

COMMENT ON POLICY "hr_admin_view_all_requests" ON asset_requests IS 
'HR/Admin/SuperAdmin can see all requests regardless of hierarchy.';

-- SUCCESS MESSAGE
SELECT 'RLS POLICIES FORCE RESET COMPLETE! Please test again.' as final_status;
