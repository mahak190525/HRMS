/*
  # Add User Profile Fields Migration
  
  This migration adds additional user profile fields to the users table.
  Fields are organized by editability permissions:
  
  - HR Editable: Most fields can only be edited by HR
  - Employee/HR Editable: Some fields can be edited by both employee and HR
  - Employee Editable: Limited fields editable by employee only
  
  Note: Some fields already exist in the base users table:
  - employee_id (Emp ID)
  - full_name (Name)
  - date_of_joining (DOJ)
  - date_of_birth (DOB)
  - department_id (Department)
  - position (Job Title)
  - phone (Contact No.)
  - address (Current Address)
  - email (Official Mail Id)
  - avatar_url (Image)
*/

-- Add new fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenure_mechlin interval; -- Calculated field for tenure
ALTER TABLE users ADD COLUMN IF NOT EXISTS level_grade text; -- Levels/Grade → Editable by HR
ALTER TABLE users ADD COLUMN IF NOT EXISTS skill text[]; -- Skill → Editable by HR (array for multiple skills)
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_office_location text; -- Current Office Location → Editable by HR
ALTER TABLE users ADD COLUMN IF NOT EXISTS alternate_contact_no text; -- Alternate Contact No. → Editable by employee/HR
ALTER TABLE users ADD COLUMN IF NOT EXISTS blood_group text; -- Blood Group → Editable by HR
ALTER TABLE users ADD COLUMN IF NOT EXISTS religion text; -- Religion → Editable by HR
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')); -- Gender → Editable by HR
ALTER TABLE users ADD COLUMN IF NOT EXISTS marital_status text CHECK (marital_status IN ('single', 'married', 'divorced', 'widowed')); -- Status (Married/Single) → Editable by HR
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_marriage_anniversary date; -- Date of Marriage Anniversary → Editable by HR
ALTER TABLE users ADD COLUMN IF NOT EXISTS father_name text; -- Father's Name → Editable by HR
ALTER TABLE users ADD COLUMN IF NOT EXISTS father_dob date; -- Father's DOB → Editable by HR
ALTER TABLE users ADD COLUMN IF NOT EXISTS mother_name text; -- Mother's Name → Editable by HR
ALTER TABLE users ADD COLUMN IF NOT EXISTS mother_dob date; -- Mother's DOB → Editable by HR
ALTER TABLE users ADD COLUMN IF NOT EXISTS designation_offer_letter text; -- Designation (As per Offer Letter) → Editable by HR
ALTER TABLE users ADD COLUMN IF NOT EXISTS permanent_address text; -- Permanent Address → Editable by employee/HR
ALTER TABLE users ADD COLUMN IF NOT EXISTS aadhar_card_no text; -- Aadhar Card No. → Editable by HR
ALTER TABLE users ADD COLUMN IF NOT EXISTS pan_no text; -- PAN No → Editable by HR
ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_email text; -- Personal E-mail Id → Editable by HR
ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_account_no text; -- Bank A/c → Editable by HR
ALTER TABLE users ADD COLUMN IF NOT EXISTS ifsc_code text; -- IFSC code → Editable by HR
ALTER TABLE users ADD COLUMN IF NOT EXISTS qualification text; -- Qualification → Editable by employee/HR
ALTER TABLE users ADD COLUMN IF NOT EXISTS employment_terms text DEFAULT 'full_time' CHECK (employment_terms IN ('part_time', 'full_time')); -- Employment Terms → Part-time/Full Time

-- Add indexes for commonly queried fields
CREATE INDEX IF NOT EXISTS idx_users_level_grade ON users(level_grade);
CREATE INDEX IF NOT EXISTS idx_users_current_office_location ON users(current_office_location);
CREATE INDEX IF NOT EXISTS idx_users_employment_terms ON users(employment_terms);

-- Add function to calculate tenure
CREATE OR REPLACE FUNCTION calculate_tenure_mechlin(join_date date)
RETURNS interval AS $$
BEGIN
  RETURN CASE 
    WHEN join_date IS NULL THEN NULL
    ELSE CURRENT_DATE - join_date
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add trigger to auto-update tenure when date_of_joining changes
CREATE OR REPLACE FUNCTION update_tenure_trigger()
RETURNS trigger AS $$
BEGIN
  NEW.tenure_mechlin = calculate_tenure_mechlin(NEW.date_of_joining);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tenure
  BEFORE INSERT OR UPDATE OF date_of_joining ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_tenure_trigger();

-- Update existing records to calculate tenure
UPDATE users 
SET tenure_mechlin = calculate_tenure_mechlin(date_of_joining)
WHERE date_of_joining IS NOT NULL;

-- Add comments for field editability reference
COMMENT ON COLUMN users.level_grade IS 'Editable by HR only';
COMMENT ON COLUMN users.skill IS 'Editable by HR only';
COMMENT ON COLUMN users.current_office_location IS 'Editable by HR only';
COMMENT ON COLUMN users.alternate_contact_no IS 'Editable by employee and HR';
COMMENT ON COLUMN users.blood_group IS 'Editable by HR only';
COMMENT ON COLUMN users.religion IS 'Editable by HR only';
COMMENT ON COLUMN users.gender IS 'Editable by HR only';
COMMENT ON COLUMN users.marital_status IS 'Editable by HR only';
COMMENT ON COLUMN users.date_of_marriage_anniversary IS 'Editable by HR only';
COMMENT ON COLUMN users.father_name IS 'Editable by HR only';
COMMENT ON COLUMN users.father_dob IS 'Editable by HR only';
COMMENT ON COLUMN users.mother_name IS 'Editable by HR only';
COMMENT ON COLUMN users.mother_dob IS 'Editable by HR only';
COMMENT ON COLUMN users.designation_offer_letter IS 'Editable by HR only';
COMMENT ON COLUMN users.permanent_address IS 'Editable by employee and HR';
COMMENT ON COLUMN users.aadhar_card_no IS 'Editable by HR only';
COMMENT ON COLUMN users.pan_no IS 'Editable by HR only';
COMMENT ON COLUMN users.personal_email IS 'Editable by HR only';
COMMENT ON COLUMN users.bank_account_no IS 'Editable by HR only';
COMMENT ON COLUMN users.ifsc_code IS 'Editable by HR only';
COMMENT ON COLUMN users.qualification IS 'Editable by employee and HR';
COMMENT ON COLUMN users.employment_terms IS 'Editable by HR only';
COMMENT ON COLUMN users.tenure_mechlin IS 'Auto-calculated field based on date_of_joining';

-- Add RLS policies for new fields using public schema only
-- These policies extend the existing user policies to control field-level access

-- Create a function to get current user from public.users table
-- This will be set by your application when making database calls
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

-- Policy for user profile updates
CREATE POLICY "User profile update policy"
  ON users FOR UPDATE
  TO public
  USING (
    -- Allow HR and admins to update all fields
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = get_current_user_id() 
      AND u.role_id IN (
        SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'hr', 'finance')
      )
    )
    OR
    -- Allow users to update their own profile (field-level restrictions handled in application)
    id = get_current_user_id()
  );
