/*
  # Extended Asset Management Fields

  1. New Asset Fields
    - Insurance/Warranty extended date
    - Previous audit date (for software licenses)
    - Hardware Image date (quarterly basis)
    - Invoice copy link
    - Warranty document link

  2. Features
    - Extended asset tracking capabilities
    - Document management links
    - Audit and compliance tracking
    - Insurance and warranty management
*/

-- Add new fields to assets table
DO $$ 
BEGIN
  -- Insurance/Warranty extended date
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'assets' AND column_name = 'insurance_warranty_extended') THEN
    ALTER TABLE assets ADD COLUMN insurance_warranty_extended date;
  END IF;

  -- Previous audit date (for software licenses)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'assets' AND column_name = 'previous_audit_date') THEN
    ALTER TABLE assets ADD COLUMN previous_audit_date date;
  END IF;

  -- Hardware Image date (quarterly basis)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'assets' AND column_name = 'hardware_image_date') THEN
    ALTER TABLE assets ADD COLUMN hardware_image_date date;
  END IF;

  -- Invoice copy link
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'assets' AND column_name = 'invoice_copy_link') THEN
    ALTER TABLE assets ADD COLUMN invoice_copy_link text;
  END IF;

  -- Warranty document link
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'assets' AND column_name = 'warranty_document_link') THEN
    ALTER TABLE assets ADD COLUMN warranty_document_link text;
  END IF;
END $$;

-- Add indexes for the new date fields for better performance
CREATE INDEX IF NOT EXISTS idx_assets_insurance_warranty_extended ON assets(insurance_warranty_extended);
CREATE INDEX IF NOT EXISTS idx_assets_previous_audit_date ON assets(previous_audit_date);
CREATE INDEX IF NOT EXISTS idx_assets_hardware_image_date ON assets(hardware_image_date);

-- Create function to create new asset category dynamically
CREATE OR REPLACE FUNCTION create_asset_category_if_not_exists(
  p_category_name text,
  p_description text DEFAULT NULL,
  p_depreciation_rate numeric DEFAULT 10.00
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_category_id uuid;
  v_clean_name text;
BEGIN
  -- Clean the category name (remove "Others - " prefix if present)
  v_clean_name := TRIM(REGEXP_REPLACE(p_category_name, '^Others\s*-\s*', '', 'i'));
  
  -- Check if category already exists
  SELECT id INTO v_category_id 
  FROM asset_categories 
  WHERE LOWER(name) = LOWER(v_clean_name);
  
  -- If category doesn't exist, create it
  IF v_category_id IS NULL THEN
    INSERT INTO asset_categories (name, description, depreciation_rate)
    VALUES (
      v_clean_name,
      COALESCE(p_description, 'Custom category: ' || v_clean_name),
      p_depreciation_rate
    )
    RETURNING id INTO v_category_id;
  END IF;
  
  RETURN v_category_id;
END;
$$;

-- Grant execute permission for the function
GRANT EXECUTE ON FUNCTION create_asset_category_if_not_exists TO authenticated;

-- Add helpful comments for new fields
COMMENT ON COLUMN assets.insurance_warranty_extended IS 'Extended insurance or warranty expiration date';
COMMENT ON COLUMN assets.previous_audit_date IS 'Last audit date, particularly useful for software licenses';
COMMENT ON COLUMN assets.hardware_image_date IS 'Date when hardware image was last taken (quarterly basis)';
COMMENT ON COLUMN assets.invoice_copy_link IS 'Link to invoice document/file';
COMMENT ON COLUMN assets.warranty_document_link IS 'Link to warranty document/file';

COMMENT ON FUNCTION create_asset_category_if_not_exists IS 'Creates a new asset category if it does not exist, returns category ID';
