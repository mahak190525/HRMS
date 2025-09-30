
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
  last_modified_by uuid REFERENCES users(id),
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
  last_modified_by uuid REFERENCES users(id),
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