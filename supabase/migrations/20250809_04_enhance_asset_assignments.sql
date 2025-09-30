/*
  # Enhanced Asset Assignments

  1. New Assignment Fields
    - Employee department (auto-populated)
    - Employee manager (auto-populated)
    - Assignment type (Temporary or Permanent)
    - Assignment expiration date (for temporary assignments)
    - Asset condition at issuance (employee input)
    - Asset condition at return (HR input)

  2. Features
    - Multi-employee assignments support
    - Enhanced condition tracking
    - Temporary assignment management
    - Automatic department/manager population
*/

-- Add new fields to asset_assignments table
DO $$ 
BEGIN
  -- Employee department (auto-populated when employee is selected)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'asset_assignments' AND column_name = 'employee_department') THEN
    ALTER TABLE asset_assignments ADD COLUMN employee_department text;
  END IF;

  -- Employee manager (auto-populated when employee is selected)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'asset_assignments' AND column_name = 'employee_manager') THEN
    ALTER TABLE asset_assignments ADD COLUMN employee_manager text;
  END IF;

  -- Assignment type (Temporary or Permanent)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'asset_assignments' AND column_name = 'assignment_type') THEN
    ALTER TABLE asset_assignments ADD COLUMN assignment_type text DEFAULT 'permanent' 
    CHECK (assignment_type IN ('temporary', 'permanent'));
  END IF;

  -- Assignment expiration date (for temporary assignments)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'asset_assignments' AND column_name = 'assignment_expiry_date') THEN
    ALTER TABLE asset_assignments ADD COLUMN assignment_expiry_date date;
  END IF;

  -- Asset condition at issuance (employee's assessment)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'asset_assignments' AND column_name = 'condition_at_issuance') THEN
    ALTER TABLE asset_assignments ADD COLUMN condition_at_issuance text 
    CHECK (condition_at_issuance IN ('excellent', 'good', 'fair', 'poor', 'damaged'));
  END IF;

  -- Employee notes about condition at issuance
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'asset_assignments' AND column_name = 'issuance_condition_notes') THEN
    ALTER TABLE asset_assignments ADD COLUMN issuance_condition_notes text;
  END IF;

  -- HR notes about condition at return
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'asset_assignments' AND column_name = 'return_condition_notes') THEN
    ALTER TABLE asset_assignments ADD COLUMN return_condition_notes text;
  END IF;
END $$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_asset_assignments_assignment_type ON asset_assignments(assignment_type);
CREATE INDEX IF NOT EXISTS idx_asset_assignments_expiry_date ON asset_assignments(assignment_expiry_date);
CREATE INDEX IF NOT EXISTS idx_asset_assignments_employee_department ON asset_assignments(employee_department);

-- Create function to get employee details for auto-population
CREATE OR REPLACE FUNCTION get_employee_details(p_user_id uuid)
RETURNS TABLE (
  department text,
  manager_name text,
  manager_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.name as department,
    m.full_name as manager_name,
    u.manager_id
  FROM users u
  LEFT JOIN users m ON u.manager_id = m.id
  LEFT JOIN departments d ON u.department_id = d.id
  WHERE u.id = p_user_id;
END;
$$;

-- Create function to bulk assign asset to multiple employees
CREATE OR REPLACE FUNCTION bulk_assign_asset(
  p_asset_id uuid,
  p_user_ids uuid[],
  p_assigned_by uuid,
  p_assignment_type text DEFAULT 'permanent',
  p_assignment_expiry_date date DEFAULT NULL,
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

  -- Loop through each user and create assignment
  FOREACH v_user_id IN ARRAY p_user_ids
  LOOP
    -- Get employee details for auto-population
    SELECT * INTO v_employee_details FROM get_employee_details(v_user_id);
    
    -- Create assignment
    INSERT INTO asset_assignments (
      asset_id, user_id, assigned_by, assignment_type,
      assignment_expiry_date, employee_department, employee_manager,
      notes, is_active
    ) VALUES (
      p_asset_id, v_user_id, p_assigned_by, p_assignment_type,
      p_assignment_expiry_date, v_employee_details.department, v_employee_details.manager_name,
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

-- Create function to unassign asset from all users
CREATE OR REPLACE FUNCTION unassign_asset_from_all(
  p_asset_id uuid,
  p_return_condition text DEFAULT 'good',
  p_return_notes text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
  v_assignments_count integer;
BEGIN
  -- Update all active assignments for this asset
  UPDATE asset_assignments 
  SET 
    is_active = false,
    return_date = CURRENT_DATE,
    return_condition = p_return_condition,
    return_condition_notes = p_return_notes
  WHERE asset_id = p_asset_id AND is_active = true;

  GET DIAGNOSTICS v_assignments_count = ROW_COUNT;

  -- Update asset status to available
  UPDATE assets SET status = 'available' WHERE id = p_asset_id;

  v_result := json_build_object(
    'success', true,
    'unassigned_count', v_assignments_count,
    'message', 'Asset unassigned from all employees'
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error unassigning asset: %', SQLERRM;
END;
$$;

-- Create function to update assignment condition (for employee condition input)
CREATE OR REPLACE FUNCTION update_assignment_condition(
  p_assignment_id uuid,
  p_condition_at_issuance text,
  p_issuance_notes text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
BEGIN
  -- Validate condition
  IF p_condition_at_issuance NOT IN ('excellent', 'good', 'fair', 'poor', 'damaged') THEN
    RAISE EXCEPTION 'Invalid condition. Must be excellent, good, fair, poor, or damaged.';
  END IF;

  -- Update assignment condition
  UPDATE asset_assignments 
  SET 
    condition_at_issuance = p_condition_at_issuance,
    issuance_condition_notes = p_issuance_notes
  WHERE id = p_assignment_id;

  v_result := json_build_object(
    'success', true,
    'message', 'Assignment condition updated successfully'
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error updating assignment condition: %', SQLERRM;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_employee_details TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_assign_asset TO authenticated;
GRANT EXECUTE ON FUNCTION unassign_asset_from_all TO authenticated;
GRANT EXECUTE ON FUNCTION update_assignment_condition TO authenticated;

-- Add helpful comments
COMMENT ON COLUMN asset_assignments.employee_department IS 'Auto-populated department of the assigned employee';
COMMENT ON COLUMN asset_assignments.employee_manager IS 'Auto-populated manager name of the assigned employee';
COMMENT ON COLUMN asset_assignments.assignment_type IS 'Type of assignment: temporary or permanent';
COMMENT ON COLUMN asset_assignments.assignment_expiry_date IS 'Expiry date for temporary assignments';
COMMENT ON COLUMN asset_assignments.condition_at_issuance IS 'Asset condition as assessed by employee at issuance';
COMMENT ON COLUMN asset_assignments.issuance_condition_notes IS 'Employee notes about asset condition at issuance';
COMMENT ON COLUMN asset_assignments.return_condition_notes IS 'HR notes about asset condition when returned';

COMMENT ON FUNCTION get_employee_details IS 'Returns department and manager details for an employee';
COMMENT ON FUNCTION bulk_assign_asset IS 'Assigns an asset to multiple employees with auto-populated details';
COMMENT ON FUNCTION unassign_asset_from_all IS 'Unassigns an asset from all current users';
COMMENT ON FUNCTION update_assignment_condition IS 'Updates the condition assessment for an assignment';
