-- Migration: Add invoice edit permissions to app_config
-- Description: Add permissions field to control invoice editing functionality
-- Date: 2024-12-25

-- Add permissions JSONB column to app_config table
ALTER TABLE public.app_config 
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';

-- Update the existing row to include invoice edit and delete permissions
UPDATE public.app_config 
SET permissions = '{
    "finance": {
        "invoices": {
            "edit": true,
            "delete": true
        }
    }
}'
WHERE id = 1;

-- Add comment for the new permissions column
COMMENT ON COLUMN public.app_config.permissions IS 'Global application permissions controlling feature access across modules';

-- Create helper function to check specific permissions
CREATE OR REPLACE FUNCTION public.check_app_permission(
    module_name text,
    feature_name text,
    permission_type text
)
RETURNS boolean AS $$
DECLARE
    permission_value boolean;
BEGIN
    -- Get the permission value from the app_config
    SELECT COALESCE(
        (permissions->module_name->feature_name->>permission_type)::boolean,
        false
    ) INTO permission_value
    FROM public.app_config 
    WHERE id = 1;
    
    RETURN COALESCE(permission_value, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.check_app_permission(text, text, text) TO authenticated;

-- Example usage queries (commented out):
-- 
-- 1. Check permissions:
-- SELECT permissions->'finance'->'invoices'->>'edit' as invoice_edit_enabled,
--        permissions->'finance'->'invoices'->>'delete' as invoice_delete_enabled 
-- FROM public.app_config WHERE id = 1;
--
-- 2. Disable invoice editing:
-- UPDATE public.app_config 
-- SET permissions = jsonb_set(permissions, '{finance,invoices,edit}', 'false')
-- WHERE id = 1;
--
-- 3. Disable invoice deletion:
-- UPDATE public.app_config 
-- SET permissions = jsonb_set(permissions, '{finance,invoices,delete}', 'false')
-- WHERE id = 1;
--
-- 4. Enable both permissions:
-- UPDATE public.app_config 
-- SET permissions = jsonb_set(
--     jsonb_set(permissions, '{finance,invoices,edit}', 'true'),
--     '{finance,invoices,delete}', 'true'
-- ) WHERE id = 1;
