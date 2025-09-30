-- Enhancement: Include approver role and name in leave request notifications
-- This migration updates the notification functions to include both the approver's name and role

-- Drop existing triggers first
DROP TRIGGER IF EXISTS leave_request_submitted_trigger ON leave_applications;
DROP TRIGGER IF EXISTS leave_request_status_update_trigger ON leave_applications;

-- Create enhanced function for leave request status change notifications
CREATE OR REPLACE FUNCTION notify_leave_request_status_update()
RETURNS TRIGGER AS $$
DECLARE
  user_name text;
  user_manager_id uuid;
  leave_type_name text;
  approver_name text;
  approver_role text;
  approver_title text;
  recipient_id uuid;
BEGIN
  -- Only trigger on status change
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Get employee name and manager
  SELECT u.full_name, u.manager_id INTO user_name, user_manager_id
  FROM users u
  WHERE u.id = NEW.user_id;
  
  -- Get leave type name
  SELECT lt.name INTO leave_type_name
  FROM leave_types lt
  WHERE lt.id = NEW.leave_type_id;
  
  -- Get approver name and role
  SELECT u.full_name, COALESCE(r.name, 'employee') INTO approver_name, approver_role
  FROM users u
  LEFT JOIN roles r ON u.role_id = r.id
  WHERE u.id = NEW.approved_by;
  
  -- Format approver title with role
  IF approver_name IS NOT NULL AND approver_role IS NOT NULL THEN
    -- Create a readable role title
    approver_title := approver_name || ' (' || 
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
  ELSE
    approver_title := approver_name;
  END IF;
  
  -- Notify the employee who applied
  INSERT INTO notifications (user_id, title, message, type, data)
  VALUES (
    NEW.user_id,
    'Leave Request ' || CASE 
      WHEN NEW.status = 'approved' THEN 'Approved'
      WHEN NEW.status = 'rejected' THEN 'Rejected'
      ELSE 'Updated'
    END,
    'Your ' || leave_type_name || ' request has been ' || NEW.status || 
    CASE WHEN approver_title IS NOT NULL THEN ' by ' || approver_title ELSE '' END || '.',
    'leave_request_' || NEW.status,
    jsonb_build_object(
      'leave_application_id', NEW.id,
      'leave_type', leave_type_name,
      'status', NEW.status,
      'approver_name', approver_name,
      'approver_role', approver_role,
      'approver_title', approver_title,
      'comments', NEW.comments,
      'start_date', NEW.start_date,
      'end_date', NEW.end_date,
      'days_count', NEW.days_count,
      'recipient_type', 'applicant'
    )
  );
  
  -- For approved or rejected status, notify admins, HR, and manager
  IF NEW.status IN ('approved', 'rejected') THEN
    -- Notify admins and HR users
    FOR recipient_id IN
      SELECT u.id
      FROM users u
      INNER JOIN roles r ON u.role_id = r.id
      WHERE r.name IN ('admin', 'super_admin', 'hr')
      AND u.status = 'active'
      AND u.id != NEW.user_id
    LOOP
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        recipient_id,
        'Leave Request ' || CASE 
          WHEN NEW.status = 'approved' THEN 'Approved'
          WHEN NEW.status = 'rejected' THEN 'Rejected'
        END || ' - ' || user_name,
        user_name || '''s ' || leave_type_name || ' request has been ' || NEW.status || 
        CASE WHEN approver_title IS NOT NULL THEN ' by ' || approver_title ELSE '' END || ' for ' || NEW.days_count || ' days (' || 
        TO_CHAR(NEW.start_date::date, 'DD Mon YYYY') || ' to ' || TO_CHAR(NEW.end_date::date, 'DD Mon YYYY') || ').',
        'leave_request_' || NEW.status,
        jsonb_build_object(
          'leave_application_id', NEW.id,
          'employee_name', user_name,
          'employee_id', NEW.user_id,
          'leave_type', leave_type_name,
          'status', NEW.status,
          'approver_name', approver_name,
          'approver_role', approver_role,
          'approver_title', approver_title,
          'comments', NEW.comments,
          'start_date', NEW.start_date,
          'end_date', NEW.end_date,
          'days_count', NEW.days_count,
          'recipient_type', 'admin_hr'
        )
      );
    END LOOP;
    
    -- Notify the manager if exists and different from approver
    IF user_manager_id IS NOT NULL AND user_manager_id != NEW.approved_by THEN
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        user_manager_id,
        'Leave Request ' || CASE 
          WHEN NEW.status = 'approved' THEN 'Approved'
          WHEN NEW.status = 'rejected' THEN 'Rejected'
        END || ' - ' || user_name,
        user_name || '''s ' || leave_type_name || ' request has been ' || NEW.status || 
        CASE WHEN approver_title IS NOT NULL THEN ' by ' || approver_title ELSE '' END || ' for ' || NEW.days_count || ' days (' || 
        TO_CHAR(NEW.start_date::date, 'DD Mon YYYY') || ' to ' || TO_CHAR(NEW.end_date::date, 'DD Mon YYYY') || ').',
        'leave_request_' || NEW.status,
        jsonb_build_object(
          'leave_application_id', NEW.id,
          'employee_name', user_name,
          'employee_id', NEW.user_id,
          'leave_type', leave_type_name,
          'status', NEW.status,
          'approver_name', approver_name,
          'approver_role', approver_role,
          'approver_title', approver_title,
          'comments', NEW.comments,
          'start_date', NEW.start_date,
          'end_date', NEW.end_date,
          'days_count', NEW.days_count,
          'recipient_type', 'manager'
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Keep the existing notify_leave_request_submitted function unchanged
-- (It handles initial submission notifications which don't need approver info)

-- Recreate the triggers
CREATE TRIGGER leave_request_submitted_trigger
  AFTER INSERT ON leave_applications
  FOR EACH ROW
  EXECUTE FUNCTION notify_leave_request_submitted();

CREATE TRIGGER leave_request_status_update_trigger
  AFTER UPDATE ON leave_applications
  FOR EACH ROW
  EXECUTE FUNCTION notify_leave_request_status_update();

-- Add comment explaining the enhancement
COMMENT ON FUNCTION notify_leave_request_status_update() IS 
'Enhanced notification function that includes approver name and role in leave request status update notifications';
