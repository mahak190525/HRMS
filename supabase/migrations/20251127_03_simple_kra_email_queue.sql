-- Simple KRA email queue function that bypasses complex logic
-- This function directly inserts into email_queue with minimal processing

CREATE OR REPLACE FUNCTION queue_simple_kra_email(
  p_email_type text,
  p_assignment_id uuid,
  p_employee_id uuid,
  p_manager_id uuid,
  p_quarter text DEFAULT 'Q1'
)
RETURNS uuid AS $$
DECLARE
  email_id uuid;
  employee_email text;
  employee_name text;
  manager_email text;
  manager_name text;
  email_subject text;
BEGIN
  -- Get employee details
  SELECT email, full_name INTO employee_email, employee_name
  FROM users 
  WHERE id = p_employee_id AND status = 'active';
  
  -- Get manager details  
  SELECT email, full_name INTO manager_email, manager_name
  FROM users 
  WHERE id = p_manager_id AND status = 'active';
  
  -- Check if we have the required data
  IF employee_email IS NULL OR manager_email IS NULL THEN
    RAISE WARNING 'Missing employee or manager data for KRA email: employee=%, manager=%', p_employee_id, p_manager_id;
    RETURN NULL;
  END IF;
  
  -- Generate subject based on email type
  CASE p_email_type
    WHEN 'kra_assigned' THEN
      email_subject := 'KRA Assignment - ' || employee_name || ' - Action Required';
    WHEN 'kra_submitted' THEN  
      email_subject := 'KRA Submission - ' || employee_name || ' - Action Required';
    WHEN 'kra_approved' THEN
      email_subject := 'KRA Evaluation Completed - ' || employee_name || ' - Action Required';
    ELSE
      email_subject := 'KRA Notification - ' || employee_name || ' - Action Required';
  END CASE;
  
  -- Insert into email queue with simple structure
  INSERT INTO email_queue (
    module_type,
    reference_id,
    email_type,
    subject,
    priority,
    recipients,
    email_data,
    status,
    scheduled_at,
    created_at
  ) VALUES (
    'performance'::module_type_enum,
    p_assignment_id::text,
    p_email_type::email_type_enum,
    email_subject,
    'normal'::email_priority_enum,
    jsonb_build_object(
      'to', jsonb_build_array(
        jsonb_build_object('email', 
          CASE 
            WHEN p_email_type = 'kra_submitted' THEN manager_email
            ELSE employee_email
          END,
          'name',
          CASE 
            WHEN p_email_type = 'kra_submitted' THEN manager_name
            ELSE employee_name
          END
        )
      ),
      'cc_static', jsonb_build_array(
        jsonb_build_object('email', 'mechlinpeopleworkplace@mechlintech.com', 'name', 'People & Workplace'),
        jsonb_build_object('email', 'awasthy.mukesh@mechlintech.com', 'name', 'Mukesh Kumar')
      ),
      'cc_dynamic_resolved', jsonb_build_array(
        jsonb_build_object('email',
          CASE 
            WHEN p_email_type = 'kra_submitted' THEN employee_email
            ELSE manager_email
          END,
          'name',
          CASE 
            WHEN p_email_type = 'kra_submitted' THEN employee_name  
            ELSE manager_name
          END
        )
      )
    ),
    jsonb_build_object(
      'employee_name', employee_name,
      'manager_name', manager_name,
      'assignment_id', p_assignment_id,
      'quarter', p_quarter,
      'action_time', now()
    ),
    'pending'::email_status_enum,
    now(),
    now()
  ) RETURNING id INTO email_id;
  
  RETURN email_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION queue_simple_kra_email(text, uuid, uuid, uuid, text) TO postgres, service_role, authenticated;

COMMENT ON FUNCTION queue_simple_kra_email(text, uuid, uuid, uuid, text) IS 'Simple function to queue KRA emails without complex logic';

SELECT 'Simple KRA email queue function created successfully! ✅' as status;
