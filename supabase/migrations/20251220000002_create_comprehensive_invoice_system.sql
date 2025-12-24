-- Migration: Create comprehensive invoice system
-- Description: Creates/updates invoice tables with all required fields for invoice management
-- Date: 2024-12-20

DROP POLICY IF EXISTS "Users can view invoice tasks for invoices they can access" ON "invoice_tasks";
DROP POLICY IF EXISTS "Users can insert invoice tasks for invoices they can manage" ON "invoice_tasks";
DROP POLICY IF EXISTS "Users can update invoice tasks for invoices they can manage" ON "invoice_tasks";
DROP POLICY IF EXISTS "Users can delete invoice tasks for invoices they can manage" ON "invoice_tasks";


-- First, let's update the existing invoices table with new required fields
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS invoice_type text CHECK (invoice_type IN ('Mechlin LLC', 'Mechlin Indian')),
ADD COLUMN IF NOT EXISTS invoice_number text, -- Changed from invoice_title to invoice_number
ADD COLUMN IF NOT EXISTS client_address text,
ADD COLUMN IF NOT EXISTS client_state text,
ADD COLUMN IF NOT EXISTS client_zip_code text,
ADD COLUMN IF NOT EXISTS invoice_date date DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS service_period_start date,
ADD COLUMN IF NOT EXISTS service_period_end date,
ADD COLUMN IF NOT EXISTS reference_invoice_numbers text[], -- For LLC type
ADD COLUMN IF NOT EXISTS payment_receive_date date,
ADD COLUMN IF NOT EXISTS amount_received numeric(10,2),
ADD COLUMN IF NOT EXISTS pending_amount numeric(10,2),
ADD COLUMN IF NOT EXISTS payment_remarks text;

-- Update the invoice_amount constraint to allow 0 (for invoices with tasks that calculate the total)
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_invoice_amount_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_invoice_amount_check CHECK (invoice_amount >= 0);

-- Create function to generate invoice number in format MMMXXX (e.g., NOV001, DEC001)
-- Numbers reset each month: NOV050 -> DEC001 (December starts fresh from 001)
CREATE OR REPLACE FUNCTION generate_invoice_number(invoice_date DATE DEFAULT CURRENT_DATE)
RETURNS TEXT AS $$
DECLARE
    month_abbr TEXT;
    next_number INTEGER;
    invoice_number TEXT;
BEGIN
    -- Get month abbreviation (JAN, FEB, MAR, APR, MAY, JUN, JUL, AUG, SEP, OCT, NOV, DEC)
    month_abbr := UPPER(TO_CHAR(invoice_date, 'MON'));
    
    -- Get the next sequential number for THIS SPECIFIC month/year only (based on invoice_date)
    -- This ensures numbering resets each month (NOV050 -> DEC001)
    SELECT COALESCE(MAX(
        CASE 
            WHEN invoice_number ~ ('^' || month_abbr || '[0-9]{3}$') 
            THEN CAST(SUBSTRING(invoice_number FROM LENGTH(month_abbr) + 1) AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO next_number
    FROM public.invoices 
    WHERE EXTRACT(MONTH FROM COALESCE(invoice_date, CURRENT_DATE)) = EXTRACT(MONTH FROM invoice_date)
    AND EXTRACT(YEAR FROM COALESCE(invoice_date, CURRENT_DATE)) = EXTRACT(YEAR FROM invoice_date);
    
    -- Format as MMMXXX (e.g., NOV001, DEC001)
    invoice_number := month_abbr || LPAD(next_number::TEXT, 3, '0');
    
    RETURN invoice_number;
END;
$$ LANGUAGE plpgsql;

-- Migrate existing invoice_title data to invoice_number for existing records
-- Use invoice_date if available, otherwise fall back to created_at for migration
UPDATE public.invoices 
SET invoice_number = COALESCE(
    NULLIF(invoice_number, ''), 
    NULLIF(invoice_title, ''),
    generate_invoice_number(COALESCE(invoice_date, created_at::date))
)
WHERE invoice_number IS NULL OR invoice_number = '';

-- Make invoice_number NOT NULL after migration
ALTER TABLE public.invoices ALTER COLUMN invoice_number SET NOT NULL;

-- Add comments to clarify field usage
COMMENT ON COLUMN public.invoices.invoice_type IS 'Invoice type: Mechlin LLC or Mechlin Indian';
COMMENT ON COLUMN public.invoices.invoice_number IS 'Invoice number in format MMMXXX (e.g., NOV001, DEC002) - replaces invoice_title as primary identifier';
COMMENT ON COLUMN public.invoices.invoice_title IS 'Legacy field - use invoice_number instead';
COMMENT ON COLUMN public.invoices.client_address IS 'Client address (auto-filled from client master)';
COMMENT ON COLUMN public.invoices.client_state IS 'Client state (auto-filled from client master)';
COMMENT ON COLUMN public.invoices.client_zip_code IS 'Client ZIP code (auto-filled from client master)';
COMMENT ON COLUMN public.invoices.service_period_start IS 'Service period start date (only for Mechlin Indian)';
COMMENT ON COLUMN public.invoices.service_period_end IS 'Service period end date (only for Mechlin Indian)';
COMMENT ON COLUMN public.invoices.reference_invoice_numbers IS 'Reference invoice numbers (only for Mechlin LLC)';
COMMENT ON COLUMN public.invoices.payment_receive_date IS 'Date when payment was received (enabled when status = paid)';
COMMENT ON COLUMN public.invoices.amount_received IS 'Amount received (enabled when status = paid)';
COMMENT ON COLUMN public.invoices.pending_amount IS 'Any pending amount (enabled when status = paid)';
COMMENT ON COLUMN public.invoices.payment_remarks IS 'Payment remarks (enabled when status = paid)';

-- Create invoice_tasks table for multiple tasks per invoice
CREATE TABLE IF NOT EXISTS public.invoice_tasks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    task_name text NOT NULL,
    task_description text,
    hours numeric(8,2) NOT NULL CHECK (hours > 0),
    rate_per_hour numeric(10,2) NOT NULL CHECK (rate_per_hour > 0),
    total_amount numeric(10,2) GENERATED ALWAYS AS (hours * rate_per_hour) STORED,
    display_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Add comments for invoice_tasks table
COMMENT ON TABLE public.invoice_tasks IS 'Tasks associated with each invoice - multiple tasks can be added per invoice';
COMMENT ON COLUMN public.invoice_tasks.task_name IS 'Name/title of the task';
COMMENT ON COLUMN public.invoice_tasks.task_description IS 'Detailed description of the task';
COMMENT ON COLUMN public.invoice_tasks.hours IS 'Number of hours worked on this task';
COMMENT ON COLUMN public.invoice_tasks.rate_per_hour IS 'Hourly rate for this task';
COMMENT ON COLUMN public.invoice_tasks.total_amount IS 'Calculated total amount (hours * rate_per_hour)';
COMMENT ON COLUMN public.invoice_tasks.display_order IS 'Order in which tasks should be displayed';

-- Update client_master table to ensure it has all required fields
-- (The table already exists, so we'll add any missing fields)
ALTER TABLE public.client_master 
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS country text DEFAULT 'United States',
ADD COLUMN IF NOT EXISTS tax_id text,
ADD COLUMN IF NOT EXISTS billing_contact_name text,
ADD COLUMN IF NOT EXISTS billing_contact_email text,
ADD COLUMN IF NOT EXISTS payment_method text CHECK (payment_method IN ('wire_transfer', 'check', 'ach', 'credit_card', 'other')),
ADD COLUMN IF NOT EXISTS payment_terms_days integer DEFAULT 30,
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Add comments for client_master fields
COMMENT ON COLUMN public.client_master.phone IS 'Client phone number';
COMMENT ON COLUMN public.client_master.country IS 'Client country';
COMMENT ON COLUMN public.client_master.tax_id IS 'Client tax identification number';
COMMENT ON COLUMN public.client_master.billing_contact_name IS 'Billing contact person name';
COMMENT ON COLUMN public.client_master.billing_contact_email IS 'Billing contact email address';
COMMENT ON COLUMN public.client_master.payment_method IS 'Preferred payment method';
COMMENT ON COLUMN public.client_master.payment_terms_days IS 'Default payment terms in days';
COMMENT ON COLUMN public.client_master.is_active IS 'Whether the client is active';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_type ON public.invoices(invoice_type);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON public.invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_client_name ON public.invoices(client_name);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON public.invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_assigned_finance_poc ON public.invoices(assigned_finance_poc);

CREATE INDEX IF NOT EXISTS idx_invoice_tasks_invoice_id ON public.invoice_tasks(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_tasks_display_order ON public.invoice_tasks(display_order);

CREATE INDEX IF NOT EXISTS idx_client_master_client_name ON public.client_master(client_name);
CREATE INDEX IF NOT EXISTS idx_client_master_is_active ON public.client_master(is_active);

-- Create a function to auto-populate client details when client is selected
CREATE OR REPLACE FUNCTION public.populate_client_details()
RETURNS trigger AS $$
BEGIN
    -- Auto-populate client details from client_master when client_name is set
    IF NEW.client_name IS NOT NULL AND NEW.client_name != '' THEN
        SELECT 
            address,
            state,
            zip_code
        INTO 
            NEW.client_address,
            NEW.client_state,
            NEW.client_zip_code
        FROM public.client_master 
        WHERE client_name = NEW.client_name 
        AND is_active = true
        LIMIT 1;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-populate client details
DROP TRIGGER IF EXISTS trigger_populate_client_details ON public.invoices;
CREATE TRIGGER trigger_populate_client_details
    BEFORE INSERT OR UPDATE ON public.invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.populate_client_details();

-- Create a function to calculate invoice total from tasks
CREATE OR REPLACE FUNCTION public.calculate_invoice_total()
RETURNS trigger AS $$
BEGIN
    -- Update the invoice amount based on sum of all tasks
    UPDATE public.invoices 
    SET invoice_amount = (
        SELECT COALESCE(SUM(total_amount), 0)
        FROM public.invoice_tasks 
        WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
    )
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers to auto-calculate invoice total when tasks change
DROP TRIGGER IF EXISTS trigger_calculate_invoice_total_insert ON public.invoice_tasks;
CREATE TRIGGER trigger_calculate_invoice_total_insert
    AFTER INSERT ON public.invoice_tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.calculate_invoice_total();

DROP TRIGGER IF EXISTS trigger_calculate_invoice_total_update ON public.invoice_tasks;
CREATE TRIGGER trigger_calculate_invoice_total_update
    AFTER UPDATE ON public.invoice_tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.calculate_invoice_total();

DROP TRIGGER IF EXISTS trigger_calculate_invoice_total_delete ON public.invoice_tasks;
CREATE TRIGGER trigger_calculate_invoice_total_delete
    AFTER DELETE ON public.invoice_tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.calculate_invoice_total();

-- Create updated_at trigger for invoice_tasks
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_invoice_tasks_updated_at ON public.invoice_tasks;
CREATE TRIGGER trigger_update_invoice_tasks_updated_at
    BEFORE UPDATE ON public.invoice_tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS on new table
ALTER TABLE public.invoice_tasks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for invoice_tasks
CREATE POLICY "Users can view invoice tasks for invoices they can access" ON public.invoice_tasks
    FOR SELECT USING (
        invoice_id IN (
            SELECT id FROM public.invoices 
            WHERE assigned_finance_poc = auth.uid() 
            OR created_by = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.users 
                WHERE id = auth.uid() 
                AND (
                    role_id IN (
                        SELECT id FROM public.roles 
                        WHERE name IN ('Super Admin', 'HR', 'Finance')
                    )
                    OR additional_role_ids && ARRAY(
                        SELECT id FROM public.roles 
                        WHERE name IN ('Super Admin', 'HR', 'Finance')
                    )::uuid[]
                )
            )
        )
    );

CREATE POLICY "Users can insert invoice tasks for invoices they can manage" ON public.invoice_tasks
    FOR INSERT WITH CHECK (
        invoice_id IN (
            SELECT id FROM public.invoices 
            WHERE assigned_finance_poc = auth.uid() 
            OR created_by = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.users 
                WHERE id = auth.uid() 
                AND (
                    role_id IN (
                        SELECT id FROM public.roles 
                        WHERE name IN ('Super Admin', 'HR', 'Finance')
                    )
                    OR additional_role_ids && ARRAY(
                        SELECT id FROM public.roles 
                        WHERE name IN ('Super Admin', 'HR', 'Finance')
                    )::uuid[]
                )
            )
        )
    );

CREATE POLICY "Users can update invoice tasks for invoices they can manage" ON public.invoice_tasks
    FOR UPDATE USING (
        invoice_id IN (
            SELECT id FROM public.invoices 
            WHERE assigned_finance_poc = auth.uid() 
            OR created_by = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.users 
                WHERE id = auth.uid() 
                AND (
                    role_id IN (
                        SELECT id FROM public.roles 
                        WHERE name IN ('Super Admin', 'HR', 'Finance')
                    )
                    OR additional_role_ids && ARRAY(
                        SELECT id FROM public.roles 
                        WHERE name IN ('Super Admin', 'HR', 'Finance')
                    )::uuid[]
                )
            )
        )
    );

CREATE POLICY "Users can delete invoice tasks for invoices they can manage" ON public.invoice_tasks
    FOR DELETE USING (
        invoice_id IN (
            SELECT id FROM public.invoices 
            WHERE assigned_finance_poc = auth.uid() 
            OR created_by = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.users 
                WHERE id = auth.uid() 
                AND (
                    role_id IN (
                        SELECT id FROM public.roles 
                        WHERE name IN ('Super Admin', 'HR', 'Finance')
                    )
                    OR additional_role_ids && ARRAY(
                        SELECT id FROM public.roles 
                        WHERE name IN ('Super Admin', 'HR', 'Finance')
                    )::uuid[]
                )
            )
        )
    );

-- Create a view for easy invoice management with calculated totals
CREATE OR REPLACE VIEW public.invoice_summary AS
SELECT 
    i.*,
    COALESCE(task_summary.task_count, 0) as task_count,
    COALESCE(task_summary.total_hours, 0) as total_hours,
    COALESCE(task_summary.calculated_total, 0) as calculated_total,
    cm.address as client_full_address,
    cm.phone as client_phone,
    cm.tax_id as client_tax_id,
    u.full_name as assigned_finance_poc_name,
    creator.full_name as created_by_name
FROM public.invoices i
LEFT JOIN (
    SELECT 
        invoice_id,
        COUNT(*) as task_count,
        SUM(hours) as total_hours,
        SUM(total_amount) as calculated_total
    FROM public.invoice_tasks
    GROUP BY invoice_id
) task_summary ON i.id = task_summary.invoice_id
LEFT JOIN public.client_master cm ON i.client_name = cm.client_name
LEFT JOIN public.users u ON i.assigned_finance_poc = u.id
LEFT JOIN public.users creator ON i.created_by = creator.id;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_tasks TO authenticated;
GRANT SELECT ON public.invoice_summary TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Add some sample data for testing (optional - can be removed in production)
-- This will only insert if no data exists
DO $$
BEGIN
    -- Insert sample client if none exists
    IF NOT EXISTS (SELECT 1 FROM public.client_master LIMIT 1) THEN
        INSERT INTO public.client_master (
            client_name, 
            client_email, 
            recipient_name, 
            recipient_email,
            address, 
            state, 
            zip_code,
            phone,
            country,
            is_active
        ) VALUES (
            'Sample Client Corp',
            'billing@sampleclient.com',
            'John Doe',
            'john.doe@sampleclient.com',
            '123 Business Street, Suite 100',
            'California',
            '90210',
            '+1-555-123-4567',
            'United States',
            true
        );
    END IF;
END $$;

-- Create helpful functions for frontend
CREATE OR REPLACE FUNCTION public.get_finance_users()
RETURNS TABLE (
    id uuid,
    full_name text,
    email text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.full_name,
        u.email
    FROM public.users u
    WHERE u.role_id IN (
        SELECT r.id FROM public.roles r 
        WHERE r.name IN ('Finance', 'Super Admin')
    )
    OR u.additional_role_ids && ARRAY(
        SELECT r.id FROM public.roles r 
        WHERE r.name IN ('Finance', 'Super Admin')
    )::uuid[]
    ORDER BY u.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.get_finance_users() TO authenticated;
