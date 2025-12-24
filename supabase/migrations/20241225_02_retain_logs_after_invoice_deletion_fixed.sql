-- Migration: Retain logs after invoice deletion (Fixed Version)
-- Description: Change foreign key constraints to preserve audit logs even after invoice deletion
-- Date: 2024-12-25 (Fixed)

-- Step 1: Drop existing views first to avoid dependency issues
DROP VIEW IF EXISTS public.invoice_logs_with_details CASCADE;
DROP VIEW IF EXISTS public.invoice_task_logs_with_details CASCADE;

-- Step 2: Add new columns to preserve invoice context after deletion
ALTER TABLE public.invoice_logs 
ADD COLUMN IF NOT EXISTS deleted_invoice_number text,
ADD COLUMN IF NOT EXISTS deleted_invoice_client_name text,
ADD COLUMN IF NOT EXISTS invoice_deleted_at timestamptz;

ALTER TABLE public.invoice_task_logs 
ADD COLUMN IF NOT EXISTS deleted_invoice_number text,
ADD COLUMN IF NOT EXISTS deleted_invoice_client_name text,
ADD COLUMN IF NOT EXISTS invoice_deleted_at timestamptz;

-- Step 3: Update the invoice_logs table to allow NULL invoice_id for deleted invoices
ALTER TABLE public.invoice_logs 
ALTER COLUMN invoice_id DROP NOT NULL;

ALTER TABLE public.invoice_task_logs 
ALTER COLUMN invoice_id DROP NOT NULL;

-- Step 4: Drop existing foreign key constraints
ALTER TABLE public.invoice_logs 
DROP CONSTRAINT IF EXISTS invoice_logs_invoice_id_fkey;

ALTER TABLE public.invoice_task_logs 
DROP CONSTRAINT IF EXISTS invoice_task_logs_invoice_id_fkey;

-- Step 5: Add new constraints that preserve logs after invoice deletion
ALTER TABLE public.invoice_logs 
ADD CONSTRAINT invoice_logs_invoice_id_fkey 
FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;

ALTER TABLE public.invoice_task_logs 
ADD CONSTRAINT invoice_task_logs_invoice_id_fkey 
FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;

-- Step 6: Create function to preserve invoice context before deletion
CREATE OR REPLACE FUNCTION preserve_invoice_context_before_deletion()
RETURNS TRIGGER AS $$
BEGIN
    -- Update all logs for this invoice to preserve context
    UPDATE public.invoice_logs 
    SET 
        deleted_invoice_number = OLD.invoice_number,
        deleted_invoice_client_name = OLD.client_name,
        invoice_deleted_at = now()
    WHERE invoice_id = OLD.id;
    
    UPDATE public.invoice_task_logs 
    SET 
        deleted_invoice_number = OLD.invoice_number,
        deleted_invoice_client_name = OLD.client_name,
        invoice_deleted_at = now()
    WHERE invoice_id = OLD.id;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create trigger to automatically preserve context before invoice deletion
DROP TRIGGER IF EXISTS preserve_invoice_context_trigger ON public.invoices;
CREATE TRIGGER preserve_invoice_context_trigger
    BEFORE DELETE ON public.invoices
    FOR EACH ROW
    EXECUTE FUNCTION preserve_invoice_context_before_deletion();

-- Step 8: Recreate views with new structure
CREATE VIEW public.invoice_logs_with_details AS
SELECT 
    il.id,
    il.invoice_id,
    il.action,
    il.field_name,
    il.old_value,
    il.new_value,
    il.changed_by,
    il.change_reason,
    il.created_at,
    il.deleted_invoice_number,
    il.deleted_invoice_client_name,
    il.invoice_deleted_at,
    COALESCE(i.invoice_number, il.deleted_invoice_number) as invoice_number,
    COALESCE(i.client_name, il.deleted_invoice_client_name) as client_name,
    i.invoice_amount,
    i.status as current_status,
    u.full_name as changed_by_name,
    u.email as changed_by_email,
    u.avatar_url as changed_by_avatar,
    CASE 
        WHEN i.id IS NULL AND il.deleted_invoice_number IS NOT NULL THEN true 
        ELSE false 
    END as invoice_deleted
FROM public.invoice_logs il
LEFT JOIN public.invoices i ON il.invoice_id = i.id
LEFT JOIN public.users u ON il.changed_by = u.id
ORDER BY il.created_at DESC;

CREATE VIEW public.invoice_task_logs_with_details AS
SELECT 
    itl.id,
    itl.invoice_id,
    itl.task_id,
    itl.action,
    itl.field_name,
    itl.old_value,
    itl.new_value,
    itl.changed_by,
    itl.change_reason,
    itl.created_at,
    itl.deleted_invoice_number,
    itl.deleted_invoice_client_name,
    itl.invoice_deleted_at,
    COALESCE(i.invoice_number, itl.deleted_invoice_number) as invoice_number,
    COALESCE(i.client_name, itl.deleted_invoice_client_name) as client_name,
    it.task_name,
    it.hours,
    it.rate_per_hour,
    it.total_amount,
    u.full_name as changed_by_name,
    u.email as changed_by_email,
    u.avatar_url as changed_by_avatar,
    CASE 
        WHEN i.id IS NULL AND itl.deleted_invoice_number IS NOT NULL THEN true 
        ELSE false 
    END as invoice_deleted
FROM public.invoice_task_logs itl
LEFT JOIN public.invoices i ON itl.invoice_id = i.id
LEFT JOIN public.invoice_tasks it ON itl.task_id = it.id
LEFT JOIN public.users u ON itl.changed_by = u.id
ORDER BY itl.created_at DESC;

-- Step 9: Update logging functions to include context preservation
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
    invoice_number_val text;
    client_name_val text;
BEGIN
    -- Get invoice context for potential future reference
    SELECT invoice_number, client_name 
    INTO invoice_number_val, client_name_val
    FROM public.invoices 
    WHERE id = p_invoice_id;
    
    INSERT INTO public.invoice_logs (
        invoice_id,
        action,
        field_name,
        old_value,
        new_value,
        changed_by,
        change_reason,
        deleted_invoice_number,
        deleted_invoice_client_name
    ) VALUES (
        p_invoice_id,
        p_action,
        p_field_name,
        p_old_value,
        p_new_value,
        p_changed_by,
        p_change_reason,
        CASE WHEN p_action = 'deleted' THEN invoice_number_val ELSE NULL END,
        CASE WHEN p_action = 'deleted' THEN client_name_val ELSE NULL END
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

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
    invoice_number_val text;
    client_name_val text;
BEGIN
    -- Get invoice context for potential future reference
    SELECT invoice_number, client_name 
    INTO invoice_number_val, client_name_val
    FROM public.invoices 
    WHERE id = p_invoice_id;
    
    INSERT INTO public.invoice_task_logs (
        invoice_id,
        task_id,
        action,
        field_name,
        old_value,
        new_value,
        changed_by,
        change_reason,
        deleted_invoice_number,
        deleted_invoice_client_name
    ) VALUES (
        p_invoice_id,
        p_task_id,
        p_action,
        p_field_name,
        p_old_value,
        p_new_value,
        p_changed_by,
        p_change_reason,
        CASE WHEN p_action = 'deleted' THEN invoice_number_val ELSE NULL END,
        CASE WHEN p_action = 'deleted' THEN client_name_val ELSE NULL END
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- Step 10: Grant necessary permissions
GRANT SELECT ON public.invoice_logs_with_details TO authenticated;
GRANT SELECT ON public.invoice_task_logs_with_details TO authenticated;

-- Add comments
COMMENT ON COLUMN public.invoice_logs.deleted_invoice_number IS 'Preserved invoice number for deleted invoices (audit compliance)';
COMMENT ON COLUMN public.invoice_logs.deleted_invoice_client_name IS 'Preserved client name for deleted invoices (audit compliance)';
COMMENT ON COLUMN public.invoice_logs.invoice_deleted_at IS 'Timestamp when the invoice was deleted (audit compliance)';
COMMENT ON COLUMN public.invoice_task_logs.deleted_invoice_number IS 'Preserved invoice number for deleted invoices (audit compliance)';
COMMENT ON COLUMN public.invoice_task_logs.deleted_invoice_client_name IS 'Preserved client name for deleted invoices (audit compliance)';
COMMENT ON COLUMN public.invoice_task_logs.invoice_deleted_at IS 'Timestamp when the invoice was deleted (audit compliance)';
