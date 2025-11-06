-- Create policy assignments table for assigning policies to employees
-- Migration: 20251104_01_create_policy_assignments.sql

-- Create policy assignments table
CREATE TABLE IF NOT EXISTS policy_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    policy_id UUID REFERENCES policies(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    due_date DATE,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'overdue')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Note: No unique constraint on (policy_id, user_id) to allow multiple assignments
-- when policies are updated and need to be reviewed again

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_policy_assignments_policy_id ON policy_assignments(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_assignments_user_id ON policy_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_policy_assignments_assigned_by ON policy_assignments(assigned_by);
CREATE INDEX IF NOT EXISTS idx_policy_assignments_status ON policy_assignments(status);
CREATE INDEX IF NOT EXISTS idx_policy_assignments_due_date ON policy_assignments(due_date);
CREATE INDEX IF NOT EXISTS idx_policy_assignments_assigned_at ON policy_assignments(assigned_at);
CREATE INDEX IF NOT EXISTS idx_policy_assignments_acknowledged_at ON policy_assignments(acknowledged_at);

-- Create updated_at trigger for policy_assignments
CREATE TRIGGER trigger_update_policy_assignments_updated_at
    BEFORE UPDATE ON policy_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_policies_updated_at();

-- Create function to automatically update status based on due_date
CREATE OR REPLACE FUNCTION update_policy_assignment_status()
RETURNS TRIGGER AS $$
BEGIN
    -- If acknowledged, status is always acknowledged
    IF NEW.acknowledged_at IS NOT NULL THEN
        NEW.status = 'acknowledged';
    -- If due_date is past and not acknowledged, mark as overdue
    ELSIF NEW.due_date IS NOT NULL AND NEW.due_date < CURRENT_DATE AND NEW.acknowledged_at IS NULL THEN
        NEW.status = 'overdue';
    -- Otherwise, keep as pending
    ELSE
        NEW.status = 'pending';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update status on insert/update
CREATE TRIGGER trigger_update_policy_assignment_status
    BEFORE INSERT OR UPDATE ON policy_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_policy_assignment_status();

-- Create function to update overdue assignments periodically (can be called via cron job)
CREATE OR REPLACE FUNCTION update_overdue_policy_assignments()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE policy_assignments
    SET status = 'overdue',
        updated_at = NOW()
    WHERE status = 'pending'
      AND due_date IS NOT NULL
      AND due_date < CURRENT_DATE
      AND acknowledged_at IS NULL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
-- Note: Adjust these grants based on your specific role setup
-- GRANT ALL ON policy_assignments TO your_app_role;

-- Add comments for documentation
COMMENT ON TABLE policy_assignments IS 'Stores assignments of policies to employees for review and acknowledgement';
COMMENT ON COLUMN policy_assignments.policy_id IS 'Reference to the policy being assigned';
COMMENT ON COLUMN policy_assignments.user_id IS 'Reference to the employee/user the policy is assigned to';
COMMENT ON COLUMN policy_assignments.assigned_by IS 'Reference to the user who created this assignment';
COMMENT ON COLUMN policy_assignments.due_date IS 'Optional due date for acknowledgement';
COMMENT ON COLUMN policy_assignments.acknowledged_at IS 'Timestamp when the employee acknowledged the policy';
COMMENT ON COLUMN policy_assignments.status IS 'Status: pending, acknowledged, or overdue';
COMMENT ON COLUMN policy_assignments.notes IS 'Optional notes or instructions for the assignment';

