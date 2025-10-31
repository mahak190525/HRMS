-- Create print blocking logs table to track security events
-- This migration creates a table to log all print blocking attempts and related security events

-- Create the print_blocking_logs table
CREATE TABLE IF NOT EXISTS print_blocking_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_email TEXT,
  user_name TEXT,
  action_type TEXT NOT NULL, -- 'print', 'save', 'screenshot', 'copy', 'devtools', 'context_menu', 'view_source'
  action_description TEXT NOT NULL, -- Human readable description of what was blocked
  key_combination TEXT, -- The key combination that was pressed (e.g., 'Ctrl+P', 'F12')
  user_agent TEXT, -- Browser user agent string
  ip_address INET, -- User's IP address (if available)
  page_url TEXT, -- Current page URL when action was attempted
  session_id TEXT, -- Session identifier
  blocked_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata'),
  additional_data JSONB -- Any additional context data
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_print_blocking_logs_user_id ON print_blocking_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_print_blocking_logs_action_type ON print_blocking_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_print_blocking_logs_blocked_at ON print_blocking_logs(blocked_at);
CREATE INDEX IF NOT EXISTS idx_print_blocking_logs_user_email ON print_blocking_logs(user_email);

-- Create a composite index for common queries
CREATE INDEX IF NOT EXISTS idx_print_blocking_logs_user_action_date 
ON print_blocking_logs(user_id, action_type, blocked_at DESC);

-- Enable Row Level Security
ALTER TABLE print_blocking_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Only super admins and HR can read all logs (will be enforced by application logic)
CREATE POLICY "Allow reading print blocking logs"
  ON print_blocking_logs FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert print blocking logs
CREATE POLICY "Authenticated users can insert print blocking logs"
  ON print_blocking_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Drop existing function first to avoid conflicts
DROP FUNCTION IF EXISTS log_print_blocking_attempt(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS log_print_blocking_attempt(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT);
DROP FUNCTION IF EXISTS log_print_blocking_attempt(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB);

-- Create a function to log print blocking attempts
CREATE OR REPLACE FUNCTION log_print_blocking_attempt(
  p_user_id UUID,
  p_action_type TEXT,
  p_action_description TEXT,
  p_key_combination TEXT DEFAULT NULL,
  p_page_url TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_additional_data JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  log_id UUID;
  current_user_data RECORD;
BEGIN
  -- Get current user data by ID
  SELECT id, email, full_name INTO current_user_data
  FROM users 
  WHERE id = p_user_id
  LIMIT 1;

  -- Insert the log entry with IST timestamp
  INSERT INTO print_blocking_logs (
    user_id,
    user_email,
    user_name,
    action_type,
    action_description,
    key_combination,
    page_url,
    user_agent,
    additional_data,
    blocked_at
  ) VALUES (
    current_user_data.id,
    current_user_data.email,
    current_user_data.full_name,
    p_action_type,
    p_action_description,
    p_key_combination,
    p_page_url,
    p_user_agent,
    p_additional_data,
    NOW() AT TIME ZONE 'Asia/Kolkata'
  ) RETURNING id INTO log_id;

  RETURN log_id;
END;
$$;


-- Drop existing function first to avoid conflicts
DROP FUNCTION IF EXISTS get_user_print_blocking_stats(UUID);
DROP FUNCTION IF EXISTS get_user_print_blocking_stats(TEXT, UUID);
DROP FUNCTION IF EXISTS get_user_print_blocking_stats(UUID, UUID);

-- Create a function to get print blocking stats for a user
CREATE OR REPLACE FUNCTION get_user_print_blocking_stats(
  p_current_user_id UUID,
  p_target_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  action_type TEXT,
  attempt_count BIGINT,
  latest_attempt TIMESTAMP WITH TIME ZONE,
  most_common_key TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_data RECORD;
BEGIN
  -- Get current user data by ID
  SELECT id, role_id INTO current_user_data
  FROM users 
  WHERE id = p_current_user_id
  LIMIT 1;

  -- Check if user was found
  IF current_user_data.id IS NULL THEN
    RAISE EXCEPTION 'User not found with ID: %', p_current_user_id;
  END IF;

  -- If no target user specified, use current user
  IF p_target_user_id IS NULL THEN
    p_target_user_id := current_user_data.id;
  END IF;

  -- Check if current user can access this data
  IF NOT EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = current_user_data.id 
    AND (
      r.name IN ('super_admin', 'admin', 'hr')
      OR u.id = p_target_user_id
    )
  ) THEN
    RAISE EXCEPTION 'Access denied for user ID: %', p_current_user_id;
  END IF;

  RETURN QUERY
  SELECT 
    pbl.action_type,
    COUNT(*) as attempt_count,
    MAX(pbl.blocked_at AT TIME ZONE 'Asia/Kolkata') as latest_attempt,
    MODE() WITHIN GROUP (ORDER BY pbl.key_combination) as most_common_key
  FROM print_blocking_logs pbl
  WHERE pbl.user_id = p_target_user_id
  GROUP BY pbl.action_type
  ORDER BY attempt_count DESC;
END;
$$;

-- Drop existing function first to avoid conflicts
DROP FUNCTION IF EXISTS debug_user_lookup(TEXT);
DROP FUNCTION IF EXISTS debug_user_lookup(TEXT, TEXT);
DROP FUNCTION IF EXISTS debug_user_lookup(UUID);

-- Create a debug function to test user lookup by ID
CREATE OR REPLACE FUNCTION debug_user_lookup(p_user_id UUID)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  company_email TEXT,
  personal_email TEXT,
  full_name TEXT,
  provider_user_id TEXT,
  found BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_data RECORD;
BEGIN
  -- Get user data by ID
  SELECT id, email, company_email, personal_email, full_name, provider_user_id INTO user_data
  FROM users 
  WHERE id = p_user_id
  LIMIT 1;

  RETURN QUERY
  SELECT 
    user_data.id,
    user_data.email,
    user_data.company_email,
    user_data.personal_email,
    user_data.full_name,
    user_data.provider_user_id,
    (user_data.id IS NOT NULL) as found;
END;
$$;

-- Add comments for documentation
COMMENT ON TABLE print_blocking_logs IS 'Logs all print blocking and security-related action attempts by users';
COMMENT ON COLUMN print_blocking_logs.action_type IS 'Type of blocked action: print, save, screenshot, copy, devtools, context_menu, view_source';
COMMENT ON COLUMN print_blocking_logs.key_combination IS 'The keyboard shortcut that was pressed (e.g., Ctrl+P, F12)';
COMMENT ON COLUMN print_blocking_logs.additional_data IS 'Additional context data in JSON format';
COMMENT ON FUNCTION log_print_blocking_attempt IS 'Function to log print blocking attempts with user context';
COMMENT ON FUNCTION get_user_print_blocking_stats IS 'Get print blocking statistics for a specific user';

-- Create a function to send notifications for print blocking attempts
CREATE OR REPLACE FUNCTION notify_print_blocking_attempt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  employee_data RECORD;
  hr_admin_user RECORD;
  notification_title TEXT;
  notification_message TEXT;
  notification_count INT := 0;
BEGIN
  -- Log trigger execution
  RAISE NOTICE 'Print blocking notification trigger fired for user_id: %', NEW.user_id;
  
  -- Get employee data including manager
  SELECT u.id, u.full_name, u.email, u.manager_id, m.full_name as manager_name
  INTO employee_data
  FROM users u
  LEFT JOIN users m ON u.manager_id = m.id
  WHERE u.id = NEW.user_id;

  -- Check if user was found
  IF employee_data.id IS NULL THEN
    RAISE WARNING 'User not found for user_id: %. Cannot create notifications.', NEW.user_id;
    RETURN NEW;
  END IF;

  RAISE NOTICE 'Found employee: % (%), Manager: %', employee_data.full_name, employee_data.email, employee_data.manager_name;

  -- Create notification title and message
  notification_title := 'Security Alert: Print Blocking Attempt';
  notification_message := employee_data.full_name || ' attempted to ' || 
    LOWER(NEW.action_description) || ' on ' || 
    TO_CHAR(NEW.blocked_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY at HH24:MI:SS') || ' IST';

  -- Notify the employee themselves
  BEGIN
    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      data
    ) VALUES (
      employee_data.id,
      'Action Blocked',
      'Your attempt to ' || LOWER(NEW.action_description) || ' was blocked for security reasons.',
      'security',
      jsonb_build_object(
        'print_blocking_log_id', NEW.id,
        'action_type', NEW.action_type,
        'blocked_at', NEW.blocked_at
      )
    );
    notification_count := notification_count + 1;
    RAISE NOTICE 'Created notification for employee: %', employee_data.full_name;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to create notification for employee %: % - %', employee_data.full_name, SQLERRM, SQLSTATE;
  END;

  -- Notify HR and Admin users
  FOR hr_admin_user IN (
    SELECT u.id, u.full_name, u.email 
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE r.name IN ('hr', 'admin', 'super_admin')
    AND u.status = 'active'
  ) LOOP
    BEGIN
      INSERT INTO notifications (
        user_id,
        title,
        message,
        type,
        data
      ) VALUES (
        hr_admin_user.id,
        notification_title,
        notification_message,
        'security',
        jsonb_build_object(
          'print_blocking_log_id', NEW.id,
          'action_type', NEW.action_type,
          'blocked_at', NEW.blocked_at,
          'employee_id', employee_data.id,
          'employee_name', employee_data.full_name
        )
      );
      notification_count := notification_count + 1;
      RAISE NOTICE 'Created notification for HR/Admin: %', hr_admin_user.full_name;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to create notification for HR/Admin %: % - %', hr_admin_user.full_name, SQLERRM, SQLSTATE;
    END;
  END LOOP;

  -- Notify the employee's manager (if exists)
  IF employee_data.manager_id IS NOT NULL THEN
    BEGIN
      INSERT INTO notifications (
        user_id,
        title,
        message,
        type,
        data
      ) VALUES (
        employee_data.manager_id,
        notification_title,
        notification_message || ' (Your Team Member)',
        'security',
        jsonb_build_object(
          'print_blocking_log_id', NEW.id,
          'action_type', NEW.action_type,
          'blocked_at', NEW.blocked_at,
          'employee_id', employee_data.id,
          'employee_name', employee_data.full_name
        )
      );
      notification_count := notification_count + 1;
      RAISE NOTICE 'Created notification for manager of %', employee_data.full_name;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to create notification for manager: % - %', SQLERRM, SQLSTATE;
    END;
  END IF;

  RAISE NOTICE 'Successfully created % notifications for print blocking attempt', notification_count;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in notify_print_blocking_attempt trigger: % - %', SQLERRM, SQLSTATE;
    RETURN NEW; -- Return NEW to allow the trigger to complete even if notifications fail
END;
$$;

-- Create trigger to send notifications after insert
DROP TRIGGER IF EXISTS trigger_notify_print_blocking ON print_blocking_logs;
CREATE TRIGGER trigger_notify_print_blocking
  AFTER INSERT ON print_blocking_logs
  FOR EACH ROW
  EXECUTE FUNCTION notify_print_blocking_attempt();

-- Create policy to allow system to insert notifications (for triggers)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'notifications' 
    AND policyname = 'System can create security notifications'
  ) THEN
    CREATE POLICY "System can create security notifications"
      ON notifications
      FOR INSERT
      TO authenticated
      WITH CHECK (type = 'security');
  END IF;
END $$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON print_blocking_logs TO authenticated;
GRANT INSERT ON print_blocking_logs TO authenticated;
GRANT SELECT ON notifications TO authenticated;
GRANT INSERT ON notifications TO authenticated;
GRANT EXECUTE ON FUNCTION log_print_blocking_attempt TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_print_blocking_stats TO authenticated;
GRANT EXECUTE ON FUNCTION debug_user_lookup TO authenticated;
GRANT EXECUTE ON FUNCTION notify_print_blocking_attempt TO authenticated;
