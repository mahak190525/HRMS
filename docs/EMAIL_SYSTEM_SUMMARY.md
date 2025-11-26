# Email System Summary

## ✅ Current State (After Fix)

### **ONLY ONE Email Function Exists:**
```sql
send_leave_email_notification_generic(
  p_leave_application_id uuid,
  p_email_type email_type_enum
)
```

### **OLD Functions (REMOVED):**
- ❌ `send_leave_email_notification(uuid, text)` - **DELETED**
- ❌ `send_leave_email_notification(uuid)` - **DELETED**
- ❌ Any other variants - **DELETED**

## 🎯 How It Works Now

### 1. **Leave Status Changes**
When a leave application status changes (approved/rejected/withdrawn):

```sql
-- Trigger: leave_request_status_update_trigger
-- Function: notify_leave_request_status_update_with_generic_email()
-- Calls: send_leave_email_notification_generic(leave_id, email_type)
```

### 2. **Email Types**
```sql
-- For approved leaves
send_leave_email_notification_generic(leave_id, 'leave_approved'::email_type_enum)

-- For rejected leaves
send_leave_email_notification_generic(leave_id, 'leave_rejected'::email_type_enum)

-- For withdrawn leaves
send_leave_email_notification_generic(leave_id, 'leave_withdrawn'::email_type_enum)
```

### 3. **Email Queue Table**
```sql
-- New generic structure
email_queue (
  id uuid,
  module_type module_type_enum,  -- 'leave_management', 'policy_management', 'performance_management', etc.
  reference_id uuid,              -- ID of the related record (leave_id, policy_id, etc.)
  email_type email_type_enum,     -- 'leave_approved', 'leave_rejected', etc.
  subject text,
  recipients jsonb,               -- { to: [], cc_static: [], cc_dynamic_resolved: [] }
  email_data jsonb,               -- All data needed for the email template
  status email_status_enum,       -- 'pending', 'sent', 'failed'
  priority email_priority_enum,   -- 'high', 'normal', 'low'
  ...
)
```

## 📋 What Was Fixed

### **Problem:**
```
ERROR: function send_leave_email_notification(uuid, unknown) does not exist
```

### **Root Cause:**
- Old migration files created deprecated functions
- Old triggers were still calling these deprecated functions
- The new generic email system uses different functions

### **Solution:**
1. ✅ Dropped ALL old `send_leave_email_notification` functions
2. ✅ Dropped ALL old triggers on `leave_applications`
3. ✅ Created new trigger that calls `send_leave_email_notification_generic`
4. ✅ Updated trigger function to use the correct email types

## 🚀 Files to Run

### **Quick Fix (Run in Supabase SQL Editor):**
```
URGENT_FIX_run_this_in_supabase.sql
```

### **Or via CLI:**
```bash
supabase migration up
```
This will apply: `20251126_04_force_cleanup_email_system.sql`

## ✨ Benefits of New System

1. **Universal:** Works for ANY module (leave, policy, performance, payroll, etc.)
2. **Flexible Recipients:** Supports static CC, dynamic CC (manager, team, roles)
3. **Type Safe:** Uses enums for module types, email types, status, priority
4. **Extensible:** Easy to add new email types and modules
5. **Reliable:** Proper error handling and retry mechanism

## 🔍 Verification

After running the fix, verify with:

```sql
-- Should show ONLY send_leave_email_notification_generic
SELECT 
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname LIKE '%send_leave_email%';

-- Should show ONLY leave_request_status_update_trigger
SELECT 
  t.tgname as trigger_name
FROM pg_trigger t
WHERE t.tgrelid = 'leave_applications'::regclass
AND NOT t.tgisinternal;
```

## 📝 Important Notes

1. **NEVER use** `send_leave_email_notification` - it's deprecated
2. **ALWAYS use** `send_leave_email_notification_generic`
3. The old migration files still exist for historical reference, but their functions are removed from the database
4. Frontend code in `src/services/emailApi.ts` already uses the correct function
5. All email processing happens asynchronously via the `email_queue` table
