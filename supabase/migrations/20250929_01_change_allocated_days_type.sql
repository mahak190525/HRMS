-- First, save the current view definition
CREATE OR REPLACE FUNCTION save_view_definition() RETURNS void AS $$
BEGIN
    CREATE TABLE IF NOT EXISTS temp_view_definitions AS SELECT current_timestamp, 
    pg_get_viewdef('leave_balances_enhanced'::regclass) as view_definition;
END;
$$ LANGUAGE plpgsql;

SELECT save_view_definition();

-- Drop the dependent view
DROP VIEW IF EXISTS leave_balances_enhanced;

-- Drop the generated column remaining_days
ALTER TABLE leave_balances
DROP COLUMN remaining_days;

-- Change allocated_days column type from int4 to numeric
ALTER TABLE leave_balances
ALTER COLUMN allocated_days TYPE numeric USING allocated_days::numeric;

-- Change used_days to numeric as well to maintain consistency
ALTER TABLE leave_balances
ALTER COLUMN used_days TYPE numeric USING used_days::numeric;

-- Recreate the remaining_days as a generated column
ALTER TABLE leave_balances
ADD COLUMN remaining_days numeric GENERATED ALWAYS AS (allocated_days - used_days) STORED;

-- Recreate the view using the saved definition
DO $$ 
BEGIN
    EXECUTE (
        SELECT view_definition 
        FROM temp_view_definitions 
        ORDER BY current_timestamp DESC 
        LIMIT 1
    );
END $$;

-- Clean up
DROP TABLE IF EXISTS temp_view_definitions;
DROP FUNCTION IF EXISTS save_view_definition();

-- Add comments to explain the changes
COMMENT ON COLUMN leave_balances.allocated_days IS 'Number of leave days allocated to the employee. Changed to numeric type to support half-day allocations.';
COMMENT ON COLUMN leave_balances.used_days IS 'Number of leave days used by the employee. Changed to numeric type to support half-day usage.';
COMMENT ON COLUMN leave_balances.remaining_days IS 'Generated column showing remaining leave days (allocated_days - used_days).';