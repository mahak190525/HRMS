-- Fix KRA Reassignment Trigger Condition
-- The current trigger only fires when OLD.status != 'assigned', but in reassignment scenarios,
-- the status might already be 'assigned'. We need to detect when assigned_by changes.

-- Update the reassignment trigger to properly detect reassignments
DROP TRIGGER IF EXISTS trigger_notify_kra_reassignment ON kra_assignments;

-- Create improved trigger that detects reassignments based on assigned_by changes
CREATE TRIGGER trigger_notify_kra_reassignment
  AFTER UPDATE ON kra_assignments
  FOR EACH ROW
  WHEN (
    -- Detect reassignment: assigned_by has changed (regardless of status)
    OLD.assigned_by IS DISTINCT FROM NEW.assigned_by
    -- AND ensure it's not the initial assignment (OLD.assigned_by should not be null)
    AND OLD.assigned_by IS NOT NULL
  )
  EXECUTE FUNCTION notify_kra_reassignment();

-- Update the reassignment notification function to handle all reassignment scenarios
CREATE OR REPLACE FUNCTION notify_kra_reassignment()
RETURNS TRIGGER AS $$
DECLARE
  employee_details RECORD;
  manager_details RECORD;
  old_manager_details RECORD;
  template_details RECORD;
  notification_id uuid;
BEGIN
  -- This function now triggers when assigned_by changes (indicating reassignment)
  
  -- Get employee details with NULL check
  SELECT * INTO employee_details FROM get_user_details(NEW.employee_id);
  
  IF employee_details.id IS NULL THEN
    RAISE WARNING 'KRA Reassignment: Employee % not found or inactive', NEW.employee_id;
    RETURN NEW;
  END IF;
  
  -- Get new manager details with NULL check
  SELECT * INTO manager_details FROM get_user_details(NEW.assigned_by);
  
  IF manager_details.id IS NULL THEN
    RAISE WARNING 'KRA Reassignment: New Manager % not found or inactive', NEW.assigned_by;
    RETURN NEW;
  END IF;
  
  -- Get old manager details for context
  SELECT * INTO old_manager_details FROM get_user_details(OLD.assigned_by);
  
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
      'Your KRA "%s" has been reassigned from %s to %s. Please review the updated details.',
      template_details.template_name,
      COALESCE(old_manager_details.name, 'Previous Manager'),
      manager_details.name
    ),
    p_type := 'kra_assignment',  -- Reuse existing type
    p_data := jsonb_build_object(
      'assignment_id', NEW.id,
      'template_id', NEW.template_id,
      'template_name', template_details.template_name,
      'assigned_by', NEW.assigned_by,
      'manager_name', manager_details.name,
      'old_manager_name', COALESCE(old_manager_details.name, 'Previous Manager'),
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
  
  -- Queue email notification for reassignment
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
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helpful comment
COMMENT ON TRIGGER trigger_notify_kra_reassignment ON kra_assignments IS 
'Triggers reassignment notifications when assigned_by changes (indicating KRA reassignment)';

COMMENT ON FUNCTION notify_kra_reassignment() IS 
'Sends in-app notifications and queues emails when KRA is reassigned to a different manager';

SELECT 'KRA reassignment trigger fixed successfully! ✅' as status,
       'Trigger now properly detects reassignments based on assigned_by changes' as details;
