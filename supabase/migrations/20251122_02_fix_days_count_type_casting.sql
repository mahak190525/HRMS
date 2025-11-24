-- Fix: Handle days_count type casting for decimal values
-- This fixes the "invalid input syntax for type integer: '1.0'" error

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
BEGIN
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

  -- Only send emails for approved leaves
  IF leave_app_data->>'status' != 'approved' THEN
    RETURN;
  END IF;

  -- Format approver title with role
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

  -- Get employee data (the person who requested leave)
  employee_data := jsonb_build_object(
    'email', leave_app_data->>'employee_email',
    'name', leave_app_data->>'employee_name'
  );

  -- Get admin and HR users (excluding the employee who applied)
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
  AND u.email IS NOT NULL;

  -- Get manager data if exists and different from approver
  SELECT jsonb_build_object(
    'email', m.email,
    'name', m.full_name
  ) INTO manager_data
  FROM users u
  JOIN users m ON u.manager_id = m.id
  WHERE u.id = (leave_app_data->>'user_id')::uuid
  AND m.id != COALESCE((leave_app_data->>'approved_by')::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
  AND m.status = 'active'
  AND m.email IS NOT NULL;

  -- Prepare recipients object
  recipients_data := jsonb_build_object(
    'employee', employee_data,
    'adminsAndHR', COALESCE(admins_hr_data, '[]'::jsonb),
    'manager', manager_data
  );

  -- Prepare leave data for email template
  -- Fix: Handle days_count as numeric and convert to integer properly
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

  -- Call the email Edge Function
  BEGIN
    PERFORM net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/send-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
      ),
      body := jsonb_build_object(
        'type', p_email_type,
        'leaveData', leave_app_data,
        'recipients', recipients_data
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the main transaction
    RAISE WARNING 'Failed to send email notification for leave application %: %', p_leave_application_id, SQLERRM;
  END;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

