/*
  # Fix KRA Email Notifications
  
  This migration fixes the critical issue where KRA notifications were only being created
  as in-app notifications but never converted to emails.
  
  ## Problem
  - KRA notification functions only call create_notification()
  - They never call the email queue functions
  - Users receive in-app notifications but no emails
  
  ## Solution
  - Update all KRA notification functions to also queue emails
  - Follow the same pattern as leave management and policy management
  - Ensure proper recipient handling (employee, manager, HR, admin)
*/

-- Update the KRA assignment notification function to also send emails
CREATE OR REPLACE FUNCTION notify_kra_assignment()
RETURNS TRIGGER AS $$
DECLARE
  employee_details RECORD;
  manager_details RECORD;
  template_details RECORD;
BEGIN
  -- Get employee details
  SELECT * INTO employee_details FROM get_user_details(NEW.employee_id);
  
  -- Get manager details
  SELECT * INTO manager_details FROM get_user_details(NEW.assigned_by);
  
  -- Get template details
  SELECT template_name, evaluation_period_start, evaluation_period_end
  INTO template_details
  FROM kra_templates
  WHERE id = NEW.template_id;
  
  -- Send notification to employee (in-app notification)
  PERFORM create_notification(
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
  );
  
  -- 🆕 NEW: Also queue email notification
  PERFORM queue_kra_assignment_email(
    p_kra_id := NEW.id,
    p_employee_id := NEW.employee_id,
    p_manager_id := NEW.assigned_by
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to queue KRA submission emails
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
  WHERE emp.id = p_employee_id;

  -- Get manager recipient data
  manager_data := jsonb_build_object(
    'email', email_data->>'manager_email',
    'name', email_data->>'manager_name'
  );

  -- Prepare recipients using centralized static emails
  recipients_data := jsonb_build_object(
    'to', jsonb_build_array(manager_data),
    'cc_static', get_static_cc_emails('performance'),
    'cc_dynamic', jsonb_build_array('hr')
  );

  -- Queue the email
  email_id := queue_email(
    'performance_management'::module_type_enum,
    p_assignment_id,
    'kra_submitted'::email_type_enum,
    recipients_data,
    email_data,
    'KRA Submission - Review Required',
    'normal'::email_priority_enum
  );

  RETURN email_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to queue KRA evaluation emails
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
  WHERE emp.id = p_employee_id;

  -- Get employee recipient data
  employee_data := jsonb_build_object(
    'email', email_data->>'employee_email',
    'name', email_data->>'employee_name'
  );

  -- Prepare recipients using centralized static emails
  recipients_data := jsonb_build_object(
    'to', jsonb_build_array(employee_data),
    'cc_static', get_static_cc_emails('performance'),
    'cc_dynamic', jsonb_build_array('manager', 'hr')
  );

  -- Queue the email
  email_id := queue_email(
    'performance_management'::module_type_enum,
    p_assignment_id,
    'kra_approved'::email_type_enum,  -- Using kra_approved for evaluation completion
    recipients_data,
    email_data,
    'KRA Evaluation Completed',
    'normal'::email_priority_enum
  );

  RETURN email_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the KRA submission notification function to also send emails
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
  
  -- Get employee details
  SELECT * INTO employee_details FROM get_user_details(assignment_details.employee_id);
  
  -- Get manager details
  SELECT * INTO manager_details FROM get_user_details(assignment_details.assigned_by);
  
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
  PERFORM create_notification(
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
  );
  
  -- 🆕 NEW: Also queue email notification
  PERFORM queue_kra_submission_email(
    p_assignment_id := NEW.assignment_id,
    p_employee_id := assignment_details.employee_id,
    p_manager_id := assignment_details.assigned_by,
    p_quarter := NEW.quarter
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the KRA evaluation notification function to also send emails
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
  
  -- Get employee details
  SELECT * INTO employee_details FROM get_user_details(assignment_details.employee_id);
  
  -- Get manager details
  SELECT * INTO manager_details FROM get_user_details(NEW.manager_evaluated_by);
  
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
  PERFORM create_notification(
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
  );
  
  -- Send notifications to HR and Admin users (in-app notifications)
  FOR hr_admin_user IN SELECT user_id FROM get_hr_admin_users() LOOP
    -- Skip if it's the same as employee or manager
    IF hr_admin_user.user_id != assignment_details.employee_id AND hr_admin_user.user_id != NEW.manager_evaluated_by THEN
      PERFORM create_notification(
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
      );
    END IF;
  END LOOP;
  
  -- 🆕 NEW: Also queue email notification
  PERFORM queue_kra_evaluation_email(
    p_assignment_id := NEW.assignment_id,
    p_employee_id := assignment_details.employee_id,
    p_manager_id := NEW.manager_evaluated_by,
    p_quarter := NEW.quarter
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions for the new email queue functions
GRANT EXECUTE ON FUNCTION queue_kra_submission_email(uuid, uuid, uuid, text) TO postgres, service_role, authenticated;
GRANT EXECUTE ON FUNCTION queue_kra_evaluation_email(uuid, uuid, uuid, text) TO postgres, service_role, authenticated;

-- Add helpful comments
COMMENT ON FUNCTION queue_kra_submission_email(uuid, uuid, uuid, text) IS 'Queues email notification when KRA is submitted by employee';
COMMENT ON FUNCTION queue_kra_evaluation_email(uuid, uuid, uuid, text) IS 'Queues email notification when KRA is evaluated by manager';

SELECT 'KRA email notifications fix applied successfully! ✅' as status,
       'KRA notifications will now send both in-app notifications AND emails' as details;
