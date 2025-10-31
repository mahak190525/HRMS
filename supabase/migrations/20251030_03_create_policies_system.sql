-- Create policies system with role-based access control
-- Migration: 20251030_03_create_policies_system.sql

-- Create policies table
CREATE TABLE IF NOT EXISTS policies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create policy versions table for version history
CREATE TABLE IF NOT EXISTS policy_versions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    policy_id UUID REFERENCES policies(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(policy_id, version)
);

-- Create policy permissions table for role-based access
CREATE TABLE IF NOT EXISTS policy_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    policy_id UUID REFERENCES policies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(100), -- Can be specific role or 'all' for all roles
    can_read BOOLEAN DEFAULT true,
    can_write BOOLEAN DEFAULT false,
    can_delete BOOLEAN DEFAULT false,
    granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(policy_id, user_id),
    UNIQUE(policy_id, role)
);

-- Create policy access logs for audit trail
CREATE TABLE IF NOT EXISTS policy_access_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    policy_id UUID REFERENCES policies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- 'read', 'write', 'delete', 'create'
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_policies_name ON policies(name);
CREATE INDEX IF NOT EXISTS idx_policies_active ON policies(is_active);
CREATE INDEX IF NOT EXISTS idx_policies_created_at ON policies(created_at);

CREATE INDEX IF NOT EXISTS idx_policy_versions_policy_id ON policy_versions(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_versions_version ON policy_versions(policy_id, version);

CREATE INDEX IF NOT EXISTS idx_policy_permissions_policy_id ON policy_permissions(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_permissions_user_id ON policy_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_policy_permissions_role ON policy_permissions(role);

CREATE INDEX IF NOT EXISTS idx_policy_access_logs_policy_id ON policy_access_logs(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_access_logs_user_id ON policy_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_policy_access_logs_created_at ON policy_access_logs(created_at);

-- Create updated_at trigger for policies
CREATE OR REPLACE FUNCTION update_policies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_policies_updated_at
    BEFORE UPDATE ON policies
    FOR EACH ROW
    EXECUTE FUNCTION update_policies_updated_at();

-- Create updated_at trigger for policy_permissions
CREATE TRIGGER trigger_update_policy_permissions_updated_at
    BEFORE UPDATE ON policy_permissions
    FOR EACH ROW
    EXECUTE FUNCTION update_policies_updated_at();

-- Create function to automatically create policy version on update
CREATE OR REPLACE FUNCTION create_policy_version()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create version if content actually changed
    IF OLD.content IS DISTINCT FROM NEW.content OR 
       OLD.name IS DISTINCT FROM NEW.name THEN
        
        -- Increment version number
        NEW.version = OLD.version + 1;
        
        -- Insert into policy_versions
        INSERT INTO policy_versions (
            policy_id, version, name, content, created_by
        ) VALUES (
            NEW.id, OLD.version, OLD.name, OLD.content, NEW.updated_by
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_policy_version
    BEFORE UPDATE ON policies
    FOR EACH ROW
    EXECUTE FUNCTION create_policy_version();

-- No default categories needed for simplified version

-- RLS disabled for simplified public schema usage
-- You can enable RLS later if needed and implement your own authentication logic
-- ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE policy_versions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE policy_permissions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE policy_access_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies commented out since auth schema is not being used
-- You can implement your own access control logic in your application layer
-- or enable RLS later with your custom authentication system

/*
-- Example RLS policies (commented out):
CREATE POLICY "Users can read policies they have access to" ON policies
    FOR SELECT USING (
        -- Your custom authentication logic here
        true -- For now, allow all reads
    );

CREATE POLICY "Admin/HR can create policies" ON policies
    FOR INSERT WITH CHECK (
        -- Your custom role checking logic here
        true -- For now, allow all inserts
    );
*/

-- Create function to log policy access
CREATE OR REPLACE FUNCTION log_policy_access(
    p_policy_id UUID,
    p_user_id UUID,
    p_action VARCHAR(50),
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    -- Insert access log
    INSERT INTO policy_access_logs (
        policy_id, user_id, action, ip_address, user_agent
    ) VALUES (
        p_policy_id, p_user_id, p_action, p_ip_address, p_user_agent
    );
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
-- Note: Adjust these grants based on your specific role setup
-- GRANT USAGE ON SCHEMA public TO your_app_role;
-- GRANT ALL ON policies TO your_app_role;
-- GRANT ALL ON policy_versions TO your_app_role;
-- GRANT ALL ON policy_permissions TO your_app_role;
-- GRANT ALL ON policy_access_logs TO your_app_role;

-- Grant execute permission on functions
-- GRANT EXECUTE ON FUNCTION log_policy_access TO your_app_role;
