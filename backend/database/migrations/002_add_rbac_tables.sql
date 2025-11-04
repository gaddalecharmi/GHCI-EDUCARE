-- Role-Based Access Control Migration
-- This migration adds roles, permissions, and relationships for RBAC

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(150) NOT NULL,
    description TEXT,
    resource VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Role permissions mapping
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE NOT NULL,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(role_id, permission_id)
);

-- User roles mapping (users can have multiple roles)
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE NOT NULL,
    assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(user_id, role_id)
);

-- Parent-child relationships for parent role
CREATE TABLE IF NOT EXISTS parent_child_relationships (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    parent_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    child_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    relationship_type VARCHAR(50) DEFAULT 'parent',
    is_primary BOOLEAN DEFAULT TRUE,
    can_view_progress BOOLEAN DEFAULT TRUE,
    can_manage_settings BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(parent_id, child_id)
);

-- Mentor-student relationships for mentor (NGO) role
CREATE TABLE IF NOT EXISTS mentor_student_relationships (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    mentor_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    organization_name VARCHAR(200),
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'terminated')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(mentor_id, student_id)
);

-- Activity logs for admin monitoring
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100),
    resource_id UUID,
    details JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default roles
INSERT INTO roles (name, display_name, description) VALUES
    ('student', 'Student', 'Neurodivergent learner with access to all learning features'),
    ('parent', 'Parent/Guardian', 'Parent or guardian who can monitor and support their child'),
    ('mentor', 'Mentor (NGO)', 'NGO mentor who guides and supports multiple students'),
    ('admin', 'Administrator', 'System administrator with full access')
ON CONFLICT (name) DO NOTHING;

-- Insert default permissions
INSERT INTO permissions (name, display_name, description, resource, action) VALUES
    -- Student permissions
    ('view_own_dashboard', 'View Own Dashboard', 'Access personal dashboard', 'dashboard', 'read'),
    ('manage_own_tasks', 'Manage Own Tasks', 'Create, update, delete own tasks', 'tasks', 'manage'),
    ('play_games', 'Play Games', 'Access and play educational games', 'games', 'play'),
    ('track_mood', 'Track Mood', 'Log and view mood entries', 'mood', 'manage'),
    ('use_focus_tools', 'Use Focus Tools', 'Access breathing exercises and Pomodoro timer', 'focus', 'use'),
    ('upload_documents', 'Upload Documents', 'Upload and manage learning materials', 'documents', 'manage'),
    ('join_community', 'Join Community', 'Participate in community chat', 'chat', 'participate'),
    ('view_own_progress', 'View Own Progress', 'View personal progress and achievements', 'progress', 'read'),
    ('book_appointments', 'Book Appointments', 'Schedule appointments with specialists', 'appointments', 'create'),
    ('use_extension', 'Use Browser Extension', 'Access browser extension features', 'extension', 'use'),
    
    -- Parent permissions
    ('view_child_dashboard', 'View Child Dashboard', 'View child progress and activities', 'dashboard', 'read_child'),
    ('view_child_progress', 'View Child Progress', 'Monitor child learning progress', 'progress', 'read_child'),
    ('manage_child_settings', 'Manage Child Settings', 'Update child account settings', 'settings', 'manage_child'),
    ('view_child_reports', 'View Child Reports', 'Access detailed reports about child', 'reports', 'read_child'),
    ('communicate_with_mentors', 'Communicate with Mentors', 'Chat with assigned mentors', 'chat', 'mentor_communication'),
    ('schedule_for_child', 'Schedule for Child', 'Book appointments for child', 'appointments', 'manage_child'),
    
    -- Mentor permissions
    ('view_student_dashboard', 'View Student Dashboard', 'View assigned students dashboards', 'dashboard', 'read_students'),
    ('view_student_progress', 'View Student Progress', 'Monitor student progress', 'progress', 'read_students'),
    ('assign_tasks', 'Assign Tasks', 'Assign tasks to students', 'tasks', 'assign'),
    ('provide_feedback', 'Provide Feedback', 'Give feedback to students', 'feedback', 'create'),
    ('manage_students', 'Manage Students', 'Add/remove students from mentorship', 'students', 'manage'),
    ('view_analytics', 'View Analytics', 'Access analytics for assigned students', 'analytics', 'read'),
    ('communicate_with_parents', 'Communicate with Parents', 'Chat with student parents', 'chat', 'parent_communication'),
    
    -- Admin permissions
    ('manage_all_users', 'Manage All Users', 'Full user management capabilities', 'users', 'manage_all'),
    ('manage_roles', 'Manage Roles', 'Assign and revoke user roles', 'roles', 'manage'),
    ('view_all_data', 'View All Data', 'Access all system data', 'system', 'read_all'),
    ('manage_content', 'Manage Content', 'Manage games, activities, and content', 'content', 'manage'),
    ('view_system_logs', 'View System Logs', 'Access activity logs and audit trails', 'logs', 'read'),
    ('manage_specialists', 'Manage Specialists', 'Add/remove/edit specialists', 'specialists', 'manage'),
    ('system_settings', 'System Settings', 'Configure system settings', 'settings', 'manage_system'),
    ('generate_reports', 'Generate Reports', 'Create system-wide reports', 'reports', 'generate')
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to roles
DO $$
DECLARE
    student_role_id UUID;
    parent_role_id UUID;
    mentor_role_id UUID;
    admin_role_id UUID;
BEGIN
    -- Get role IDs
    SELECT id INTO student_role_id FROM roles WHERE name = 'student';
    SELECT id INTO parent_role_id FROM roles WHERE name = 'parent';
    SELECT id INTO mentor_role_id FROM roles WHERE name = 'mentor';
    SELECT id INTO admin_role_id FROM roles WHERE name = 'admin';
    
    -- Student permissions
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT student_role_id, id FROM permissions WHERE name IN (
        'view_own_dashboard', 'manage_own_tasks', 'play_games', 'track_mood',
        'use_focus_tools', 'upload_documents', 'join_community', 'view_own_progress',
        'book_appointments', 'use_extension'
    ) ON CONFLICT DO NOTHING;
    
    -- Parent permissions (includes student permissions)
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT parent_role_id, id FROM permissions WHERE name IN (
        'view_own_dashboard', 'view_child_dashboard', 'view_child_progress',
        'manage_child_settings', 'view_child_reports', 'communicate_with_mentors',
        'schedule_for_child', 'join_community'
    ) ON CONFLICT DO NOTHING;
    
    -- Mentor permissions
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT mentor_role_id, id FROM permissions WHERE name IN (
        'view_own_dashboard', 'view_student_dashboard', 'view_student_progress',
        'assign_tasks', 'provide_feedback', 'manage_students', 'view_analytics',
        'communicate_with_parents', 'join_community'
    ) ON CONFLICT DO NOTHING;
    
    -- Admin permissions (all permissions)
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT admin_role_id, id FROM permissions
    ON CONFLICT DO NOTHING;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_parent_child_parent_id ON parent_child_relationships(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_child_child_id ON parent_child_relationships(child_id);
CREATE INDEX IF NOT EXISTS idx_mentor_student_mentor_id ON mentor_student_relationships(mentor_id);
CREATE INDEX IF NOT EXISTS idx_mentor_student_student_id ON mentor_student_relationships(student_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);

-- Enable Row Level Security
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_child_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_student_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own roles" ON user_roles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Parents can view their relationships" ON parent_child_relationships
    FOR SELECT USING (auth.uid() = parent_id OR auth.uid() = child_id);

CREATE POLICY "Mentors can view their relationships" ON mentor_student_relationships
    FOR SELECT USING (auth.uid() = mentor_id OR auth.uid() = student_id);

CREATE POLICY "Users can view their own activity logs" ON activity_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Update trigger for mentor_student_relationships
CREATE TRIGGER update_mentor_student_updated_at 
    BEFORE UPDATE ON mentor_student_relationships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to check if user has permission
CREATE OR REPLACE FUNCTION user_has_permission(user_uuid UUID, permission_name VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = user_uuid
        AND ur.is_active = TRUE
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
        AND p.name = permission_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user roles
CREATE OR REPLACE FUNCTION get_user_roles(user_uuid UUID)
RETURNS TABLE(role_name VARCHAR, display_name VARCHAR) AS $$
BEGIN
    RETURN QUERY
    SELECT r.name, r.display_name
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = user_uuid
    AND ur.is_active = TRUE
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log activity
CREATE OR REPLACE FUNCTION log_activity(
    p_user_id UUID,
    p_action VARCHAR,
    p_resource VARCHAR DEFAULT NULL,
    p_resource_id UUID DEFAULT NULL,
    p_details JSONB DEFAULT '{}'::JSONB,
    p_ip_address VARCHAR DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO activity_logs (user_id, action, resource, resource_id, details, ip_address, user_agent)
    VALUES (p_user_id, p_action, p_resource, p_resource_id, p_details, p_ip_address, p_user_agent)
    RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
