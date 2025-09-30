-- Fix notes guidance update permissions
-- Allow all authenticated users to update notes guidance, not just HR/Admin

-- Drop the restrictive HR-only policy that blocks updates
DROP POLICY IF EXISTS "HR can manage asset notes guidance" ON asset_notes_guidance;

-- Create separate policies for different operations to be more granular

-- Allow all authenticated users to update notes guidance
CREATE POLICY "All authenticated users can update asset notes guidance" ON asset_notes_guidance
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Keep HR/Admin privileges for delete operations (more sensitive)
CREATE POLICY "HR and Admin can delete asset notes guidance" ON asset_notes_guidance
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role_id IN (
        SELECT roles.id FROM roles 
        WHERE roles.name = ANY(ARRAY['super_admin', 'admin', 'hr'])
      )
    )
  );

-- Ensure the existing policies remain intact
-- INSERT policy: "All authenticated users can create asset notes guidance" (already exists)
-- SELECT policy: "All users can read asset notes guidance" (already exists)

-- Add a comment for documentation
COMMENT ON POLICY "All authenticated users can update asset notes guidance" ON asset_notes_guidance 
IS 'Allows any authenticated user to update notes guidance - fixes the issue where only HR could update guidance';

COMMENT ON POLICY "HR and Admin can delete asset notes guidance" ON asset_notes_guidance 
IS 'Restricts deletion to HR and Admin users only for security';
