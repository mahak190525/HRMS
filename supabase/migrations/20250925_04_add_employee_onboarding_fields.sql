-- Migration: Add Employee Onboarding and Experience Fields
-- Description: Adds new fields for employee onboarding process and experience tracking
-- Date: 2024-09-25

-- Add new fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS appointment_formalities TEXT CHECK (appointment_formalities IN ('Done', 'Not Done')) DEFAULT 'Not Done';
ALTER TABLE users ADD COLUMN IF NOT EXISTS orientation TEXT CHECK (orientation IN ('Done', 'Not Done')) DEFAULT 'Not Done';
ALTER TABLE users ADD COLUMN IF NOT EXISTS order_id_card TEXT CHECK (order_id_card IN ('Yes', 'No')) DEFAULT 'No';

-- Accounts Created Group
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_account TEXT CHECK (email_account IN ('Yes', 'No', 'N/A')) DEFAULT 'N/A';
ALTER TABLE users ADD COLUMN IF NOT EXISTS skype_account TEXT CHECK (skype_account IN ('Yes', 'No', 'N/A')) DEFAULT 'N/A';
ALTER TABLE users ADD COLUMN IF NOT EXISTS system_account TEXT CHECK (system_account IN ('Yes', 'No', 'N/A')) DEFAULT 'N/A';

-- Access & Tools Group
ALTER TABLE users ADD COLUMN IF NOT EXISTS added_to_mailing_list TEXT CHECK (added_to_mailing_list IN ('Yes', 'No')) DEFAULT 'No';
ALTER TABLE users ADD COLUMN IF NOT EXISTS added_to_attendance_sheet TEXT CHECK (added_to_attendance_sheet IN ('Yes', 'No')) DEFAULT 'No';
ALTER TABLE users ADD COLUMN IF NOT EXISTS confluence_info_provided TEXT CHECK (confluence_info_provided IN ('Yes', 'No')) DEFAULT 'No';
ALTER TABLE users ADD COLUMN IF NOT EXISTS id_card_provided TEXT CHECK (id_card_provided IN ('Yes', 'No', 'N/A')) DEFAULT 'N/A';

-- Additional Fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS uan_number TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_experienced TEXT CHECK (is_experienced IN ('Yes', 'No')) DEFAULT 'No';

-- Update employment terms to include Contract and Internship
-- First, let's check if there's an existing constraint on employment_terms
DO $$
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE constraint_name LIKE '%employment_terms%' 
        AND table_name = 'users'
    ) THEN
        ALTER TABLE users DROP CONSTRAINT IF EXISTS users_employment_terms_check;
    END IF;
    
    -- Add new constraint with additional options
    ALTER TABLE users ADD CONSTRAINT users_employment_terms_check 
        CHECK (employment_terms IN ('full_time', 'part_time', 'associate', 'contract', 'probation/internship'));
END $$;

-- Add indexes for performance on frequently queried fields
CREATE INDEX IF NOT EXISTS idx_users_is_experienced ON users(is_experienced) WHERE is_experienced = 'Yes';
CREATE INDEX IF NOT EXISTS idx_users_employment_terms ON users(employment_terms);

-- Add comments to document the new fields
COMMENT ON COLUMN users.appointment_formalities IS 'Tracks if appointment formalities are completed';
COMMENT ON COLUMN users.orientation IS 'Tracks if employee orientation is completed';
COMMENT ON COLUMN users.order_id_card IS 'Tracks if ID card has been ordered';
COMMENT ON COLUMN users.email_account IS 'Tracks email account creation status';
COMMENT ON COLUMN users.skype_account IS 'Tracks Skype account creation status';
COMMENT ON COLUMN users.system_account IS 'Tracks system account creation status';
COMMENT ON COLUMN users.added_to_mailing_list IS 'Tracks if employee is added to mailing list';
COMMENT ON COLUMN users.added_to_attendance_sheet IS 'Tracks if employee is added to attendance sheet';
COMMENT ON COLUMN users.confluence_info_provided IS 'Tracks if Confluence information is provided';
COMMENT ON COLUMN users.id_card_provided IS 'Tracks if ID card is provided to employee';
COMMENT ON COLUMN users.remarks IS 'Additional comments or notes about the employee';
COMMENT ON COLUMN users.uan_number IS 'Employee UAN (Universal Account Number)';
COMMENT ON COLUMN users.is_experienced IS 'Indicates if employee has previous work experience';
