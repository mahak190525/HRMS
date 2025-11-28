/*
  # Fix PGRST116 Errors in KRA System
  
  This migration addresses PGRST116 "Cannot coerce the result to a single JSON object" 
  errors that occur when .single() is called on queries that return 0 rows.
  
  The fix involves updating frontend code to properly handle these cases, but we also
  need to ensure database functions handle missing records gracefully.
*/

-- Add helper function to safely get single records with fallback
CREATE OR REPLACE FUNCTION safe_get_single_record(
  table_name text,
  select_clause text,
  where_clause text,
  fallback_value jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
  query_text text;
BEGIN
  -- Build the query dynamically
  query_text := format('SELECT row_to_json(t) FROM (%s) t WHERE %s', 
                      format('SELECT %s FROM %I', select_clause, table_name),
                      where_clause);
  
  -- Execute and handle no results
  BEGIN
    EXECUTE query_text INTO result;
    
    IF result IS NULL THEN
      RETURN fallback_value;
    END IF;
    
    RETURN result;
  EXCEPTION 
    WHEN NO_DATA_FOUND THEN
      RETURN fallback_value;
    WHEN OTHERS THEN
      RAISE WARNING 'Error in safe_get_single_record: %', SQLERRM;
      RETURN fallback_value;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON FUNCTION safe_get_single_record(text, text, text, jsonb) IS 'Safely gets a single record with fallback for missing data - prevents PGRST116 errors';

-- Log completion
SELECT 'PGRST116 error prevention functions created! ✅' as status;
