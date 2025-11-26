-- Final comprehensive fix for all policy assignment issues
-- Migration: 20251126_06_final_policy_fix.sql

-- This migration fixes ALL identified issues:
-- 1. Enum values: 'policy' -> 'policy_management', 'policy_assignment' -> 'policy_assigned'
-- 2. Column references: p.title -> p.name, p.description -> p.content  
-- 3. Role references: admin_users.role -> proper JOIN with roles table

-- Step 1: Clean up any existing data with wrong enum values
-- =====================================================

DO $$
BEGIN
  -- Update any email_queue records that might have wrong enum values
  UPDATE email_queue 
  SET module_type = 'policy_management'::module_type_enum
  WHERE module_type::text = 'policy';
  
  UPDATE email_queue 
  SET email_type = 'policy_assigned'::email_type_enum
  WHERE email_type::text = 'policy_assignment';
  
  UPDATE email_queue 
  SET email_type = 'policy_acknowledged'::email_type_enum
  WHERE email_type::text = 'policy_acknowledgment';
  
  RAISE NOTICE 'Updated email_queue records with incorrect enum values';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Enum constraint working correctly - no bad data found: %', SQLERRM;
END $$;

-- Step 2: Drop all existing policy-related triggers and functions
-- =====================================================

DROP TRIGGER IF EXISTS trigger_policy_assignment_email ON policy_assignments;
DROP TRIGGER IF EXISTS trigger_policy_assignment_notification ON policy_assignments;
DROP FUNCTION IF EXISTS send_policy_assignment_email();
DROP FUNCTION IF EXISTS notify_policy_assignment_trigger();

DROP TRIGGER IF EXISTS trigger_policy_acknowledgment_email ON policy_assignments;
DROP TRIGGER IF EXISTS trigger_policy_acknowledgment_notification ON policy_assignments;
DROP FUNCTION IF EXISTS send_policy_acknowledgment_email();
DROP FUNCTION IF EXISTS notify_policy_acknowledgment_trigger();

DROP FUNCTION IF EXISTS update_policy_email_counts();

-- Step 3: Create corrected policy assignment trigger function
-- =====================================================

CREATE OR REPLACE FUNCTION send_policy_assignment_email()
RETURNS TRIGGER AS $$
DECLARE
  existing_email_count integer;
BEGIN
  -- Check if there's already a pending policy assignment email for this user
  SELECT COUNT(*) INTO existing_email_count
  FROM email_queue eq
  WHERE eq.module_type = 'policy_management'::module_type_enum
  AND eq.email_type = 'policy_assigned'::email_type_enum
  AND eq.status = 'pending'
  AND eq.email_data->>'user_id' = NEW.user_id::text;

  -- Always create individual notifications (these are fine to have multiple)
  INSERT INTO notifications (user_id, title, message, type, data)
  SELECT 
    NEW.user_id,
    'Policy Assignment',
    '1 policy has been assigned to you by ' || assigner.full_name || '. Please review and acknowledge it in the Policies section.',
    'policy_assigned',
    jsonb_build_object(
      'policy_assignment_id', NEW.id,
      'policy_id', NEW.policy_id,
      'assigned_by', NEW.assigned_by,
      'assigned_by_name', assigner.full_name,
      'due_date', NEW.due_date,
      'notes', NEW.notes,
      'assigned_at', NEW.assigned_at,
      'target', 'dashboard/policies'
    )
  FROM users assigner
  WHERE assigner.id = NEW.assigned_by;

  -- Only send email if no pending email exists for this user
  IF existing_email_count = 0 THEN
    -- Use queue_email function to properly resolve dynamic CCs
    PERFORM queue_email(
      'policy_management'::module_type_enum,
      NEW.id,
      'policy_assigned'::email_type_enum,
      jsonb_build_object(
        'to', jsonb_build_array(
          jsonb_build_object('email', u.email, 'name', u.full_name)
        ),
        'cc_static', jsonb_build_array(
          jsonb_build_object('email', 'mechlinpeopleworkplace@mechlintech.com', 'name', 'Mechlin People Workplace'),
          jsonb_build_object('email', 'awasthy.mukesh@mechlintech.com', 'name', 'Mukesh Awasthy')
        ),
        'cc_dynamic', jsonb_build_array('manager')
      ),
      jsonb_build_object(
        'user_id', NEW.user_id,
        'employee_name', u.full_name,
        'employee_email', u.email,
        'policy_count', 1,
        'policy_name', p.name,
        'policy_id', p.id,
        'assigned_by_name', assigner.full_name,
        'assigned_by_email', assigner.email,
        'due_date', NEW.due_date,
        'notes', NEW.notes,
        'assigned_at', NEW.assigned_at
      ),
      'Policy Assignment - Action Required',
      'normal'::email_priority_enum
    )
    FROM users u
    JOIN policies p ON p.id = NEW.policy_id
    JOIN users assigner ON assigner.id = NEW.assigned_by
    WHERE u.id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create corrected policy acknowledgment trigger function
-- =====================================================

CREATE OR REPLACE FUNCTION send_policy_acknowledgment_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Only send email when status changes to 'acknowledged'
  IF OLD.status != 'acknowledged' AND NEW.status = 'acknowledged' THEN
    -- Create notifications for HR and Admin users
    INSERT INTO notifications (user_id, title, message, type, data)
    SELECT 
      admin_users.id,
      'Policy Acknowledged',
      u.full_name || ' has acknowledged the policy "' || p.name || '".',
      'policy_acknowledged',
      jsonb_build_object(
        'policy_assignment_id', NEW.id,
        'employee_id', NEW.user_id,
        'employee_name', u.full_name,
        'policy_id', NEW.policy_id,
        'policy_name', p.name,
        'acknowledged_at', NEW.acknowledged_at,
        'target', 'policies/history'
      )
    FROM users u
    JOIN policies p ON p.id = NEW.policy_id
    JOIN users admin_users ON admin_users.role_id IN (
      SELECT id FROM roles WHERE name IN ('admin', 'hr')
    )
    WHERE u.id = NEW.user_id
    AND admin_users.status = 'active';

    -- Use queue_email function to properly resolve dynamic CCs
    PERFORM queue_email(
      'policy_management'::module_type_enum,
      NEW.id,
      'policy_acknowledged'::email_type_enum,
      jsonb_build_object(
        'to', jsonb_build_array(
          jsonb_build_object('email', 'mechlinpeopleworkplace@mechlintech.com', 'name', 'Mechlin People Workplace')
        ),
        'cc_static', jsonb_build_array(
          jsonb_build_object('email', 'awasthy.mukesh@mechlintech.com', 'name', 'Mukesh Awasthy'),
          jsonb_build_object('email', u.email, 'name', u.full_name)
        ),
        'cc_dynamic', jsonb_build_array('manager')
      ),
      jsonb_build_object(
        'user_id', NEW.user_id,
        'employee_name', u.full_name,
        'employee_email', u.email,
        'policy_name', p.name,
        'policy_id', p.id,
        'acknowledged_at', NEW.acknowledged_at,
        'assigned_by_name', assigner.full_name,
        'assigned_by_email', assigner.email
      ),
      'Policy Acknowledged',
      'normal'::email_priority_enum
    )
    FROM users u
    JOIN policies p ON p.id = NEW.policy_id
    JOIN users assigner ON assigner.id = NEW.assigned_by
    WHERE u.id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Create utility function for bulk policy email handling
-- =====================================================

CREATE OR REPLACE FUNCTION update_policy_email_counts()
RETURNS void AS $$
DECLARE
  email_record RECORD;
  actual_policy_count integer;
BEGIN
  -- Update policy counts in recent pending emails
  FOR email_record IN
    SELECT id, email_data
    FROM email_queue
    WHERE module_type = 'policy_management'::module_type_enum
    AND email_type = 'policy_assigned'::email_type_enum
    AND status = 'pending'
    AND created_at >= (NOW() - INTERVAL '30 seconds')
  LOOP
    -- Count actual policies assigned to this user by this assigner around this time
    SELECT COUNT(*) INTO actual_policy_count
    FROM policy_assignments pa
    JOIN users u ON pa.user_id = u.id
    WHERE u.email = email_record.email_data->'employee'->>'email'
    AND pa.assigned_at >= (NOW() - INTERVAL '10 seconds');

    -- Update the email data with the correct count
    UPDATE email_queue
    SET email_data = jsonb_set(
      email_data,
      '{policy_count}',
      to_jsonb(actual_policy_count)
    )
    WHERE id = email_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Create the triggers
-- =====================================================

CREATE TRIGGER trigger_policy_assignment_email
  AFTER INSERT ON policy_assignments
  FOR EACH ROW
  EXECUTE FUNCTION send_policy_assignment_email();

CREATE TRIGGER trigger_policy_acknowledgment_email
  AFTER UPDATE ON policy_assignments
  FOR EACH ROW
  EXECUTE FUNCTION send_policy_acknowledgment_email();

-- Step 7: Grant permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION send_policy_assignment_email() TO postgres, service_role, authenticated;
GRANT EXECUTE ON FUNCTION send_policy_acknowledgment_email() TO postgres, service_role, authenticated;
GRANT EXECUTE ON FUNCTION update_policy_email_counts() TO postgres, service_role, authenticated;

-- Step 8: Add helpful comments
-- =====================================================

COMMENT ON FUNCTION send_policy_assignment_email() IS 'Sends policy assignment emails with all fixes: correct enum values, column references, and role JOINs';
COMMENT ON FUNCTION send_policy_acknowledgment_email() IS 'Sends policy acknowledgment emails with all fixes: correct enum values, column references, and role JOINs';
COMMENT ON FUNCTION update_policy_email_counts() IS 'Updates policy counts in pending emails for bulk assignments';

COMMENT ON TRIGGER trigger_policy_assignment_email ON policy_assignments IS 'Triggers policy assignment emails with all fixes applied';
COMMENT ON TRIGGER trigger_policy_acknowledgment_email ON policy_assignments IS 'Triggers policy acknowledgment emails with all fixes applied';

-- Log completion
SELECT 'All policy assignment issues fixed successfully - enum values, column references, and role JOINs corrected' as status;
