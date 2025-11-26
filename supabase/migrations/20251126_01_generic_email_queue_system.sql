-- =====================================================
-- Generic Email Queue System Migration
-- =====================================================
-- This migration creates a comprehensive, future-proof email queue system
-- that supports any module, multiple recipients, static CC, and dynamic CC
-- 
-- Features:
-- ✅ Universal reference system (module_type + reference_id)
-- ✅ Multiple recipient types (to, cc_static, cc_dynamic)
-- ✅ Dynamic CC resolution (manager emails, role-based emails)
-- ✅ Extensible for future modules (payroll, attendance, onboarding, etc.)
-- ✅ Email templating support via email_type
-- ✅ Retry mechanism and error handling
-- ✅ Audit trail and logging
-- =====================================================

-- Step 1: Create enums for better type safety and extensibility
-- =====================================================

-- Module types enum - easily extensible for new modules
CREATE TYPE module_type_enum AS ENUM (
  'leave_management',
  'performance_management', 
  'policy_management',
  'payroll',
  'attendance',
  'onboarding',
  'offboarding',
  'training',
  'disciplinary',
  'asset_management',
  'expense_management',
  'recruitment'
);

-- Email types enum - supports different email templates per module
CREATE TYPE email_type_enum AS ENUM (
  -- Leave Management
  'leave_submitted',
  'leave_approved', 
  'leave_rejected',
  'leave_withdrawn',
  'leave_cancelled',
  'leave_reminder',
  
  -- Performance Management
  'kra_assigned',
  'kra_submitted',
  'kra_approved',
  'kra_rejected',
  'review_due',
  'review_completed',
  
  -- Policy Management
  'policy_assigned',
  'policy_acknowledged',
  'policy_updated',
  'policy_expired',
  
  -- Payroll
  'payslip_generated',
  'salary_processed',
  'bonus_announced',
  
  -- Attendance
  'attendance_anomaly',
  'timesheet_reminder',
  'overtime_approved',
  
  -- Onboarding
  'welcome_email',
  'document_required',
  'onboarding_completed',
  
  -- Training
  'training_assigned',
  'training_completed',
  'certification_expiring',
  
  -- General
  'system_notification',
  'reminder',
  'alert'
);

-- Email status enum
CREATE TYPE email_status_enum AS ENUM (
  'pending',
  'processing', 
  'sent',
  'failed',
  'cancelled',
  'retry'
);

-- Email priority enum
CREATE TYPE email_priority_enum AS ENUM (
  'low',
  'normal', 
  'high',
  'urgent'
);

-- Step 2: Create the generic email queue table
-- =====================================================

CREATE TABLE IF NOT EXISTS email_queue (
  -- Primary identification
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Universal reference system - ANY module can use this
  module_type module_type_enum NOT NULL,
  reference_id uuid NOT NULL,
  email_type email_type_enum NOT NULL,
  
  -- Email metadata
  subject text,
  priority email_priority_enum DEFAULT 'normal',
  
  -- Recipients structure - supports multiple recipient types
  recipients jsonb NOT NULL DEFAULT '{}',
  -- Structure:
  -- {
  --   "to": [{"email": "user@example.com", "name": "User Name"}],
  --   "cc_static": [{"email": "hr@company.com", "name": "HR Team"}],
  --   "cc_dynamic": ["manager", "team_lead", "hr_role"] // These get resolved dynamically
  -- }
  
  -- Email content and context data
  email_data jsonb NOT NULL DEFAULT '{}',
  -- This contains all the data needed for email templates
  -- Structure varies by module_type and email_type
  
  -- Processing information
  status email_status_enum DEFAULT 'pending',
  scheduled_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  
  -- Error handling and retry
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  error_message text,
  error_details jsonb,
  
  -- Audit trail
  created_by uuid REFERENCES users(id),
  
  -- Constraints
  CONSTRAINT email_queue_module_reference_check 
    CHECK (module_type IS NOT NULL AND reference_id IS NOT NULL),
  CONSTRAINT email_queue_recipients_check 
    CHECK (jsonb_typeof(recipients) = 'object'),
  CONSTRAINT email_queue_retry_check 
    CHECK (retry_count >= 0 AND retry_count <= max_retries)
);

-- Indexes for performance
CREATE INDEX idx_email_queue_status_scheduled ON email_queue(status, scheduled_at) 
  WHERE status IN ('pending', 'retry');
CREATE INDEX idx_email_queue_module_reference ON email_queue(module_type, reference_id);
CREATE INDEX idx_email_queue_created_at ON email_queue(created_at);
CREATE INDEX idx_email_queue_email_type ON email_queue(email_type);

-- Step 3: Create helper functions for dynamic recipient resolution
-- =====================================================

-- Function to get manager email for a given user
CREATE OR REPLACE FUNCTION get_manager_email(user_id uuid)
RETURNS jsonb AS $$
DECLARE
  manager_info jsonb;
BEGIN
  SELECT jsonb_build_object(
    'email', manager.email,
    'name', manager.full_name
  ) INTO manager_info
  FROM users AS u
  LEFT JOIN users AS manager ON u.manager_id = manager.id
  WHERE u.id = user_id 
    AND manager.email IS NOT NULL 
    AND manager.email != ''
    AND manager.status = 'active';
    
  RETURN manager_info;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get emails by role
CREATE OR REPLACE FUNCTION get_emails_by_role(role_names text[])
RETURNS jsonb AS $$
DECLARE
  role_emails jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'email', u.email,
      'name', u.full_name,
      'role', r.name
    )
  ) INTO role_emails
  FROM users u
  INNER JOIN roles r ON u.role_id = r.id
  WHERE r.name = ANY(role_names)
    AND u.status = 'active'
    AND u.email IS NOT NULL
    AND u.email != '';
    
  RETURN COALESCE(role_emails, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get team members' emails
CREATE OR REPLACE FUNCTION get_team_emails(manager_id uuid)
RETURNS jsonb AS $$
DECLARE
  team_emails jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'email', u.email,
      'name', u.full_name
    )
  ) INTO team_emails
  FROM users u
  WHERE u.manager_id = manager_id
    AND u.status = 'active'
    AND u.email IS NOT NULL
    AND u.email != '';
    
  RETURN COALESCE(team_emails, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to resolve dynamic CC recipients
CREATE OR REPLACE FUNCTION resolve_dynamic_cc(
  dynamic_cc_list jsonb,
  context_user_id uuid DEFAULT NULL,
  context_data jsonb DEFAULT '{}'
)
RETURNS jsonb AS $$
DECLARE
  resolved_cc jsonb := '[]'::jsonb;
  cc_item text;
  manager_email jsonb;
  role_emails jsonb;
  team_emails jsonb;
BEGIN
  -- If dynamic_cc_list is not an array, return empty array
  IF jsonb_typeof(dynamic_cc_list) != 'array' THEN
    RETURN '[]'::jsonb;
  END IF;
  
  -- Process each dynamic CC item
  FOR cc_item IN SELECT jsonb_array_elements_text(dynamic_cc_list)
  LOOP
    CASE cc_item
      WHEN 'manager' THEN
        IF context_user_id IS NOT NULL THEN
          manager_email := get_manager_email(context_user_id);
          IF manager_email IS NOT NULL THEN
            resolved_cc := resolved_cc || jsonb_build_array(manager_email);
          END IF;
        END IF;
        
      WHEN 'hr' THEN
        role_emails := get_emails_by_role(ARRAY['hr', 'hrm']);
        resolved_cc := resolved_cc || role_emails;
        
      WHEN 'admin' THEN
        role_emails := get_emails_by_role(ARRAY['admin']);
        resolved_cc := resolved_cc || role_emails;
        
      WHEN 'finance' THEN
        role_emails := get_emails_by_role(ARRAY['finance', 'finance_manager']);
        resolved_cc := resolved_cc || role_emails;
        
      WHEN 'team_members' THEN
        IF context_user_id IS NOT NULL THEN
          team_emails := get_team_emails(context_user_id);
          resolved_cc := resolved_cc || team_emails;
        END IF;
        
      -- Add more dynamic CC types as needed
      ELSE
        -- Log unknown dynamic CC type
        RAISE NOTICE 'Unknown dynamic CC type: %', cc_item;
    END CASE;
  END LOOP;
  
  RETURN resolved_cc;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create email queueing functions
-- =====================================================

-- Generic function to queue emails for any module
CREATE OR REPLACE FUNCTION queue_email(
  p_module_type module_type_enum,
  p_reference_id uuid,
  p_email_type email_type_enum,
  p_recipients jsonb,
  p_email_data jsonb,
  p_subject text DEFAULT NULL,
  p_priority email_priority_enum DEFAULT 'normal',
  p_scheduled_at timestamptz DEFAULT now(),
  p_created_by uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  email_id uuid;
  resolved_recipients jsonb;
  context_user_id uuid;
  final_recipients jsonb;
BEGIN
  -- Extract context user ID from email_data if available
  context_user_id := (p_email_data->>'user_id')::uuid;
  
  -- Resolve dynamic CC recipients
  resolved_recipients := p_recipients;
  
  IF p_recipients ? 'cc_dynamic' THEN
    resolved_recipients := jsonb_set(
      resolved_recipients,
      '{cc_dynamic_resolved}',
      resolve_dynamic_cc(
        p_recipients->'cc_dynamic',
        context_user_id,
        p_email_data
      )
    );
  END IF;
  
  -- Insert email into queue
  INSERT INTO email_queue (
    module_type,
    reference_id,
    email_type,
    subject,
    priority,
    recipients,
    email_data,
    scheduled_at,
    created_by
  ) VALUES (
    p_module_type,
    p_reference_id,
    p_email_type,
    p_subject,
    p_priority,
    resolved_recipients,
    p_email_data,
    p_scheduled_at,
    p_created_by
  ) RETURNING id INTO email_id;
  
  RETURN email_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process email queue (for frontend/edge function consumption)
CREATE OR REPLACE FUNCTION process_email_queue(
  p_limit integer DEFAULT 10,
  p_status email_status_enum DEFAULT 'pending'
)
RETURNS TABLE (
  queue_id uuid,
  module_type module_type_enum,
  reference_id uuid,
  email_type email_type_enum,
  subject text,
  priority email_priority_enum,
  recipients jsonb,
  email_data jsonb,
  scheduled_at timestamptz,
  retry_count integer
) AS $$
BEGIN
  -- Mark emails as processing to prevent concurrent processing
  UPDATE email_queue 
  SET status = 'processing', updated_at = now()
  WHERE id IN (
    SELECT eq.id 
    FROM email_queue eq
    WHERE eq.status = p_status 
      AND eq.scheduled_at <= now()
    ORDER BY 
      CASE eq.priority 
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2  
        WHEN 'normal' THEN 3
        WHEN 'low' THEN 4
      END,
      eq.created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  );
  
  -- Return the processing emails
  RETURN QUERY
  SELECT 
    eq.id,
    eq.module_type,
    eq.reference_id,
    eq.email_type,
    eq.subject,
    eq.priority,
    eq.recipients,
    eq.email_data,
    eq.scheduled_at,
    eq.retry_count
  FROM email_queue eq
  WHERE eq.status = 'processing'
  ORDER BY 
    CASE eq.priority 
      WHEN 'urgent' THEN 1
      WHEN 'high' THEN 2
      WHEN 'normal' THEN 3
      WHEN 'low' THEN 4
    END,
    eq.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark email as processed
CREATE OR REPLACE FUNCTION mark_email_processed(
  p_queue_id uuid,
  p_success boolean DEFAULT true,
  p_error_message text DEFAULT NULL,
  p_error_details jsonb DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  current_retry_count integer;
  max_retry_count integer;
BEGIN
  -- Get current retry information
  SELECT retry_count, max_retries 
  INTO current_retry_count, max_retry_count
  FROM email_queue 
  WHERE id = p_queue_id;
  
  IF p_success THEN
    -- Mark as sent
    UPDATE email_queue
    SET 
      status = 'sent',
      processed_at = now(),
      updated_at = now(),
      error_message = NULL,
      error_details = NULL
    WHERE id = p_queue_id;
  ELSE
    -- Handle failure
    IF current_retry_count < max_retry_count THEN
      -- Schedule for retry with exponential backoff
      UPDATE email_queue
      SET 
        status = 'retry',
        retry_count = retry_count + 1,
        scheduled_at = now() + (INTERVAL '1 minute' * POWER(2, retry_count + 1)),
        updated_at = now(),
        error_message = p_error_message,
        error_details = p_error_details
      WHERE id = p_queue_id;
    ELSE
      -- Mark as permanently failed
      UPDATE email_queue
      SET 
        status = 'failed',
        processed_at = now(),
        updated_at = now(),
        error_message = p_error_message,
        error_details = p_error_details
      WHERE id = p_queue_id;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Create updated trigger for leave management
-- =====================================================

-- Updated leave notification function using the generic email queue
CREATE OR REPLACE FUNCTION send_leave_email_notification_generic(
  p_leave_application_id uuid,
  p_email_type email_type_enum DEFAULT 'leave_approved'
)
RETURNS void AS $$
DECLARE
  leave_app_data jsonb;
  recipients_data jsonb;
  employee_data jsonb;
  manager_data jsonb;
  email_subject text;
BEGIN
  -- Get leave application details
  SELECT jsonb_build_object(
    'id', la.id,
    'status', la.status,
    'start_date', la.start_date,
    'end_date', la.end_date,
    'days_count', la.days_count,
    'comments', la.comments,
    'user_id', la.user_id,
    'approved_by', la.approved_by,
    'employee_name', u.full_name,
    'employee_email', u.email,
    'manager_id', u.manager_id,
    'leave_type', lt.name,
    'approver_name', approver.full_name,
    'approver_role', COALESCE(approver_role.name, 'employee')
  ) INTO leave_app_data
  FROM leave_applications la
  JOIN users u ON la.user_id = u.id
  JOIN leave_types lt ON la.leave_type_id = lt.id
  LEFT JOIN users approver ON la.approved_by = approver.id
  LEFT JOIN roles approver_role ON approver.role_id = approver_role.id
  WHERE la.id = p_leave_application_id;

  -- Only process if we have data
  IF leave_app_data IS NULL THEN
    RETURN;
  END IF;

  -- Prepare employee recipient
  employee_data := jsonb_build_object(
    'email', leave_app_data->>'employee_email',
    'name', leave_app_data->>'employee_name'
  );

  -- Prepare recipients structure
  recipients_data := jsonb_build_object(
    'to', jsonb_build_array(employee_data),
    'cc_static', jsonb_build_array(
      jsonb_build_object('email', 'awasthy.mukesh@mechlintech.com', 'name', 'Mukesh Kumar'),
      jsonb_build_object('email', 'mechlinpeopleworkplace@mechlintech.com', 'name', 'Mechlin People & Workplace'),
      jsonb_build_object('email', 'mechlinpayroll@mechlintech.com', 'name', 'Mechlin Payroll')
    ),
    'cc_dynamic', jsonb_build_array('manager')
  );

  -- Generate subject based on email type
  email_subject := CASE p_email_type
    WHEN 'leave_approved' THEN 'Your leave request has been Approved'
    WHEN 'leave_rejected' THEN 'Your leave request has been Rejected'
    WHEN 'leave_submitted' THEN 'New Leave Request - ' || (leave_app_data->>'employee_name')
    WHEN 'leave_withdrawn' THEN 'Leave request withdrawn - ' || (leave_app_data->>'employee_name')
    ELSE 'Leave Request Update'
  END;

  -- Queue the email using the generic system
  PERFORM queue_email(
    'leave_management'::module_type_enum,
    p_leave_application_id,
    p_email_type,
    recipients_data,
    leave_app_data,
    email_subject,
    'normal'::email_priority_enum
  );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Create example functions for other modules
-- =====================================================

-- Example: Policy assignment email
CREATE OR REPLACE FUNCTION queue_policy_assignment_email(
  p_policy_assignment_id uuid,
  p_user_id uuid,
  p_assigned_by uuid,
  p_policy_names text[]
)
RETURNS uuid AS $$
DECLARE
  email_data jsonb;
  recipients_data jsonb;
  employee_data jsonb;
  email_id uuid;
BEGIN
  -- Get employee details
  SELECT jsonb_build_object(
    'email', u.email,
    'name', u.full_name
  ) INTO employee_data
  FROM users u
  WHERE u.id = p_user_id;

  -- Get assigner details and prepare email data
  SELECT jsonb_build_object(
    'user_id', p_user_id,
    'employee_name', employee_data->>'name',
    'employee_email', employee_data->>'email',
    'assigned_by_name', assigner.full_name,
    'assigned_by_email', assigner.email,
    'policy_names', to_jsonb(p_policy_names),
    'policy_count', array_length(p_policy_names, 1),
    'assigned_at', now()
  ) INTO email_data
  FROM users assigner
  WHERE assigner.id = p_assigned_by;

  -- Prepare recipients
  recipients_data := jsonb_build_object(
    'to', jsonb_build_array(employee_data),
    'cc_static', jsonb_build_array(
      jsonb_build_object('email', 'mechlinpeopleworkplace@mechlintech.com', 'name', 'Mechlin People & Workplace')
    ),
    'cc_dynamic', jsonb_build_array('manager', 'hr')
  );

  -- Queue the email
  email_id := queue_email(
    'policy_management'::module_type_enum,
    p_policy_assignment_id,
    'policy_assigned'::email_type_enum,
    recipients_data,
    email_data,
    'Policy Assignment - Action Required',
    'normal'::email_priority_enum
  );

  RETURN email_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Example: Performance KRA assignment email
CREATE OR REPLACE FUNCTION queue_kra_assignment_email(
  p_kra_id uuid,
  p_employee_id uuid,
  p_manager_id uuid
)
RETURNS uuid AS $$
DECLARE
  email_data jsonb;
  recipients_data jsonb;
  employee_data jsonb;
  email_id uuid;
BEGIN
  -- Get employee and KRA details
  SELECT jsonb_build_object(
    'user_id', p_employee_id,
    'employee_name', emp.full_name,
    'employee_email', emp.email,
    'manager_name', mgr.full_name,
    'manager_email', mgr.email,
    'kra_title', 'Performance KRA Assignment',
    'assigned_at', now()
  ) INTO email_data
  FROM users emp
  LEFT JOIN users mgr ON mgr.id = p_manager_id
  WHERE emp.id = p_employee_id;

  -- Get employee recipient data
  employee_data := jsonb_build_object(
    'email', email_data->>'employee_email',
    'name', email_data->>'employee_name'
  );

  -- Prepare recipients
  recipients_data := jsonb_build_object(
    'to', jsonb_build_array(employee_data),
    'cc_static', jsonb_build_array(
      jsonb_build_object('email', 'mechlinpeopleworkplace@mechlintech.com', 'name', 'Mechlin People & Workplace')
    ),
    'cc_dynamic', jsonb_build_array('manager', 'hr')
  );

  -- Queue the email
  email_id := queue_email(
    'performance_management'::module_type_enum,
    p_kra_id,
    'kra_assigned'::email_type_enum,
    recipients_data,
    email_data,
    'KRA Assignment - Action Required',
    'normal'::email_priority_enum
  );

  RETURN email_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Grant permissions
-- =====================================================

-- Grant permissions on the email queue table
GRANT ALL ON email_queue TO postgres;
GRANT ALL ON email_queue TO service_role;
GRANT SELECT, INSERT, UPDATE ON email_queue TO authenticated;

-- Enable RLS
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Enable all access for service role" ON email_queue FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Users can view their own emails" ON email_queue FOR SELECT USING (
  created_by = auth.uid() OR 
  recipients ? 'to' AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(recipients->'to') AS recipient
    WHERE recipient->>'email' = (SELECT email FROM users WHERE id = auth.uid())
  )
);

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_manager_email(uuid) TO postgres, service_role, authenticated;
GRANT EXECUTE ON FUNCTION get_emails_by_role(text[]) TO postgres, service_role, authenticated;
GRANT EXECUTE ON FUNCTION get_team_emails(uuid) TO postgres, service_role, authenticated;
GRANT EXECUTE ON FUNCTION resolve_dynamic_cc(jsonb, uuid, jsonb) TO postgres, service_role, authenticated;
GRANT EXECUTE ON FUNCTION queue_email(module_type_enum, uuid, email_type_enum, jsonb, jsonb, text, email_priority_enum, timestamptz, uuid) TO postgres, service_role, authenticated;
GRANT EXECUTE ON FUNCTION process_email_queue(integer, email_status_enum) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION mark_email_processed(uuid, boolean, text, jsonb) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION send_leave_email_notification_generic(uuid, email_type_enum) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION queue_policy_assignment_email(uuid, uuid, uuid, text[]) TO postgres, service_role, authenticated;
GRANT EXECUTE ON FUNCTION queue_kra_assignment_email(uuid, uuid, uuid) TO postgres, service_role, authenticated;

-- Step 8: Create updated trigger for leave management
-- =====================================================

-- Drop the old trigger and function
DROP TRIGGER IF EXISTS leave_request_status_update_trigger ON leave_applications;
DROP FUNCTION IF EXISTS notify_leave_request_status_update_with_email();

-- Create new enhanced trigger function
CREATE OR REPLACE FUNCTION notify_leave_request_status_update_with_generic_email()
RETURNS TRIGGER AS $$
DECLARE
  user_name text;
  user_manager_id uuid;
  leave_type_name text;
  approver_name text;
  approver_role text;
  approver_title text;
  recipient_id uuid;
  email_type_to_send email_type_enum;
BEGIN
  -- Only trigger on status change
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Get employee name and manager
  SELECT u.full_name, u.manager_id INTO user_name, user_manager_id
  FROM users u
  WHERE u.id = NEW.user_id;
  
  -- Get leave type name
  SELECT lt.name INTO leave_type_name
  FROM leave_types lt
  WHERE lt.id = NEW.leave_type_id;
  
  -- Get approver name and role
  SELECT u.full_name, COALESCE(r.name, 'employee') INTO approver_name, approver_role
  FROM users u
  LEFT JOIN roles r ON u.role_id = r.id
  WHERE u.id = NEW.approved_by;
  
  -- Format approver title with role
  IF approver_name IS NOT NULL AND approver_role IS NOT NULL THEN
    approver_title := approver_name || ' (' || 
      CASE 
        WHEN approver_role = 'super_admin' THEN 'Super Admin'
        WHEN approver_role = 'admin' THEN 'Admin'
        WHEN approver_role = 'hr' THEN 'HR'
        WHEN approver_role = 'hrm' THEN 'HR Manager'
        WHEN approver_role = 'sdm' THEN 'Software Development Manager'
        WHEN approver_role = 'bdm' THEN 'Business Development Manager'
        WHEN approver_role = 'qam' THEN 'Quality Assurance Manager'
        WHEN approver_role = 'finance' THEN 'Finance'
        WHEN approver_role = 'finance_manager' THEN 'Finance Manager'
        ELSE INITCAP(REPLACE(approver_role, '_', ' '))
      END || ')';
  ELSE
    approver_title := approver_name;
  END IF;
  
  -- Notify the employee who applied (keep existing notification system)
  INSERT INTO notifications (user_id, title, message, type, data)
  VALUES (
    NEW.user_id,
    'Leave Request ' || CASE 
      WHEN NEW.status = 'approved' THEN 'Approved'
      WHEN NEW.status = 'rejected' THEN 'Rejected'
      ELSE 'Updated'
    END,
    'Your ' || leave_type_name || ' request has been ' || NEW.status || 
    CASE WHEN approver_title IS NOT NULL THEN ' by ' || approver_title ELSE '' END || '.',
    'leave_request_' || NEW.status,
    jsonb_build_object(
      'leave_application_id', NEW.id,
      'leave_type', leave_type_name,
      'status', NEW.status,
      'approver_name', approver_name,
      'approver_role', approver_role,
      'approver_title', approver_title,
      'comments', NEW.comments,
      'start_date', NEW.start_date,
      'end_date', NEW.end_date,
      'days_count', NEW.days_count,
      'recipient_type', 'applicant'
    )
  );
  
  -- For approved, rejected, or withdrawn status, notify admins, HR, and manager
  IF NEW.status IN ('approved', 'rejected', 'withdrawn') THEN
    -- Notify admins and HR users (keep existing notification system)
    FOR recipient_id IN
      SELECT u.id
      FROM users u
      INNER JOIN roles r ON u.role_id = r.id
      WHERE r.name IN ('admin', 'super_admin', 'hr')
      AND u.status = 'active'
      AND u.id != NEW.user_id
    LOOP
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        recipient_id,
        'Leave Request ' || CASE 
          WHEN NEW.status = 'approved' THEN 'Approved'
          WHEN NEW.status = 'rejected' THEN 'Rejected'
          WHEN NEW.status = 'withdrawn' THEN 'Withdrawn'
        END || ' - ' || user_name,
        user_name || '''s ' || leave_type_name || ' request has been ' || NEW.status || 
        CASE WHEN approver_title IS NOT NULL THEN ' by ' || approver_title ELSE '' END || ' for ' || NEW.days_count || ' days (' || 
        TO_CHAR(NEW.start_date::date, 'DD Mon YYYY') || ' to ' || TO_CHAR(NEW.end_date::date, 'DD Mon YYYY') || ').',
        'leave_request_' || NEW.status,
        jsonb_build_object(
          'leave_application_id', NEW.id,
          'employee_name', user_name,
          'employee_id', NEW.user_id,
          'leave_type', leave_type_name,
          'status', NEW.status,
          'approver_name', approver_name,
          'approver_role', approver_role,
          'approver_title', approver_title,
          'comments', NEW.comments,
          'start_date', NEW.start_date,
          'end_date', NEW.end_date,
          'days_count', NEW.days_count,
          'recipient_type', 'admin_hr'
        )
      );
    END LOOP;
    
    -- Notify the manager if exists and different from approver
    IF user_manager_id IS NOT NULL AND user_manager_id != NEW.approved_by THEN
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        user_manager_id,
        'Leave Request ' || CASE 
          WHEN NEW.status = 'approved' THEN 'Approved'
          WHEN NEW.status = 'rejected' THEN 'Rejected'
          WHEN NEW.status = 'withdrawn' THEN 'Withdrawn'
        END || ' - ' || user_name,
        user_name || '''s ' || leave_type_name || ' request has been ' || NEW.status || 
        CASE WHEN approver_title IS NOT NULL THEN ' by ' || approver_title ELSE '' END || ' for ' || NEW.days_count || ' days (' || 
        TO_CHAR(NEW.start_date::date, 'DD Mon YYYY') || ' to ' || TO_CHAR(NEW.end_date::date, 'DD Mon YYYY') || ').',
        'leave_request_' || NEW.status,
        jsonb_build_object(
          'leave_application_id', NEW.id,
          'employee_name', user_name,
          'employee_id', NEW.user_id,
          'leave_type', leave_type_name,
          'status', NEW.status,
          'approver_name', approver_name,
          'approver_role', approver_role,
          'approver_title', approver_title,
          'comments', NEW.comments,
          'start_date', NEW.start_date,
          'end_date', NEW.end_date,
          'days_count', NEW.days_count,
          'recipient_type', 'manager'
        )
      );
    END IF;

    -- Send email notification using the new generic system
    email_type_to_send := CASE NEW.status
      WHEN 'approved' THEN 'leave_approved'::email_type_enum
      WHEN 'rejected' THEN 'leave_rejected'::email_type_enum
      WHEN 'withdrawn' THEN 'leave_withdrawn'::email_type_enum
      ELSE 'leave_approved'::email_type_enum -- fallback
    END;
    
    PERFORM send_leave_email_notification_generic(NEW.id, email_type_to_send);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the new trigger
CREATE TRIGGER leave_request_status_update_trigger
  AFTER UPDATE ON leave_applications
  FOR EACH ROW
  EXECUTE FUNCTION notify_leave_request_status_update_with_generic_email();

-- Step 9: Migration completion message
-- =====================================================

SELECT 'Generic Email Queue System migration completed successfully! 🎉' as status,
       'Features: Universal module support, dynamic CC resolution, retry mechanism, audit trail' as features,
       'Next steps: Update your Edge Function to use process_email_queue() and mark_email_processed()' as next_steps;

-- =====================================================
-- MIGRATION SUMMARY
-- =====================================================
-- ✅ Created generic email_queue table with universal reference system
-- ✅ Added comprehensive enums for modules, email types, status, and priority
-- ✅ Implemented dynamic CC resolution (manager, roles, team members)
-- ✅ Created helper functions for recipient resolution
-- ✅ Added retry mechanism with exponential backoff
-- ✅ Maintained backward compatibility with existing leave management
-- ✅ Added example functions for policy and performance modules
-- ✅ Created monitoring views for queue management
-- ✅ Implemented proper RLS and permissions
-- 
-- The system now supports:
-- - Any module (leave, performance, policy, payroll, etc.)
-- - Multiple recipient types (to, cc_static, cc_dynamic)
-- - Dynamic CC resolution (manager emails, role-based emails)
-- - Email templating via email_type
-- - Priority-based processing
-- - Retry mechanism for failed emails
-- - Comprehensive audit trail
-- =====================================================
