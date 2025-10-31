-- Update quarterly percentage calculation to use weighted goal formula:
-- Quarterly % Score = Σ (Achieved Marks_i / Max Marks_i × Weight %_i)

-- Drop existing triggers to recreate them
DROP TRIGGER IF EXISTS trigger_update_assignment_totals ON kra_evaluations;

-- Update the assignment totals calculation function with the weighted goal formula
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
  q1_percentage numeric := 0;
  q2_percentage numeric := 0;
  q3_percentage numeric := 0;
  q4_percentage numeric := 0;
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
  
  -- Update quarterly totals (for reference, but percentage is calculated differently)
  EXECUTE format('
    UPDATE kra_assignments 
    SET 
      %I = (
        SELECT COALESCE(SUM(e.awarded_marks), 0) 
        FROM kra_evaluations e
        WHERE e.assignment_id = $1 AND e.quarter = $2
      ),
      %I = (
        SELECT COALESCE(SUM(g.max_score), 0)
        FROM kra_goals g
        JOIN kra_evaluations e ON g.id = e.goal_id
        WHERE e.assignment_id = $1 AND e.quarter = $2
      ),
      updated_at = now()
    WHERE id = $1',
    score_col, possible_score_col
  ) USING assignment_id_to_update, quarter_value;
  
  -- Update quarterly percentage using weighted goal formula: Σ (Achieved Marks_i / Max Marks_i × Weight %_i)
  EXECUTE format('
    UPDATE kra_assignments 
    SET 
      %I = LEAST(100.0, (
        SELECT COALESCE(SUM(
          CASE 
            WHEN g.max_score > 0 THEN (e.awarded_marks / g.max_score) * g.weight
            ELSE 0 
          END
        ), 0)
        FROM kra_evaluations e
        JOIN kra_goals g ON e.goal_id = g.id
        WHERE e.assignment_id = $1 AND e.quarter = $2
      ))
    WHERE id = $1',
    percentage_col
  ) USING assignment_id_to_update, quarter_value;
  
  -- Update quarterly rating based on percentage
  EXECUTE format('
    UPDATE kra_assignments 
    SET 
      %I = CASE 
        WHEN %I = 0 THEN ''Not Evaluated''
        WHEN %I >= 90 THEN ''Far Exceeded Expectations''
        WHEN %I >= 75 THEN ''Exceeds Expectations''
        WHEN %I >= 60 THEN ''Meets Expectations''
        WHEN %I >= 40 THEN ''Below Expectations''
        ELSE ''Poor Performance''
      END
    WHERE id = $1',
    rating_col, percentage_col, percentage_col, percentage_col, percentage_col, percentage_col
  ) USING assignment_id_to_update;
  
  -- Get current quarterly percentages for cumulative calculations
  SELECT 
    COALESCE(q1_overall_percentage, 0),
    COALESCE(q2_overall_percentage, 0),
    COALESCE(q3_overall_percentage, 0),
    COALESCE(q4_overall_percentage, 0)
  INTO 
    q1_percentage,
    q2_percentage,
    q3_percentage,
    q4_percentage
  FROM kra_assignments 
  WHERE id = assignment_id_to_update;
  
  -- Calculate cumulative percentages (running averages of completed quarters)
  UPDATE kra_assignments 
  SET 
    -- Q1 Cumulative (Q1 only)
    q1_cumulative_percentage = q1_percentage,
    
    -- Q2 Cumulative (Average of Q1 + Q2)
    q2_cumulative_percentage = CASE 
      WHEN q2_percentage > 0 THEN (q1_percentage + q2_percentage) / 2
      ELSE q1_percentage
    END,
    
    -- Q3 Cumulative (Average of Q1 + Q2 + Q3)
    q3_cumulative_percentage = CASE 
      WHEN q3_percentage > 0 THEN 
        (q1_percentage + q2_percentage + q3_percentage) / 
        (CASE WHEN q1_percentage > 0 THEN 1 ELSE 0 END + 
         CASE WHEN q2_percentage > 0 THEN 1 ELSE 0 END + 
         CASE WHEN q3_percentage > 0 THEN 1 ELSE 0 END)
      WHEN q2_percentage > 0 THEN (q1_percentage + q2_percentage) / 2
      ELSE q1_percentage
    END,
    
    -- Q4 Cumulative (Average of Q1 + Q2 + Q3 + Q4)
    q4_cumulative_percentage = CASE 
      WHEN q4_percentage > 0 THEN 
        (q1_percentage + q2_percentage + q3_percentage + q4_percentage) / 
        (CASE WHEN q1_percentage > 0 THEN 1 ELSE 0 END + 
         CASE WHEN q2_percentage > 0 THEN 1 ELSE 0 END + 
         CASE WHEN q3_percentage > 0 THEN 1 ELSE 0 END + 
         CASE WHEN q4_percentage > 0 THEN 1 ELSE 0 END)
      WHEN q3_percentage > 0 THEN 
        (q1_percentage + q2_percentage + q3_percentage) / 
        (CASE WHEN q1_percentage > 0 THEN 1 ELSE 0 END + 
         CASE WHEN q2_percentage > 0 THEN 1 ELSE 0 END + 
         CASE WHEN q3_percentage > 0 THEN 1 ELSE 0 END)
      WHEN q2_percentage > 0 THEN (q1_percentage + q2_percentage) / 2
      ELSE q1_percentage
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
  
  -- Update legacy total fields to reflect the most recent cumulative percentage
  UPDATE kra_assignments 
  SET 
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

-- Force recalculate all existing quarterly percentages using the weighted goal formula

-- Update Q1 percentages using weighted formula
UPDATE kra_assignments 
SET 
  q1_overall_percentage = LEAST(100.0, (
    SELECT COALESCE(SUM(
      CASE 
        WHEN g.max_score > 0 THEN (e.awarded_marks / g.max_score) * g.weight
        ELSE 0 
      END
    ), 0)
    FROM kra_evaluations e
    JOIN kra_goals g ON e.goal_id = g.id
    WHERE e.assignment_id = kra_assignments.id AND e.quarter = 'Q1'
  ))
WHERE EXISTS (
  SELECT 1 FROM kra_evaluations e 
  WHERE e.assignment_id = kra_assignments.id AND e.quarter = 'Q1'
);

-- Update Q2 percentages using weighted formula
UPDATE kra_assignments 
SET 
  q2_overall_percentage = LEAST(100.0, (
    SELECT COALESCE(SUM(
      CASE 
        WHEN g.max_score > 0 THEN (e.awarded_marks / g.max_score) * g.weight
        ELSE 0 
      END
    ), 0)
    FROM kra_evaluations e
    JOIN kra_goals g ON e.goal_id = g.id
    WHERE e.assignment_id = kra_assignments.id AND e.quarter = 'Q2'
  ))
WHERE EXISTS (
  SELECT 1 FROM kra_evaluations e 
  WHERE e.assignment_id = kra_assignments.id AND e.quarter = 'Q2'
);

-- Update Q3 percentages using weighted formula
UPDATE kra_assignments 
SET 
  q3_overall_percentage = LEAST(100.0, (
    SELECT COALESCE(SUM(
      CASE 
        WHEN g.max_score > 0 THEN (e.awarded_marks / g.max_score) * g.weight
        ELSE 0 
      END
    ), 0)
    FROM kra_evaluations e
    JOIN kra_goals g ON e.goal_id = g.id
    WHERE e.assignment_id = kra_assignments.id AND e.quarter = 'Q3'
  ))
WHERE EXISTS (
  SELECT 1 FROM kra_evaluations e 
  WHERE e.assignment_id = kra_assignments.id AND e.quarter = 'Q3'
);

-- Update Q4 percentages using weighted formula
UPDATE kra_assignments 
SET 
  q4_overall_percentage = LEAST(100.0, (
    SELECT COALESCE(SUM(
      CASE 
        WHEN g.max_score > 0 THEN (e.awarded_marks / g.max_score) * g.weight
        ELSE 0 
      END
    ), 0)
    FROM kra_evaluations e
    JOIN kra_goals g ON e.goal_id = g.id
    WHERE e.assignment_id = kra_assignments.id AND e.quarter = 'Q4'
  ))
WHERE EXISTS (
  SELECT 1 FROM kra_evaluations e 
  WHERE e.assignment_id = kra_assignments.id AND e.quarter = 'Q4'
);

-- Update ratings based on the new percentages
UPDATE kra_assignments 
SET 
  q1_overall_rating = CASE 
    WHEN q1_overall_percentage = 0 THEN 'Not Evaluated'
    WHEN q1_overall_percentage >= 90 THEN 'Far Exceeded Expectations'
    WHEN q1_overall_percentage >= 75 THEN 'Exceeds Expectations'
    WHEN q1_overall_percentage >= 60 THEN 'Meets Expectations'
    WHEN q1_overall_percentage >= 40 THEN 'Below Expectations'
    ELSE 'Poor Performance'
  END,
  q2_overall_rating = CASE 
    WHEN q2_overall_percentage = 0 THEN 'Not Evaluated'
    WHEN q2_overall_percentage >= 90 THEN 'Far Exceeded Expectations'
    WHEN q2_overall_percentage >= 75 THEN 'Exceeds Expectations'
    WHEN q2_overall_percentage >= 60 THEN 'Meets Expectations'
    WHEN q2_overall_percentage >= 40 THEN 'Below Expectations'
    ELSE 'Poor Performance'
  END,
  q3_overall_rating = CASE 
    WHEN q3_overall_percentage = 0 THEN 'Not Evaluated'
    WHEN q3_overall_percentage >= 90 THEN 'Far Exceeded Expectations'
    WHEN q3_overall_percentage >= 75 THEN 'Exceeds Expectations'
    WHEN q3_overall_percentage >= 60 THEN 'Meets Expectations'
    WHEN q3_overall_percentage >= 40 THEN 'Below Expectations'
    ELSE 'Poor Performance'
  END,
  q4_overall_rating = CASE 
    WHEN q4_overall_percentage = 0 THEN 'Not Evaluated'
    WHEN q4_overall_percentage >= 90 THEN 'Far Exceeded Expectations'
    WHEN q4_overall_percentage >= 75 THEN 'Exceeds Expectations'
    WHEN q4_overall_percentage >= 60 THEN 'Meets Expectations'
    WHEN q4_overall_percentage >= 40 THEN 'Below Expectations'
    ELSE 'Poor Performance'
  END;

-- Recalculate cumulative percentages using the corrected quarterly percentages
UPDATE kra_assignments 
SET 
  -- Q1 Cumulative (Q1 only)
  q1_cumulative_percentage = q1_overall_percentage,
  
  -- Q2 Cumulative (Average of Q1 + Q2)
  q2_cumulative_percentage = CASE 
    WHEN q2_overall_percentage > 0 THEN (q1_overall_percentage + q2_overall_percentage) / 2
    ELSE q1_overall_percentage
  END,
  
  -- Q3 Cumulative (Average of Q1 + Q2 + Q3)
  q3_cumulative_percentage = CASE 
    WHEN q3_overall_percentage > 0 THEN 
      (q1_overall_percentage + q2_overall_percentage + q3_overall_percentage) / 
      (CASE WHEN q1_overall_percentage > 0 THEN 1 ELSE 0 END + 
       CASE WHEN q2_overall_percentage > 0 THEN 1 ELSE 0 END + 
       CASE WHEN q3_overall_percentage > 0 THEN 1 ELSE 0 END)
    WHEN q2_overall_percentage > 0 THEN (q1_overall_percentage + q2_overall_percentage) / 2
    ELSE q1_overall_percentage
  END,
  
  -- Q4 Cumulative (Average of Q1 + Q2 + Q3 + Q4)
  q4_cumulative_percentage = CASE 
    WHEN q4_overall_percentage > 0 THEN 
      (q1_overall_percentage + q2_overall_percentage + q3_overall_percentage + q4_overall_percentage) / 
      (CASE WHEN q1_overall_percentage > 0 THEN 1 ELSE 0 END + 
       CASE WHEN q2_overall_percentage > 0 THEN 1 ELSE 0 END + 
       CASE WHEN q3_overall_percentage > 0 THEN 1 ELSE 0 END + 
       CASE WHEN q4_overall_percentage > 0 THEN 1 ELSE 0 END)
    WHEN q3_overall_percentage > 0 THEN 
      (q1_overall_percentage + q2_overall_percentage + q3_overall_percentage) / 
      (CASE WHEN q1_overall_percentage > 0 THEN 1 ELSE 0 END + 
       CASE WHEN q2_overall_percentage > 0 THEN 1 ELSE 0 END + 
       CASE WHEN q3_overall_percentage > 0 THEN 1 ELSE 0 END)
    WHEN q2_overall_percentage > 0 THEN (q1_overall_percentage + q2_overall_percentage) / 2
    ELSE q1_overall_percentage
  END;

-- Update overall fields to reflect the most recent cumulative percentage
UPDATE kra_assignments 
SET 
  overall_percentage = CASE 
    WHEN q4_cumulative_percentage > 0 THEN q4_cumulative_percentage
    WHEN q3_cumulative_percentage > 0 THEN q3_cumulative_percentage
    WHEN q2_cumulative_percentage > 0 THEN q2_cumulative_percentage
    WHEN q1_cumulative_percentage > 0 THEN q1_cumulative_percentage
    ELSE 0
  END,
  overall_rating = CASE 
    WHEN overall_percentage >= 90 THEN 'Far Exceeded Expectations'
    WHEN overall_percentage >= 75 THEN 'Exceeds Expectations'
    WHEN overall_percentage >= 60 THEN 'Meets Expectations'
    WHEN overall_percentage >= 40 THEN 'Below Expectations'
    WHEN overall_percentage > 0 THEN 'Poor Performance'
    ELSE 'Not Evaluated'
  END;

-- Add a comment to document this formula
COMMENT ON FUNCTION update_assignment_totals() IS 'Updates assignment totals using weighted goal formula: Σ (Achieved Marks_i / Max Marks_i × Weight %_i)';
