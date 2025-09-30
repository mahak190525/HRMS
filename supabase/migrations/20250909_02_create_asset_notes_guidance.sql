/*
  # Asset Notes Guidance System

  This migration creates a table to store guidance information that users should 
  keep in mind while filling the 'Notes' field when creating any asset.

  1. Tables
    - `asset_notes_guidance` - Stores guidance information with title and text

  2. Features
    - Simple CRUD operations for guidance management
    - Version tracking with created_at/updated_at
    - Single row table to store current guidance

  3. Security
    - Enable RLS on asset_notes_guidance table
    - HR/Admin can manage guidance
    - All authenticated users can read guidance
*/

-- Create asset_notes_guidance table
CREATE TABLE IF NOT EXISTS asset_notes_guidance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Guidance Information
  title text NOT NULL DEFAULT 'Asset Notes Guidelines',
  guidance_text text NOT NULL DEFAULT 'Please provide detailed and accurate information in the notes field when creating assets.',
  
  -- Version and tracking
  version integer DEFAULT 1,
  is_active boolean DEFAULT true,
  
  -- System fields
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_asset_notes_guidance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for asset_notes_guidance updated_at
CREATE TRIGGER update_asset_notes_guidance_updated_at
  BEFORE UPDATE ON asset_notes_guidance
  FOR EACH ROW
  EXECUTE FUNCTION update_asset_notes_guidance_updated_at();

-- Insert default guidance
INSERT INTO asset_notes_guidance (title, guidance_text, created_by) 
VALUES (
  'Asset Notes Guidelines',
  E'When filling out the Notes field for assets, please include the following information:\n\n• Asset condition details (any scratches, dents, or wear)\n• Special configurations or settings\n• Included accessories or peripherals\n• Warranty information and coverage details\n• Previous repair or maintenance history\n• Any known issues or limitations\n• Installation requirements or dependencies\n• License information (for software assets)\n• Location-specific details\n• Contact person for technical support\n\nBe specific and detailed to help with future asset management and troubleshooting.',
  (SELECT id FROM users WHERE email = 'admin@mechlin.com' LIMIT 1)
) ON CONFLICT DO NOTHING;

-- Enable RLS on asset_notes_guidance
ALTER TABLE asset_notes_guidance ENABLE ROW LEVEL SECURITY;

-- RLS Policies for asset_notes_guidance

-- All authenticated users can read guidance
CREATE POLICY "All users can read asset notes guidance"
  ON asset_notes_guidance FOR SELECT
  TO authenticated
  USING (is_active = true);

-- HR/Admin can manage guidance
CREATE POLICY "HR can manage asset notes guidance"
  ON asset_notes_guidance FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role_id IN (
        SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'hr')
      )
    )
  );

-- Temporary policy for testing - all authenticated users can create guidance
-- You can remove this policy later and keep only the HR policy above
CREATE POLICY "All authenticated users can create asset notes guidance"
  ON asset_notes_guidance FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_asset_notes_guidance_active ON asset_notes_guidance(is_active);
CREATE INDEX IF NOT EXISTS idx_asset_notes_guidance_version ON asset_notes_guidance(version);

-- Add helpful comments
COMMENT ON TABLE asset_notes_guidance IS 'Stores guidance information for asset notes field to help users provide consistent and comprehensive asset information';
COMMENT ON COLUMN asset_notes_guidance.title IS 'Title/heading for the guidance section';
COMMENT ON COLUMN asset_notes_guidance.guidance_text IS 'Detailed text explaining what information should be included in asset notes';
COMMENT ON COLUMN asset_notes_guidance.version IS 'Version number for tracking guidance changes';
COMMENT ON COLUMN asset_notes_guidance.is_active IS 'Whether this guidance version is currently active';

-- Create a view for getting the current active guidance
CREATE OR REPLACE VIEW current_asset_notes_guidance AS
SELECT 
  ang.id,
  ang.title,
  ang.guidance_text,
  ang.version,
  ang.created_at,
  ang.updated_at,
  u1.full_name as created_by_name,
  u2.full_name as updated_by_name
FROM asset_notes_guidance ang
LEFT JOIN users u1 ON ang.created_by = u1.id
LEFT JOIN users u2 ON ang.updated_by = u2.id
WHERE ang.is_active = true
ORDER BY ang.version DESC
LIMIT 1;

-- Grant permissions for the view
GRANT SELECT ON current_asset_notes_guidance TO authenticated;

-- Function to update guidance (creates new version while keeping history)
CREATE OR REPLACE FUNCTION update_asset_notes_guidance(
  p_title text,
  p_guidance_text text,
  p_updated_by uuid
)
RETURNS uuid AS $$
DECLARE
  v_new_version integer;
  v_new_id uuid;
BEGIN
  -- Deactivate current guidance
  UPDATE asset_notes_guidance SET is_active = false WHERE is_active = true;
  
  -- Get next version number
  SELECT COALESCE(MAX(version), 0) + 1 INTO v_new_version FROM asset_notes_guidance;
  
  -- Insert new guidance version
  INSERT INTO asset_notes_guidance (title, guidance_text, version, updated_by, created_by)
  VALUES (p_title, p_guidance_text, v_new_version, p_updated_by, p_updated_by)
  RETURNING id INTO v_new_id;
  
  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions for the function
GRANT EXECUTE ON FUNCTION update_asset_notes_guidance TO authenticated;
