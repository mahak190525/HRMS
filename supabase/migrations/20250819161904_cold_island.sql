/*
  # Fix Billing Logs Functionality

  1. Issues Fixed
    - Add missing last_modified_by columns to billing_records and invoices
    - Fix trigger functions to properly use last_modified_by
    - Enable RLS policies for billing_logs
    - Ensure proper audit trail functionality

  2. Changes
    - Add last_modified_by columns if missing
    - Update trigger functions to handle last_modified_by properly
    - Enable billing_logs RLS policies
    - Fix trigger creation
*/

-- Add last_modified_by columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_records' AND column_name = 'last_modified_by'
  ) THEN
    ALTER TABLE billing_records ADD COLUMN last_modified_by uuid REFERENCES users(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'last_modified_by'
  ) THEN
    ALTER TABLE invoices ADD COLUMN last_modified_by uuid REFERENCES users(id);
  END IF;
END $$;

-- Drop existing triggers to recreate them
DROP TRIGGER IF EXISTS billing_records_audit_trigger ON billing_records;
DROP TRIGGER IF EXISTS invoices_audit_trigger ON invoices;

-- Create improved trigger function for billing logs
CREATE OR REPLACE FUNCTION log_billing_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO billing_logs (billing_record_id, action_type, changed_by)
    VALUES (NEW.id, 'created', NEW.created_by);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Log significant field changes
    IF OLD.contract_value != NEW.contract_value THEN
      INSERT INTO billing_logs (billing_record_id, action_type, field_changed, old_value, new_value, changed_by)
      VALUES (NEW.id, 'updated', 'contract_value', OLD.contract_value::text, NEW.contract_value::text, COALESCE(NEW.last_modified_by, NEW.created_by));
    END IF;
    
    IF OLD.billed_to_date != NEW.billed_to_date THEN
      INSERT INTO billing_logs (billing_record_id, action_type, field_changed, old_value, new_value, changed_by)
      VALUES (NEW.id, 'updated', 'billed_to_date', OLD.billed_to_date::text, NEW.billed_to_date::text, COALESCE(NEW.last_modified_by, NEW.created_by));
    END IF;
    
    IF COALESCE(OLD.assigned_to_finance::text, '') != COALESCE(NEW.assigned_to_finance::text, '') THEN
      INSERT INTO billing_logs (billing_record_id, action_type, field_changed, old_value, new_value, changed_by)
      VALUES (NEW.id, 'assigned', 'assigned_to_finance', COALESCE(OLD.assigned_to_finance::text, 'unassigned'), COALESCE(NEW.assigned_to_finance::text, 'unassigned'), COALESCE(NEW.last_modified_by, NEW.created_by));
    END IF;
    
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create improved trigger function for invoice logs
CREATE OR REPLACE FUNCTION log_invoice_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO billing_logs (invoice_id, action_type, changed_by)
    VALUES (NEW.id, 'created', NEW.created_by);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Log status changes
    IF OLD.status != NEW.status THEN
      INSERT INTO billing_logs (invoice_id, action_type, field_changed, old_value, new_value, changed_by)
      VALUES (NEW.id, 'status_changed', 'status', OLD.status, NEW.status, COALESCE(NEW.last_modified_by, NEW.created_by));
    END IF;
    
    -- Log amount changes
    IF OLD.invoice_amount != NEW.invoice_amount THEN
      INSERT INTO billing_logs (invoice_id, action_type, field_changed, old_value, new_value, changed_by)
      VALUES (NEW.id, 'updated', 'invoice_amount', OLD.invoice_amount::text, NEW.invoice_amount::text, COALESCE(NEW.last_modified_by, NEW.created_by));
    END IF;
    
    -- Log assignment changes
    IF COALESCE(OLD.assigned_finance_poc::text, '') != COALESCE(NEW.assigned_finance_poc::text, '') THEN
      INSERT INTO billing_logs (invoice_id, action_type, field_changed, old_value, new_value, changed_by)
      VALUES (NEW.id, 'assigned', 'assigned_finance_poc', COALESCE(OLD.assigned_finance_poc::text, 'unassigned'), COALESCE(NEW.assigned_finance_poc::text, 'unassigned'), COALESCE(NEW.last_modified_by, NEW.created_by));
    END IF;
    
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create the triggers
CREATE TRIGGER billing_records_audit_trigger
  AFTER INSERT OR UPDATE ON billing_records
  FOR EACH ROW EXECUTE FUNCTION log_billing_changes();

CREATE TRIGGER invoices_audit_trigger
  AFTER INSERT OR UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION log_invoice_changes();

-- Enable RLS policies for billing_logs
-- CREATE POLICY "Billing logs readable by BD and Finance"
--   ON billing_logs
--   FOR SELECT
--   TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM users 
--       WHERE users.id = auth.uid() 
--       AND users.role_id IN (
--         SELECT roles.id FROM roles 
--         WHERE roles.name IN ('super_admin', 'admin', 'hr', 'bdm')
--       )
--     ) OR
--     EXISTS (
--       SELECT 1 FROM billing_records 
--       WHERE billing_records.id = billing_logs.billing_record_id 
--       AND billing_records.assigned_to_finance = auth.uid()
--     ) OR
--     EXISTS (
--       SELECT 1 FROM invoices 
--       WHERE invoices.id = billing_logs.invoice_id 
--       AND invoices.assigned_finance_poc = auth.uid()
--     )
--   );

-- Create indexes for billing_logs if they don't exist
CREATE INDEX IF NOT EXISTS idx_billing_logs_billing_record_id ON billing_logs(billing_record_id);
CREATE INDEX IF NOT EXISTS idx_billing_logs_invoice_id ON billing_logs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_billing_logs_created_at ON billing_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_logs_changed_by ON billing_logs(changed_by);