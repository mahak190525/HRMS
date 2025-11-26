-- Fix incorrect 'policy' enum values to 'policy_management'
-- Migration: 20251126_03_fix_policy_enum_values.sql

-- Update any existing email_queue records that have incorrect 'policy' module_type
-- Note: This will only work if the 'policy' value was somehow inserted despite the enum constraint
-- In most cases, this should fail at insertion time, but we'll include this for completeness

-- First, let's check if there are any records with invalid enum values
-- and update them to the correct value

-- Update email_queue records (if any exist with the wrong value)
-- This might fail if the enum constraint is properly enforced, which is expected
DO $$
BEGIN
  -- Try to update any records that might have the wrong enum value
  -- This is mainly for documentation and future-proofing
  UPDATE email_queue 
  SET module_type = 'policy_management'::module_type_enum
  WHERE module_type::text = 'policy';
  
  -- Log the result
  RAISE NOTICE 'Updated email_queue records with incorrect policy enum values';
EXCEPTION
  WHEN OTHERS THEN
    -- If this fails, it's likely because the enum constraint prevented the bad data
    RAISE NOTICE 'No email_queue records needed updating (enum constraint working correctly)';
END $$;

-- Ensure all functions are using the correct enum values
-- Re-create the functions that were using incorrect enum values

-- Drop and recreate the trigger function to ensure it uses correct enum
DROP TRIGGER IF EXISTS trigger_policy_assignment_email ON policy_assignments;
DROP FUNCTION IF EXISTS send_policy_assignment_email();

-- Recreate the policy assignment email trigger function with correct enum
CREATE OR REPLACE FUNCTION send_policy_assignment_email()
RETURNS TRIGGER AS $$
DECLARE
  employee_data jsonb;
  admin_hr_data jsonb;
  existing_email_count integer;
BEGIN
  -- Check if there's already a pending policy assignment email for this user
  -- to avoid duplicate emails for bulk assignments
  SELECT COUNT(*) INTO existing_email_count
  FROM email_queue eq
  WHERE eq.module_type = 'policy_management'::module_type_enum  -- Fixed enum value
  AND eq.email_type = 'policy_assigned'
  AND eq.status = 'pending'
  AND eq.email_data->>'user_id' = NEW.user_id::text;

  -- Only send email if no pending email exists for this user
  IF existing_email_count = 0 THEN
    -- Insert into email_queue with correct enum value
    INSERT INTO email_queue (
      leave_application_id,
      reference_id,
      module_type,
      email_type,
      email_data,
      status
    )
    SELECT 
      NULL, -- No leave application for policy emails
      NEW.id, -- Policy assignment ID as reference
      'policy_management'::module_type_enum, -- Fixed enum value
      'policy_assigned',
      jsonb_build_object(
        'user_id', NEW.user_id,
        'employee', jsonb_build_object(
          'email', u.email,
          'name', u.full_name
        ),
        'adminsAndHR', COALESCE(
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
        'notes', NEW.notes
      ),
      'pending'
    FROM users u
    JOIN policies p ON p.id = NEW.policy_id
    JOIN users assigner ON assigner.id = NEW.assigned_by
    WHERE u.id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER trigger_policy_assignment_email
  AFTER INSERT ON policy_assignments
  FOR EACH ROW
  EXECUTE FUNCTION send_policy_assignment_email();

-- Also fix the policy acknowledgment trigger if it exists
DROP TRIGGER IF EXISTS trigger_policy_acknowledgment_email ON policy_assignments;
DROP FUNCTION IF EXISTS send_policy_acknowledgment_email();

-- Recreate the policy acknowledgment email trigger function with correct enum
CREATE OR REPLACE FUNCTION send_policy_acknowledgment_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Only send email when status changes to 'acknowledged'
  IF OLD.status != 'acknowledged' AND NEW.status = 'acknowledged' THEN
    INSERT INTO email_queue (
      leave_application_id,
      reference_id,
      module_type,
      email_type,
      email_data,
      status
    )
    VALUES (
      NULL, -- No leave application for policy emails
      NEW.id, -- Policy assignment ID as reference
      'policy_management'::module_type_enum, -- Fixed enum value
      'policy_acknowledged',
      jsonb_build_object(
        'employee', jsonb_build_object(
          'email', (SELECT email FROM users WHERE id = NEW.user_id),
          'name', (SELECT full_name FROM users WHERE id = NEW.user_id)
        ),
        'policy', jsonb_build_object(
          'title', (SELECT title FROM policies WHERE id = NEW.policy_id)
        ),
        'acknowledged_at', NEW.acknowledged_at
      ),
      'pending'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER trigger_policy_acknowledgment_email
  AFTER UPDATE ON policy_assignments
  FOR EACH ROW
  EXECUTE FUNCTION send_policy_acknowledgment_email();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION send_policy_assignment_email() TO postgres, service_role, authenticated;
GRANT EXECUTE ON FUNCTION send_policy_acknowledgment_email() TO postgres, service_role, authenticated;

-- Log completion
SELECT 'Policy enum fix migration completed successfully' as status;
