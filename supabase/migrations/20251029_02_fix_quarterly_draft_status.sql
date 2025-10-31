-- Migration: Fix Quarterly Draft Status Issue
-- This migration fixes the quarterly status trigger to properly handle drafts vs submissions
-- Drafts should not change the quarterly status to 'submitted'

-- First, let's clean up any existing data that might be inconsistent
-- Reset quarterly statuses that might have been incorrectly set to 'submitted' due to drafts
UPDATE kra_assignments 
SET 
  q1_status = CASE 
    WHEN q1_status = 'submitted' AND NOT EXISTS (
      SELECT 1 FROM kra_evaluations 
      WHERE assignment_id = kra_assignments.id 
      AND quarter = 'Q1' 
      AND employee_submitted_at IS NOT NULL
    ) THEN 'in_progress'
    ELSE q1_status
  END,
  q2_status = CASE 
    WHEN q2_status = 'submitted' AND NOT EXISTS (
      SELECT 1 FROM kra_evaluations 
      WHERE assignment_id = kra_assignments.id 
      AND quarter = 'Q2' 
      AND employee_submitted_at IS NOT NULL
    ) THEN 'in_progress'
    ELSE q2_status
  END,
  q3_status = CASE 
    WHEN q3_status = 'submitted' AND NOT EXISTS (
      SELECT 1 FROM kra_evaluations 
      WHERE assignment_id = kra_assignments.id 
      AND quarter = 'Q3' 
      AND employee_submitted_at IS NOT NULL
    ) THEN 'in_progress'
    ELSE q3_status
  END,
  q4_status = CASE 
    WHEN q4_status = 'submitted' AND NOT EXISTS (
      SELECT 1 FROM kra_evaluations 
      WHERE assignment_id = kra_assignments.id 
      AND quarter = 'Q4' 
      AND employee_submitted_at IS NOT NULL
    ) THEN 'in_progress'
    ELSE q4_status
  END
WHERE q1_status = 'submitted' OR q2_status = 'submitted' OR q3_status = 'submitted' OR q4_status = 'submitted';

-- Drop the existing quarterly status function and recreate it with proper draft handling
DROP FUNCTION IF EXISTS update_quarterly_status() CASCADE;

CREATE OR REPLACE FUNCTION update_quarterly_status()
RETURNS TRIGGER AS $$
DECLARE
  quarter_value TEXT;
  status_col TEXT;
  submitted_at_col TEXT;
  submitted_by_col TEXT;
  evaluated_at_col TEXT;
  evaluated_by_col TEXT;
  has_all_goals BOOLEAN := FALSE;
  has_manager_evaluation BOOLEAN := FALSE;
BEGIN
  -- Extract quarter from NEW record and convert to lowercase for column names
  quarter_value := NEW.quarter;
  
  -- Determine column names based on quarter (lowercase for database columns)
  status_col := LOWER(quarter_value) || '_status';
  submitted_at_col := LOWER(quarter_value) || '_submitted_at';
  submitted_by_col := LOWER(quarter_value) || '_submitted_by';
  evaluated_at_col := LOWER(quarter_value) || '_evaluated_at';
  evaluated_by_col := LOWER(quarter_value) || '_evaluated_by';
  
  -- Check if all goals have been SUBMITTED (not just drafted) for this quarter
  -- Only count evaluations with employee_submitted_at as truly submitted
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
  AND e.employee_submitted_at IS NOT NULL;  -- Only count actual submissions, not drafts
  
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
    -- All goals have been submitted by employee (not just drafted)
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
    -- Check if there are any evaluations (drafts or submissions) for this quarter
    EXECUTE format('
      UPDATE kra_assignments 
      SET %I = CASE 
        WHEN EXISTS (
          SELECT 1 FROM kra_evaluations 
          WHERE assignment_id = $1 AND quarter = $2 
          AND (employee_comments IS NOT NULL AND employee_comments != '''')
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

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_update_quarterly_status ON kra_evaluations;
CREATE TRIGGER trigger_update_quarterly_status
  AFTER INSERT OR UPDATE ON kra_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION update_quarterly_status();

-- Add helpful comment
COMMENT ON FUNCTION update_quarterly_status() IS 
'Updates quarterly status columns (q1_status, q2_status, etc.) based on evaluation completion.
- not_started: No evaluations exist
- in_progress: Some evaluations exist (drafts or submissions) but not all goals submitted
- submitted: All goals have employee_submitted_at set (actual submissions, not drafts)
- evaluated: All goals have manager_evaluated_at set';

COMMENT ON TRIGGER trigger_update_quarterly_status ON kra_evaluations IS 
'Triggers quarterly status updates when evaluations are inserted or updated. 
Distinguishes between drafts (employee_comments only) and submissions (employee_submitted_at set).';
