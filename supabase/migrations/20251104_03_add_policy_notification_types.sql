-- Migration: Add Policy Notification Types
-- Description: Adds policy_assigned and policy_acknowledged notification types to the notifications table constraint
-- Date: 2024-11-05

-- Drop the existing constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add the constraint with additional policy notification types
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
    'security',
    'kra_assignment',
    'kra_quarter_enabled',
    'kra_submitted',
    'kra_evaluated',
    'policy_assigned',      -- New: when policy is assigned to employee
    'policy_acknowledged'   -- New: when employee acknowledges a policy
  ]));

-- Add comment to document the constraint
COMMENT ON CONSTRAINT notifications_type_check ON notifications IS 'Allowed notification types including policy management types';

