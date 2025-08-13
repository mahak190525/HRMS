/*
  # Add company_email column to users table

  1. Schema Changes
    - Add `company_email` column to `users` table
      - `company_email` (text, nullable)
      - Will store Microsoft email when user gets hired
      - Allows null for users who don't have company email yet

  2. Notes
    - Column is nullable to accommodate existing users
    - Will be populated when employee gets hired and assigned company email
    - Supports Microsoft email integration workflow
*/

-- Add company_email column to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'company_email'
  ) THEN
    ALTER TABLE users ADD COLUMN company_email text;
  END IF;
END $$;

-- Add comment to document the column purpose
COMMENT ON COLUMN users.company_email IS 'Microsoft company email assigned when user gets hired';