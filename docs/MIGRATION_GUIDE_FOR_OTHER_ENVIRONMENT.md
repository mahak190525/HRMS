# Migration Guide: Complete System Updates

This guide contains all the migrations and fixes needed to update your other environment with both email system fixes and document type changes, in the correct order.

## Summary of Changes

### Email System Fixes (Critical)
- New generic email queue system
- Fixed function overloading issues
- Updated email type enums
- Edge function improvements
- Frontend service updates

### Document Type Updates (New Today)
- Changed 'Signed Offer Letter' → 'Appointment Letter'
- Changed 'Signed Copy Received' → 'Signed Appointment Letter'
- Updated service layer references
- Maintained data integrity for existing documents

## Prerequisites

- Ensure you have Supabase CLI access
- Backup your database before running these migrations
- Have access to the Supabase SQL Editor

## Step 1: Apply Core Email System Migration

**File**: `supabase/migrations/20251126_01_generic_email_queue_system.sql`

This migration creates the new generic email queue system. Run this first as it's the foundation.

## Step 1.5: Update Document Type Names (NEW)

**File**: `supabase/migrations/20251126_08_update_document_type_names.sql`

This migration updates document type names from 'Signed Offer Letter' to 'Appointment Letter' for consistency. Run this after the email system migration.

```bash
# If using CLI
supabase migration up --include-all

# Or run directly in Supabase SQL Editor
```

## Step 2: Clean Up Old Email Functions

**File**: `supabase/migrations/20251126_04_force_cleanup_email_system.sql`

This removes all old email functions and ensures only the new system is active.

```bash
# This should be applied automatically after Step 1
# Or run directly in Supabase SQL Editor
```

## Step 3: Fix Function Overloading Issues

**Run this SQL directly in Supabase SQL Editor:**

```sql
-- =====================================================
-- FIX: Remove function overloading for mark_email_processed
-- =====================================================

-- Drop the old version (without p_error_details parameter)
DROP FUNCTION IF EXISTS public.mark_email_processed(p_queue_id uuid, p_success boolean, p_error_message text) CASCADE;

-- Verify only the correct version remains
SELECT 
  'Remaining mark_email_processed function:' as info,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname = 'mark_email_processed';

-- Recreate if needed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'mark_email_processed'
  ) THEN
    EXECUTE '
    CREATE OR REPLACE FUNCTION mark_email_processed(
      p_queue_id uuid,
      p_success boolean,
      p_error_message text DEFAULT NULL,
      p_error_details jsonb DEFAULT NULL
    )
    RETURNS void AS $func$
    BEGIN
      IF p_success THEN
        UPDATE email_queue 
        SET 
          status = ''sent''::email_status_enum,
          sent_at = now(),
          updated_at = now()
        WHERE id = p_queue_id;
      ELSE
        UPDATE email_queue 
        SET 
          status = ''failed''::email_status_enum,
          error_message = p_error_message,
          error_details = p_error_details,
          updated_at = now()
        WHERE id = p_queue_id;
      END IF;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;
    ';
  END IF;
END $$;
```

## Step 4: Fix Email Type Issues

**Run this SQL directly in Supabase SQL Editor:**

```sql
-- =====================================================
-- FIX: Update notify_leave_request_submitted function
-- =====================================================

CREATE OR REPLACE FUNCTION notify_leave_request_submitted()
RETURNS TRIGGER AS $$
DECLARE
  employee_name text;
  leave_type_name text;
  manager_id uuid;
  notification_id uuid;
  employee_manager_id uuid;
  employee_department_id uuid;
BEGIN
  -- Get employee details
  SELECT u.full_name, u.manager_id, u.department_id 
  INTO employee_name, employee_manager_id, employee_department_id
  FROM users u WHERE u.id = NEW.user_id;
  
  -- Get leave type name
  SELECT name INTO leave_type_name
  FROM leave_types WHERE id = NEW.leave_type_id;
  
  -- Find managers and HR users to notify
  FOR manager_id IN
    SELECT DISTINCT u.id
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE (
      (u.department_id = employee_department_id AND r.name IN ('sdm', 'bdm', 'qam'))
      OR r.name IN ('hr', 'admin', 'super_admin', 'finance')
      OR u.id = employee_manager_id
    )
    AND u.status = 'active'
    AND u.id != NEW.user_id
  LOOP
    -- Create notification
    INSERT INTO notifications (user_id, title, message, type, data)
    VALUES (
      manager_id,
      'New Leave Request - ' || employee_name,
      employee_name || ' has submitted a ' || leave_type_name || ' request for ' || NEW.days_count || ' days (' || 
      TO_CHAR(NEW.start_date::date, 'DD Mon YYYY') || ' to ' || TO_CHAR(NEW.end_date::date, 'DD Mon YYYY') || ').',
      'leave_request_submitted',
      jsonb_build_object(
        'leave_application_id', NEW.id,
        'employee_id', NEW.user_id,
        'employee_name', employee_name,
        'leave_type', leave_type_name,
        'start_date', NEW.start_date,
        'end_date', NEW.end_date,
        'days_count', NEW.days_count,
        'reason', NEW.reason
      )
    );
  END LOOP;

  -- Send email using the correct email type
  BEGIN
    PERFORM send_leave_email_notification_generic(NEW.id, 'leave_submitted'::email_type_enum);
  EXCEPTION 
    WHEN undefined_function THEN
      RAISE WARNING 'send_leave_email_notification_generic function not found. Skipping email for leave submission %', NEW.id;
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to send email for leave submission %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Step 5: Update Edge Function

**Deploy the updated edge function with approver_title fix:**

1. **Update your edge function** (`supabase/functions/send-email/index.ts`) with the approver_title fix:

```typescript
// Add this to both generateLeaveApprovalEmailTemplate and generateLeaveRejectionEmailTemplate
// Right after the formatDate function:

// Create approver_title if missing (combine name and role)
if (!leaveData.approver_title && leaveData.approver_name && leaveData.approver_role) {
  const roleMap: Record<string, string> = {
    'super_admin': 'Super Admin',
    'admin': 'Admin',
    'hr': 'HR',
    'hrm': 'HR Manager',
    'sdm': 'Software Development Manager',
    'bdm': 'Business Development Manager',
    'qam': 'Quality Assurance Manager',
    'finance': 'Finance',
    'finance_manager': 'Finance Manager'
  };
  const formattedRole = roleMap[leaveData.approver_role] || leaveData.approver_role.replace('_', ' ');
  leaveData.approver_title = `${leaveData.approver_name} (${formattedRole})`;
}
```

2. **Deploy the function:**
```bash
supabase functions deploy send-email
```

## Step 6: Update Frontend Code

**Update your frontend `emailQueueService.ts`:**

1. **Remove the old processQueuedEmail method**
2. **Update processQueue to call edge function**
3. **Remove emailService import**

Key changes:
```typescript
// Remove import
// import { emailService } from './emailService';  // REMOVE THIS

// Update processQueue method to call edge function
async processQueue(): Promise<void> {
  if (this.isProcessing) return;
  this.isProcessing = true;

  try {
    console.log('🔄 Calling edge function to process email queue...');
    
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    const response = await fetch(`${supabaseUrl}/functions/v1/send-email/process-queue`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error(`❌ Edge function returned ${response.status}:`, data);
      return;
    }

    if (data?.success) {
      console.log(`✅ Edge function processed ${data.processed || 0} emails`);
    } else {
      console.error('⚠️ Edge function failed:', data);
    }

  } catch (error) {
    console.error('❌ Failed to call edge function for queue processing:', error);
  } finally {
    this.isProcessing = false;
  }
}
```

## Step 7: Verification

**Run this verification query in Supabase SQL Editor:**

```sql
-- Verify the system is working correctly
SELECT 'System Status Check' as check_type;

-- 1. Check email functions
SELECT 
  'Email functions:' as info,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname LIKE '%send_leave_email%'
ORDER BY p.proname;

-- 2. Check triggers
SELECT 
  'Active triggers:' as info,
  t.tgname as trigger_name,
  p.proname as function_called
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'leave_applications'
AND NOT t.tgisinternal;

-- 3. Check email queue structure
SELECT 
  'Email queue columns:' as info,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'email_queue'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Check recent emails
SELECT 
  'Recent emails:' as info,
  email_type,
  status,
  created_at
FROM email_queue
ORDER BY created_at DESC
LIMIT 5;
```

## Expected Results After Migration

✅ **Email queue system** should be active with correct structure  
✅ **Only new email functions** should exist (`send_leave_email_notification_generic`)  
✅ **Correct triggers** should be active (`notify_leave_request_status_update_with_generic_email`)  
✅ **No function overloading** errors  
✅ **Email types** should match between database and frontend  
✅ **Edge function** should process emails correctly  
✅ **Document types** should show 'Appointment Letter' instead of 'Signed Offer Letter'  
✅ **Service layer** should reference 'Signed Appointment Letter' instead of 'Signed Copy Received'  

## Testing

1. **Submit a leave application** - should create `leave_submitted` email in queue
2. **Approve/Reject a leave** - should create `leave_approved`/`leave_rejected` emails
3. **Check queue processing** - emails should be sent successfully
4. **Verify email content** - should include proper approver information

## Troubleshooting

If issues persist:
1. Check Supabase function logs: `supabase functions logs send-email`
2. Verify environment variables are set correctly
3. Clear browser cache and restart dev server
4. Check database permissions and RLS policies

## Complete Migration Order Summary

For a fresh environment, run migrations in this exact order:

### Core System Migrations (Run First)
1. `20250925_01_create_employee_documents_tables.sql` - Creates document system
2. `20250925_02_create_employee_documents_bucket.sql` - Creates storage bucket
3. `20250925_03_add_document_notification_types.sql` - Adds notification types

### Email System Fixes (Run Second)
4. `20251126_01_generic_email_queue_system.sql` - New email system
5. `20251126_04_force_cleanup_email_system.sql` - Cleanup old functions
6. Manual SQL fixes (Steps 3-4 in this guide) - Function overloading fixes

### Frontend Updates (Run Last)
7. Deploy updated Edge function
8. Update frontend emailQueueService.ts
9. Update frontend service references

---

**CRITICAL**: 
- Run these migrations in the exact order specified
- Each step depends on the previous ones being completed successfully  
- Test each step before proceeding to the next
- Backup your database before starting
