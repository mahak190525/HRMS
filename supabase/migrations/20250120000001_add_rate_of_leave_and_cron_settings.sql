/*
  # Add Rate of Leave and Cron Job Settings
  
  1. Add rate_of_leave column to leave_balances table
  2. Create leave_cron_settings table for global cron configuration
  3. Create function for monthly leave allocation
  4. Create function to check if cron should run
*/

-- ========================================
-- 1. ADD RATE OF LEAVE COLUMN
-- ========================================

-- Add rate_of_leave column to leave_balances table
ALTER TABLE leave_balances 
ADD COLUMN IF NOT EXISTS rate_of_leave NUMERIC(5,2) DEFAULT 0.0;

-- Add comment
COMMENT ON COLUMN leave_balances.rate_of_leave IS 'Number of leave days added to employee balance each month. Configurable per employee.';

-- ========================================
-- 2. CREATE CRON SETTINGS TABLE
-- ========================================

-- Create table for cron job settings
CREATE TABLE IF NOT EXISTS leave_cron_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cron_schedule text NOT NULL DEFAULT '0 0 1 * *', -- Default: 1st day of month at midnight (cron format)
  end_date date NOT NULL, -- Date after which cron job stops running
  is_active boolean DEFAULT true, -- Enable/disable cron job
  last_run_at timestamptz, -- Track last execution time
  next_run_at timestamptz, -- Track next scheduled execution
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.users(id),
  updated_by uuid REFERENCES public.users(id)
);

-- Add comment
COMMENT ON TABLE leave_cron_settings IS 'Global settings for monthly leave allocation cron job. Only one active setting should exist at a time.';

-- Create index for active settings
CREATE INDEX IF NOT EXISTS idx_leave_cron_settings_active ON leave_cron_settings(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE leave_cron_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Admins can view cron settings" ON leave_cron_settings;
DROP POLICY IF EXISTS "Admins can insert cron settings" ON leave_cron_settings;
DROP POLICY IF EXISTS "Admins can update cron settings" ON leave_cron_settings;

-- RLS Policy: Only admins/HR can view and modify cron settings
CREATE POLICY "Admins can view cron settings" ON leave_cron_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND (r.name = 'admin' OR r.name = 'HR')
    )
  );

CREATE POLICY "Admins can insert cron settings" ON leave_cron_settings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND (r.name = 'admin' OR r.name = 'HR')
    )
  );

CREATE POLICY "Admins can update cron settings" ON leave_cron_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND (r.name = 'admin' OR r.name = 'HR')
    )
  );

-- ========================================
-- 3. CREATE MONTHLY LEAVE ALLOCATION FUNCTION
-- ========================================

-- Function to allocate monthly leave based on rate_of_leave
CREATE OR REPLACE FUNCTION allocate_monthly_leave(p_skip_cron_check boolean DEFAULT false)
RETURNS TABLE (
  user_id uuid,
  employee_name text,
  rate_of_leave numeric,
  allocated_days numeric,
  success boolean,
  message text
) AS $$
DECLARE
  v_settings record;
  v_current_date date;
  v_current_year integer;
  v_leave_type_id uuid;
  v_balance_record record;
  v_allocated_count integer := 0;
  v_error_count integer := 0;
  v_previous_allocated numeric;
  v_new_allocated numeric;
  v_next_run timestamptz;
  v_previous_next_run timestamptz;
  v_base_time timestamptz;
BEGIN
  -- Get current date and year
  v_current_date := CURRENT_DATE;
  v_current_year := EXTRACT(YEAR FROM v_current_date)::integer;
  
  -- Always get settings (for updating last_run_at), but only validate if not manual trigger
  SELECT * INTO v_settings
  FROM public.leave_cron_settings
  WHERE is_active = true
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Check if cron should run (skip validation if manual trigger)
  IF NOT p_skip_cron_check THEN
    -- If no active settings, return error (only for scheduled runs)
    IF v_settings IS NULL THEN
      RETURN QUERY SELECT 
        NULL::uuid, 
        NULL::text, 
        NULL::numeric, 
        NULL::numeric, 
        false, 
        'No active cron settings found'::text;
      RETURN;
    END IF;
    
    -- Check if end date has passed (only for scheduled runs)
    IF v_current_date > v_settings.end_date THEN
      RETURN QUERY SELECT 
        NULL::uuid, 
        NULL::text, 
        NULL::numeric, 
        NULL::numeric, 
        false, 
        format('Cron job end date (%s) has passed. Please update settings.', v_settings.end_date)::text;
      RETURN;
    END IF;
  END IF;
  
  -- Get the default leave type ID (Annual Leave or Total Leave)
  SELECT id INTO v_leave_type_id
  FROM public.leave_types
  WHERE LOWER(name) IN ('total leave', 'annual leave', 'total')
  ORDER BY created_at
  LIMIT 1;
  
  IF v_leave_type_id IS NULL THEN
    RETURN QUERY SELECT 
      NULL::uuid, 
      NULL::text, 
      NULL::numeric, 
      NULL::numeric, 
      false, 
      'No leave type found. Please create Annual Leave or Total Leave type.'::text;
    RETURN;
  END IF;
  
  -- Process each employee with a rate_of_leave > 0
  FOR v_balance_record IN
    SELECT 
      lb.id,
      lb.user_id,
      u.full_name,
      lb.rate_of_leave,
      lb.allocated_days,
      lb.used_days
    FROM public.leave_balances lb
    JOIN public.users u ON lb.user_id = u.id
    WHERE lb.year = v_current_year
      AND lb.leave_type_id = v_leave_type_id
      AND COALESCE(lb.rate_of_leave, 0) > 0
      AND u.status = 'active'
  LOOP
    BEGIN
      v_previous_allocated := v_balance_record.allocated_days;
      v_new_allocated := v_previous_allocated + v_balance_record.rate_of_leave;
      
      -- Update allocated_days by adding rate_of_leave
      UPDATE public.leave_balances
      SET 
        allocated_days = v_new_allocated,
        updated_at = now()
      WHERE id = v_balance_record.id;
      
      -- Log the allocation (use user_id as adjusted_by for system allocations)
      BEGIN
        INSERT INTO public.leave_balance_adjustments (
          user_id,
          balance_id,
          adjustment_type,
          amount,
          reason,
          previous_allocated,
          new_allocated,
          adjusted_by,
          created_at
        )
        VALUES (
          v_balance_record.user_id,
          v_balance_record.id,
          'add',
          v_balance_record.rate_of_leave,
          format('Monthly leave allocation (Rate: %s days/month)', v_balance_record.rate_of_leave),
          v_previous_allocated,
          v_new_allocated,
          v_balance_record.user_id, -- Use user_id for system allocations
          now()
        );
      EXCEPTION WHEN OTHERS THEN
        -- Log the error but don't fail the whole operation
        RAISE WARNING 'Failed to log adjustment for user %: %', v_balance_record.user_id, SQLERRM;
      END;
      
      v_allocated_count := v_allocated_count + 1;
      
      RETURN QUERY SELECT 
        v_balance_record.user_id,
        v_balance_record.full_name,
        v_balance_record.rate_of_leave,
        v_balance_record.rate_of_leave,
        true,
        format('Successfully allocated %s days', v_balance_record.rate_of_leave)::text;
        
    EXCEPTION WHEN OTHERS THEN
      v_error_count := v_error_count + 1;
      RETURN QUERY SELECT 
        v_balance_record.user_id,
        v_balance_record.full_name,
        v_balance_record.rate_of_leave,
        NULL::numeric,
        false,
        format('Error: %s', SQLERRM)::text;
    END;
  END LOOP;
  
  -- Update last_run_at and next_run_at in settings (only if settings exist)
  -- This should happen regardless of whether it's a manual or scheduled trigger
  IF v_settings IS NOT NULL THEN
    BEGIN
      -- Use the existing next_run_at as last_run_at if it exists, otherwise use now()
      -- This ensures we track when the job was actually scheduled to run
      -- Get the current next_run_at value (or use now() if null)
      v_previous_next_run := COALESCE(v_settings.next_run_at, now());
      v_base_time := v_previous_next_run;
      
      -- Calculate next run time based on cron schedule
      -- Use the previous next_run_at (or now()) as the base time for calculation
      v_next_run := calculate_next_run_time(v_settings.cron_schedule, v_base_time);
      
      -- If calculation failed, try with current time
      IF v_next_run IS NULL THEN
        v_next_run := calculate_next_run_time(v_settings.cron_schedule, now());
        v_base_time := now();
      END IF;
      
      -- Update the settings: move next_run_at to last_run_at, then set new next_run_at
      UPDATE public.leave_cron_settings
      SET 
        last_run_at = v_base_time,  -- Use the time the job was scheduled to run (or now() if first run)
        next_run_at = v_next_run,   -- Calculate new next run time
        updated_at = now()
      WHERE id = v_settings.id;
      
      -- Verify the update succeeded
      IF NOT FOUND THEN
        RAISE WARNING 'Failed to update last_run_at for cron settings with id: %', v_settings.id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the allocation
      RAISE WARNING 'Error updating last_run_at: %', SQLERRM;
    END;
  ELSE
    -- Log warning if no settings found (but don't fail the operation)
    RAISE WARNING 'No active cron settings found to update last_run_at';
  END IF;
  
  -- If no records processed, return a summary
  IF v_allocated_count = 0 AND v_error_count = 0 THEN
    RETURN QUERY SELECT 
      NULL::uuid, 
      NULL::text, 
      NULL::numeric, 
      NULL::numeric, 
      true, 
      'No employees found with rate_of_leave > 0'::text;
  END IF;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON FUNCTION allocate_monthly_leave() IS 'Allocates monthly leave to all active employees based on their rate_of_leave. Checks cron settings before running.';

-- ========================================
-- 4. CREATE FUNCTION TO GET ACTIVE CRON SETTINGS
-- ========================================

CREATE OR REPLACE FUNCTION get_active_cron_settings()
RETURNS TABLE (
  id uuid,
  cron_schedule text,
  end_date date,
  is_active boolean,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    lcs.id,
    lcs.cron_schedule,
    lcs.end_date,
    lcs.is_active,
    lcs.last_run_at,
    lcs.next_run_at,
    lcs.created_at,
    lcs.updated_at
  FROM public.leave_cron_settings lcs
  WHERE lcs.is_active = true
  ORDER BY lcs.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- 5. CREATE FUNCTION TO CALCULATE NEXT RUN TIME
-- ========================================

-- Helper function to extract numeric value from cron field (handles *, */N, N, N-M)
CREATE OR REPLACE FUNCTION extract_cron_value(p_field text, p_default integer DEFAULT 0)
RETURNS integer AS $$
DECLARE
  v_value text;
BEGIN
  -- Handle wildcard
  IF p_field = '*' THEN
    RETURN p_default;
  END IF;
  
  -- Handle step expressions (e.g., */2, 0-59/5)
  IF p_field LIKE '%/%' THEN
    -- Extract the base part before the /
    v_value := split_part(p_field, '/', 1);
    -- If it's */N, use default
    IF v_value = '*' THEN
      RETURN p_default;
    END IF;
    -- If it's a range like 0-59/5, extract the start
    IF v_value LIKE '%-%' THEN
      v_value := split_part(v_value, '-', 1);
    END IF;
    -- Try to convert to integer
    BEGIN
      RETURN v_value::integer;
    EXCEPTION WHEN OTHERS THEN
      RETURN p_default;
    END;
  END IF;
  
  -- Handle ranges (e.g., 0-59) - use the start value
  IF p_field LIKE '%-%' THEN
    v_value := split_part(p_field, '-', 1);
    BEGIN
      RETURN v_value::integer;
    EXCEPTION WHEN OTHERS THEN
      RETURN p_default;
    END;
  END IF;
  
  -- Handle lists (e.g., 0,5,10) - use the first value
  IF p_field LIKE '%,%' THEN
    v_value := split_part(p_field, ',', 1);
    BEGIN
      RETURN v_value::integer;
    EXCEPTION WHEN OTHERS THEN
      RETURN p_default;
    END;
  END IF;
  
  -- Try to convert directly to integer
  BEGIN
    RETURN p_field::integer;
  EXCEPTION WHEN OTHERS THEN
    RETURN p_default;
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Helper function to calculate next run time from cron schedule
CREATE OR REPLACE FUNCTION calculate_next_run_time(p_cron_schedule text, p_current_time timestamptz DEFAULT now())
RETURNS timestamptz AS $$
DECLARE
  v_parts text[];
  v_minute integer;
  v_hour integer;
  v_day integer;
  v_month integer;
  v_weekday integer;
  v_next_run timestamptz;
  v_current_date date;
  v_year integer;
  v_current_minute integer;
  v_current_hour integer;
BEGIN
  -- Parse cron schedule (minute hour day month weekday)
  v_parts := string_to_array(trim(p_cron_schedule), ' ');
  
  IF array_length(v_parts, 1) != 5 THEN
    RETURN NULL;
  END IF;
  
  -- Extract values using helper function (handles *, */N, N, N-M, etc.)
  v_minute := extract_cron_value(v_parts[1], 0);
  v_hour := extract_cron_value(v_parts[2], 0);
  v_day := CASE 
    WHEN v_parts[3] = '*' THEN NULL 
    ELSE extract_cron_value(v_parts[3], 1) 
  END;
  v_month := CASE 
    WHEN v_parts[4] = '*' THEN NULL 
    ELSE extract_cron_value(v_parts[4], 1) 
  END;
  v_weekday := CASE 
    WHEN v_parts[5] = '*' THEN NULL 
    ELSE extract_cron_value(v_parts[5], 0) 
  END;
  
  v_current_date := p_current_time::date;
  v_year := EXTRACT(YEAR FROM v_current_date)::integer;
  v_current_minute := EXTRACT(MINUTE FROM p_current_time)::integer;
  v_current_hour := EXTRACT(HOUR FROM p_current_time)::integer;
  
  -- For schedules with step expressions in minutes (e.g., */2 * * * *)
  IF v_parts[1] LIKE '%/%' AND v_parts[2] = '*' AND v_parts[3] = '*' AND v_parts[4] = '*' AND v_parts[5] = '*' THEN
    -- Calculate next run based on minute step
    DECLARE
      v_step integer;
      v_base_minute integer;
    BEGIN
      v_step := split_part(v_parts[1], '/', 2)::integer;
      v_base_minute := (v_current_minute / v_step) * v_step;
      v_next_run := date_trunc('hour', p_current_time) + (v_base_minute || ' minutes')::interval;
      
      -- If the calculated time is in the past, add one step
      IF v_next_run <= p_current_time THEN
        v_next_run := v_next_run + (v_step || ' minutes')::interval;
      END IF;
      
      RETURN v_next_run;
    END;
  END IF;
  
  -- For monthly schedules (day is specified, month is *)
  IF v_day IS NOT NULL AND v_month IS NULL THEN
    -- Calculate next occurrence of this day in the month
    v_next_run := make_timestamp(
      v_year,
      COALESCE(EXTRACT(MONTH FROM v_current_date)::integer, 1),
      v_day,
      v_hour,
      v_minute,
      0
    )::timestamptz;
    
    -- If the calculated time is in the past, move to next month
    IF v_next_run <= p_current_time THEN
      v_next_run := (v_next_run + INTERVAL '1 month')::timestamptz;
    END IF;
  -- For daily schedules (day and month are *)
  ELSIF v_day IS NULL AND v_month IS NULL THEN
    v_next_run := make_timestamp(
      EXTRACT(YEAR FROM v_current_date)::integer,
      EXTRACT(MONTH FROM v_current_date)::integer,
      EXTRACT(DAY FROM v_current_date)::integer,
      v_hour,
      v_minute,
      0
    )::timestamptz;
    
    -- If the calculated time is in the past, move to next day
    IF v_next_run <= p_current_time THEN
      v_next_run := (v_next_run + INTERVAL '1 day')::timestamptz;
    END IF;
  ELSE
    -- For other schedules, calculate next month as fallback
    v_next_run := (p_current_time + INTERVAL '1 month')::timestamptz;
  END IF;
  
  RETURN v_next_run;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 6. CREATE FUNCTION TO MANAGE PG_CRON JOB
-- ========================================

-- Function to schedule/unschedule the pg_cron job based on settings
CREATE OR REPLACE FUNCTION manage_leave_allocation_cron_job()
RETURNS text AS $$
DECLARE
  v_settings record;
  v_job_exists boolean;
  v_job_id bigint;
  v_next_run timestamptz;
BEGIN
  -- Check if pg_cron extension is available
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN 'ERROR: pg_cron extension is not enabled. Please enable it in your Supabase dashboard.';
  END IF;

  -- Get active cron settings
  SELECT * INTO v_settings
  FROM public.leave_cron_settings
  WHERE is_active = true
  ORDER BY created_at DESC
  LIMIT 1;

  -- Check if job already exists
  SELECT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'monthly-leave-allocation'
  ) INTO v_job_exists;

  -- If no active settings, unschedule the job if it exists
  IF v_settings IS NULL THEN
    IF v_job_exists THEN
      PERFORM cron.unschedule('monthly-leave-allocation');
      RETURN 'SUCCESS: Cron job unscheduled (no active settings)';
    END IF;
    RETURN 'INFO: No active cron settings found. No action taken.';
  END IF;

  -- If settings exist and are active, schedule/update the job
  IF v_settings.is_active THEN
    -- Unschedule existing job if it exists
    IF v_job_exists THEN
      PERFORM cron.unschedule('monthly-leave-allocation');
    END IF;

    -- Calculate next run time
    v_next_run := calculate_next_run_time(v_settings.cron_schedule);

    -- Schedule the new job
    SELECT cron.schedule(
      'monthly-leave-allocation',
      v_settings.cron_schedule,
      'SELECT allocate_monthly_leave(false)'
    ) INTO v_job_id;

    -- Update next_run_at in settings
    UPDATE public.leave_cron_settings
    SET next_run_at = v_next_run,
        updated_at = now()
    WHERE id = v_settings.id;

    RETURN format('SUCCESS: Cron job scheduled with ID %s. Schedule: %s. Next run: %s', 
      v_job_id, 
      v_settings.cron_schedule,
      COALESCE(v_next_run::text, 'Unable to calculate')
    );
  ELSE
    -- Settings exist but are inactive, unschedule if job exists
    IF v_job_exists THEN
      PERFORM cron.unschedule('monthly-leave-allocation');
    END IF;
    
    -- Clear next_run_at
    UPDATE public.leave_cron_settings
    SET next_run_at = NULL,
        updated_at = now()
    WHERE id = v_settings.id;
    
    RETURN 'SUCCESS: Cron job unscheduled (settings are inactive)';
  END IF;

EXCEPTION WHEN OTHERS THEN
  RETURN format('ERROR: %s', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION manage_leave_allocation_cron_job() TO authenticated;

-- Add comment
COMMENT ON FUNCTION manage_leave_allocation_cron_job() IS 'Manages the pg_cron job for monthly leave allocation based on active cron settings. Call this after updating cron settings.';

-- ========================================
-- 6. UPDATE get_all_employees_leave_balances FUNCTION
-- ========================================

-- Update the function to include rate_of_leave
DROP FUNCTION IF EXISTS get_all_employees_leave_balances(integer);

CREATE OR REPLACE FUNCTION get_all_employees_leave_balances(p_year integer DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::integer)
RETURNS TABLE (
  user_id uuid,
  employee_id text,
  full_name text,
  email text,
  manager_id uuid,
  tenure_months numeric,
  monthly_rate numeric,
  allocated_days numeric,
  used_days numeric,
  remaining_days numeric,
  rate_of_leave numeric,
  carry_forward_from_previous_year numeric,
  anniversary_reset_date date,
  is_anniversary_today boolean,
  balance_id uuid
) AS $$
BEGIN
  RETURN QUERY
  WITH user_tenure AS (
    SELECT 
      u.id,
      u.employee_id,
      u.full_name,
      u.email,
      u.manager_id,
      get_tenure_months(u.date_of_joining)::numeric as tenure_months,
      CASE 
        WHEN get_tenure_months(u.date_of_joining)::numeric >= 12 THEN 2.0::numeric
        ELSE 1.5::numeric
      END as monthly_rate,
      u.date_of_joining,
      (u.date_of_joining + INTERVAL '1 year' * (EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM u.date_of_joining)))::date as anniversary_date,
      CURRENT_DATE = (u.date_of_joining + INTERVAL '1 year' * (EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM u.date_of_joining)))::date as is_anniversary
    FROM public.users u
    WHERE u.role_id IS NOT NULL
  )
  SELECT 
    ut.id as user_id,
    ut.employee_id,
    ut.full_name,
    ut.email,
    ut.manager_id,
    ut.tenure_months,
    ut.monthly_rate,
    COALESCE(lb.allocated_days, 0::numeric) as allocated_days,
    COALESCE(lb.used_days, 0::numeric) as used_days,
    COALESCE(lb.allocated_days - lb.used_days, 0::numeric) as remaining_days,
    COALESCE(lb.rate_of_leave, 0::numeric) as rate_of_leave,
    COALESCE(lb.carry_forward_from_previous_year, 0::numeric) as carry_forward_from_previous_year,
    ut.anniversary_date as anniversary_reset_date,
    ut.is_anniversary as is_anniversary_today,
    lb.id as balance_id
  FROM user_tenure ut
  LEFT JOIN public.leave_balances lb ON 
    lb.user_id = ut.id AND 
    lb.year = p_year AND
    lb.leave_type_id = (
      SELECT id FROM public.leave_types 
      WHERE LOWER(name) IN ('total leave', 'total', 'annual leave') 
      ORDER BY created_at 
      LIMIT 1
    )
  ORDER BY ut.full_name;
END;
$$ LANGUAGE plpgsql;

