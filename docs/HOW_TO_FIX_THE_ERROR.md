# How to Fix the Email Function Error

## The Problem

You're getting this error when submitting leave applications:
```
function send_leave_email_notification(uuid, unknown) does not exist
```

This happens because:
1. **Old migration files** created an old version of `send_leave_email_notification`
2. **Old triggers** are still calling this deprecated function
3. **The ONLY correct function is:** `send_leave_email_notification_generic`

### ⚠️ IMPORTANT:
- ❌ `send_leave_email_notification` - **DEPRECATED, DO NOT USE**
- ✅ `send_leave_email_notification_generic` - **THE ONLY FUNCTION TO USE**

## The Solution

### Option 1: Run SQL Directly in Supabase (FASTEST)

1. **Go to your Supabase Dashboard**: https://supabase.com/dashboard/project/xsrnbglsrikxpnhodiew
2. **Click on "SQL Editor"** in the left sidebar
3. **Open the file** `URGENT_FIX_run_this_in_supabase.sql`
4. **Copy all the contents** of that file
5. **Paste into the SQL Editor**
6. **Click "Run"**

This will:
- ✅ Drop all old email functions
- ✅ Drop all old triggers
- ✅ Create the correct trigger that calls the new generic email system
- ✅ Verify the fix worked

### Option 2: Run Migration via CLI

```bash
cd "D:\HRMS DEV"
supabase migration up
```

This will apply the migration file `20251126_04_force_cleanup_email_system.sql`.

## After Running the Fix

1. **Refresh your frontend application**
2. **Try submitting a leave application again**
3. **The error should be gone!**

## What Changed

### Before (Old System)
- Function: `send_leave_email_notification(uuid, text)`
- Table: `email_queue` with `leave_application_id` column
- Only worked for leave applications

### After (New System)
- Function: `send_leave_email_notification_generic(uuid, email_type_enum)`
- Table: `email_queue` with `module_type` and `reference_id` columns
- Works for ANY module (leave, policy, performance, payroll, etc.)

## Verification

After running the fix, you can verify it worked by running this query in Supabase SQL Editor:

```sql
-- Should return ONLY the new trigger
SELECT 
  t.tgname as trigger_name,
  pg_get_triggerdef(t.oid) as definition
FROM pg_trigger t
WHERE t.tgrelid = 'leave_applications'::regclass
AND NOT t.tgisinternal;

-- Should return ONLY send_leave_email_notification_generic
SELECT 
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname LIKE '%send_leave_email%';
```

## Need Help?

If you still see the error after running the fix:
1. Check the Supabase logs for any migration errors
2. Run the verification queries above to see what's still in the database
3. Make sure you refreshed your frontend application
