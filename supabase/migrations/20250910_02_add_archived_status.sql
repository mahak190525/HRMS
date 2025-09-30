-- Migration: Add 'archived' status to assets table
-- This allows assets to be marked as archived when damaged or retired

-- Drop the existing constraint
ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_status_check;

-- Add the new constraint with 'archived' status
ALTER TABLE assets ADD CONSTRAINT assets_status_check 
  CHECK (status IN ('available', 'assigned', 'maintenance', 'retired', 'lost', 'archived'));

-- Update any existing damaged assets to archived status
UPDATE assets SET status = 'archived' WHERE condition = 'damaged' AND status != 'archived';
