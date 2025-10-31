-- Create policy dashboard permissions system
-- Migration: 20251031_01_create_policy_dashboard_permissions.sql

-- Create policy dashboard permissions table for overall policy management access
CREATE TABLE IF NOT EXISTS policy_dashboard_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(100), -- Can be specific role or null for individual permissions
    
    -- Dashboard-level permissions
    can_view_policies BOOLEAN DEFAULT true,
    can_create_policies BOOLEAN DEFAULT false,
    can_edit_policies BOOLEAN DEFAULT false,
    can_delete_policies BOOLEAN DEFAULT false,
    can_manage_permissions BOOLEAN DEFAULT false, -- Can manage other users' policy permissions
    can_view_analytics BOOLEAN DEFAULT false, -- Can view policy analytics/stats
    
    -- Additional settings
    is_active BOOLEAN DEFAULT true,
    granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure either user_id or role is set, but not both
    CONSTRAINT check_user_or_role CHECK (
        (user_id IS NOT NULL AND role IS NULL) OR 
        (user_id IS NULL AND role IS NOT NULL)
    ),
    
    -- Unique constraint for user permissions
    UNIQUE(user_id),
    -- Unique constraint for role permissions  
    UNIQUE(role)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_policy_dashboard_permissions_user_id ON policy_dashboard_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_policy_dashboard_permissions_role ON policy_dashboard_permissions(role);
CREATE INDEX IF NOT EXISTS idx_policy_dashboard_permissions_active ON policy_dashboard_permissions(is_active);

-- Create updated_at trigger for policy_dashboard_permissions
CREATE TRIGGER trigger_update_policy_dashboard_permissions_updated_at
    BEFORE UPDATE ON policy_dashboard_permissions
    FOR EACH ROW
    EXECUTE FUNCTION update_policies_updated_at();

-- Insert default role-based permissions
INSERT INTO policy_dashboard_permissions (role, can_view_policies, can_create_policies, can_edit_policies, can_delete_policies, can_manage_permissions, can_view_analytics) VALUES
    ('admin', true, true, true, true, true, true),
    ('super_admin', true, true, true, true, true, true),
    ('hr', true, true, true, true, true, true),
    ('hrm', true, true, true, true, true, true),
    ('manager', true, false, false, false, false, true),
    ('sdm', true, false, false, false, false, true),
    ('bdm', true, false, false, false, false, true),
    ('qam', true, false, false, false, false, true),
    ('finance', true, false, false, false, false, false),
    ('finance_manager', true, false, false, false, false, true),
    ('employee', true, false, false, false, false, false),
    ('intern', true, false, false, false, false, false),
    ('contractor', true, false, false, false, false, false)
ON CONFLICT (role) DO NOTHING;

-- Create function to get effective policy dashboard permissions for a user
CREATE OR REPLACE FUNCTION get_user_policy_dashboard_permissions(p_user_id UUID, p_role VARCHAR(100))
RETURNS TABLE (
    can_view_policies BOOLEAN,
    can_create_policies BOOLEAN,
    can_edit_policies BOOLEAN,
    can_delete_policies BOOLEAN,
    can_manage_permissions BOOLEAN,
    can_view_analytics BOOLEAN,
    permission_source VARCHAR(20)
) AS $$
BEGIN
    -- First check for individual user permissions
    RETURN QUERY
    SELECT 
        pdp.can_view_policies,
        pdp.can_create_policies,
        pdp.can_edit_policies,
        pdp.can_delete_policies,
        pdp.can_manage_permissions,
        pdp.can_view_analytics,
        'individual'::VARCHAR(20) as permission_source
    FROM policy_dashboard_permissions pdp
    WHERE pdp.user_id = p_user_id 
    AND pdp.is_active = true;
    
    -- If no individual permissions found, check role-based permissions
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 
            pdp.can_view_policies,
            pdp.can_create_policies,
            pdp.can_edit_policies,
            pdp.can_delete_policies,
            pdp.can_manage_permissions,
            pdp.can_view_analytics,
            'role'::VARCHAR(20) as permission_source
        FROM policy_dashboard_permissions pdp
        WHERE pdp.role = p_role 
        AND pdp.is_active = true;
    END IF;
    
    -- If still no permissions found, return default (view only)
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 
            true as can_view_policies,
            false as can_create_policies,
            false as can_edit_policies,
            false as can_delete_policies,
            false as can_manage_permissions,
            false as can_view_analytics,
            'default'::VARCHAR(20) as permission_source;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function to set user policy dashboard permissions
CREATE OR REPLACE FUNCTION set_user_policy_dashboard_permissions(
    p_user_id UUID,
    p_can_view_policies BOOLEAN DEFAULT true,
    p_can_create_policies BOOLEAN DEFAULT false,
    p_can_edit_policies BOOLEAN DEFAULT false,
    p_can_delete_policies BOOLEAN DEFAULT false,
    p_can_manage_permissions BOOLEAN DEFAULT false,
    p_can_view_analytics BOOLEAN DEFAULT false,
    p_granted_by UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    -- Insert or update user permissions
    INSERT INTO policy_dashboard_permissions (
        user_id, 
        can_view_policies, 
        can_create_policies, 
        can_edit_policies, 
        can_delete_policies, 
        can_manage_permissions, 
        can_view_analytics,
        granted_by
    ) VALUES (
        p_user_id, 
        p_can_view_policies, 
        p_can_create_policies, 
        p_can_edit_policies, 
        p_can_delete_policies, 
        p_can_manage_permissions, 
        p_can_view_analytics,
        p_granted_by
    )
    ON CONFLICT (user_id) 
    DO UPDATE SET
        can_view_policies = EXCLUDED.can_view_policies,
        can_create_policies = EXCLUDED.can_create_policies,
        can_edit_policies = EXCLUDED.can_edit_policies,
        can_delete_policies = EXCLUDED.can_delete_policies,
        can_manage_permissions = EXCLUDED.can_manage_permissions,
        can_view_analytics = EXCLUDED.can_view_analytics,
        granted_by = EXCLUDED.granted_by,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Create function to set role policy dashboard permissions
CREATE OR REPLACE FUNCTION set_role_policy_dashboard_permissions(
    p_role VARCHAR(100),
    p_can_view_policies BOOLEAN DEFAULT true,
    p_can_create_policies BOOLEAN DEFAULT false,
    p_can_edit_policies BOOLEAN DEFAULT false,
    p_can_delete_policies BOOLEAN DEFAULT false,
    p_can_manage_permissions BOOLEAN DEFAULT false,
    p_can_view_analytics BOOLEAN DEFAULT false,
    p_granted_by UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    -- Insert or update role permissions
    INSERT INTO policy_dashboard_permissions (
        role, 
        can_view_policies, 
        can_create_policies, 
        can_edit_policies, 
        can_delete_policies, 
        can_manage_permissions, 
        can_view_analytics,
        granted_by
    ) VALUES (
        p_role, 
        p_can_view_policies, 
        p_can_create_policies, 
        p_can_edit_policies, 
        p_can_delete_policies, 
        p_can_manage_permissions, 
        p_can_view_analytics,
        p_granted_by
    )
    ON CONFLICT (role) 
    DO UPDATE SET
        can_view_policies = EXCLUDED.can_view_policies,
        can_create_policies = EXCLUDED.can_create_policies,
        can_edit_policies = EXCLUDED.can_edit_policies,
        can_delete_policies = EXCLUDED.can_delete_policies,
        can_manage_permissions = EXCLUDED.can_manage_permissions,
        can_view_analytics = EXCLUDED.can_view_analytics,
        granted_by = EXCLUDED.granted_by,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
-- Note: Adjust these grants based on your specific role setup
-- GRANT USAGE ON SCHEMA public TO your_app_role;
-- GRANT ALL ON policy_dashboard_permissions TO your_app_role;
-- GRANT EXECUTE ON FUNCTION get_user_policy_dashboard_permissions TO your_app_role;
-- GRANT EXECUTE ON FUNCTION set_user_policy_dashboard_permissions TO your_app_role;
-- GRANT EXECUTE ON FUNCTION set_role_policy_dashboard_permissions TO your_app_role;
