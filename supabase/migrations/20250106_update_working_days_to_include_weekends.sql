-- Update the attendance calculation function to count total days in month instead of just weekdays
-- This is because employees get paid for weekends as they are considered paid holidays

CREATE OR REPLACE FUNCTION calculate_attendance_summary(p_user_id uuid, p_month integer, p_year integer)
RETURNS void AS $$
DECLARE
  working_days integer;
  present_days integer;
  leave_days integer;
  weekend_days integer;
  paid_leave_days numeric(5,2);
  total_hours numeric(6,2);
BEGIN
  -- Calculate total days in month (including weekends as they are paid holidays)
  -- Employees get paid for weekends, so we count all days in the month
  SELECT EXTRACT(DAY FROM (DATE(p_year || '-' || p_month || '-01') + INTERVAL '1 month - 1 day')::date)
  INTO working_days;

  -- Calculate weekend days in the month
  SELECT COUNT(*)
  INTO weekend_days
  FROM generate_series(
    DATE(p_year || '-' || p_month || '-01'),
    (DATE(p_year || '-' || p_month || '-01') + INTERVAL '1 month - 1 day')::date,
    '1 day'::interval
  ) AS day_series(day)
  WHERE EXTRACT(DOW FROM day) IN (0, 6); -- Include Sunday (0) and Saturday (6)

  -- Calculate days present from time entries (only actual work days, not weekends)
  SELECT COUNT(DISTINCT entry_date)
  INTO present_days
  FROM time_entries
  WHERE user_id = p_user_id
    AND EXTRACT(MONTH FROM entry_date) = p_month
    AND EXTRACT(YEAR FROM entry_date) = p_year;

  -- Calculate leave days (including weekends if leave spans weekends)
  SELECT COALESCE(SUM(days_count), 0)
  INTO leave_days
  FROM leave_applications
  WHERE user_id = p_user_id
    AND status = 'approved'
    AND EXTRACT(MONTH FROM start_date) = p_month
    AND EXTRACT(YEAR FROM start_date) = p_year;

  -- Calculate total hours worked
  SELECT COALESCE(SUM(hours_worked), 0)
  INTO total_hours
  FROM time_entries
  WHERE user_id = p_user_id
    AND EXTRACT(MONTH FROM entry_date) = p_month
    AND EXTRACT(YEAR FROM entry_date) = p_year;

  -- Calculate conditional weekend days (only paid if worked Friday AND Monday)
  weekend_days := calculate_conditional_weekend_days(p_user_id, p_month, p_year);

  -- Calculate paid leave days (approved leaves with 0 LOP portion)
  paid_leave_days := calculate_paid_leave_days(p_user_id, p_month, p_year);

  -- Insert or update attendance summary
  -- Note: Final payable days = present_days + weekend_days + paid_leave_days
  -- We use paid_leave_days instead of total leave_days to avoid including LOP portions
  INSERT INTO attendance_summary (user_id, month, year, total_working_days, days_present, days_absent, days_on_leave, total_hours_worked)
  VALUES (
    p_user_id, 
    p_month, 
    p_year, 
    working_days, 
    GREATEST(0, present_days + weekend_days + paid_leave_days), -- Include conditional weekend days and paid leaves only
    working_days - GREATEST(0, present_days + weekend_days + paid_leave_days), 
    leave_days, -- Keep original leave_days for reporting purposes
    total_hours
  )
  ON CONFLICT (user_id, month, year)
  DO UPDATE SET
    total_working_days = EXCLUDED.total_working_days,
    days_present = EXCLUDED.days_present,
    days_absent = EXCLUDED.days_absent,
    days_on_leave = EXCLUDED.days_on_leave,
    total_hours_worked = EXCLUDED.total_hours_worked,
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- Function to calculate conditional weekend days based on Friday/Monday attendance
CREATE OR REPLACE FUNCTION calculate_conditional_weekend_days(p_user_id uuid, p_month integer, p_year integer)
RETURNS integer AS $$
DECLARE
  weekend_day date;
  friday_date date;
  monday_date date;
  worked_friday boolean;
  worked_monday boolean;
  paid_weekend_days integer := 0;
BEGIN
  -- Loop through all weekends in the month
  FOR weekend_day IN 
    SELECT day::date
    FROM generate_series(
      DATE(p_year || '-' || p_month || '-01'),
      (DATE(p_year || '-' || p_month || '-01') + INTERVAL '1 month - 1 day')::date,
      '1 day'::interval
    ) AS day
    WHERE EXTRACT(DOW FROM day) IN (0, 6) -- Saturday (6) or Sunday (0)
  LOOP
    -- Calculate preceding Friday and upcoming Monday
    IF EXTRACT(DOW FROM weekend_day) = 6 THEN -- Saturday
      friday_date := weekend_day - INTERVAL '1 day';
      monday_date := weekend_day + INTERVAL '2 days';
    ELSE -- Sunday
      friday_date := weekend_day - INTERVAL '2 days';
      monday_date := weekend_day + INTERVAL '1 day';
    END IF;
    
    -- Check if worked or had approved leave on Friday
    -- Approved leaves qualify for weekend payment regardless of LOP status
    -- LOP deductions are handled separately
    SELECT EXISTS (
      SELECT 1 FROM time_entries 
      WHERE user_id = p_user_id AND entry_date = friday_date
      UNION
      SELECT 1 FROM leave_applications 
      WHERE user_id = p_user_id 
        AND status = 'approved'
        AND friday_date BETWEEN start_date AND end_date
    ) INTO worked_friday;
    
    -- Check if worked or had approved leave on Monday
    -- Approved leaves qualify for weekend payment regardless of LOP status
    -- LOP deductions are handled separately
    SELECT EXISTS (
      SELECT 1 FROM time_entries 
      WHERE user_id = p_user_id AND entry_date = monday_date
      UNION
      SELECT 1 FROM leave_applications 
      WHERE user_id = p_user_id 
        AND status = 'approved'
        AND monday_date BETWEEN start_date AND end_date
    ) INTO worked_monday;
    
    -- Weekend is paid only if worked/had leave on BOTH Friday AND Monday
    IF worked_friday AND worked_monday THEN
      paid_weekend_days := paid_weekend_days + 1;
    END IF;
  END LOOP;
  
  RETURN paid_weekend_days;
END;
$$ LANGUAGE plpgsql;

-- Add a comment to clarify the change
COMMENT ON FUNCTION calculate_attendance_summary(uuid, integer, integer) IS 
'Calculates attendance summary for an employee for a given month. 
Working days now includes weekends but weekends are only paid if employee worked preceding Friday AND upcoming Monday.
The sandwich leave policies handle deductions for unapproved leaves near weekends.';

-- Function to calculate LOP (Loss of Pay) deductions for the month
CREATE OR REPLACE FUNCTION calculate_lop_deductions(p_user_id uuid, p_month integer, p_year integer)
RETURNS numeric(5,2) AS $$
DECLARE
  leave_record RECORD;
  total_lop_days numeric(5,2) := 0;
  leave_start_date date;
  leave_end_date date;
  month_start_date date;
  month_end_date date;
  days_in_month integer;
  total_leave_days integer;
  lop_ratio numeric(5,2);
BEGIN
  -- Calculate month boundaries
  month_start_date := DATE(p_year || '-' || p_month || '-01');
  month_end_date := (month_start_date + INTERVAL '1 month - 1 day')::date;
  
  -- Loop through all approved leave applications with LOP in this month
  FOR leave_record IN 
    SELECT start_date, end_date, lop_days, days_count
    FROM leave_applications
    WHERE user_id = p_user_id
      AND status = 'approved'
      AND lop_days > 0
      AND start_date <= month_end_date
      AND end_date >= month_start_date
  LOOP
    -- Calculate overlap with current month
    leave_start_date := GREATEST(leave_record.start_date, month_start_date);
    leave_end_date := LEAST(leave_record.end_date, month_end_date);
    
    -- Calculate days in current month for this leave
    days_in_month := leave_end_date - leave_start_date + 1;
    
    -- Calculate proportional LOP for days in this month
    total_leave_days := leave_record.days_count;
    IF total_leave_days > 0 THEN
      lop_ratio := leave_record.lop_days::numeric(5,2) / total_leave_days::numeric(5,2);
      total_lop_days := total_lop_days + (days_in_month * lop_ratio);
    END IF;
  END LOOP;
  
  RETURN ROUND(total_lop_days, 2);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_conditional_weekend_days(uuid, integer, integer) IS 
'Calculates weekend days that should be paid based on Friday/Monday attendance.
Weekends are only paid if employee worked (or had approved leave) on both the preceding Friday AND upcoming Monday.
Rules:
- Approved leaves qualify for weekend payment regardless of LOP status
- Unapproved leaves do NOT qualify for weekend payment
- LOP deductions are calculated separately and subtracted from final payable days
- If Friday is unapproved leave, weekend pay is deducted
- If Monday is unapproved leave, weekend pay is deducted';

-- Function to calculate paid leave days (approved leaves excluding LOP portions)
CREATE OR REPLACE FUNCTION calculate_paid_leave_days(p_user_id uuid, p_month integer, p_year integer)
RETURNS numeric(5,2) AS $$
DECLARE
  leave_record RECORD;
  total_paid_leave_days numeric(5,2) := 0;
  leave_start_date date;
  leave_end_date date;
  month_start_date date;
  month_end_date date;
  days_in_month integer;
  total_leave_days integer;
  lop_days numeric(5,2);
  paid_portion numeric(5,2);
BEGIN
  -- Calculate month boundaries
  month_start_date := DATE(p_year || '-' || p_month || '-01');
  month_end_date := (month_start_date + INTERVAL '1 month - 1 day')::date;
  
  -- Loop through all approved leave applications in this month
  FOR leave_record IN 
    SELECT start_date, end_date, COALESCE(lop_days, 0) as lop_days, days_count
    FROM leave_applications
    WHERE user_id = p_user_id
      AND status = 'approved'
      AND start_date <= month_end_date
      AND end_date >= month_start_date
  LOOP
    -- Calculate overlap with current month
    leave_start_date := GREATEST(leave_record.start_date, month_start_date);
    leave_end_date := LEAST(leave_record.end_date, month_end_date);
    
    -- Calculate days in current month for this leave
    days_in_month := leave_end_date - leave_start_date + 1;
    
    -- Calculate paid portion (excluding LOP)
    total_leave_days := leave_record.days_count;
    lop_days := leave_record.lop_days;
    
    IF total_leave_days > 0 THEN
      paid_portion := (total_leave_days - lop_days) / total_leave_days;
      total_paid_leave_days := total_paid_leave_days + (days_in_month * paid_portion);
    END IF;
  END LOOP;
  
  RETURN ROUND(total_paid_leave_days, 2);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_lop_deductions(uuid, integer, integer) IS 
'Calculates LOP (Loss of Pay) deductions for approved leaves in a given month.
Even if a leave is approved and qualifies for weekend payment, the LOP portion is still deducted from payable days.
Handles partial month leaves by calculating proportional LOP based on days that fall within the month.';

COMMENT ON FUNCTION calculate_paid_leave_days(uuid, integer, integer) IS 
'Calculates paid leave days (approved leaves excluding LOP portions) for a given month.
If a leave is approved with 0 LOP days, it counts as fully paid leave.
If a leave has partial LOP (e.g., 1 LOP day out of 3 total days), only the non-LOP portion counts as paid leave.
This ensures that approved paid leaves are properly included in payable days calculation.';
