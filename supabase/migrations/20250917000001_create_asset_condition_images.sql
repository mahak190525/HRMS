-- Create asset condition images table for quarterly hardware asset image uploads
CREATE TABLE IF NOT EXISTS asset_condition_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_assignment_id uuid NOT NULL REFERENCES asset_assignments(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  upload_quarter integer NOT NULL CHECK (upload_quarter BETWEEN 1 AND 4),
  upload_year integer NOT NULL,
  uploaded_at timestamptz DEFAULT now(),
  image_size_bytes integer,
  image_filename text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Ensure unique combinations of assignment, quarter, and year for each image
  UNIQUE(asset_assignment_id, image_url),
  
  -- Add constraint for valid years
  CONSTRAINT valid_upload_year CHECK (upload_year >= 2020 AND upload_year <= 2100)
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_asset_condition_images_assignment ON asset_condition_images(asset_assignment_id);
CREATE INDEX IF NOT EXISTS idx_asset_condition_images_quarter_year ON asset_condition_images(upload_quarter, upload_year);
CREATE INDEX IF NOT EXISTS idx_asset_condition_images_user ON asset_condition_images(user_id);

-- Disable RLS since we're using custom authentication (not Supabase auth schema)
-- Authorization will be handled at the application level with validation functions
ALTER TABLE asset_condition_images DISABLE ROW LEVEL SECURITY;

-- Create function to get current quarter
CREATE OR REPLACE FUNCTION get_current_quarter()
RETURNS integer AS $$
BEGIN
  RETURN EXTRACT(QUARTER FROM CURRENT_DATE);
END;
$$ LANGUAGE plpgsql;

-- Create function to check if user needs to upload quarterly images
CREATE OR REPLACE FUNCTION check_quarterly_upload_needed(p_user_id uuid)
RETURNS TABLE (
  assignment_id uuid,
  asset_id uuid,
  asset_name text,
  asset_tag text,
  current_quarter integer,
  current_year integer,
  images_uploaded integer,
  max_images_allowed integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    aa.id as assignment_id,
    aa.asset_id,
    a.name as asset_name,
    a.asset_tag,
    get_current_quarter() as current_quarter,
    EXTRACT(YEAR FROM CURRENT_DATE)::integer as current_year,
    COALESCE(img_count.count, 0)::integer as images_uploaded,
    5 as max_images_allowed
  FROM asset_assignments aa
  INNER JOIN assets a ON aa.asset_id = a.id
  INNER JOIN asset_categories ac ON a.category_id = ac.id
  LEFT JOIN (
    SELECT 
      asset_assignment_id,
      COUNT(*) as count
    FROM asset_condition_images
    WHERE upload_quarter = get_current_quarter()
    AND upload_year = EXTRACT(YEAR FROM CURRENT_DATE)
    GROUP BY asset_assignment_id
  ) img_count ON aa.id = img_count.asset_assignment_id
  WHERE aa.user_id = p_user_id
  AND aa.is_active = true
  AND a.status = 'assigned'
  -- Only for hardware assets (excluding software categories)
  AND ac.name NOT ILIKE '%software%'
  AND ac.name NOT ILIKE '%license%'
  AND ac.name NOT ILIKE '%subscription%';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a comprehensive validation function for asset image operations
CREATE OR REPLACE FUNCTION validate_asset_image_permission(
  p_user_id uuid,
  p_assignment_id uuid,
  p_operation text DEFAULT 'upload'
) RETURNS TABLE (
  is_allowed boolean,
  error_message text,
  assignment_exists boolean,
  user_owns_assignment boolean,
  assignment_is_active boolean,
  is_hardware_asset boolean
) AS $$
DECLARE
  v_assignment_exists boolean := false;
  v_user_owns_assignment boolean := false;
  v_assignment_is_active boolean := false;
  v_is_hardware_asset boolean := false;
  v_category_name text;
BEGIN
  -- Check if assignment exists and get details
  SELECT 
    true,
    (aa.user_id = p_user_id),
    aa.is_active,
    ac.name
  INTO 
    v_assignment_exists,
    v_user_owns_assignment,
    v_assignment_is_active,
    v_category_name
  FROM asset_assignments aa
  INNER JOIN assets a ON aa.asset_id = a.id
  INNER JOIN asset_categories ac ON a.category_id = ac.id
  WHERE aa.id = p_assignment_id;

  -- Set default if no record found
  v_assignment_exists := COALESCE(v_assignment_exists, false);
  v_user_owns_assignment := COALESCE(v_user_owns_assignment, false);
  v_assignment_is_active := COALESCE(v_assignment_is_active, false);

  -- Check if it's a hardware asset (not software/license)
  v_is_hardware_asset := (
    v_category_name IS NOT NULL AND
    v_category_name NOT ILIKE '%software%' AND
    v_category_name NOT ILIKE '%license%' AND
    v_category_name NOT ILIKE '%subscription%'
  );

  -- Return validation result
  RETURN QUERY SELECT
    (v_assignment_exists AND v_user_owns_assignment AND v_assignment_is_active AND v_is_hardware_asset),
    CASE 
      WHEN NOT v_assignment_exists THEN 'Assignment not found'
      WHEN NOT v_user_owns_assignment THEN 'Assignment does not belong to user'
      WHEN NOT v_assignment_is_active THEN 'Assignment is not active'
      WHEN NOT v_is_hardware_asset THEN 'Only hardware assets require image uploads'
      ELSE 'Permission granted'
    END,
    v_assignment_exists,
    v_user_owns_assignment,
    v_assignment_is_active,
    v_is_hardware_asset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check quarterly upload limits
CREATE OR REPLACE FUNCTION check_quarterly_upload_limit(
  p_assignment_id uuid,
  p_quarter integer DEFAULT NULL,
  p_year integer DEFAULT NULL
) RETURNS TABLE (
  current_count integer,
  max_allowed integer,
  can_upload_more boolean,
  quarter_used integer,
  year_used integer
) AS $$
DECLARE
  v_quarter integer;
  v_year integer;
  v_count integer;
BEGIN
  -- Use provided quarter/year or current
  v_quarter := COALESCE(p_quarter, EXTRACT(QUARTER FROM CURRENT_DATE));
  v_year := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE));

  -- Count existing images for this assignment in this quarter
  SELECT COUNT(*)
  INTO v_count
  FROM asset_condition_images
  WHERE asset_assignment_id = p_assignment_id
    AND upload_quarter = v_quarter
    AND upload_year = v_year;

  RETURN QUERY SELECT
    v_count,
    5, -- max allowed
    (v_count < 5),
    v_quarter,
    v_year;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add new notification types for asset image uploads
DO $$
BEGIN
  -- Check if the constraint exists and drop it if it does
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'notifications_type_check' 
    AND table_name = 'notifications'
  ) THEN
    ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
  END IF;
  
  -- Add the new constraint with additional notification types
  ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
    CHECK (type = ANY (ARRAY[
      'general'::text, 
      'leave_request_submitted'::text, 
      'leave_request_approved'::text, 
      'leave_request_rejected'::text, 
      'leave_request_withdrawn'::text, 
      'complaint_submitted'::text, 
      'complaint_assigned'::text, 
      'complaint_resolved'::text, 
      'performance_goal_assigned'::text, 
      'interview_scheduled'::text, 
      'assessment_assigned'::text, 
      'exit_process_initiated'::text, 
      'document_approved'::text, 
      'document_rejected'::text, 
      'project_assigned'::text, 
      'project_unassigned'::text, 
      'project_role_updated'::text, 
      'project_deleted'::text, 
      'asset_request_submitted'::text, 
      'asset_request_approved'::text, 
      'asset_request_rejected'::text, 
      'asset_request_fulfilled'::text, 
      'asset_assigned'::text, 
      'asset_unassigned'::text, 
      'vm_assigned'::text, 
      'vm_unassigned'::text,
      'asset_quarterly_upload_reminder'::text,
      'asset_images_uploaded'::text,
      'asset_upload_overdue'::text
    ]));
END $$;
