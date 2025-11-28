/*
  # Fix Notification Timezone Consistency
  
  The security notifications are being created with IST timezone conversion
  while other notifications use UTC. This causes inconsistent display in the frontend.
  
  Issues Fixed:
  - Security notifications showing "6 hours in future" 
  - Inconsistent timezone handling between notification types
  - Frontend formatDistanceToNow displaying incorrect relative times
  
  Solution:
  - Use consistent UTC timestamps for all notifications
  - Let the frontend handle timezone display consistently
*/

-- Fix the print blocking notification function to use consistent UTC timestamps
CREATE OR REPLACE FUNCTION notify_print_blocking_attempt()
RETURNS TRIGGER AS $$
DECLARE
  employee_data RECORD;
  notification_title TEXT;
  notification_message TEXT;
  hr_admin_user RECORD;
  manager_user RECORD;
  notification_count INT := 0;
  error_details TEXT;
BEGIN
  -- Log trigger execution
  RAISE NOTICE '🔥 Print blocking notification trigger fired for user_id: %', NEW.user_id;
  
  -- Get employee data including manager with error handling
  BEGIN
    SELECT u.id, u.full_name, u.email, u.manager_id, m.full_name as manager_name, m.email as manager_email
    INTO employee_data
    FROM public.users u
    LEFT JOIN public.users m ON u.manager_id = m.id
    WHERE u.id = NEW.user_id AND u.status = 'active';

    IF employee_data.id IS NULL THEN
      RAISE WARNING 'User % not found or inactive. Cannot create notifications.', NEW.user_id;
      RETURN NEW;
    END IF;
    
    RAISE NOTICE '👤 Found employee: % (%), Manager: %', 
      employee_data.full_name, employee_data.email, employee_data.manager_name;
    
  EXCEPTION
    WHEN OTHERS THEN
      error_details := format('Error: %s, State: %s', SQLERRM, SQLSTATE);
      RAISE WARNING '❌ Error fetching employee data: %', error_details;
      
      -- Use fallback data
      employee_data.id := NEW.user_id;
      employee_data.full_name := COALESCE(NEW.user_name, 'Unknown User');
      employee_data.email := COALESCE(NEW.user_email, 'unknown@email.com');
      employee_data.manager_id := NULL;
  END;

  -- Create notification messages (display IST in message, but use UTC timestamp)
  notification_title := 'Security Alert: Print Blocking Attempt';
  notification_message := employee_data.full_name || ' attempted to ' || 
    LOWER(NEW.action_description) || ' on ' || 
    TO_CHAR(NEW.blocked_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY at HH24:MI:SS') || ' IST';

  RAISE NOTICE '📝 Notification message: %', notification_message;

  -- 1. Notify the employee themselves
  BEGIN
    RAISE NOTICE '👤 Creating notification for employee: %', employee_data.full_name;
    
    INSERT INTO public.notifications (user_id, title, message, type, data, created_at)
    VALUES (
      employee_data.id,
      'Action Blocked',
      'Your attempt to ' || LOWER(NEW.action_description) || ' was blocked for security reasons.',
      'security',
      jsonb_build_object(
        'print_blocking_log_id', NEW.id,
        'action_type', NEW.action_type,
        'blocked_at', NEW.blocked_at
      ),
      NOW()  -- Use UTC timestamp consistently
    );
    
    notification_count := notification_count + 1;
    RAISE NOTICE '✅ Employee notification created successfully';
    
  EXCEPTION
    WHEN OTHERS THEN
      error_details := format('Error: %s, State: %s', SQLERRM, SQLSTATE);
      RAISE WARNING '❌ Failed to create employee notification: %', error_details;
  END;

  -- 2. Count and notify HR/Admin users
  BEGIN
    SELECT COUNT(*) INTO notification_count
    FROM public.users u
    JOIN public.roles r ON u.role_id = r.id
    WHERE r.name IN ('hr', 'admin', 'super_admin')
      AND u.status = 'active';
      
    RAISE NOTICE '👥 Found % HR/Admin users to notify', notification_count;

    -- 3. Notify HR and Admin users
    FOR hr_admin_user IN (
      SELECT u.id, u.full_name, u.email, r.name as role_name
      FROM public.users u
      JOIN public.roles r ON u.role_id = r.id
      WHERE r.name IN ('hr', 'admin', 'super_admin')
        AND u.status = 'active'
    ) LOOP
      BEGIN
        RAISE NOTICE '🔐 Creating notification for HR/Admin: % (%)', 
          hr_admin_user.full_name, hr_admin_user.role_name;
        
        INSERT INTO public.notifications (user_id, title, message, type, data, created_at)
        VALUES (
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
          ),
          NOW()  -- Use UTC timestamp consistently
        );
        
        notification_count := notification_count + 1;
        RAISE NOTICE '✅ HR/Admin notification created for: %', hr_admin_user.full_name;
        
      EXCEPTION
        WHEN OTHERS THEN
          error_details := format('Error: %s, State: %s', SQLERRM, SQLSTATE);
          RAISE WARNING '❌ Failed to create HR/Admin notification for %: %', 
            hr_admin_user.full_name, error_details;
      END;
    END LOOP;
    
  EXCEPTION
    WHEN OTHERS THEN
      error_details := format('Error: %s, State: %s', SQLERRM, SQLSTATE);
      RAISE WARNING '❌ Error in HR/Admin notification loop: %', error_details;
  END;

  -- 4. Notify employee's manager (if exists and different from employee)
  IF employee_data.manager_id IS NOT NULL AND employee_data.manager_id != employee_data.id THEN
    BEGIN
      RAISE NOTICE '👨‍💼 Creating notification for manager: %', employee_data.manager_name;
      
      INSERT INTO public.notifications (user_id, title, message, type, data, created_at)
      VALUES (
        employee_data.manager_id,
        notification_title,
        notification_message || ' (Your Team Member)',
        'security',
        jsonb_build_object(
          'print_blocking_log_id', NEW.id,
          'action_type', NEW.action_type,
          'blocked_at', NEW.blocked_at,
          'employee_id', employee_data.id,
          'employee_name', employee_data.full_name,
          'is_team_member', true
        ),
        NOW()  -- Use UTC timestamp consistently
      );
      
      notification_count := notification_count + 1;
      RAISE NOTICE '✅ Manager notification created for: %', employee_data.manager_name;
      
    EXCEPTION
      WHEN OTHERS THEN
        error_details := format('Error: %s, State: %s', SQLERRM, SQLSTATE);
        RAISE WARNING '❌ Failed to create manager notification: %', error_details;
    END;
  ELSE
    RAISE NOTICE 'ℹ️ No manager to notify (manager_id: %)', employee_data.manager_id;
  END IF;

  RAISE NOTICE '🎉 Print blocking notifications completed. Total created: %', notification_count;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the comment
COMMENT ON FUNCTION notify_print_blocking_attempt() IS 'Creates security notifications for print blocking attempts - FIXED timezone consistency';

-- Log completion
SELECT 'Notification timezone consistency fixed! 🕐' as status,
       'All notifications now use UTC timestamps consistently' as details;
