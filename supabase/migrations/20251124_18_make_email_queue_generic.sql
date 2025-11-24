-- Migration: Make email_queue table generic to support all HRMS modules
-- This removes the NOT NULL constraint on leave_application_id and makes the table
-- suitable for emails from policies, assets, leave, and other modules

-- First, drop the foreign key constraint
ALTER TABLE email_queue DROP CONSTRAINT IF EXISTS email_queue_leave_application_id_fkey;

-- Remove the NOT NULL constraint on leave_application_id to allow policy/asset emails
ALTER TABLE email_queue ALTER COLUMN leave_application_id DROP NOT NULL;

-- Add new columns to make the table more generic
ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS module_type text;
ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS reference_id uuid;

-- Update existing records to have module_type
UPDATE email_queue 
SET module_type = 'leave' 
WHERE leave_application_id IS NOT NULL AND module_type IS NULL;

-- Add a check constraint to ensure we have either leave_application_id OR reference_id
ALTER TABLE email_queue ADD CONSTRAINT email_queue_reference_check 
CHECK (
  (leave_application_id IS NOT NULL AND module_type = 'leave') OR
  (reference_id IS NOT NULL AND module_type IS NOT NULL AND module_type != 'leave') OR
  (leave_application_id IS NULL AND reference_id IS NULL AND module_type IS NOT NULL)
);

-- Create an index for better performance on the new columns
CREATE INDEX IF NOT EXISTS idx_email_queue_module_reference ON email_queue(module_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_status_created ON email_queue(status, created_at);

-- Drop the existing function first to change return type
DROP FUNCTION IF EXISTS process_email_queue();

-- Update the email queue processing function to handle generic emails
CREATE OR REPLACE FUNCTION process_email_queue()
RETURNS TABLE (
  queue_id uuid,
  leave_application_id uuid,
  reference_id uuid,
  module_type text,
  email_type text,
  recipients jsonb,
  leave_data jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    eq.id,
    eq.leave_application_id,
    eq.reference_id,
    eq.module_type,
    eq.email_type,
    eq.recipients,
    eq.leave_data
  FROM email_queue eq
  WHERE eq.status = 'pending'
  ORDER BY eq.created_at ASC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION process_email_queue() TO postgres;
GRANT EXECUTE ON FUNCTION process_email_queue() TO service_role;

-- Add helpful comments
COMMENT ON TABLE email_queue IS 'Generic email queue for all HRMS modules (leave, policy, asset, etc.)';
COMMENT ON COLUMN email_queue.leave_application_id IS 'Legacy column for leave emails (nullable for non-leave emails)';
COMMENT ON COLUMN email_queue.reference_id IS 'Generic reference ID for non-leave emails (policy_assignment_id, asset_assignment_id, etc.)';
COMMENT ON COLUMN email_queue.module_type IS 'Module type: leave, policy, asset, etc.';
COMMENT ON CONSTRAINT email_queue_reference_check ON email_queue IS 'Ensures proper reference ID based on module type';
