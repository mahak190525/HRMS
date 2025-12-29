/*
  # Add Salary Annexure and Loyalty Bonus Fields Migration
  
  This migration adds comprehensive salary calculation fields and loyalty bonus tracking
  to the users table. All fields are stored as text to allow for admin configuration
  of formulas, with calculations performed in the frontend.
  
  Features:
  - Salary Annexure fields with configurable formulas
  - Loyalty Bonus tracking with installment management
  - All monetary fields as text for flexibility
  - Checkbox fields for applicability flags
  - Date tracking for loyalty bonus installments
  
  Date: 2025-01-01
*/

-- ========================================
-- 1. SALARY ANNEXURE FIELDS
-- ========================================

-- PF and ESI Applicability (Checkboxes)
ALTER TABLE users ADD COLUMN IF NOT EXISTS pf_applicable BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS esi_applicable BOOLEAN DEFAULT FALSE;

-- Core Salary Fields (Text fields for admin-configurable formulas)
-- Note: annual_ctc uses existing 'salary' field, no need to add new field
ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_ctc TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_basic_pay TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS hra TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS night_allowance TEXT DEFAULT '2000';
ALTER TABLE users ADD COLUMN IF NOT EXISTS special_allowance TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_gross TEXT;

-- Employer Contributions
ALTER TABLE users ADD COLUMN IF NOT EXISTS employer_pf TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS employer_esi TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_gratuity_provision TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_bonus_provision TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS group_medical_insurance TEXT DEFAULT '138';

-- Employee Deductions
ALTER TABLE users ADD COLUMN IF NOT EXISTS pf_employee TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS esi_employee TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tds TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS professional_tax TEXT DEFAULT '200';

-- Calculated Fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_deductions TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS net_pay TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_take_home_salary TEXT;

-- ========================================
-- 2. LOYALTY BONUS FIELDS
-- ========================================

-- Basic Loyalty Bonus Information
ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_bonus_enrollment_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_bonus_specific_condition TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_bonus_tenure_period TEXT DEFAULT '3';
ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_bonus_amount TEXT;

-- Installment Amounts (6 installments maximum as per 3-year default tenure)
ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_bonus_installment_1_amount TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_bonus_installment_2_amount TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_bonus_installment_3_amount TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_bonus_installment_4_amount TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_bonus_installment_5_amount TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_bonus_installment_6_amount TEXT;

-- Installment Dates
ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_bonus_installment_1_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_bonus_installment_2_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_bonus_installment_3_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_bonus_installment_4_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_bonus_installment_5_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_bonus_installment_6_date DATE;

-- Installment Disbursement Status (Checkboxes)
ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_bonus_installment_1_disbursed BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_bonus_installment_2_disbursed BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_bonus_installment_3_disbursed BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_bonus_installment_4_disbursed BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_bonus_installment_5_disbursed BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_bonus_installment_6_disbursed BOOLEAN DEFAULT FALSE;

-- ========================================
-- 3. ADD INDEXES FOR PERFORMANCE
-- ========================================

-- Indexes for salary fields that might be queried frequently
CREATE INDEX IF NOT EXISTS idx_users_pf_applicable ON users(pf_applicable);
CREATE INDEX IF NOT EXISTS idx_users_esi_applicable ON users(esi_applicable);
CREATE INDEX IF NOT EXISTS idx_users_loyalty_bonus_enrollment_date ON users(loyalty_bonus_enrollment_date);

-- Indexes for loyalty bonus installment dates for payroll queries
CREATE INDEX IF NOT EXISTS idx_users_loyalty_bonus_installment_1_date ON users(loyalty_bonus_installment_1_date);
CREATE INDEX IF NOT EXISTS idx_users_loyalty_bonus_installment_2_date ON users(loyalty_bonus_installment_2_date);
CREATE INDEX IF NOT EXISTS idx_users_loyalty_bonus_installment_3_date ON users(loyalty_bonus_installment_3_date);
CREATE INDEX IF NOT EXISTS idx_users_loyalty_bonus_installment_4_date ON users(loyalty_bonus_installment_4_date);
CREATE INDEX IF NOT EXISTS idx_users_loyalty_bonus_installment_5_date ON users(loyalty_bonus_installment_5_date);
CREATE INDEX IF NOT EXISTS idx_users_loyalty_bonus_installment_6_date ON users(loyalty_bonus_installment_6_date);

-- ========================================
-- 4. ADD COMMENTS FOR DOCUMENTATION
-- ========================================

-- Salary Annexure Comments
COMMENT ON COLUMN users.pf_applicable IS 'PF applicability checkbox - employee discretion at joining';
COMMENT ON COLUMN users.esi_applicable IS 'ESI applicability - triggers only if Monthly Gross < Rs. 21000/month';
COMMENT ON COLUMN users.monthly_ctc IS 'Monthly CTC = Annual CTC/12 (calculated field)';
COMMENT ON COLUMN users.monthly_basic_pay IS 'Monthly Basic Pay = 51% of Monthly CTC (calculated field)';
COMMENT ON COLUMN users.hra IS 'HRA = 40% of Monthly Basic Pay (calculated field)';
COMMENT ON COLUMN users.night_allowance IS 'Night Allowance - default Rs. 2000 (editable)';
COMMENT ON COLUMN users.special_allowance IS 'Special Allowance = Monthly CTC - [Basic + HRA + Night + Employer contributions] (calculated)';
COMMENT ON COLUMN users.monthly_gross IS 'Monthly Gross = sum of all allowances (calculated field)';
COMMENT ON COLUMN users.employer_pf IS 'Employer PF = 12% of Basic Pay (only when PF enabled, otherwise 0)';
COMMENT ON COLUMN users.employer_esi IS 'Employer ESI = 3.25% of Monthly Gross (only if Monthly Gross < Rs. 21000)';
COMMENT ON COLUMN users.monthly_gratuity_provision IS 'Monthly Gratuity = [(Monthly Basic Pay * 15)/26]/12 (calculated)';
COMMENT ON COLUMN users.monthly_bonus_provision IS 'Monthly Bonus = Monthly Basic Pay * 8.33% (only if Basic < Rs. 21000)';
COMMENT ON COLUMN users.group_medical_insurance IS 'Group Medical Insurance - default Rs. 138 (editable)';
COMMENT ON COLUMN users.pf_employee IS 'Employee PF = 12% of Basic Pay (calculated field)';
COMMENT ON COLUMN users.esi_employee IS 'Employee ESI = 0.75% of Basic Pay (calculated field)';
COMMENT ON COLUMN users.tds IS 'TDS - manual text field (editable)';
COMMENT ON COLUMN users.professional_tax IS 'Professional Tax - default Rs. 200 (editable)';
COMMENT ON COLUMN users.total_deductions IS 'Total Deductions = PF Employee + ESI Employee + TDS + Professional Tax (calculated)';
COMMENT ON COLUMN users.net_pay IS 'Net Pay = Monthly Gross - Total Deductions (calculated field)';
COMMENT ON COLUMN users.monthly_take_home_salary IS 'Monthly Take Home = Net Pay + Monthly Bonus (when applicable) (calculated)';

-- Loyalty Bonus Comments
COMMENT ON COLUMN users.loyalty_bonus_enrollment_date IS 'Loyalty bonus enrollment date (generally same as date of joining)';
COMMENT ON COLUMN users.loyalty_bonus_specific_condition IS 'Specific conditions for loyalty bonus (text field)';
COMMENT ON COLUMN users.loyalty_bonus_tenure_period IS 'Tenure period in years - default 3 years (editable)';
COMMENT ON COLUMN users.loyalty_bonus_amount IS 'Total loyalty bonus amount (editable)';
COMMENT ON COLUMN users.loyalty_bonus_installment_1_amount IS '1st installment amount (calculated from total/installments)';
COMMENT ON COLUMN users.loyalty_bonus_installment_2_amount IS '2nd installment amount (calculated from total/installments)';
COMMENT ON COLUMN users.loyalty_bonus_installment_3_amount IS '3rd installment amount (calculated from total/installments)';
COMMENT ON COLUMN users.loyalty_bonus_installment_4_amount IS '4th installment amount (calculated from total/installments)';
COMMENT ON COLUMN users.loyalty_bonus_installment_5_amount IS '5th installment amount (calculated from total/installments)';
COMMENT ON COLUMN users.loyalty_bonus_installment_6_amount IS '6th installment amount (calculated from total/installments)';
COMMENT ON COLUMN users.loyalty_bonus_installment_1_date IS '1st installment date (calculated from enrollment date + 6 months)';
COMMENT ON COLUMN users.loyalty_bonus_installment_2_date IS '2nd installment date (calculated from enrollment date + 12 months)';
COMMENT ON COLUMN users.loyalty_bonus_installment_3_date IS '3rd installment date (calculated from enrollment date + 18 months)';
COMMENT ON COLUMN users.loyalty_bonus_installment_4_date IS '4th installment date (calculated from enrollment date + 24 months)';
COMMENT ON COLUMN users.loyalty_bonus_installment_5_date IS '5th installment date (calculated from enrollment date + 30 months)';
COMMENT ON COLUMN users.loyalty_bonus_installment_6_date IS '6th installment date (calculated from enrollment date + 36 months)';
COMMENT ON COLUMN users.loyalty_bonus_installment_1_disbursed IS 'Checkbox to track if 1st installment has been disbursed';
COMMENT ON COLUMN users.loyalty_bonus_installment_2_disbursed IS 'Checkbox to track if 2nd installment has been disbursed';
COMMENT ON COLUMN users.loyalty_bonus_installment_3_disbursed IS 'Checkbox to track if 3rd installment has been disbursed';
COMMENT ON COLUMN users.loyalty_bonus_installment_4_disbursed IS 'Checkbox to track if 4th installment has been disbursed';
COMMENT ON COLUMN users.loyalty_bonus_installment_5_disbursed IS 'Checkbox to track if 5th installment has been disbursed';
COMMENT ON COLUMN users.loyalty_bonus_installment_6_disbursed IS 'Checkbox to track if 6th installment has been disbursed';

-- ========================================
-- 5. UPDATE RPC FUNCTIONS TO INCLUDE NEW FIELDS
-- ========================================

-- Drop existing functions to allow changing return types
DROP FUNCTION IF EXISTS get_employees_with_manager_details();
DROP FUNCTION IF EXISTS get_all_users_with_manager_details();

-- Update get_employees_with_manager_details function to include new salary and loyalty bonus fields
CREATE OR REPLACE FUNCTION get_employees_with_manager_details()
RETURNS TABLE (
  id uuid,
  auth_provider text,
  provider_user_id text,
  email text,
  password_hash text,
  full_name text,
  employee_id text,
  role_id uuid,
  department_id uuid,
  "position" text,
  avatar_url text,
  phone text,
  address text,
  date_of_birth date,
  date_of_joining date,
  salary numeric,
  extra_permissions jsonb,
  status text,
  last_login timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  company_email text,
  manager_id uuid,
  tenure_mechlin interval,
  level_grade text,
  skill text[],
  current_office_location text,
  alternate_contact_no text,
  blood_group text,
  religion text,
  gender text,
  marital_status text,
  date_of_marriage_anniversary date,
  father_name text,
  father_dob date,
  mother_name text,
  mother_dob date,
  designation_offer_letter text,
  permanent_address text,
  aadhar_card_no text,
  pan_no text,
  personal_email text,
  bank_account_no text,
  ifsc_code text,
  qualification text,
  employment_terms text,
  "isSA" boolean,
  comp_off_balance numeric,
  -- Onboarding fields
  appointment_formalities text,
  orientation text,
  order_id_card text,
  email_account text,
  skype_account text,
  system_account text,
  added_to_mailing_list text,
  added_to_attendance_sheet text,
  confluence_info_provided text,
  id_card_provided text,
  remarks text,
  uan_number text,
  is_experienced text,
  -- NEW: Salary Annexure fields
  pf_applicable boolean,
  esi_applicable boolean,
  monthly_ctc text,
  monthly_basic_pay text,
  hra text,
  night_allowance text,
  special_allowance text,
  monthly_gross text,
  employer_pf text,
  employer_esi text,
  monthly_gratuity_provision text,
  monthly_bonus_provision text,
  group_medical_insurance text,
  pf_employee text,
  esi_employee text,
  tds text,
  professional_tax text,
  total_deductions text,
  net_pay text,
  monthly_take_home_salary text,
  -- NEW: Loyalty Bonus fields
  loyalty_bonus_enrollment_date date,
  loyalty_bonus_specific_condition text,
  loyalty_bonus_tenure_period text,
  loyalty_bonus_amount text,
  loyalty_bonus_installment_1_amount text,
  loyalty_bonus_installment_2_amount text,
  loyalty_bonus_installment_3_amount text,
  loyalty_bonus_installment_4_amount text,
  loyalty_bonus_installment_5_amount text,
  loyalty_bonus_installment_6_amount text,
  loyalty_bonus_installment_1_date date,
  loyalty_bonus_installment_2_date date,
  loyalty_bonus_installment_3_date date,
  loyalty_bonus_installment_4_date date,
  loyalty_bonus_installment_5_date date,
  loyalty_bonus_installment_6_date date,
  loyalty_bonus_installment_1_disbursed boolean,
  loyalty_bonus_installment_2_disbursed boolean,
  loyalty_bonus_installment_3_disbursed boolean,
  loyalty_bonus_installment_4_disbursed boolean,
  loyalty_bonus_installment_5_disbursed boolean,
  loyalty_bonus_installment_6_disbursed boolean,
  -- Related data
  role_name text,
  role_description text,
  department_name text,
  department_description text,
  manager_full_name text,
  manager_email text,
  manager_position text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.auth_provider,
    u.provider_user_id,
    u.email,
    u.password_hash,
    u.full_name,
    u.employee_id,
    u.role_id,
    u.department_id,
    u."position",
    u.avatar_url,
    u.phone,
    u.address,
    u.date_of_birth,
    u.date_of_joining,
    u.salary,
    u.extra_permissions,
    u.status,
    u.last_login,
    u.created_at,
    u.updated_at,
    u.company_email,
    u.manager_id,
    u.tenure_mechlin,
    u.level_grade,
    u.skill,
    u.current_office_location,
    u.alternate_contact_no,
    u.blood_group,
    u.religion,
    u.gender,
    u.marital_status,
    u.date_of_marriage_anniversary,
    u.father_name,
    u.father_dob,
    u.mother_name,
    u.mother_dob,
    u.designation_offer_letter,
    u.permanent_address,
    u.aadhar_card_no,
    u.pan_no,
    u.personal_email,
    u.bank_account_no,
    u.ifsc_code,
    u.qualification,
    u.employment_terms,
    u."isSA",
    u.comp_off_balance,
    -- Onboarding fields
    u.appointment_formalities,
    u.orientation,
    u.order_id_card,
    u.email_account,
    u.skype_account,
    u.system_account,
    u.added_to_mailing_list,
    u.added_to_attendance_sheet,
    u.confluence_info_provided,
    u.id_card_provided,
    u.remarks,
    u.uan_number,
    u.is_experienced,
    -- NEW: Salary Annexure fields
    u.pf_applicable,
    u.esi_applicable,
    u.monthly_ctc,
    u.monthly_basic_pay,
    u.hra,
    u.night_allowance,
    u.special_allowance,
    u.monthly_gross,
    u.employer_pf,
    u.employer_esi,
    u.monthly_gratuity_provision,
    u.monthly_bonus_provision,
    u.group_medical_insurance,
    u.pf_employee,
    u.esi_employee,
    u.tds,
    u.professional_tax,
    u.total_deductions,
    u.net_pay,
    u.monthly_take_home_salary,
    -- NEW: Loyalty Bonus fields
    u.loyalty_bonus_enrollment_date,
    u.loyalty_bonus_specific_condition,
    u.loyalty_bonus_tenure_period,
    u.loyalty_bonus_amount,
    u.loyalty_bonus_installment_1_amount,
    u.loyalty_bonus_installment_2_amount,
    u.loyalty_bonus_installment_3_amount,
    u.loyalty_bonus_installment_4_amount,
    u.loyalty_bonus_installment_5_amount,
    u.loyalty_bonus_installment_6_amount,
    u.loyalty_bonus_installment_1_date,
    u.loyalty_bonus_installment_2_date,
    u.loyalty_bonus_installment_3_date,
    u.loyalty_bonus_installment_4_date,
    u.loyalty_bonus_installment_5_date,
    u.loyalty_bonus_installment_6_date,
    u.loyalty_bonus_installment_1_disbursed,
    u.loyalty_bonus_installment_2_disbursed,
    u.loyalty_bonus_installment_3_disbursed,
    u.loyalty_bonus_installment_4_disbursed,
    u.loyalty_bonus_installment_5_disbursed,
    u.loyalty_bonus_installment_6_disbursed,
    -- Related data
    r.name as role_name,
    r.description as role_description,
    d.name as department_name,
    d.description as department_description,
    m.full_name as manager_full_name,
    m.email as manager_email,
    m."position" as manager_position
  FROM users u
  LEFT JOIN roles r ON u.role_id = r.id
  LEFT JOIN departments d ON u.department_id = d.id
  LEFT JOIN users m ON u.manager_id = m.id
  WHERE u.status IN ('active', 'pending')
  ORDER BY u.full_name;
END;
$$;

-- Update get_all_users_with_manager_details function (similar structure)
CREATE OR REPLACE FUNCTION get_all_users_with_manager_details()
RETURNS TABLE (
  id uuid,
  auth_provider text,
  provider_user_id text,
  email text,
  password_hash text,
  full_name text,
  employee_id text,
  role_id uuid,
  department_id uuid,
  "position" text,
  avatar_url text,
  phone text,
  address text,
  date_of_birth date,
  date_of_joining date,
  salary numeric,
  extra_permissions jsonb,
  status text,
  last_login timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  company_email text,
  manager_id uuid,
  tenure_mechlin interval,
  level_grade text,
  skill text[],
  current_office_location text,
  alternate_contact_no text,
  blood_group text,
  religion text,
  gender text,
  marital_status text,
  date_of_marriage_anniversary date,
  father_name text,
  father_dob date,
  mother_name text,
  mother_dob date,
  designation_offer_letter text,
  permanent_address text,
  aadhar_card_no text,
  pan_no text,
  personal_email text,
  bank_account_no text,
  ifsc_code text,
  qualification text,
  employment_terms text,
  "isSA" boolean,
  comp_off_balance numeric,
  -- Onboarding fields
  appointment_formalities text,
  orientation text,
  order_id_card text,
  email_account text,
  skype_account text,
  system_account text,
  added_to_mailing_list text,
  added_to_attendance_sheet text,
  confluence_info_provided text,
  id_card_provided text,
  remarks text,
  uan_number text,
  is_experienced text,
  -- NEW: Salary Annexure fields
  pf_applicable boolean,
  esi_applicable boolean,
  monthly_ctc text,
  monthly_basic_pay text,
  hra text,
  night_allowance text,
  special_allowance text,
  monthly_gross text,
  employer_pf text,
  employer_esi text,
  monthly_gratuity_provision text,
  monthly_bonus_provision text,
  group_medical_insurance text,
  pf_employee text,
  esi_employee text,
  tds text,
  professional_tax text,
  total_deductions text,
  net_pay text,
  monthly_take_home_salary text,
  -- NEW: Loyalty Bonus fields
  loyalty_bonus_enrollment_date date,
  loyalty_bonus_specific_condition text,
  loyalty_bonus_tenure_period text,
  loyalty_bonus_amount text,
  loyalty_bonus_installment_1_amount text,
  loyalty_bonus_installment_2_amount text,
  loyalty_bonus_installment_3_amount text,
  loyalty_bonus_installment_4_amount text,
  loyalty_bonus_installment_5_amount text,
  loyalty_bonus_installment_6_amount text,
  loyalty_bonus_installment_1_date date,
  loyalty_bonus_installment_2_date date,
  loyalty_bonus_installment_3_date date,
  loyalty_bonus_installment_4_date date,
  loyalty_bonus_installment_5_date date,
  loyalty_bonus_installment_6_date date,
  loyalty_bonus_installment_1_disbursed boolean,
  loyalty_bonus_installment_2_disbursed boolean,
  loyalty_bonus_installment_3_disbursed boolean,
  loyalty_bonus_installment_4_disbursed boolean,
  loyalty_bonus_installment_5_disbursed boolean,
  loyalty_bonus_installment_6_disbursed boolean,
  -- Related data
  role_name text,
  role_description text,
  department_name text,
  department_description text,
  manager_full_name text,
  manager_email text,
  manager_position text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.auth_provider,
    u.provider_user_id,
    u.email,
    u.password_hash,
    u.full_name,
    u.employee_id,
    u.role_id,
    u.department_id,
    u."position",
    u.avatar_url,
    u.phone,
    u.address,
    u.date_of_birth,
    u.date_of_joining,
    u.salary,
    u.extra_permissions,
    u.status,
    u.last_login,
    u.created_at,
    u.updated_at,
    u.company_email,
    u.manager_id,
    u.tenure_mechlin,
    u.level_grade,
    u.skill,
    u.current_office_location,
    u.alternate_contact_no,
    u.blood_group,
    u.religion,
    u.gender,
    u.marital_status,
    u.date_of_marriage_anniversary,
    u.father_name,
    u.father_dob,
    u.mother_name,
    u.mother_dob,
    u.designation_offer_letter,
    u.permanent_address,
    u.aadhar_card_no,
    u.pan_no,
    u.personal_email,
    u.bank_account_no,
    u.ifsc_code,
    u.qualification,
    u.employment_terms,
    u."isSA",
    u.comp_off_balance,
    -- Onboarding fields
    u.appointment_formalities,
    u.orientation,
    u.order_id_card,
    u.email_account,
    u.skype_account,
    u.system_account,
    u.added_to_mailing_list,
    u.added_to_attendance_sheet,
    u.confluence_info_provided,
    u.id_card_provided,
    u.remarks,
    u.uan_number,
    u.is_experienced,
    -- NEW: Salary Annexure fields
    u.pf_applicable,
    u.esi_applicable,
    u.monthly_ctc,
    u.monthly_basic_pay,
    u.hra,
    u.night_allowance,
    u.special_allowance,
    u.monthly_gross,
    u.employer_pf,
    u.employer_esi,
    u.monthly_gratuity_provision,
    u.monthly_bonus_provision,
    u.group_medical_insurance,
    u.pf_employee,
    u.esi_employee,
    u.tds,
    u.professional_tax,
    u.total_deductions,
    u.net_pay,
    u.monthly_take_home_salary,
    -- NEW: Loyalty Bonus fields
    u.loyalty_bonus_enrollment_date,
    u.loyalty_bonus_specific_condition,
    u.loyalty_bonus_tenure_period,
    u.loyalty_bonus_amount,
    u.loyalty_bonus_installment_1_amount,
    u.loyalty_bonus_installment_2_amount,
    u.loyalty_bonus_installment_3_amount,
    u.loyalty_bonus_installment_4_amount,
    u.loyalty_bonus_installment_5_amount,
    u.loyalty_bonus_installment_6_amount,
    u.loyalty_bonus_installment_1_date,
    u.loyalty_bonus_installment_2_date,
    u.loyalty_bonus_installment_3_date,
    u.loyalty_bonus_installment_4_date,
    u.loyalty_bonus_installment_5_date,
    u.loyalty_bonus_installment_6_date,
    u.loyalty_bonus_installment_1_disbursed,
    u.loyalty_bonus_installment_2_disbursed,
    u.loyalty_bonus_installment_3_disbursed,
    u.loyalty_bonus_installment_4_disbursed,
    u.loyalty_bonus_installment_5_disbursed,
    u.loyalty_bonus_installment_6_disbursed,
    -- Related data
    r.name as role_name,
    r.description as role_description,
    d.name as department_name,
    d.description as department_description,
    m.full_name as manager_full_name,
    m.email as manager_email,
    m."position" as manager_position
  FROM users u
  LEFT JOIN roles r ON u.role_id = r.id
  LEFT JOIN departments d ON u.department_id = d.id
  LEFT JOIN users m ON u.manager_id = m.id
  ORDER BY u.full_name;
END;
$$;

-- ========================================
-- 6. GRANT PERMISSIONS
-- ========================================

-- Grant execute permissions on the functions
GRANT EXECUTE ON FUNCTION get_employees_with_manager_details() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_users_with_manager_details() TO authenticated;

-- ========================================
-- 7. MIGRATION COMPLETION MESSAGE
-- ========================================

-- Add a comment to track migration completion
COMMENT ON TABLE users IS 'Users table updated with salary annexure and loyalty bonus fields - Migration completed 2025-01-01';
