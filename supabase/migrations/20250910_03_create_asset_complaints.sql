-- Migration: Create asset_complaints table
-- This table stores user complaints/issues with their assigned assets

CREATE TABLE IF NOT EXISTS asset_complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  asset_assignment_id UUID NOT NULL REFERENCES asset_assignments(id) ON DELETE CASCADE,
  problem_description TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  resolved_by UUID REFERENCES users(id),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_asset_complaints_user_id ON asset_complaints(user_id);
CREATE INDEX IF NOT EXISTS idx_asset_complaints_asset_id ON asset_complaints(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_complaints_status ON asset_complaints(status);
CREATE INDEX IF NOT EXISTS idx_asset_complaints_created_at ON asset_complaints(created_at);

-- Create RLS policies
ALTER TABLE asset_complaints ENABLE ROW LEVEL SECURITY;

-- Users can view their own complaints
CREATE POLICY "Users can view own complaints" ON asset_complaints
  FOR SELECT USING (user_id = auth.uid());

-- Users can create their own complaints
CREATE POLICY "Users can create own complaints" ON asset_complaints
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- HR/Admin can view all complaints
CREATE POLICY "HR can view all complaints" ON asset_complaints
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() 
      AND (u."isSA" = true OR r.name IN ('hr', 'admin', 'super_admin'))
    )
  );

-- HR/Admin can update complaints (change status, add resolution notes)
CREATE POLICY "HR can update complaints" ON asset_complaints
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() 
      AND (u."isSA" = true OR r.name IN ('hr', 'admin', 'super_admin'))
    )
  );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_asset_complaints_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  -- Set resolved_at when status changes to resolved or closed
  IF NEW.status IN ('resolved', 'closed') AND OLD.status NOT IN ('resolved', 'closed') THEN
    NEW.resolved_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_asset_complaints_updated_at
  BEFORE UPDATE ON asset_complaints
  FOR EACH ROW EXECUTE FUNCTION update_asset_complaints_updated_at();

-- Add some sample data for testing (optional)
-- INSERT INTO asset_complaints (user_id, asset_id, asset_assignment_id, problem_description, status) VALUES
-- (
--   (SELECT id FROM users LIMIT 1),
--   (SELECT id FROM assets LIMIT 1),
--   (SELECT id FROM asset_assignments LIMIT 1),
--   'Sample complaint for testing purposes',
--   'open'
-- );
