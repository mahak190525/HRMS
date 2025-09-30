-- Migration: Fix KRA Assignment Status Synchronization
-- This migration creates a trigger to automatically update assignment status
-- when evaluations are submitted/completed and fixes existing data

-- First, fix existing assignment statuses that are out of sync
WITH assignment_status_fixes AS (
  SELECT 
    a.id as assignment_id,
    a.status as current_status,
    a.template_id,
    a.employee_id,
    COUNT(g.id) as total_goals,
    COUNT(CASE WHEN e.employee_submitted_at IS NOT NULL THEN 1 END) as submitted_goals,
    COUNT(CASE WHEN e.manager_evaluated_at IS NOT NULL THEN 1 END) as evaluated_goals,
    MIN(e.employee_submitted_at) as first_submission,
    MAX(e.manager_evaluated_at) as last_evaluation
  FROM kra_assignments a
  JOIN kra_goals g ON g.template_id = a.template_id
  LEFT JOIN kra_evaluations e ON e.assignment_id = a.id AND e.goal_id = g.id
  GROUP BY a.id, a.status, a.template_id, a.employee_id
)
UPDATE kra_assignments 
SET 
  status = CASE
    WHEN asf.evaluated_goals = asf.total_goals AND asf.evaluated_goals > 0 THEN 'evaluated'
    WHEN asf.submitted_goals = asf.total_goals AND asf.submitted_goals > 0 THEN 'submitted'
    WHEN asf.submitted_goals > 0 THEN 'in_progress'
    ELSE 'assigned'
  END,
  submitted_at = CASE
    WHEN asf.submitted_goals = asf.total_goals AND asf.submitted_goals > 0 
         AND submitted_at IS NULL THEN asf.first_submission
    ELSE submitted_at
  END,
  submitted_by = CASE
    WHEN asf.submitted_goals = asf.total_goals AND asf.submitted_goals > 0 
         AND submitted_by IS NULL THEN asf.employee_id
    ELSE submitted_by
  END,
  evaluated_at = CASE
    WHEN asf.evaluated_goals = asf.total_goals AND asf.evaluated_goals > 0
         AND evaluated_at IS NULL THEN asf.last_evaluation
    ELSE evaluated_at
  END,
  updated_at = NOW()
FROM assignment_status_fixes asf
WHERE kra_assignments.id = asf.assignment_id
  AND (
    -- Only update if status needs to change
    (asf.evaluated_goals = asf.total_goals AND asf.evaluated_goals > 0 AND kra_assignments.status != 'evaluated') OR
    (asf.submitted_goals = asf.total_goals AND asf.submitted_goals > 0 AND asf.evaluated_goals < asf.total_goals AND kra_assignments.status != 'submitted') OR
    (asf.submitted_goals > 0 AND asf.submitted_goals < asf.total_goals AND kra_assignments.status NOT IN ('in_progress', 'submitted', 'evaluated')) OR
    (asf.submitted_goals = 0 AND kra_assignments.status != 'assigned')
  );

-- Create function to update assignment status when evaluations change
CREATE OR REPLACE FUNCTION update_kra_assignment_status()
RETURNS TRIGGER AS $$
DECLARE
  assignment_goals_count INTEGER;
  submitted_goals_count INTEGER;
  evaluated_goals_count INTEGER;
  assignment_rec RECORD;
BEGIN
  -- Get assignment record for context
  SELECT * INTO assignment_rec
  FROM kra_assignments 
  WHERE id = COALESCE(NEW.assignment_id, OLD.assignment_id);

  -- Get total number of goals in the assignment's template
  SELECT COUNT(*)
  INTO assignment_goals_count
  FROM kra_goals g
  WHERE g.template_id = assignment_rec.template_id;

  -- Get number of goals with employee submissions
  SELECT COUNT(*)
  INTO submitted_goals_count
  FROM kra_evaluations e
  WHERE e.assignment_id = COALESCE(NEW.assignment_id, OLD.assignment_id)
    AND e.employee_submitted_at IS NOT NULL;

  -- Get number of goals with manager evaluations
  SELECT COUNT(*)
  INTO evaluated_goals_count
  FROM kra_evaluations e
  WHERE e.assignment_id = COALESCE(NEW.assignment_id, OLD.assignment_id)
    AND e.manager_evaluated_at IS NOT NULL;

  -- Update assignment status based on completion
  UPDATE kra_assignments
  SET 
    status = CASE
      WHEN evaluated_goals_count = assignment_goals_count AND evaluated_goals_count > 0 THEN 'evaluated'
      WHEN submitted_goals_count = assignment_goals_count AND submitted_goals_count > 0 THEN 'submitted'
      WHEN submitted_goals_count > 0 THEN 'in_progress'
      ELSE 'assigned'
    END,
    submitted_at = CASE
      WHEN submitted_goals_count = assignment_goals_count AND submitted_goals_count > 0 
           AND submitted_at IS NULL THEN (
             SELECT MIN(employee_submitted_at) 
             FROM kra_evaluations 
             WHERE assignment_id = COALESCE(NEW.assignment_id, OLD.assignment_id)
               AND employee_submitted_at IS NOT NULL
           )
      ELSE submitted_at
    END,
    submitted_by = CASE
      WHEN submitted_goals_count = assignment_goals_count AND submitted_goals_count > 0 
           AND submitted_by IS NULL THEN assignment_rec.employee_id
      ELSE submitted_by
    END,
    evaluated_at = CASE
      WHEN evaluated_goals_count = assignment_goals_count AND evaluated_goals_count > 0
           AND evaluated_at IS NULL THEN (
             SELECT MAX(manager_evaluated_at) 
             FROM kra_evaluations 
             WHERE assignment_id = COALESCE(NEW.assignment_id, OLD.assignment_id)
               AND manager_evaluated_at IS NOT NULL
           )
      ELSE evaluated_at
    END,
    evaluated_by = CASE
      WHEN evaluated_goals_count = assignment_goals_count AND evaluated_goals_count > 0
           AND evaluated_by IS NULL THEN (
             SELECT manager_evaluated_by 
             FROM kra_evaluations 
             WHERE assignment_id = COALESCE(NEW.assignment_id, OLD.assignment_id)
               AND manager_evaluated_at IS NOT NULL
             LIMIT 1
           )
      ELSE evaluated_by
    END,
    updated_at = NOW()
  WHERE id = COALESCE(NEW.assignment_id, OLD.assignment_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_kra_assignment_status ON kra_evaluations;

-- Create trigger to update assignment status
CREATE TRIGGER trigger_update_kra_assignment_status
  AFTER INSERT OR UPDATE OR DELETE ON kra_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION update_kra_assignment_status();

-- Add comment explaining the trigger
COMMENT ON FUNCTION update_kra_assignment_status() IS 
'Automatically updates KRA assignment status based on evaluation completion:
- assigned: No evaluations submitted
- in_progress: Some evaluations submitted but not all
- submitted: All evaluations submitted by employee
- evaluated: All evaluations completed by manager';

COMMENT ON TRIGGER trigger_update_kra_assignment_status ON kra_evaluations IS 
'Triggers assignment status updates when evaluations are inserted, updated, or deleted';
