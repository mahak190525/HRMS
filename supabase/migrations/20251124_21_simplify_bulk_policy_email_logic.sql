-- Migration: Simplify bulk policy assignment email logic
-- Instead of complex bulk detection, use a simpler approach with deduplication

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS trigger_policy_assignment_notification ON policy_assignments;
DROP FUNCTION IF EXISTS notify_policy_assignment_trigger();

-- Create a simplified function that always queues emails but with deduplication
CREATE OR REPLACE FUNCTION notify_policy_assignment_trigger()
RETURNS TRIGGER AS $$
DECLARE
  assigned_by_name text;
  assigned_by_role text;
  assigned_by_title text;
  existing_email_count integer;
BEGIN
  -- Only process new assignments (INSERT)
  IF TG_OP = 'INSERT' THEN
    -- Get assigned by user details
    SELECT u.full_name, r.name INTO assigned_by_name, assigned_by_role
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    WHERE u.id = NEW.assigned_by;

    -- Format assigned by title with role
    IF assigned_by_name IS NOT NULL AND assigned_by_role IS NOT NULL THEN
      assigned_by_title := assigned_by_name || ' (' || 
        CASE 
          WHEN assigned_by_role = 'super_admin' THEN 'Super Admin'
          WHEN assigned_by_role = 'admin' THEN 'Admin'
          WHEN assigned_by_role = 'hr' THEN 'HR'
          WHEN assigned_by_role = 'hrm' THEN 'HR Manager'
          WHEN assigned_by_role = 'sdm' THEN 'Software Development Manager'
          WHEN assigned_by_role = 'bdm' THEN 'Business Development Manager'
          WHEN assigned_by_role = 'qam' THEN 'Quality Assurance Manager'
          WHEN assigned_by_role = 'finance' THEN 'Finance'
          WHEN assigned_by_role = 'finance_manager' THEN 'Finance Manager'
          ELSE INITCAP(REPLACE(assigned_by_role, '_', ' '))
        END || ')';
    ELSE
      assigned_by_title := COALESCE(assigned_by_name, 'Administrator');
    END IF;

    -- Always create individual notifications (these are fine to have multiple)
    INSERT INTO notifications (user_id, title, message, type, data)
    VALUES (
      NEW.user_id,
      'Policy Assignment',
      '1 policy has been assigned to you by ' || assigned_by_title || '. Please review and acknowledge it in the Policies section.',
      'policy_assigned',
      jsonb_build_object(
        'policy_assignment_id', NEW.id,
        'policy_id', NEW.policy_id,
        'assigned_by', NEW.assigned_by,
        'assigned_by_name', assigned_by_name,
        'assigned_by_title', assigned_by_title,
        'due_date', NEW.due_date,
        'notes', NEW.notes,
        'assigned_at', NEW.assigned_at,
        'target', 'dashboard/policies'
      )
    );

    -- Check if there's already a pending email for this user from this assigner in the last 10 seconds
    -- This prevents duplicate emails during bulk operations
    SELECT COUNT(*) INTO existing_email_count
    FROM email_queue eq
    WHERE eq.module_type = 'policy_management'
    AND eq.email_type = 'policy_assigned'
    AND eq.status = 'pending'
    AND eq.created_at >= (NOW() - INTERVAL '10 seconds')
    AND eq.leave_data->>'employeeEmail' = (SELECT email FROM users WHERE id = NEW.user_id)
    AND eq.leave_data->>'assignedByName' = assigned_by_title;

    -- Only queue email if there isn't already a pending one for this user/assigner combination
    IF existing_email_count = 0 THEN
      -- Queue email notification for the assigned user
      INSERT INTO email_queue (
        leave_application_id,
        reference_id,
        module_type,
        email_type,
        recipients,
        leave_data,
        status
      )
      SELECT 
        NULL, -- No leave application for policy emails
        NEW.id, -- Policy assignment ID as reference
        'policy_management', -- Module type
        'policy_assigned',
        jsonb_build_object(
          'employee', jsonb_build_object(
            'email', u.email,
            'name', u.full_name
          ),
          'adminsAndHR', COALESCE(
            (SELECT jsonb_agg(
              jsonb_build_object(
                'email', admin_u.email,
                'name', admin_u.full_name
              )
            )
            FROM users admin_u
            INNER JOIN roles admin_r ON admin_u.role_id = admin_r.id
            WHERE admin_r.name IN ('admin', 'super_admin', 'hr')
            AND admin_u.status = 'active'
            AND admin_u.email IS NOT NULL
            AND admin_u.email != ''),
            '[]'::jsonb
          )
        ),
        jsonb_build_object(
          'policyCount', 1, -- Will be updated by a separate function
          'assignedByName', assigned_by_title,
          'assignedAt', NEW.assigned_at,
          'employeeName', u.full_name,
          'employeeEmail', u.email,
          'policy_assignment_id', NEW.id,
          'policy_id', NEW.policy_id,
          'due_date', NEW.due_date,
          'notes', NEW.notes
        ),
        'pending'
      FROM users u
      WHERE u.id = NEW.user_id
      AND u.email IS NOT NULL
      AND u.email != '';
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to update policy counts in pending emails (called after bulk inserts)
CREATE OR REPLACE FUNCTION update_policy_email_counts()
RETURNS void AS $$
DECLARE
  email_record record;
  actual_policy_count integer;
BEGIN
  -- Update policy counts for all pending policy assignment emails
  FOR email_record IN
    SELECT id, leave_data
    FROM email_queue
    WHERE module_type = 'policy_management'
    AND email_type = 'policy_assigned'
    AND status = 'pending'
    AND created_at >= (NOW() - INTERVAL '30 seconds') -- Only recent emails
  LOOP
    -- Count actual policies assigned to this user by this assigner around this time
    SELECT COUNT(*) INTO actual_policy_count
    FROM policy_assignments pa
    JOIN users u ON pa.user_id = u.id
    WHERE u.email = email_record.leave_data->>'employeeEmail'
    AND pa.assigned_at >= ((email_record.leave_data->>'assignedAt')::timestamptz - INTERVAL '10 seconds')
    AND pa.assigned_at <= ((email_record.leave_data->>'assignedAt')::timestamptz + INTERVAL '10 seconds');

    -- Update the policy count in the email data
    UPDATE email_queue
    SET leave_data = jsonb_set(leave_data, '{policyCount}', actual_policy_count::text::jsonb)
    WHERE id = email_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER trigger_policy_assignment_notification
  AFTER INSERT ON policy_assignments
  FOR EACH ROW
  EXECUTE FUNCTION notify_policy_assignment_trigger();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION notify_policy_assignment_trigger() TO authenticated;
GRANT EXECUTE ON FUNCTION update_policy_email_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION update_policy_email_counts() TO postgres;
GRANT EXECUTE ON FUNCTION update_policy_email_counts() TO service_role;

-- Add helpful comments
COMMENT ON FUNCTION notify_policy_assignment_trigger() IS 'Automatically sends notifications and queues emails for policy assignments with deduplication';
COMMENT ON FUNCTION update_policy_email_counts() IS 'Updates policy counts in pending emails to reflect bulk assignments';
COMMENT ON TRIGGER trigger_policy_assignment_notification ON policy_assignments IS 'Triggers automatic notifications and emails for policy assignments';
