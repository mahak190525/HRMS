# How to Check Postgres Logs for Trigger Messages

The logs you're checking (`edge_logs`) only show HTTP requests to your API. The trigger logs (NOTICE and WARNING messages) appear in the **Postgres logs**, not the edge logs.

## 🔍 **Where to Find Trigger Logs**

### **Option 1: Supabase Dashboard**
1. Go to **Supabase Dashboard**
2. Click on **Logs** in the left sidebar
3. Select **Postgres Logs** (not API logs or Edge Function logs)
4. Look for messages containing "EMAIL TRIGGER" or "EMAIL FUNCTION"

### **Option 2: Query Postgres Logs**
Run this query in your Supabase SQL editor:

```sql
-- Check recent Postgres logs for trigger messages
SELECT 
  cast(timestamp as timestamp) as timestamp,
  event_message,
  parsed->>'error_severity' as severity
FROM postgres_logs 
WHERE event_message ILIKE '%EMAIL TRIGGER%'
   OR event_message ILIKE '%EMAIL FUNCTION%'
   OR event_message ILIKE '%leave_request_status_update%'
ORDER BY timestamp DESC
LIMIT 20;
```

### **Option 3: Check All Recent Postgres Activity**
```sql
-- Check all recent Postgres logs
SELECT 
  cast(timestamp as timestamp) as timestamp,
  event_message
FROM postgres_logs 
WHERE timestamp > NOW() - INTERVAL '10 minutes'
ORDER BY timestamp DESC
LIMIT 50;
```

## 🧪 **Alternative: Manual Trigger Test**

If you still don't see logs, let's manually test if the trigger works at all:

```sql
-- First, find a pending leave application
SELECT id, status, user_id 
FROM leave_applications 
WHERE status = 'pending' 
LIMIT 1;

-- Then manually update it (replace the ID with an actual pending leave ID)
UPDATE leave_applications 
SET 
  status = 'approved',
  approved_by = (SELECT id FROM users WHERE role_id = (SELECT id FROM roles WHERE name IN ('admin', 'super_admin') LIMIT 1) LIMIT 1),
  approved_at = NOW(),
  updated_at = NOW()
WHERE id = 'YOUR_PENDING_LEAVE_ID';

-- Check if you see trigger logs after this manual update
```

## 🔧 **If Still No Logs**

If you don't see ANY trigger logs even after manual testing, it means:

1. **Triggers are disabled** on the table
2. **RLS policies** are preventing triggers from firing
3. **The trigger function has a syntax error** and isn't being created
4. **Supabase isn't logging NOTICE messages** (they might be filtered out)

Let's check the trigger status:

```sql
-- Check if the trigger exists and is enabled
SELECT 
  tgname as trigger_name,
  tgenabled as enabled,
  tgtype,
  pg_get_triggerdef(oid) as trigger_definition
FROM pg_trigger
WHERE tgrelid = 'leave_applications'::regclass
  AND tgname = 'leave_request_status_update_trigger';
```

The `tgenabled` column should show:
- `O` = Trigger is enabled
- `D` = Trigger is disabled
- `R` = Trigger fires in replica mode
- `A` = Trigger always fires

---

**Next Step**: Check the **Postgres logs** (not edge logs) for trigger messages, or run the manual trigger test to see if it works at all.

