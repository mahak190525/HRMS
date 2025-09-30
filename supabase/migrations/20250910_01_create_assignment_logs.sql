-- Migration: Create assignment logs table to track asset assignment history
-- This table will store every status change when assets are assigned/unassigned

-- Create assignment_logs table
CREATE TABLE assignment_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    assignment_id UUID REFERENCES asset_assignments(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- 'assigned', 'unassigned', 'updated', 'transferred'
    status VARCHAR(50) NOT NULL, -- 'active', 'returned', 'transferred'
    
    -- Previous state (for updates)
    previous_status VARCHAR(50),
    previous_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Assignment details at time of action
    assignment_type VARCHAR(50), -- 'permanent', 'temporary'
    assignment_expiry_date DATE,
    
    -- Asset condition tracking
    condition_at_action VARCHAR(50), -- condition when this action occurred
    condition_notes TEXT,
    
    -- Action metadata
    action_by UUID REFERENCES users(id) ON DELETE SET NULL, -- who performed the action
    action_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    action_notes TEXT, -- reason for action, additional notes
    
    -- Asset snapshot (for historical reference)
    asset_name VARCHAR(255),
    asset_tag VARCHAR(100),
    asset_category VARCHAR(255),
    
    -- User snapshot (for historical reference)
    user_name VARCHAR(255),
    user_employee_id VARCHAR(100),
    user_department VARCHAR(255),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_assignment_logs_assignment_id ON assignment_logs(assignment_id);
CREATE INDEX idx_assignment_logs_asset_id ON assignment_logs(asset_id);
CREATE INDEX idx_assignment_logs_user_id ON assignment_logs(user_id);
CREATE INDEX idx_assignment_logs_action_date ON assignment_logs(action_date);
CREATE INDEX idx_assignment_logs_action ON assignment_logs(action);
CREATE INDEX idx_assignment_logs_status ON assignment_logs(status);

-- Create composite indexes for common queries
CREATE INDEX idx_assignment_logs_user_action_date ON assignment_logs(user_id, action_date DESC);
CREATE INDEX idx_assignment_logs_asset_action_date ON assignment_logs(asset_id, action_date DESC);

-- Enable RLS
ALTER TABLE assignment_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "assignment_logs_select_policy" ON assignment_logs
    FOR SELECT USING (true); -- Allow all authenticated users to read logs

CREATE POLICY "assignment_logs_insert_policy" ON assignment_logs
    FOR INSERT WITH CHECK (true); -- Allow system to insert logs

CREATE POLICY "assignment_logs_update_policy" ON assignment_logs
    FOR UPDATE USING (action_by = auth.uid()); -- Only allow updates by the person who created the log

-- Function to log assignment actions
CREATE OR REPLACE FUNCTION log_assignment_action(
    p_assignment_id UUID,
    p_action VARCHAR(50),
    p_status VARCHAR(50),
    p_action_by UUID,
    p_action_notes TEXT DEFAULT NULL,
    p_condition_at_action VARCHAR(50) DEFAULT NULL,
    p_condition_notes TEXT DEFAULT NULL,
    p_previous_status VARCHAR(50) DEFAULT NULL,
    p_previous_user_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_log_id UUID;
    v_assignment_record RECORD;
    v_asset_record RECORD;
    v_user_record RECORD;
    v_dept_name VARCHAR(255);
BEGIN
    -- Get assignment details
    SELECT * INTO v_assignment_record
    FROM asset_assignments
    WHERE id = p_assignment_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assignment not found: %', p_assignment_id;
    END IF;
    
    -- Get asset details
    SELECT a.*, c.name as category_name INTO v_asset_record
    FROM assets a
    LEFT JOIN asset_categories c ON a.category_id = c.id
    WHERE a.id = v_assignment_record.asset_id;
    
    -- Get user details
    SELECT u.*, d.name as department_name INTO v_user_record
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE u.id = v_assignment_record.user_id;
    
    -- Insert log entry
    INSERT INTO assignment_logs (
        assignment_id,
        asset_id,
        user_id,
        action,
        status,
        previous_status,
        previous_user_id,
        assignment_type,
        assignment_expiry_date,
        condition_at_action,
        condition_notes,
        action_by,
        action_date,
        action_notes,
        asset_name,
        asset_tag,
        asset_category,
        user_name,
        user_employee_id,
        user_department
    ) VALUES (
        p_assignment_id,
        v_assignment_record.asset_id,
        v_assignment_record.user_id,
        p_action,
        p_status,
        p_previous_status,
        p_previous_user_id,
        v_assignment_record.assignment_type,
        v_assignment_record.assignment_expiry_date,
        COALESCE(p_condition_at_action, v_assignment_record.condition_at_issuance),
        p_condition_notes,
        p_action_by,
        NOW(),
        p_action_notes,
        v_asset_record.name::VARCHAR(255),
        v_asset_record.asset_tag::VARCHAR(100),
        v_asset_record.category_name::VARCHAR(255),
        v_user_record.full_name::VARCHAR(255),
        v_user_record.employee_id::VARCHAR(100),
        v_user_record.department_name::VARCHAR(255)
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$;

-- Function to get assignment logs for a user
CREATE OR REPLACE FUNCTION get_user_assignment_logs(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    assignment_id UUID,
    asset_id UUID,
    action VARCHAR(50),
    status VARCHAR(50),
    previous_status VARCHAR(50),
    previous_user_id UUID,
    assignment_type VARCHAR(50),
    assignment_expiry_date DATE,
    condition_at_action VARCHAR(50),
    condition_notes TEXT,
    action_by UUID,
    action_date TIMESTAMP WITH TIME ZONE,
    action_notes TEXT,
    asset_name VARCHAR(255),
    asset_tag VARCHAR(100),
    asset_category VARCHAR(255),
    user_name VARCHAR(255),
    user_employee_id VARCHAR(100),
    user_department VARCHAR(255),
    action_by_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        al.id,
        al.assignment_id,
        al.asset_id,
        al.action::VARCHAR(50),
        al.status::VARCHAR(50),
        al.previous_status::VARCHAR(50),
        al.previous_user_id,
        al.assignment_type::VARCHAR(50),
        al.assignment_expiry_date,
        al.condition_at_action::VARCHAR(50),
        al.condition_notes,
        al.action_by,
        al.action_date,
        al.action_notes,
        al.asset_name::VARCHAR(255),
        al.asset_tag::VARCHAR(100),
        al.asset_category::VARCHAR(255),
        al.user_name::VARCHAR(255),
        al.user_employee_id::VARCHAR(100),
        al.user_department::VARCHAR(255),
        u.full_name::VARCHAR(255) as action_by_name,
        al.created_at
    FROM assignment_logs al
    LEFT JOIN users u ON al.action_by = u.id
    WHERE al.user_id = p_user_id
    ORDER BY al.action_date DESC;
END;
$$;

-- Function to get all users with assignment logs
CREATE OR REPLACE FUNCTION get_users_with_assignment_history()
RETURNS TABLE (
    user_id UUID,
    user_name VARCHAR(255),
    user_employee_id VARCHAR(100),
    user_department VARCHAR(255),
    user_status VARCHAR(50),
    total_assignments BIGINT,
    active_assignments BIGINT,
    last_assignment_date TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id as user_id,
        u.full_name::VARCHAR(255) as user_name,
        u.employee_id::VARCHAR(100) as user_employee_id,
        d.name::VARCHAR(255) as user_department,
        u.status::VARCHAR(50) as user_status,
        COUNT(DISTINCT al.assignment_id) as total_assignments,
        COUNT(DISTINCT CASE WHEN aa.is_active = true THEN al.assignment_id END) as active_assignments,
        MAX(al.action_date) as last_assignment_date
    FROM users u
    INNER JOIN assignment_logs al ON u.id = al.user_id
    LEFT JOIN departments d ON u.department_id = d.id
    LEFT JOIN asset_assignments aa ON al.assignment_id = aa.id
    GROUP BY u.id, u.full_name, u.employee_id, d.name, u.status
    ORDER BY u.full_name::VARCHAR(255);
END;
$$;

-- Trigger function to automatically log assignment changes
CREATE OR REPLACE FUNCTION trigger_log_assignment_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_action VARCHAR(50);
    v_previous_status VARCHAR(50);
    v_previous_user_id UUID;
BEGIN
    -- Determine action type
    IF TG_OP = 'INSERT' THEN
        v_action := 'assigned';
        v_previous_status := NULL;
        v_previous_user_id := NULL;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.is_active = true AND NEW.is_active = false THEN
            v_action := 'unassigned';
            v_previous_status := 'active';
        ELSIF OLD.user_id != NEW.user_id THEN
            v_action := 'transferred';
            v_previous_user_id := OLD.user_id;
            v_previous_status := 'active';
        ELSE
            v_action := 'updated';
            v_previous_status := CASE WHEN OLD.is_active THEN 'active' ELSE 'returned' END;
        END IF;
    ELSE
        RETURN NULL; -- DELETE operations are not logged
    END IF;
    
    -- Log the action
    PERFORM log_assignment_action(
        p_assignment_id := NEW.id,
        p_action := v_action,
        p_status := CASE WHEN NEW.is_active THEN 'active' ELSE 'returned' END,
        p_action_by := COALESCE(NEW.assigned_by, auth.uid()),
        p_action_notes := CASE 
            WHEN v_action = 'unassigned' THEN NEW.return_condition_notes
            WHEN v_action = 'assigned' THEN NEW.notes
            ELSE NULL
        END,
        p_condition_at_action := CASE 
            WHEN v_action = 'assigned' THEN NEW.condition_at_issuance
            WHEN v_action = 'unassigned' THEN 'returned'
            ELSE NULL
        END,
        p_condition_notes := CASE 
            WHEN v_action = 'assigned' THEN NEW.issuance_condition_notes
            WHEN v_action = 'unassigned' THEN NEW.return_condition_notes
            ELSE NULL
        END,
        p_previous_status := v_previous_status,
        p_previous_user_id := v_previous_user_id
    );
    
    RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER assignment_change_log_trigger
    AFTER INSERT OR UPDATE ON asset_assignments
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_assignment_change();

-- Create function to backfill existing assignment data
CREATE OR REPLACE FUNCTION backfill_assignment_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_assignment RECORD;
    v_count INTEGER := 0;
BEGIN
    -- Backfill existing assignments
    FOR v_assignment IN 
        SELECT * FROM asset_assignments ORDER BY assigned_date
    LOOP
        -- Log initial assignment
        PERFORM log_assignment_action(
            p_assignment_id := v_assignment.id,
            p_action := 'assigned',
            p_status := CASE WHEN v_assignment.is_active THEN 'active' ELSE 'returned' END,
            p_action_by := v_assignment.assigned_by,
            p_action_notes := v_assignment.notes,
            p_condition_at_action := v_assignment.condition_at_issuance,
            p_condition_notes := v_assignment.issuance_condition_notes
        );
        
        -- If assignment has been returned, log the return
        IF NOT v_assignment.is_active AND v_assignment.return_date IS NOT NULL THEN
            PERFORM log_assignment_action(
                p_assignment_id := v_assignment.id,
                p_action := 'unassigned',
                p_status := 'returned',
                p_action_by := v_assignment.assigned_by, -- Could be improved if we track who unassigned
                p_action_notes := v_assignment.return_condition_notes,
                p_condition_at_action := 'returned',
                p_condition_notes := v_assignment.return_condition_notes,
                p_previous_status := 'active'
            );
        END IF;
        
        v_count := v_count + 1;
    END LOOP;
    
    RETURN v_count;
END;
$$;

-- Grant permissions
GRANT SELECT, INSERT ON assignment_logs TO authenticated;
GRANT EXECUTE ON FUNCTION log_assignment_action TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_assignment_logs TO authenticated;
GRANT EXECUTE ON FUNCTION get_users_with_assignment_history TO authenticated;
GRANT EXECUTE ON FUNCTION backfill_assignment_logs TO authenticated;

-- Add helpful comments
COMMENT ON TABLE assignment_logs IS 'Stores complete audit trail of asset assignment actions and status changes';
COMMENT ON FUNCTION log_assignment_action IS 'Logs assignment actions with complete context and historical snapshots';
COMMENT ON FUNCTION get_user_assignment_logs IS 'Retrieves complete assignment history for a specific user';
COMMENT ON FUNCTION get_users_with_assignment_history IS 'Gets all users who have assignment history with summary statistics';
COMMENT ON FUNCTION backfill_assignment_logs IS 'Backfills assignment logs from existing assignment data';
