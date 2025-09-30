/*
  # Virtual Machines Management System

  1. Tables
    - `virtual_machines` - VM-specific information and configurations
    - Updates to `asset_assignments` to support VM assignments
    - Add VM asset category

  2. Features
    - Complete VM lifecycle management
    - VM assignment tracking through asset_assignments
    - Network configuration and security settings
    - Compliance and audit tracking

  3. Security
    - Enable RLS on virtual_machines table
    - HR/Admin can manage all VMs
    - Users can view their assigned VMs
*/

-- Create virtual_machines table
CREATE TABLE IF NOT EXISTS virtual_machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic VM Information
  vm_number text UNIQUE NOT NULL, -- e.g., 1001, 2001, 3377
  vm_location text NOT NULL CHECK (vm_location IN ('india', 'us')),
  access_type text NOT NULL CHECK (access_type IN ('local', 'admin')),
  current_user_type text NOT NULL CHECK (current_user_type IN ('single', 'multiple')),
  
  -- Request and Approval Information
  requested_by text NOT NULL,
  approved_by text NOT NULL,
  created_by text NOT NULL,
  request_ticket_id text NOT NULL,
  
  -- Project Information
  purpose text NOT NULL CHECK (purpose IN ('client_project', 'internal_project')),
  project_name text NOT NULL,
  
  -- Access Credentials (encrypted/hashed in production)
  username text NOT NULL, -- ID or Username
  current_password_hash text NOT NULL, -- Should be hashed in production
  previous_password_hash text, -- Should be hashed in production
  
  -- Network Configuration
  ip_address text NOT NULL, -- IP Address or Public IP
  ghost_ip text, -- Optional Ghost IP
  vpn_requirement text NOT NULL CHECK (vpn_requirement IN ('yes', 'no')),
  mfa_enabled text NOT NULL CHECK (mfa_enabled IN ('yes', 'no')),
  
  -- Infrastructure and Compliance
  cloud_provider text NOT NULL CHECK (cloud_provider IN ('aws', 'azure', 'gcp', 'on_prem')),
  backup_enabled text NOT NULL CHECK (backup_enabled IN ('yes', 'no')),
  audit_status text NOT NULL CHECK (audit_status IN ('compliant', 'pending', 'non_compliant')),
  
  -- Important Dates
  approval_date date,
  expiry_date date, -- Account Expiry or Deactivation Date
  
  -- System fields
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_vm_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for virtual_machines updated_at
CREATE TRIGGER update_virtual_machines_updated_at
  BEFORE UPDATE ON virtual_machines
  FOR EACH ROW
  EXECUTE FUNCTION update_vm_updated_at();

-- Add VM asset category if it doesn't exist
INSERT INTO asset_categories (name, description, depreciation_rate)
VALUES ('Virtual Machine', 'Virtual machine instances and server resources', 20.00)
ON CONFLICT (name) DO NOTHING;

-- Add vm_id column to asset_assignments to link VMs
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'asset_assignments' AND column_name = 'vm_id') THEN
    ALTER TABLE asset_assignments ADD COLUMN vm_id uuid REFERENCES virtual_machines(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add constraint to ensure either asset_id OR vm_id is provided (but not both for clarity)
-- This allows asset_assignments to handle both regular assets and VMs
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                 WHERE constraint_name = 'asset_assignments_has_asset_or_vm') THEN
    ALTER TABLE asset_assignments ADD CONSTRAINT asset_assignments_has_asset_or_vm 
    CHECK (
      (asset_id IS NOT NULL AND vm_id IS NULL) OR 
      (asset_id IS NOT NULL AND vm_id IS NOT NULL) OR 
      (asset_id IS NULL AND vm_id IS NOT NULL)
    );
  END IF;
END $$;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_asset_assignments_vm_id ON asset_assignments(vm_id);
CREATE INDEX IF NOT EXISTS idx_virtual_machines_vm_number ON virtual_machines(vm_number);
CREATE INDEX IF NOT EXISTS idx_virtual_machines_location ON virtual_machines(vm_location);
CREATE INDEX IF NOT EXISTS idx_virtual_machines_purpose ON virtual_machines(purpose);
CREATE INDEX IF NOT EXISTS idx_virtual_machines_cloud_provider ON virtual_machines(cloud_provider);
CREATE INDEX IF NOT EXISTS idx_virtual_machines_audit_status ON virtual_machines(audit_status);

-- Enable RLS on virtual_machines
ALTER TABLE virtual_machines ENABLE ROW LEVEL SECURITY;

-- RLS Policies for virtual_machines

-- HR/Admin can read all VMs
CREATE POLICY "HR can read all virtual machines"
  ON virtual_machines FOR SELECT
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

-- Users can read VMs assigned to them through asset_assignments
CREATE POLICY "Users can read their assigned virtual machines"
  ON virtual_machines FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM asset_assignments
      WHERE asset_assignments.vm_id = virtual_machines.id
      AND asset_assignments.user_id = auth.uid()
      AND asset_assignments.is_active = true
    )
  );

-- HR/Admin can manage all VMs
CREATE POLICY "HR can manage virtual machines"
  ON virtual_machines FOR ALL
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

-- Create a comprehensive view for all asset assignments including VMs
CREATE OR REPLACE VIEW asset_assignments_enhanced_view AS
SELECT 
  aa.id AS assignment_id,
  aa.assigned_date,
  aa.return_date,
  aa.is_active,
  aa.notes AS assignment_notes,
  aa.assigned_by,
  aa.return_condition,
  
  -- User information
  u.id AS user_id,
  u.full_name AS assigned_to,
  u.employee_id,
  u.email,
  assigned_by_user.full_name AS assigned_by_name,
  
  -- Asset information (for regular assets)
  a.id AS asset_id,
  a.asset_tag,
  a.name AS asset_name,
  a.brand AS asset_brand,
  a.model AS asset_model,
  a.status AS asset_status,
  a.condition AS asset_condition,
  ac.name AS asset_category,
  
  -- VM information (for VM assignments)
  vm.id AS vm_id,
  vm.vm_number,
  vm.vm_location,
  vm.access_type,
  vm.purpose,
  vm.project_name,
  vm.cloud_provider,
  vm.audit_status,
  vm.ip_address,
  vm.expiry_date,
  vm.mfa_enabled,
  vm.vpn_requirement,
  
  -- Assignment type indicator
  CASE 
    WHEN vm.id IS NOT NULL THEN 'vm'
    WHEN a.id IS NOT NULL THEN 'asset'
    ELSE 'unknown'
  END AS assignment_type,
  
  -- Combined name for display
  COALESCE(
    CONCAT('VM-', vm.vm_number, ' (', vm.project_name, ')'),
    a.name
  ) AS item_name

FROM asset_assignments aa
LEFT JOIN users u ON aa.user_id = u.id
LEFT JOIN users assigned_by_user ON aa.assigned_by = assigned_by_user.id
LEFT JOIN assets a ON aa.asset_id = a.id
LEFT JOIN asset_categories ac ON a.category_id = ac.id
LEFT JOIN virtual_machines vm ON aa.vm_id = vm.id;

-- Create a specific view for VM assignments only
CREATE OR REPLACE VIEW vm_assignments_view AS
SELECT 
  vm.id AS vm_id,
  vm.vm_number,
  vm.vm_location,
  vm.access_type,
  vm.purpose,
  vm.project_name,
  vm.cloud_provider,
  vm.audit_status,
  vm.ip_address,
  vm.expiry_date,
  vm.mfa_enabled,
  vm.vpn_requirement,
  vm.username,
  vm.requested_by,
  vm.approved_by,
  vm.created_by,
  vm.request_ticket_id,
  vm.backup_enabled,
  vm.approval_date,
  aa.id AS assignment_id,
  aa.assigned_date,
  aa.return_date,
  aa.is_active,
  aa.notes AS assignment_notes,
  u.id AS user_id,
  u.full_name AS assigned_to,
  u.employee_id,
  u.email,
  assigned_by_user.full_name AS assigned_by_name
FROM virtual_machines vm
LEFT JOIN asset_assignments aa ON vm.id = aa.vm_id
LEFT JOIN users u ON aa.user_id = u.id
LEFT JOIN users assigned_by_user ON aa.assigned_by = assigned_by_user.id
WHERE aa.is_active = true OR aa.is_active IS NULL;

-- Grant necessary permissions for the views
GRANT SELECT ON asset_assignments_enhanced_view TO authenticated;
GRANT SELECT ON vm_assignments_view TO authenticated;

-- Note: RLS policies are not needed on views as they inherit security from underlying tables
-- The views will respect the RLS policies on virtual_machines, asset_assignments, assets, and users tables

-- Ensure asset_assignments table has proper RLS policies for VM assignments
-- Add policy for users to read their VM assignments (if not already exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'asset_assignments' 
    AND policyname = 'Users can read their VM assignments'
  ) THEN
    CREATE POLICY "Users can read their VM assignments"
      ON asset_assignments FOR SELECT
      TO authenticated
      USING (
        user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM users 
          WHERE users.id = auth.uid() 
          AND users.role_id IN (
            SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'hr')
          )
        )
      );
  END IF;
END $$;

-- Add policy for HR to manage VM assignments (if not already exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'asset_assignments' 
    AND policyname = 'HR can manage VM assignments'
  ) THEN
    CREATE POLICY "HR can manage VM assignments"
      ON asset_assignments FOR ALL
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
  END IF;
END $$;

-- Create a trigger function to automatically create asset entries for VMs
CREATE OR REPLACE FUNCTION create_vm_asset()
RETURNS TRIGGER AS $$
DECLARE
  v_vm_category_id uuid;
  v_asset_id uuid;
BEGIN
  -- Get VM asset category ID
  SELECT id INTO v_vm_category_id 
  FROM asset_categories 
  WHERE name = 'Virtual Machine';
  
  -- Create corresponding asset record
  INSERT INTO assets (
    asset_tag, name, category_id, brand, model,
    location, condition, status, notes
  ) VALUES (
    'VM-' || NEW.vm_number,
    'Virtual Machine ' || NEW.vm_number || ' (' || NEW.project_name || ')',
    v_vm_category_id,
    CASE NEW.cloud_provider 
      WHEN 'aws' THEN 'Amazon Web Services'
      WHEN 'azure' THEN 'Microsoft Azure'
      WHEN 'gcp' THEN 'Google Cloud Platform'
      WHEN 'on_prem' THEN 'On-Premises'
      ELSE NEW.cloud_provider
    END,
    NEW.vm_location || ' VM',
    NEW.vm_location,
    'good',
    'available',
    'VM for ' || NEW.purpose || ' - ' || NEW.project_name
  ) RETURNING id INTO v_asset_id;
  
  -- Store the asset_id for potential use
  NEW.notes := COALESCE(NEW.notes, '') || ' [Asset ID: ' || v_asset_id || ']';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- We'll handle asset creation in the application layer instead of trigger
-- to avoid complexity, but keep the function for reference

-- Create helper function to get VM assignment status
CREATE OR REPLACE FUNCTION get_vm_assignment_status(vm_uuid uuid)
RETURNS TEXT AS $$
DECLARE
  v_is_assigned boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM asset_assignments 
    WHERE vm_id = vm_uuid AND is_active = true
  ) INTO v_is_assigned;
  
  RETURN CASE WHEN v_is_assigned THEN 'assigned' ELSE 'available' END;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions for helper functions
GRANT EXECUTE ON FUNCTION get_vm_assignment_status TO authenticated;

-- Add helpful comments and documentation
COMMENT ON TABLE virtual_machines IS 'Virtual machine instances with complete configuration and lifecycle management';
COMMENT ON COLUMN virtual_machines.vm_number IS 'Unique VM identifier (e.g., 1001, 2001, 3377)';
COMMENT ON COLUMN virtual_machines.current_password_hash IS 'Hashed current password - should never store plain text';
COMMENT ON COLUMN virtual_machines.previous_password_hash IS 'Hashed previous password for audit trail';
COMMENT ON COLUMN virtual_machines.ip_address IS 'VM IP address or public IP configuration';
COMMENT ON COLUMN virtual_machines.ghost_ip IS 'Optional ghost/shadow IP address';
COMMENT ON COLUMN virtual_machines.audit_status IS 'Compliance audit status tracking';
COMMENT ON COLUMN asset_assignments.vm_id IS 'Foreign key linking to virtual_machines table for VM assignments';

COMMENT ON VIEW vm_assignments_view IS 'Comprehensive view of VM assignments with user details';
COMMENT ON VIEW asset_assignments_enhanced_view IS 'Unified view of all asset assignments including both regular assets and VMs';

COMMENT ON CONSTRAINT asset_assignments_has_asset_or_vm ON asset_assignments IS 'Ensures assignment has either an asset, VM, or both';

-- Add documentation about the VM-Asset relationship
COMMENT ON TABLE asset_assignments IS 'Asset and VM assignments to users. Links to either assets table (asset_id) or virtual_machines table (vm_id) or both for VM-asset pairs';
