/*
  # Fix Missing Score Columns in KRA Assignments
  
  The frontend is trying to use score columns that don't exist in the database.
  This migration ensures all required columns exist with correct names.
  
  Issues Fixed:
  - Frontend was using q1_score instead of q1_total_score
  - Missing q1_total_possible_score columns
  - Similar issues for all quarters (Q1-Q4)
*/

-- Ensure all required score columns exist
DO $$
BEGIN
    -- Q1 score columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q1_total_score') THEN
        ALTER TABLE kra_assignments ADD COLUMN q1_total_score numeric(12,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q1_total_possible_score') THEN
        ALTER TABLE kra_assignments ADD COLUMN q1_total_possible_score numeric(12,2) DEFAULT 0;
    END IF;
    
    -- Q2 score columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q2_total_score') THEN
        ALTER TABLE kra_assignments ADD COLUMN q2_total_score numeric(12,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q2_total_possible_score') THEN
        ALTER TABLE kra_assignments ADD COLUMN q2_total_possible_score numeric(12,2) DEFAULT 0;
    END IF;
    
    -- Q3 score columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q3_total_score') THEN
        ALTER TABLE kra_assignments ADD COLUMN q3_total_score numeric(12,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q3_total_possible_score') THEN
        ALTER TABLE kra_assignments ADD COLUMN q3_total_possible_score numeric(12,2) DEFAULT 0;
    END IF;
    
    -- Q4 score columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q4_total_score') THEN
        ALTER TABLE kra_assignments ADD COLUMN q4_total_score numeric(12,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q4_total_possible_score') THEN
        ALTER TABLE kra_assignments ADD COLUMN q4_total_possible_score numeric(12,2) DEFAULT 0;
    END IF;
END $$;

-- Add constraints for score columns
DO $$
BEGIN
    -- Q1 score constraints
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_q1_total_score_positive') THEN
        ALTER TABLE kra_assignments ADD CONSTRAINT chk_q1_total_score_positive 
        CHECK (q1_total_score >= 0);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_q1_total_possible_score_positive') THEN
        ALTER TABLE kra_assignments ADD CONSTRAINT chk_q1_total_possible_score_positive 
        CHECK (q1_total_possible_score >= 0);
    END IF;
    
    -- Q2 score constraints
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_q2_total_score_positive') THEN
        ALTER TABLE kra_assignments ADD CONSTRAINT chk_q2_total_score_positive 
        CHECK (q2_total_score >= 0);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_q2_total_possible_score_positive') THEN
        ALTER TABLE kra_assignments ADD CONSTRAINT chk_q2_total_possible_score_positive 
        CHECK (q2_total_possible_score >= 0);
    END IF;
    
    -- Q3 score constraints
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_q3_total_score_positive') THEN
        ALTER TABLE kra_assignments ADD CONSTRAINT chk_q3_total_score_positive 
        CHECK (q3_total_score >= 0);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_q3_total_possible_score_positive') THEN
        ALTER TABLE kra_assignments ADD CONSTRAINT chk_q3_total_possible_score_positive 
        CHECK (q3_total_possible_score >= 0);
    END IF;
    
    -- Q4 score constraints
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_q4_total_score_positive') THEN
        ALTER TABLE kra_assignments ADD CONSTRAINT chk_q4_total_score_positive 
        CHECK (q4_total_score >= 0);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_q4_total_possible_score_positive') THEN
        ALTER TABLE kra_assignments ADD CONSTRAINT chk_q4_total_possible_score_positive 
        CHECK (q4_total_possible_score >= 0);
    END IF;
END $$;

-- Update the validation function to handle score columns
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
    
    -- Ensure score values are non-negative
    IF NEW.q1_total_score < 0 THEN
        NEW.q1_total_score := 0;
    END IF;
    
    IF NEW.q1_total_possible_score < 0 THEN
        NEW.q1_total_possible_score := 0;
    END IF;
    
    IF NEW.q2_total_score < 0 THEN
        NEW.q2_total_score := 0;
    END IF;
    
    IF NEW.q2_total_possible_score < 0 THEN
        NEW.q2_total_possible_score := 0;
    END IF;
    
    IF NEW.q3_total_score < 0 THEN
        NEW.q3_total_score := 0;
    END IF;
    
    IF NEW.q3_total_possible_score < 0 THEN
        NEW.q3_total_possible_score := 0;
    END IF;
    
    IF NEW.q4_total_score < 0 THEN
        NEW.q4_total_score := 0;
    END IF;
    
    IF NEW.q4_total_possible_score < 0 THEN
        NEW.q4_total_possible_score := 0;
    END IF;
    
    -- Ensure updated_at is set
    NEW.updated_at := NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add helpful comments
COMMENT ON COLUMN kra_assignments.q1_total_score IS 'Total score achieved in Quarter 1';
COMMENT ON COLUMN kra_assignments.q1_total_possible_score IS 'Total possible score in Quarter 1';
COMMENT ON COLUMN kra_assignments.q2_total_score IS 'Total score achieved in Quarter 2';
COMMENT ON COLUMN kra_assignments.q2_total_possible_score IS 'Total possible score in Quarter 2';
COMMENT ON COLUMN kra_assignments.q3_total_score IS 'Total score achieved in Quarter 3';
COMMENT ON COLUMN kra_assignments.q3_total_possible_score IS 'Total possible score in Quarter 3';
COMMENT ON COLUMN kra_assignments.q4_total_score IS 'Total score achieved in Quarter 4';
COMMENT ON COLUMN kra_assignments.q4_total_possible_score IS 'Total possible score in Quarter 4';

-- Log completion
SELECT 'Missing score columns fixed! 🎯' as status,
       'Added q1_total_score, q1_total_possible_score and similar for Q2-Q4' as details;
