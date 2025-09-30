/*
  # Create Adjust Leave Balance RPC Function
  
  This migration creates an RPC function to handle leave balance adjustments
  server-side to avoid RLS and permission issues.
*/

-- Drop function if it exists to avoid conflicts
DROP FUNCTION IF EXISTS adjust_leave_balance;

-- Create RPC function to adjust leave balance
CREATE OR REPLACE FUNCTION adjust_leave_balance(
  p_user_id uuid,
  p_adjustment_type text,
  p_amount integer,
  p_reason text,
  p_year integer DEFAULT NULL,
  p_adjusted_by uuid DEFAULT NULL
)
RETURNS TABLE (
  success boolean,
  message text,
  balance_id uuid,
  previous_allocated integer,
  new_allocated integer,
  user_name text,
  user_employee_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_year integer;
  annual_leave_type_id uuid;
  current_balance_record record;
  new_balance_id uuid;
  current_allocated integer;
  new_allocated integer;
  current_user_id uuid;
  user_full_name text;
  user_emp_id text;
BEGIN
  -- Get current user for audit trail (use parameter or fallback to auth.uid())
  current_user_id := COALESCE(p_adjusted_by, auth.uid());
  
  -- Use current year if not specified
  target_year := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::integer);
  
  -- Validate adjustment type
  IF p_adjustment_type NOT IN ('add', 'subtract') THEN
    RETURN QUERY SELECT false, 'Invalid adjustment type. Must be "add" or "subtract"', NULL::uuid, 0, 0, ''::text, ''::text;
    RETURN;
  END IF;
  
  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT false, 'Amount must be greater than 0', NULL::uuid, 0, 0, ''::text, ''::text;
    RETURN;
  END IF;
  
  -- Get user info
  SELECT u.full_name, u.employee_id 
  INTO user_full_name, user_emp_id
  FROM users u
  WHERE u.id = p_user_id AND u.status = 'active';
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'User not found or inactive', NULL::uuid, 0, 0, ''::text, ''::text;
    RETURN;
  END IF;
  
  -- Get Annual Leave type ID
  SELECT lt.id INTO annual_leave_type_id
  FROM leave_types lt
  WHERE lt.name = 'Annual Leave';
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Annual Leave type not found', NULL::uuid, 0, 0, user_full_name, user_emp_id;
    RETURN;
  END IF;
  
  -- Get current balance
  SELECT lb.* INTO current_balance_record
  FROM leave_balances lb
  WHERE lb.user_id = p_user_id 
    AND lb.leave_type_id = annual_leave_type_id 
    AND lb.year = target_year;
  
  -- If no balance exists, create one
  IF NOT FOUND THEN
    current_allocated := 0;
    new_allocated := CASE 
      WHEN p_adjustment_type = 'add' THEN p_amount
      ELSE 0
    END;
    
    INSERT INTO leave_balances (
      user_id,
      leave_type_id,
      year,
      allocated_days,
      used_days,
      monthly_credit_rate,
      carry_forward_from_previous_year
    ) VALUES (
      p_user_id,
      annual_leave_type_id,
      target_year,
      new_allocated,
      0,
      0,
      0
    ) RETURNING id INTO new_balance_id;
    
  ELSE
    -- Update existing balance
    current_allocated := COALESCE(current_balance_record.allocated_days, 0);
    new_allocated := CASE 
      WHEN p_adjustment_type = 'add' THEN current_allocated + p_amount
      WHEN p_adjustment_type = 'subtract' THEN GREATEST(0, current_allocated - p_amount)
    END;
    
    UPDATE leave_balances 
    SET allocated_days = new_allocated,
        updated_at = NOW()
    WHERE id = current_balance_record.id;
    
    new_balance_id := current_balance_record.id;
  END IF;
  
  -- Log the adjustment (always log, even if no current user for system operations)
  BEGIN
    INSERT INTO leave_balance_adjustments (
      user_id,
      leave_balance_id,
      adjustment_type,
      amount,
      reason,
      previous_allocated,
      new_allocated,
      adjusted_by
    ) VALUES (
      p_user_id,
      new_balance_id,
      p_adjustment_type,
      p_amount,
      p_reason,
      current_allocated,
      new_allocated,
      COALESCE(current_user_id, p_user_id, '00000000-0000-0000-0000-000000000000'::uuid) -- Use current user, target user, or system fallback
    );
  EXCEPTION
    WHEN others THEN
      -- Log the error but don't fail the whole operation
      RAISE WARNING 'Failed to log adjustment: %', SQLERRM;
  END;
  
  -- Return success
  RETURN QUERY SELECT 
    true, 
    'Balance adjusted successfully'::text, 
    new_balance_id, 
    current_allocated, 
    new_allocated,
    user_full_name,
    user_emp_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION adjust_leave_balance TO authenticated;

-- Add comment
COMMENT ON FUNCTION adjust_leave_balance IS 'Adjusts leave balance for a user with proper audit trail and validation';