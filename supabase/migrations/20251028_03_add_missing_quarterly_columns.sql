/*
  # Add Missing Quarterly Columns (Safe Migration)

  This migration safely adds only the columns that are missing for quarterly KRA support.
  It checks for existence before adding each column to avoid conflicts.
*/

-- Function to safely add column if it doesn't exist
CREATE OR REPLACE FUNCTION add_column_if_not_exists(
    p_table_name text,
    p_column_name text,
    p_column_definition text
) RETURNS void AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_name = p_table_name 
        AND c.column_name = p_column_name
        AND c.table_schema = 'public'
    ) THEN
        EXECUTE format('ALTER TABLE %I ADD COLUMN %I %s', p_table_name, p_column_name, p_column_definition);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Add quarterly submission tracking columns to kra_assignments
SELECT add_column_if_not_exists('kra_assignments', 'q1_submitted_at', 'timestamptz');
SELECT add_column_if_not_exists('kra_assignments', 'q1_submitted_by', 'uuid REFERENCES users(id)');
SELECT add_column_if_not_exists('kra_assignments', 'q1_evaluated_at', 'timestamptz');
SELECT add_column_if_not_exists('kra_assignments', 'q1_evaluated_by', 'uuid REFERENCES users(id)');
SELECT add_column_if_not_exists('kra_assignments', 'q2_submitted_at', 'timestamptz');
SELECT add_column_if_not_exists('kra_assignments', 'q2_submitted_by', 'uuid REFERENCES users(id)');
SELECT add_column_if_not_exists('kra_assignments', 'q2_evaluated_at', 'timestamptz');
SELECT add_column_if_not_exists('kra_assignments', 'q2_evaluated_by', 'uuid REFERENCES users(id)');
SELECT add_column_if_not_exists('kra_assignments', 'q3_submitted_at', 'timestamptz');
SELECT add_column_if_not_exists('kra_assignments', 'q3_submitted_by', 'uuid REFERENCES users(id)');
SELECT add_column_if_not_exists('kra_assignments', 'q3_evaluated_at', 'timestamptz');
SELECT add_column_if_not_exists('kra_assignments', 'q3_evaluated_by', 'uuid REFERENCES users(id)');
SELECT add_column_if_not_exists('kra_assignments', 'q4_submitted_at', 'timestamptz');
SELECT add_column_if_not_exists('kra_assignments', 'q4_submitted_by', 'uuid REFERENCES users(id)');
SELECT add_column_if_not_exists('kra_assignments', 'q4_evaluated_at', 'timestamptz');
SELECT add_column_if_not_exists('kra_assignments', 'q4_evaluated_by', 'uuid REFERENCES users(id)');

-- Add quarterly scores columns to kra_assignments
SELECT add_column_if_not_exists('kra_assignments', 'q1_total_score', 'numeric(7,2) DEFAULT 0');
SELECT add_column_if_not_exists('kra_assignments', 'q1_total_possible_score', 'numeric(7,2) DEFAULT 0');
SELECT add_column_if_not_exists('kra_assignments', 'q1_overall_percentage', 'numeric(5,2) DEFAULT 0');
SELECT add_column_if_not_exists('kra_assignments', 'q1_overall_rating', 'text');
SELECT add_column_if_not_exists('kra_assignments', 'q2_total_score', 'numeric(7,2) DEFAULT 0');
SELECT add_column_if_not_exists('kra_assignments', 'q2_total_possible_score', 'numeric(7,2) DEFAULT 0');
SELECT add_column_if_not_exists('kra_assignments', 'q2_overall_percentage', 'numeric(5,2) DEFAULT 0');
SELECT add_column_if_not_exists('kra_assignments', 'q2_overall_rating', 'text');
SELECT add_column_if_not_exists('kra_assignments', 'q3_total_score', 'numeric(7,2) DEFAULT 0');
SELECT add_column_if_not_exists('kra_assignments', 'q3_total_possible_score', 'numeric(7,2) DEFAULT 0');
SELECT add_column_if_not_exists('kra_assignments', 'q3_overall_percentage', 'numeric(5,2) DEFAULT 0');
SELECT add_column_if_not_exists('kra_assignments', 'q3_overall_rating', 'text');
SELECT add_column_if_not_exists('kra_assignments', 'q4_total_score', 'numeric(7,2) DEFAULT 0');
SELECT add_column_if_not_exists('kra_assignments', 'q4_total_possible_score', 'numeric(7,2) DEFAULT 0');
SELECT add_column_if_not_exists('kra_assignments', 'q4_overall_percentage', 'numeric(5,2) DEFAULT 0');
SELECT add_column_if_not_exists('kra_assignments', 'q4_overall_rating', 'text');

-- Add annual summary columns to kra_assignments
SELECT add_column_if_not_exists('kra_assignments', 'annual_average_score', 'numeric(7,2) DEFAULT 0');
SELECT add_column_if_not_exists('kra_assignments', 'annual_average_percentage', 'numeric(5,2) DEFAULT 0');
SELECT add_column_if_not_exists('kra_assignments', 'annual_overall_rating', 'text');
SELECT add_column_if_not_exists('kra_assignments', 'completed_quarters', 'integer DEFAULT 0 CHECK (completed_quarters >= 0 AND completed_quarters <= 4)');

-- Add quarterly due dates to kra_templates
SELECT add_column_if_not_exists('kra_templates', 'q1_due_date', 'date');
SELECT add_column_if_not_exists('kra_templates', 'q2_due_date', 'date');
SELECT add_column_if_not_exists('kra_templates', 'q3_due_date', 'date');
SELECT add_column_if_not_exists('kra_templates', 'q4_due_date', 'date');

-- Create indexes if they don't exist
DO $$
BEGIN
    -- Check and create indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kra_evaluations_quarter') THEN
        CREATE INDEX idx_kra_evaluations_quarter ON kra_evaluations(quarter);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kra_evaluations_assignment_quarter') THEN
        CREATE INDEX idx_kra_evaluations_assignment_quarter ON kra_evaluations(assignment_id, quarter);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kra_assignments_q1_status') THEN
        CREATE INDEX idx_kra_assignments_q1_status ON kra_assignments(q1_status);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kra_assignments_q2_status') THEN
        CREATE INDEX idx_kra_assignments_q2_status ON kra_assignments(q2_status);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kra_assignments_q3_status') THEN
        CREATE INDEX idx_kra_assignments_q3_status ON kra_assignments(q3_status);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kra_assignments_q4_status') THEN
        CREATE INDEX idx_kra_assignments_q4_status ON kra_assignments(q4_status);
    END IF;
END $$;

-- Update existing evaluations to have Q1 as default quarter (only if quarter is null)
UPDATE kra_evaluations SET quarter = 'Q1' WHERE quarter IS NULL;

-- Update existing assignments to reflect current status in Q1 (only if q1_status is null)
UPDATE kra_assignments 
SET 
  q1_status = CASE 
    WHEN status = 'assigned' THEN 'not_started'
    WHEN status = 'in_progress' THEN 'in_progress'
    WHEN status = 'submitted' THEN 'submitted'
    WHEN status = 'evaluated' OR status = 'approved' THEN 'evaluated'
    ELSE 'not_started'
  END,
  q1_submitted_at = submitted_at,
  q1_submitted_by = submitted_by,
  q1_evaluated_at = evaluated_at,
  q1_evaluated_by = evaluated_by,
  q1_total_score = total_score,
  q1_total_possible_score = total_possible_score,
  q1_overall_percentage = overall_percentage,
  q1_overall_rating = overall_rating,
  completed_quarters = CASE 
    WHEN status = 'evaluated' OR status = 'approved' THEN 1
    ELSE 0
  END
WHERE q1_status IS NULL;

-- Add helpful comments
COMMENT ON COLUMN kra_evaluations.quarter IS 'Quarter for this evaluation (Q1, Q2, Q3, Q4)';
COMMENT ON COLUMN kra_assignments.q1_status IS 'Status of Q1 evaluation (not_started, in_progress, submitted, evaluated)';
COMMENT ON COLUMN kra_assignments.q2_status IS 'Status of Q2 evaluation (not_started, in_progress, submitted, evaluated)';
COMMENT ON COLUMN kra_assignments.q3_status IS 'Status of Q3 evaluation (not_started, in_progress, submitted, evaluated)';
COMMENT ON COLUMN kra_assignments.q4_status IS 'Status of Q4 evaluation (not_started, in_progress, submitted, evaluated)';
COMMENT ON COLUMN kra_assignments.annual_average_score IS 'Average score across all completed quarters';
COMMENT ON COLUMN kra_assignments.completed_quarters IS 'Number of quarters that have been evaluated';

-- Clean up the helper function
DROP FUNCTION add_column_if_not_exists(text, text, text);
