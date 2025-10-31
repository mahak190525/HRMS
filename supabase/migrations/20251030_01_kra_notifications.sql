/*
  # KRA Notifications System

  This migration implements notifications for the KRA workflow:
  1. When a KRA has been assigned/enabled (for individual quarters) - notify employee
  2. When a KRA has been submitted by employee - notify manager
  3. When a KRA has been evaluated by manager - notify employee, HR, and Admin

  ## Implementation Details

  ### Notification Types
  - kra_assignment: When KRA is initially assigned to employee
  - kra_quarter_enabled: When a specific quarter is enabled for an employee
  - kra_submitted: When employee submits KRA for a quarter
  - kra_evaluated: When manager evaluates KRA for a quarter

  ### Database Functions
  - notify_kra_assignment(): Notifies employee when KRA is assigned
  - notify_kra_quarter_enabled(): Notifies employee when quarter is enabled
  - notify_kra_submitted(): Notifies manager when employee submits
  - notify_kra_evaluated(): Notifies employee, HR, and Admin when evaluated

  ### Triggers
  - On kra_assignments INSERT: Send assignment notification
  - On kra_assignments UPDATE: Send quarter enabled notifications
  - On kra_evaluations UPDATE: Send submission and evaluation notifications
*/

-- First, add KRA notification types to the constraint
DO $$
DECLARE
  existing_types TEXT[];
  all_types TEXT[];
BEGIN
  -- Get all existing notification types from the database
  SELECT ARRAY_AGG(DISTINCT type) INTO existing_types
  FROM notifications
  WHERE type IS NOT NULL;
  
  -- Define our complete list of allowed types (existing + new KRA types)
  all_types := ARRAY[
    'general', 'leave_request', 'leave_approved', 'leave_rejected', 'leave_cancelled',
    'asset_request_submitted', 'asset_request_approved', 'asset_request_rejected', 'asset_request_fulfilled',
    'asset_assignment_notification', 'asset_retrieval_notification',
    'print_blocking_violation', 'print_blocking_warning',
    'kra_assignment', 'kra_quarter_enabled', 'kra_submitted', 'kra_evaluated'
  ];
  
  -- Add any existing types that aren't in our predefined list
  IF existing_types IS NOT NULL THEN
    FOR i IN 1..array_length(existing_types, 1) LOOP
      IF NOT (existing_types[i] = ANY(all_types)) THEN
        all_types := array_append(all_types, existing_types[i]);
      END IF;
    END LOOP;
  END IF;
  
  -- Check if the constraint exists and update it
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'notifications_type_check' 
    AND table_name = 'notifications'
    AND table_schema = 'public'
  ) THEN
    -- Drop the existing constraint
    ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
  END IF;
  
  -- Add the new constraint with all notification types (existing + KRA types)
  EXECUTE format('ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (%s))',
    array_to_string(
      ARRAY(SELECT '''' || unnest(all_types) || ''''), 
      ', '
    )
  );
END $$;

-- Function to get user details for notifications
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
  WHERE u.id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get HR and Admin users
CREATE OR REPLACE FUNCTION get_hr_admin_users()
RETURNS TABLE(user_id uuid) AS $$
BEGIN
  RETURN QUERY
  SELECT u.id
  FROM users u
  LEFT JOIN roles r ON u.role_id = r.id
  WHERE r.name IN ('hr', 'hrm', 'admin', 'super_admin') OR u."isSA" = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to notify employee when KRA is assigned
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
  
  -- Send notification to employee
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
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to notify employee when a quarter is enabled
CREATE OR REPLACE FUNCTION notify_kra_quarter_enabled()
RETURNS TRIGGER AS $$
DECLARE
  employee_details RECORD;
  manager_details RECORD;
  template_details RECORD;
  quarter_name TEXT;
  quarter_due_date DATE;
BEGIN
  -- Get employee details
  SELECT * INTO employee_details FROM get_user_details(NEW.employee_id);
  
  -- Get manager details (who enabled the quarter)
  SELECT * INTO manager_details FROM get_user_details(
    COALESCE(NEW.q1_enabled_by, NEW.q2_enabled_by, NEW.q3_enabled_by, NEW.q4_enabled_by)
  );
  
  -- Get template details
  SELECT template_name
  INTO template_details
  FROM kra_templates
  WHERE id = NEW.template_id;
  
  -- Check which quarter was enabled and send notification
  IF OLD.q1_enabled = false AND NEW.q1_enabled = true THEN
    quarter_name := 'Quarter 1 (Q1)';
    quarter_due_date := NEW.q1_due_date;
  ELSIF OLD.q2_enabled = false AND NEW.q2_enabled = true THEN
    quarter_name := 'Quarter 2 (Q2)';
    quarter_due_date := NEW.q2_due_date;
  ELSIF OLD.q3_enabled = false AND NEW.q3_enabled = true THEN
    quarter_name := 'Quarter 3 (Q3)';
    quarter_due_date := NEW.q3_due_date;
  ELSIF OLD.q4_enabled = false AND NEW.q4_enabled = true THEN
    quarter_name := 'Quarter 4 (Q4)';
    quarter_due_date := NEW.q4_due_date;
  ELSE
    -- No quarter was newly enabled, return
    RETURN NEW;
  END IF;
  
  -- Send notification to employee
  PERFORM create_notification(
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
      'quarter', CASE 
        WHEN OLD.q1_enabled = false AND NEW.q1_enabled = true THEN 'Q1'
        WHEN OLD.q2_enabled = false AND NEW.q2_enabled = true THEN 'Q2'
        WHEN OLD.q3_enabled = false AND NEW.q3_enabled = true THEN 'Q3'
        WHEN OLD.q4_enabled = false AND NEW.q4_enabled = true THEN 'Q4'
      END,
      'enabled_by', COALESCE(NEW.q1_enabled_by, NEW.q2_enabled_by, NEW.q3_enabled_by, NEW.q4_enabled_by),
      'manager_name', manager_details.name,
      'due_date', quarter_due_date
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to notify manager when employee submits KRA
CREATE OR REPLACE FUNCTION notify_kra_submitted()
RETURNS TRIGGER AS $$
DECLARE
  employee_details RECORD;
  manager_details RECORD;
  template_details RECORD;
  assignment_details RECORD;
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
  
  -- Send notification to manager
  PERFORM create_notification(
    p_user_id := assignment_details.assigned_by,
    p_title := format('KRA %s Submitted for Review', quarter_name),
    p_message := format(
      '%s has submitted their KRA evidence for %s of "%s". Please review and evaluate their submission.',
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
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to notify employee, HR, and Admin when KRA is evaluated
CREATE OR REPLACE FUNCTION notify_kra_evaluated()
RETURNS TRIGGER AS $$
DECLARE
  employee_details RECORD;
  manager_details RECORD;
  template_details RECORD;
  assignment_details RECORD;
  quarter_name TEXT;
  hr_admin_user RECORD;
  total_goals INTEGER;
  evaluated_goals INTEGER;
  all_goals_evaluated BOOLEAN := FALSE;
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
  
  -- Send notification to employee
  PERFORM create_notification(
    p_user_id := assignment_details.employee_id,
    p_title := format('KRA %s Evaluation Complete', quarter_name),
    p_message := format(
      'Your KRA submission for %s of "%s" has been evaluated by %s. You can now view your results and feedback.',
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
  
  -- Send notifications to HR and Admin users
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
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers

-- Trigger for KRA assignment notifications
DROP TRIGGER IF EXISTS trigger_notify_kra_assignment ON kra_assignments;
CREATE TRIGGER trigger_notify_kra_assignment
  AFTER INSERT ON kra_assignments
  FOR EACH ROW
  EXECUTE FUNCTION notify_kra_assignment();

-- Trigger for KRA quarter enabled notifications
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

-- Trigger for KRA submission notifications
DROP TRIGGER IF EXISTS trigger_notify_kra_submitted ON kra_evaluations;
CREATE TRIGGER trigger_notify_kra_submitted
  AFTER UPDATE ON kra_evaluations
  FOR EACH ROW
  WHEN (OLD.employee_submitted_at IS NULL AND NEW.employee_submitted_at IS NOT NULL)
  EXECUTE FUNCTION notify_kra_submitted();

-- Trigger for KRA evaluation notifications
DROP TRIGGER IF EXISTS trigger_notify_kra_evaluated ON kra_evaluations;
CREATE TRIGGER trigger_notify_kra_evaluated
  AFTER UPDATE ON kra_evaluations
  FOR EACH ROW
  WHEN (OLD.manager_evaluated_at IS NULL AND NEW.manager_evaluated_at IS NOT NULL)
  EXECUTE FUNCTION notify_kra_evaluated();

-- Add helpful comments
COMMENT ON FUNCTION notify_kra_assignment() IS 'Sends notification to employee when KRA is assigned';
COMMENT ON FUNCTION notify_kra_quarter_enabled() IS 'Sends notification to employee when a quarter is enabled for evidence submission';
COMMENT ON FUNCTION notify_kra_submitted() IS 'Sends notification to manager when employee submits KRA evidence';
COMMENT ON FUNCTION notify_kra_evaluated() IS 'Sends notifications to employee, HR, and Admin when KRA is evaluated by manager';

COMMENT ON TRIGGER trigger_notify_kra_assignment ON kra_assignments IS 'Triggers KRA assignment notification when new assignment is created';
COMMENT ON TRIGGER trigger_notify_kra_quarter_enabled ON kra_assignments IS 'Triggers quarter enabled notification when quarters are enabled';
COMMENT ON TRIGGER trigger_notify_kra_submitted ON kra_evaluations IS 'Triggers submission notification when employee submits evidence';
COMMENT ON TRIGGER trigger_notify_kra_evaluated ON kra_evaluations IS 'Triggers evaluation notification when manager completes evaluation';
