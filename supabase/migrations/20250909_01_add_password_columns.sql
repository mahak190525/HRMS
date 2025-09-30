-- Migration: Add plain text password columns to virtual_machines table
-- Created: 2025-01-16
-- Purpose: Add current_password and previous_password columns for plain text storage

-- Add current_password column (plain text)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'virtual_machines' AND column_name = 'current_password') THEN
    ALTER TABLE virtual_machines ADD COLUMN current_password text;
  END IF;
END $$;

-- Add previous_password column (plain text)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'virtual_machines' AND column_name = 'previous_password') THEN
    ALTER TABLE virtual_machines ADD COLUMN previous_password text;
  END IF;
END $$;

-- Add comments to clarify the purpose of these columns
COMMENT ON COLUMN virtual_machines.current_password IS 'Current password in plain text for VM access';
COMMENT ON COLUMN virtual_machines.previous_password IS 'Previous password in plain text for audit trail';
COMMENT ON COLUMN virtual_machines.current_password_hash IS 'Hashed current password (legacy, consider using current_password)';
COMMENT ON COLUMN virtual_machines.previous_password_hash IS 'Hashed previous password (legacy, consider using previous_password)';
