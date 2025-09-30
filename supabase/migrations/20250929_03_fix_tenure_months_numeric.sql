DROP FUNCTION IF EXISTS get_tenure_months;

-- Update get_tenure_months function to return numeric instead of integer
CREATE OR REPLACE FUNCTION get_tenure_months(joining_date date)
RETURNS numeric AS $$
BEGIN
    RETURN EXTRACT(YEAR FROM age(CURRENT_DATE, joining_date)) * 12 + 
           EXTRACT(MONTH FROM age(CURRENT_DATE, joining_date))::numeric;
END;
$$ LANGUAGE plpgsql;