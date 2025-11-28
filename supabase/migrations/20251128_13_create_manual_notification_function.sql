/*
  # Create Manual KRA Evaluation Notification Function
  
  This creates a simple function that can be called from the frontend
  to send evaluation notifications manually, eliminating duplicate notifications.
*/

-- First, drop the existing trigger that causes duplicates
DROP TRIGGER IF EXISTS trigger_notify_kra_evaluated ON kra_evaluations;

-- Create the manual notification function
CREATE OR REPLACE FUNCTION send_kra_evaluation_notifications(
  p_assignment_id UUID,
  p_quarter TEXT,
  p_manager_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  employee_details RECORD;
  manager_details RECORD;
  template_details RECORD;
  assignment_details RECORD;
  quarter_name TEXT;
  hr_admin_user RECORD;
  notification_sent_key TEXT;
  notification_already_sent BOOLEAN := FALSE;
BEGIN
  RAISE NOTICE 'Manual KRA evaluation notification called for assignment % quarter %', p_assignment_id, p_quarter;

  -- Get assignment details
  SELECT employee_id, assigned_by, template_id
  INTO assignment_details
  FROM kra_assignments
  WHERE id = p_assignment_id;
  
  IF assignment_details.employee_id IS NULL THEN
    RAISE WARNING 'Assignment % not found', p_assignment_id;
    RETURN FALSE;
  END IF;

  -- Create a unique key to prevent duplicate notifications
  notification_sent_key := format('kra_eval_notif_%s_%s', p_assignment_id, p_quarter);
  
  -- Check if we already sent notifications for this quarter evaluation
  SELECT EXISTS(
    SELECT 1 FROM notifications 
    WHERE data->>'assignment_id' = p_assignment_id::text 
    AND data->>'quarter' = p_quarter 
    AND type = 'kra_evaluated'
    AND data->>'notification_batch_key' = notification_sent_key
  ) INTO notification_already_sent;
  
  IF notification_already_sent THEN
    RAISE NOTICE 'Notifications already sent for assignment % quarter %', p_assignment_id, p_quarter;
    RETURN TRUE;
  END IF;

  -- Get employee details
  SELECT id, full_name as name, email
  INTO employee_details
  FROM users
  WHERE id = assignment_details.employee_id AND status = 'active';
  
  IF employee_details.id IS NULL THEN
    RAISE WARNING 'Employee % not found or inactive', assignment_details.employee_id;
    RETURN FALSE;
  END IF;

  -- Get manager details
  SELECT id, full_name as name, email
  INTO manager_details
  FROM users
  WHERE id = p_manager_id AND status = 'active';
  
  IF manager_details.id IS NULL THEN
    RAISE WARNING 'Manager % not found or inactive', p_manager_id;
    RETURN FALSE;
  END IF;

  -- Get template details
  SELECT template_name
  INTO template_details
  FROM kra_templates
  WHERE id = assignment_details.template_id;

  -- Determine quarter name
  quarter_name := CASE p_quarter
    WHEN 'Q1' THEN 'Quarter 1 (Q1)'
    WHEN 'Q2' THEN 'Quarter 2 (Q2)'
    WHEN 'Q3' THEN 'Quarter 3 (Q3)'
    WHEN 'Q4' THEN 'Quarter 4 (Q4)'
    ELSE p_quarter
  END;

  RAISE NOTICE 'Sending notifications for % evaluation', quarter_name;

  -- 1. Send notification to EMPLOYEE
  PERFORM create_notification(
    p_user_id := assignment_details.employee_id,
    p_title := format('KRA %s Evaluation Completed', quarter_name),
    p_message := format(
      'Your manager %s has completed the evaluation for your KRA submission (%s of "%s").',
      manager_details.name,
      quarter_name,
      COALESCE(template_details.template_name, 'KRA Template')
    ),
    p_type := 'kra_evaluated',
    p_data := jsonb_build_object(
      'assignment_id', p_assignment_id,
      'template_id', assignment_details.template_id,
      'template_name', COALESCE(template_details.template_name, 'KRA Template'),
      'quarter', p_quarter,
      'evaluated_by', p_manager_id,
      'manager_name', manager_details.name,
      'evaluated_at', NOW(),
      'notification_batch_key', notification_sent_key
    )
  );

  -- 2. Send notification to MANAGER (confirmation)
  PERFORM create_notification(
    p_user_id := p_manager_id,
    p_title := format('KRA %s Evaluation Completed', quarter_name),
    p_message := format(
      'You have successfully completed the evaluation for %s''s KRA submission (%s of "%s").',
      employee_details.name,
      quarter_name,
      COALESCE(template_details.template_name, 'KRA Template')
    ),
    p_type := 'kra_evaluated',
    p_data := jsonb_build_object(
      'assignment_id', p_assignment_id,
      'template_id', assignment_details.template_id,
      'template_name', COALESCE(template_details.template_name, 'KRA Template'),
      'quarter', p_quarter,
      'employee_id', assignment_details.employee_id,
      'employee_name', employee_details.name,
      'evaluated_at', NOW(),
      'notification_batch_key', notification_sent_key
    )
  );

  -- 3. Send notifications to HR and ADMIN users
  FOR hr_admin_user IN 
    SELECT u.id, u.full_name as name, u.email
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE r.name IN ('HR', 'Admin', 'hr', 'admin', 'super_admin') 
    AND u.status = 'active'
  LOOP
    -- Skip if this user is already the employee or manager
    IF hr_admin_user.id != assignment_details.employee_id AND hr_admin_user.id != p_manager_id THEN
      PERFORM create_notification(
        p_user_id := hr_admin_user.id,
        p_title := format('KRA %s Evaluation Completed - Team Update', quarter_name),
        p_message := format(
          '%s has completed the evaluation for %s''s KRA submission (%s of "%s").',
          manager_details.name,
          employee_details.name,
          quarter_name,
          COALESCE(template_details.template_name, 'KRA Template')
        ),
        p_type := 'kra_evaluated',
        p_data := jsonb_build_object(
          'assignment_id', p_assignment_id,
          'template_id', assignment_details.template_id,
          'template_name', COALESCE(template_details.template_name, 'KRA Template'),
          'quarter', p_quarter,
          'employee_id', assignment_details.employee_id,
          'employee_name', employee_details.name,
          'evaluated_by', p_manager_id,
          'manager_name', manager_details.name,
          'evaluated_at', NOW(),
          'notification_batch_key', notification_sent_key
        )
      );
    END IF;
  END LOOP;

  RAISE NOTICE 'Evaluation notifications sent successfully for assignment % quarter %', p_assignment_id, p_quarter;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON FUNCTION send_kra_evaluation_notifications(UUID, TEXT, UUID) IS 'Manual function to send KRA evaluation notifications - eliminates duplicate notifications';

-- Log completion
SELECT 'Manual KRA notification function created! 🎯' as status;
