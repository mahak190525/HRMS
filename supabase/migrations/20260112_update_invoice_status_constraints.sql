-- Update invoice status constraints to replace 'assigned' with 'partially_paid'
-- and set default status to 'in_progress'

-- Drop the existing status constraint
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;

-- Add the new status constraint with 'partially_paid' instead of 'assigned'
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check 
  CHECK (status IN ('in_progress', 'partially_paid', 'sent', 'paid', 'overdue'));

-- Update any existing 'assigned' status records to 'in_progress'
UPDATE invoices SET status = 'in_progress' WHERE status = 'assigned';

-- Update the default status for the status column
ALTER TABLE invoices ALTER COLUMN status SET DEFAULT 'in_progress';
