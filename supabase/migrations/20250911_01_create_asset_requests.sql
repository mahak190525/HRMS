-- Migration: Create asset_requests table
-- This table stores employee requests for new assets

CREATE TABLE IF NOT EXISTS asset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES asset_categories(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  justification TEXT, -- For what purpose the asset is needed
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'fulfilled')),
  priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  approved_by UUID REFERENCES users(id),
  rejected_by UUID REFERENCES users(id),
  fulfilled_by UUID REFERENCES users(id), -- HR/Admin who assigns the actual asset
  rejection_reason TEXT,
  approval_notes TEXT,
  fulfilled_asset_id UUID REFERENCES assets(id), -- The actual asset that was assigned when request is fulfilled
  
  -- Notification tracking
  manager_notified BOOLEAN DEFAULT FALSE,
  hr_notified BOOLEAN DEFAULT FALSE,
  admin_notified BOOLEAN DEFAULT FALSE,
  approval_notification_sent BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_asset_requests_user_id ON asset_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_asset_requests_category_id ON asset_requests(category_id);
CREATE INDEX IF NOT EXISTS idx_asset_requests_status ON asset_requests(status);
CREATE INDEX IF NOT EXISTS idx_asset_requests_created_at ON asset_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_asset_requests_approved_by ON asset_requests(approved_by);
CREATE INDEX IF NOT EXISTS idx_asset_requests_rejected_by ON asset_requests(rejected_by);
CREATE INDEX IF NOT EXISTS idx_asset_requests_fulfilled_by ON asset_requests(fulfilled_by);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_asset_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_asset_requests_updated_at
  BEFORE UPDATE ON asset_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_asset_requests_updated_at();

-- Create RLS policies
ALTER TABLE asset_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view own asset requests" ON asset_requests
  FOR SELECT USING (user_id = auth.uid());

-- Users can create their own requests
CREATE POLICY "Users can create own asset requests" ON asset_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own pending requests
CREATE POLICY "Users can update own pending asset requests" ON asset_requests
  FOR UPDATE USING (user_id = auth.uid() AND status = 'pending');

-- Note: Manager and HR policies will be created in separate migration file to avoid conflicts
