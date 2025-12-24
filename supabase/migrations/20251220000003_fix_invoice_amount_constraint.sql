-- Migration: Fix invoice amount constraint to allow 0 values
-- Description: Updates the invoice_amount check constraint to allow 0 values for task-based invoices
-- Date: 2024-12-20

-- Drop the existing constraint that requires invoice_amount > 0
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_invoice_amount_check;

-- Add new constraint that allows invoice_amount >= 0 (including 0)
ALTER TABLE public.invoices ADD CONSTRAINT invoices_invoice_amount_check CHECK (invoice_amount >= 0);

-- Also check for any other similar constraints that might exist
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_amount_check;

-- Add comment to clarify the change
COMMENT ON CONSTRAINT invoices_invoice_amount_check ON public.invoices IS 'Invoice amount can be 0 or greater. Zero is allowed for invoices that calculate total from tasks.';
