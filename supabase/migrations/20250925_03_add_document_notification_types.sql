-- Migration: Add Document Notification Types
-- Description: Adds document_request and document_upload notification types to the notifications table constraint
-- Date: 2024-09-25

-- Drop the existing constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add the constraint with additional document notification types
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
    'document_request',      -- New: when document is requested from employee
    'document_upload',       -- New: when document is uploaded by employee
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
    'asset_upload_overdue'
  ]));

-- Add comment to document the constraint
COMMENT ON CONSTRAINT notifications_type_check ON notifications IS 'Allowed notification types including document management types';
