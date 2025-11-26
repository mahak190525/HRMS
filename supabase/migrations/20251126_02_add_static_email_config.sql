-- =====================================================
-- Static Email Configuration
-- =====================================================
-- This migration adds a centralized function to manage static CC emails
-- Update the emails in this function to change static CC recipients across all modules
-- =====================================================

-- Function to get static CC emails for different contexts
CREATE OR REPLACE FUNCTION get_static_cc_emails(context text DEFAULT 'default')
RETURNS jsonb AS $$
DECLARE
  static_emails jsonb;
BEGIN
  -- Define static emails here - update these to change static CC recipients
  -- Context can be: 'default', 'leave', 'policy', 'payroll', 'hr', etc.
  
  CASE context
    WHEN 'leave' THEN
      -- Static emails for leave-related notifications
      static_emails := jsonb_build_array(
        jsonb_build_object('email', 'awasthy.mukesh@mechlintech.com', 'name', 'Mukesh Kumar'),
        jsonb_build_object('email', 'mechlinpeopleworkplace@mechlintech.com', 'name', 'Mechlin People & Workplace'),
        jsonb_build_object('email', 'mechlinpayroll@mechlintech.com', 'name', 'Mechlin Payroll')
      );
    
    WHEN 'policy' THEN
      -- Static emails for policy-related notifications
      static_emails := jsonb_build_array(
        jsonb_build_object('email', 'awasthy.mukesh@mechlintech.com', 'name', 'Mukesh Kumar'),
        jsonb_build_object('email', 'mechlinpeopleworkplace@mechlintech.com', 'name', 'Mechlin People & Workplace')
      );
    
    WHEN 'payroll' THEN
      -- Static emails for payroll-related notifications
      static_emails := jsonb_build_array(
        jsonb_build_object('email', 'mechlinpayroll@mechlintech.com', 'name', 'Mechlin Payroll'),
        jsonb_build_object('email', 'awasthy.mukesh@mechlintech.com', 'name', 'Mukesh Kumar')
      );
    
    WHEN 'performance' THEN
      -- Static emails for performance-related notifications
      static_emails := jsonb_build_array(
        jsonb_build_object('email', 'awasthy.mukesh@mechlintech.com', 'name', 'Mukesh Kumar'),
        jsonb_build_object('email', 'mechlinpeopleworkplace@mechlintech.com', 'name', 'Mechlin People & Workplace')
      );
    
    WHEN 'hr' THEN
      -- Static emails for general HR notifications
      static_emails := jsonb_build_array(
        jsonb_build_object('email', 'awasthy.mukesh@mechlintech.com', 'name', 'Mukesh Kumar'),
        jsonb_build_object('email', 'mechlinpeopleworkplace@mechlintech.com', 'name', 'Mechlin People & Workplace')
      );
    
    ELSE
      -- Default static emails (used when no specific context is provided)
      static_emails := jsonb_build_array(
        jsonb_build_object('email', 'awasthy.mukesh@mechlintech.com', 'name', 'Mukesh Kumar'),
        jsonb_build_object('email', 'mechlinpeopleworkplace@mechlintech.com', 'name', 'Mechlin People & Workplace')
      );
  END CASE;
  
  RETURN static_emails;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_static_cc_emails(text) TO postgres, service_role, authenticated;

-- Update the leave notification function to use the centralized static emails
CREATE OR REPLACE FUNCTION send_leave_email_notification_generic(
  p_leave_application_id uuid,
  p_email_type email_type_enum DEFAULT 'leave_approved'
)
RETURNS void AS $$
DECLARE
  leave_app_data jsonb;
  recipients_data jsonb;
  employee_data jsonb;
  manager_data jsonb;
  email_subject text;
BEGIN
  -- Get leave application details
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

  -- Only process if we have data
  IF leave_app_data IS NULL THEN
    RETURN;
  END IF;

  -- Prepare employee recipient
  employee_data := jsonb_build_object(
    'email', leave_app_data->>'employee_email',
    'name', leave_app_data->>'employee_name'
  );

  -- Prepare recipients structure using centralized static emails
  recipients_data := jsonb_build_object(
    'to', jsonb_build_array(employee_data),
    'cc_static', get_static_cc_emails('leave'),  -- Use centralized function
    'cc_dynamic', jsonb_build_array('manager')
  );

  -- Generate subject based on email type
  email_subject := CASE p_email_type
    WHEN 'leave_approved' THEN 'Your leave request has been Approved'
    WHEN 'leave_rejected' THEN 'Your leave request has been Rejected'
    WHEN 'leave_submitted' THEN 'New Leave Request - ' || (leave_app_data->>'employee_name')
    WHEN 'leave_withdrawn' THEN 'Leave request withdrawn - ' || (leave_app_data->>'employee_name')
    ELSE 'Leave Request Update'
  END;

  -- Queue the email using the generic system
  PERFORM queue_email(
    'leave_management'::module_type_enum,
    p_leave_application_id,
    p_email_type,
    recipients_data,
    leave_app_data,
    email_subject,
    'normal'::email_priority_enum
  );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the policy assignment function to use centralized static emails
CREATE OR REPLACE FUNCTION queue_policy_assignment_email(
  p_policy_assignment_id uuid,
  p_user_id uuid,
  p_assigned_by uuid,
  p_policy_names text[]
)
RETURNS uuid AS $$
DECLARE
  email_data jsonb;
  recipients_data jsonb;
  employee_data jsonb;
  email_id uuid;
BEGIN
  -- Get employee details
  SELECT jsonb_build_object(
    'email', u.email,
    'name', u.full_name
  ) INTO employee_data
  FROM users u
  WHERE u.id = p_user_id;

  -- Get assigner details and prepare email data
  SELECT jsonb_build_object(
    'user_id', p_user_id,
    'employee_name', employee_data->>'name',
    'employee_email', employee_data->>'email',
    'assigned_by_name', assigner.full_name,
    'assigned_by_email', assigner.email,
    'policy_names', to_jsonb(p_policy_names),
    'policy_count', array_length(p_policy_names, 1),
    'assigned_at', now()
  ) INTO email_data
  FROM users assigner
  WHERE assigner.id = p_assigned_by;

  -- Prepare recipients using centralized static emails
  recipients_data := jsonb_build_object(
    'to', jsonb_build_array(employee_data),
    'cc_static', get_static_cc_emails('policy'),  -- Use centralized function
    'cc_dynamic', jsonb_build_array('manager', 'hr')
  );

  -- Queue the email
  email_id := queue_email(
    'policy_management'::module_type_enum,
    p_policy_assignment_id,
    'policy_assigned'::email_type_enum,
    recipients_data,
    email_data,
    'Policy Assignment - Action Required',
    'normal'::email_priority_enum
  );

  RETURN email_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the KRA assignment function to use centralized static emails
CREATE OR REPLACE FUNCTION queue_kra_assignment_email(
  p_kra_id uuid,
  p_employee_id uuid,
  p_manager_id uuid
)
RETURNS uuid AS $$
DECLARE
  email_data jsonb;
  recipients_data jsonb;
  employee_data jsonb;
  email_id uuid;
BEGIN
  -- Get employee and KRA details
  SELECT jsonb_build_object(
    'user_id', p_employee_id,
    'employee_name', emp.full_name,
    'employee_email', emp.email,
    'manager_name', mgr.full_name,
    'manager_email', mgr.email,
    'kra_title', 'Performance KRA Assignment',
    'assigned_at', now()
  ) INTO email_data
  FROM users emp
  LEFT JOIN users mgr ON mgr.id = p_manager_id
  WHERE emp.id = p_employee_id;

  -- Get employee recipient data
  employee_data := jsonb_build_object(
    'email', email_data->>'employee_email',
    'name', email_data->>'employee_name'
  );

  -- Prepare recipients using centralized static emails
  recipients_data := jsonb_build_object(
    'to', jsonb_build_array(employee_data),
    'cc_static', get_static_cc_emails('performance'),  -- Use centralized function
    'cc_dynamic', jsonb_build_array('manager', 'hr')
  );

  -- Queue the email
  email_id := queue_email(
    'performance_management'::module_type_enum,
    p_kra_id,
    'kra_assigned'::email_type_enum,
    recipients_data,
    email_data,
    'KRA Assignment - Action Required',
    'normal'::email_priority_enum
  );

  RETURN email_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment explaining how to update static emails
COMMENT ON FUNCTION get_static_cc_emails(text) IS 
'Returns static CC email addresses for different contexts. 
To update static emails, modify this function and change the email addresses in the CASE statement.
Available contexts: leave, policy, payroll, performance, hr, default';

SELECT 'Static email configuration function created successfully! ✅' as status,
       'To update static emails, edit the get_static_cc_emails() function' as instructions,
       'All email queueing functions now use centralized static email configuration' as note;
