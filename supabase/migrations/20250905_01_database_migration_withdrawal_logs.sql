-- Add Leave Withdrawal Functionality
-- This migration adds the ability for users to withdraw leave applications
-- and maintains proper audit trails and balance management

DROP POLICY IF EXISTS "Users can view own withdrawal logs" ON "leave_withdrawal_logs";
DROP POLICY IF EXISTS "HR and admins can view all withdrawal logs" ON "leave_withdrawal_logs";
DROP POLICY IF EXISTS "Users can create withdrawal logs" ON "leave_withdrawal_logs";

-- Create the leave_withdrawal_logs table
-- This table will store all withdrawal actions for leave applications
CREATE TABLE IF NOT EXISTS leave_withdrawal_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    leave_application_id UUID NOT NULL REFERENCES leave_applications(id) ON DELETE CASCADE,
    withdrawn_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    withdrawal_reason TEXT NOT NULL,
    previous_status VARCHAR(20) NOT NULL CHECK (previous_status IN ('pending', 'approved')),
    withdrawn_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_leave_withdrawal_logs_application_id ON leave_withdrawal_logs(leave_application_id);
CREATE INDEX IF NOT EXISTS idx_leave_withdrawal_logs_withdrawn_by ON leave_withdrawal_logs(withdrawn_by);
CREATE INDEX IF NOT EXISTS idx_leave_withdrawal_logs_withdrawn_at ON leave_withdrawal_logs(withdrawn_at);

-- Add the new fields to leave_applications table for withdrawal tracking
ALTER TABLE leave_applications 
ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS withdrawn_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS withdrawal_reason TEXT;

-- Update the status constraint to include 'withdrawn'
ALTER TABLE leave_applications 
DROP CONSTRAINT IF EXISTS leave_applications_status_check;

ALTER TABLE leave_applications 
ADD CONSTRAINT leave_applications_status_check 
CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'withdrawn'));

-- Add 'leave_request_withdrawn' to the notifications constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
CHECK (type = ANY(ARRAY[
  'general',
  'leave_request_submitted',
  'leave_request_approved', 
  'leave_request_rejected',
  'leave_request_withdrawn',
  'complaint_submitted',
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
  'project_deleted'
]));

-- Create a function to automatically restore leave balance when a leave is withdrawn
CREATE OR REPLACE FUNCTION restore_leave_balance_on_withdrawal()
RETURNS TRIGGER AS $$
BEGIN
    -- Only restore balance if the leave was previously approved
    IF NEW.status = 'withdrawn' AND OLD.status = 'approved' THEN
        -- Update the leave balance by restoring the days
        -- Note: remaining_days is a generated column (allocated_days - used_days) and will be automatically recalculated
        UPDATE leave_balances
        SET 
            used_days = used_days - NEW.days_count,
            updated_at = NOW()
        WHERE user_id = NEW.user_id
        AND EXTRACT(YEAR FROM NEW.start_date) = year;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically restore leave balance on withdrawal
DROP TRIGGER IF EXISTS trigger_restore_balance_on_withdrawal ON leave_applications;
CREATE TRIGGER trigger_restore_balance_on_withdrawal
    AFTER UPDATE ON leave_applications
    FOR EACH ROW
    WHEN (NEW.status = 'withdrawn' AND OLD.status != 'withdrawn')
    EXECUTE FUNCTION restore_leave_balance_on_withdrawal();

-- Enhanced notification function for withdrawal notifications
-- This function will be called by the existing leave_request_status_update_trigger
-- but we need to update it to handle withdrawn status and send notifications to approvers
CREATE OR REPLACE FUNCTION notify_leave_withdrawal_to_approvers()
RETURNS TRIGGER AS $$
DECLARE
  user_name text;
  user_manager_id uuid;
  leave_type_name text;
  withdrawn_by_name text;
  withdrawn_by_role text;
  withdrawn_by_title text;
  recipient_id uuid;
BEGIN
  -- Only trigger for withdrawal status
  IF NEW.status != 'withdrawn' OR OLD.status = 'withdrawn' THEN
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
  
  -- Get withdrawer name and role
  SELECT u.full_name, COALESCE(r.name, 'employee') INTO withdrawn_by_name, withdrawn_by_role
  FROM users u
  LEFT JOIN roles r ON u.role_id = r.id
  WHERE u.id = NEW.withdrawn_by;
  
  -- Format withdrawer title with role
  IF withdrawn_by_name IS NOT NULL AND withdrawn_by_role IS NOT NULL THEN
    withdrawn_by_title := withdrawn_by_name || ' (' || 
      CASE 
        WHEN withdrawn_by_role = 'super_admin' THEN 'Super Admin'
        WHEN withdrawn_by_role = 'admin' THEN 'Admin'
        WHEN withdrawn_by_role = 'hr' THEN 'HR'
        WHEN withdrawn_by_role = 'hrm' THEN 'HR Manager'
        WHEN withdrawn_by_role = 'sdm' THEN 'Software Development Manager'
        WHEN withdrawn_by_role = 'bdm' THEN 'Business Development Manager'
        WHEN withdrawn_by_role = 'qam' THEN 'Quality Assurance Manager'
        WHEN withdrawn_by_role = 'finance' THEN 'Finance'
        WHEN withdrawn_by_role = 'finance_manager' THEN 'Finance Manager'
        ELSE INITCAP(REPLACE(withdrawn_by_role, '_', ' '))
      END || ')';
  ELSE
    withdrawn_by_title := withdrawn_by_name;
  END IF;
  
  -- Notify admins and HR users about the withdrawal
  FOR recipient_id IN
    SELECT u.id
    FROM users u
    INNER JOIN roles r ON u.role_id = r.id
    WHERE r.name IN ('admin', 'super_admin', 'hr')
    AND u.status = 'active'
    AND u.id != NEW.user_id
    AND u.id != NEW.withdrawn_by  -- Don't notify the person who withdrew it
  LOOP
    INSERT INTO notifications (user_id, title, message, type, data)
    VALUES (
      recipient_id,
      'Leave Application Withdrawn - ' || user_name,
      user_name || '''s ' || leave_type_name || ' request has been withdrawn' || 
      CASE WHEN withdrawn_by_title IS NOT NULL THEN ' by ' || withdrawn_by_title ELSE '' END || 
      ' for ' || NEW.days_count || ' days (' || 
      TO_CHAR(NEW.start_date::date, 'DD Mon YYYY') || ' to ' || TO_CHAR(NEW.end_date::date, 'DD Mon YYYY') || ').' ||
      CASE WHEN NEW.withdrawal_reason IS NOT NULL THEN ' Reason: ' || NEW.withdrawal_reason ELSE '' END,
      'leave_request_withdrawn',
      jsonb_build_object(
        'leave_application_id', NEW.id,
        'employee_name', user_name,
        'employee_id', NEW.user_id,
        'leave_type', leave_type_name,
        'status', NEW.status,
        'withdrawn_by', NEW.withdrawn_by,
        'withdrawn_by_name', withdrawn_by_name,
        'withdrawn_by_role', withdrawn_by_role,
        'withdrawn_by_title', withdrawn_by_title,
        'withdrawal_reason', NEW.withdrawal_reason,
        'start_date', NEW.start_date,
        'end_date', NEW.end_date,
        'days_count', NEW.days_count,
        'recipient_type', 'admin_hr'
      )
    );
  END LOOP;
  
  -- Notify the manager if exists and different from withdrawer
  IF user_manager_id IS NOT NULL AND user_manager_id != NEW.withdrawn_by THEN
    INSERT INTO notifications (user_id, title, message, type, data)
    VALUES (
      user_manager_id,
      'Leave Application Withdrawn - ' || user_name,
      user_name || '''s ' || leave_type_name || ' request has been withdrawn' || 
      CASE WHEN withdrawn_by_title IS NOT NULL THEN ' by ' || withdrawn_by_title ELSE '' END || 
      ' for ' || NEW.days_count || ' days (' || 
      TO_CHAR(NEW.start_date::date, 'DD Mon YYYY') || ' to ' || TO_CHAR(NEW.end_date::date, 'DD Mon YYYY') || ').' ||
      CASE WHEN NEW.withdrawal_reason IS NOT NULL THEN ' Reason: ' || NEW.withdrawal_reason ELSE '' END,
      'leave_request_withdrawn',
      jsonb_build_object(
        'leave_application_id', NEW.id,
        'employee_name', user_name,
        'employee_id', NEW.user_id,
        'leave_type', leave_type_name,
        'status', NEW.status,
        'withdrawn_by', NEW.withdrawn_by,
        'withdrawn_by_name', withdrawn_by_name,
        'withdrawn_by_role', withdrawn_by_role,
        'withdrawn_by_title', withdrawn_by_title,
        'withdrawal_reason', NEW.withdrawal_reason,
        'start_date', NEW.start_date,
        'end_date', NEW.end_date,
        'days_count', NEW.days_count,
        'recipient_type', 'manager'
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for withdrawal notifications to approvers
DROP TRIGGER IF EXISTS trigger_notify_leave_withdrawal_to_approvers ON leave_applications;
CREATE TRIGGER trigger_notify_leave_withdrawal_to_approvers
    AFTER UPDATE ON leave_applications
    FOR EACH ROW
    WHEN (NEW.status = 'withdrawn' AND OLD.status != 'withdrawn')
    EXECUTE FUNCTION notify_leave_withdrawal_to_approvers();

-- Enable RLS on the new table
ALTER TABLE leave_withdrawal_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for leave_withdrawal_logs
-- Users can view withdrawal logs for their own applications
CREATE POLICY "Users can view own withdrawal logs"
    ON leave_withdrawal_logs
    FOR SELECT
    TO authenticated
    USING (
        withdrawn_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM leave_applications la
            WHERE la.id = leave_withdrawal_logs.leave_application_id
            AND la.user_id = auth.uid()
        )
    );

-- HR, admins, and managers can view all withdrawal logs
CREATE POLICY "HR and admins can view all withdrawal logs"
    ON leave_withdrawal_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users u
            INNER JOIN roles r ON u.role_id = r.id
            WHERE u.id = auth.uid()
            AND r.name IN ('admin', 'super_admin', 'hr', 'hrm')
            AND u.status = 'active'
        )
    );

-- Users can insert withdrawal logs for their own applications or with admin privileges
CREATE POLICY "Users can create withdrawal logs"
    ON leave_withdrawal_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        withdrawn_by = auth.uid() AND (
            -- User withdrawing their own application
            EXISTS (
                SELECT 1 FROM leave_applications la
                WHERE la.id = leave_application_id
                AND la.user_id = auth.uid()
            ) OR
            -- Admin/HR withdrawing any application
            EXISTS (
                SELECT 1 FROM users u
                INNER JOIN roles r ON u.role_id = r.id
                WHERE u.id = auth.uid()
                AND r.name IN ('admin', 'super_admin', 'hr', 'hrm')
                AND u.status = 'active'
            )
        )
    );

-- Grant necessary permissions
GRANT SELECT, INSERT ON leave_withdrawal_logs TO authenticated;
GRANT UPDATE ON leave_applications TO authenticated;

-- Comments for documentation
COMMENT ON TABLE leave_withdrawal_logs IS 'Stores logs of all leave application withdrawals';
COMMENT ON COLUMN leave_withdrawal_logs.leave_application_id IS 'Reference to the withdrawn leave application';
COMMENT ON COLUMN leave_withdrawal_logs.withdrawn_by IS 'User who performed the withdrawal (employee or admin)';
COMMENT ON COLUMN leave_withdrawal_logs.withdrawal_reason IS 'Reason provided for the withdrawal';
COMMENT ON COLUMN leave_withdrawal_logs.previous_status IS 'Status of the leave before withdrawal (pending or approved)';
COMMENT ON COLUMN leave_withdrawal_logs.withdrawn_at IS 'Timestamp when the withdrawal occurred';
