-- Migration: Create app_config table for global configuration
-- Single row table with JSONB columns for Indian and LLC details

-- Create the app_config table
CREATE TABLE IF NOT EXISTS public.app_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    indian_deets JSONB DEFAULT '{}',
    llc_deets JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Enforce single row constraint
    CONSTRAINT single_row_only CHECK (id = 1)
);

-- Create unique index to enforce single row
CREATE UNIQUE INDEX IF NOT EXISTS app_config_single_row_idx ON public.app_config (id);

-- Insert the initial configuration row
INSERT INTO public.app_config (id, indian_deets, llc_deets) 
VALUES (1, 
    -- Indian details with example structure
    '{
        "bank": {
            "account_name": "",
            "bank_name": "",
            "account_no": "",
            "ifsc_code": "",
            "gstin": "",
            "pan": "",
            "registration_number": ""
        },
        "email": ""
    }',
    -- LLC details with example structure
    '{
        "ach": {
            "bank_name": "",
            "account_name": "",
            "ach_routing_number": "",
            "account_number": ""
        },
        "wire": {
            "bank_name": "",
            "account_name": "",
            "wire_routing_number": "",
            "account_number": "",
            "domestic_swift_code": "",
            "foreign_swift_code": ""
        },
        "email": ""
    }'
) ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Policy: Allow unrestricted read access
CREATE POLICY "app_config_read_policy" ON public.app_config
    FOR SELECT
    USING (true);

-- Policy: Only admin users can insert (though only one row allowed)
CREATE POLICY "app_config_insert_policy" ON public.app_config
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
        )
    );

-- Policy: Only admin users can update
CREATE POLICY "app_config_update_policy" ON public.app_config
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
        )
    );

-- Policy: Only admin users can delete
CREATE POLICY "app_config_delete_policy" ON public.app_config
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
        )
    );

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_app_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER app_config_updated_at_trigger
    BEFORE UPDATE ON public.app_config
    FOR EACH ROW
    EXECUTE FUNCTION public.update_app_config_updated_at();

-- Example queries for working with the configuration

-- 1. Read all configuration
-- SELECT * FROM public.app_config WHERE id = 1;

-- 2. Read specific JSONB column
-- SELECT indian_deets FROM public.app_config WHERE id = 1;
-- SELECT llc_deets FROM public.app_config WHERE id = 1;

-- 3. Read specific nested field
-- SELECT indian_deets->'bank'->>'account_name' as indian_account_name FROM public.app_config WHERE id = 1;
-- SELECT llc_deets->'ach'->>'bank_name' as llc_ach_bank FROM public.app_config WHERE id = 1;

-- 4. Update entire JSONB column (replace)
-- UPDATE public.app_config 
-- SET indian_deets = '{
--     "bank": {
--         "account_name": "Mechlin Technologies Pvt Ltd",
--         "bank_name": "State Bank of India",
--         "account_no": "1234567890",
--         "ifsc_code": "SBIN0001234",
--         "gstin": "07AABCM1234A1Z5",
--         "pan": "AABCM1234A",
--         "registration_number": "U72900DL2020PTC123456"
--     },
--     "email": "finance.india@mechlintech.com"
-- }' 
-- WHERE id = 1;

-- 5. Update specific nested field (merge)
-- UPDATE public.app_config 
-- SET indian_deets = jsonb_set(
--     indian_deets, 
--     '{bank,account_name}', 
--     '"Mechlin Technologies Pvt Ltd"'
-- ) 
-- WHERE id = 1;

-- 6. Update multiple nested fields
-- UPDATE public.app_config 
-- SET llc_deets = jsonb_set(
--     jsonb_set(llc_deets, '{ach,bank_name}', '"Chase Bank"'),
--     '{ach,account_name}', 
--     '"Mechlin Technologies LLC"'
-- ) 
-- WHERE id = 1;

-- 7. Merge new fields into existing JSONB
-- UPDATE public.app_config 
-- SET indian_deets = indian_deets || '{"email": "updated@mechlintech.com"}'
-- WHERE id = 1;

-- 8. Delete specific field from JSONB
-- UPDATE public.app_config 
-- SET indian_deets = indian_deets - 'email'
-- WHERE id = 1;

-- 9. Delete nested field from JSONB
-- UPDATE public.app_config 
-- SET indian_deets = indian_deets #- '{bank,registration_number}'
-- WHERE id = 1;

-- 10. Check if field exists
-- SELECT EXISTS(
--     SELECT 1 FROM public.app_config 
--     WHERE id = 1 AND indian_deets ? 'email'
-- ) as has_email;

-- 11. Get all keys from JSONB object
-- SELECT jsonb_object_keys(indian_deets->'bank') as bank_fields 
-- FROM public.app_config WHERE id = 1;
