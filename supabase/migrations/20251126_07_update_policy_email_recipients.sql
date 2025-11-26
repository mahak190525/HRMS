-- Update policy email recipients to use specific static emails
-- Migration: 20251126_07_update_policy_email_recipients.sql

-- This migration updates the policy email functions to use the specified email recipients:
-- 
-- When Assigned to an employee:
-- - TO → Employee's mail
-- - CC → Static mails {mechlinpeopleworkplace@mechlintech.com, awasthy.mukesh@mechlintech.com} and employee's manager
--
-- When acknowledged by an employee:
-- - TO → mechlinpeopleworkplace@mechlintech.com
-- - CC → Static mails {awasthy.mukesh@mechlintech.com} and employee's manager and employee's mail

-- Step 1: Drop existing functions
-- =====================================================
-- Step 1: Drop triggers BEFORE functions (required to avoid dependency errors)
DROP TRIGGER IF EXISTS trigger_policy_assignment_email ON policy_assignments;
DROP TRIGGER IF EXISTS trigger_policy_acknowledgment_email ON policy_assignments;

DROP FUNCTION IF EXISTS send_policy_assignment_email();
DROP FUNCTION IF EXISTS send_policy_acknowledgment_email();

-- Step 2: Create updated policy assignment function with correct recipients
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

-- Step 3: Create updated policy acknowledgment function with correct recipients
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

-- Step 4: Recreate triggers
-- =====================================================

DROP TRIGGER IF EXISTS trigger_policy_assignment_email ON policy_assignments;
DROP TRIGGER IF EXISTS trigger_policy_acknowledgment_email ON policy_assignments;

CREATE TRIGGER trigger_policy_assignment_email
  AFTER INSERT ON policy_assignments
  FOR EACH ROW
  EXECUTE FUNCTION send_policy_assignment_email();

CREATE TRIGGER trigger_policy_acknowledgment_email
  AFTER UPDATE ON policy_assignments
  FOR EACH ROW
  EXECUTE FUNCTION send_policy_acknowledgment_email();

-- Step 5: Grant permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION send_policy_assignment_email() TO postgres, service_role, authenticated;
GRANT EXECUTE ON FUNCTION send_policy_acknowledgment_email() TO postgres, service_role, authenticated;

-- Step 6: Add helpful comments
-- =====================================================

COMMENT ON FUNCTION send_policy_assignment_email() IS 'Sends policy assignment emails: TO=employee, CC=static emails + manager';
COMMENT ON FUNCTION send_policy_acknowledgment_email() IS 'Sends policy acknowledgment emails: TO=mechlinpeopleworkplace@mechlintech.com, CC=awasthy.mukesh@mechlintech.com + manager + employee';

COMMENT ON TRIGGER trigger_policy_assignment_email ON policy_assignments IS 'Triggers policy assignment emails with specific recipients';
COMMENT ON TRIGGER trigger_policy_acknowledgment_email ON policy_assignments IS 'Triggers policy acknowledgment emails with specific recipients';

-- Log completion
SELECT 'Policy email recipients updated successfully with static email addresses' as status;
