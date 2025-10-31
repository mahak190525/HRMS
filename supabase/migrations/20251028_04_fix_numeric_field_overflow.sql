/*
  # Fix Numeric Field Overflow Issues

  This migration fixes the numeric field overflow by increasing precision for fields
  that can legitimately exceed 999.99 and adding constraints for percentage fields.
*/

-- Increase precision for fields that can legitimately be large
-- awarded_marks and awarded_points can be large numbers
ALTER TABLE kra_evaluations 
ALTER COLUMN awarded_marks TYPE numeric(10,2),
ALTER COLUMN awarded_points TYPE numeric(10,2);

-- weighted_score can be very large (awarded_points * weight)
ALTER TABLE kra_evaluations 
ALTER COLUMN weighted_score TYPE numeric(12,2);

-- total_score and total_possible_score can be large sums
ALTER TABLE kra_assignments 
ALTER COLUMN total_score TYPE numeric(12,2),
ALTER COLUMN total_possible_score TYPE numeric(12,2);

-- Quarterly score fields need larger precision too
DO $$
BEGIN
    -- Q1 scores
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q1_total_score') THEN
        ALTER TABLE kra_assignments ALTER COLUMN q1_total_score TYPE numeric(12,2);
        ALTER TABLE kra_assignments ALTER COLUMN q1_total_possible_score TYPE numeric(12,2);
    END IF;
    
    -- Q2 scores  
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q2_total_score') THEN
        ALTER TABLE kra_assignments ALTER COLUMN q2_total_score TYPE numeric(12,2);
        ALTER TABLE kra_assignments ALTER COLUMN q2_total_possible_score TYPE numeric(12,2);
    END IF;
    
    -- Q3 scores
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q3_total_score') THEN
        ALTER TABLE kra_assignments ALTER COLUMN q3_total_score TYPE numeric(12,2);
        ALTER TABLE kra_assignments ALTER COLUMN q3_total_possible_score TYPE numeric(12,2);
    END IF;
    
    -- Q4 scores
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q4_total_score') THEN
        ALTER TABLE kra_assignments ALTER COLUMN q4_total_score TYPE numeric(12,2);
        ALTER TABLE kra_assignments ALTER COLUMN q4_total_possible_score TYPE numeric(12,2);
    END IF;
    
    -- Annual average score
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'annual_average_score') THEN
        ALTER TABLE kra_assignments ALTER COLUMN annual_average_score TYPE numeric(12,2);
    END IF;
END $$;

-- For percentage fields, keep numeric(5,2) but add constraints to ensure they don't exceed 100%
-- Add check constraints for percentage fields to prevent values over 100%
DO $$
BEGIN
    -- Main percentage field
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'kra_assignments_overall_percentage_check') THEN
        ALTER TABLE kra_assignments ADD CONSTRAINT kra_assignments_overall_percentage_check 
        CHECK (overall_percentage >= 0 AND overall_percentage <= 100);
    END IF;
    
    -- Quarterly percentage fields
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q1_overall_percentage') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'kra_assignments_q1_percentage_check') THEN
            ALTER TABLE kra_assignments ADD CONSTRAINT kra_assignments_q1_percentage_check 
            CHECK (q1_overall_percentage >= 0 AND q1_overall_percentage <= 100);
        END IF;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q2_overall_percentage') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'kra_assignments_q2_percentage_check') THEN
            ALTER TABLE kra_assignments ADD CONSTRAINT kra_assignments_q2_percentage_check 
            CHECK (q2_overall_percentage >= 0 AND q2_overall_percentage <= 100);
        END IF;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q3_overall_percentage') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'kra_assignments_q3_percentage_check') THEN
            ALTER TABLE kra_assignments ADD CONSTRAINT kra_assignments_q3_percentage_check 
            CHECK (q3_overall_percentage >= 0 AND q3_overall_percentage <= 100);
        END IF;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'q4_overall_percentage') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'kra_assignments_q4_percentage_check') THEN
            ALTER TABLE kra_assignments ADD CONSTRAINT kra_assignments_q4_percentage_check 
            CHECK (q4_overall_percentage >= 0 AND q4_overall_percentage <= 100);
        END IF;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kra_assignments' AND column_name = 'annual_average_percentage') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'kra_assignments_annual_percentage_check') THEN
            ALTER TABLE kra_assignments ADD CONSTRAINT kra_assignments_annual_percentage_check 
            CHECK (annual_average_percentage >= 0 AND annual_average_percentage <= 100);
        END IF;
    END IF;
END $$;

-- Update the calculation functions to ensure percentages don't exceed 100%
CREATE OR REPLACE FUNCTION calculate_kra_weighted_score()
RETURNS TRIGGER AS $$
DECLARE
  goal_weight DECIMAL;
  goal_max_points DECIMAL;
BEGIN
  -- Get goal weight and max points (level 5 points)
  SELECT weight, level_5_points INTO goal_weight, goal_max_points
  FROM kra_goals 
  WHERE id = NEW.goal_id;
  
  -- Calculate weighted score: awarded_points * weight
  -- Cap awarded_points to prevent extreme values
  NEW.awarded_points := LEAST(NEW.awarded_points, goal_max_points);
  NEW.weighted_score := NEW.awarded_points * goal_weight;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update the assignment totals function to cap percentages at 100%
CREATE OR REPLACE FUNCTION safe_percentage_calculation(actual_score DECIMAL, max_score DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
    IF max_score > 0 THEN
        -- Cap percentage at 100%
        RETURN LEAST((actual_score / max_score) * 100, 100);
    ELSE
        RETURN 0;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Update existing calculation function to use safe percentage calculation
CREATE OR REPLACE FUNCTION update_assignment_totals()
RETURNS TRIGGER AS $$
DECLARE
  assignment_id_to_update UUID;
  total_actual_weighted DECIMAL;
  total_max_weighted DECIMAL;
  calculated_percentage DECIMAL;
BEGIN
  -- Get the assignment ID to update
  assignment_id_to_update := COALESCE(NEW.assignment_id, OLD.assignment_id);
  
  -- Calculate total actual weighted points and total maximum weighted points
  SELECT 
    COALESCE(SUM(e.awarded_points * g.weight), 0),
    COALESCE(SUM(g.level_5_points * g.weight), 0)
  INTO total_actual_weighted, total_max_weighted
  FROM kra_evaluations e
  JOIN kra_goals g ON e.goal_id = g.id
  WHERE e.assignment_id = assignment_id_to_update;
  
  -- Calculate the overall percentage using safe function
  calculated_percentage := safe_percentage_calculation(total_actual_weighted, total_max_weighted);
  
  -- Update assignment with calculated values
  UPDATE kra_assignments 
  SET 
    total_score = total_actual_weighted,
    total_possible_score = total_max_weighted,
    overall_percentage = calculated_percentage,
    overall_rating = CASE 
      WHEN calculated_percentage >= 90 THEN 'Far Exceeded Expectations'
      WHEN calculated_percentage >= 75 THEN 'Exceeds Expectations'
      WHEN calculated_percentage >= 60 THEN 'Meets Expectations'
      WHEN calculated_percentage >= 40 THEN 'Below Expectations'
      WHEN calculated_percentage > 0 THEN 'Poor Performance'
      ELSE 'Not Evaluated'
    END,
    updated_at = now()
  WHERE id = assignment_id_to_update;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Add helpful comments
COMMENT ON FUNCTION safe_percentage_calculation(DECIMAL, DECIMAL) IS 'Safely calculates percentage ensuring it does not exceed 100%';
COMMENT ON FUNCTION calculate_kra_weighted_score() IS 'Calculates weighted score with safeguards against extreme values';
COMMENT ON FUNCTION update_assignment_totals() IS 'Updates assignment totals with safe percentage calculations';

-- Recalculate existing data to fix any overflow issues
-- This will apply the new safe calculation logic to existing records
UPDATE kra_evaluations SET updated_at = now() WHERE awarded_points > 0;
