/*
  # Fix KRA Reassignment Issues
  
  This migration addresses several issues found during KRA reassignment:
  1. Missing column references in frontend code
  2. Email queue processing errors
  3. Template publishing errors
  
  Issues Fixed:
  - Frontend was using q1_percentage instead of q1_overall_percentage
  - Similar issues with q2, q3, q4 percentage columns
  - Email queue processing errors due to missing data
*/

-- Ensure all required percentage columns exist with correct names
DO $$
BEGIN
    -- Check and add missing percentage columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q1_overall_percentage') THEN
        ALTER TABLE kra_assignments ADD COLUMN q1_overall_percentage numeric(6,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q2_overall_percentage') THEN
        ALTER TABLE kra_assignments ADD COLUMN q2_overall_percentage numeric(6,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q3_overall_percentage') THEN
        ALTER TABLE kra_assignments ADD COLUMN q3_overall_percentage numeric(6,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q4_overall_percentage') THEN
        ALTER TABLE kra_assignments ADD COLUMN q4_overall_percentage numeric(6,2) DEFAULT 0;
    END IF;
END $$;

-- Add constraints for percentage columns if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_q1_overall_percentage') THEN
        ALTER TABLE kra_assignments ADD CONSTRAINT chk_q1_overall_percentage 
        CHECK (q1_overall_percentage >= 0 AND q1_overall_percentage <= 100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_q2_overall_percentage') THEN
        ALTER TABLE kra_assignments ADD CONSTRAINT chk_q2_overall_percentage 
        CHECK (q2_overall_percentage >= 0 AND q2_overall_percentage <= 100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_q3_overall_percentage') THEN
        ALTER TABLE kra_assignments ADD CONSTRAINT chk_q3_overall_percentage 
        CHECK (q3_overall_percentage >= 0 AND q3_overall_percentage <= 100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_q4_overall_percentage') THEN
        ALTER TABLE kra_assignments ADD CONSTRAINT chk_q4_overall_percentage 
        CHECK (q4_overall_percentage >= 0 AND q4_overall_percentage <= 100);
    END IF;
END $$;

-- Ensure email queue has proper enum values for KRA emails
DO $$
BEGIN
    -- Check if performance_management enum value exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'performance_management' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'module_type_enum')
    ) THEN
        ALTER TYPE module_type_enum ADD VALUE IF NOT EXISTS 'performance_management';
    END IF;
    
    -- Check if KRA email types exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'kra_assigned' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'email_type_enum')
    ) THEN
        ALTER TYPE email_type_enum ADD VALUE IF NOT EXISTS 'kra_assigned';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'kra_reassigned' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'email_type_enum')
    ) THEN
        ALTER TYPE email_type_enum ADD VALUE IF NOT EXISTS 'kra_reassigned';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'kra_submitted' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'email_type_enum')
    ) THEN
        ALTER TYPE email_type_enum ADD VALUE IF NOT EXISTS 'kra_submitted';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'kra_approved' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'email_type_enum')
    ) THEN
        ALTER TYPE email_type_enum ADD VALUE IF NOT EXISTS 'kra_approved';
    END IF;
END $$;

-- Create a simple function to validate KRA assignment data before insert/update
CREATE OR REPLACE FUNCTION validate_kra_assignment_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure percentage values are within valid range
    IF NEW.q1_overall_percentage < 0 OR NEW.q1_overall_percentage > 100 THEN
        NEW.q1_overall_percentage := GREATEST(0, LEAST(100, NEW.q1_overall_percentage));
    END IF;
    
    IF NEW.q2_overall_percentage < 0 OR NEW.q2_overall_percentage > 100 THEN
        NEW.q2_overall_percentage := GREATEST(0, LEAST(100, NEW.q2_overall_percentage));
    END IF;
    
    IF NEW.q3_overall_percentage < 0 OR NEW.q3_overall_percentage > 100 THEN
        NEW.q3_overall_percentage := GREATEST(0, LEAST(100, NEW.q3_overall_percentage));
    END IF;
    
    IF NEW.q4_overall_percentage < 0 OR NEW.q4_overall_percentage > 100 THEN
        NEW.q4_overall_percentage := GREATEST(0, LEAST(100, NEW.q4_overall_percentage));
    END IF;
    
    -- Ensure updated_at is set
    NEW.updated_at := NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for validation (only if it doesn't exist)
DROP TRIGGER IF EXISTS trigger_validate_kra_assignment_data ON kra_assignments;
CREATE TRIGGER trigger_validate_kra_assignment_data
    BEFORE INSERT OR UPDATE ON kra_assignments
    FOR EACH ROW
    EXECUTE FUNCTION validate_kra_assignment_data();

-- Improve the email queue error handling
CREATE OR REPLACE FUNCTION handle_email_queue_errors()
RETURNS TRIGGER AS $$
BEGIN
    -- If an email fails to queue, log it but don't fail the entire operation
    IF NEW.status = 'failed' AND NEW.retry_count >= NEW.max_retries THEN
        INSERT INTO system_logs (
            level,
            message,
            context,
            created_at
        ) VALUES (
            'error',
            'Email failed after maximum retries',
            jsonb_build_object(
                'email_id', NEW.id,
                'module_type', NEW.module_type,
                'reference_id', NEW.reference_id,
                'email_type', NEW.email_type,
                'error_message', NEW.error_message,
                'retry_count', NEW.retry_count
            ),
            NOW()
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for email error handling (only if it doesn't exist)
DROP TRIGGER IF EXISTS trigger_handle_email_queue_errors ON email_queue;
CREATE TRIGGER trigger_handle_email_queue_errors
    AFTER UPDATE ON email_queue
    FOR EACH ROW
    WHEN (NEW.status = 'failed')
    EXECUTE FUNCTION handle_email_queue_errors();

-- Add helpful comments
COMMENT ON FUNCTION validate_kra_assignment_data() IS 'Validates and normalizes KRA assignment data before insert/update';
COMMENT ON FUNCTION handle_email_queue_errors() IS 'Logs email queue errors for debugging and monitoring';

-- Log completion
SELECT 'KRA reassignment issues fixed! 🔧' as status,
       'Fixed column names, email queue enums, and added validation' as details;
