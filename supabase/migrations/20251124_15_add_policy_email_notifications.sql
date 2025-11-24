-- Add email notifications for policy management
-- This migration adds email notification functionality for policy assignments and acknowledgments
-- Following the same pattern as leave management with email_queue integration

-- First, ensure we have the policy notification types in the constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type = ANY (ARRAY[
    'general',
    -- Leave notification types
    'leave_request_submitted',
    'leave_request_pending',
    'leave_request_approved', 
    'leave_request_rejected',
    'leave_request_withdrawn',
    'leave_request_cancelled',
    -- Complaint types
    'complaint_submitted',
    'complaint_assigned',
    'complaint_resolved',
    -- Performance types
    'performance_goal_assigned',
    -- Interview types
    'interview_scheduled',
    -- Assessment types
    'assessment_assigned',
    -- Exit process types
    'exit_process_initiated',
    -- Document types
    'document_approved',
    'document_rejected',
    'document_request',
    'document_upload',
    -- Project types
    'project_assigned',
    'project_unassigned',
    'project_role_updated',
    'project_deleted',
    -- Asset request types
    'asset_request_submitted',
    'asset_request_approved',
    'asset_request_rejected',
    'asset_request_fulfilled',
    -- Asset assignment types
    'asset_assigned',
    'asset_unassigned',
    'vm_assigned',
    'vm_unassigned',
    -- Asset upload types
    'asset_quarterly_upload_reminder',
    'asset_images_uploaded',
    'asset_upload_overdue',
    -- Security types
    'security',
    -- KRA types
    'kra_assignment',
    'kra_quarter_enabled',
    'kra_submitted',
    'kra_evaluated',
    -- Policy types
    'policy_assigned',
    'policy_acknowledged'
  ]));

-- Function to send policy email notifications via email queue
CREATE OR REPLACE FUNCTION send_policy_email_notification(
  p_user_ids uuid[],
  p_policy_count integer,
  p_assigned_by_name text,
  p_email_type text DEFAULT 'policy_assigned'
) RETURNS void AS $$
DECLARE
  recipients_data jsonb;
  employee_data jsonb;
  admins_hr_data jsonb;
  policy_data jsonb;
  user_id uuid;
  user_email text;
  user_name text;
BEGIN
  -- Log start (if log function exists)
  BEGIN
    PERFORM log_trigger_execution(
      'send_policy_email_notification',
      'email_function',
      'START',
      NULL,
      NULL,
      NULL,
      'Policy email function started for ' || array_length(p_user_ids, 1)::text || ' users, type: ' || p_email_type
    );
  EXCEPTION WHEN OTHERS THEN
    -- Ignore if log function doesn't exist
    NULL;
  END;

  -- Get admin and HR users for CC
  SELECT jsonb_agg(
    jsonb_build_object(
      'email', u.email,
      'name', u.full_name
    )
  ) INTO admins_hr_data
  FROM users u
  INNER JOIN roles r ON u.role_id = r.id
  WHERE r.name IN ('admin', 'super_admin', 'hr')
  AND u.status = 'active'
  AND u.email IS NOT NULL
  AND u.email != '';

  -- Prepare policy data for email template
  policy_data := jsonb_build_object(
    'policyCount', p_policy_count,
    'assignedByName', p_assigned_by_name,
    'assignedAt', NOW()
  );

  -- Process each user individually to send personalized emails
  FOREACH user_id IN ARRAY p_user_ids
  LOOP
    -- Get user details
    SELECT u.email, u.full_name 
    INTO user_email, user_name
    FROM users u 
    WHERE u.id = user_id 
    AND u.status = 'active' 
    AND u.email IS NOT NULL 
    AND u.email != '';

    -- Skip if user has no valid email
    IF user_email IS NULL THEN
      CONTINUE;
    END IF;

    -- Prepare employee data for this user
    employee_data := jsonb_build_object(
      'email', user_email,
      'name', user_name
    );

    -- Prepare recipients object
    recipients_data := jsonb_build_object(
      'employee', employee_data,
      'adminsAndHR', COALESCE(admins_hr_data, '[]'::jsonb)
    );

    -- Add user-specific data to policy data
    policy_data := policy_data || jsonb_build_object(
      'employeeName', user_name,
      'employeeEmail', user_email
    );

    -- Insert into email queue
    INSERT INTO email_queue (
      leave_application_id, -- We'll use NULL for policy emails since it's not leave-related
      email_type,
      recipients,
      leave_data, -- Reusing this field for policy data
      status
    ) VALUES (
      NULL,
      p_email_type,
      recipients_data,
      policy_data,
      'pending'
    );

    -- Log email queued for this user
    BEGIN
      PERFORM log_trigger_execution(
        'send_policy_email_notification',
        'email_function',
        'EMAIL_QUEUED',
        NULL,
        NULL,
        NULL,
        'Policy email queued for user: ' || user_name || ' (' || user_email || '), type: ' || p_email_type
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

  END LOOP;

  -- Log completion
  BEGIN
    PERFORM log_trigger_execution(
      'send_policy_email_notification',
      'email_function',
      'COMPLETED',
      NULL,
      NULL,
      NULL,
      'Policy email function completed. Queued emails for ' || array_length(p_user_ids, 1)::text || ' users'
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle policy assignment notifications with collective email logic
CREATE OR REPLACE FUNCTION notify_policy_assignments_with_email(
  p_user_ids uuid[],
  p_assigned_by_name text,
  p_policy_count integer DEFAULT 1
) RETURNS void AS $$
DECLARE
  user_id uuid;
  user_name text;
  policy_text text;
BEGIN
  -- Determine policy text based on count
  IF p_policy_count = 1 THEN
    policy_text := '1 policy has';
  ELSE
    policy_text := p_policy_count::text || ' policies have';
  END IF;

  -- Create individual notifications for each user (as before)
  FOREACH user_id IN ARRAY p_user_ids
  LOOP
    -- Get user name
    SELECT u.full_name INTO user_name
    FROM users u WHERE u.id = user_id;

    -- Create notification
    INSERT INTO notifications (user_id, title, message, type, data)
    VALUES (
      user_id,
      'Policy Assignment',
      policy_text || ' been assigned to you by ' || p_assigned_by_name || '. Please review and acknowledge them in the Policies section.',
      'policy_assigned',
      jsonb_build_object(
        'assigned_by_name', p_assigned_by_name,
        'policy_count', p_policy_count,
        'assigned_at', NOW(),
        'target', 'dashboard/policies'
      )
    );
  END LOOP;

  -- Send collective email notification (one email per user, but with collective message)
  PERFORM send_policy_email_notification(
    p_user_ids,
    p_policy_count,
    p_assigned_by_name,
    'policy_assigned'
  );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle policy acknowledgment notifications with email
CREATE OR REPLACE FUNCTION notify_policy_acknowledgment_with_email(
  p_employee_id uuid,
  p_employee_name text,
  p_policy_name text,
  p_policy_id uuid
) RETURNS void AS $$
DECLARE
  hr_admin_user_id uuid;
  policy_data jsonb;
BEGIN
  -- Create notifications for HR and Admin users
  FOR hr_admin_user_id IN
    SELECT u.id
    FROM users u
    INNER JOIN roles r ON u.role_id = r.id
    WHERE r.name IN ('admin', 'super_admin', 'hr')
    AND u.status = 'active'
    AND u.id != p_employee_id
  LOOP
    INSERT INTO notifications (user_id, title, message, type, data)
    VALUES (
      hr_admin_user_id,
      'Policy Acknowledged',
      p_employee_name || ' has acknowledged the policy "' || p_policy_name || '".',
      'policy_acknowledged',
      jsonb_build_object(
        'employee_id', p_employee_id,
        'employee_name', p_employee_name,
        'policy_id', p_policy_id,
        'policy_name', p_policy_name,
        'acknowledged_at', NOW(),
        'target', 'policies/history'
      )
    );
  END LOOP;

  -- Send email notification to HR/Admin users
  -- We'll send one email per HR/Admin user about this acknowledgment
  PERFORM send_policy_email_notification(
    ARRAY(
      SELECT u.id
      FROM users u
      INNER JOIN roles r ON u.role_id = r.id
      WHERE r.name IN ('admin', 'super_admin', 'hr')
      AND u.status = 'active'
      AND u.id != p_employee_id
      AND u.email IS NOT NULL
      AND u.email != ''
    ),
    1, -- One policy acknowledged
    p_employee_name,
    'policy_acknowledged'
  );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION send_policy_email_notification(uuid[], integer, text, text) TO postgres;
GRANT EXECUTE ON FUNCTION send_policy_email_notification(uuid[], integer, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION notify_policy_assignments_with_email(uuid[], text, integer) TO postgres;
GRANT EXECUTE ON FUNCTION notify_policy_assignments_with_email(uuid[], text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION notify_policy_acknowledgment_with_email(uuid, text, text, uuid) TO postgres;
GRANT EXECUTE ON FUNCTION notify_policy_acknowledgment_with_email(uuid, text, text, uuid) TO service_role;

-- Add comments explaining the functions
COMMENT ON FUNCTION send_policy_email_notification(uuid[], integer, text, text) IS 
'Sends collective policy email notifications via email queue system to prevent spam when multiple policies are assigned';

COMMENT ON FUNCTION notify_policy_assignments_with_email(uuid[], text, integer) IS 
'Creates policy assignment notifications and sends collective emails to assigned users';

COMMENT ON FUNCTION notify_policy_acknowledgment_with_email(uuid, text, text, uuid) IS 
'Creates policy acknowledgment notifications and sends emails to HR/Admin users';
