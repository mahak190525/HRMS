/*
  # Payroll Adjustments System

  1. New Tables
    - `payroll_adjustments`
      - Stores manual adjustments to employee payroll
      - Tracks who made adjustments and when
      - Includes reason for audit trail

  2. Security
    - Enable RLS on payroll_adjustments table
    - Finance team can create and update adjustments
    - HR can view all adjustments
    - Employees can view their own adjustments

  3. Features
    - Manual salary adjustments for technical corrections
    - Bonus and incentive tracking
    - Overtime hour adjustments
    - Complete audit trail with reasons
*/

-- Create payroll_adjustments table
CREATE TABLE IF NOT EXISTS payroll_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) NOT NULL,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  year integer NOT NULL,
  basic_salary_adjustment numeric(10,2) DEFAULT 0,
  allowances_adjustment numeric(10,2) DEFAULT 0,
  deductions_adjustment numeric(10,2) DEFAULT 0,
  bonus_amount numeric(10,2) DEFAULT 0,
  overtime_hours numeric(4,2) DEFAULT 0,
  adjustment_reason text,
  adjusted_by uuid REFERENCES users(id) NOT NULL,
  adjusted_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id, month, year)
);

-- Enable RLS
ALTER TABLE payroll_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payroll_adjustments
CREATE POLICY "Users can read own payroll adjustments"
  ON payroll_adjustments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Finance and HR can read all payroll adjustments"
  ON payroll_adjustments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role_id IN (
        SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'hr', 'finance', 'finance_manager')
      )
    )
  );

CREATE POLICY "Finance and HR can manage payroll adjustments"
  ON payroll_adjustments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role_id IN (
        SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'hr', 'finance', 'finance_manager')
      )
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payroll_adjustments_user_month_year ON payroll_adjustments(user_id, month, year);
CREATE INDEX IF NOT EXISTS idx_payroll_adjustments_adjusted_by ON payroll_adjustments(adjusted_by);
CREATE INDEX IF NOT EXISTS idx_payroll_adjustments_adjusted_at ON payroll_adjustments(adjusted_at DESC);

-- Function to calculate adjusted payroll
CREATE OR REPLACE FUNCTION get_adjusted_payroll(p_user_id uuid, p_month integer, p_year integer)
RETURNS TABLE (
  base_salary numeric,
  total_allowances numeric,
  total_deductions numeric,
  bonus_amount numeric,
  overtime_hours numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(pa.basic_salary_adjustment, 0) as base_salary,
    COALESCE(pa.allowances_adjustment, 0) as total_allowances,
    COALESCE(pa.deductions_adjustment, 0) as total_deductions,
    COALESCE(pa.bonus_amount, 0) as bonus_amount,
    COALESCE(pa.overtime_hours, 0) as overtime_hours
  FROM payroll_adjustments pa
  WHERE pa.user_id = p_user_id 
    AND pa.month = p_month 
    AND pa.year = p_year;
END;
$$ LANGUAGE plpgsql;