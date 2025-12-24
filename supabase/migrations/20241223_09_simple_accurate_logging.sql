-- Migration: Simple accurate logging implementation
-- Description: Clean implementation of API-level logging without parameter issues
-- Date: 2024-12-23

-- Remove any existing triggers
DROP TRIGGER IF EXISTS invoice_change_log_trigger ON public.invoices;
DROP TRIGGER IF EXISTS invoice_task_change_log_trigger ON public.invoice_tasks;

-- Ensure logging tables exist with correct structure
CREATE TABLE IF NOT EXISTS public.invoice_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    action text NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'status_changed')),
    field_name text,
    old_value jsonb,
    new_value jsonb,
    changed_by uuid REFERENCES public.users(id),
    change_reason text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_task_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    task_id uuid REFERENCES public.invoice_tasks(id) ON DELETE SET NULL,
    action text NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
    field_name text,
    old_value jsonb,
    new_value jsonb,
    changed_by uuid REFERENCES public.users(id),
    change_reason text,
    created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoice_logs_invoice_id_created_at ON public.invoice_logs(invoice_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_task_logs_invoice_id_created_at ON public.invoice_task_logs(invoice_id, created_at DESC);

-- Simple function to log invoice changes (no default parameters to avoid issues)
CREATE OR REPLACE FUNCTION log_invoice_change_simple(
    p_invoice_id uuid,
    p_action text,
    p_field_name text,
    p_old_value jsonb,
    p_new_value jsonb,
    p_changed_by uuid,
    p_change_reason text
)
RETURNS uuid AS $$
DECLARE
    log_id uuid;
BEGIN
    INSERT INTO public.invoice_logs (
        invoice_id,
        action,
        field_name,
        old_value,
        new_value,
        changed_by,
        change_reason
    ) VALUES (
        p_invoice_id,
        p_action,
        p_field_name,
        p_old_value,
        p_new_value,
        p_changed_by,
        p_change_reason
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- Simple function to log task changes (no default parameters)
CREATE OR REPLACE FUNCTION log_task_change_simple(
    p_invoice_id uuid,
    p_action text,
    p_task_id uuid,
    p_field_name text,
    p_old_value jsonb,
    p_new_value jsonb,
    p_changed_by uuid,
    p_change_reason text
)
RETURNS uuid AS $$
DECLARE
    log_id uuid;
BEGIN
    INSERT INTO public.invoice_task_logs (
        invoice_id,
        task_id,
        action,
        field_name,
        old_value,
        new_value,
        changed_by,
        change_reason
    ) VALUES (
        p_invoice_id,
        p_task_id,
        p_action,
        p_field_name,
        p_old_value,
        p_new_value,
        p_changed_by,
        p_change_reason
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- Create the comparison views
CREATE OR REPLACE VIEW public.invoice_comparison_view AS
SELECT 
    id,
    invoice_type,
    invoice_number,
    invoice_title,
    client_name,
    project,
    billing_reference,
    invoice_amount,
    due_date,
    payment_terms,
    currency,
    notes_to_finance,
    status,
    client_address,
    client_state,
    client_zip_code,
    invoice_date,
    service_period_start,
    service_period_end,
    reference_invoice_numbers,
    payment_receive_date,
    amount_received,
    pending_amount,
    payment_remarks,
    assigned_finance_poc,
    created_by,
    last_modified_by,
    created_at,
    updated_at
FROM public.invoices;

CREATE OR REPLACE VIEW public.task_comparison_view AS
SELECT 
    id,
    invoice_id,
    task_name,
    task_description,
    hours,
    rate_per_hour,
    total_amount,
    display_order,
    created_at,
    updated_at
FROM public.invoice_tasks;

-- Recreate the detailed views
CREATE OR REPLACE VIEW public.invoice_logs_with_details AS
SELECT 
    il.*,
    i.invoice_number,
    i.client_name,
    i.invoice_amount,
    i.status as current_status,
    u.full_name as changed_by_name,
    u.email as changed_by_email,
    u.avatar_url as changed_by_avatar
FROM public.invoice_logs il
JOIN public.invoices i ON il.invoice_id = i.id
LEFT JOIN public.users u ON il.changed_by = u.id
ORDER BY il.created_at DESC;

CREATE OR REPLACE VIEW public.invoice_task_logs_with_details AS
SELECT 
    itl.*,
    i.invoice_number,
    i.client_name,
    it.task_name,
    it.hours,
    it.rate_per_hour,
    it.total_amount,
    u.full_name as changed_by_name,
    u.email as changed_by_email,
    u.avatar_url as changed_by_avatar
FROM public.invoice_task_logs itl
JOIN public.invoices i ON itl.invoice_id = i.id
LEFT JOIN public.invoice_tasks it ON itl.task_id = it.id
LEFT JOIN public.users u ON itl.changed_by = u.id
ORDER BY itl.created_at DESC;

-- Grant permissions
GRANT SELECT, INSERT ON public.invoice_logs TO authenticated;
GRANT SELECT, INSERT ON public.invoice_task_logs TO authenticated;
GRANT SELECT ON public.invoice_logs_with_details TO authenticated;
GRANT SELECT ON public.invoice_task_logs_with_details TO authenticated;
GRANT SELECT ON public.invoice_comparison_view TO authenticated;
GRANT SELECT ON public.task_comparison_view TO authenticated;
GRANT EXECUTE ON FUNCTION log_invoice_change_simple TO authenticated;
GRANT EXECUTE ON FUNCTION log_task_change_simple TO authenticated;

-- Simple test function
CREATE OR REPLACE FUNCTION test_simple_logging()
RETURNS text AS $$
DECLARE
    test_invoice_id uuid;
    log_id uuid;
BEGIN
    -- Get a test invoice
    SELECT id INTO test_invoice_id FROM public.invoices LIMIT 1;
    
    IF test_invoice_id IS NULL THEN
        RETURN 'No invoices found for testing';
    END IF;
    
    -- Test logging
    SELECT log_invoice_change_simple(
        test_invoice_id,
        'updated',
        'test_field',
        '"old_value"'::jsonb,
        '"new_value"'::jsonb,
        NULL,
        'Test log entry'
    ) INTO log_id;
    
    IF log_id IS NOT NULL THEN
        -- Clean up
        DELETE FROM public.invoice_logs WHERE id = log_id;
        RETURN 'Simple logging is working correctly';
    ELSE
        RETURN 'Simple logging failed';
    END IF;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION test_simple_logging TO authenticated;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Simple accurate logging system implemented successfully';
    RAISE NOTICE 'Use log_invoice_change_simple() and log_task_change_simple() functions';
END $$;
