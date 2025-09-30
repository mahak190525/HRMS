-- Simplify KRA Permissions - Allow authenticated users to access all KRA data
-- This removes all complex role-based restrictions for now

-- Drop all existing complex policies
DROP POLICY IF EXISTS "Enhanced KRA templates access" ON kra_templates;
DROP POLICY IF EXISTS "Enhanced KRA templates modification" ON kra_templates;
DROP POLICY IF EXISTS "Enhanced KRA assignments access" ON kra_assignments;
DROP POLICY IF EXISTS "Enhanced KRA assignments modification" ON kra_assignments;
DROP POLICY IF EXISTS "Enhanced KRA evaluations access" ON kra_evaluations;
DROP POLICY IF EXISTS "Enhanced KRA evaluations employee modification" ON kra_evaluations;
DROP POLICY IF EXISTS "Enhanced KRA evaluations manager modification" ON kra_evaluations;
DROP POLICY IF EXISTS "Enhanced KRA goals access" ON kra_goals;
DROP POLICY IF EXISTS "Enhanced KRA goals modification" ON kra_goals;
DROP POLICY IF EXISTS "Everyone can read KRA categories" ON kra_categories;
DROP POLICY IF EXISTS "Only admins can modify KRA categories" ON kra_categories;
DROP POLICY IF EXISTS "Everyone can read KRA evaluation levels" ON kra_evaluation_levels;
DROP POLICY IF EXISTS "Only admins can modify KRA evaluation levels" ON kra_evaluation_levels;

-- Simple policies - authenticated users can access everything
CREATE POLICY "Anyone can access KRA templates"
  ON kra_templates FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can access KRA goals"
  ON kra_goals FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can access KRA assignments"
  ON kra_assignments FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can access KRA evaluations"
  ON kra_evaluations FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can access KRA categories"
  ON kra_categories FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can access KRA evaluation levels"
  ON kra_evaluation_levels FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add helpful comment
COMMENT ON POLICY "Anyone can access KRA templates" ON kra_templates IS 
'Simplified permissions - all authenticated users have full access to KRA data';
