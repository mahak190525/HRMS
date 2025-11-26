-- Quick fix for column reference errors in policy functions
-- Migration: 20251126_05_fix_column_references_only.sql

-- This migration only fixes the column reference issues:
-- - policies.title -> policies.name
-- - policies.description -> policies.content

-- Note: The policies table structure is:
-- - id, name, content, is_active, version, created_by, updated_by, created_at, updated_at

-- This is a lightweight alternative to the comprehensive migration 04
-- Use this if you only need to fix the column references

-- Step 1: Drop existing functions that have wrong column references
-- =====================================================

DROP FUNCTION IF EXISTS send_policy_assignment_email();
DROP FUNCTION IF EXISTS send_policy_acknowledgment_email();

-- Step 2: Create corrected functions with proper column references
-- =====================================================

CREATE OR REPLACE FUNCTION send_policy_assignment_email()
RETURNS TRIGGER AS $$
DECLARE
  existing_email_count integer;
BEGIN
  -- Check for existing pending emails to avoid duplicates
  SELECT COUNT(*) INTO existing_email_count
  FROM email_queue eq
  WHERE eq.module_type = 'policy_management'::module_type_enum
  AND eq.email_type = 'policy_assigned'::email_type_enum
  AND eq.status = 'pending'
  AND eq.email_data->>'user_id' = NEW.user_id::text;

  -- Only send email if no pending email exists for this user
  IF existing_email_count = 0 THEN
    INSERT INTO email_queue (
      reference_id,
      module_type,
      email_type,
      email_data,
      recipients,
      status,
      priority,
      subject
    )
    SELECT 
      NEW.id,
      'policy_management'::module_type_enum,
      'policy_assigned'::email_type_enum,
      jsonb_build_object(
        'user_id', NEW.user_id,
        'employee', jsonb_build_object(
          'email', u.email,
          'name', u.full_name
        ),
        'policy', jsonb_build_object(
          'id', p.id,
          'name', p.name,  -- Fixed: was p.title
          'content', p.content  -- Fixed: was p.description
        ),
        'assigned_by', jsonb_build_object(
          'name', assigner.full_name,
          'email', assigner.email
        ),
        'due_date', NEW.due_date,
        'notes', NEW.notes,
        'assigned_at', NEW.assigned_at
      ),
      jsonb_build_object(
        'to', jsonb_build_array(
          jsonb_build_object('email', u.email, 'name', u.full_name)
        ),
        'cc_static', COALESCE(
          (SELECT jsonb_agg(
            jsonb_build_object(
              'email', admin_users.email,
              'name', admin_users.full_name
            )
          )
          FROM users admin_users
          JOIN roles r ON admin_users.role_id = r.id
          WHERE r.name IN ('admin', 'hr')
          AND admin_users.email IS NOT NULL
          AND admin_users.email != ''), 
          '[]'::jsonb
        ),
        'cc_dynamic', jsonb_build_array('manager')
      ),
      'pending',
      'normal'::email_priority_enum,
      'Policy Assignment - Action Required'
    FROM users u
    JOIN policies p ON p.id = NEW.policy_id
    JOIN users assigner ON assigner.id = NEW.assigned_by
    WHERE u.id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION send_policy_acknowledgment_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Only send email when status changes to 'acknowledged'
  IF OLD.status != 'acknowledged' AND NEW.status = 'acknowledged' THEN
    INSERT INTO email_queue (
      reference_id,
      module_type,
      email_type,
      email_data,
      recipients,
      status,
      priority,
      subject
    )
    SELECT
      NEW.id,
      'policy_management'::module_type_enum,
      'policy_acknowledged'::email_type_enum,
      jsonb_build_object(
        'employee', jsonb_build_object(
          'email', u.email,
          'name', u.full_name
        ),
        'policy', jsonb_build_object(
          'name', p.name  -- Fixed: was p.title
        ),
        'acknowledged_at', NEW.acknowledged_at,
        'assigned_by', jsonb_build_object(
          'name', assigner.full_name,
          'email', assigner.email
        )
      ),
      jsonb_build_object(
        'to', jsonb_build_array(
          jsonb_build_object('email', assigner.email, 'name', assigner.full_name)
        ),
        'cc_static', COALESCE(
          (SELECT jsonb_agg(
            jsonb_build_object(
              'email', admin_users.email,
              'name', admin_users.full_name
            )
          )
          FROM users admin_users
          JOIN roles r ON admin_users.role_id = r.id
          WHERE r.name IN ('admin', 'hr')
          AND admin_users.email IS NOT NULL
          AND admin_users.email != ''), 
          '[]'::jsonb
        )
      ),
      'pending',
      'normal'::email_priority_enum,
      'Policy Acknowledged'
    FROM users u
    JOIN policies p ON p.id = NEW.policy_id
    JOIN users assigner ON assigner.id = NEW.assigned_by
    WHERE u.id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Recreate triggers
-- =====================================================

DROP TRIGGER IF EXISTS trigger_policy_assignment_email ON policy_assignments;
DROP TRIGGER IF EXISTS trigger_policy_acknowledgment_email ON policy_assignments;

CREATE TRIGGER trigger_policy_assignment_email
  AFTER INSERT ON policy_assignments
  FOR EACH ROW
  EXECUTE FUNCTION send_policy_assignment_email();

CREATE TRIGGER trigger_policy_acknowledgment_email
  AFTER UPDATE ON policy_assignments
  FOR EACH ROW
  EXECUTE FUNCTION send_policy_acknowledgment_email();

-- Step 4: Grant permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION send_policy_assignment_email() TO postgres, service_role, authenticated;
GRANT EXECUTE ON FUNCTION send_policy_acknowledgment_email() TO postgres, service_role, authenticated;

-- Log completion
SELECT 'Column reference fixes applied successfully - policy functions now use correct column names' as status;
