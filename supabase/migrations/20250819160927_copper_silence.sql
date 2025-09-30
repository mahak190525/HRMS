/*
  # Fix Billing Triggers and Logs

  1. Create missing triggers for billing and invoice audit logging
  2. Fix billing logs table structure
  3. Ensure proper audit trail functionality

  This migration creates the necessary triggers that were defined but not created.
*/

-- Create billing_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS billing_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_record_id uuid REFERENCES billing_records(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  field_changed text,
  old_value text,
  new_value text,
  changed_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT billing_logs_action_type_check 
    CHECK (action_type IN ('created', 'updated', 'deleted', 'assigned', 'status_changed')),
  CONSTRAINT billing_logs_record_check 
    CHECK ((billing_record_id IS NOT NULL) OR (invoice_id IS NOT NULL))
);

-- Enable RLS on billing_logs
ALTER TABLE billing_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for billing_logs
-- CREATE POLICY "Billing logs readable by BD and Finance" ON billing_logs
--   FOR SELECT TO authenticated
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_billing_logs_billing_record_id ON billing_logs(billing_record_id);
CREATE INDEX IF NOT EXISTS idx_billing_logs_invoice_id ON billing_logs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_billing_logs_created_at ON billing_logs(created_at DESC);

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS billing_records_audit_trigger ON billing_records;
DROP TRIGGER IF EXISTS invoices_audit_trigger ON invoices;

-- Create triggers for audit logging
CREATE TRIGGER billing_records_audit_trigger
  AFTER INSERT OR UPDATE ON billing_records
  FOR EACH ROW EXECUTE FUNCTION log_billing_changes();

CREATE TRIGGER invoices_audit_trigger
  AFTER INSERT OR UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION log_invoice_changes();