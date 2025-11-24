-- Add missing notification types for leave status changes
-- The error shows that 'leave_request_pending' is not allowed by the check constraint
-- This migration adds all possible leave status notification types

-- Drop the existing constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add the constraint with all leave status types and existing types
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type = ANY (ARRAY[
    'general',
    -- Leave notification types (all possible statuses)
    'leave_request_submitted',
    'leave_request_pending',      -- Missing: when status changes to pending
    'leave_request_approved', 
    'leave_request_rejected',
    'leave_request_withdrawn',
    'leave_request_cancelled',    -- Missing: when status changes to cancelled
    -- Complaint types
    'complaint_submitted',
    'complaint_assigned',
    'complaint_resolved',
    -- Performance types
    'performance_goal_assigned',
    -- Interview types
    'interview_scheduled',
    -- Assessment types
    'assessment_assigned',
    -- Exit process types
    'exit_process_initiated',
    -- Document types
    'document_approved',
    'document_rejected',
    'document_request',
    'document_upload',
    -- Project types
    'project_assigned',
    'project_unassigned',
    'project_role_updated',
    'project_deleted',
    -- Asset request types
    'asset_request_submitted',
    'asset_request_approved',
    'asset_request_rejected',
    'asset_request_fulfilled',
    -- Asset assignment types
    'asset_assigned',
    'asset_unassigned',
    'vm_assigned',
    'vm_unassigned',
    -- Asset upload types
    'asset_quarterly_upload_reminder',
    'asset_images_uploaded',
    'asset_upload_overdue',
    -- Security types
    'security',
    -- KRA types
    'kra_assignment',
    'kra_quarter_enabled',
    'kra_submitted',
    'kra_evaluated',
    -- Policy types
    'policy_assigned',
    'policy_acknowledged'
  ]));

-- Add comment to document the constraint
COMMENT ON CONSTRAINT notifications_type_check ON notifications IS 
'Allowed notification types including all leave status types (pending, approved, rejected, withdrawn, cancelled)';

-- Test message
SELECT 'Missing notification types added to constraint' as status;
