/*
  # Fix Overall KRA Assignment Status

  This migration adds logic to update the main assignment status based on quarterly completion.
  
  The issue: Quarterly statuses (q1_status, q2_status, etc.) are updated correctly, 
  but the main assignment status remains "in_progress" even when all quarters are evaluated.
  
  Solution: Add a trigger to update the overall assignment status when quarterly statuses change.
*/

-- Function to update overall assignment status based on quarterly completion
CREATE OR REPLACE FUNCTION update_overall_assignment_status()
RETURNS TRIGGER AS $$
DECLARE
  enabled_quarters INTEGER := 0;
  evaluated_quarters INTEGER := 0;
  submitted_quarters INTEGER := 0;
  in_progress_quarters INTEGER := 0;
  new_status TEXT;
  latest_evaluated_at TIMESTAMPTZ;
  latest_evaluated_by UUID;
  latest_submitted_at TIMESTAMPTZ;
  latest_submitted_by UUID;
BEGIN
  -- Count enabled quarters and their statuses
  IF NEW.q1_enabled THEN
    enabled_quarters := enabled_quarters + 1;
    IF NEW.q1_status = 'evaluated' THEN
      evaluated_quarters := evaluated_quarters + 1;
    ELSIF NEW.q1_status = 'submitted' THEN
      submitted_quarters := submitted_quarters + 1;
    ELSIF NEW.q1_status = 'in_progress' THEN
      in_progress_quarters := in_progress_quarters + 1;
    END IF;
  END IF;
  
  IF NEW.q2_enabled THEN
    enabled_quarters := enabled_quarters + 1;
    IF NEW.q2_status = 'evaluated' THEN
      evaluated_quarters := evaluated_quarters + 1;
    ELSIF NEW.q2_status = 'submitted' THEN
      submitted_quarters := submitted_quarters + 1;
    ELSIF NEW.q2_status = 'in_progress' THEN
      in_progress_quarters := in_progress_quarters + 1;
    END IF;
  END IF;
  
  IF NEW.q3_enabled THEN
    enabled_quarters := enabled_quarters + 1;
    IF NEW.q3_status = 'evaluated' THEN
      evaluated_quarters := evaluated_quarters + 1;
    ELSIF NEW.q3_status = 'submitted' THEN
      submitted_quarters := submitted_quarters + 1;
    ELSIF NEW.q3_status = 'in_progress' THEN
      in_progress_quarters := in_progress_quarters + 1;
    END IF;
  END IF;
  
  IF NEW.q4_enabled THEN
    enabled_quarters := enabled_quarters + 1;
    IF NEW.q4_status = 'evaluated' THEN
      evaluated_quarters := evaluated_quarters + 1;
    ELSIF NEW.q4_status = 'submitted' THEN
      submitted_quarters := submitted_quarters + 1;
    ELSIF NEW.q4_status = 'in_progress' THEN
      in_progress_quarters := in_progress_quarters + 1;
    END IF;
  END IF;
  
  -- Determine overall status based on quarterly completion
  IF enabled_quarters = 0 THEN
    new_status := 'assigned';
  ELSIF evaluated_quarters = enabled_quarters AND enabled_quarters > 0 THEN
    new_status := 'evaluated';
    -- Get the latest evaluation timestamp and evaluator
    SELECT 
      GREATEST(
        COALESCE(NEW.q1_evaluated_at, '1900-01-01'::timestamptz),
        COALESCE(NEW.q2_evaluated_at, '1900-01-01'::timestamptz),
        COALESCE(NEW.q3_evaluated_at, '1900-01-01'::timestamptz),
        COALESCE(NEW.q4_evaluated_at, '1900-01-01'::timestamptz)
      )
    INTO latest_evaluated_at;
    
    -- Get the evaluator from the most recent evaluation
    IF NEW.q4_evaluated_at = latest_evaluated_at THEN
      latest_evaluated_by := NEW.q4_evaluated_by;
    ELSIF NEW.q3_evaluated_at = latest_evaluated_at THEN
      latest_evaluated_by := NEW.q3_evaluated_by;
    ELSIF NEW.q2_evaluated_at = latest_evaluated_at THEN
      latest_evaluated_by := NEW.q2_evaluated_by;
    ELSE
      latest_evaluated_by := NEW.q1_evaluated_by;
    END IF;
  ELSIF submitted_quarters = enabled_quarters AND enabled_quarters > 0 THEN
    new_status := 'submitted';
    -- Get the latest submission timestamp and submitter
    SELECT 
      GREATEST(
        COALESCE(NEW.q1_submitted_at, '1900-01-01'::timestamptz),
        COALESCE(NEW.q2_submitted_at, '1900-01-01'::timestamptz),
        COALESCE(NEW.q3_submitted_at, '1900-01-01'::timestamptz),
        COALESCE(NEW.q4_submitted_at, '1900-01-01'::timestamptz)
      )
    INTO latest_submitted_at;
    
    -- Get the submitter from the most recent submission
    IF NEW.q4_submitted_at = latest_submitted_at THEN
      latest_submitted_by := NEW.q4_submitted_by;
    ELSIF NEW.q3_submitted_at = latest_submitted_at THEN
      latest_submitted_by := NEW.q3_submitted_by;
    ELSIF NEW.q2_submitted_at = latest_submitted_at THEN
      latest_submitted_by := NEW.q2_submitted_by;
    ELSE
      latest_submitted_by := NEW.q1_submitted_by;
    END IF;
  ELSIF (submitted_quarters + evaluated_quarters + in_progress_quarters) > 0 THEN
    new_status := 'in_progress';
  ELSE
    new_status := 'assigned';
  END IF;
  
  -- Update the main assignment status if it has changed
  IF NEW.status != new_status THEN
    NEW.status := new_status;
    NEW.updated_at := now();
    
    -- Update evaluation fields if status is evaluated
    IF new_status = 'evaluated' THEN
      NEW.evaluated_at := latest_evaluated_at;
      NEW.evaluated_by := latest_evaluated_by;
    END IF;
    
    -- Update submission fields if status is submitted
    IF new_status = 'submitted' THEN
      NEW.submitted_at := latest_submitted_at;
      NEW.submitted_by := latest_submitted_by;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update overall status when quarterly data changes
DROP TRIGGER IF EXISTS trigger_update_overall_assignment_status ON kra_assignments;
CREATE TRIGGER trigger_update_overall_assignment_status
  BEFORE UPDATE ON kra_assignments
  FOR EACH ROW
  WHEN (
    OLD.q1_status IS DISTINCT FROM NEW.q1_status OR
    OLD.q2_status IS DISTINCT FROM NEW.q2_status OR
    OLD.q3_status IS DISTINCT FROM NEW.q3_status OR
    OLD.q4_status IS DISTINCT FROM NEW.q4_status OR
    OLD.q1_enabled IS DISTINCT FROM NEW.q1_enabled OR
    OLD.q2_enabled IS DISTINCT FROM NEW.q2_enabled OR
    OLD.q3_enabled IS DISTINCT FROM NEW.q3_enabled OR
    OLD.q4_enabled IS DISTINCT FROM NEW.q4_enabled
  )
  EXECUTE FUNCTION update_overall_assignment_status();

-- Fix existing assignments that have incorrect status
UPDATE kra_assignments 
SET updated_at = now() -- This will trigger the status update
WHERE id IN (
  SELECT id FROM kra_assignments a
  WHERE (
    -- All enabled quarters are evaluated but status is not 'evaluated'
    (
      (NOT a.q1_enabled OR a.q1_status = 'evaluated') AND
      (NOT a.q2_enabled OR a.q2_status = 'evaluated') AND
      (NOT a.q3_enabled OR a.q3_status = 'evaluated') AND
      (NOT a.q4_enabled OR a.q4_status = 'evaluated') AND
      (a.q1_enabled OR a.q2_enabled OR a.q3_enabled OR a.q4_enabled) AND
      a.status != 'evaluated'
    )
    OR
    -- All enabled quarters are submitted but status is not 'submitted'
    (
      (NOT a.q1_enabled OR a.q1_status = 'submitted') AND
      (NOT a.q2_enabled OR a.q2_status = 'submitted') AND
      (NOT a.q3_enabled OR a.q3_status = 'submitted') AND
      (NOT a.q4_enabled OR a.q4_status = 'submitted') AND
      (a.q1_enabled OR a.q2_enabled OR a.q3_enabled OR a.q4_enabled) AND
      a.status != 'submitted' AND
      NOT (
        (a.q1_enabled AND a.q1_status = 'evaluated') OR
        (a.q2_enabled AND a.q2_status = 'evaluated') OR
        (a.q3_enabled AND a.q3_status = 'evaluated') OR
        (a.q4_enabled AND a.q4_status = 'evaluated')
      )
    )
  )
);

-- Add helpful comments
COMMENT ON FUNCTION update_overall_assignment_status() IS 'Updates the main assignment status based on quarterly completion status';
COMMENT ON TRIGGER trigger_update_overall_assignment_status ON kra_assignments IS 'Triggers overall status update when quarterly statuses change';
