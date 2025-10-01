-- Fix KRA percentage calculation to use proper weighted percentage method
-- Based on the principle: For each goal, convert score to percentage (points/max_points) 
-- then multiply by goal weight, and sum all contributions

-- Drop existing triggers first
DROP TRIGGER IF EXISTS trigger_calculate_weighted_score ON kra_evaluations;
DROP TRIGGER IF EXISTS trigger_update_assignment_totals ON kra_evaluations;

-- Update the weighted score calculation function
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
  
  -- Calculate weighted score using the new formula:
  -- awarded_points * weight (for summing actual weighted points)
  NEW.weighted_score := NEW.awarded_points * goal_weight;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update the assignment totals calculation function
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
  -- New formula: (sum of actual weighted points / sum of maximum weighted points) * 100
  SELECT 
    COALESCE(SUM(e.awarded_points * g.weight), 0),
    COALESCE(SUM(g.level_5_points * g.weight), 0)
  INTO total_actual_weighted, total_max_weighted
  FROM kra_evaluations e
  JOIN kra_goals g ON e.goal_id = g.id
  WHERE e.assignment_id = assignment_id_to_update;
  
  -- Calculate the overall percentage
  IF total_max_weighted > 0 THEN
    calculated_percentage := (total_actual_weighted / total_max_weighted) * 100;
  ELSE
    calculated_percentage := 0;
  END IF;
  
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

-- Recreate the triggers
CREATE TRIGGER trigger_calculate_weighted_score
  BEFORE INSERT OR UPDATE ON kra_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION calculate_kra_weighted_score();

CREATE TRIGGER trigger_update_assignment_totals
  AFTER INSERT OR UPDATE OR DELETE ON kra_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION update_assignment_totals();

-- Recalculate all existing assignments to fix any incorrect percentages
-- This will trigger the new calculation logic for all existing data
UPDATE kra_evaluations SET updated_at = now();

-- Add a comment explaining the calculation method
COMMENT ON FUNCTION calculate_kra_weighted_score() IS 
'Calculates weighted score using formula: awarded_points * weight. 
This gives the actual weighted points for summing.';

COMMENT ON FUNCTION update_assignment_totals() IS 
'Calculates overall percentage using formula: (sum of actual weighted points / sum of maximum weighted points) * 100.
Example: Goals with weights [25,25,25,15,10] and points [30,25,10,20,0] out of max [35,35,35,25,10]:
Actual weighted = (30*25)+(25*25)+(10*25)+(20*15)+(0*10) = 1925
Max weighted = (35*25)+(35*25)+(35*25)+(25*15)+(10*10) = 3100
Percentage = (1925/3100)*100 = 62.1%';
