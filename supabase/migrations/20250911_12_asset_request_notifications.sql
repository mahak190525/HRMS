/*
  # Asset Request Notifications System

  1. Functions
    - Function to send asset request notifications to managers, HR, and admin
    - Function to send asset approval/rejection notifications
    - Function to get managers and HR/admin users for notification

  2. Triggers
    - Trigger on asset_requests for new requests
    - Trigger on asset_requests for status changes (approved/rejected)

  3. Updates
    - Add notification types to check constraint
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
  
  -- Add constraint with asset request types
  ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type IN (
    'general', 'leave_request_submitted', 'leave_request_approved', 'leave_request_rejected',
    'complaint_submitted', 'complaint_assigned', 'complaint_resolved',
    'asset_request_submitted', 'asset_request_approved', 'asset_request_rejected', 'asset_request_fulfilled', 
    'leave_request_withdrawn'
  ));
END $$;

-- Function to get users who should be notified for asset requests (managers, HR, admin)
CREATE OR REPLACE FUNCTION get_asset_request_notification_recipients(
  p_user_id uuid
) RETURNS TABLE(recipient_id uuid, recipient_role text, recipient_name text) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT 
    u.id as recipient_id,
    r.name as recipient_role,
    u.full_name as recipient_name
  FROM users u
  JOIN roles r ON u.role_id = r.id
  WHERE u.status = 'active'
    AND u.id != p_user_id
    AND (
      -- User's direct manager
      u.id = (SELECT manager_id FROM users WHERE id = p_user_id)
      OR
      -- HR and Admin roles
      r.name IN ('hr', 'admin', 'super_admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to send asset request submission notifications
CREATE OR REPLACE FUNCTION notify_asset_request_submitted()
RETURNS trigger AS $$
DECLARE
  recipient_record RECORD;
  employee_name text;
  category_name text;
BEGIN
  -- Get employee name
  SELECT full_name INTO employee_name
  FROM users WHERE id = NEW.user_id;
  
  -- Get category name
  SELECT name INTO category_name
  FROM asset_categories WHERE id = NEW.category_id;
  
  -- Send notifications to all relevant recipients
  FOR recipient_record IN
    SELECT * FROM get_asset_request_notification_recipients(NEW.user_id)
  LOOP
    -- Determine notification title and message based on recipient role
    IF recipient_record.recipient_role IN ('hr', 'admin', 'super_admin') THEN
      -- Notification for HR/Admin (informational)
      PERFORM create_notification(
        recipient_record.recipient_id,
        'New Asset Request Submitted',
        employee_name || ' has submitted a request for ' || category_name || ': ' || NEW.description,
        'asset_request_submitted',
        jsonb_build_object(
          'asset_request_id', NEW.id,
          'employee_id', NEW.user_id,
          'employee_name', employee_name,
          'category_name', category_name,
          'description', NEW.description,
          'priority', NEW.priority,
          'action', 'monitor',
          'target', 'employees/asset-management',
          'can_approve', CASE 
            WHEN recipient_record.recipient_role IN ('admin', 'super_admin') THEN true 
            ELSE false 
          END
        )
      );
    ELSE
      -- Notification for Manager (can approve)
      PERFORM create_notification(
        recipient_record.recipient_id,
        'Asset Request Requires Approval',
        employee_name || ' has submitted an asset request for ' || category_name || ' that requires your approval: ' || NEW.description,
        'asset_request_submitted',
        jsonb_build_object(
          'asset_request_id', NEW.id,
          'employee_id', NEW.user_id,
          'employee_name', employee_name,
          'category_name', category_name,
          'description', NEW.description,
          'priority', NEW.priority,
          'action', 'approve_or_reject',
          'target', 'employees/asset-management',
          'can_approve', true
        )
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to send asset request status change notifications
CREATE OR REPLACE FUNCTION notify_asset_request_status_change()
RETURNS trigger AS $$
DECLARE
  recipient_record RECORD;
  employee_name text;
  category_name text;
  approver_name text;
  rejector_name text;
  notification_title text;
  notification_message text;
  notification_type text;
BEGIN
  -- Only process if status has changed
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Get employee name
  SELECT full_name INTO employee_name
  FROM users WHERE id = NEW.user_id;
  
  -- Get category name
  SELECT name INTO category_name
  FROM asset_categories WHERE id = NEW.category_id;
  
  -- Handle different status changes
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    -- Get approver name
    SELECT full_name INTO approver_name
    FROM users WHERE id = NEW.approved_by;
    
    notification_type := 'asset_request_approved';
    notification_title := 'Asset Request Approved';
    notification_message := 'Your asset request for ' || category_name || ' has been approved by ' || COALESCE(approver_name, 'a manager') || '.';
    
    -- Notify the user who submitted the request
    PERFORM create_notification(
      NEW.user_id,
      notification_title,
      notification_message,
      notification_type,
      jsonb_build_object(
        'asset_request_id', NEW.id,
        'category_name', category_name,
        'description', NEW.description,
        'approved_by', NEW.approved_by,
        'approver_name', approver_name,
        'target', 'dashboard/assets'
      )
    );
    
    -- Notify HR and Admin about the approval (for fulfillment)
    FOR recipient_record IN
      SELECT DISTINCT u.id as recipient_id, r.name as recipient_role, u.full_name as recipient_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.status = 'active'
        AND u.id != NEW.user_id
        AND u.id != NEW.approved_by
        AND r.name IN ('hr', 'admin', 'super_admin')
    LOOP
      PERFORM create_notification(
        recipient_record.recipient_id,
        'Asset Request Approved - Ready for Fulfillment',
        employee_name || '''s asset request for ' || category_name || ' has been approved and is ready for fulfillment.',
        notification_type,
        jsonb_build_object(
          'asset_request_id', NEW.id,
          'employee_id', NEW.user_id,
          'employee_name', employee_name,
          'category_name', category_name,
          'description', NEW.description,
          'approved_by', NEW.approved_by,
          'approver_name', approver_name,
          'action', 'fulfill',
          'target', 'employees/asset-management'
        )
      );
    END LOOP;
    
  ELSIF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
    -- Get rejector name
    SELECT full_name INTO rejector_name
    FROM users WHERE id = NEW.rejected_by;
    
    notification_type := 'asset_request_rejected';
    notification_title := 'Asset Request Rejected';
    notification_message := 'Your asset request for ' || category_name || ' has been rejected by ' || COALESCE(rejector_name, 'a manager') || 
      CASE 
        WHEN NEW.rejection_reason IS NOT NULL AND NEW.rejection_reason != '' 
        THEN '. Reason: ' || NEW.rejection_reason
        ELSE '.'
      END;
    
    -- Notify the user who submitted the request
    PERFORM create_notification(
      NEW.user_id,
      notification_title,
      notification_message,
      notification_type,
      jsonb_build_object(
        'asset_request_id', NEW.id,
        'category_name', category_name,
        'description', NEW.description,
        'rejected_by', NEW.rejected_by,
        'rejector_name', rejector_name,
        'rejection_reason', NEW.rejection_reason,
        'target', 'dashboard/assets'
      )
    );
    
  ELSIF NEW.status = 'fulfilled' AND OLD.status = 'approved' THEN
    notification_type := 'asset_request_fulfilled';
    notification_title := 'Asset Request Fulfilled';
    notification_message := 'Your asset request for ' || category_name || ' has been fulfilled. The asset has been assigned to you.';
    
    -- Notify the user who submitted the request
    PERFORM create_notification(
      NEW.user_id,
      notification_title,
      notification_message,
      notification_type,
      jsonb_build_object(
        'asset_request_id', NEW.id,
        'category_name', category_name,
        'description', NEW.description,
        'fulfilled_by', NEW.fulfilled_by,
        'fulfilled_asset_id', NEW.fulfilled_asset_id,
        'target', 'dashboard/assets'
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for asset request notifications
DROP TRIGGER IF EXISTS trigger_asset_request_submitted ON asset_requests;
CREATE TRIGGER trigger_asset_request_submitted
  AFTER INSERT ON asset_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_asset_request_submitted();

DROP TRIGGER IF EXISTS trigger_asset_request_status_change ON asset_requests;
CREATE TRIGGER trigger_asset_request_status_change
  AFTER UPDATE ON asset_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_asset_request_status_change();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_asset_request_notification_recipients(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION notify_asset_request_submitted() TO authenticated;
GRANT EXECUTE ON FUNCTION notify_asset_request_status_change() TO authenticated;
