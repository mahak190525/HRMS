/*
  # Create SQL Function for Leave Applications with Manager Details
  
  This function properly fetches leave applications with complete manager information
  to resolve the "Manager (details not loaded)" issue.
*/

-- Create function to get leave applications with manager details
CREATE OR REPLACE FUNCTION get_leave_applications_with_manager_details()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  leave_type_id uuid,
  start_date date,
  end_date date,
  days_count integer,
  reason text,
  status text,
  applied_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  comments text,
  created_at timestamptz,
  updated_at timestamptz,
  
  -- User details
  user_full_name text,
  user_employee_id text,
  user_email text,
  user_manager_id uuid,
  
  -- Manager details
  manager_id uuid,
  manager_full_name text,
  manager_email text,
  
  -- Leave type details
  leave_type_name text,
  leave_type_description text,
  
  -- Approved by details
  approved_by_full_name text,
  approved_by_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    la.id,
    la.user_id,
    la.leave_type_id,
    la.start_date,
    la.end_date,
    la.days_count,
    la.reason,
    la.status,
    la.applied_at,
    la.approved_by,
    la.approved_at,
    la.comments,
    la.created_at,
    la.updated_at,
    
    -- User details
    u.full_name as user_full_name,
    u.employee_id as user_employee_id,
    u.email as user_email,
    u.manager_id as user_manager_id,
    
    -- Manager details
    m.id as manager_id,
    m.full_name as manager_full_name,
    m.email as manager_email,
    
    -- Leave type details
    lt.name as leave_type_name,
    lt.description as leave_type_description,
    
    -- Approved by details
    ab.full_name as approved_by_full_name,
    ab.email as approved_by_email
    
  FROM leave_applications la
  LEFT JOIN users u ON la.user_id = u.id
  LEFT JOIN users m ON u.manager_id = m.id
  LEFT JOIN leave_types lt ON la.leave_type_id = lt.id
  LEFT JOIN users ab ON la.approved_by = ab.id
  ORDER BY la.created_at DESC;
END;
$$;

-- Create function for specific user's leave applications (for managers viewing their reports)
CREATE OR REPLACE FUNCTION get_leave_applications_for_manager(manager_user_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  leave_type_id uuid,
  start_date date,
  end_date date,
  days_count integer,
  reason text,
  status text,
  applied_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  comments text,
  created_at timestamptz,
  updated_at timestamptz,
  
  -- User details
  user_full_name text,
  user_employee_id text,
  user_email text,
  user_manager_id uuid,
  
  -- Manager details
  manager_id uuid,
  manager_full_name text,
  manager_email text,
  
  -- Leave type details
  leave_type_name text,
  leave_type_description text,
  
  -- Approved by details
  approved_by_full_name text,
  approved_by_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    la.id,
    la.user_id,
    la.leave_type_id,
    la.start_date,
    la.end_date,
    la.days_count,
    la.reason,
    la.status,
    la.applied_at,
    la.approved_by,
    la.approved_at,
    la.comments,
    la.created_at,
    la.updated_at,
    
    -- User details
    u.full_name as user_full_name,
    u.employee_id as user_employee_id,
    u.email as user_email,
    u.manager_id as user_manager_id,
    
    -- Manager details
    m.id as manager_id,
    m.full_name as manager_full_name,
    m.email as manager_email,
    
    -- Leave type details
    lt.name as leave_type_name,
    lt.description as leave_type_description,
    
    -- Approved by details
    ab.full_name as approved_by_full_name,
    ab.email as approved_by_email
    
  FROM leave_applications la
  LEFT JOIN users u ON la.user_id = u.id
  LEFT JOIN users m ON u.manager_id = m.id
  LEFT JOIN leave_types lt ON la.leave_type_id = lt.id
  LEFT JOIN users ab ON la.approved_by = ab.id
  WHERE u.manager_id = manager_user_id
  ORDER BY la.created_at DESC;
END;
$$;

-- Create function to get employees with manager details
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
  
  -- Role details
  role_name text,
  role_description text,
  
  -- Department details
  department_name text,
  department_description text,
  
  -- Manager details
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

-- Create function to get all users with manager details (including inactive)
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
  
  -- Role details
  role_name text,
  role_description text,
  
  -- Department details
  department_name text,
  department_description text,
  
  -- Manager details
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

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_leave_applications_with_manager_details() TO authenticated;
GRANT EXECUTE ON FUNCTION get_leave_applications_for_manager(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_employees_with_manager_details() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_users_with_manager_details() TO authenticated;
