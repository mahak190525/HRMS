-- Migration: Fix policy acknowledgment email addressing
-- Send one email TO the assigner with other HR/Admin users in CC

-- Drop existing acknowledgment trigger and function
DROP TRIGGER IF EXISTS trigger_policy_acknowledgment_notification ON policy_assignments;
DROP FUNCTION IF EXISTS notify_policy_acknowledgment_trigger();

-- Create updated function for policy acknowledgment notifications and emails
CREATE OR REPLACE FUNCTION notify_policy_acknowledgment_trigger()
RETURNS TRIGGER AS $$
DECLARE
  employee_name text;
  policy_name text;
  hr_admin_user_id uuid;
  assigned_by_name text;
  assigned_by_email text;
  assigned_by_role text;
  assigned_by_title text;
  cc_recipients jsonb;
BEGIN
  -- Only process when acknowledged_at changes from NULL to NOT NULL
  IF TG_OP = 'UPDATE' AND OLD.acknowledged_at IS NULL AND NEW.acknowledged_at IS NOT NULL THEN
    
    -- Get employee and policy details
    SELECT u.full_name, p.name INTO employee_name, policy_name
    FROM users u, policies p
    WHERE u.id = NEW.user_id AND p.id = NEW.policy_id;

    -- Get the person who assigned the policy (primary recipient)
    SELECT u.full_name, u.email, r.name INTO assigned_by_name, assigned_by_email, assigned_by_role
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

    -- Create notifications for HR and Admin users (keep individual notifications)
    FOR hr_admin_user_id IN
      SELECT u.id
      FROM users u
      INNER JOIN roles r ON u.role_id = r.id
      WHERE r.name IN ('admin', 'super_admin', 'hr')
      AND u.status = 'active'
      AND u.id != NEW.user_id
    LOOP
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        hr_admin_user_id,
        'Policy Acknowledged',
        COALESCE(employee_name, 'An employee') || ' has acknowledged the policy "' || COALESCE(policy_name, 'Unknown Policy') || '".',
        'policy_acknowledged',
        jsonb_build_object(
          'policy_assignment_id', NEW.id,
          'employee_id', NEW.user_id,
          'employee_name', employee_name,
          'policy_id', NEW.policy_id,
          'policy_name', policy_name,
          'acknowledged_at', NEW.acknowledged_at,
          'target', 'policies/history'
        )
      );
    END LOOP;

    -- Get CC recipients (other HR/Admin users, excluding the assigner)
    SELECT jsonb_agg(
      jsonb_build_object(
        'email', u.email,
        'name', u.full_name
      )
    ) INTO cc_recipients
    FROM users u
    INNER JOIN roles r ON u.role_id = r.id
    WHERE r.name IN ('admin', 'super_admin', 'hr')
    AND u.status = 'active'
    AND u.id != NEW.user_id -- Exclude the employee who acknowledged
    AND u.id != NEW.assigned_by -- Exclude the assigner (they're the primary recipient)
    AND u.email IS NOT NULL
    AND u.email != '';

    -- Queue ONE email TO the assigner with others in CC (only if assigner has valid email)
    IF assigned_by_email IS NOT NULL AND assigned_by_email != '' THEN
      INSERT INTO email_queue (
        leave_application_id,
        reference_id,
        module_type,
        email_type,
        recipients,
        leave_data,
        status
      )
      VALUES (
        NULL, -- No leave application for policy emails
        NEW.id, -- Policy assignment ID as reference
        'policy_management', -- Module type
        'policy_acknowledgment',
        jsonb_build_object(
          'employee', jsonb_build_object(
            'email', assigned_by_email,
            'name', assigned_by_name
          ),
          'adminsAndHR', COALESCE(cc_recipients, '[]'::jsonb) -- CC recipients
        ),
        jsonb_build_object(
          'policyCount', 1,
          'employeeName', COALESCE(employee_name, 'An employee'),
          'employeeEmail', (SELECT email FROM users WHERE id = NEW.user_id),
          'assignedAt', NEW.acknowledged_at,
          'policy_assignment_id', NEW.id,
          'employee_id', NEW.user_id,
          'policy_id', NEW.policy_id,
          'policy_name', COALESCE(policy_name, 'Unknown Policy'),
          'acknowledged_at', NEW.acknowledged_at,
          'assigned_by_name', assigned_by_title,
          'assigned_by_email', assigned_by_email
        ),
        'pending'
      );
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER trigger_policy_acknowledgment_notification
  AFTER UPDATE ON policy_assignments
  FOR EACH ROW
  EXECUTE FUNCTION notify_policy_acknowledgment_trigger();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION notify_policy_acknowledgment_trigger() TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION notify_policy_acknowledgment_trigger() IS 'Automatically sends notifications and queues ONE email TO the assigner with HR/Admin in CC when a policy is acknowledged';
COMMENT ON TRIGGER trigger_policy_acknowledgment_notification ON policy_assignments IS 'Triggers automatic notifications and properly addressed emails for policy acknowledgments';
