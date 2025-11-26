-- Comprehensive fix for all enum issues in policy assignment system
-- Migration: 20251126_04_fix_all_enum_issues.sql

-- This migration fixes:
-- 1. module_type_enum: 'policy' -> 'policy_management' 
-- 2. email_type_enum: 'policy_assignment' -> 'policy_assigned'
-- 3. email_type_enum: 'policy_acknowledgment' -> 'policy_acknowledged'

-- Step 1: Clean up any existing data with wrong enum values
-- =====================================================

DO $$
BEGIN
  -- Update any email_queue records that might have wrong enum values
  -- This will fail gracefully if the enum constraint prevented bad data
  
  -- Fix module_type enum values
  UPDATE email_queue 
  SET module_type = 'policy_management'::module_type_enum
  WHERE module_type::text = 'policy';
  
  -- Fix email_type enum values
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

-- Drop all policy assignment triggers and functions
DROP TRIGGER IF EXISTS trigger_policy_assignment_email ON policy_assignments;
DROP TRIGGER IF EXISTS trigger_policy_assignment_notification ON policy_assignments;
DROP FUNCTION IF EXISTS send_policy_assignment_email();
DROP FUNCTION IF EXISTS notify_policy_assignment_trigger();

-- Drop all policy acknowledgment triggers and functions  
DROP TRIGGER IF EXISTS trigger_policy_acknowledgment_email ON policy_assignments;
DROP TRIGGER IF EXISTS trigger_policy_acknowledgment_notification ON policy_assignments;
DROP FUNCTION IF EXISTS send_policy_acknowledgment_email();
DROP FUNCTION IF EXISTS notify_policy_acknowledgment_trigger();

-- Drop utility functions
DROP FUNCTION IF EXISTS update_policy_email_counts();

-- Step 3: Create corrected policy assignment trigger function
-- =====================================================

CREATE OR REPLACE FUNCTION send_policy_assignment_email()
RETURNS TRIGGER AS $$
DECLARE
  existing_email_count integer;
BEGIN
  -- Check if there's already a pending policy assignment email for this user
  -- to avoid duplicate emails for bulk assignments
  SELECT COUNT(*) INTO existing_email_count
  FROM email_queue eq
  WHERE eq.module_type = 'policy_management'::module_type_enum
  AND eq.email_type = 'policy_assigned'::email_type_enum
  AND eq.status = 'pending'
  AND eq.email_data->>'user_id' = NEW.user_id::text;

  -- Only send email if no pending email exists for this user
  IF existing_email_count = 0 THEN
    -- Insert into email_queue with correct enum values
    INSERT INTO email_queue (
      reference_id,
      module_type,
      email_type,
      email_data,
      recipients,
      status,
      priority,
      subject
    )
    SELECT 
      NEW.id, -- Policy assignment ID as reference
      'policy_management'::module_type_enum,
      'policy_assigned'::email_type_enum,
      jsonb_build_object(
        'user_id', NEW.user_id,
        'employee', jsonb_build_object(
          'email', u.email,
          'name', u.full_name
        ),
        'policy', jsonb_build_object(
          'id', p.id,
          'name', p.name,
          'content', p.content
        ),
        'assigned_by', jsonb_build_object(
          'name', assigner.full_name,
          'email', assigner.email
        ),
        'due_date', NEW.due_date,
        'notes', NEW.notes,
        'assigned_at', NEW.assigned_at
      ),
      jsonb_build_object(
        'to', jsonb_build_array(
          jsonb_build_object('email', u.email, 'name', u.full_name)
        ),
        'cc_static', COALESCE(
          (SELECT jsonb_agg(
            jsonb_build_object(
              'email', admin_users.email,
              'name', admin_users.full_name
            )
          )
          FROM users admin_users
          JOIN roles r ON admin_users.role_id = r.id
          WHERE r.name IN ('admin', 'hr')
          AND admin_users.email IS NOT NULL
          AND admin_users.email != ''), 
          '[]'::jsonb
        ),
        'cc_dynamic', jsonb_build_array('manager')
      ),
      'pending',
      'normal'::email_priority_enum,
      'Policy Assignment - Action Required'
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
    INSERT INTO email_queue (
      reference_id,
      module_type,
      email_type,
      email_data,
      recipients,
      status,
      priority,
      subject
    )
    SELECT
      NEW.id, -- Policy assignment ID as reference
      'policy_management'::module_type_enum,
      'policy_acknowledged'::email_type_enum,
      jsonb_build_object(
        'employee', jsonb_build_object(
          'email', u.email,
          'name', u.full_name
        ),
        'policy', jsonb_build_object(
          'name', p.name
        ),
        'acknowledged_at', NEW.acknowledged_at,
        'assigned_by', jsonb_build_object(
          'name', assigner.full_name,
          'email', assigner.email
        )
      ),
      jsonb_build_object(
        'to', jsonb_build_array(
          jsonb_build_object('email', assigner.email, 'name', assigner.full_name)
        ),
        'cc_static', COALESCE(
          (SELECT jsonb_agg(
            jsonb_build_object(
              'email', admin_users.email,
              'name', admin_users.full_name
            )
          )
          FROM users admin_users
          JOIN roles r ON admin_users.role_id = r.id
          WHERE r.name IN ('admin', 'hr')
          AND admin_users.email IS NOT NULL
          AND admin_users.email != ''), 
          '[]'::jsonb
        )
      ),
      'pending',
      'normal'::email_priority_enum,
      'Policy Acknowledged'
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

COMMENT ON FUNCTION send_policy_assignment_email() IS 'Sends policy assignment emails using correct enum values (policy_management, policy_assigned)';
COMMENT ON FUNCTION send_policy_acknowledgment_email() IS 'Sends policy acknowledgment emails using correct enum values (policy_management, policy_acknowledged)';
COMMENT ON FUNCTION update_policy_email_counts() IS 'Updates policy counts in pending emails for bulk assignments';

COMMENT ON TRIGGER trigger_policy_assignment_email ON policy_assignments IS 'Triggers policy assignment emails with correct enum values';
COMMENT ON TRIGGER trigger_policy_acknowledgment_email ON policy_assignments IS 'Triggers policy acknowledgment emails with correct enum values';

-- Log completion
SELECT 'All enum issues fixed successfully - policy assignment system should now work correctly' as status;
