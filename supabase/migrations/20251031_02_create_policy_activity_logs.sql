-- Create policy activity logs system
-- Migration: 20251031_02_create_policy_activity_logs.sql

-- Create policy activity logs table
CREATE TABLE IF NOT EXISTS policy_activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    policy_id UUID, -- Made nullable to support orphaned logs
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'activate', 'deactivate'
    
    -- Policy details at time of action
    policy_name VARCHAR(255) NOT NULL,
    policy_version INTEGER,
    
    -- Change tracking - stores only specific changes, not full content
    changes JSONB, -- Detailed change information including field-level changes
    
    -- Metadata
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraint with proper CASCADE behavior (only if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'policy_activity_logs_policy_id_fkey' 
        AND table_name = 'policy_activity_logs'
    ) THEN
        ALTER TABLE policy_activity_logs 
        ADD CONSTRAINT policy_activity_logs_policy_id_fkey 
        FOREIGN KEY (policy_id) REFERENCES policies(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_policy_activity_logs_policy_id ON policy_activity_logs(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_activity_logs_user_id ON policy_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_policy_activity_logs_action ON policy_activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_policy_activity_logs_created_at ON policy_activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_policy_activity_logs_policy_name ON policy_activity_logs(policy_name);

-- Create function to log policy activity
CREATE OR REPLACE FUNCTION log_policy_activity(
    p_policy_id UUID,
    p_user_id UUID,
    p_action VARCHAR(50),
    p_policy_name VARCHAR(255),
    p_policy_version INTEGER DEFAULT NULL,
    p_changes JSONB DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    -- Insert activity log
    INSERT INTO policy_activity_logs (
        policy_id, 
        user_id, 
        action, 
        policy_name, 
        policy_version,
        changes,
        user_agent
    ) VALUES (
        p_policy_id, 
        p_user_id, 
        p_action, 
        p_policy_name, 
        p_policy_version,
        p_changes,
        p_user_agent
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_policy_activity_log ON policies;

-- Create trigger function to automatically log policy changes
CREATE OR REPLACE FUNCTION trigger_log_policy_activity()
RETURNS TRIGGER AS $$
DECLARE
    changes_json JSONB := '{}';
    user_id_val UUID;
    content_changes JSONB;
BEGIN
    -- Get user ID from current context (you may need to adjust this based on your auth setup)
    -- For now, we'll use the updated_by field if available
    user_id_val := COALESCE(NEW.updated_by, OLD.updated_by);
    
    IF TG_OP = 'INSERT' THEN
        -- Log policy creation with basic info
        changes_json := jsonb_build_object(
            'action_type', 'create',
            'policy_name', NEW.name,
            'content_length', LENGTH(NEW.content),
            'is_active', NEW.is_active
        );
        
        PERFORM log_policy_activity(
            NEW.id,
            NEW.created_by,
            'create',
            NEW.name,
            NEW.version,
            changes_json
        );
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Track specific field changes
        IF OLD.name IS DISTINCT FROM NEW.name THEN
            changes_json := changes_json || jsonb_build_object('name', jsonb_build_object('from', OLD.name, 'to', NEW.name));
        END IF;
        
        IF OLD.version IS DISTINCT FROM NEW.version THEN
            changes_json := changes_json || jsonb_build_object('version', jsonb_build_object('from', OLD.version, 'to', NEW.version));
        END IF;
        
        -- Track content changes with more detail
        IF OLD.content IS DISTINCT FROM NEW.content THEN
            content_changes := jsonb_build_object(
                'content_changed', true,
                'old_length', LENGTH(OLD.content),
                'new_length', LENGTH(NEW.content),
                'size_change', LENGTH(NEW.content) - LENGTH(OLD.content)
            );
            
            -- Store full content for all changes (no length restrictions)
            content_changes := content_changes || jsonb_build_object(
                'old_preview', OLD.content,
                'new_preview', NEW.content,
                'preview_type', 'full'
            );
            
            changes_json := changes_json || jsonb_build_object('content', content_changes);
        END IF;
        
        -- Track status changes
        IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
            changes_json := changes_json || jsonb_build_object('is_active', jsonb_build_object('from', OLD.is_active, 'to', NEW.is_active));
            
            -- Log activation/deactivation as separate action
            PERFORM log_policy_activity(
                NEW.id,
                user_id_val,
                CASE WHEN NEW.is_active THEN 'activate' ELSE 'deactivate' END,
                NEW.name,
                NEW.version,
                jsonb_build_object(
                    'action_type', CASE WHEN NEW.is_active THEN 'activate' ELSE 'deactivate' END,
                    'previous_status', OLD.is_active,
                    'new_status', NEW.is_active
                )
            );
        END IF;
        
        -- Log update if there are actual changes
        IF changes_json != '{}' THEN
            changes_json := changes_json || jsonb_build_object('action_type', 'update');
            
            PERFORM log_policy_activity(
                NEW.id,
                user_id_val,
                'update',
                NEW.name,
                NEW.version,
                changes_json
            );
        END IF;
        
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        -- Log policy deletion with summary info
        changes_json := jsonb_build_object(
            'action_type', 'delete',
            'policy_name', OLD.name,
            'final_version', OLD.version,
            'was_active', OLD.is_active,
            'content_length', LENGTH(OLD.content)
        );
        
        PERFORM log_policy_activity(
            OLD.id,
            user_id_val,
            'delete',
            OLD.name,
            OLD.version,
            changes_json
        );
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create BEFORE trigger for UPDATE and DELETE (better timing)
DROP TRIGGER IF EXISTS trigger_policy_activity_log_before ON policies;
CREATE TRIGGER trigger_policy_activity_log_before
    BEFORE UPDATE OR DELETE ON policies
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_policy_activity();

-- Create separate AFTER INSERT trigger for creation logging (ensures policy exists)
CREATE OR REPLACE FUNCTION trigger_log_policy_creation()
RETURNS TRIGGER AS $$
DECLARE
    changes_json JSONB := '{}';
BEGIN
    -- Log policy creation with basic info
    changes_json := jsonb_build_object(
        'action_type', 'create',
        'policy_name', NEW.name,
        'content_length', LENGTH(NEW.content),
        'is_active', NEW.is_active
    );
    
    -- Use the log_policy_activity function
    PERFORM log_policy_activity(
        NEW.id,
        NEW.created_by,
        'create',
        NEW.name,
        NEW.version,
        changes_json
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create AFTER INSERT trigger to ensure policy exists when logging
DROP TRIGGER IF EXISTS trigger_policy_activity_log_after_insert ON policies;
CREATE TRIGGER trigger_policy_activity_log_after_insert
    AFTER INSERT ON policies
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_policy_creation();

-- Create function to get policy activity logs with pagination
CREATE OR REPLACE FUNCTION get_policy_activity_logs(
    p_policy_id UUID DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_action VARCHAR(50) DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    policy_id UUID,
    user_id UUID,
    action VARCHAR(50),
    policy_name VARCHAR(255),
    policy_version INTEGER,
    changes JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    user_full_name TEXT,
    user_email TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pal.id,
        pal.policy_id,
        pal.user_id,
        pal.action,
        pal.policy_name,
        pal.policy_version,
        pal.changes,
        pal.created_at,
        u.full_name as user_full_name,
        u.email as user_email
    FROM policy_activity_logs pal
    LEFT JOIN users u ON pal.user_id = u.id
    WHERE 
        (p_policy_id IS NULL OR pal.policy_id = p_policy_id) AND
        (p_user_id IS NULL OR pal.user_id = p_user_id) AND
        (p_action IS NULL OR pal.action = p_action)
    ORDER BY pal.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Create function to get activity summary stats
CREATE OR REPLACE FUNCTION get_policy_activity_stats()
RETURNS TABLE (
    total_activities BIGINT,
    creates BIGINT,
    updates BIGINT,
    deletes BIGINT,
    activations BIGINT,
    deactivations BIGINT,
    recent_activity_count BIGINT -- last 24 hours
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_activities,
        COUNT(*) FILTER (WHERE action = 'create') as creates,
        COUNT(*) FILTER (WHERE action = 'update') as updates,
        COUNT(*) FILTER (WHERE action = 'delete') as deletes,
        COUNT(*) FILTER (WHERE action = 'activate') as activations,
        COUNT(*) FILTER (WHERE action = 'deactivate') as deactivations,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as recent_activity_count
    FROM policy_activity_logs;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
-- Note: Adjust these grants based on your specific role setup
-- GRANT USAGE ON SCHEMA public TO your_app_role;
-- GRANT ALL ON policy_activity_logs TO your_app_role;
-- GRANT EXECUTE ON FUNCTION log_policy_activity TO your_app_role;
-- GRANT EXECUTE ON FUNCTION get_policy_activity_logs TO your_app_role;
-- GRANT EXECUTE ON FUNCTION get_policy_activity_stats TO your_app_role;

-- Example of changes JSONB structure:
-- For CREATE action:
-- {
--   "action_type": "create",
--   "policy_name": "New Policy",
--   "content_length": 1500,
--   "is_active": true
-- }
--
-- For UPDATE action:
-- {
--   "action_type": "update",
--   "name": {"from": "Old Name", "to": "New Name"},
--   "version": {"from": 1, "to": 2},
--   "content": {
--     "content_changed": true,
--     "old_length": 1200,
--     "new_length": 1500,
--     "size_change": 300,
--     "old_preview": "First 200 chars of old content...",
--     "new_preview": "First 200 chars of new content..."
--   },
--   "is_active": {"from": false, "to": true}
-- }
--
-- For DELETE action:
-- {
--   "action_type": "delete",
--   "policy_name": "Deleted Policy",
--   "final_version": 3,
--   "was_active": true,
--   "content_length": 2000
-- }
