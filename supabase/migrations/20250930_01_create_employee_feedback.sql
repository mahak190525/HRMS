-- Create employee feedback table
CREATE TABLE employee_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'noted', 'resolved')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better query performance
CREATE INDEX idx_employee_feedback_employee_id ON employee_feedback(employee_id);
CREATE INDEX idx_employee_feedback_status ON employee_feedback(status);
CREATE INDEX idx_employee_feedback_created_at ON employee_feedback(created_at DESC);

-- Enable RLS
ALTER TABLE employee_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Employees can only read their own feedback
CREATE POLICY "Employees can view their own feedback" ON employee_feedback
    FOR SELECT USING (auth.uid() = employee_id);

-- Employees can insert their own feedback
CREATE POLICY "Employees can insert their own feedback" ON employee_feedback
    FOR INSERT WITH CHECK (auth.uid() = employee_id);

-- Only HR users can view all feedback
CREATE POLICY "HR users can view all feedback" ON employee_feedback
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.id = auth.uid() 
            AND r.name IN ('hr', 'admin', 'super_admin')
        )
    );

-- Only HR users can update feedback status
CREATE POLICY "HR users can update feedback status" ON employee_feedback
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.id = auth.uid() 
            AND r.name IN ('hr', 'admin', 'super_admin')
        )
    );

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_employee_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_employee_feedback_updated_at
    BEFORE UPDATE ON employee_feedback
    FOR EACH ROW
    EXECUTE FUNCTION update_employee_feedback_updated_at();

-- Grant necessary permissions
GRANT ALL ON employee_feedback TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
