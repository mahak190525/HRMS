-- Migration: Create Office Admin and IT Helpdesk roles with asset management permissions
-- Created: 2025-12-01
-- Purpose: Add specialized roles for asset management with specific permissions

-- Create the new roles
INSERT INTO roles (id, name, description) VALUES 
(gen_random_uuid(), 'office_admin', 'Office Administrator - Manages all assets except VMs'),
(gen_random_uuid(), 'it_helpdesk', 'IT Helpdesk - Manages VMs and IT-related assets only')
ON CONFLICT (name) DO NOTHING;

-- Create asset management permissions table
CREATE TABLE IF NOT EXISTS asset_management_permissions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    role_name text NOT NULL,
    can_view_assets boolean DEFAULT false,
    can_create_assets boolean DEFAULT false,
    can_edit_assets boolean DEFAULT false,
    can_delete_assets boolean DEFAULT false,
    can_assign_assets boolean DEFAULT false,
    can_manage_vms boolean DEFAULT false,
    can_view_vm_details boolean DEFAULT false,
    can_create_vms boolean DEFAULT false,
    can_edit_vms boolean DEFAULT false,
    can_delete_vms boolean DEFAULT false,
    can_assign_vms boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(role_name)
);

-- Insert permissions for Office Admin
INSERT INTO asset_management_permissions (
    role_name,
    can_view_assets,
    can_create_assets,
    can_edit_assets,
    can_delete_assets,
    can_assign_assets,
    can_manage_vms,
    can_view_vm_details,
    can_create_vms,
    can_edit_vms,
    can_delete_vms,
    can_assign_vms
) VALUES (
    'office_admin',
    true,   -- can_view_assets
    true,   -- can_create_assets
    true,   -- can_edit_assets
    true,   -- can_delete_assets
    true,   -- can_assign_assets
    false,  -- can_manage_vms (CANNOT manage VMs)
    false,  -- can_view_vm_details
    false,  -- can_create_vms
    false,  -- can_edit_vms
    false,  -- can_delete_vms
    false   -- can_assign_vms
) ON CONFLICT (role_name) DO UPDATE SET
    can_view_assets = EXCLUDED.can_view_assets,
    can_create_assets = EXCLUDED.can_create_assets,
    can_edit_assets = EXCLUDED.can_edit_assets,
    can_delete_assets = EXCLUDED.can_delete_assets,
    can_assign_assets = EXCLUDED.can_assign_assets,
    can_manage_vms = EXCLUDED.can_manage_vms,
    can_view_vm_details = EXCLUDED.can_view_vm_details,
    can_create_vms = EXCLUDED.can_create_vms,
    can_edit_vms = EXCLUDED.can_edit_vms,
    can_delete_vms = EXCLUDED.can_delete_vms,
    can_assign_vms = EXCLUDED.can_assign_vms,
    updated_at = timezone('utc'::text, now());

-- Insert permissions for IT Helpdesk
INSERT INTO asset_management_permissions (
    role_name,
    can_view_assets,
    can_create_assets,
    can_edit_assets,
    can_delete_assets,
    can_assign_assets,
    can_manage_vms,
    can_view_vm_details,
    can_create_vms,
    can_edit_vms,
    can_delete_vms,
    can_assign_vms
) VALUES (
    'it_helpdesk',
    false,  -- can_view_assets (CANNOT manage regular assets)
    false,  -- can_create_assets
    false,  -- can_edit_assets
    false,  -- can_delete_assets
    false,  -- can_assign_assets
    true,   -- can_manage_vms (CAN manage VMs)
    true,   -- can_view_vm_details
    true,   -- can_create_vms
    true,   -- can_edit_vms
    true,   -- can_delete_vms
    true    -- can_assign_vms
) ON CONFLICT (role_name) DO UPDATE SET
    can_view_assets = EXCLUDED.can_view_assets,
    can_create_assets = EXCLUDED.can_create_assets,
    can_edit_assets = EXCLUDED.can_edit_assets,
    can_delete_assets = EXCLUDED.can_delete_assets,
    can_assign_assets = EXCLUDED.can_assign_assets,
    can_manage_vms = EXCLUDED.can_manage_vms,
    can_view_vm_details = EXCLUDED.can_view_vm_details,
    can_create_vms = EXCLUDED.can_create_vms,
    can_edit_vms = EXCLUDED.can_edit_vms,
    can_delete_vms = EXCLUDED.can_delete_vms,
    can_assign_vms = EXCLUDED.can_assign_vms,
    updated_at = timezone('utc'::text, now());

-- Remove asset management access from HR/HRM roles
INSERT INTO asset_management_permissions (
    role_name,
    can_view_assets,
    can_create_assets,
    can_edit_assets,
    can_delete_assets,
    can_assign_assets,
    can_manage_vms,
    can_view_vm_details,
    can_create_vms,
    can_edit_vms,
    can_delete_vms,
    can_assign_vms
) VALUES 
('hr', false, false, false, false, false, false, false, false, false, false, false),
('hrm', false, false, false, false, false, false, false, false, false, false, false)
ON CONFLICT (role_name) DO UPDATE SET
    can_view_assets = EXCLUDED.can_view_assets,
    can_create_assets = EXCLUDED.can_create_assets,
    can_edit_assets = EXCLUDED.can_edit_assets,
    can_delete_assets = EXCLUDED.can_delete_assets,
    can_assign_assets = EXCLUDED.can_assign_assets,
    can_manage_vms = EXCLUDED.can_manage_vms,
    can_view_vm_details = EXCLUDED.can_view_vm_details,
    can_create_vms = EXCLUDED.can_create_vms,
    can_edit_vms = EXCLUDED.can_edit_vms,
    can_delete_vms = EXCLUDED.can_delete_vms,
    can_assign_vms = EXCLUDED.can_assign_vms,
    updated_at = timezone('utc'::text, now());

-- Create function to get user asset management permissions
CREATE OR REPLACE FUNCTION get_user_asset_permissions(user_id uuid)
RETURNS TABLE (
    can_view_assets boolean,
    can_create_assets boolean,
    can_edit_assets boolean,
    can_delete_assets boolean,
    can_assign_assets boolean,
    can_manage_vms boolean,
    can_view_vm_details boolean,
    can_create_vms boolean,
    can_edit_vms boolean,
    can_delete_vms boolean,
    can_assign_vms boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_roles text[];
    role_name text;
    permissions record;
    result_permissions record := (false, false, false, false, false, false, false, false, false, false, false);
BEGIN
    -- Get all user roles (primary + additional)
    SELECT get_user_all_role_names(user_id) INTO user_roles;
    
    -- Check if user is admin (admins have all permissions)
    IF 'admin' = ANY(user_roles) OR 'super_admin' = ANY(user_roles) THEN
        RETURN QUERY SELECT true, true, true, true, true, true, true, true, true, true, true;
        RETURN;
    END IF;
    
    -- Aggregate permissions from all roles
    FOREACH role_name IN ARRAY user_roles LOOP
        SELECT * INTO permissions FROM asset_management_permissions WHERE asset_management_permissions.role_name = role_name;
        
        IF FOUND THEN
            -- OR operation - if any role has permission, user has it
            result_permissions.can_view_assets := result_permissions.can_view_assets OR permissions.can_view_assets;
            result_permissions.can_create_assets := result_permissions.can_create_assets OR permissions.can_create_assets;
            result_permissions.can_edit_assets := result_permissions.can_edit_assets OR permissions.can_edit_assets;
            result_permissions.can_delete_assets := result_permissions.can_delete_assets OR permissions.can_delete_assets;
            result_permissions.can_assign_assets := result_permissions.can_assign_assets OR permissions.can_assign_assets;
            result_permissions.can_manage_vms := result_permissions.can_manage_vms OR permissions.can_manage_vms;
            result_permissions.can_view_vm_details := result_permissions.can_view_vm_details OR permissions.can_view_vm_details;
            result_permissions.can_create_vms := result_permissions.can_create_vms OR permissions.can_create_vms;
            result_permissions.can_edit_vms := result_permissions.can_edit_vms OR permissions.can_edit_vms;
            result_permissions.can_delete_vms := result_permissions.can_delete_vms OR permissions.can_delete_vms;
            result_permissions.can_assign_vms := result_permissions.can_assign_vms OR permissions.can_assign_vms;
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT 
        result_permissions.can_view_assets,
        result_permissions.can_create_assets,
        result_permissions.can_edit_assets,
        result_permissions.can_delete_assets,
        result_permissions.can_assign_assets,
        result_permissions.can_manage_vms,
        result_permissions.can_view_vm_details,
        result_permissions.can_create_vms,
        result_permissions.can_edit_vms,
        result_permissions.can_delete_vms,
        result_permissions.can_assign_vms;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_asset_permissions(uuid) TO authenticated;

-- Add helpful comments
COMMENT ON TABLE asset_management_permissions IS 'Role-based permissions for asset management functionality';
COMMENT ON FUNCTION get_user_asset_permissions(uuid) IS 'Returns aggregated asset management permissions for a user based on all their roles';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_asset_management_permissions_role_name ON asset_management_permissions(role_name);
CREATE INDEX IF NOT EXISTS idx_asset_management_permissions_created_at ON asset_management_permissions(created_at);
