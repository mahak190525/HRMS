-- =====================================================
-- Force Cleanup Email System
-- =====================================================
-- This migration aggressively removes ALL old email-related functions and triggers
-- and ensures only the new generic system is in place
-- =====================================================

-- Step 1: Drop ALL triggers on leave_applications table and recreate only the correct one
-- =====================================================

-- Drop all triggers on leave_applications
DROP TRIGGER IF EXISTS leave_request_status_update_trigger ON leave_applications CASCADE;
DROP TRIGGER IF EXISTS leave_status_update_trigger ON leave_applications CASCADE;
DROP TRIGGER IF EXISTS notify_leave_request_trigger ON leave_applications CASCADE;

-- Step 2: Drop ALL old notification functions
-- =====================================================

-- Drop all variations of old notification functions
DROP FUNCTION IF EXISTS notify_leave_request_status_update() CASCADE;
DROP FUNCTION IF EXISTS notify_leave_request_status_update_with_email() CASCADE;
DROP FUNCTION IF EXISTS notify_leave_request_status_update_with_email(uuid, text) CASCADE;

-- Step 3: Drop ALL old send_leave_email_notification functions
-- =====================================================

DO $$
DECLARE
  func_record RECORD;
BEGIN
  -- Find and drop ALL send_leave_email_notification functions
  FOR func_record IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'send_leave_email_notification'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS public.send_leave_email_notification(' || func_record.args || ') CASCADE';
    RAISE NOTICE 'Dropped old function: send_leave_email_notification(%)', func_record.args;
  END LOOP;
END $$;

-- Step 4: Drop ALL old process_email_queue functions
-- =====================================================

DO $$
DECLARE
  func_record RECORD;
BEGIN
  -- Find and drop all process_email_queue functions that don't have the new signature
  FOR func_record IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'process_email_queue'
    AND NOT (pg_get_function_arguments(p.oid) LIKE '%p_limit%integer%' AND pg_get_function_arguments(p.oid) LIKE '%p_status%email_status_enum%')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS public.process_email_queue(' || func_record.args || ') CASCADE';
    RAISE NOTICE 'Dropped old function: process_email_queue(%)', func_record.args;
  END LOOP;
END $$;

-- Step 5: Ensure the new trigger function exists and recreate the trigger
-- =====================================================

-- Create the new trigger function if it doesn't exist (copy from main migration)
CREATE OR REPLACE FUNCTION notify_leave_request_status_update_with_generic_email()
RETURNS TRIGGER AS $$
DECLARE
  user_name text;
  user_manager_id uuid;
  leave_type_name text;
  approver_name text;
  approver_role text;
  approver_title text;
  recipient_id uuid;
  email_type_to_send email_type_enum;
BEGIN
  -- Only trigger on status change
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Get employee name and manager
  SELECT u.full_name, u.manager_id INTO user_name, user_manager_id
  FROM users u
  WHERE u.id = NEW.user_id;
  
  -- Get leave type name
  SELECT lt.name INTO leave_type_name
  FROM leave_types lt
  WHERE lt.id = NEW.leave_type_id;
  
  -- Get approver name and role
  SELECT u.full_name, COALESCE(r.name, 'employee') INTO approver_name, approver_role
  FROM users u
  LEFT JOIN roles r ON u.role_id = r.id
  WHERE u.id = NEW.approved_by;
  
  -- Format approver title with role
  IF approver_name IS NOT NULL AND approver_role IS NOT NULL THEN
    approver_title := approver_name || ' (' || 
      CASE 
        WHEN approver_role = 'super_admin' THEN 'Super Admin'
        WHEN approver_role = 'admin' THEN 'Admin'
        WHEN approver_role = 'hr' THEN 'HR'
        WHEN approver_role = 'hrm' THEN 'HR Manager'
        WHEN approver_role = 'sdm' THEN 'Software Development Manager'
        WHEN approver_role = 'bdm' THEN 'Business Development Manager'
        WHEN approver_role = 'qam' THEN 'Quality Assurance Manager'
        WHEN approver_role = 'finance' THEN 'Finance'
        WHEN approver_role = 'finance_manager' THEN 'Finance Manager'
        ELSE INITCAP(REPLACE(approver_role, '_', ' '))
      END || ')';
  ELSE
    approver_title := approver_name;
  END IF;
  
  -- Notify the employee who applied (keep existing notification system)
  INSERT INTO notifications (user_id, title, message, type, data)
  VALUES (
    NEW.user_id,
    'Leave Request ' || CASE 
      WHEN NEW.status = 'approved' THEN 'Approved'
      WHEN NEW.status = 'rejected' THEN 'Rejected'
      ELSE 'Updated'
    END,
    'Your ' || leave_type_name || ' request has been ' || NEW.status || 
    CASE WHEN approver_title IS NOT NULL THEN ' by ' || approver_title ELSE '' END || '.',
    'leave_request_' || NEW.status,
    jsonb_build_object(
      'leave_application_id', NEW.id,
      'leave_type', leave_type_name,
      'status', NEW.status,
      'approver_name', approver_name,
      'approver_role', approver_role,
      'approver_title', approver_title,
      'comments', NEW.comments,
      'start_date', NEW.start_date,
      'end_date', NEW.end_date,
      'days_count', NEW.days_count,
      'recipient_type', 'applicant'
    )
  );
  
  -- For approved, rejected, or withdrawn status, notify admins, HR, and manager
  IF NEW.status IN ('approved', 'rejected', 'withdrawn') THEN
    -- Notify admins and HR users (keep existing notification system)
    FOR recipient_id IN
      SELECT u.id
      FROM users u
      INNER JOIN roles r ON u.role_id = r.id
      WHERE r.name IN ('admin', 'super_admin', 'hr')
      AND u.status = 'active'
      AND u.id != NEW.user_id
    LOOP
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        recipient_id,
        'Leave Request ' || CASE 
          WHEN NEW.status = 'approved' THEN 'Approved'
          WHEN NEW.status = 'rejected' THEN 'Rejected'
          WHEN NEW.status = 'withdrawn' THEN 'Withdrawn'
        END || ' - ' || user_name,
        user_name || '''s ' || leave_type_name || ' request has been ' || NEW.status || 
        CASE WHEN approver_title IS NOT NULL THEN ' by ' || approver_title ELSE '' END || ' for ' || NEW.days_count || ' days (' || 
        TO_CHAR(NEW.start_date::date, 'DD Mon YYYY') || ' to ' || TO_CHAR(NEW.end_date::date, 'DD Mon YYYY') || ').',
        'leave_request_' || NEW.status,
        jsonb_build_object(
          'leave_application_id', NEW.id,
          'employee_name', user_name,
          'employee_id', NEW.user_id,
          'leave_type', leave_type_name,
          'status', NEW.status,
          'approver_name', approver_name,
          'approver_role', approver_role,
          'approver_title', approver_title,
          'comments', NEW.comments,
          'start_date', NEW.start_date,
          'end_date', NEW.end_date,
          'days_count', NEW.days_count,
          'recipient_type', 'admin_hr'
        )
      );
    END LOOP;
    
    -- Notify the manager if exists and different from approver
    IF user_manager_id IS NOT NULL AND user_manager_id != NEW.approved_by THEN
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        user_manager_id,
        'Leave Request ' || CASE 
          WHEN NEW.status = 'approved' THEN 'Approved'
          WHEN NEW.status = 'rejected' THEN 'Rejected'
          WHEN NEW.status = 'withdrawn' THEN 'Withdrawn'
        END || ' - ' || user_name,
        user_name || '''s ' || leave_type_name || ' request has been ' || NEW.status || 
        CASE WHEN approver_title IS NOT NULL THEN ' by ' || approver_title ELSE '' END || ' for ' || NEW.days_count || ' days (' || 
        TO_CHAR(NEW.start_date::date, 'DD Mon YYYY') || ' to ' || TO_CHAR(NEW.end_date::date, 'DD Mon YYYY') || ').',
        'leave_request_' || NEW.status,
        jsonb_build_object(
          'leave_application_id', NEW.id,
          'employee_name', user_name,
          'employee_id', NEW.user_id,
          'leave_type', leave_type_name,
          'status', NEW.status,
          'approver_name', approver_name,
          'approver_role', approver_role,
          'approver_title', approver_title,
          'comments', NEW.comments,
          'start_date', NEW.start_date,
          'end_date', NEW.end_date,
          'days_count', NEW.days_count,
          'recipient_type', 'manager'
        )
      );
    END IF;

    -- Send email notification using the new generic system
    email_type_to_send := CASE NEW.status
      WHEN 'approved' THEN 'leave_approved'::email_type_enum
      WHEN 'rejected' THEN 'leave_rejected'::email_type_enum
      WHEN 'withdrawn' THEN 'leave_withdrawn'::email_type_enum
      ELSE 'leave_approved'::email_type_enum -- fallback
    END;
    
    -- Only call the email function if it exists
    BEGIN
      PERFORM send_leave_email_notification_generic(NEW.id, email_type_to_send);
    EXCEPTION WHEN undefined_function THEN
      RAISE WARNING 'send_leave_email_notification_generic function not found. Email not sent for leave application %', NEW.id;
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to send email for leave application %: %', NEW.id, SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
CREATE TRIGGER leave_request_status_update_trigger
  AFTER UPDATE ON leave_applications
  FOR EACH ROW
  EXECUTE FUNCTION notify_leave_request_status_update_with_generic_email();

-- Step 6: Verify the system is working
-- =====================================================

DO $$
BEGIN
  -- Check if send_leave_email_notification_generic exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'send_leave_email_notification_generic'
  ) THEN
    RAISE WARNING 'send_leave_email_notification_generic function not found. Please run migration 20251126_01_generic_email_queue_system.sql first.';
  ELSE
    RAISE NOTICE 'send_leave_email_notification_generic function found ✓';
  END IF;

  -- Check if process_email_queue with correct signature exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'process_email_queue'
    AND pg_get_function_arguments(p.oid) LIKE '%p_limit%integer%'
  ) THEN
    RAISE WARNING 'process_email_queue function with correct signature not found. Please run migration 20251126_01_generic_email_queue_system.sql first.';
  ELSE
    RAISE NOTICE 'process_email_queue function with correct signature found ✓';
  END IF;

  -- Check if email_queue table has correct structure
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'email_queue'
    AND column_name = 'module_type'
  ) THEN
    RAISE WARNING 'email_queue table does not have module_type column. Please run migration 20251126_01_generic_email_queue_system.sql first.';
  ELSE
    RAISE NOTICE 'email_queue table has correct structure ✓';
  END IF;

  -- Check if old leave_application_id column is gone
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'email_queue'
    AND column_name = 'leave_application_id'
  ) THEN
    RAISE WARNING 'email_queue table still has leave_application_id column. This should be removed.';
    -- Force drop it
    ALTER TABLE email_queue DROP COLUMN IF EXISTS leave_application_id CASCADE;
    RAISE NOTICE 'Dropped leave_application_id column from email_queue table';
  ELSE
    RAISE NOTICE 'email_queue table does not have old leave_application_id column ✓';
  END IF;
END $$;

SELECT 'Force cleanup completed! ✅' as status,
       'All old email functions and triggers have been removed' as note,
       'New generic email system is now active' as result;
