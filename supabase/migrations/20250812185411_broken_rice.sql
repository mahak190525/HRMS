/*
  # Asset Management System

  1. Tables
    - `asset_categories` - Types of assets
    - `assets` - Company assets inventory
    - `asset_assignments` - Asset assignments to employees
    - `asset_maintenance` - Maintenance records

  2. Security
    - Enable RLS on all tables
    - HR can manage all assets
    - Employees can view their assigned assets
*/

-- Create asset categories table
CREATE TABLE IF NOT EXISTS asset_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  depreciation_rate numeric(5,2) DEFAULT 0, -- Annual depreciation percentage
  created_at timestamptz DEFAULT now()
);

-- Create assets table
CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_tag text UNIQUE NOT NULL,
  name text NOT NULL,
  category_id uuid REFERENCES asset_categories(id) NOT NULL,
  brand text,
  model text,
  serial_number text,
  purchase_date date,
  purchase_cost numeric(10,2),
  current_value numeric(10,2),
  warranty_expiry date,
  location text,
  condition text DEFAULT 'good' CHECK (condition IN ('excellent', 'good', 'fair', 'poor', 'damaged')),
  status text DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'maintenance', 'retired', 'lost')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create asset assignments table
CREATE TABLE IF NOT EXISTS asset_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid REFERENCES assets(id) NOT NULL,
  user_id uuid REFERENCES users(id) NOT NULL,
  assigned_date date DEFAULT CURRENT_DATE,
  return_date date,
  assigned_by uuid REFERENCES users(id) NOT NULL,
  return_condition text CHECK (return_condition IN ('excellent', 'good', 'fair', 'poor', 'damaged')),
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create asset maintenance table
CREATE TABLE IF NOT EXISTS asset_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid REFERENCES assets(id) NOT NULL,
  maintenance_type text DEFAULT 'routine' CHECK (maintenance_type IN ('routine', 'repair', 'upgrade', 'inspection')),
  description text NOT NULL,
  maintenance_date date DEFAULT CURRENT_DATE,
  cost numeric(8,2) DEFAULT 0,
  performed_by text,
  next_maintenance_date date,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE asset_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_maintenance ENABLE ROW LEVEL SECURITY;

-- RLS Policies for asset_categories
CREATE POLICY "Asset categories readable by authenticated users"
  ON asset_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "HR can manage asset categories"
  ON asset_categories FOR ALL
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

-- RLS Policies for assets
CREATE POLICY "HR can read all assets"
  ON assets FOR SELECT
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

CREATE POLICY "Users can read their assigned assets"
  ON assets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM asset_assignments
      WHERE asset_assignments.asset_id = assets.id
      AND asset_assignments.user_id = auth.uid()
      AND asset_assignments.is_active = true
    )
  );

CREATE POLICY "HR can manage assets"
  ON assets FOR ALL
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

-- RLS Policies for asset_assignments
CREATE POLICY "Users can read own asset assignments"
  ON asset_assignments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "HR can read all asset assignments"
  ON asset_assignments FOR SELECT
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

CREATE POLICY "HR can manage asset assignments"
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

-- RLS Policies for asset_maintenance
CREATE POLICY "HR can read all asset maintenance"
  ON asset_maintenance FOR SELECT
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

CREATE POLICY "HR can manage asset maintenance"
  ON asset_maintenance FOR ALL
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

-- Insert default asset categories
INSERT INTO asset_categories (name, description, depreciation_rate) VALUES
('Laptops', 'Laptop computers and notebooks', 25.0),
('Desktops', 'Desktop computers and workstations', 20.0),
('Monitors', 'Computer monitors and displays', 15.0),
('Mobile Devices', 'Smartphones and tablets', 30.0),
('Accessories', 'Keyboards, mice, headphones, etc.', 20.0),
('Furniture', 'Office chairs, desks, cabinets', 10.0),
('Software Licenses', 'Software and application licenses', 100.0),
('Networking Equipment', 'Routers, switches, access points', 15.0);

-- Function to update asset status when assigned/returned
CREATE OR REPLACE FUNCTION update_asset_status()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Asset is being assigned
    UPDATE assets SET status = 'assigned' WHERE id = NEW.asset_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Check if assignment is being deactivated (returned)
    IF OLD.is_active = true AND NEW.is_active = false THEN
      UPDATE assets SET status = 'available' WHERE id = NEW.asset_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for asset status updates
CREATE TRIGGER asset_assignment_status_trigger
  AFTER INSERT OR UPDATE ON asset_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_asset_status();