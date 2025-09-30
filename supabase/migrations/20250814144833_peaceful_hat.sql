/*
  # Create BD Team Dashboard Tables

  1. New Tables
    - `billing_records`
      - Complete billing management with contract tracking
      - Links to clients, projects, and finance users
      - Tracks contract value, billed amounts, and payment terms
    - `invoices`
      - Invoice generation and tracking system
      - Links to billing records and finance team
      - Supports attachments and status tracking
    - `billing_logs`
      - Audit trail for billing record changes
      - Tracks who made changes and when
    - `invoice_comments`
      - BD-Finance communication system
      - Timestamped comments with user attribution

  2. Security
    - Enable RLS on all new tables
    - BD team can manage billing and invoices
    - Finance team can update invoice status
    - Audit logs are read-only for transparency

  3. Features
    - Auto-calculated remaining amounts
    - Comprehensive audit trail
    - Multi-user assignment support
    - File attachment support for invoices
*/

-- Create billing_records table
CREATE TABLE IF NOT EXISTS billing_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  project_name text,
  contract_type text NOT NULL DEFAULT 'fixed',
  billing_cycle text NOT NULL DEFAULT 'monthly',
  contract_start_date date NOT NULL,
  contract_end_date date NOT NULL,
  contract_value numeric(12,2) NOT NULL DEFAULT 0,
  billed_to_date numeric(12,2) NOT NULL DEFAULT 0,
  remaining_amount numeric(12,2) GENERATED ALWAYS AS (contract_value - billed_to_date) STORED,
  next_billing_date date,
  payment_terms text NOT NULL DEFAULT 'net_30',
  internal_notes text,
  assigned_to_finance uuid REFERENCES users(id),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT billing_records_contract_type_check 
    CHECK (contract_type IN ('fixed', 'hourly', 'retainer', 'milestone')),
  CONSTRAINT billing_records_billing_cycle_check 
    CHECK (billing_cycle IN ('one_time', 'monthly', 'quarterly', 'custom')),
  CONSTRAINT billing_records_payment_terms_check 
    CHECK (payment_terms IN ('net_15', 'net_30', 'custom')),
  CONSTRAINT billing_records_amounts_check 
    CHECK (contract_value >= 0 AND billed_to_date >= 0 AND billed_to_date <= contract_value)
);

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_title text NOT NULL,
  client_name text NOT NULL,
  project text,
  billing_reference text,
  invoice_amount numeric(12,2) NOT NULL,
  due_date date NOT NULL,
  payment_terms text NOT NULL DEFAULT 'net_30',
  currency text NOT NULL DEFAULT 'USD',
  notes_to_finance text,
  status text NOT NULL DEFAULT 'assigned',
  attachments text[], -- Array of file URLs
  assigned_finance_poc uuid REFERENCES users(id),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT invoices_payment_terms_check 
    CHECK (payment_terms IN ('net_15', 'net_30', 'custom')),
  CONSTRAINT invoices_currency_check 
    CHECK (currency IN ('USD', 'INR', 'EUR', 'GBP')),
  CONSTRAINT invoices_status_check 
    CHECK (status IN ('assigned', 'in_progress', 'sent', 'paid', 'overdue')),
  CONSTRAINT invoices_amount_check 
    CHECK (invoice_amount > 0)
);

-- Create billing_logs table for audit trail
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

-- Create invoice_comments table for BD-Finance communication
CREATE TABLE IF NOT EXISTS invoice_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  comment text NOT NULL,
  is_internal boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE billing_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for billing_records
CREATE POLICY "BD team can manage billing records"
  ON billing_records
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role_id IN (
        SELECT roles.id FROM roles 
        WHERE roles.name IN ('super_admin', 'admin', 'hr', 'bdm')
      )
    )
  );

CREATE POLICY "Finance can read billing records"
  ON billing_records
  FOR SELECT
  TO authenticated
  USING (
    assigned_to_finance = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role_id IN (
        SELECT roles.id FROM roles 
        WHERE roles.name IN ('super_admin', 'admin', 'hr', 'bdm')
      )
    )
  );

-- RLS Policies for invoices
CREATE POLICY "BD team can manage invoices"
  ON invoices
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role_id IN (
        SELECT roles.id FROM roles 
        WHERE roles.name IN ('super_admin', 'admin', 'hr', 'bdm')
      )
    )
  );

CREATE POLICY "Finance can update invoice status"
  ON invoices
  FOR UPDATE
  TO authenticated
  USING (
    assigned_finance_poc = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role_id IN (
        SELECT roles.id FROM roles 
        WHERE roles.name IN ('super_admin', 'admin', 'hr', 'bdm')
      )
    )
  );

CREATE POLICY "Finance can read assigned invoices"
  ON invoices
  FOR SELECT
  TO authenticated
  USING (
    assigned_finance_poc = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role_id IN (
        SELECT roles.id FROM roles 
        WHERE roles.name IN ('super_admin', 'admin', 'hr', 'bdm')
      )
    )
  );

-- RLS Policies for billing_logs
CREATE POLICY "Billing logs readable by BD and Finance"
  ON billing_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role_id IN (
        SELECT roles.id FROM roles 
        WHERE roles.name IN ('super_admin', 'admin', 'hr', 'bdm')
      )
    ) OR
    EXISTS (
      SELECT 1 FROM billing_records 
      WHERE billing_records.id = billing_logs.billing_record_id 
      AND billing_records.assigned_to_finance = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM invoices 
      WHERE invoices.id = billing_logs.invoice_id 
      AND invoices.assigned_finance_poc = auth.uid()
    )
  );

-- RLS Policies for invoice_comments
CREATE POLICY "BD and Finance can manage invoice comments"
  ON invoice_comments
  FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role_id IN (
        SELECT roles.id FROM roles 
        WHERE roles.name IN ('super_admin', 'admin', 'hr', 'bdm')
      )
    ) OR
    EXISTS (
      SELECT 1 FROM invoices 
      WHERE invoices.id = invoice_comments.invoice_id 
      AND invoices.assigned_finance_poc = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_billing_records_client_name ON billing_records(client_name);
CREATE INDEX IF NOT EXISTS idx_billing_records_next_billing_date ON billing_records(next_billing_date);
CREATE INDEX IF NOT EXISTS idx_billing_records_assigned_to_finance ON billing_records(assigned_to_finance);
CREATE INDEX IF NOT EXISTS idx_invoices_client_name ON invoices(client_name);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_assigned_finance_poc ON invoices(assigned_finance_poc);
CREATE INDEX IF NOT EXISTS idx_billing_logs_billing_record_id ON billing_logs(billing_record_id);
CREATE INDEX IF NOT EXISTS idx_billing_logs_invoice_id ON billing_logs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_comments_invoice_id ON invoice_comments(invoice_id);

-- Create trigger function for billing logs
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
      VALUES (NEW.id, 'updated', 'contract_value', OLD.contract_value::text, NEW.contract_value::text, auth.uid());
    END IF;
    
    IF OLD.billed_to_date != NEW.billed_to_date THEN
      INSERT INTO billing_logs (billing_record_id, action_type, field_changed, old_value, new_value, changed_by)
      VALUES (NEW.id, 'updated', 'billed_to_date', OLD.billed_to_date::text, NEW.billed_to_date::text, auth.uid());
    END IF;
    
    IF OLD.assigned_to_finance != NEW.assigned_to_finance THEN
      INSERT INTO billing_logs (billing_record_id, action_type, field_changed, old_value, new_value, changed_by)
      VALUES (NEW.id, 'updated', 'assigned_to_finance', OLD.assigned_to_finance::text, NEW.assigned_to_finance::text, auth.uid());
    END IF;
    
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function for invoice logs
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
      VALUES (NEW.id, 'status_changed', 'status', OLD.status, NEW.status, auth.uid());
    END IF;
    
    -- Log amount changes
    IF OLD.invoice_amount != NEW.invoice_amount THEN
      INSERT INTO billing_logs (invoice_id, action_type, field_changed, old_value, new_value, changed_by)
      VALUES (NEW.id, 'updated', 'invoice_amount', OLD.invoice_amount::text, NEW.invoice_amount::text, auth.uid());
    END IF;
    
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER billing_records_audit_trigger
  AFTER INSERT OR UPDATE ON billing_records
  FOR EACH ROW EXECUTE FUNCTION log_billing_changes();

CREATE TRIGGER invoices_audit_trigger
  AFTER INSERT OR UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION log_invoice_changes();