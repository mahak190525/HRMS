-- =====================================================
-- Cleanup Old Email Queue Functions
-- =====================================================
-- This migration removes old functions that reference the deprecated
-- leave_application_id column in email_queue table
-- =====================================================

-- Drop ALL old process_email_queue() function variants
-- This ensures we remove any function that doesn't match the new signature
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

-- Drop ALL old send_leave_email_notification function variants
DO $$
DECLARE
  func_record RECORD;
BEGIN
  -- Find and drop all send_leave_email_notification functions
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

-- Also drop any old trigger functions that might call the old function
DROP FUNCTION IF EXISTS notify_leave_request_status_update() CASCADE;
DROP FUNCTION IF EXISTS notify_leave_request_status_update_with_email() CASCADE;

-- Ensure the correct trigger function is in place
-- This should have been created by the main migration, but let's make sure
DO $$
BEGIN
  -- Check if the new trigger function exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'notify_leave_request_status_update_with_generic_email'
  ) THEN
    RAISE WARNING 'New trigger function notify_leave_request_status_update_with_generic_email not found. Please run migration 20251126_01_generic_email_queue_system.sql first.';
  END IF;

  -- Check if the trigger exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_schema = 'public'
    AND trigger_name = 'leave_request_status_update_trigger'
    AND event_object_table = 'leave_applications'
  ) THEN
    RAISE WARNING 'Trigger leave_request_status_update_trigger not found on leave_applications table. Please run migration 20251126_01_generic_email_queue_system.sql first.';
  END IF;
END $$;

-- Verify the new functions exist (they should be created by previous migrations)
-- If they don't exist, this will show an error which is fine - it means we need to run the previous migrations first

-- Check if the new generic functions exist
DO $$
BEGIN
  -- Check if new process_email_queue exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'process_email_queue'
    AND pg_get_function_arguments(p.oid) LIKE '%p_limit%'
  ) THEN
    RAISE WARNING 'New process_email_queue function not found. Please run migration 20251126_01_generic_email_queue_system.sql first.';
  END IF;

  -- Check if new send_leave_email_notification_generic exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'send_leave_email_notification_generic'
  ) THEN
    RAISE WARNING 'New send_leave_email_notification_generic function not found. Please run migration 20251126_01_generic_email_queue_system.sql first.';
  END IF;
END $$;

-- Drop any views that might reference the old column
DROP VIEW IF EXISTS email_queue_summary CASCADE;
DROP VIEW IF EXISTS failed_emails CASCADE;

-- Verify email_queue table structure
DO $$
BEGIN
  -- Check if leave_application_id column still exists (it shouldn't)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'email_queue'
    AND column_name = 'leave_application_id'
  ) THEN
    -- If it exists, we need to drop it (but only if the new columns exist)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'email_queue'
      AND column_name = 'module_type'
    ) THEN
      -- New structure exists, safe to drop old column
      ALTER TABLE email_queue DROP COLUMN IF EXISTS leave_application_id CASCADE;
      RAISE NOTICE 'Dropped old leave_application_id column from email_queue table';
    ELSE
      RAISE WARNING 'Column leave_application_id still exists but new columns not found. Please run migration 20251126_01_generic_email_queue_system.sql first.';
    END IF;
  END IF;

  -- Check if new columns exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'email_queue'
    AND column_name = 'module_type'
  ) THEN
    RAISE WARNING 'Column module_type not found in email_queue table. Please run migration 20251126_01_generic_email_queue_system.sql first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'email_queue'
    AND column_name = 'reference_id'
  ) THEN
    RAISE WARNING 'Column reference_id not found in email_queue table. Please run migration 20251126_01_generic_email_queue_system.sql first.';
  END IF;
END $$;

SELECT 'Old email queue functions cleanup completed! ✅' as status,
       'Old functions referencing leave_application_id have been removed' as note,
       'Make sure migration 20251126_01_generic_email_queue_system.sql has been run' as reminder;
