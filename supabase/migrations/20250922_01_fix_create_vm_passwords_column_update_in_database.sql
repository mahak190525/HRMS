-- Fix VM creation function to use correct password column names
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
  
  -- Insert VM record with CORRECT column names
  INSERT INTO virtual_machines (
    vm_number, vm_location, access_type, current_user_type,
    requested_by, approved_by, created_by, request_ticket_id,
    purpose, project_name, username, 
    current_password, previous_password,  -- FIXED: Use correct column names
    ip_address, ghost_ip, vpn_requirement, mfa_enabled,
    cloud_provider, backup_enabled, audit_status,
    approval_date, expiry_date
  ) VALUES (
    p_vm_number, p_vm_location, p_access_type, p_current_user_type,
    p_requested_by, p_approved_by, p_created_by, p_request_ticket_id,
    p_purpose, p_project_name, p_username,
    p_current_password, p_previous_password,  -- FIXED: Insert into correct columns
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