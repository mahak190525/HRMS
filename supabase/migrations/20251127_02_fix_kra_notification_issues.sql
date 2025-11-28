/*
  # Fix KRA Notification Issues
  
  This migration fixes critical issues with KRA in-app notifications:
  1. Missing user status filtering (inactive users getting notifications)
  2. Potential NULL user details causing silent failures
  3. Email recipients not matching requirements
  4. Add proper error handling and logging
  
  ## Issues Fixed
  - get_user_details() now filters by status = 'active'
  - get_hr_admin_users() now filters by status = 'active'
  - Added NULL checks and error handling
  - Updated email recipients to match requirements
  - Added logging for debugging
*/

-- Fix get_user_details function to filter by active status
CREATE OR REPLACE FUNCTION get_user_details(user_uuid uuid)
RETURNS TABLE(
  id uuid,
  name text,
  email text,
  role_name text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    COALESCE(u.full_name, u.email) as name,
    u.email,
    COALESCE(r.name, 'employee') as role_name
  FROM users u
  LEFT JOIN roles r ON u.role_id = r.id
  WHERE u.id = user_uuid 
  AND u.status = 'active';  -- 🆕 CRITICAL FIX: Only active users
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix get_hr_admin_users function to filter by active status
CREATE OR REPLACE FUNCTION get_hr_admin_users()
RETURNS TABLE(user_id uuid) AS $$
BEGIN
  RETURN QUERY
  SELECT u.id
  FROM users u
  LEFT JOIN roles r ON u.role_id = r.id
  WHERE (r.name IN ('hr', 'hrm', 'admin', 'super_admin') OR u."isSA" = true)
  AND u.status = 'active';  -- 🆕 CRITICAL FIX: Only active users
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update KRA assignment notification function with better error handling
CREATE OR REPLACE FUNCTION notify_kra_assignment()
RETURNS TRIGGER AS $$
DECLARE
  employee_details RECORD;
  manager_details RECORD;
  template_details RECORD;
  notification_id uuid;
BEGIN
  -- Get employee details with NULL check
  SELECT * INTO employee_details FROM get_user_details(NEW.employee_id);
  
  IF employee_details.id IS NULL THEN
    RAISE WARNING 'KRA Assignment: Employee % not found or inactive', NEW.employee_id;
    RETURN NEW;
  END IF;
  
  -- Get manager details with NULL check
  SELECT * INTO manager_details FROM get_user_details(NEW.assigned_by);
  
  IF manager_details.id IS NULL THEN
    RAISE WARNING 'KRA Assignment: Manager % not found or inactive', NEW.assigned_by;
    RETURN NEW;
  END IF;
  
  -- Get template details
  SELECT template_name, evaluation_period_start, evaluation_period_end
  INTO template_details
  FROM kra_templates
  WHERE id = NEW.template_id;
  
  IF template_details.template_name IS NULL THEN
    RAISE WARNING 'KRA Assignment: Template % not found', NEW.template_id;
    RETURN NEW;
  END IF;
  
  -- Send notification to employee (in-app notification)
  SELECT create_notification(
    p_user_id := NEW.employee_id,
    p_title := 'New KRA Assignment',
    p_message := format(
      'You have been assigned a new KRA: "%s" by %s. Evaluation period: %s to %s. Q1 is now available for evidence submission.',
      template_details.template_name,
      manager_details.name,
      template_details.evaluation_period_start,
      template_details.evaluation_period_end
    ),
    p_type := 'kra_assignment',
    p_data := jsonb_build_object(
      'assignment_id', NEW.id,
      'template_id', NEW.template_id,
      'template_name', template_details.template_name,
      'assigned_by', NEW.assigned_by,
      'manager_name', manager_details.name,
      'evaluation_period_start', template_details.evaluation_period_start,
      'evaluation_period_end', template_details.evaluation_period_end
    )
  ) INTO notification_id;
  
  IF notification_id IS NOT NULL THEN
    RAISE NOTICE 'KRA Assignment notification created: % for employee %', notification_id, employee_details.name;
  ELSE
    RAISE WARNING 'Failed to create KRA assignment notification for employee %', employee_details.name;
  END IF;
  
  -- 🆕 NEW: Also queue email notification
  BEGIN
    PERFORM queue_kra_assignment_email(
      p_kra_id := NEW.id,
      p_employee_id := NEW.employee_id,
      p_manager_id := NEW.assigned_by
    );
    RAISE NOTICE 'KRA Assignment email queued for employee %', employee_details.name;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to queue KRA assignment email for employee %: %', employee_details.name, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update KRA submission notification function with better error handling
CREATE OR REPLACE FUNCTION notify_kra_submitted()
RETURNS TRIGGER AS $$
DECLARE
  assignment_details RECORD;
  employee_details RECORD;
  manager_details RECORD;
  template_details RECORD;
  quarter_name TEXT;
  total_goals INTEGER;
  submitted_goals INTEGER;
  all_goals_submitted BOOLEAN := FALSE;
  notification_id uuid;
BEGIN
  -- Only trigger on submission (when employee_submitted_at is set)
  IF OLD.employee_submitted_at IS NOT NULL OR NEW.employee_submitted_at IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get assignment details
  SELECT employee_id, assigned_by, template_id
  INTO assignment_details
  FROM kra_assignments
  WHERE id = NEW.assignment_id;
  
  IF assignment_details.employee_id IS NULL THEN
    RAISE WARNING 'KRA Submission: Assignment % not found', NEW.assignment_id;
    RETURN NEW;
  END IF;
  
  -- Check if ALL goals for this quarter have been submitted
  SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN employee_submitted_at IS NOT NULL THEN 1 END) as submitted
  INTO total_goals, submitted_goals
  FROM kra_evaluations e
  JOIN kra_goals g ON e.goal_id = g.id
  JOIN kra_templates t ON g.template_id = t.id
  WHERE e.assignment_id = NEW.assignment_id 
  AND e.quarter = NEW.quarter;
  
  -- Only send notifications if ALL goals for this quarter are now submitted
  IF total_goals > 0 AND submitted_goals = total_goals THEN
    all_goals_submitted := TRUE;
  END IF;
  
  -- Exit early if not all goals are submitted yet
  IF NOT all_goals_submitted THEN
    RETURN NEW;
  END IF;
  
  -- Get employee details with NULL check
  SELECT * INTO employee_details FROM get_user_details(assignment_details.employee_id);
  
  IF employee_details.id IS NULL THEN
    RAISE WARNING 'KRA Submission: Employee % not found or inactive', assignment_details.employee_id;
    RETURN NEW;
  END IF;
  
  -- Get manager details with NULL check
  SELECT * INTO manager_details FROM get_user_details(assignment_details.assigned_by);
  
  IF manager_details.id IS NULL THEN
    RAISE WARNING 'KRA Submission: Manager % not found or inactive', assignment_details.assigned_by;
    RETURN NEW;
  END IF;
  
  -- Get template details
  SELECT template_name
  INTO template_details
  FROM kra_templates
  WHERE id = assignment_details.template_id;
  
  -- Determine quarter name
  quarter_name := CASE NEW.quarter
    WHEN 'Q1' THEN 'Quarter 1 (Q1)'
    WHEN 'Q2' THEN 'Quarter 2 (Q2)'
    WHEN 'Q3' THEN 'Quarter 3 (Q3)'
    WHEN 'Q4' THEN 'Quarter 4 (Q4)'
    ELSE NEW.quarter
  END;
  
  -- Send notification to manager (in-app notification)
  SELECT create_notification(
    p_user_id := assignment_details.assigned_by,
    p_title := format('KRA %s Submission', quarter_name),
    p_message := format(
      '%s has submitted their KRA evidence for %s of "%s". Please review and evaluate.',
      employee_details.name,
      quarter_name,
      template_details.template_name
    ),
    p_type := 'kra_submitted',
    p_data := jsonb_build_object(
      'assignment_id', NEW.assignment_id,
      'template_id', assignment_details.template_id,
      'template_name', template_details.template_name,
      'quarter', NEW.quarter,
      'employee_id', assignment_details.employee_id,
      'employee_name', employee_details.name,
      'submitted_at', NEW.employee_submitted_at,
      'total_goals', total_goals
    )
  ) INTO notification_id;
  
  IF notification_id IS NOT NULL THEN
    RAISE NOTICE 'KRA Submission notification created: % for manager %', notification_id, manager_details.name;
  ELSE
    RAISE WARNING 'Failed to create KRA submission notification for manager %', manager_details.name;
  END IF;
  
  -- 🆕 NEW: Also queue email notification
  BEGIN
    PERFORM queue_kra_submission_email(
      p_assignment_id := NEW.assignment_id,
      p_employee_id := assignment_details.employee_id,
      p_manager_id := assignment_details.assigned_by,
      p_quarter := NEW.quarter
    );
    RAISE NOTICE 'KRA Submission email queued for manager %', manager_details.name;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to queue KRA submission email for manager %: %', manager_details.name, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update KRA evaluation notification function with better error handling
CREATE OR REPLACE FUNCTION notify_kra_evaluated()
RETURNS TRIGGER AS $$
DECLARE
  assignment_details RECORD;
  employee_details RECORD;
  manager_details RECORD;
  template_details RECORD;
  quarter_name TEXT;
  total_goals INTEGER;
  evaluated_goals INTEGER;
  all_goals_evaluated BOOLEAN := FALSE;
  hr_admin_user RECORD;
  notification_id uuid;
  hr_admin_count INTEGER := 0;
BEGIN
  -- Only trigger on evaluation (when manager_evaluated_at is set)
  IF OLD.manager_evaluated_at IS NOT NULL OR NEW.manager_evaluated_at IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get assignment details
  SELECT employee_id, assigned_by, template_id
  INTO assignment_details
  FROM kra_assignments
  WHERE id = NEW.assignment_id;
  
  IF assignment_details.employee_id IS NULL THEN
    RAISE WARNING 'KRA Evaluation: Assignment % not found', NEW.assignment_id;
    RETURN NEW;
  END IF;
  
  -- Check if ALL goals for this quarter have been evaluated
  SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN manager_evaluated_at IS NOT NULL THEN 1 END) as evaluated
  INTO total_goals, evaluated_goals
  FROM kra_evaluations e
  JOIN kra_goals g ON e.goal_id = g.id
  JOIN kra_templates t ON g.template_id = t.id
  WHERE e.assignment_id = NEW.assignment_id 
  AND e.quarter = NEW.quarter;
  
  -- Only send notifications if ALL goals for this quarter are now evaluated
  IF total_goals > 0 AND evaluated_goals = total_goals THEN
    all_goals_evaluated := TRUE;
  END IF;
  
  -- Exit early if not all goals are evaluated yet
  IF NOT all_goals_evaluated THEN
    RETURN NEW;
  END IF;
  
  -- Get employee details with NULL check
  SELECT * INTO employee_details FROM get_user_details(assignment_details.employee_id);
  
  IF employee_details.id IS NULL THEN
    RAISE WARNING 'KRA Evaluation: Employee % not found or inactive', assignment_details.employee_id;
    RETURN NEW;
  END IF;
  
  -- Get manager details with NULL check
  SELECT * INTO manager_details FROM get_user_details(NEW.manager_evaluated_by);
  
  IF manager_details.id IS NULL THEN
    RAISE WARNING 'KRA Evaluation: Manager % not found or inactive', NEW.manager_evaluated_by;
    RETURN NEW;
  END IF;
  
  -- Get template details
  SELECT template_name
  INTO template_details
  FROM kra_templates
  WHERE id = assignment_details.template_id;
  
  -- Determine quarter name
  quarter_name := CASE NEW.quarter
    WHEN 'Q1' THEN 'Quarter 1 (Q1)'
    WHEN 'Q2' THEN 'Quarter 2 (Q2)'
    WHEN 'Q3' THEN 'Quarter 3 (Q3)'
    WHEN 'Q4' THEN 'Quarter 4 (Q4)'
    ELSE NEW.quarter
  END;
  
  -- Send notification to employee (in-app notification)
  SELECT create_notification(
    p_user_id := assignment_details.employee_id,
    p_title := format('KRA %s Evaluation Completed', quarter_name),
    p_message := format(
      'Your KRA submission for %s of "%s" has been evaluated by %s.',
      quarter_name,
      template_details.template_name,
      manager_details.name
    ),
    p_type := 'kra_evaluated',
    p_data := jsonb_build_object(
      'assignment_id', NEW.assignment_id,
      'template_id', assignment_details.template_id,
      'template_name', template_details.template_name,
      'quarter', NEW.quarter,
      'evaluated_by', NEW.manager_evaluated_by,
      'manager_name', manager_details.name,
      'evaluated_at', NEW.manager_evaluated_at,
      'recipient_type', 'employee',
      'total_goals', total_goals
    )
  ) INTO notification_id;
  
  IF notification_id IS NOT NULL THEN
    RAISE NOTICE 'KRA Evaluation notification created: % for employee %', notification_id, employee_details.name;
  ELSE
    RAISE WARNING 'Failed to create KRA evaluation notification for employee %', employee_details.name;
  END IF;
  
  -- Send notifications to HR and Admin users (in-app notifications)
  FOR hr_admin_user IN SELECT user_id FROM get_hr_admin_users() LOOP
    -- Skip if it's the same as employee or manager
    IF hr_admin_user.user_id != assignment_details.employee_id AND hr_admin_user.user_id != NEW.manager_evaluated_by THEN
      SELECT create_notification(
        p_user_id := hr_admin_user.user_id,
        p_title := format('KRA %s Evaluation Completed', quarter_name),
        p_message := format(
          '%s has completed the evaluation for %s''s KRA submission (%s of "%s").',
          manager_details.name,
          employee_details.name,
          quarter_name,
          template_details.template_name
        ),
        p_type := 'kra_evaluated',
        p_data := jsonb_build_object(
          'assignment_id', NEW.assignment_id,
          'template_id', assignment_details.template_id,
          'template_name', template_details.template_name,
          'quarter', NEW.quarter,
          'employee_id', assignment_details.employee_id,
          'employee_name', employee_details.name,
          'evaluated_by', NEW.manager_evaluated_by,
          'manager_name', manager_details.name,
          'evaluated_at', NEW.manager_evaluated_at,
          'recipient_type', 'hr_admin',
          'total_goals', total_goals
        )
      ) INTO notification_id;
      
      IF notification_id IS NOT NULL THEN
        hr_admin_count := hr_admin_count + 1;
      END IF;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'KRA Evaluation notifications sent to % HR/Admin users', hr_admin_count;
  
  -- 🆕 NEW: Also queue email notification
  BEGIN
    PERFORM queue_kra_evaluation_email(
      p_assignment_id := NEW.assignment_id,
      p_employee_id := assignment_details.employee_id,
      p_manager_id := NEW.manager_evaluated_by,
      p_quarter := NEW.quarter
    );
    RAISE NOTICE 'KRA Evaluation email queued for employee %', employee_details.name;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to queue KRA evaluation email for employee %: %', employee_details.name, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update email queue functions with correct recipients
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
  manager_data jsonb;
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
  WHERE emp.id = p_employee_id
  AND emp.status = 'active';

  -- Get employee recipient data
  employee_data := jsonb_build_object(
    'email', email_data->>'employee_email',
    'name', email_data->>'employee_name'
  );

  -- Get manager data for CC
  manager_data := jsonb_build_object(
    'email', email_data->>'manager_email',
    'name', email_data->>'manager_name'
  );

  -- Prepare recipients with specific emails as requested
  recipients_data := jsonb_build_object(
    'to', jsonb_build_array(employee_data),
    'cc_static', get_static_cc_emails('performance'),
    'cc_dynamic_resolved', jsonb_build_array(manager_data)
  );

  -- Queue the email
  email_id := queue_email(
    'performance_management'::module_type_enum,
    p_kra_id,
    'kra_assigned'::email_type_enum,
    recipients_data,
    email_data,
    'KRA Assignment - ' || email_data->>'employee_name' || ' - Action Required',
    'normal'::email_priority_enum
  );

  RETURN email_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to queue KRA submission emails with correct recipients
CREATE OR REPLACE FUNCTION queue_kra_submission_email(
  p_assignment_id uuid,
  p_employee_id uuid,
  p_manager_id uuid,
  p_quarter text
)
RETURNS uuid AS $$
DECLARE
  email_data jsonb;
  recipients_data jsonb;
  manager_data jsonb;
  employee_data jsonb;
  email_id uuid;
BEGIN
  -- Get employee and manager details
  SELECT jsonb_build_object(
    'assignment_id', p_assignment_id,
    'employee_name', emp.full_name,
    'employee_email', emp.email,
    'manager_name', mgr.full_name,
    'manager_email', mgr.email,
    'quarter', p_quarter,
    'submitted_at', now()
  ) INTO email_data
  FROM users emp
  LEFT JOIN users mgr ON mgr.id = p_manager_id
  WHERE emp.id = p_employee_id
  AND emp.status = 'active'
  AND mgr.status = 'active';

  -- Get manager recipient data
  manager_data := jsonb_build_object(
    'email', email_data->>'manager_email',
    'name', email_data->>'manager_name'
  );

  -- Get employee data for CC
  employee_data := jsonb_build_object(
    'email', email_data->>'employee_email',
    'name', email_data->>'employee_name'
  );

  -- Prepare recipients with specific emails as requested (including employee in CC)
  recipients_data := jsonb_build_object(
    'to', jsonb_build_array(manager_data),
    'cc_static', get_static_cc_emails('performance'),
    'cc_dynamic_resolved', jsonb_build_array(employee_data)
  );

  -- Queue the email
  email_id := queue_email(
    'performance_management'::module_type_enum,
    p_assignment_id,
    'kra_submitted'::email_type_enum,
    recipients_data,
    email_data,
    'KRA Submission - ' || email_data->>'employee_name' || ' - Action Required',
    'normal'::email_priority_enum
  );

  RETURN email_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to queue KRA evaluation emails with correct recipients
CREATE OR REPLACE FUNCTION queue_kra_evaluation_email(
  p_assignment_id uuid,
  p_employee_id uuid,
  p_manager_id uuid,
  p_quarter text
)
RETURNS uuid AS $$
DECLARE
  email_data jsonb;
  recipients_data jsonb;
  employee_data jsonb;
  manager_data jsonb;
  email_id uuid;
BEGIN
  -- Get employee and manager details
  SELECT jsonb_build_object(
    'assignment_id', p_assignment_id,
    'employee_name', emp.full_name,
    'employee_email', emp.email,
    'manager_name', mgr.full_name,
    'manager_email', mgr.email,
    'quarter', p_quarter,
    'evaluated_at', now()
  ) INTO email_data
  FROM users emp
  LEFT JOIN users mgr ON mgr.id = p_manager_id
  WHERE emp.id = p_employee_id
  AND emp.status = 'active'
  AND mgr.status = 'active';

  -- Get employee recipient data
  employee_data := jsonb_build_object(
    'email', email_data->>'employee_email',
    'name', email_data->>'employee_name'
  );

  -- Get manager data for CC
  manager_data := jsonb_build_object(
    'email', email_data->>'manager_email',
    'name', email_data->>'manager_name'
  );

  -- Prepare recipients with specific emails as requested
  recipients_data := jsonb_build_object(
    'to', jsonb_build_array(employee_data),
    'cc_static', get_static_cc_emails('performance'),
    'cc_dynamic_resolved', jsonb_build_array(manager_data)
  );

  -- Queue the email
  email_id := queue_email(
    'performance_management'::module_type_enum,
    p_assignment_id,
    'kra_approved'::email_type_enum,  -- Using kra_approved for evaluation completion
    recipients_data,
    email_data,
    'KRA Evaluation Completed - ' || email_data->>'employee_name' || ' - Action Required',
    'normal'::email_priority_enum
  );

  RETURN email_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to queue KRA quarter enabled emails
CREATE OR REPLACE FUNCTION queue_kra_quarter_enabled_email(
  p_assignment_id uuid,
  p_employee_id uuid,
  p_manager_id uuid,
  p_quarter text
)
RETURNS uuid AS $$
DECLARE
  email_data jsonb;
  recipients_data jsonb;
  employee_data jsonb;
  manager_data jsonb;
  email_id uuid;
BEGIN
  -- Get employee and manager details
  SELECT jsonb_build_object(
    'assignment_id', p_assignment_id,
    'employee_name', emp.full_name,
    'employee_email', emp.email,
    'manager_name', mgr.full_name,
    'manager_email', mgr.email,
    'quarter', p_quarter,
    'enabled_at', now()
  ) INTO email_data
  FROM users emp
  LEFT JOIN users mgr ON mgr.id = p_manager_id
  WHERE emp.id = p_employee_id
  AND emp.status = 'active'
  AND mgr.status = 'active';

  -- Get employee recipient data
  employee_data := jsonb_build_object(
    'email', email_data->>'employee_email',
    'name', email_data->>'employee_name'
  );

  -- Get manager data for CC
  manager_data := jsonb_build_object(
    'email', email_data->>'manager_email',
    'name', email_data->>'manager_name'
  );

  -- Prepare recipients with specific emails as requested
  recipients_data := jsonb_build_object(
    'to', jsonb_build_array(employee_data),
    'cc_static', get_static_cc_emails('performance'),
    'cc_dynamic_resolved', jsonb_build_array(manager_data)
  );

  -- Queue the email
  email_id := queue_email(
    'performance_management'::module_type_enum,
    p_assignment_id,
    'kra_assigned'::email_type_enum,  -- Reusing kra_assigned for quarter enabled
    recipients_data,
    email_data,
    'KRA Quarter Enabled - ' || email_data->>'employee_name' || ' - Action Required',
    'normal'::email_priority_enum
  );

  RETURN email_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to queue KRA reassignment emails
CREATE OR REPLACE FUNCTION queue_kra_reassignment_email(
  p_assignment_id uuid,
  p_employee_id uuid,
  p_manager_id uuid
)
RETURNS uuid AS $$
DECLARE
  email_data jsonb;
  recipients_data jsonb;
  employee_data jsonb;
  manager_data jsonb;
  email_id uuid;
BEGIN
  -- Get employee and manager details
  SELECT jsonb_build_object(
    'assignment_id', p_assignment_id,
    'employee_name', emp.full_name,
    'employee_email', emp.email,
    'manager_name', mgr.full_name,
    'manager_email', mgr.email,
    'reassigned_at', now()
  ) INTO email_data
  FROM users emp
  LEFT JOIN users mgr ON mgr.id = p_manager_id
  WHERE emp.id = p_employee_id
  AND emp.status = 'active'
  AND mgr.status = 'active';

  -- Get employee recipient data
  employee_data := jsonb_build_object(
    'email', email_data->>'employee_email',
    'name', email_data->>'employee_name'
  );

  -- Get manager data for CC
  manager_data := jsonb_build_object(
    'email', email_data->>'manager_email',
    'name', email_data->>'manager_name'
  );

  -- Prepare recipients with specific emails as requested
  recipients_data := jsonb_build_object(
    'to', jsonb_build_array(employee_data),
    'cc_static', get_static_cc_emails('performance'),
    'cc_dynamic_resolved', jsonb_build_array(manager_data)
  );

  -- Queue the email
  email_id := queue_email(
    'performance_management'::module_type_enum,
    p_assignment_id,
    'kra_assigned'::email_type_enum,  -- Reusing kra_assigned for reassignment
    recipients_data,
    email_data,
    'KRA Reassignment - ' || email_data->>'employee_name' || ' - Action Required',
    'normal'::email_priority_enum
  );

  RETURN email_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions for the new email queue functions
GRANT EXECUTE ON FUNCTION queue_kra_submission_email(uuid, uuid, uuid, text) TO postgres, service_role, authenticated;
GRANT EXECUTE ON FUNCTION queue_kra_evaluation_email(uuid, uuid, uuid, text) TO postgres, service_role, authenticated;
GRANT EXECUTE ON FUNCTION queue_kra_quarter_enabled_email(uuid, uuid, uuid, text) TO postgres, service_role, authenticated;
GRANT EXECUTE ON FUNCTION queue_kra_reassignment_email(uuid, uuid, uuid) TO postgres, service_role, authenticated;

-- Update the KRA quarter enabled notification function to also send emails
CREATE OR REPLACE FUNCTION notify_kra_quarter_enabled()
RETURNS TRIGGER AS $$
DECLARE
  employee_details RECORD;
  manager_details RECORD;
  template_details RECORD;
  quarter_name TEXT;
  quarter_due_date DATE;
  quarter_code TEXT;
  enabled_by_id uuid;
  notification_id uuid;
BEGIN
  -- Get employee details with NULL check
  SELECT * INTO employee_details FROM get_user_details(NEW.employee_id);
  
  IF employee_details.id IS NULL THEN
    RAISE WARNING 'KRA Quarter Enabled: Employee % not found or inactive', NEW.employee_id;
    RETURN NEW;
  END IF;
  
  -- Determine which quarter was enabled and get the manager who enabled it
  IF OLD.q1_enabled = false AND NEW.q1_enabled = true THEN
    quarter_name := 'Quarter 1 (Q1)';
    quarter_code := 'Q1';
    quarter_due_date := NEW.q1_due_date;
    enabled_by_id := NEW.q1_enabled_by;
  ELSIF OLD.q2_enabled = false AND NEW.q2_enabled = true THEN
    quarter_name := 'Quarter 2 (Q2)';
    quarter_code := 'Q2';
    quarter_due_date := NEW.q2_due_date;
    enabled_by_id := NEW.q2_enabled_by;
  ELSIF OLD.q3_enabled = false AND NEW.q3_enabled = true THEN
    quarter_name := 'Quarter 3 (Q3)';
    quarter_code := 'Q3';
    quarter_due_date := NEW.q3_due_date;
    enabled_by_id := NEW.q3_enabled_by;
  ELSIF OLD.q4_enabled = false AND NEW.q4_enabled = true THEN
    quarter_name := 'Quarter 4 (Q4)';
    quarter_code := 'Q4';
    quarter_due_date := NEW.q4_due_date;
    enabled_by_id := NEW.q4_enabled_by;
  ELSE
    -- No quarter was newly enabled, return
    RETURN NEW;
  END IF;
  
  -- Get manager details with NULL check
  SELECT * INTO manager_details FROM get_user_details(enabled_by_id);
  
  IF manager_details.id IS NULL THEN
    RAISE WARNING 'KRA Quarter Enabled: Manager % not found or inactive', enabled_by_id;
    RETURN NEW;
  END IF;
  
  -- Get template details
  SELECT template_name
  INTO template_details
  FROM kra_templates
  WHERE id = NEW.template_id;
  
  IF template_details.template_name IS NULL THEN
    RAISE WARNING 'KRA Quarter Enabled: Template % not found', NEW.template_id;
    RETURN NEW;
  END IF;
  
  -- Send notification to employee (in-app notification)
  SELECT create_notification(
    p_user_id := NEW.employee_id,
    p_title := format('KRA %s Enabled', quarter_name),
    p_message := format(
      '%s has enabled %s for your KRA "%s". You can now submit evidence for this quarter.%s',
      manager_details.name,
      quarter_name,
      template_details.template_name,
      CASE 
        WHEN quarter_due_date IS NOT NULL THEN format(' Due date: %s', quarter_due_date)
        ELSE ''
      END
    ),
    p_type := 'kra_quarter_enabled',
    p_data := jsonb_build_object(
      'assignment_id', NEW.id,
      'template_id', NEW.template_id,
      'template_name', template_details.template_name,
      'quarter', quarter_code,
      'enabled_by', enabled_by_id,
      'manager_name', manager_details.name,
      'due_date', quarter_due_date
    )
  ) INTO notification_id;
  
  IF notification_id IS NOT NULL THEN
    RAISE NOTICE 'KRA Quarter Enabled notification created: % for employee %', notification_id, employee_details.name;
  ELSE
    RAISE WARNING 'Failed to create KRA quarter enabled notification for employee %', employee_details.name;
  END IF;
  
  -- 🆕 NEW: Also queue email notification
  BEGIN
    PERFORM queue_kra_quarter_enabled_email(
      p_assignment_id := NEW.id,
      p_employee_id := NEW.employee_id,
      p_manager_id := enabled_by_id,
      p_quarter := quarter_code
    );
    RAISE NOTICE 'KRA Quarter Enabled email queued for employee %', employee_details.name;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to queue KRA quarter enabled email for employee %: %', employee_details.name, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helpful comments
COMMENT ON FUNCTION get_user_details(uuid) IS 'Gets user details for notifications - ONLY ACTIVE USERS';
COMMENT ON FUNCTION get_hr_admin_users() IS 'Gets HR and Admin users for notifications - ONLY ACTIVE USERS';
COMMENT ON FUNCTION queue_kra_submission_email(uuid, uuid, uuid, text) IS 'Queues email notification when KRA is submitted by employee';
COMMENT ON FUNCTION queue_kra_evaluation_email(uuid, uuid, uuid, text) IS 'Queues email notification when KRA is evaluated by manager';
COMMENT ON FUNCTION queue_kra_quarter_enabled_email(uuid, uuid, uuid, text) IS 'Queues email notification when KRA quarter is enabled';
COMMENT ON FUNCTION queue_kra_reassignment_email(uuid, uuid, uuid) IS 'Queues email notification when KRA is reassigned';

-- Add trigger to detect KRA reassignments (when status is reset to 'assigned')
CREATE OR REPLACE FUNCTION notify_kra_reassignment()
RETURNS TRIGGER AS $$
DECLARE
  employee_details RECORD;
  manager_details RECORD;
  template_details RECORD;
  notification_id uuid;
BEGIN
  -- Only trigger on reassignment (when status changes back to 'assigned' and assigned_by changes)
  IF OLD.status != 'assigned' AND NEW.status = 'assigned' AND OLD.assigned_by != NEW.assigned_by THEN
    
    -- Get employee details with NULL check
    SELECT * INTO employee_details FROM get_user_details(NEW.employee_id);
    
    IF employee_details.id IS NULL THEN
      RAISE WARNING 'KRA Reassignment: Employee % not found or inactive', NEW.employee_id;
      RETURN NEW;
    END IF;
    
    -- Get manager details with NULL check
    SELECT * INTO manager_details FROM get_user_details(NEW.assigned_by);
    
    IF manager_details.id IS NULL THEN
      RAISE WARNING 'KRA Reassignment: Manager % not found or inactive', NEW.assigned_by;
      RETURN NEW;
    END IF;
    
    -- Get template details
    SELECT template_name, evaluation_period_start, evaluation_period_end
    INTO template_details
    FROM kra_templates
    WHERE id = NEW.template_id;
    
    IF template_details.template_name IS NULL THEN
      RAISE WARNING 'KRA Reassignment: Template % not found', NEW.template_id;
      RETURN NEW;
    END IF;
    
    -- Send notification to employee (in-app notification)
    SELECT create_notification(
      p_user_id := NEW.employee_id,
      p_title := 'KRA Reassignment',
      p_message := format(
        'Your KRA "%s" has been reassigned by %s. Please review the updated details.',
        template_details.template_name,
        manager_details.name
      ),
      p_type := 'kra_assignment',  -- Reuse existing type
      p_data := jsonb_build_object(
        'assignment_id', NEW.id,
        'template_id', NEW.template_id,
        'template_name', template_details.template_name,
        'assigned_by', NEW.assigned_by,
        'manager_name', manager_details.name,
        'reassignment', true,
        'evaluation_period_start', template_details.evaluation_period_start,
        'evaluation_period_end', template_details.evaluation_period_end
      )
    ) INTO notification_id;
    
    IF notification_id IS NOT NULL THEN
      RAISE NOTICE 'KRA Reassignment notification created: % for employee %', notification_id, employee_details.name;
    ELSE
      RAISE WARNING 'Failed to create KRA reassignment notification for employee %', employee_details.name;
    END IF;
    
    -- 🆕 NEW: Also queue email notification
    BEGIN
      PERFORM queue_kra_reassignment_email(
        p_assignment_id := NEW.id,
        p_employee_id := NEW.employee_id,
        p_manager_id := NEW.assigned_by
      );
      RAISE NOTICE 'KRA Reassignment email queued for employee %', employee_details.name;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to queue KRA reassignment email for employee %: %', employee_details.name, SQLERRM;
    END;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RECREATE ALL KRA TRIGGERS WITH EMAIL SUPPORT
-- =====================================================
-- 
-- CRITICAL: The original triggers were pointing to the old functions that only sent in-app notifications.
-- We need to recreate all triggers to ensure they use our updated functions that send BOTH 
-- in-app notifications AND emails for complete coverage.
--
-- Recreate all KRA triggers to ensure they use the updated functions with email support
DROP TRIGGER IF EXISTS trigger_notify_kra_assignment ON kra_assignments;
CREATE TRIGGER trigger_notify_kra_assignment
  AFTER INSERT ON kra_assignments
  FOR EACH ROW
  EXECUTE FUNCTION notify_kra_assignment();

DROP TRIGGER IF EXISTS trigger_notify_kra_quarter_enabled ON kra_assignments;
CREATE TRIGGER trigger_notify_kra_quarter_enabled
  AFTER UPDATE ON kra_assignments
  FOR EACH ROW
  WHEN (
    (OLD.q1_enabled IS DISTINCT FROM NEW.q1_enabled AND NEW.q1_enabled = true) OR
    (OLD.q2_enabled IS DISTINCT FROM NEW.q2_enabled AND NEW.q2_enabled = true) OR
    (OLD.q3_enabled IS DISTINCT FROM NEW.q3_enabled AND NEW.q3_enabled = true) OR
    (OLD.q4_enabled IS DISTINCT FROM NEW.q4_enabled AND NEW.q4_enabled = true)
  )
  EXECUTE FUNCTION notify_kra_quarter_enabled();

DROP TRIGGER IF EXISTS trigger_notify_kra_submitted ON kra_evaluations;
CREATE TRIGGER trigger_notify_kra_submitted
  AFTER UPDATE ON kra_evaluations
  FOR EACH ROW
  WHEN (OLD.employee_submitted_at IS NULL AND NEW.employee_submitted_at IS NOT NULL)
  EXECUTE FUNCTION notify_kra_submitted();

DROP TRIGGER IF EXISTS trigger_notify_kra_evaluated ON kra_evaluations;
CREATE TRIGGER trigger_notify_kra_evaluated
  AFTER UPDATE ON kra_evaluations
  FOR EACH ROW
  WHEN (OLD.manager_evaluated_at IS NULL AND NEW.manager_evaluated_at IS NOT NULL)
  EXECUTE FUNCTION notify_kra_evaluated();

-- Create trigger for KRA reassignment notifications
DROP TRIGGER IF EXISTS trigger_notify_kra_reassignment ON kra_assignments;
CREATE TRIGGER trigger_notify_kra_reassignment
  AFTER UPDATE ON kra_assignments
  FOR EACH ROW
  EXECUTE FUNCTION notify_kra_reassignment();

SELECT 'KRA notification issues fixed successfully! ✅' as status,
       'In-app notifications now filter by active users and have proper error handling' as details,
       'Added email notifications for KRA reassignments and quarter enablement' as additional_features,
       'CRITICAL FIX: Recreated ALL KRA triggers to ensure complete email coverage' as trigger_fixes,
       'CRITICAL FIX: Fixed hardcoded static emails to use centralized get_static_cc_emails function' as email_queue_fix,
       '✅ ALL 5 KRA notification types now send both in-app AND email notifications' as complete_coverage;
