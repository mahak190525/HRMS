/*
  # Update Bulk Assign Function

  Add condition tracking parameters to the bulk_assign_asset function
  to support the enhanced assignment form with condition fields.
*/

-- Drop the existing function first to avoid conflicts
DROP FUNCTION IF EXISTS bulk_assign_asset(uuid, uuid[], uuid, text, date, text);

-- Create the updated bulk_assign_asset function to include condition parameters
CREATE OR REPLACE FUNCTION bulk_assign_asset(
  p_asset_id uuid,
  p_user_ids uuid[],
  p_assigned_by uuid,
  p_assignment_type text DEFAULT 'permanent',
  p_assignment_expiry_date date DEFAULT NULL,
  p_condition_at_issuance text DEFAULT 'good',
  p_issuance_condition_notes text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_assignment_id uuid;
  v_employee_details record;
  v_result json;
  v_assignment_ids uuid[] := '{}';
BEGIN
  -- Validate assignment type
  IF p_assignment_type NOT IN ('temporary', 'permanent') THEN
    RAISE EXCEPTION 'Invalid assignment type. Must be temporary or permanent.';
  END IF;

  -- Validate expiry date for temporary assignments
  IF p_assignment_type = 'temporary' AND p_assignment_expiry_date IS NULL THEN
    RAISE EXCEPTION 'Expiry date is required for temporary assignments.';
  END IF;

  -- Validate condition
  IF p_condition_at_issuance NOT IN ('excellent', 'good', 'fair', 'poor', 'damaged') THEN
    RAISE EXCEPTION 'Invalid condition. Must be excellent, good, fair, poor, or damaged.';
  END IF;

  -- Loop through each user and create assignment
  FOREACH v_user_id IN ARRAY p_user_ids
  LOOP
    -- Get employee details for auto-population
    SELECT * INTO v_employee_details FROM get_employee_details(v_user_id);
    
    -- Create assignment
    INSERT INTO asset_assignments (
      asset_id, user_id, assigned_by, assignment_type,
      assignment_expiry_date, employee_department, employee_manager,
      condition_at_issuance, issuance_condition_notes,
      notes, is_active
    ) VALUES (
      p_asset_id, v_user_id, p_assigned_by, p_assignment_type,
      p_assignment_expiry_date, v_employee_details.department, v_employee_details.manager_name,
      p_condition_at_issuance, p_issuance_condition_notes,
      p_notes, true
    ) RETURNING id INTO v_assignment_id;
    
    v_assignment_ids := array_append(v_assignment_ids, v_assignment_id);
  END LOOP;

  -- Update asset status
  UPDATE assets SET status = 'assigned' WHERE id = p_asset_id;

  v_result := json_build_object(
    'success', true,
    'assignment_ids', v_assignment_ids,
    'message', 'Asset assigned successfully to ' || array_length(p_user_ids, 1) || ' employees'
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error in bulk assignment: %', SQLERRM;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION bulk_assign_asset TO authenticated;

-- Update comment
COMMENT ON FUNCTION bulk_assign_asset IS 'Assigns an asset to multiple employees with auto-populated details and condition tracking';
