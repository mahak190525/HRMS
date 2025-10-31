-- Migration: Add Security Notification Type for Print Blocking
-- Description: Adds 'security' notification type to support print blocking notifications
-- Date: 2024-10-27

-- Drop the existing constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add the constraint with security notification type
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type = ANY (ARRAY[
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
    'document_request',
    'document_upload',
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
    'vm_unassigned',
    'asset_quarterly_upload_reminder',
    'asset_images_uploaded',
    'asset_upload_overdue',
    'security'  -- New: for print blocking and other security notifications
  ]));

-- Add comment to document the constraint
COMMENT ON CONSTRAINT notifications_type_check ON notifications IS 'Allowed notification types including security notifications for print blocking';

-- Update RLS policies to allow system to create security notifications
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "System can create security notifications" ON notifications;

-- Create updated policy for security notifications
CREATE POLICY "System can create security notifications"
  ON notifications
  FOR INSERT
  TO authenticated, public
  WITH CHECK (type = 'security');

-- Also allow general notification creation for system functions
CREATE POLICY "Allow system notification creation" ON notifications
  FOR INSERT 
  TO public
  WITH CHECK (true);

-- Grant necessary permissions for the trigger function
GRANT INSERT ON notifications TO public;
GRANT SELECT ON users TO public;
GRANT SELECT ON roles TO public;

-- Add comment
COMMENT ON POLICY "System can create security notifications" ON notifications IS 'Allows system triggers to create security notifications for print blocking attempts';
