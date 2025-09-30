/*
  # Update User Functions to Include isSA Field

  Updates database functions that return user data to include the isSA field.
  This ensures the frontend receives the isSA information for proper permissions.
*/

-- Drop existing functions first to allow changing return types
DROP FUNCTION IF EXISTS get_employees_with_manager_details();
DROP FUNCTION IF EXISTS get_all_users_with_manager_details();

-- Update get_employees_with_manager_details function
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
    
    -- Role details
    r.name as role_name,
    r.description as role_description,
    
    -- Department details
    d.name as department_name,
    d.description as department_description,
    
    -- Manager details
    m.full_name as manager_full_name,
    m.email as manager_email,
    m."position" as manager_position
    
  FROM users u
  LEFT JOIN roles r ON u.role_id = r.id
  LEFT JOIN departments d ON u.department_id = d.id
  LEFT JOIN users m ON u.manager_id = m.id
  WHERE u.status != 'inactive'
  ORDER BY u.full_name;
END;
$$;

-- Update get_all_users_with_manager_details function
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
    
    -- Role details
    r.name as role_name,
    r.description as role_description,
    
    -- Department details
    d.name as department_name,
    d.description as department_description,
    
    -- Manager details
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
