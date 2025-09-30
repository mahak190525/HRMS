/*
  # Add manager_id column to users table

  1. Schema Changes
    - Add `manager_id` column to `users` table
    - Create foreign key relationship to users table (self-referencing)
    - Add index for performance

  2. Functions
    - Update notification functions to notify managers
    - Add function to mark notifications as read
    - Add function to mark all notifications as read

  3. Security
    - No RLS changes needed as existing policies cover the new column
*/

-- Add manager_id column to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'manager_id'
  ) THEN
    ALTER TABLE users ADD COLUMN manager_id uuid REFERENCES users(id);
  END IF;
END $$;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_users_manager_id ON users(manager_id);

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE notifications 
  SET 
    is_read = true,
    read_at = now()
  WHERE id = p_notification_id AND user_id = auth.uid();
END;
$$;

-- Function to mark all notifications as read for a user
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE notifications 
  SET 
    is_read = true,
    read_at = now()
  WHERE user_id = p_user_id AND user_id = auth.uid() AND is_read = false;
END;
$$;

-- Function to create notification (updated to notify managers)
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id uuid,
  p_title text,
  p_message text,
  p_type text DEFAULT 'general',
  p_data jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_id uuid;
  manager_id uuid;
BEGIN
  -- Create notification for the user
  INSERT INTO notifications (user_id, title, message, type, data)
  VALUES (p_user_id, p_title, p_message, p_type, p_data)
  RETURNING id INTO notification_id;
  
  -- Get the user's manager
  SELECT u.manager_id INTO manager_id
  FROM users u
  WHERE u.id = p_user_id;
  
  -- If user has a manager, create notification for manager too
  IF manager_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, type, data)
    VALUES (
      manager_id, 
      'Team Member: ' || p_title, 
      p_message, 
      p_type, 
      jsonb_build_object('original_user_id', p_user_id) || p_data
    );
  END IF;
  
  RETURN notification_id;
END;
$$;