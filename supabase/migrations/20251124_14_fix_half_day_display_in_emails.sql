-- Fix half day display in emails
-- The issue is that we're converting days_count to integer, losing the 0.5 value
-- This migration preserves the decimal value and formats it properly

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
  managers_data jsonb;
  approver_role text;
  approver_title text;
  user_manager_id uuid;
  approved_by_id uuid;
  user_department_id uuid;
  days_count_numeric numeric;
  days_display text;
BEGIN
  -- Log start (if log function exists)
  BEGIN
    PERFORM log_trigger_execution(
      'send_leave_email_notification',
      'email_function',
      'START',
      p_leave_application_id,
      NULL,
      NULL,
      'Email function started for application: ' || p_leave_application_id::text || ', type: ' || p_email_type
    );
  EXCEPTION WHEN OTHERS THEN
    -- Ignore if log function doesn't exist
    NULL;
  END;
  
  -- Get leave application details with all related data (same structure as working version)
  SELECT jsonb_build_object(
    'id', la.id,
    'status', la.status,
    'start_date', la.start_date,
    'end_date', la.end_date,
    'days_count', la.days_count,
    'is_half_day', la.is_half_day,
    'half_day_period', la.half_day_period,
    'comments', la.comments,
    'reason', la.reason,
    'user_id', la.user_id,
    'approved_by', la.approved_by,
    'employee_name', u.full_name,
    'employee_email', u.email,
    'manager_id', u.manager_id,
    'department_id', u.department_id,
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
  BEGIN
    PERFORM log_trigger_execution(
      'send_leave_email_notification',
      'email_function',
      'DATA_RETRIEVED',
      p_leave_application_id,
      NULL,
      leave_app_data->>'status',
      'Leave data retrieved. Status: ' || (leave_app_data->>'status') || ', Employee: ' || (leave_app_data->>'employee_name') || ', Type: ' || p_email_type
    );
  EXCEPTION WHEN OTHERS THEN
    -- Ignore if log function doesn't exist
    NULL;
  END;

  -- Check if we should send email based on type and status (modified from working version)
  IF p_email_type = 'leave_approval' AND leave_app_data->>'status' != 'approved' THEN
    BEGIN
      PERFORM log_trigger_execution(
        'send_leave_email_notification',
        'email_function',
        'SKIPPED',
        p_leave_application_id,
        NULL,
        leave_app_data->>'status',
        'Skipping email - approval type but status is not approved: ' || (leave_app_data->>'status')
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    RETURN;
  ELSIF p_email_type = 'leave_rejection' AND leave_app_data->>'status' != 'rejected' THEN
    RETURN;
  ELSIF p_email_type = 'leave_withdrawal' AND leave_app_data->>'status' != 'withdrawn' THEN
    RETURN;
  ELSIF p_email_type = 'leave_submission' AND leave_app_data->>'status' NOT IN ('pending', 'submitted') THEN
    RETURN;
  END IF;

  -- Extract values for easier access (same as working version)
  user_manager_id := (leave_app_data->>'manager_id')::uuid;
  approved_by_id := (leave_app_data->>'approved_by')::uuid;
  user_department_id := (leave_app_data->>'department_id')::uuid;
  
  -- Get the numeric days count and format it properly for display
  days_count_numeric := (leave_app_data->>'days_count')::numeric;
  
  -- Format days display like notifications do (preserve decimal, format nicely)
  IF days_count_numeric = 0.5 THEN
    days_display := 'half day';
  ELSIF days_count_numeric = 1 THEN
    days_display := '1 day';
  ELSE
    -- For other values, show as is but format nicely
    IF days_count_numeric = ROUND(days_count_numeric) THEN
      -- Whole number, show as integer
      days_display := ROUND(days_count_numeric)::text || ' days';
    ELSE
      -- Decimal, show with decimal
      days_display := days_count_numeric::text || ' days';
    END IF;
  END IF;

  -- Format approver title with role (same as working version)
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

  -- Get employee data (same as working version)
  employee_data := jsonb_build_object(
    'email', leave_app_data->>'employee_email',
    'name', leave_app_data->>'employee_name'
  );

  -- Get admin and HR users (same as working version but include finance)
  SELECT jsonb_agg(
    jsonb_build_object(
      'email', u.email,
      'name', u.full_name
    )
  ) INTO admins_hr_data
  FROM users u
  INNER JOIN roles r ON u.role_id = r.id
  WHERE r.name IN ('admin', 'super_admin', 'hr', 'finance')
  AND u.status = 'active'
  AND u.id != (leave_app_data->>'user_id')::uuid
  AND u.email IS NOT NULL
  AND u.email != '';

  -- Handle manager/managers data based on email type
  IF p_email_type = 'leave_submission' THEN
    -- For submissions, get all relevant managers (department + direct)
    SELECT jsonb_agg(
      jsonb_build_object(
        'email', u.email,
        'name', u.full_name
      )
    ) INTO managers_data
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE (
      -- Same department managers
      (u.department_id = user_department_id
       AND r.name IN ('sdm', 'bdm', 'qam'))
      OR
      -- Direct manager
      u.id = user_manager_id
    )
    AND u.status = 'active'
    AND u.id != (leave_app_data->>'user_id')::uuid
    AND u.email IS NOT NULL
    AND u.email != '';
  ELSE
    -- For other types, get manager only if different from approver (same as working version)
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
  END IF;

  -- Prepare recipients object based on email type
  IF p_email_type = 'leave_submission' THEN
    recipients_data := jsonb_build_object(
      'employee', employee_data,
      'adminsAndHR', COALESCE(admins_hr_data, '[]'::jsonb),
      'managers', COALESCE(managers_data, '[]'::jsonb)
    );
  ELSE
    recipients_data := jsonb_build_object(
      'employee', employee_data,
      'adminsAndHR', COALESCE(admins_hr_data, '[]'::jsonb),
      'manager', manager_data
    );
  END IF;

  -- Log recipients
  BEGIN
    PERFORM log_trigger_execution(
      'send_leave_email_notification',
      'email_function',
      'RECIPIENTS_PREPARED',
      p_leave_application_id,
      NULL,
      NULL,
      'Recipients prepared for ' || p_email_type || '. Employee: ' || (employee_data->>'email') || ', Admin/HR count: ' || jsonb_array_length(COALESCE(admins_hr_data, '[]'::jsonb))::text
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Prepare leave data for email template (FIXED: preserve decimal days_count and add formatted display)
  leave_app_data := jsonb_build_object(
    'employeeName', leave_app_data->>'employee_name',
    'employeeEmail', leave_app_data->>'employee_email',
    'leaveType', leave_app_data->>'leave_type',
    'startDate', leave_app_data->>'start_date',
    'endDate', leave_app_data->>'end_date',
    'daysCount', days_count_numeric,  -- Keep original numeric value
    'daysDisplay', days_display,      -- Add formatted display text
    'isHalfDay', COALESCE((leave_app_data->>'is_half_day')::boolean, false),
    'halfDayPeriod', leave_app_data->>'half_day_period',
    'approverName', leave_app_data->>'approver_name',
    'approverTitle', approver_title,
    'comments', leave_app_data->>'comments',
    'reason', leave_app_data->>'reason'
  );

  -- INSERT INTO EMAIL QUEUE (same as working version)
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
  BEGIN
    PERFORM log_trigger_execution(
      'send_leave_email_notification',
      'email_function',
      'EMAIL_QUEUED',
      p_leave_application_id,
      NULL,
      NULL,
      'Email queued successfully for processing. Type: ' || p_email_type || ', Days: ' || days_display
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Log completion
  BEGIN
    PERFORM log_trigger_execution(
      'send_leave_email_notification',
      'email_function',
      'COMPLETED',
      p_leave_application_id,
      NULL,
      NULL,
      'Email function completed - email queued for processing. Type: ' || p_email_type
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions (same as working version)
GRANT EXECUTE ON FUNCTION send_leave_email_notification(uuid, text) TO postgres;
GRANT EXECUTE ON FUNCTION send_leave_email_notification(uuid, text) TO service_role;

-- Add comment explaining the fix
COMMENT ON FUNCTION send_leave_email_notification(uuid, text) IS 
'Email notification function that properly handles half-day leaves by preserving decimal days_count values and providing formatted display text for emails';
