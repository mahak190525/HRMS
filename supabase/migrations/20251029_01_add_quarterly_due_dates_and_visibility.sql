/*
  # Add Quarterly Due Dates and Visibility Controls

  This migration adds:
  1. Quarterly due dates for each assignment (employee-specific)
  2. Quarterly visibility controls (checkboxes) to enable/disable evidence submission per quarter
*/

-- Function to safely add column if it doesn't exist
CREATE OR REPLACE FUNCTION add_column_if_not_exists_v2(
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

-- Add quarterly due dates to kra_assignments (employee-specific due dates)
SELECT add_column_if_not_exists_v2('kra_assignments', 'q1_due_date', 'date');
SELECT add_column_if_not_exists_v2('kra_assignments', 'q2_due_date', 'date');
SELECT add_column_if_not_exists_v2('kra_assignments', 'q3_due_date', 'date');
SELECT add_column_if_not_exists_v2('kra_assignments', 'q4_due_date', 'date');

-- Add quarterly visibility controls (checkboxes to enable evidence submission)
SELECT add_column_if_not_exists_v2('kra_assignments', 'q1_enabled', 'boolean DEFAULT false');
SELECT add_column_if_not_exists_v2('kra_assignments', 'q2_enabled', 'boolean DEFAULT false');
SELECT add_column_if_not_exists_v2('kra_assignments', 'q3_enabled', 'boolean DEFAULT false');
SELECT add_column_if_not_exists_v2('kra_assignments', 'q4_enabled', 'boolean DEFAULT false');

-- Add quarterly evidence visibility timestamps (when each quarter was enabled)
SELECT add_column_if_not_exists_v2('kra_assignments', 'q1_enabled_at', 'timestamptz');
SELECT add_column_if_not_exists_v2('kra_assignments', 'q2_enabled_at', 'timestamptz');
SELECT add_column_if_not_exists_v2('kra_assignments', 'q3_enabled_at', 'timestamptz');
SELECT add_column_if_not_exists_v2('kra_assignments', 'q4_enabled_at', 'timestamptz');

-- Add quarterly evidence visibility enabled by (who enabled each quarter)
SELECT add_column_if_not_exists_v2('kra_assignments', 'q1_enabled_by', 'uuid REFERENCES users(id)');
SELECT add_column_if_not_exists_v2('kra_assignments', 'q2_enabled_by', 'uuid REFERENCES users(id)');
SELECT add_column_if_not_exists_v2('kra_assignments', 'q3_enabled_by', 'uuid REFERENCES users(id)');
SELECT add_column_if_not_exists_v2('kra_assignments', 'q4_enabled_by', 'uuid REFERENCES users(id)');

-- Create indexes for better performance on new fields
DO $$
BEGIN
    -- Due date indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kra_assignments_q1_due_date') THEN
        CREATE INDEX idx_kra_assignments_q1_due_date ON kra_assignments(q1_due_date);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kra_assignments_q2_due_date') THEN
        CREATE INDEX idx_kra_assignments_q2_due_date ON kra_assignments(q2_due_date);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kra_assignments_q3_due_date') THEN
        CREATE INDEX idx_kra_assignments_q3_due_date ON kra_assignments(q3_due_date);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kra_assignments_q4_due_date') THEN
        CREATE INDEX idx_kra_assignments_q4_due_date ON kra_assignments(q4_due_date);
    END IF;
    
    -- Enabled status indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kra_assignments_q1_enabled') THEN
        CREATE INDEX idx_kra_assignments_q1_enabled ON kra_assignments(q1_enabled);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kra_assignments_q2_enabled') THEN
        CREATE INDEX idx_kra_assignments_q2_enabled ON kra_assignments(q2_enabled);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kra_assignments_q3_enabled') THEN
        CREATE INDEX idx_kra_assignments_q3_enabled ON kra_assignments(q3_enabled);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kra_assignments_q4_enabled') THEN
        CREATE INDEX idx_kra_assignments_q4_enabled ON kra_assignments(q4_enabled);
    END IF;
END $$;

-- Create function to automatically update quarterly status when enabled/disabled
CREATE OR REPLACE FUNCTION update_quarterly_enabled_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Q1 enabled status change
    IF OLD.q1_enabled IS DISTINCT FROM NEW.q1_enabled THEN
        IF NEW.q1_enabled = true THEN
            NEW.q1_enabled_at := now();
            -- If no status set yet, set to not_started
            IF NEW.q1_status IS NULL THEN
                NEW.q1_status := 'not_started';
            END IF;
        ELSE
            NEW.q1_enabled_at := NULL;
        END IF;
    END IF;
    
    -- Q2 enabled status change
    IF OLD.q2_enabled IS DISTINCT FROM NEW.q2_enabled THEN
        IF NEW.q2_enabled = true THEN
            NEW.q2_enabled_at := now();
            IF NEW.q2_status IS NULL THEN
                NEW.q2_status := 'not_started';
            END IF;
        ELSE
            NEW.q2_enabled_at := NULL;
        END IF;
    END IF;
    
    -- Q3 enabled status change
    IF OLD.q3_enabled IS DISTINCT FROM NEW.q3_enabled THEN
        IF NEW.q3_enabled = true THEN
            NEW.q3_enabled_at := now();
            IF NEW.q3_status IS NULL THEN
                NEW.q3_status := 'not_started';
            END IF;
        ELSE
            NEW.q3_enabled_at := NULL;
        END IF;
    END IF;
    
    -- Q4 enabled status change
    IF OLD.q4_enabled IS DISTINCT FROM NEW.q4_enabled THEN
        IF NEW.q4_enabled = true THEN
            NEW.q4_enabled_at := now();
            IF NEW.q4_status IS NULL THEN
                NEW.q4_status := 'not_started';
            END IF;
        ELSE
            NEW.q4_enabled_at := NULL;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for quarterly enabled status updates
DROP TRIGGER IF EXISTS trigger_update_quarterly_enabled_status ON kra_assignments;
CREATE TRIGGER trigger_update_quarterly_enabled_status
  BEFORE UPDATE ON kra_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_quarterly_enabled_status();

-- Add helpful comments
COMMENT ON COLUMN kra_assignments.q1_due_date IS 'Due date for Q1 evaluation submission (employee-specific)';
COMMENT ON COLUMN kra_assignments.q2_due_date IS 'Due date for Q2 evaluation submission (employee-specific)';
COMMENT ON COLUMN kra_assignments.q3_due_date IS 'Due date for Q3 evaluation submission (employee-specific)';
COMMENT ON COLUMN kra_assignments.q4_due_date IS 'Due date for Q4 evaluation submission (employee-specific)';

COMMENT ON COLUMN kra_assignments.q1_enabled IS 'Whether Q1 evidence submission is enabled for the employee';
COMMENT ON COLUMN kra_assignments.q2_enabled IS 'Whether Q2 evidence submission is enabled for the employee';
COMMENT ON COLUMN kra_assignments.q3_enabled IS 'Whether Q3 evidence submission is enabled for the employee';
COMMENT ON COLUMN kra_assignments.q4_enabled IS 'Whether Q4 evidence submission is enabled for the employee';

COMMENT ON COLUMN kra_assignments.q1_enabled_at IS 'When Q1 evidence submission was enabled';
COMMENT ON COLUMN kra_assignments.q2_enabled_at IS 'When Q2 evidence submission was enabled';
COMMENT ON COLUMN kra_assignments.q3_enabled_at IS 'When Q3 evidence submission was enabled';
COMMENT ON COLUMN kra_assignments.q4_enabled_at IS 'When Q4 evidence submission was enabled';

COMMENT ON COLUMN kra_assignments.q1_enabled_by IS 'Who enabled Q1 evidence submission';
COMMENT ON COLUMN kra_assignments.q2_enabled_by IS 'Who enabled Q2 evidence submission';
COMMENT ON COLUMN kra_assignments.q3_enabled_by IS 'Who enabled Q3 evidence submission';
COMMENT ON COLUMN kra_assignments.q4_enabled_by IS 'Who enabled Q4 evidence submission';

-- Initialize existing assignments with Q1 enabled by default (for backward compatibility)
UPDATE kra_assignments 
SET 
    q1_enabled = true,
    q1_enabled_at = created_at,
    q1_enabled_by = assigned_by,
    -- Copy template due dates to assignment due dates if template has them
    q1_due_date = COALESCE(
        (SELECT q1_due_date FROM kra_templates WHERE id = kra_assignments.template_id),
        due_date
    ),
    q2_due_date = (SELECT q2_due_date FROM kra_templates WHERE id = kra_assignments.template_id),
    q3_due_date = (SELECT q3_due_date FROM kra_templates WHERE id = kra_assignments.template_id),
    q4_due_date = (SELECT q4_due_date FROM kra_templates WHERE id = kra_assignments.template_id)
WHERE q1_enabled IS NULL;

-- Clean up the helper function
DROP FUNCTION add_column_if_not_exists_v2(text, text, text);
