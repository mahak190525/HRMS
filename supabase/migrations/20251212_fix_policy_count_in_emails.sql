-- Fix policy count in email notifications
-- Migration: 20251212_fix_policy_count_in_emails.sql
--
-- This migration fixes the update_policy_email_counts() function to correctly
-- count and update policy counts in email notifications when policies are assigned in bulk.

-- Step 1: Fix the update_policy_email_counts function
-- =====================================================

CREATE OR REPLACE FUNCTION update_policy_email_counts()
RETURNS void AS $$
DECLARE
  email_record RECORD;
  actual_policy_count integer;
  email_user_id uuid;
  email_assigned_by uuid;
  email_created_at timestamptz;
  email_assigned_at timestamptz;
BEGIN
  -- Update policy counts in recent pending emails
  FOR email_record IN
    SELECT id, email_data, created_at
    FROM email_queue
    WHERE module_type = 'policy_management'::module_type_enum
    AND email_type = 'policy_assigned'::email_type_enum
    AND status = 'pending'
    AND created_at >= (NOW() - INTERVAL '120 seconds')  -- Increased window to 120 seconds to catch all bulk inserts
  LOOP
    -- Extract user_id, assigned_by, and timestamps from email_data
    email_user_id := (email_record.email_data->>'user_id')::uuid;
    email_assigned_by := NULL;
    IF email_record.email_data->>'assigned_by' IS NOT NULL THEN
      email_assigned_by := (email_record.email_data->>'assigned_by')::uuid;
    END IF;
    email_created_at := email_record.created_at;
    email_assigned_at := (email_record.email_data->>'assigned_at')::timestamptz;
    
    -- Use the earlier of created_at or assigned_at as the reference point
    -- This ensures we capture all policies from the same bulk insert
    IF email_assigned_at IS NULL OR email_assigned_at > email_created_at THEN
      email_assigned_at := email_created_at;
    END IF;
    
    -- Count actual policies assigned to this user by the same assigner
    -- within a time window around when the email was created
    -- This captures all policies from the same bulk assignment operation
    -- We use a wider time window and match by both user and assigner to ensure accuracy
    SELECT COUNT(*) INTO actual_policy_count
    FROM policy_assignments pa
    WHERE pa.user_id = email_user_id
    AND (
      -- Match by assigned_by if available in email_data
      -- This ensures we only count policies from the same assignment batch
      email_assigned_by IS NULL 
      OR pa.assigned_by = email_assigned_by
    )
    AND (
      -- Match policies assigned within 5 minutes before or after the email creation
      -- This wide window ensures we catch all policies from the same bulk insert,
      -- even if there are slight timing differences or delays
      pa.assigned_at >= (email_assigned_at - INTERVAL '5 minutes')
      AND pa.assigned_at <= (email_assigned_at + INTERVAL '5 minutes')
    )
    -- Only count pending assignments (not yet acknowledged)
    -- This ensures we're counting the policies that were just assigned
    AND pa.status = 'pending';
    
    -- Fallback: If we didn't find any policies with strict matching, try a more lenient approach
    -- Count all recent pending policies for this user from this assigner (within last 10 minutes)
    IF actual_policy_count = 0 AND email_assigned_by IS NOT NULL THEN
      SELECT COUNT(*) INTO actual_policy_count
      FROM policy_assignments pa
      WHERE pa.user_id = email_user_id
      AND pa.assigned_by = email_assigned_by
      AND pa.status = 'pending'
      AND pa.assigned_at >= (NOW() - INTERVAL '10 minutes');
      
      IF actual_policy_count > 0 THEN
        RAISE NOTICE 'Used fallback count for email %: % policies found (user_id: %, assigned_by: %)', 
          email_record.id, actual_policy_count, email_user_id, email_assigned_by;
      END IF;
    END IF;
    
    -- Always update the count with the actual count found
    -- Use at least 1 if we found any policies (shouldn't happen, but safety check)
    UPDATE email_queue
    SET email_data = jsonb_set(
      email_data,
      '{policy_count}',
      to_jsonb(actual_policy_count)
    )
    WHERE id = email_record.id;
    
    IF actual_policy_count > 0 THEN
      RAISE NOTICE 'Updated email % with policy_count: % (user_id: %, assigned_by: %, time_window: % to %)', 
        email_record.id, actual_policy_count, email_user_id, email_assigned_by, 
        email_assigned_at - INTERVAL '5 minutes', email_assigned_at + INTERVAL '5 minutes';
    ELSE
      RAISE WARNING 'No policies found for email % (user_id: %, assigned_by: %, time_window: % to %)', 
        email_record.id, email_user_id, email_assigned_by,
        email_assigned_at - INTERVAL '5 minutes', email_assigned_at + INTERVAL '5 minutes';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Update the trigger function to count policies at email creation time
-- =====================================================
-- This ensures the correct count is set from the start, before the email is processed
-- The trigger now counts all policies assigned to the user by the same assigner
-- within a time window to catch bulk assignments

CREATE OR REPLACE FUNCTION send_policy_assignment_email()
RETURNS TRIGGER AS $$
DECLARE
  existing_email_count integer;
  policy_count integer;
BEGIN
  -- Check if there's already a pending policy assignment email for this user
  SELECT COUNT(*) INTO existing_email_count
  FROM email_queue eq
  WHERE eq.module_type = 'policy_management'::module_type_enum
  AND eq.email_type = 'policy_assigned'::email_type_enum
  AND eq.status = 'pending'
  AND eq.email_data->>'user_id' = NEW.user_id::text;

  -- Count how many policies are being assigned to this user by this assigner
  -- within a time window (to catch bulk assignments happening in the same transaction/batch)
  -- We look for policies assigned within a 10-second window to catch all policies from the same bulk insert
  -- This works because bulk inserts typically happen within milliseconds of each other
  SELECT COUNT(*) INTO policy_count
  FROM policy_assignments pa
  WHERE pa.user_id = NEW.user_id
  AND pa.assigned_by = NEW.assigned_by
  AND pa.assigned_at >= (NEW.assigned_at - INTERVAL '10 seconds')
  AND pa.assigned_at <= (NEW.assigned_at + INTERVAL '10 seconds')
  AND pa.status = 'pending';

  -- If we didn't find any (shouldn't happen, but could if timing is off),
  -- try a wider window as fallback
  IF policy_count = 0 THEN
    SELECT COUNT(*) INTO policy_count
    FROM policy_assignments pa
    WHERE pa.user_id = NEW.user_id
    AND pa.assigned_by = NEW.assigned_by
    AND pa.assigned_at >= (NEW.assigned_at - INTERVAL '1 minute')
    AND pa.assigned_at <= (NEW.assigned_at + INTERVAL '1 minute')
    AND pa.status = 'pending';
  END IF;

  -- Final fallback: ensure we have at least 1
  IF policy_count = 0 THEN
    policy_count := 1;
  END IF;

  -- Always create individual notifications (these are fine to have multiple)
  INSERT INTO notifications (user_id, title, message, type, data)
  SELECT 
    NEW.user_id,
    'Policy Assignment',
    policy_count::text || CASE WHEN policy_count = 1 THEN ' policy has' ELSE ' policies have' END || 
    ' been assigned to you by ' || assigner.full_name || '. Please review and acknowledge ' ||
    CASE WHEN policy_count = 1 THEN 'it' ELSE 'them' END || ' in the Policies section.',
    'policy_assigned',
    jsonb_build_object(
      'policy_assignment_id', NEW.id,
      'policy_id', NEW.policy_id,
      'assigned_by', NEW.assigned_by,
      'assigned_by_name', assigner.full_name,
      'due_date', NEW.due_date,
      'notes', NEW.notes,
      'assigned_at', NEW.assigned_at,
      'target', 'dashboard/policies'
    )
  FROM users assigner
  WHERE assigner.id = NEW.assigned_by;

  -- Only send email if no pending email exists for this user
  IF existing_email_count = 0 THEN
    -- Use queue_email function to properly resolve dynamic CCs
    PERFORM queue_email(
      'policy_management'::module_type_enum,
      NEW.id,
      'policy_assigned'::email_type_enum,
      jsonb_build_object(
        'to', jsonb_build_array(
          jsonb_build_object('email', u.email, 'name', u.full_name)
        ),
        'cc_static', jsonb_build_array(
          jsonb_build_object('email', 'mechlinpeopleworkplace@mechlintech.com', 'name', 'Mechlin People Workplace'),
          jsonb_build_object('email', 'awasthy.mukesh@mechlintech.com', 'name', 'Mukesh Awasthy')
        ),
        'cc_dynamic', jsonb_build_array('manager')
      ),
      jsonb_build_object(
        'user_id', NEW.user_id,
        'employee_name', u.full_name,
        'employee_email', u.email,
        'policy_count', policy_count,  -- Use the actual count calculated above
        'policy_name', p.name,
        'policy_id', p.id,
        'assigned_by', NEW.assigned_by,  -- Added for better matching
        'assigned_by_name', assigner.full_name,
        'assigned_by_email', assigner.email,
        'due_date', NEW.due_date,
        'notes', NEW.notes,
        'assigned_at', NEW.assigned_at
      ),
      'Policy Assignment - Action Required',
      'normal'::email_priority_enum
    )
    FROM users u
    JOIN policies p ON p.id = NEW.policy_id
    JOIN users assigner ON assigner.id = NEW.assigned_by
    WHERE u.id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Grant permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION update_policy_email_counts() TO postgres, service_role, authenticated;

-- Step 4: Add helpful comments
-- =====================================================

COMMENT ON FUNCTION send_policy_assignment_email() IS 'Sends policy assignment emails with correct policy counts. Counts all policies assigned to the user by the same assigner within a time window to handle bulk assignments correctly.';

COMMENT ON FUNCTION update_policy_email_counts() IS 'Updates policy counts in pending emails for bulk assignments. This is a backup function - the trigger now counts policies at creation time, but this can be used to verify/correct counts if needed.';

-- Log completion
SELECT 'Policy count email fix applied successfully' as status;

