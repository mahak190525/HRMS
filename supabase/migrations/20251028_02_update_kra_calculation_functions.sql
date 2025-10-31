/*
  # Update KRA Calculation Functions for Quarterly Support

  This migration updates the existing KRA calculation functions to handle quarterly evaluations.
  
  ## Changes:
  1. Update calculate_kra_weighted_score function to remain unchanged (works per evaluation)
  2. Update update_assignment_totals function to calculate quarterly and annual totals
  3. Add new function to update quarterly status based on evaluation completion
*/

-- Drop existing trigger and function to recreate them
DROP TRIGGER IF EXISTS trigger_update_assignment_totals ON kra_evaluations;
DROP FUNCTION IF EXISTS update_assignment_totals();

-- Create updated function to handle quarterly totals
CREATE OR REPLACE FUNCTION update_assignment_totals()
RETURNS TRIGGER AS $$
DECLARE
  assignment_record RECORD;
  quarter_col text;
  status_col text;
  score_col text;
  possible_score_col text;
  percentage_col text;
  rating_col text;
  quarter_value text;
BEGIN
  -- Get the quarter from the evaluation
  quarter_value := COALESCE(NEW.quarter, OLD.quarter, 'Q1');
  
  -- Determine column names based on quarter
  quarter_col := 'q' || SUBSTRING(quarter_value, 2, 1);
  status_col := quarter_col || '_status';
  score_col := quarter_col || '_total_score';
  possible_score_col := quarter_col || '_total_possible_score';
  percentage_col := quarter_col || '_overall_percentage';
  rating_col := quarter_col || '_overall_rating';
  
  -- Update quarterly totals for the specific quarter
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
  ) USING COALESCE(NEW.assignment_id, OLD.assignment_id), quarter_value;
  
  -- Update quarterly percentage and rating
  EXECUTE format('
    UPDATE kra_assignments 
    SET 
      %I = CASE 
        WHEN %I > 0 THEN (%I / %I) * 100 
        ELSE 0 
      END,
      %I = CASE 
        WHEN %I = 0 THEN ''Not Evaluated''
        WHEN (%I / %I) >= 0.9 THEN ''Far Exceeded Expectations''
        WHEN (%I / %I) >= 0.75 THEN ''Exceeds Expectations''
        WHEN (%I / %I) >= 0.6 THEN ''Meets Expectations''
        WHEN (%I / %I) >= 0.4 THEN ''Below Expectations''
        ELSE ''Poor Performance''
      END
    WHERE id = $1',
    percentage_col, possible_score_col, score_col, possible_score_col,
    rating_col, possible_score_col, score_col, possible_score_col,
    score_col, possible_score_col, score_col, possible_score_col, score_col, possible_score_col
  ) USING COALESCE(NEW.assignment_id, OLD.assignment_id);
  
  -- Update annual averages and completed quarters count
  UPDATE kra_assignments 
  SET 
    completed_quarters = (
      SELECT COUNT(DISTINCT quarter) 
      FROM kra_evaluations 
      WHERE assignment_id = COALESCE(NEW.assignment_id, OLD.assignment_id)
      AND manager_evaluated_at IS NOT NULL
    ),
    annual_average_score = (
      COALESCE(q1_total_score, 0) + COALESCE(q2_total_score, 0) + 
      COALESCE(q3_total_score, 0) + COALESCE(q4_total_score, 0)
    ) / GREATEST(
      (CASE WHEN q1_total_score > 0 THEN 1 ELSE 0 END +
       CASE WHEN q2_total_score > 0 THEN 1 ELSE 0 END +
       CASE WHEN q3_total_score > 0 THEN 1 ELSE 0 END +
       CASE WHEN q4_total_score > 0 THEN 1 ELSE 0 END), 1
    ),
    annual_average_percentage = (
      COALESCE(q1_overall_percentage, 0) + COALESCE(q2_overall_percentage, 0) + 
      COALESCE(q3_overall_percentage, 0) + COALESCE(q4_overall_percentage, 0)
    ) / GREATEST(
      (CASE WHEN q1_overall_percentage > 0 THEN 1 ELSE 0 END +
       CASE WHEN q2_overall_percentage > 0 THEN 1 ELSE 0 END +
       CASE WHEN q3_overall_percentage > 0 THEN 1 ELSE 0 END +
       CASE WHEN q4_overall_percentage > 0 THEN 1 ELSE 0 END), 1
    )
  WHERE id = COALESCE(NEW.assignment_id, OLD.assignment_id);
  
  -- Update annual overall rating based on average percentage
  UPDATE kra_assignments 
  SET 
    annual_overall_rating = CASE 
      WHEN completed_quarters = 0 THEN 'Not Started'
      WHEN annual_average_percentage >= 90 THEN 'Far Exceeded Expectations'
      WHEN annual_average_percentage >= 75 THEN 'Exceeds Expectations'
      WHEN annual_average_percentage >= 60 THEN 'Meets Expectations'
      WHEN annual_average_percentage >= 40 THEN 'Below Expectations'
      ELSE 'Poor Performance'
    END
  WHERE id = COALESCE(NEW.assignment_id, OLD.assignment_id);
  
  -- Update legacy total fields to reflect current quarter or annual average
  UPDATE kra_assignments 
  SET 
    total_score = annual_average_score,
    total_possible_score = (
      SELECT COALESCE(SUM(level_5_points * weight / 100), 0)
      FROM kra_goals g
      JOIN kra_templates t ON g.template_id = t.id
      WHERE t.id = (SELECT template_id FROM kra_assignments WHERE id = COALESCE(NEW.assignment_id, OLD.assignment_id))
    ),
    overall_percentage = annual_average_percentage,
    overall_rating = annual_overall_rating
  WHERE id = COALESCE(NEW.assignment_id, OLD.assignment_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER trigger_update_assignment_totals
  AFTER INSERT OR UPDATE OR DELETE ON kra_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION update_assignment_totals();

-- Create function to update quarterly status when evaluations are submitted/evaluated
CREATE OR REPLACE FUNCTION update_quarterly_status()
RETURNS TRIGGER AS $$
DECLARE
  quarter_value text;
  status_col text;
  submitted_at_col text;
  submitted_by_col text;
  evaluated_at_col text;
  evaluated_by_col text;
  has_all_goals boolean;
  has_manager_evaluation boolean;
BEGIN
  quarter_value := COALESCE(NEW.quarter, 'Q1');
  
  -- Determine column names based on quarter
  status_col := 'q' || SUBSTRING(quarter_value, 2, 1) || '_status';
  submitted_at_col := 'q' || SUBSTRING(quarter_value, 2, 1) || '_submitted_at';
  submitted_by_col := 'q' || SUBSTRING(quarter_value, 2, 1) || '_submitted_by';
  evaluated_at_col := 'q' || SUBSTRING(quarter_value, 2, 1) || '_evaluated_at';
  evaluated_by_col := 'q' || SUBSTRING(quarter_value, 2, 1) || '_evaluated_by';
  
  -- Check if all goals have employee comments for this quarter
  SELECT 
    COUNT(*) = (
      SELECT COUNT(*) 
      FROM kra_goals g 
      JOIN kra_templates t ON g.template_id = t.id
      JOIN kra_assignments a ON a.template_id = t.id
      WHERE a.id = NEW.assignment_id
    )
  INTO has_all_goals
  FROM kra_evaluations e
  WHERE e.assignment_id = NEW.assignment_id 
  AND e.quarter = quarter_value
  AND e.employee_comments IS NOT NULL 
  AND e.employee_comments != '';
  
  -- Check if all goals have manager evaluation for this quarter
  SELECT 
    COUNT(*) = (
      SELECT COUNT(*) 
      FROM kra_goals g 
      JOIN kra_templates t ON g.template_id = t.id
      JOIN kra_assignments a ON a.template_id = t.id
      WHERE a.id = NEW.assignment_id
    )
  INTO has_manager_evaluation
  FROM kra_evaluations e
  WHERE e.assignment_id = NEW.assignment_id 
  AND e.quarter = quarter_value
  AND e.manager_evaluated_at IS NOT NULL;
  
  -- Update quarterly status based on completion
  IF has_manager_evaluation THEN
    -- All goals evaluated by manager
    EXECUTE format('
      UPDATE kra_assignments 
      SET 
        %I = ''evaluated'',
        %I = (SELECT MAX(manager_evaluated_at) FROM kra_evaluations WHERE assignment_id = $1 AND quarter = $2),
        %I = (SELECT manager_evaluated_by FROM kra_evaluations WHERE assignment_id = $1 AND quarter = $2 AND manager_evaluated_at IS NOT NULL LIMIT 1)
      WHERE id = $1',
      status_col, evaluated_at_col, evaluated_by_col
    ) USING NEW.assignment_id, quarter_value;
  ELSIF has_all_goals THEN
    -- All goals have employee comments (submitted)
    EXECUTE format('
      UPDATE kra_assignments 
      SET 
        %I = ''submitted'',
        %I = (SELECT MAX(employee_submitted_at) FROM kra_evaluations WHERE assignment_id = $1 AND quarter = $2),
        %I = $3
      WHERE id = $1',
      status_col, submitted_at_col, submitted_by_col
    ) USING NEW.assignment_id, quarter_value, (SELECT employee_id FROM kra_assignments WHERE id = NEW.assignment_id);
  ELSE
    -- In progress or not started
    EXECUTE format('
      UPDATE kra_assignments 
      SET %I = CASE 
        WHEN EXISTS (
          SELECT 1 FROM kra_evaluations 
          WHERE assignment_id = $1 AND quarter = $2 
          AND (employee_comments IS NOT NULL OR manager_evaluated_at IS NOT NULL)
        ) THEN ''in_progress''
        ELSE ''not_started''
      END
      WHERE id = $1',
      status_col
    ) USING NEW.assignment_id, quarter_value;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists and create new one
DROP TRIGGER IF EXISTS trigger_update_quarterly_status ON kra_evaluations;

-- Create trigger for quarterly status updates
CREATE TRIGGER trigger_update_quarterly_status
  AFTER INSERT OR UPDATE ON kra_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION update_quarterly_status();

-- Add helpful comments to the functions
COMMENT ON FUNCTION update_assignment_totals() IS 'Updates quarterly and annual totals for KRA assignments when evaluations change';
COMMENT ON FUNCTION update_quarterly_status() IS 'Updates quarterly status (not_started, in_progress, submitted, evaluated) based on evaluation completion';
