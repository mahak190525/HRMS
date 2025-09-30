-- Drop and recreate all leave-related functions with numeric types
DROP FUNCTION IF EXISTS get_all_leave_balances;
DROP FUNCTION IF EXISTS recalculate_user_leave_balance;
DROP FUNCTION IF EXISTS adjust_leave_balance;

-- Function to get all leave balances
CREATE OR REPLACE FUNCTION get_all_leave_balances(p_year integer)
RETURNS TABLE (
    user_id uuid,
    full_name text,
    employee_id text,
    email text,
    total_leave_balance numeric,
    leave_type_id uuid,
    leave_type_name text,
    allocated_days numeric,
    used_days numeric,
    remaining_days numeric,
    monthly_credit_rate numeric,
    carry_forward_from_previous_year numeric,
    balance_id uuid
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id as user_id,
        u.full_name,
        u.employee_id,
        u.email,
        COALESCE(SUM(lb.remaining_days), 0::numeric) as total_leave_balance,
        lt.id as leave_type_id,
        lt.name as leave_type_name,
        COALESCE(lb.allocated_days, 0::numeric) as allocated_days,
        COALESCE(lb.used_days, 0::numeric) as used_days,
        COALESCE(lb.remaining_days, 0::numeric) as remaining_days,
        COALESCE(lb.monthly_credit_rate, 0::numeric) as monthly_credit_rate,
        COALESCE(lb.carry_forward_from_previous_year, 0::numeric) as carry_forward_from_previous_year,
        lb.id as balance_id
    FROM users u
    CROSS JOIN leave_types lt
    LEFT JOIN leave_balances lb ON 
        u.id = lb.user_id AND 
        lb.leave_type_id = lt.id AND 
        lb.year = p_year
    GROUP BY 
        u.id, u.full_name, u.employee_id, u.email,
        lt.id, lt.name, lb.allocated_days, lb.used_days, lb.remaining_days,
        lb.monthly_credit_rate, lb.carry_forward_from_previous_year, lb.id;
END;
$$ LANGUAGE plpgsql;

-- Function to recalculate user's leave balance
CREATE OR REPLACE FUNCTION recalculate_user_leave_balance(p_user_id uuid)
RETURNS TABLE (
    allocated_days numeric,
    used_days numeric,
    remaining_days numeric,
    monthly_credit_rate numeric,
    carry_forward_from_previous_year numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(lb.allocated_days, 0::numeric) as allocated_days,
        COALESCE(lb.used_days, 0::numeric) as used_days,
        COALESCE(lb.allocated_days - lb.used_days, 0::numeric) as remaining_days,
        COALESCE(lb.monthly_credit_rate, 0::numeric) as monthly_credit_rate,
        COALESCE(lb.carry_forward_from_previous_year, 0::numeric) as carry_forward_from_previous_year
    FROM leave_balances lb
    WHERE lb.user_id = p_user_id
    AND lb.year = EXTRACT(YEAR FROM CURRENT_DATE)::integer;
END;
$$ LANGUAGE plpgsql;

-- Function to adjust leave balance
CREATE OR REPLACE FUNCTION adjust_leave_balance(
    p_user_id uuid,
    p_adjustment_type text,
    p_amount numeric,
    p_reason text,
    p_year integer,
    p_adjusted_by uuid
)
RETURNS TABLE (
    success boolean,
    message text,
    balance_id uuid,
    new_balance numeric
) AS $$
DECLARE
    v_balance_id uuid;
    v_new_balance numeric;
    v_current_balance numeric;
    v_leave_type_id uuid;
BEGIN
    -- Get the default leave type ID (typically 'Annual Leave' or 'Total Leave')
    SELECT id INTO v_leave_type_id
    FROM leave_types
    WHERE LOWER(name) IN ('total leave', 'annual leave', 'total')
    ORDER BY created_at
    LIMIT 1;

    -- Get or create leave balance
    SELECT 
        id,
        COALESCE(allocated_days - used_days, 0::numeric)
    INTO v_balance_id, v_current_balance
    FROM leave_balances
    WHERE user_id = p_user_id
    AND year = p_year
    AND leave_type_id = v_leave_type_id;

    -- If no balance exists, create one
    IF v_balance_id IS NULL THEN
        INSERT INTO leave_balances (
            user_id,
            leave_type_id,
            year,
            allocated_days,
            used_days,
            monthly_credit_rate,
            carry_forward_from_previous_year,
            created_at,
            updated_at
        )
        VALUES (
            p_user_id,
            v_leave_type_id,
            p_year,
            CASE WHEN p_adjustment_type = 'add' THEN p_amount ELSE 0 END,
            0,
            0,
            0,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        )
        RETURNING id INTO v_balance_id;
        
        v_current_balance := 0;
        v_new_balance := CASE WHEN p_adjustment_type = 'add' THEN p_amount ELSE -p_amount END;
    ELSE
        -- Calculate new balance
        IF p_adjustment_type = 'add' THEN
            v_new_balance := v_current_balance + p_amount;
        ELSE
            v_new_balance := v_current_balance - p_amount;
        END IF;

        -- Update existing balance
        UPDATE leave_balances
        SET 
            allocated_days = allocated_days + CASE 
                WHEN p_adjustment_type = 'add' THEN p_amount
                ELSE -p_amount
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = v_balance_id;
    END IF;

    -- Record adjustment
    INSERT INTO leave_balance_adjustments (
        user_id,
        balance_id,
        adjustment_type,
        amount,
        reason,
        adjusted_by,
        previous_allocated,
        new_allocated,
        created_at
    )
    VALUES (
        p_user_id,
        v_balance_id,
        p_adjustment_type,
        p_amount,
        p_reason,
        p_adjusted_by,
        v_current_balance,
        v_new_balance,
        CURRENT_TIMESTAMP
    );

    RETURN QUERY
    SELECT 
        TRUE as success,
        'Balance adjusted successfully' as message,
        v_balance_id as balance_id,
        v_new_balance as new_balance;
END;
$$ LANGUAGE plpgsql;