-- Migration: Add role management statistics function
-- Created: 2025-12-01
-- Purpose: Support role management overview with statistics

-- Function to get role management statistics
CREATE OR REPLACE FUNCTION get_role_management_stats()
RETURNS TABLE (
  total_users bigint,
  users_with_additional_roles bigint,
  total_role_assignments bigint,
  most_common_additional_role text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT 
      COUNT(*) as total_users_count,
      COUNT(CASE WHEN additional_role_ids IS NOT NULL AND array_length(additional_role_ids, 1) > 0 THEN 1 END) as users_with_additional_count,
      COALESCE(SUM(array_length(additional_role_ids, 1)), 0) as total_assignments_count
    FROM users 
    WHERE status = 'active'
  ),
  most_common AS (
    SELECT r.name as role_name
    FROM users u
    CROSS JOIN LATERAL unnest(COALESCE(u.additional_role_ids, ARRAY[]::uuid[])) as role_id
    JOIN roles r ON r.id = role_id
    WHERE u.status = 'active'
    GROUP BY r.name
    ORDER BY COUNT(*) DESC
    LIMIT 1
  )
  SELECT 
    s.total_users_count,
    s.users_with_additional_count,
    s.total_assignments_count,
    COALESCE(mc.role_name, 'None') as most_common_role
  FROM stats s
  LEFT JOIN most_common mc ON true;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_role_management_stats() TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION get_role_management_stats() IS 'Returns statistics about role assignments including total users, users with additional roles, and most common additional role';
