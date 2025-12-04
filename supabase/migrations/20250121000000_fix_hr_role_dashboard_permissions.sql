/*
  # Fix HR Role Dashboard and Page Permissions
  
  This migration fixes the HR role's dashboard_permissions and page_permissions
  to grant access to all dashboards and pages that HR should have access to.
  
  HR should have access to:
  - self
  - employee_management
  - performance
  - grievance
  - ats
  - lms
  - exit
  - policies
  - finance (read-only)
*/

-- Update HR role dashboard permissions
UPDATE roles
SET dashboard_permissions = jsonb_build_object(
  'self', jsonb_build_object('read', true, 'view', true, 'write', true, 'delete', false),
  'employee_management', jsonb_build_object('read', true, 'view', true, 'write', true, 'delete', true),
  'performance', jsonb_build_object('read', true, 'view', true, 'write', true, 'delete', false),
  'grievance', jsonb_build_object('read', true, 'view', true, 'write', true, 'delete', false),
  'ats', jsonb_build_object('read', true, 'view', true, 'write', true, 'delete', false),
  'lms', jsonb_build_object('read', true, 'view', true, 'write', true, 'delete', false),
  'exit', jsonb_build_object('read', true, 'view', true, 'write', true, 'delete', false),
  'policies', jsonb_build_object('read', true, 'view', true, 'write', true, 'delete', false),
  'finance', jsonb_build_object('read', true, 'view', true, 'write', false, 'delete', false)
)
WHERE name = 'hr';

-- Update HR role page permissions
-- Grant access to all pages within accessible dashboards
UPDATE roles
SET page_permissions = jsonb_build_object(
  -- Self dashboard pages
  'self', jsonb_build_object(
    'overview', jsonb_build_object('read', true, 'view', true, 'write', false, 'delete', false),
    'leave', jsonb_build_object('read', true, 'view', true, 'write', true, 'delete', false),
    'assets', jsonb_build_object('read', true, 'view', true, 'write', false, 'delete', false),
    'documents', jsonb_build_object('read', true, 'view', true, 'write', true, 'delete', false),
    'policies', jsonb_build_object('read', true, 'view', true, 'write', false, 'delete', false),
    'performance', jsonb_build_object('read', true, 'view', true, 'write', false, 'delete', false),
    'feedback', jsonb_build_object('read', true, 'view', true, 'write', true, 'delete', false),
    'settings', jsonb_build_object('read', true, 'view', true, 'write', true, 'delete', false)
  ),
  -- Employee Management dashboard pages
  'employee_management', jsonb_build_object(
    'overview', jsonb_build_object('read', true, 'view', true, 'write', true, 'delete', true),
    'assets', jsonb_build_object('read', true, 'view', true, 'write', true, 'delete', false),
    'leave', jsonb_build_object('read', true, 'view', true, 'write', true, 'delete', true),
    'feedback', jsonb_build_object('read', true, 'view', true, 'write', true, 'delete', false),
    'role-permissions', jsonb_build_object('read', true, 'view', true, 'write', true, 'delete', false)
  ),
  -- Performance dashboard pages
  'performance', jsonb_build_object(
    'overview', jsonb_build_object('read', true, 'view', true, 'write', true, 'delete', false),
    'KRA', jsonb_build_object('read', true, 'view', true, 'write', true, 'delete', false)
  ),
  -- Policies dashboard pages
  'policies', jsonb_build_object(
    'all-policies', jsonb_build_object('read', true, 'view', true, 'write', true, 'delete', false),
    'assign', jsonb_build_object('read', true, 'view', true, 'write', true, 'delete', false),
    'history', jsonb_build_object('read', true, 'view', true, 'write', false, 'delete', false),
    'logs', jsonb_build_object('read', true, 'view', true, 'write', false, 'delete', false)
  ),
  -- Finance dashboard pages (read-only for HR)
  'finance', jsonb_build_object(
    'overview', jsonb_build_object('read', true, 'view', true, 'write', false, 'delete', false),
    'payroll', jsonb_build_object('read', true, 'view', true, 'write', false, 'delete', false),
    'billing', jsonb_build_object('read', true, 'view', true, 'write', false, 'delete', false),
    'logs', jsonb_build_object('read', true, 'view', true, 'write', false, 'delete', false)
  )
)
WHERE name = 'hr';

