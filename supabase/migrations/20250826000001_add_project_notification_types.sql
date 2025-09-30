/*
  # Add Project Notification Types

  Add new notification types for project assignment workflows:
  - project_assigned: When user is assigned to a project
  - project_unassigned: When user is removed from a project  
  - project_role_updated: When user's role in a project changes
  - project_deleted: When a project is deleted (affects all assigned users)
*/

-- Drop the existing constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add the updated constraint with new project notification types
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
CHECK (type = ANY(ARRAY[
  'general',
  'leave_request_submitted',
  'leave_request_approved', 
  'leave_request_rejected',
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
