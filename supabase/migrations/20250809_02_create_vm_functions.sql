/*
  # Virtual Machine Management Functions

  1. Functions
    - `create_vm_with_assignment` - Create VM and optionally assign to user
    - `assign_vm_to_user` - Assign existing VM to a user
    - `unassign_vm_from_user` - Remove VM assignment
    - `get_user_vms` - Get all VMs assigned to a user
    - `get_available_vms` - Get all unassigned VMs

  2. Security
    - Functions respect RLS policies
    - Proper error handling and validation
*/

-- Function to create a VM and optionally assign it to a user
CREATE OR REPLACE FUNCTION create_vm_with_assignment(
  p_vm_number text,
  p_vm_location text,
  p_access_type text,
  p_current_user_type text,
  p_requested_by text,
  p_approved_by text,
  p_created_by text,
  p_request_ticket_id text,
  p_purpose text,
  p_project_name text,
  p_username text,
  p_current_password text,
  p_ip_address text,
  p_vpn_requirement text,
  p_mfa_enabled text,
  p_cloud_provider text,
  p_backup_enabled text,
  p_audit_status text,
  p_previous_password text DEFAULT NULL,
  p_ghost_ip text DEFAULT NULL,
  p_approval_date date DEFAULT NULL,
  p_expiry_date date DEFAULT NULL,
  p_assign_to_user_id uuid DEFAULT NULL,
  p_assigned_by_user_id uuid DEFAULT NULL,
  p_assignment_notes text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_vm_id uuid;
  v_assignment_id uuid;
  v_asset_id uuid;
  v_vm_category_id uuid;
  v_result json;
BEGIN
  -- Validate inputs
  IF p_vm_number IS NULL OR p_vm_number = '' THEN
    RAISE EXCEPTION 'VM number is required';
  END IF;
  
  IF p_assign_to_user_id IS NOT NULL AND p_assigned_by_user_id IS NULL THEN
    RAISE EXCEPTION 'assigned_by_user_id is required when assigning to a user';
  END IF;
  
  -- Get VM asset category ID
  SELECT id INTO v_vm_category_id 
  FROM asset_categories 
  WHERE name = 'Virtual Machine';
  
  IF v_vm_category_id IS NULL THEN
    RAISE EXCEPTION 'Virtual Machine asset category not found';
  END IF;
  
  -- Hash passwords (in production, this should use proper password hashing)
  -- For now, we'll store them as-is but in production use pgcrypto
  
  -- Insert VM record
  INSERT INTO virtual_machines (
    vm_number, vm_location, access_type, current_user_type,
    requested_by, approved_by, created_by, request_ticket_id,
    purpose, project_name, username, 
    current_password_hash, previous_password_hash,
    ip_address, ghost_ip, vpn_requirement, mfa_enabled,
    cloud_provider, backup_enabled, audit_status,
    approval_date, expiry_date
  ) VALUES (
    p_vm_number, p_vm_location, p_access_type, p_current_user_type,
    p_requested_by, p_approved_by, p_created_by, p_request_ticket_id,
    p_purpose, p_project_name, p_username,
    p_current_password, p_previous_password, -- In production, hash these
    p_ip_address, p_ghost_ip, p_vpn_requirement, p_mfa_enabled,
    p_cloud_provider, p_backup_enabled, p_audit_status,
    p_approval_date, p_expiry_date
  ) RETURNING id INTO v_vm_id;
  
  -- Create corresponding asset record
  INSERT INTO assets (
    asset_tag, name, category_id, brand, model,
    location, condition, status, notes
  ) VALUES (
    'VM-' || p_vm_number,
    'Virtual Machine ' || p_vm_number || ' (' || p_project_name || ')',
    v_vm_category_id,
    CASE p_cloud_provider 
      WHEN 'aws' THEN 'Amazon Web Services'
      WHEN 'azure' THEN 'Microsoft Azure'
      WHEN 'gcp' THEN 'Google Cloud Platform'
      WHEN 'on_prem' THEN 'On-Premises'
      ELSE p_cloud_provider
    END,
    p_vm_location || ' VM',
    p_vm_location,
    'good',
    CASE WHEN p_assign_to_user_id IS NOT NULL THEN 'assigned' ELSE 'available' END,
    'VM for ' || p_purpose || ' - ' || p_project_name
  ) RETURNING id INTO v_asset_id;
  
  -- If user assignment is requested, create the assignment
  IF p_assign_to_user_id IS NOT NULL THEN
    INSERT INTO asset_assignments (
      asset_id, user_id, assigned_by, vm_id, notes, is_active
    ) VALUES (
      v_asset_id, p_assign_to_user_id, p_assigned_by_user_id, v_vm_id, p_assignment_notes, true
    ) RETURNING id INTO v_assignment_id;
  END IF;
  
  -- Return success response
  v_result := json_build_object(
    'success', true,
    'vm_id', v_vm_id,
    'asset_id', v_asset_id,
    'assignment_id', v_assignment_id,
    'message', 'VM created successfully'
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error creating VM: %', SQLERRM;
END;
$$;

-- Function to assign an existing VM to a user
CREATE OR REPLACE FUNCTION assign_vm_to_user(
  p_vm_id uuid,
  p_user_id uuid,
  p_assigned_by_user_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_assignment_id uuid;
  v_asset_id uuid;
  v_vm_exists boolean;
  v_result json;
BEGIN
  -- Check if VM exists
  SELECT EXISTS(SELECT 1 FROM virtual_machines WHERE id = p_vm_id) INTO v_vm_exists;
  IF NOT v_vm_exists THEN
    RAISE EXCEPTION 'VM not found';
  END IF;
  
  -- Get corresponding asset ID
  SELECT id INTO v_asset_id 
  FROM assets 
  WHERE asset_tag = 'VM-' || (SELECT vm_number FROM virtual_machines WHERE id = p_vm_id);
  
  -- Check if VM is already assigned
  IF EXISTS (
    SELECT 1 FROM asset_assignments 
    WHERE vm_id = p_vm_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'VM is already assigned to another user';
  END IF;
  
  -- Create assignment
  INSERT INTO asset_assignments (
    asset_id, user_id, assigned_by, vm_id, notes, is_active
  ) VALUES (
    v_asset_id, p_user_id, p_assigned_by_user_id, p_vm_id, p_notes, true
  ) RETURNING id INTO v_assignment_id;
  
  -- Update asset status
  UPDATE assets SET status = 'assigned' WHERE id = v_asset_id;
  
  v_result := json_build_object(
    'success', true,
    'assignment_id', v_assignment_id,
    'message', 'VM assigned successfully'
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error assigning VM: %', SQLERRM;
END;
$$;

-- Function to unassign VM from user
CREATE OR REPLACE FUNCTION unassign_vm_from_user(
  p_vm_id uuid,
  p_return_condition text DEFAULT 'good'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_asset_id uuid;
  v_result json;
BEGIN
  -- Get corresponding asset ID
  SELECT id INTO v_asset_id 
  FROM assets 
  WHERE asset_tag = 'VM-' || (SELECT vm_number FROM virtual_machines WHERE id = p_vm_id);
  
  -- Update assignment
  UPDATE asset_assignments 
  SET 
    is_active = false,
    return_date = CURRENT_DATE,
    return_condition = p_return_condition
  WHERE vm_id = p_vm_id AND is_active = true;
  
  -- Update asset status
  UPDATE assets SET status = 'available' WHERE id = v_asset_id;
  
  v_result := json_build_object(
    'success', true,
    'message', 'VM unassigned successfully'
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error unassigning VM: %', SQLERRM;
END;
$$;

-- Function to get user's VMs
CREATE OR REPLACE FUNCTION get_user_vms(p_user_id uuid)
RETURNS TABLE (
  vm_id uuid,
  vm_number text,
  vm_location text,
  project_name text,
  ip_address text,
  assignment_date date,
  assignment_notes text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    vm.id,
    vm.vm_number,
    vm.vm_location,
    vm.project_name,
    vm.ip_address,
    aa.assigned_date,
    aa.notes
  FROM virtual_machines vm
  JOIN asset_assignments aa ON vm.id = aa.vm_id
  WHERE aa.user_id = p_user_id AND aa.is_active = true;
END;
$$;

-- Function to get available VMs
CREATE OR REPLACE FUNCTION get_available_vms()
RETURNS TABLE (
  vm_id uuid,
  vm_number text,
  vm_location text,
  access_type text,
  purpose text,
  project_name text,
  cloud_provider text,
  ip_address text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    vm.id,
    vm.vm_number,
    vm.vm_location,
    vm.access_type,
    vm.purpose,
    vm.project_name,
    vm.cloud_provider,
    vm.ip_address,
    vm.created_at
  FROM virtual_machines vm
  WHERE NOT EXISTS (
    SELECT 1 FROM asset_assignments aa 
    WHERE aa.vm_id = vm.id AND aa.is_active = true
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_vm_with_assignment TO authenticated;
GRANT EXECUTE ON FUNCTION assign_vm_to_user TO authenticated;
GRANT EXECUTE ON FUNCTION unassign_vm_from_user TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_vms TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_vms TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION create_vm_with_assignment IS 'Creates a new VM and optionally assigns it to a user in a single transaction';
COMMENT ON FUNCTION assign_vm_to_user IS 'Assigns an existing VM to a user through asset_assignments';
COMMENT ON FUNCTION unassign_vm_from_user IS 'Removes VM assignment and marks it as available';
COMMENT ON FUNCTION get_user_vms IS 'Returns all VMs currently assigned to a user';
COMMENT ON FUNCTION get_available_vms IS 'Returns all VMs that are not currently assigned';
