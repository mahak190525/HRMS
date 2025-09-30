/*
  # Create Notifications System

  1. New Tables
    - `notifications`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `title` (text)
      - `message` (text)
      - `type` (text, enum for different notification types)
      - `data` (jsonb, additional data for the notification)
      - `is_read` (boolean, default false)
      - `created_at` (timestamp)
      - `read_at` (timestamp, nullable)
    - `push_subscriptions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `endpoint` (text, push subscription endpoint)
      - `p256dh_key` (text, encryption key)
      - `auth_key` (text, authentication key)
      - `user_agent` (text, browser info)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for users to read their own notifications
    - Add policies for managers to create notifications for their team
    - Add policies for users to manage their own push subscriptions

  3. Functions
    - Function to create notifications with push notification trigger
    - Function to mark notifications as read
    - Function to mark all notifications as read for a user

  4. Triggers
    - Trigger on leave_applications table to create notifications
    - Trigger to send push notifications when notifications are created
*/

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'general',
  data jsonb DEFAULT '{}',
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz
);

-- Create push_subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh_key text NOT NULL,
  auth_key text NOT NULL,
  user_agent text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Notifications policies
CREATE POLICY "Users can read own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "HR and managers can create notifications"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role_id IN (
        SELECT roles.id FROM roles
        WHERE roles.name = ANY(ARRAY['super_admin', 'admin', 'hr', 'sdm', 'bdm', 'qam'])
      )
    )
  );

-- Push subscriptions policies
CREATE POLICY "Users can manage own push subscriptions"
  ON push_subscriptions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created_at ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_is_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- Function to create notification with push notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id uuid,
  p_title text,
  p_message text,
  p_type text DEFAULT 'general',
  p_data jsonb DEFAULT '{}'
) RETURNS uuid AS $$
DECLARE
  notification_id uuid;
BEGIN
  -- Insert notification
  INSERT INTO notifications (user_id, title, message, type, data)
  VALUES (p_user_id, p_title, p_message, p_type, p_data)
  RETURNING id INTO notification_id;
  
  -- Trigger push notification (will be handled by edge function)
  PERFORM net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
    ),
    body := jsonb_build_object(
      'user_id', p_user_id,
      'title', p_title,
      'message', p_message,
      'type', p_type,
      'data', p_data
    )
  );
  
  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE notifications 
  SET is_read = true, read_at = now()
  WHERE id = p_notification_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark all notifications as read for a user
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE notifications 
  SET is_read = true, read_at = now()
  WHERE user_id = p_user_id AND user_id = auth.uid() AND is_read = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to notify leave request submitted
CREATE OR REPLACE FUNCTION notify_leave_request_submitted()
RETURNS trigger AS $$
DECLARE
  manager_id uuid;
  employee_name text;
  leave_type_name text;
BEGIN
  -- Get employee name
  SELECT full_name INTO employee_name
  FROM users WHERE id = NEW.user_id;
  
  -- Get leave type name
  SELECT name INTO leave_type_name
  FROM leave_types WHERE id = NEW.leave_type_id;
  
  -- Find managers in the same department or HR
  FOR manager_id IN
    SELECT DISTINCT u.id
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE (
      -- Same department managers
      (u.department_id = (SELECT department_id FROM users WHERE id = NEW.user_id)
       AND r.name IN ('sdm', 'bdm', 'qam'))
      OR
      -- HR team
      r.name IN ('hr', 'admin', 'super_admin')
    )
    AND u.status = 'active'
    AND u.id != NEW.user_id
  LOOP
    -- Create notification for each manager
    PERFORM create_notification(
      manager_id,
      'New Leave Request',
      employee_name || ' has submitted a ' || leave_type_name || ' request for ' || NEW.days_count || ' days.',
      'leave_request_submitted',
      jsonb_build_object(
        'leave_application_id', NEW.id,
        'employee_id', NEW.user_id,
        'employee_name', employee_name,
        'leave_type', leave_type_name,
        'start_date', NEW.start_date,
        'end_date', NEW.end_date,
        'days_count', NEW.days_count
      )
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;