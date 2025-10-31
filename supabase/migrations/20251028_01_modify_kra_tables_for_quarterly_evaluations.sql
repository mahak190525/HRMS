/*
  # Modify KRA Tables for Quarterly Evaluations

  This migration modifies the KRA system to support quarterly evaluations within a single annual assignment.
  
  ## Changes:
  1. Add quarter field to kra_evaluations table
  2. Modify kra_assignments to track quarterly submissions
  3. Update constraints and indexes for quarterly support
  4. Add quarterly summary fields to kra_assignments
  
  ## Benefits:
  - Managers handle 10 annual sheets instead of 40 quarterly sheets for 10 employees
  - Same goals for all quarters, different evaluations per quarter
  - Better year-long performance tracking
*/

-- Add quarter field to kra_evaluations table (if it doesn't exist)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'kra_evaluations' AND column_name = 'quarter') THEN
        ALTER TABLE kra_evaluations 
        ADD COLUMN quarter text CHECK (quarter IN ('Q1', 'Q2', 'Q3', 'Q4')) DEFAULT 'Q1';
    END IF;
END $$;

-- Update the unique constraint to include quarter
-- First drop the existing constraint if it exists
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE table_name = 'kra_evaluations' 
               AND constraint_name = 'kra_evaluations_assignment_id_goal_id_key') THEN
        ALTER TABLE kra_evaluations 
        DROP CONSTRAINT kra_evaluations_assignment_id_goal_id_key;
    END IF;
END $$;

-- Add new unique constraint including quarter (if it doesn't exist)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE table_name = 'kra_evaluations' 
                   AND constraint_name = 'kra_evaluations_assignment_id_goal_id_quarter_key') THEN
        ALTER TABLE kra_evaluations 
        ADD CONSTRAINT kra_evaluations_assignment_id_goal_id_quarter_key 
        UNIQUE (assignment_id, goal_id, quarter);
    END IF;
END $$;

-- Add quarterly tracking fields to kra_assignments (if they don't exist)
DO $$ 
BEGIN 
    -- Add quarterly status columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'kra_assignments' AND column_name = 'q1_status') THEN
        ALTER TABLE kra_assignments 
        ADD COLUMN q1_status text DEFAULT 'not_started' CHECK (q1_status IN ('not_started', 'in_progress', 'submitted', 'evaluated'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'kra_assignments' AND column_name = 'q2_status') THEN
        ALTER TABLE kra_assignments 
        ADD COLUMN q2_status text DEFAULT 'not_started' CHECK (q2_status IN ('not_started', 'in_progress', 'submitted', 'evaluated'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'kra_assignments' AND column_name = 'q3_status') THEN
        ALTER TABLE kra_assignments 
        ADD COLUMN q3_status text DEFAULT 'not_started' CHECK (q3_status IN ('not_started', 'in_progress', 'submitted', 'evaluated'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'kra_assignments' AND column_name = 'q4_status') THEN
        ALTER TABLE kra_assignments 
        ADD COLUMN q4_status text DEFAULT 'not_started' CHECK (q4_status IN ('not_started', 'in_progress', 'submitted', 'evaluated'));
    END IF;
END $$;

-- Skip quarterly submission tracking - will be handled by the safe migration file

-- Skip quarterly scores and other columns - will be handled by the safe migration file

-- Skip indexes - will be handled by the safe migration file

-- Skip comments and data updates - will be handled by the safe migration file

-- This migration now only handles:
-- 1. Adding quarter column to kra_evaluations (if not exists)
-- 2. Updating unique constraint for quarterly support
-- 3. Adding quarterly status columns to kra_assignments (if not exist)
-- All other columns, indexes, and data updates are handled by the safe migration file.
