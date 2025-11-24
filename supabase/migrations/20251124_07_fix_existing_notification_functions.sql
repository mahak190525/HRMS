-- Fix existing notification functions to work with public schema
-- Instead of creating duplicates, we'll fix the existing functions that already handle:
-- 1. Leave submissions (notify_leave_request_submitted)
-- 2. Leave approvals/rejections (notify_leave_request_status_update_with_email) 
-- 3. Leave withdrawals (notify_leave_withdrawal_to_approvers)

-- The issue is that existing functions may be failing due to RLS or permission issues
-- This migration ensures all existing functions work properly with public schema

-- Grant execute permissions to existing functions
GRANT EXECUTE ON FUNCTION notify_leave_request_submitted() TO public;
GRANT EXECUTE ON FUNCTION notify_leave_request_status_update_with_email() TO public;
GRANT EXECUTE ON FUNCTION notify_leave_withdrawal_to_approvers() TO public;

-- Ensure the email function also has permissions
GRANT EXECUTE ON FUNCTION send_leave_email_notification(uuid, text) TO public;

-- Make sure all existing triggers are properly attached
-- 1. Leave submission trigger
DROP TRIGGER IF EXISTS leave_request_submitted_trigger ON leave_applications;
CREATE TRIGGER leave_request_submitted_trigger
  AFTER INSERT ON leave_applications
  FOR EACH ROW
  EXECUTE FUNCTION notify_leave_request_submitted();

-- 2. Leave status update trigger (handles approvals/rejections + emails)
DROP TRIGGER IF EXISTS leave_request_status_update_trigger ON leave_applications;
CREATE TRIGGER leave_request_status_update_trigger
  AFTER UPDATE ON leave_applications
  FOR EACH ROW
  EXECUTE FUNCTION notify_leave_request_status_update_with_email();

-- 3. Leave withdrawal trigger
DROP TRIGGER IF EXISTS trigger_notify_leave_withdrawal_to_approvers ON leave_applications;
CREATE TRIGGER trigger_notify_leave_withdrawal_to_approvers
  AFTER UPDATE ON leave_applications
  FOR EACH ROW
  WHEN (NEW.status = 'withdrawn' AND OLD.status != 'withdrawn')
  EXECUTE FUNCTION notify_leave_withdrawal_to_approvers();

-- Update the existing status update function to include finance users for approvals
-- This enhances the existing function to notify finance users as requested
CREATE OR REPLACE FUNCTION notify_leave_request_status_update_with_email()
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
  
  -- Only notify employee for meaningful status changes (not for pending status)
  IF NEW.status IN ('approved', 'rejected', 'withdrawn', 'cancelled') THEN
    INSERT INTO notifications (user_id, title, message, type, data)
    VALUES (
      NEW.user_id,
      'Leave Request ' || CASE 
        WHEN NEW.status = 'approved' THEN 'Approved'
        WHEN NEW.status = 'rejected' THEN 'Rejected'
        WHEN NEW.status = 'withdrawn' THEN 'Withdrawn'
        WHEN NEW.status = 'cancelled' THEN 'Cancelled'
        ELSE 'Updated'
      END,
      'Your ' || leave_type_name || ' request has been ' || NEW.status || 
      CASE WHEN approver_title IS NOT NULL THEN ' by ' || approver_title ELSE '' END || '.' ||
      CASE WHEN NEW.status = 'rejected' AND NEW.comments IS NOT NULL AND NEW.comments != '' 
           THEN ' Reason: ' || NEW.comments ELSE '' END,
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
  END IF;
  
  -- For approved or rejected status, notify admins, HR, finance, and manager
  IF NEW.status IN ('approved', 'rejected') THEN
    -- Notify admins, HR, and finance users (enhanced to include finance as requested)
    FOR recipient_id IN
      SELECT u.id
      FROM users u
      INNER JOIN roles r ON u.role_id = r.id
      WHERE r.name IN ('admin', 'super_admin', 'hr', 'finance', 'finance_manager')
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
          'recipient_type', 'admin_hr_finance'
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

    -- Send email notification for approved leaves
    IF NEW.status = 'approved' THEN
      BEGIN
        PERFORM send_leave_email_notification(NEW.id, 'leave_approval');
      EXCEPTION WHEN OTHERS THEN
        -- Log error but don't fail the notification creation
        RAISE WARNING 'Failed to send email notification for leave application %: %', NEW.id, SQLERRM;
      END;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission for the updated function
GRANT EXECUTE ON FUNCTION notify_leave_request_status_update_with_email() TO public;

-- Add comments
COMMENT ON FUNCTION notify_leave_request_status_update_with_email() IS 
'Enhanced notification function that handles leave approvals/rejections with notifications to employee, admin, hr, finance, and manager, plus email notifications for approvals';

SELECT 'Existing notification functions fixed and enhanced for public schema' as status;
