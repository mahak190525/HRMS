# Print Blocking Notification System - Troubleshooting Guide

## Problem: Notifications Not Being Created

### Root Causes Fixed

1. **❌ Invalid Column Reference**
   - **Problem:** Used non-existent `related_id` column
   - **Fix:** Changed to use `data` JSONB column with structured data

2. **❌ JSONB Type Mismatch**
   - **Problem:** Passed `additional_data` as JSON string instead of JSONB object
   - **Fix:** Updated `printBlocker.ts` to pass object directly (line 58)

3. **❌ Missing RLS Policy**
   - **Problem:** Restrictive INSERT policy prevented trigger from creating notifications
   - **Fix:** Added "System can create security notifications" policy

4. **❌ Silent Failures**
   - **Problem:** No error logging in trigger function
   - **Fix:** Added comprehensive error handling with `RAISE NOTICE` and `RAISE WARNING`

---

## Step-by-Step Verification

### 1. Re-run the Migration

Execute the updated migration file in Supabase SQL Editor:

```sql
-- This will recreate the trigger function with error handling
\i supabase/migrations/20251027_01_create_print_blocking_logs.sql
```

Or manually execute the file contents in Supabase Dashboard → SQL Editor.

### 2. Enable Logging

In Supabase SQL Editor, enable notices to see debug output:

```sql
SET client_min_messages TO NOTICE;
```

### 3. Run Test Script

Execute the test script to verify setup:

```sql
\i test_notification_trigger.sql
```

Or copy the contents and run in SQL Editor.

### 4. Verify Database Setup

Run these queries to check the setup:

```sql
-- Check trigger exists and is enabled
SELECT 
  tgname, 
  tgenabled,
  tgrelid::regclass
FROM pg_trigger
WHERE tgname = 'trigger_notify_print_blocking';

-- Check RLS policies on notifications
SELECT 
  policyname,
  cmd,
  permissive
FROM pg_policies
WHERE tablename = 'notifications'
ORDER BY policyname;

-- Check if HR/Admin users exist
SELECT 
  u.id,
  u.full_name,
  r.name as role
FROM users u
JOIN roles r ON u.role_id = r.id
WHERE r.name IN ('hr', 'admin', 'super_admin')
  AND u.status = 'active';
```

### 5. Test Manually

Test the entire flow manually:

```sql
-- Replace with actual user UUID from your database
DO $$
DECLARE
  test_user_id UUID := 'YOUR-USER-UUID-HERE';
  log_id UUID;
BEGIN
  -- Enable notices
  SET client_min_messages TO NOTICE;
  
  -- Call the log function (this should trigger notifications)
  SELECT log_print_blocking_attempt(
    test_user_id,
    'print',
    'Print',
    'Ctrl+P',
    'https://test.com',
    'Test Browser',
    jsonb_build_object('test', true)
  ) INTO log_id;
  
  RAISE NOTICE 'Created log entry: %', log_id;
END $$;

-- Check if notifications were created
SELECT 
  n.id,
  u.full_name,
  u.email,
  r.name as role,
  n.title,
  n.message,
  n.type,
  n.created_at
FROM notifications n
JOIN users u ON n.user_id = u.id
JOIN roles r ON u.role_id = r.id
WHERE n.type = 'security'
ORDER BY n.created_at DESC
LIMIT 10;
```

### 6. Check Supabase Logs

Go to Supabase Dashboard → Logs → Postgres Logs

Look for:
- ✅ `NOTICE: Print blocking notification trigger fired for user_id: ...`
- ✅ `NOTICE: Found employee: ...`
- ✅ `NOTICE: Created notification for employee: ...`
- ✅ `NOTICE: Created notification for HR/Admin: ...`
- ❌ Any `WARNING` messages indicating failures

### 7. Test in Application

1. Open your application in the browser
2. Open browser console (F12)
3. Try to print (Ctrl+P)
4. Check console for:
   ```
   Logging print blocking attempt for user ID: ...
   Successfully logged print blocking attempt: print - Print for user ID: ...
   ```
5. Query database:
   ```sql
   -- Check print blocking logs
   SELECT * FROM print_blocking_logs 
   ORDER BY blocked_at DESC 
   LIMIT 5;
   
   -- Check notifications
   SELECT * FROM notifications 
   WHERE type = 'security'
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

---

## Common Issues & Solutions

### Issue 1: "User not found" Warning

**Symptom:** In logs: `WARNING: User not found for user_id: ...`

**Solutions:**
1. Verify user ID exists in `users` table:
   ```sql
   SELECT id, full_name, email, status FROM users WHERE id = 'user-uuid-here';
   ```
2. Check `localStorage` in browser console:
   ```javascript
   console.log(localStorage.getItem('hrms_user'));
   ```
3. Ensure user is logged in and authenticated

### Issue 2: No Notifications Created

**Symptom:** `print_blocking_logs` has entries but `notifications` table is empty

**Solutions:**
1. Check if trigger is enabled:
   ```sql
   SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'trigger_notify_print_blocking';
   ```
2. Check RLS policies allow INSERT:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'notifications' AND cmd = 'INSERT';
   ```
3. Check if HR/Admin users exist:
   ```sql
   SELECT COUNT(*) FROM users u
   JOIN roles r ON u.role_id = r.id
   WHERE r.name IN ('hr', 'admin', 'super_admin') AND u.status = 'active';
   ```
4. Review Postgres logs for error messages

### Issue 3: RLS Policy Error

**Symptom:** Error: "new row violates row-level security policy"

**Solutions:**
1. Ensure "System can create security notifications" policy exists:
   ```sql
   SELECT * FROM pg_policies 
   WHERE tablename = 'notifications' 
   AND policyname = 'System can create security notifications';
   ```
2. If missing, create it:
   ```sql
   CREATE POLICY "System can create security notifications"
     ON notifications
     FOR INSERT
     TO authenticated
     WITH CHECK (type = 'security');
   ```

### Issue 4: Function Not Found

**Symptom:** Error: "function log_print_blocking_attempt does not exist"

**Solution:**
1. Verify function exists:
   ```sql
   SELECT proname, proargtypes 
   FROM pg_proc 
   WHERE proname = 'log_print_blocking_attempt';
   ```
2. Re-run migration file to create function

### Issue 5: JSONB Type Error

**Symptom:** Error: "column 'additional_data' is of type jsonb but expression is of type text"

**Solution:**
Already fixed in `src/utils/printBlocker.ts` line 58:
- ❌ Old: `p_additional_data: additionalData ? JSON.stringify(additionalData) : null`
- ✅ New: `p_additional_data: additionalData || null`

---

## Debug Checklist

- [ ] Migration file executed successfully
- [ ] `print_blocking_logs` table exists
- [ ] `notifications` table exists
- [ ] Trigger `trigger_notify_print_blocking` exists and is enabled
- [ ] Function `notify_print_blocking_attempt` exists with SECURITY DEFINER
- [ ] Function `log_print_blocking_attempt` exists
- [ ] RLS policy "System can create security notifications" exists
- [ ] At least one HR/Admin user exists with status = 'active'
- [ ] User can successfully log in and has valid UUID
- [ ] Print blocking logs are being created when Ctrl+P is pressed
- [ ] Notifications are created after print blocking log insertion
- [ ] Users can see notifications in their notification bell

---

## Expected Behavior

When a user presses Ctrl+P (or any other blocked action):

1. ✅ Toast notification appears: "Printing is disabled for security reasons."
2. ✅ Console log: "Logging print blocking attempt for user ID: ..."
3. ✅ Entry created in `print_blocking_logs` table
4. ✅ Trigger fires: `notify_print_blocking_attempt()`
5. ✅ Notifications created for:
   - Employee (title: "Action Blocked")
   - All HR users (title: "Security Alert: Print Blocking Attempt")
   - All Admin users (title: "Security Alert: Print Blocking Attempt")
   - Employee's manager if exists (title: "Security Alert: Print Blocking Attempt")
6. ✅ Users see new notifications in notification bell icon
7. ✅ Console shows: "Successfully logged print blocking attempt: ..."

---

## Contact Points

If issues persist after following this guide:

1. Check Supabase Dashboard → Logs → Postgres Logs
2. Check browser console for JavaScript errors
3. Verify environment variable: `VITE_ENABLE_PRINT_BLOCKING=true`
4. Run `test_notification_trigger.sql` to diagnose database issues
5. Review `PRINT_BLOCKING_CONFIG.md` for configuration details

---

## Changes Made in This Fix

### Files Modified:

1. **`supabase/migrations/20251027_01_create_print_blocking_logs.sql`**
   - Removed `related_id` column references
   - Added `data` JSONB column with structured data
   - Added comprehensive error handling with RAISE NOTICE/WARNING
   - Added RLS policy for security notifications
   - Granted INSERT/SELECT permissions on notifications table

2. **`src/utils/printBlocker.ts`**
   - Changed line 58: Pass `additionalData` as object, not JSON string

3. **`test_notification_trigger.sql`** (NEW)
   - Created comprehensive test script for debugging

4. **`NOTIFICATION_TROUBLESHOOTING.md`** (NEW)
   - This troubleshooting guide

### Key Improvements:

- ✅ Better error handling and logging
- ✅ Fixed JSONB type mismatch
- ✅ Fixed RLS policy issues
- ✅ Added comprehensive debugging tools
- ✅ Created troubleshooting documentation

