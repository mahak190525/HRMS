/*
  # Create Employment Term Leave Rates Table
  
  This table stores the leave rate configuration for each employment term type.
  The leave_rate will be used to automatically populate the rate_of_leave column
  in the leave_balances table when creating or updating employee leave balances.
*/

-- Create employment_term_leave_rates table
CREATE TABLE IF NOT EXISTS employment_term_leave_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employment_term text NOT NULL UNIQUE CHECK (employment_term IN ('full_time', 'part_time', 'associate', 'contract', 'probation/internship')),
  leave_rate numeric(5,2) NOT NULL DEFAULT 0.0 CHECK (leave_rate >= 0),
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id)
);

-- Add comment
COMMENT ON TABLE employment_term_leave_rates IS 'Stores the monthly leave rate (days per month) for each employment term type. Used to automatically populate rate_of_leave in leave_balances.';
COMMENT ON COLUMN employment_term_leave_rates.employment_term IS 'The employment term type (full_time, part_time, associate, contract, probation/internship)';
COMMENT ON COLUMN employment_term_leave_rates.leave_rate IS 'Number of leave days added per month for this employment term type';

-- Create index
CREATE INDEX IF NOT EXISTS idx_employment_term_leave_rates_term ON employment_term_leave_rates(employment_term);

-- Insert default values for all employment terms BEFORE enabling RLS
-- This ensures the initial data can be inserted without RLS restrictions
INSERT INTO employment_term_leave_rates (employment_term, leave_rate, description)
VALUES 
  ('full_time', 1.5, 'Full-time employees receive 1.5 days of leave per month'),
  ('part_time', 0.0, 'Part-time employees receive 0.0 days of leave per month'),
  ('associate', 0.0, 'Associate employees receive 0.0 days of leave per month'),
  ('contract', 0.0, 'Contract employees receive 0.0 days of leave per month'),
  ('probation/internship', 0.0, 'Probation/Internship employees receive 0.5 days of leave per month')
ON CONFLICT (employment_term) DO NOTHING;

-- Enable RLS
ALTER TABLE employment_term_leave_rates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Note: Using get_current_user_id() function which reads from app.current_user_id setting
-- This function should already exist from previous migrations, but we'll ensure it exists
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS uuid AS $$
BEGIN
  -- This should be set by your application using SET LOCAL
  RETURN current_setting('app.current_user_id', true)::uuid;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "Admins can view employment term leave rates" ON employment_term_leave_rates;
CREATE POLICY "Admins can view employment term leave rates" 
  ON employment_term_leave_rates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = get_current_user_id()
      AND (
        users.role_id IN (SELECT id FROM roles WHERE name IN ('admin', 'hr', 'hrm'))
        OR 'admin' = ANY(users.additional_role_ids::text[])
        OR 'hr' = ANY(users.additional_role_ids::text[])
        OR 'hrm' = ANY(users.additional_role_ids::text[])
      )
    )
  );

DROP POLICY IF EXISTS "Admins can insert employment term leave rates" ON employment_term_leave_rates;
CREATE POLICY "Admins can insert employment term leave rates" 
  ON employment_term_leave_rates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = get_current_user_id()
      AND (
        users.role_id IN (SELECT id FROM roles WHERE name IN ('admin', 'hr', 'hrm'))
        OR 'admin' = ANY(users.additional_role_ids::text[])
        OR 'hr' = ANY(users.additional_role_ids::text[])
        OR 'hrm' = ANY(users.additional_role_ids::text[])
      )
    )
  );

DROP POLICY IF EXISTS "Admins can update employment term leave rates" ON employment_term_leave_rates;
CREATE POLICY "Admins can update employment term leave rates" 
  ON employment_term_leave_rates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = get_current_user_id()
      AND (
        users.role_id IN (SELECT id FROM roles WHERE name IN ('admin', 'hr', 'hrm'))
        OR 'admin' = ANY(users.additional_role_ids::text[])
        OR 'hr' = ANY(users.additional_role_ids::text[])
        OR 'hrm' = ANY(users.additional_role_ids::text[])
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = get_current_user_id()
      AND (
        users.role_id IN (SELECT id FROM roles WHERE name IN ('admin', 'hr', 'hrm'))
        OR 'admin' = ANY(users.additional_role_ids::text[])
        OR 'hr' = ANY(users.additional_role_ids::text[])
        OR 'hrm' = ANY(users.additional_role_ids::text[])
      )
    )
  );

-- Create function to get leave rate for an employment term
CREATE OR REPLACE FUNCTION get_leave_rate_for_employment_term(p_employment_term text)
RETURNS numeric(5,2) AS $$
DECLARE
  v_rate numeric(5,2);
BEGIN
  SELECT etlr.leave_rate INTO v_rate
  FROM employment_term_leave_rates etlr
  WHERE etlr.employment_term = p_employment_term;
  
  RETURN COALESCE(v_rate, 0.0);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_leave_rate_for_employment_term IS 'Returns the configured leave rate for a given employment term type';

-- Create SECURITY DEFINER function to upsert employment term leave rates
-- This function bypasses RLS and should be called by admins/HR only
-- The application should verify user permissions before calling this function
CREATE OR REPLACE FUNCTION upsert_employment_term_leave_rate(
  p_employment_term text,
  p_leave_rate numeric(5,2),
  p_description text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS employment_term_leave_rates AS $$
DECLARE
  v_user_id uuid;
  v_result employment_term_leave_rates;
BEGIN
  -- Get user ID from parameter or from app setting
  v_user_id := COALESCE(p_user_id, get_current_user_id());
  
  -- Verify user has admin/HR permissions
  IF v_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM users
    WHERE users.id = v_user_id
    AND (
      users.role_id IN (SELECT id FROM roles WHERE name IN ('admin', 'hr', 'hrm'))
      OR 'admin' = ANY(users.additional_role_ids::text[])
      OR 'hr' = ANY(users.additional_role_ids::text[])
      OR 'hrm' = ANY(users.additional_role_ids::text[])
    )
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions: Only admins, HR, and HRM can manage employment term leave rates';
  END IF;
  
  -- Upsert the leave rate
  INSERT INTO employment_term_leave_rates (employment_term, leave_rate, description, created_by, updated_by)
  VALUES (p_employment_term, p_leave_rate, p_description, v_user_id, v_user_id)
  ON CONFLICT (employment_term) 
  DO UPDATE SET
    leave_rate = EXCLUDED.leave_rate,
    description = EXCLUDED.description,
    updated_by = v_user_id,
    updated_at = now()
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION upsert_employment_term_leave_rate IS 'Upserts an employment term leave rate. Requires admin/HR/HRM permissions. Bypasses RLS.';

-- ========================================
-- FUNCTIONS TO UPDATE RATE_OF_LEAVE IN LEAVE_BALANCES
-- ========================================

-- Function to update rate_of_leave for a specific user based on their employment term
CREATE OR REPLACE FUNCTION update_user_leave_rate_from_employment_term(p_user_id uuid)
RETURNS void AS $$
DECLARE
  v_employment_term text;
  v_leave_rate numeric(5,2);
BEGIN
  -- Get user's employment term
  SELECT employment_terms INTO v_employment_term
  FROM users
  WHERE id = p_user_id;
  
  -- If user has no employment term, set rate to 0
  IF v_employment_term IS NULL THEN
    v_leave_rate := 0.0;
  ELSE
    -- Get leave rate for the employment term
    SELECT etlr.leave_rate INTO v_leave_rate
    FROM employment_term_leave_rates etlr
    WHERE etlr.employment_term = v_employment_term;
    
    -- If no rate found, default to 0
    v_leave_rate := COALESCE(v_leave_rate, 0.0);
  END IF;
  
  -- Update all leave balances for this user
  UPDATE leave_balances lb
  SET rate_of_leave = v_leave_rate
  WHERE lb.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_user_leave_rate_from_employment_term IS 'Updates rate_of_leave in all leave_balances records for a user based on their employment_terms.';

-- Function to update rate_of_leave for all users based on their employment terms
CREATE OR REPLACE FUNCTION update_all_users_leave_rates_from_employment_terms()
RETURNS TABLE (
  user_id uuid,
  employment_term text,
  leave_rate numeric(5,2),
  updated_count integer,
  success boolean
) AS $$
DECLARE
  v_user_record record;
  v_leave_rate numeric(5,2);
  v_updated_count integer;
BEGIN
  -- Loop through all users with employment terms
  FOR v_user_record IN 
    SELECT u.id, u.employment_terms
    FROM users u
    WHERE u.employment_terms IS NOT NULL
  LOOP
    -- Get leave rate for the employment term
    SELECT etlr.leave_rate INTO v_leave_rate
    FROM employment_term_leave_rates etlr
    WHERE etlr.employment_term = v_user_record.employment_terms;
    
    -- If no rate found, default to 0
    v_leave_rate := COALESCE(v_leave_rate, 0.0);
    
    -- Update all leave balances for this user
    UPDATE leave_balances lb
    SET rate_of_leave = v_leave_rate
    WHERE lb.user_id = v_user_record.id;
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    -- Return result
    RETURN QUERY SELECT 
      v_user_record.id,
      v_user_record.employment_terms,
      v_leave_rate,
      v_updated_count,
      true;
  END LOOP;
  
  -- Handle users without employment terms
  FOR v_user_record IN 
    SELECT u.id, u.employment_terms
    FROM users u
    WHERE u.employment_terms IS NULL
  LOOP
    UPDATE leave_balances lb
    SET rate_of_leave = 0.0
    WHERE lb.user_id = v_user_record.id;
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    IF v_updated_count > 0 THEN
      RETURN QUERY SELECT 
        v_user_record.id,
        NULL::text,
        0.0::numeric(5,2),
        v_updated_count,
        true;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_all_users_leave_rates_from_employment_terms IS 'Updates rate_of_leave in all leave_balances records for all users based on their employment_terms.';

-- Trigger function to automatically set rate_of_leave when a new leave balance is created
CREATE OR REPLACE FUNCTION set_leave_balance_rate_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_employment_term text;
  v_leave_rate numeric(5,2);
BEGIN
  -- Get user's employment term
  SELECT employment_terms INTO v_employment_term
  FROM users
  WHERE id = NEW.user_id;
  
  -- If user has no employment term, set rate to 0
  IF v_employment_term IS NULL THEN
    NEW.rate_of_leave := 0.0;
  ELSE
    -- Get leave rate for the employment term
    SELECT etlr.leave_rate INTO v_leave_rate
    FROM employment_term_leave_rates etlr
    WHERE etlr.employment_term = v_employment_term;
    
    -- If no rate found, default to 0, otherwise use the rate
    NEW.rate_of_leave := COALESCE(v_leave_rate, 0.0);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_leave_balance_rate_on_insert IS 'Trigger function that automatically sets rate_of_leave when a new leave balance is created based on the user''s employment_terms.';

-- Create trigger on leave_balances table
DROP TRIGGER IF EXISTS trigger_set_leave_balance_rate_on_insert ON leave_balances;
CREATE TRIGGER trigger_set_leave_balance_rate_on_insert
  BEFORE INSERT ON leave_balances
  FOR EACH ROW
  WHEN (NEW.rate_of_leave IS NULL OR NEW.rate_of_leave = 0.0)
  EXECUTE FUNCTION set_leave_balance_rate_on_insert();

-- Trigger function to update rate_of_leave when user's employment_terms changes
CREATE OR REPLACE FUNCTION update_leave_balance_rate_on_employment_term_change()
RETURNS TRIGGER AS $$
DECLARE
  v_leave_rate numeric(5,2);
BEGIN
  -- Only proceed if employment_terms actually changed
  IF OLD.employment_terms IS DISTINCT FROM NEW.employment_terms THEN
    -- Get leave rate for the new employment term
    IF NEW.employment_terms IS NULL THEN
      v_leave_rate := 0.0;
    ELSE
      SELECT etlr.leave_rate INTO v_leave_rate
      FROM employment_term_leave_rates etlr
      WHERE etlr.employment_term = NEW.employment_terms;
      
      -- If no rate found, default to 0
      v_leave_rate := COALESCE(v_leave_rate, 0.0);
    END IF;
    
    -- Update all leave balances for this user
    UPDATE leave_balances lb
    SET rate_of_leave = v_leave_rate
    WHERE lb.user_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_leave_balance_rate_on_employment_term_change IS 'Trigger function that updates rate_of_leave in all leave_balances when a user''s employment_terms changes.';

-- Create trigger on users table
DROP TRIGGER IF EXISTS trigger_update_leave_balance_rate_on_employment_term_change ON users;
CREATE TRIGGER trigger_update_leave_balance_rate_on_employment_term_change
  AFTER UPDATE OF employment_terms ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_leave_balance_rate_on_employment_term_change();

-- Trigger function to update rate_of_leave when employment_term_leave_rates change
CREATE OR REPLACE FUNCTION update_leave_balance_rate_on_rate_change()
RETURNS TRIGGER AS $$
DECLARE
  v_affected_term text;
BEGIN
  -- Determine which employment term was affected
  v_affected_term := COALESCE(NEW.employment_term, OLD.employment_term);
  
  -- Update all leave balances for users with this employment term
  UPDATE leave_balances lb
  SET rate_of_leave = NEW.leave_rate
  WHERE lb.user_id IN (
    SELECT u.id FROM users u WHERE u.employment_terms = v_affected_term
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_leave_balance_rate_on_rate_change IS 'Trigger function that updates rate_of_leave in all leave_balances when employment_term_leave_rates are updated.';

-- Create trigger on employment_term_leave_rates table
DROP TRIGGER IF EXISTS trigger_update_leave_balance_rate_on_rate_change ON employment_term_leave_rates;
CREATE TRIGGER trigger_update_leave_balance_rate_on_rate_change
  AFTER UPDATE OF leave_rate ON employment_term_leave_rates
  FOR EACH ROW
  WHEN (OLD.leave_rate IS DISTINCT FROM NEW.leave_rate)
  EXECUTE FUNCTION update_leave_balance_rate_on_rate_change();

-- Update all existing leave balances with rates based on current employment terms
-- This is a one-time update for existing data
SELECT update_all_users_leave_rates_from_employment_terms();

