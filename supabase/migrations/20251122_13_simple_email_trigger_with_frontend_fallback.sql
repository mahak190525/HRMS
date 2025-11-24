-- Simple approach: Log email attempts and let frontend handle the actual sending
-- This ensures the trigger works reliably while we debug HTTP issues

-- First, let's create a simple email queue table
CREATE TABLE IF NOT EXISTS email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  leave_application_id uuid NOT NULL,
  email_type text NOT NULL DEFAULT 'leave_approval',
  status text NOT NULL DEFAULT 'pending',
  recipients jsonb NOT NULL,
  leave_data jsonb NOT NULL,
  processed_at timestamptz,
  error_message text,
  FOREIGN KEY (leave_application_id) REFERENCES leave_applications(id)
);

-- Grant access to the email queue table
GRANT ALL ON email_queue TO postgres;
GRANT ALL ON email_queue TO service_role;
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for service role" ON email_queue FOR ALL USING (true) WITH CHECK (true);

-- Create a reliable email notification function that queues emails
CREATE OR REPLACE FUNCTION send_leave_email_notification(
  p_leave_application_id uuid,
  p_email_type text DEFAULT 'leave_approval'
) RETURNS void AS $$
DECLARE
  leave_app_data jsonb;
  recipients_data jsonb;
  employee_data jsonb;
  admins_hr_data jsonb;
  manager_data jsonb;
  approver_role text;
  approver_title text;
  user_manager_id uuid;
  approved_by_id uuid;
BEGIN
  -- Log start
  PERFORM log_trigger_execution(
    'send_leave_email_notification',
    'email_function',
    'START',
    p_leave_application_id,
    NULL,
    NULL,
    'Email function started for application: ' || p_leave_application_id::text
  );
  
  -- Get leave application details with all related data
  SELECT jsonb_build_object(
    'id', la.id,
    'status', la.status,
    'start_date', la.start_date,
    'end_date', la.end_date,
    'days_count', la.days_count,
    'comments', la.comments,
    'user_id', la.user_id,
    'approved_by', la.approved_by,
    'employee_name', u.full_name,
    'employee_email', u.email,
    'manager_id', u.manager_id,
    'leave_type', lt.name,
    'approver_name', approver.full_name,
    'approver_role', COALESCE(approver_role.name, 'employee')
  ) INTO leave_app_data
  FROM leave_applications la
  JOIN users u ON la.user_id = u.id
  JOIN leave_types lt ON la.leave_type_id = lt.id
  LEFT JOIN users approver ON la.approved_by = approver.id
  LEFT JOIN roles approver_role ON approver.role_id = approver_role.id
  WHERE la.id = p_leave_application_id;

  -- Log data retrieved
  PERFORM log_trigger_execution(
    'send_leave_email_notification',
    'email_function',
    'DATA_RETRIEVED',
    p_leave_application_id,
    NULL,
    leave_app_data->>'status',
    'Leave data retrieved. Status: ' || (leave_app_data->>'status') || ', Employee: ' || (leave_app_data->>'employee_name')
  );

  -- Only send emails for approved leaves
  IF leave_app_data->>'status' != 'approved' THEN
    PERFORM log_trigger_execution(
      'send_leave_email_notification',
      'email_function',
      'SKIPPED',
      p_leave_application_id,
      NULL,
      leave_app_data->>'status',
      'Skipping email - status is not approved: ' || (leave_app_data->>'status')
    );
    RETURN;
  END IF;

  -- Extract values
  user_manager_id := (leave_app_data->>'manager_id')::uuid;
  approved_by_id := (leave_app_data->>'approved_by')::uuid;

  -- Format approver title
  approver_role := leave_app_data->>'approver_role';
  approver_title := leave_app_data->>'approver_name';
  
  IF approver_title IS NOT NULL AND approver_role IS NOT NULL THEN
    approver_title := approver_title || ' (' || 
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
  END IF;

  -- Get employee data
  employee_data := jsonb_build_object(
    'email', leave_app_data->>'employee_email',
    'name', leave_app_data->>'employee_name'
  );

  -- Get admin and HR users
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
  AND u.id != (leave_app_data->>'user_id')::uuid
  AND u.email IS NOT NULL
  AND u.email != '';

  -- Get manager data
  manager_data := NULL;
  IF user_manager_id IS NOT NULL AND user_manager_id != approved_by_id THEN
    SELECT jsonb_build_object(
      'email', m.email,
      'name', m.full_name
    ) INTO manager_data
    FROM users m
    WHERE m.id = user_manager_id
    AND m.status = 'active'
    AND m.email IS NOT NULL
    AND m.email != '';
  END IF;

  -- Prepare recipients
  recipients_data := jsonb_build_object(
    'employee', employee_data,
    'adminsAndHR', COALESCE(admins_hr_data, '[]'::jsonb),
    'manager', manager_data
  );

  -- Log recipients
  PERFORM log_trigger_execution(
    'send_leave_email_notification',
    'email_function',
    'RECIPIENTS_PREPARED',
    p_leave_application_id,
    NULL,
    NULL,
    'Recipients prepared. Employee: ' || (employee_data->>'email') || ', Admin/HR count: ' || jsonb_array_length(COALESCE(admins_hr_data, '[]'::jsonb))::text
  );

  -- Prepare leave data for Edge Function
  leave_app_data := jsonb_build_object(
    'employeeName', leave_app_data->>'employee_name',
    'employeeEmail', leave_app_data->>'employee_email',
    'leaveType', leave_app_data->>'leave_type',
    'startDate', leave_app_data->>'start_date',
    'endDate', leave_app_data->>'end_date',
    'daysCount', COALESCE(ROUND((leave_app_data->>'days_count')::numeric)::integer, 1),
    'approverName', leave_app_data->>'approver_name',
    'approverTitle', approver_title,
    'comments', leave_app_data->>'comments'
  );

  -- Instead of making HTTP calls, queue the email for processing
  INSERT INTO email_queue (
    leave_application_id,
    email_type,
    recipients,
    leave_data,
    status
  ) VALUES (
    p_leave_application_id,
    p_email_type,
    recipients_data,
    leave_app_data,
    'pending'
  );

  -- Log email queued
  PERFORM log_trigger_execution(
    'send_leave_email_notification',
    'email_function',
    'EMAIL_QUEUED',
    p_leave_application_id,
    NULL,
    NULL,
    'Email queued successfully for processing'
  );

  -- Log completion
  PERFORM log_trigger_execution(
    'send_leave_email_notification',
    'email_function',
    'COMPLETED',
    p_leave_application_id,
    NULL,
    NULL,
    'Email function completed - email queued for processing'
  );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION send_leave_email_notification(uuid, text) TO postgres;
GRANT EXECUTE ON FUNCTION send_leave_email_notification(uuid, text) TO service_role;

-- Create a function to process the email queue (can be called from frontend)
CREATE OR REPLACE FUNCTION process_email_queue()
RETURNS TABLE (
  queue_id uuid,
  leave_application_id uuid,
  email_type text,
  recipients jsonb,
  leave_data jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    eq.id,
    eq.leave_application_id,
    eq.email_type,
    eq.recipients,
    eq.leave_data
  FROM email_queue eq
  WHERE eq.status = 'pending'
  ORDER BY eq.created_at ASC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION process_email_queue() TO postgres;
GRANT EXECUTE ON FUNCTION process_email_queue() TO service_role;

-- Create a function to mark emails as processed
CREATE OR REPLACE FUNCTION mark_email_processed(
  p_queue_id uuid,
  p_success boolean DEFAULT true,
  p_error_message text DEFAULT NULL
) RETURNS void AS $$
BEGIN
  UPDATE email_queue
  SET 
    status = CASE WHEN p_success THEN 'sent' ELSE 'failed' END,
    processed_at = now(),
    error_message = p_error_message
  WHERE id = p_queue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION mark_email_processed(uuid, boolean, text) TO postgres;
GRANT EXECUTE ON FUNCTION mark_email_processed(uuid, boolean, text) TO service_role;

-- Test message
SELECT 'Migration completed. Email queue system created for reliable email processing.' as status;
