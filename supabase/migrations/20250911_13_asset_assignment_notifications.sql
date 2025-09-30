/*
  # Asset Assignment Notifications

  1. Functions
    - Function to send asset assignment notifications to users
    - Function to send asset unassignment notifications to users
    - Function to handle VM assignment notifications

  2. Triggers
    - Trigger on asset_assignments for new assignments
    - Trigger on asset_assignments for return/unassignment

  3. Updates
    - Add asset assignment notification types to check constraint
*/

-- First, add the new notification types if they don't exist
DO $$
BEGIN
  -- Try to get the current check constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name LIKE '%notifications_type_check%'
  ) THEN
    -- Drop and recreate with new types
    ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
  END IF;
  
  -- Add constraint with asset assignment types
  ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type IN (
    'general',
    'leave_request_submitted',
    'leave_request_approved',
    'leave_request_rejected',
    'leave_request_withdrawn',
    'complaint_submitted',
    'complaint_assigned',
    'complaint_resolved',
    'performance_goal_assigned',
    'interview_scheduled',
    'assessment_assigned',
    'exit_process_initiated',
    'document_approved',
    'document_rejected',
    'project_assigned',
    'project_unassigned',
    'project_role_updated',
    'project_deleted',
    'asset_request_submitted',
    'asset_request_approved',
    'asset_request_rejected',
    'asset_request_fulfilled',
    'asset_assigned',
    'asset_unassigned',
    'vm_assigned',
    'vm_unassigned'
));
END $$;

-- Function to send asset assignment notification to the assigned user
CREATE OR REPLACE FUNCTION notify_asset_assigned()
RETURNS trigger AS $$
DECLARE
  asset_name text;
  asset_tag text;
  asset_category text;
  assigned_by_name text;
  assignment_type_display text;
  vm_details text;
  notification_title text;
  notification_message text;
  notification_type text;
BEGIN
  -- Only process if it's a new assignment (is_active = true)
  IF NEW.is_active = false THEN
    RETURN NEW;
  END IF;

  -- Get assigned by user name
  SELECT full_name INTO assigned_by_name
  FROM users WHERE id = NEW.assigned_by;

  -- Determine if this is a VM assignment or regular asset assignment
  IF NEW.vm_id IS NOT NULL THEN
    -- VM Assignment
    SELECT 
      CONCAT('VM-', vm.vm_number, ' (', vm.project_name, ')'),
      vm.purpose || ' - ' || vm.project_name
    INTO asset_name, vm_details
    FROM virtual_machines vm
    WHERE vm.id = NEW.vm_id;
    
    asset_tag := 'VM-' || (SELECT vm_number FROM virtual_machines WHERE id = NEW.vm_id);
    asset_category := 'Virtual Machine';
    notification_type := 'vm_assigned';
    notification_title := 'Virtual Machine Assigned';
    notification_message := 'You have been assigned ' || asset_name || ' by ' || COALESCE(assigned_by_name, 'an administrator') || 
      '. VM Purpose: ' || vm_details || 
      CASE 
        WHEN NEW.assignment_type = 'temporary' AND NEW.assignment_expiry_date IS NOT NULL 
        THEN '. This is a temporary assignment until ' || TO_CHAR(NEW.assignment_expiry_date, 'Mon DD, YYYY') || '.'
        ELSE '. This is a permanent assignment.'
      END;
  ELSE
    -- Regular Asset Assignment
    SELECT a.name, a.asset_tag, ac.name
    INTO asset_name, asset_tag, asset_category
    FROM assets a
    LEFT JOIN asset_categories ac ON a.category_id = ac.id
    WHERE a.id = NEW.asset_id;
    
    notification_type := 'asset_assigned';
    notification_title := 'Asset Assigned';
    notification_message := 'You have been assigned ' || COALESCE(asset_name, 'an asset') || 
      ' (' || COALESCE(asset_tag, 'No tag') || ') by ' || COALESCE(assigned_by_name, 'an administrator') ||
      CASE 
        WHEN NEW.assignment_type = 'temporary' AND NEW.assignment_expiry_date IS NOT NULL 
        THEN '. This is a temporary assignment until ' || TO_CHAR(NEW.assignment_expiry_date, 'Mon DD, YYYY') || '.'
        ELSE '. This is a permanent assignment.'
      END;
  END IF;

  -- Send notification to the assigned user
  PERFORM create_notification(
    NEW.user_id,
    notification_title,
    notification_message,
    notification_type,
    jsonb_build_object(
      'assignment_id', NEW.id,
      'asset_id', NEW.asset_id,
      'vm_id', NEW.vm_id,
      'asset_name', asset_name,
      'asset_tag', asset_tag,
      'asset_category', asset_category,
      'assigned_by', NEW.assigned_by,
      'assigned_by_name', assigned_by_name,
      'assignment_type', NEW.assignment_type,
      'assignment_expiry_date', NEW.assignment_expiry_date,
      'assigned_date', NEW.assigned_date,
      'target', 'dashboard/assets'
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to send asset unassignment notification to the user
CREATE OR REPLACE FUNCTION notify_asset_unassigned()
RETURNS trigger AS $$
DECLARE
  asset_name text;
  asset_tag text;
  asset_category text;
  return_by_name text;
  vm_details text;
  notification_title text;
  notification_message text;
  notification_type text;
BEGIN
  -- Only process if assignment becomes inactive (is_active changed from true to false)
  IF OLD.is_active = false OR NEW.is_active = true THEN
    RETURN NEW;
  END IF;

  -- Get return by user name (use current user if no specific user)
  SELECT full_name INTO return_by_name
  FROM users WHERE id = auth.uid();

  -- Determine if this was a VM assignment or regular asset assignment
  IF OLD.vm_id IS NOT NULL THEN
    -- VM Unassignment
    SELECT 
      CONCAT('VM-', vm.vm_number, ' (', vm.project_name, ')'),
      vm.purpose || ' - ' || vm.project_name
    INTO asset_name, vm_details
    FROM virtual_machines vm
    WHERE vm.id = OLD.vm_id;
    
    asset_tag := 'VM-' || (SELECT vm_number FROM virtual_machines WHERE id = OLD.vm_id);
    asset_category := 'Virtual Machine';
    notification_type := 'vm_unassigned';
    notification_title := 'Virtual Machine Returned';
    notification_message := 'Your assignment for ' || asset_name || ' has been completed and the VM has been returned' ||
      CASE 
        WHEN NEW.return_condition IS NOT NULL 
        THEN ' in ' || NEW.return_condition || ' condition'
        ELSE ''
      END || '.';
  ELSE
    -- Regular Asset Unassignment
    SELECT a.name, a.asset_tag, ac.name
    INTO asset_name, asset_tag, asset_category
    FROM assets a
    LEFT JOIN asset_categories ac ON a.category_id = ac.id
    WHERE a.id = OLD.asset_id;
    
    notification_type := 'asset_unassigned';
    notification_title := 'Asset Returned';
    notification_message := 'Your assignment for ' || COALESCE(asset_name, 'an asset') || 
      ' (' || COALESCE(asset_tag, 'No tag') || ') has been completed and the asset has been returned' ||
      CASE 
        WHEN NEW.return_condition IS NOT NULL 
        THEN ' in ' || NEW.return_condition || ' condition'
        ELSE ''
      END || '.';
  END IF;

  -- Send notification to the user who had the assignment
  PERFORM create_notification(
    OLD.user_id,
    notification_title,
    notification_message,
    notification_type,
    jsonb_build_object(
      'assignment_id', OLD.id,
      'asset_id', OLD.asset_id,
      'vm_id', OLD.vm_id,
      'asset_name', asset_name,
      'asset_tag', asset_tag,
      'asset_category', asset_category,
      'return_date', NEW.return_date,
      'return_condition', NEW.return_condition,
      'assignment_duration_days', CASE 
        WHEN NEW.return_date IS NOT NULL AND OLD.assigned_date IS NOT NULL 
        THEN (NEW.return_date - OLD.assigned_date)
        ELSE NULL
      END,
      'target', 'dashboard/assets'
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for asset assignment notifications
DROP TRIGGER IF EXISTS trigger_asset_assigned ON asset_assignments;
CREATE TRIGGER trigger_asset_assigned
  AFTER INSERT ON asset_assignments
  FOR EACH ROW
  EXECUTE FUNCTION notify_asset_assigned();

DROP TRIGGER IF EXISTS trigger_asset_unassigned ON asset_assignments;
CREATE TRIGGER trigger_asset_unassigned
  AFTER UPDATE ON asset_assignments
  FOR EACH ROW
  EXECUTE FUNCTION notify_asset_unassigned();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION notify_asset_assigned() TO authenticated;
GRANT EXECUTE ON FUNCTION notify_asset_unassigned() TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION notify_asset_assigned() IS 'Sends notification to user when an asset or VM is assigned to them';
COMMENT ON FUNCTION notify_asset_unassigned() IS 'Sends notification to user when their asset or VM assignment is completed/returned';
COMMENT ON TRIGGER trigger_asset_assigned ON asset_assignments IS 'Automatically sends assignment notification when asset is assigned';
COMMENT ON TRIGGER trigger_asset_unassigned ON asset_assignments IS 'Automatically sends unassignment notification when asset is returned';
