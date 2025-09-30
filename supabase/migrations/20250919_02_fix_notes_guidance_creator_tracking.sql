-- Fix notes guidance creator tracking
-- Add foreign key constraints and populate missing created_by data

-- Add foreign key constraints if they don't exist
DO $$ 
BEGIN
    -- Add foreign key constraint for created_by
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'asset_notes_guidance_created_by_fkey' 
        AND table_name = 'asset_notes_guidance'
    ) THEN
        ALTER TABLE asset_notes_guidance 
        ADD CONSTRAINT asset_notes_guidance_created_by_fkey 
        FOREIGN KEY (created_by) REFERENCES users(id);
    END IF;

    -- Add foreign key constraint for updated_by
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'asset_notes_guidance_updated_by_fkey' 
        AND table_name = 'asset_notes_guidance'
    ) THEN
        ALTER TABLE asset_notes_guidance 
        ADD CONSTRAINT asset_notes_guidance_updated_by_fkey 
        FOREIGN KEY (updated_by) REFERENCES users(id);
    END IF;
END $$;

-- Update existing records where created_by is null
-- Set created_by to updated_by if available, or to the first admin user as fallback
UPDATE asset_notes_guidance 
SET created_by = COALESCE(
    updated_by,
    (SELECT id FROM users 
     WHERE role_id IN (SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'hr'))
     ORDER BY created_at ASC 
     LIMIT 1)
)
WHERE created_by IS NULL;

-- Add comments for documentation
COMMENT ON CONSTRAINT asset_notes_guidance_created_by_fkey ON asset_notes_guidance 
IS 'Ensures created_by references a valid user';

COMMENT ON CONSTRAINT asset_notes_guidance_updated_by_fkey ON asset_notes_guidance 
IS 'Ensures updated_by references a valid user';

-- Ensure RLS policies work with the foreign key relationships
-- (The previous migration already fixed the RLS policies)
