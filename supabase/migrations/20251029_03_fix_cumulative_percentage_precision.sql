-- Fix cumulative percentage field precision to prevent numeric overflow
-- The cumulative percentage fields need higher precision to handle edge cases

-- First, ensure all cumulative columns exist (in case previous migration wasn't run)
DO $$ 
BEGIN
    -- Add cumulative score columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q1_cumulative_score') THEN
        ALTER TABLE kra_assignments ADD COLUMN q1_cumulative_score numeric(12,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q1_cumulative_possible_score') THEN
        ALTER TABLE kra_assignments ADD COLUMN q1_cumulative_possible_score numeric(12,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q1_cumulative_percentage') THEN
        ALTER TABLE kra_assignments ADD COLUMN q1_cumulative_percentage numeric(6,2) DEFAULT 0;
    END IF;
    
    -- Q2 cumulative columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q2_cumulative_score') THEN
        ALTER TABLE kra_assignments ADD COLUMN q2_cumulative_score numeric(12,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q2_cumulative_possible_score') THEN
        ALTER TABLE kra_assignments ADD COLUMN q2_cumulative_possible_score numeric(12,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q2_cumulative_percentage') THEN
        ALTER TABLE kra_assignments ADD COLUMN q2_cumulative_percentage numeric(6,2) DEFAULT 0;
    END IF;
    
    -- Q3 cumulative columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q3_cumulative_score') THEN
        ALTER TABLE kra_assignments ADD COLUMN q3_cumulative_score numeric(12,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q3_cumulative_possible_score') THEN
        ALTER TABLE kra_assignments ADD COLUMN q3_cumulative_possible_score numeric(12,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q3_cumulative_percentage') THEN
        ALTER TABLE kra_assignments ADD COLUMN q3_cumulative_percentage numeric(6,2) DEFAULT 0;
    END IF;
    
    -- Q4 cumulative columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q4_cumulative_score') THEN
        ALTER TABLE kra_assignments ADD COLUMN q4_cumulative_score numeric(12,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q4_cumulative_possible_score') THEN
        ALTER TABLE kra_assignments ADD COLUMN q4_cumulative_possible_score numeric(12,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q4_cumulative_percentage') THEN
        ALTER TABLE kra_assignments ADD COLUMN q4_cumulative_percentage numeric(6,2) DEFAULT 0;
    END IF;
END $$;

-- Update percentage columns to use proper precision
DO $$ 
BEGIN
    -- Update existing percentage columns to use numeric(6,2) for values up to 9999.99%
    -- This handles edge cases where calculations might exceed 100%
    
    -- Update quarterly percentage columns
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q1_overall_percentage') THEN
        ALTER TABLE kra_assignments ALTER COLUMN q1_overall_percentage TYPE numeric(6,2);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q2_overall_percentage') THEN
        ALTER TABLE kra_assignments ALTER COLUMN q2_overall_percentage TYPE numeric(6,2);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q3_overall_percentage') THEN
        ALTER TABLE kra_assignments ALTER COLUMN q3_overall_percentage TYPE numeric(6,2);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q4_overall_percentage') THEN
        ALTER TABLE kra_assignments ALTER COLUMN q4_overall_percentage TYPE numeric(6,2);
    END IF;
    
    -- Update cumulative percentage columns
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q1_cumulative_percentage') THEN
        ALTER TABLE kra_assignments ALTER COLUMN q1_cumulative_percentage TYPE numeric(6,2);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q2_cumulative_percentage') THEN
        ALTER TABLE kra_assignments ALTER COLUMN q2_cumulative_percentage TYPE numeric(6,2);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q3_cumulative_percentage') THEN
        ALTER TABLE kra_assignments ALTER COLUMN q3_cumulative_percentage TYPE numeric(6,2);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q4_cumulative_percentage') THEN
        ALTER TABLE kra_assignments ALTER COLUMN q4_cumulative_percentage TYPE numeric(6,2);
    END IF;
    
    -- Update main overall percentage column
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'overall_percentage') THEN
        ALTER TABLE kra_assignments ALTER COLUMN overall_percentage TYPE numeric(6,2);
    END IF;
END $$;

-- Add safe percentage calculation function for cumulative scores
CREATE OR REPLACE FUNCTION safe_cumulative_percentage_calculation(actual_score DECIMAL, max_score DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
  IF max_score IS NULL OR max_score = 0 THEN
    RETURN 0;
  END IF;
  
  -- Calculate percentage and cap at 100% to prevent overflow
  RETURN LEAST(100.0, (actual_score / max_score) * 100);
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers to recreate them
DROP TRIGGER IF EXISTS trigger_update_assignment_totals ON kra_evaluations;

-- Update the assignment totals calculation function with safe percentage calculations
CREATE OR REPLACE FUNCTION update_assignment_totals()
RETURNS TRIGGER AS $$
DECLARE
  assignment_id_to_update UUID;
  quarter_col text;
  status_col text;
  score_col text;
  possible_score_col text;
  percentage_col text;
  rating_col text;
  quarter_value text;
  
  -- Variables for cumulative calculations
  q1_score numeric := 0;
  q1_possible numeric := 0;
  q2_score numeric := 0;
  q2_possible numeric := 0;
  q3_score numeric := 0;
  q3_possible numeric := 0;
  q4_score numeric := 0;
  q4_possible numeric := 0;
  
  template_max_score numeric := 0;
BEGIN
  -- Get the assignment ID to update
  assignment_id_to_update := COALESCE(NEW.assignment_id, OLD.assignment_id);
  
  -- Get the quarter from the evaluation
  quarter_value := COALESCE(NEW.quarter, OLD.quarter, 'Q1');
  
  -- Determine column names based on quarter
  quarter_col := 'q' || SUBSTRING(quarter_value, 2, 1);
  status_col := quarter_col || '_status';
  score_col := quarter_col || '_total_score';
  possible_score_col := quarter_col || '_total_possible_score';
  percentage_col := quarter_col || '_overall_percentage';
  rating_col := quarter_col || '_overall_rating';
  
  -- Update quarterly totals for the specific quarter (individual quarter performance)
  EXECUTE format('
    UPDATE kra_assignments 
    SET 
      %I = (
        SELECT COALESCE(SUM(weighted_score), 0) 
        FROM kra_evaluations 
        WHERE assignment_id = $1 AND quarter = $2
      ),
      %I = (
        SELECT COALESCE(SUM((level_5_points * weight) / 100), 0)
        FROM kra_goals g
        JOIN kra_evaluations e ON g.id = e.goal_id
        WHERE e.assignment_id = $1 AND e.quarter = $2
      ),
      updated_at = now()
    WHERE id = $1',
    score_col, possible_score_col
  ) USING assignment_id_to_update, quarter_value;
  
  -- Update quarterly percentage and rating using safe calculation
  EXECUTE format('
    UPDATE kra_assignments 
    SET 
      %I = safe_cumulative_percentage_calculation(%I, %I),
      %I = CASE 
        WHEN %I = 0 THEN ''Not Evaluated''
        WHEN safe_cumulative_percentage_calculation(%I, %I) >= 90 THEN ''Far Exceeded Expectations''
        WHEN safe_cumulative_percentage_calculation(%I, %I) >= 75 THEN ''Exceeds Expectations''
        WHEN safe_cumulative_percentage_calculation(%I, %I) >= 60 THEN ''Meets Expectations''
        WHEN safe_cumulative_percentage_calculation(%I, %I) >= 40 THEN ''Below Expectations''
        ELSE ''Poor Performance''
      END
    WHERE id = $1',
    percentage_col, score_col, possible_score_col,
    rating_col, possible_score_col, score_col, possible_score_col,
    score_col, possible_score_col, score_col, possible_score_col, score_col, possible_score_col
  ) USING assignment_id_to_update;
  
  -- Get current quarterly scores for cumulative calculations
  SELECT 
    COALESCE(q1_total_score, 0),
    COALESCE(q1_total_possible_score, 0),
    COALESCE(q2_total_score, 0),
    COALESCE(q2_total_possible_score, 0),
    COALESCE(q3_total_score, 0),
    COALESCE(q3_total_possible_score, 0),
    COALESCE(q4_total_score, 0),
    COALESCE(q4_total_possible_score, 0)
  INTO 
    q1_score, q1_possible,
    q2_score, q2_possible,
    q3_score, q3_possible,
    q4_score, q4_possible
  FROM kra_assignments 
  WHERE id = assignment_id_to_update;
  
  -- Get template maximum possible score (for all quarters combined)
  SELECT COALESCE(SUM(level_5_points * weight / 100), 0) * 4
  INTO template_max_score
  FROM kra_goals g
  JOIN kra_templates t ON g.template_id = t.id
  JOIN kra_assignments a ON a.template_id = t.id
  WHERE a.id = assignment_id_to_update;
  
  -- Calculate cumulative scores (running totals) with safe percentage calculations
  UPDATE kra_assignments 
  SET 
    -- Q1 Cumulative (Q1 only)
    q1_cumulative_score = q1_score,
    q1_cumulative_possible_score = CASE WHEN q1_score > 0 THEN template_max_score / 4 ELSE 0 END,
    q1_cumulative_percentage = CASE 
      WHEN q1_score > 0 AND template_max_score > 0 THEN 
        safe_cumulative_percentage_calculation(q1_score, template_max_score / 4)
      ELSE 0 
    END,
    
    -- Q2 Cumulative (Q1 + Q2)
    q2_cumulative_score = q1_score + q2_score,
    q2_cumulative_possible_score = CASE WHEN (q1_score + q2_score) > 0 THEN template_max_score / 2 ELSE 0 END,
    q2_cumulative_percentage = CASE 
      WHEN (q1_score + q2_score) > 0 AND template_max_score > 0 THEN 
        safe_cumulative_percentage_calculation(q1_score + q2_score, template_max_score / 2)
      ELSE 0 
    END,
    
    -- Q3 Cumulative (Q1 + Q2 + Q3)
    q3_cumulative_score = q1_score + q2_score + q3_score,
    q3_cumulative_possible_score = CASE WHEN (q1_score + q2_score + q3_score) > 0 THEN (template_max_score * 3) / 4 ELSE 0 END,
    q3_cumulative_percentage = CASE 
      WHEN (q1_score + q2_score + q3_score) > 0 AND template_max_score > 0 THEN 
        safe_cumulative_percentage_calculation(q1_score + q2_score + q3_score, (template_max_score * 3) / 4)
      ELSE 0 
    END,
    
    -- Q4 Cumulative (Q1 + Q2 + Q3 + Q4) - Full Year
    q4_cumulative_score = q1_score + q2_score + q3_score + q4_score,
    q4_cumulative_possible_score = CASE WHEN (q1_score + q2_score + q3_score + q4_score) > 0 THEN template_max_score ELSE 0 END,
    q4_cumulative_percentage = CASE 
      WHEN (q1_score + q2_score + q3_score + q4_score) > 0 AND template_max_score > 0 THEN 
        safe_cumulative_percentage_calculation(q1_score + q2_score + q3_score + q4_score, template_max_score)
      ELSE 0 
    END,
    
    updated_at = now()
  WHERE id = assignment_id_to_update;
  
  -- Update completed quarters count
  UPDATE kra_assignments 
  SET 
    completed_quarters = (
      SELECT COUNT(DISTINCT quarter) 
      FROM kra_evaluations 
      WHERE assignment_id = assignment_id_to_update
      AND manager_evaluated_at IS NOT NULL
    )
  WHERE id = assignment_id_to_update;
  
  -- Update legacy total fields to reflect the most recent cumulative score with safe calculation
  UPDATE kra_assignments 
  SET 
    total_score = CASE 
      WHEN q4_cumulative_score > 0 THEN q4_cumulative_score
      WHEN q3_cumulative_score > 0 THEN q3_cumulative_score
      WHEN q2_cumulative_score > 0 THEN q2_cumulative_score
      WHEN q1_cumulative_score > 0 THEN q1_cumulative_score
      ELSE 0
    END,
    total_possible_score = CASE 
      WHEN q4_cumulative_score > 0 THEN q4_cumulative_possible_score
      WHEN q3_cumulative_score > 0 THEN q3_cumulative_possible_score
      WHEN q2_cumulative_score > 0 THEN q2_cumulative_possible_score
      WHEN q1_cumulative_score > 0 THEN q1_cumulative_possible_score
      ELSE 0
    END,
    overall_percentage = CASE 
      WHEN q4_cumulative_percentage > 0 THEN q4_cumulative_percentage
      WHEN q3_cumulative_percentage > 0 THEN q3_cumulative_percentage
      WHEN q2_cumulative_percentage > 0 THEN q2_cumulative_percentage
      WHEN q1_cumulative_percentage > 0 THEN q1_cumulative_percentage
      ELSE 0
    END,
    overall_rating = CASE 
      WHEN completed_quarters = 0 THEN 'Not Started'
      WHEN overall_percentage >= 90 THEN 'Far Exceeded Expectations'
      WHEN overall_percentage >= 75 THEN 'Exceeds Expectations'
      WHEN overall_percentage >= 60 THEN 'Meets Expectations'
      WHEN overall_percentage >= 40 THEN 'Below Expectations'
      ELSE 'Poor Performance'
    END
  WHERE id = assignment_id_to_update;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER trigger_update_assignment_totals
  AFTER INSERT OR UPDATE OR DELETE ON kra_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION update_assignment_totals();

-- Add constraints to ensure percentages don't exceed reasonable limits
-- Only add constraints for columns that actually exist
DO $$ 
BEGIN
    -- Quarterly percentage constraints (these should exist from earlier migrations)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q1_overall_percentage') 
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_q1_overall_percentage') THEN
        ALTER TABLE kra_assignments ADD CONSTRAINT chk_q1_overall_percentage CHECK (q1_overall_percentage >= 0 AND q1_overall_percentage <= 100);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q2_overall_percentage') 
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_q2_overall_percentage') THEN
        ALTER TABLE kra_assignments ADD CONSTRAINT chk_q2_overall_percentage CHECK (q2_overall_percentage >= 0 AND q2_overall_percentage <= 100);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q3_overall_percentage') 
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_q3_overall_percentage') THEN
        ALTER TABLE kra_assignments ADD CONSTRAINT chk_q3_overall_percentage CHECK (q3_overall_percentage >= 0 AND q3_overall_percentage <= 100);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q4_overall_percentage') 
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_q4_overall_percentage') THEN
        ALTER TABLE kra_assignments ADD CONSTRAINT chk_q4_overall_percentage CHECK (q4_overall_percentage >= 0 AND q4_overall_percentage <= 100);
    END IF;

    -- Cumulative percentage constraints (only if columns exist)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q1_cumulative_percentage') 
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_q1_cumulative_percentage') THEN
        ALTER TABLE kra_assignments ADD CONSTRAINT chk_q1_cumulative_percentage CHECK (q1_cumulative_percentage >= 0 AND q1_cumulative_percentage <= 100);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q2_cumulative_percentage') 
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_q2_cumulative_percentage') THEN
        ALTER TABLE kra_assignments ADD CONSTRAINT chk_q2_cumulative_percentage CHECK (q2_cumulative_percentage >= 0 AND q2_cumulative_percentage <= 100);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q3_cumulative_percentage') 
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_q3_cumulative_percentage') THEN
        ALTER TABLE kra_assignments ADD CONSTRAINT chk_q3_cumulative_percentage CHECK (q3_cumulative_percentage >= 0 AND q3_cumulative_percentage <= 100);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q4_cumulative_percentage') 
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_q4_cumulative_percentage') THEN
        ALTER TABLE kra_assignments ADD CONSTRAINT chk_q4_cumulative_percentage CHECK (q4_cumulative_percentage >= 0 AND q4_cumulative_percentage <= 100);
    END IF;

    -- Main overall percentage constraint
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'overall_percentage') 
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_overall_percentage') THEN
        ALTER TABLE kra_assignments ADD CONSTRAINT chk_overall_percentage CHECK (overall_percentage >= 0 AND overall_percentage <= 100);
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON FUNCTION safe_cumulative_percentage_calculation(DECIMAL, DECIMAL) IS 'Safely calculates cumulative percentage ensuring it does not exceed 100%';

-- Clean up any existing data that might have invalid percentages
UPDATE kra_assignments 
SET 
  -- Fix quarterly percentages
  q1_overall_percentage = LEAST(100.0, GREATEST(0.0, COALESCE(q1_overall_percentage, 0))),
  q2_overall_percentage = LEAST(100.0, GREATEST(0.0, COALESCE(q2_overall_percentage, 0))),
  q3_overall_percentage = LEAST(100.0, GREATEST(0.0, COALESCE(q3_overall_percentage, 0))),
  q4_overall_percentage = LEAST(100.0, GREATEST(0.0, COALESCE(q4_overall_percentage, 0))),
  -- Fix cumulative percentages
  q1_cumulative_percentage = LEAST(100.0, GREATEST(0.0, COALESCE(q1_cumulative_percentage, 0))),
  q2_cumulative_percentage = LEAST(100.0, GREATEST(0.0, COALESCE(q2_cumulative_percentage, 0))),
  q3_cumulative_percentage = LEAST(100.0, GREATEST(0.0, COALESCE(q3_cumulative_percentage, 0))),
  q4_cumulative_percentage = LEAST(100.0, GREATEST(0.0, COALESCE(q4_cumulative_percentage, 0))),
  -- Fix main overall percentage
  overall_percentage = LEAST(100.0, GREATEST(0.0, COALESCE(overall_percentage, 0)))
WHERE 
  q1_overall_percentage > 100 OR q1_overall_percentage < 0 OR
  q2_overall_percentage > 100 OR q2_overall_percentage < 0 OR
  q3_overall_percentage > 100 OR q3_overall_percentage < 0 OR
  q4_overall_percentage > 100 OR q4_overall_percentage < 0 OR
  q1_cumulative_percentage > 100 OR q1_cumulative_percentage < 0 OR
  q2_cumulative_percentage > 100 OR q2_cumulative_percentage < 0 OR
  q3_cumulative_percentage > 100 OR q3_cumulative_percentage < 0 OR
  q4_cumulative_percentage > 100 OR q4_cumulative_percentage < 0 OR
  overall_percentage > 100 OR overall_percentage < 0;

-- Recalculate all existing assignments to apply new safe calculation logic
UPDATE kra_evaluations SET updated_at = now();
