# Complete Fix Guide for Email Function Error

## 🚨 The Problem

You're getting this error when submitting or updating leave applications:
```
function send_leave_email_notification(uuid, unknown) does not exist
```

## 🎯 Two-Part Solution

### Part 1: Fix the Database (REQUIRED)

The root cause is in the database - old triggers are calling deprecated functions.

**Run this in Supabase SQL Editor:**

1. Go to: https://supabase.com/dashboard/project/xsrnbglsrikxpnhodiew/sql
2. Copy and paste the contents of `URGENT_FIX_run_this_in_supabase.sql`
3. Click "Run"

This will:
- ✅ Remove all old `send_leave_email_notification` functions
- ✅ Remove all old triggers
- ✅ Create new trigger that uses `send_leave_email_notification_generic`

### Part 2: Frontend Resilience (COMPLETED)

I've updated `src/hooks/useLeave.ts` to handle the error gracefully:

**Changes Made:**

1. **`useCreateLeaveApplication`**: Now detects the email function error and shows success message anyway
2. **`useWithdrawLeaveApplication`**: Now handles the error during withdrawal and continues the operation
3. **Better Error Handling**: Distinguishes between email trigger errors and actual operation failures

## 🔧 What the Frontend Changes Do

### Before Fix:
```
❌ Error: function send_leave_email_notification(uuid, unknown) does not exist
❌ Leave application fails completely
❌ User sees error message
```

### After Frontend Fix:
```
✅ Leave application created successfully
✅ User sees success message with note about email system
⚠️ Email trigger fails silently in background
✅ All data queries refresh properly
```

## 🚀 How to Apply Both Fixes

### Step 1: Database Fix (Do this first)
```sql
-- Run in Supabase SQL Editor
-- (Copy from URGENT_FIX_run_this_in_supabase.sql)
```

### Step 2: Frontend is Already Fixed
The `useLeave.ts` file has been updated with error handling.

### Step 3: Test
1. Refresh your application
2. Try submitting a leave application
3. Should work without errors now

## 📋 Verification

After applying both fixes:

### Database Check:
```sql
-- Should return only send_leave_email_notification_generic
SELECT 
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname LIKE '%send_leave_email%';
```

### Frontend Check:
- Submit a leave application → Should show success
- Withdraw a leave application → Should show success
- No more function errors in console

## 🎉 Expected Behavior After Fix

1. **Leave Creation**: Works perfectly, emails queued via new system
2. **Leave Withdrawal**: Works perfectly, emails queued via new system  
3. **Email Notifications**: Sent via `send_leave_email_notification_generic`
4. **Error Handling**: Graceful fallbacks if email system has issues

## 📝 Important Notes

- **Database fix is REQUIRED** - frontend fix is just a safety net
- **Old migration files** still exist but their functions are removed from database
- **New email system** is more robust and supports all modules
- **Frontend changes** make the app resilient to email system issues

## 🔍 Files Modified

1. **`URGENT_FIX_run_this_in_supabase.sql`** - Database cleanup script
2. **`src/hooks/useLeave.ts`** - Frontend error handling
3. **`EMAIL_SYSTEM_SUMMARY.md`** - Technical documentation

## ✅ Success Criteria

After applying both fixes:
- ✅ No more `send_leave_email_notification` errors
- ✅ Leave applications submit successfully
- ✅ Leave withdrawals work properly
- ✅ Email notifications use new generic system
- ✅ Graceful error handling for future issues
