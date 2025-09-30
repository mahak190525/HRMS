/*
  # Fix Billing Logs RLS Policies

  1. Issues Fixed
    - Enable proper RLS policies for billing_logs table
    - Allow BD team and Finance users to read billing logs
    - Ensure audit trail is accessible to authorized users

  2. Security
    - BD team (BDM role) can read all billing logs
    - Finance users can read logs for records/invoices assigned to them
    - Super admin, admin, and HR can read all logs
*/

-- Also allow users to read logs for records they created
CREATE POLICY "Users can read logs for records they created"
  ON billing_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM billing_records 
      WHERE billing_records.id = billing_logs.billing_record_id 
      AND billing_records.created_by = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM invoices 
      WHERE invoices.id = billing_logs.invoice_id 
      AND invoices.created_by = auth.uid()
    )
  );