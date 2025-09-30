-- Update KRA marks fields from numeric to text for descriptive criteria
-- Marks should contain text descriptions like "100% on-time sprint delivery" 
-- while Points contain the actual numeric scores

-- Update kra_goals table to change marks fields from numeric to text
ALTER TABLE kra_goals 
  ALTER COLUMN level_1_marks TYPE text,
  ALTER COLUMN level_2_marks TYPE text,
  ALTER COLUMN level_3_marks TYPE text,
  ALTER COLUMN level_4_marks TYPE text,
  ALTER COLUMN level_5_marks TYPE text;

-- Add helpful comments
COMMENT ON COLUMN kra_goals.level_1_marks IS 'Text description of criteria for level 1 performance (e.g., "50%-<65% on-time sprint delivery")';
COMMENT ON COLUMN kra_goals.level_2_marks IS 'Text description of criteria for level 2 performance (e.g., "65%-<80% on-time sprint delivery")';
COMMENT ON COLUMN kra_goals.level_3_marks IS 'Text description of criteria for level 3 performance (e.g., "80%-<95% on-time sprint delivery")';
COMMENT ON COLUMN kra_goals.level_4_marks IS 'Text description of criteria for level 4 performance (e.g., "95%-<100% on-time sprint delivery")';
COMMENT ON COLUMN kra_goals.level_5_marks IS 'Text description of criteria for level 5 performance (e.g., "100% on-time sprint delivery")';

-- Update any existing numeric values to empty strings (since they won't make sense as criteria)
UPDATE kra_goals 
SET 
  level_1_marks = '',
  level_2_marks = '',
  level_3_marks = '',
  level_4_marks = '',
  level_5_marks = ''
WHERE 
  level_1_marks ~ '^[0-9]+(\.[0-9]+)?$' OR
  level_2_marks ~ '^[0-9]+(\.[0-9]+)?$' OR
  level_3_marks ~ '^[0-9]+(\.[0-9]+)?$' OR
  level_4_marks ~ '^[0-9]+(\.[0-9]+)?$' OR
  level_5_marks ~ '^[0-9]+(\.[0-9]+)?$';

-- Add helpful comment
COMMENT ON TABLE kra_goals IS 
'KRA Goals table where marks contain descriptive criteria text and points contain numeric scores';
