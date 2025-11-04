# Role-Based Access Control (RBAC) Documentation

## Overview

The MindSpark platform implements a comprehensive Role-Based Access Control system to manage permissions for different user types:

- **Student**: Neurodivergent learners with full access to learning features
- **Parent**: Parents/guardians who can monitor and support their children
- **Mentor (NGO)**: NGO mentors who guide and support multiple students
- **Admin**: System administrators with full access

## Database Schema

### Core Tables

#### roles
Defines available system roles
- `id` (UUID): Primary key
- `name` (VARCHAR): Unique role identifier (student, parent, mentor, admin)
- `display_name` (VARCHAR): Human-readable name
- `description` (TEXT): Role description

#### permissions
Defines granular permissions
- `id` (UUID): Primary key
- `name` (VARCHAR): Unique permission identifier
- `display_name` (VARCHAR): Human-readable name
- `resource` (VARCHAR): Resource being accessed (tasks, games, etc.)
- `action` (VARCHAR): Action being performed (read, write, manage, etc.)

#### user_roles
Maps users to roles (many-to-many)
- `user_id` (UUID): References profiles
- `role_id` (UUID): References roles
- `assigned_by` (UUID): Who assigned the role
- `assigned_at` (TIMESTAMP): When assigned
- `expires_at` (TIMESTAMP): Optional expiration
- `is_active` (BOOLEAN): Active status

#### role_permissions
Maps roles to permissions
- `role_id` (UUID): References roles
- `permission_id` (UUID): References permissions

### Relationship Tables

#### parent_child_relationships
Manages parent-child connections
- `parent_id` (UUID): Parent user ID
- `child_id` (UUID): Child user ID
- `relationship_type` (VARCHAR): Type (parent, guardian, etc.)
- `is_primary` (BOOLEAN): Primary guardian flag
- `can_view_progress` (BOOLEAN): Progress viewing permission
- `can_manage_settings` (BOOLEAN): Settings management permission

#### mentor_student_relationships
Manages mentor-student connections
- `mentor_id` (UUID): Mentor user ID
- `student_id` (UUID): Student user ID
- `organization_name` (VARCHAR): NGO name
- `start_date` (TIMESTAMP): Relationship start
- `end_date` (TIMESTAMP): Relationship end
- `status` (VARCHAR): active, paused, completed, terminated
- `notes` (TEXT): Additional notes

#### activity_logs
Tracks all user activities for audit
- `user_id` (UUID): User who performed action
- `action` (VARCHAR): Action performed
- `resource` (VARCHAR): Resource accessed
- `resource_id` (UUID): Specific resource ID
- `details` (JSONB): Additional details
- `ip_address` (VARCHAR): IP address
- `user_agent` (TEXT): Browser user agent

## Permissions by Role

### Student Permissions
- `view_own_dashboard`: Access personal dashboard
- `manage_own_tasks`: Create, update, delete own tasks
- `play_games`: Access and play educational games
- `track_mood`: Log and view mood entries
- `use_focus_tools`: Access breathing exercises and Pomodoro timer
- `upload_documents`: Upload and manage learning materials
- `join_community`: Participate in community chat
- `view_own_progress`: View personal progress and achievements
- `book_appointments`: Schedule appointments with specialists
- `use_extension`: Access browser extension features

### Parent Permissions
(Includes basic student permissions for parent's own account)
- `view_child_dashboard`: View child progress and activities
- `view_child_progress`: Monitor child learning progress
- `manage_child_settings`: Update child account settings
- `view_child_reports`: Access detailed reports about child
- `communicate_with_mentors`: Chat with assigned mentors
- `schedule_for_child`: Book appointments for child

### Mentor (NGO) Permissions
- `view_student_dashboard`: View assigned students' dashboards
- `view_student_progress`: Monitor student progress
- `assign_tasks`: Assign tasks to students
- `provide_feedback`: Give feedback to students
- `manage_students`: Add/remove students from mentorship
- `view_analytics`: Access analytics for assigned students
- `communicate_with_parents`: Chat with student parents

### Admin Permissions
(Has ALL permissions including)
- `manage_all_users`: Full user management capabilities
- `manage_roles`: Assign and revoke user roles
- `view_all_data`: Access all system data
- `manage_content`: Manage games, activities, and content
- `view_system_logs`: Access activity logs and audit trails
- `manage_specialists`: Add/remove/edit specialists
- `system_settings`: Configure system settings
- `generate_reports`: Create system-wide reports

## API Endpoints

### Authentication & Registration

#### POST /api/auth/register
Register new user with role selection
```json
{
  "email": "user@example.com",
  "password": "password123",
  "username": "username",
  "dateOfBirth": "2010-01-01",
  "parentEmail": "parent@example.com",
  "role": "student" // Options: student, parent, mentor
}
```

Response includes user data with roles and permissions.

#### POST /api/auth/login
Login returns user with roles and permissions
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### Role Management (Admin Only)

#### GET /api/roles
Get all available roles

#### GET /api/roles/:roleId/permissions
Get permissions for specific role

#### POST /api/users/:userId/roles
Assign role to user
```json
{
  "roleName": "mentor",
  "expiresAt": "2025-12-31" // Optional
}
```

#### DELETE /api/users/:userId/roles/:roleName
Remove role from user

#### GET /api/users/:userId/roles
Get user's roles

#### GET /api/users/:userId/permissions
Get user's permissions

### Parent Management

#### POST /api/parents/:parentId/children
Add child to parent account
```json
{
  "childId": "child-uuid",
  "relationshipType": "parent",
  "isPrimary": true,
  "canViewProgress": true,
  "canManageSettings": true
}
```

#### GET /api/parents/:parentId/children
Get all children for parent

#### GET /api/parents/:parentId/children/:childId/progress
Get child's progress and statistics

### Mentor Management

#### POST /api/mentors/:mentorId/students
Add student to mentor
```json
{
  "studentId": "student-uuid",
  "organizationName": "NGO Name",
  "startDate": "2025-01-01",
  "notes": "Initial notes"
}
```

#### GET /api/mentors/:mentorId/students
Get all students for mentor

#### GET /api/mentors/:mentorId/students/:studentId/progress
Get student's progress and recent activities

#### PUT /api/mentors/:mentorId/students/:studentId
Update student relationship
```json
{
  "status": "active", // active, paused, completed, terminated
  "notes": "Updated notes",
  "endDate": "2025-12-31" // Optional
}
```

### Admin Management

#### GET /api/admin/users
Get all users with filters
Query params: `role`, `search`, `limit`, `offset`

#### GET /api/admin/activity-logs
Get system activity logs
Query params: `userId`, `action`, `limit`, `offset`

#### GET /api/admin/statistics
Get system-wide statistics

## Middleware Usage

### Authentication
```javascript
const { authenticateToken } = require('../middleware/rbac');
router.get('/protected', authenticateToken, handler);
```

### Role-Based Access
```javascript
const { requireRole } = require('../middleware/rbac');

// Single role
router.get('/admin-only', authenticateToken, requireRole('admin'), handler);

// Multiple roles
router.get('/parent-or-mentor', authenticateToken, requireRole(['parent', 'mentor']), handler);
```

### Permission-Based Access
```javascript
const { requirePermission } = require('../middleware/rbac');

router.post('/tasks', authenticateToken, requirePermission('manage_own_tasks'), handler);
```

### Ownership or Role
```javascript
const { requireOwnershipOrRole } = require('../middleware/rbac');

// Allow user to access their own resource OR admins
router.get('/users/:userId/data', authenticateToken, requireOwnershipOrRole('admin'), handler);
```

### Parent Access Check
```javascript
const { requireParentAccess } = require('../middleware/rbac');

router.get('/children/:childId/data', authenticateToken, requireParentAccess, handler);
// req.childAccess will contain relationship details
```

### Mentor Access Check
```javascript
const { requireMentorAccess } = require('../middleware/rbac');

router.get('/students/:studentId/data', authenticateToken, requireMentorAccess, handler);
// req.studentAccess will contain relationship details
```

### Activity Logging
```javascript
const { logActivity } = require('../middleware/rbac');

router.post('/important-action', 
  authenticateToken, 
  logActivity('important_action', 'resource_name'),
  handler
);
```

### Convenience Shortcuts
```javascript
const { 
  isStudent, 
  isParent, 
  isMentor, 
  isAdmin,
  isParentOrAdmin,
  isMentorOrAdmin,
  isStudentParentOrAdmin
} = require('../middleware/rbac');

router.get('/student-only', authenticateToken, isStudent, handler);
router.get('/parent-or-admin', authenticateToken, isParentOrAdmin, handler);
```

## User Model Methods

### Role Management
```javascript
const User = require('../models/User');
const userModel = new User(pool);

// Assign role
await userModel.assignRole(userId, 'mentor', assignedBy, expiresAt);

// Remove role
await userModel.removeRole(userId, 'mentor');

// Get user roles
const roles = await userModel.getUserRoles(userId);

// Check if user has role
const hasRole = await userModel.hasRole(userId, 'admin');

// Get user permissions
const permissions = await userModel.getUserPermissions(userId);

// Check if user has permission
const hasPerm = await userModel.hasPermission(userId, 'manage_all_users');
```

### Relationship Management
```javascript
// Add parent-child relationship
await userModel.addParentChildRelationship(parentId, childId, {
  relationship_type: 'parent',
  is_primary: true,
  can_view_progress: true,
  can_manage_settings: true
});

// Get children
const children = await userModel.getChildren(parentId);

// Add mentor-student relationship
await userModel.addMentorStudentRelationship(mentorId, studentId, {
  organization_name: 'NGO Name',
  start_date: new Date(),
  status: 'active',
  notes: 'Notes'
});

// Get students
const students = await userModel.getStudents(mentorId);
```

### Activity Logging
```javascript
await userModel.logActivity(
  userId,
  'action_name',
  'resource_type',
  resourceId,
  { additional: 'details' },
  ipAddress,
  userAgent
);
```

## Database Functions

### Check User Permission
```sql
SELECT user_has_permission('user-uuid', 'permission_name');
```

### Get User Roles
```sql
SELECT * FROM get_user_roles('user-uuid');
```

### Log Activity
```sql
SELECT log_activity(
  'user-uuid',
  'action_name',
  'resource_type',
  'resource-uuid',
  '{"key": "value"}'::jsonb,
  '127.0.0.1',
  'Mozilla/5.0...'
);
```

## Security Considerations

1. **Row Level Security (RLS)**: Enabled on all sensitive tables
2. **Activity Logging**: All important actions are logged
3. **Token Expiration**: JWT tokens expire after configured period
4. **Rate Limiting**: API endpoints are rate-limited
5. **Password Hashing**: Bcrypt with configurable rounds
6. **Input Validation**: All inputs are validated and sanitized
7. **SQL Injection Prevention**: Parameterized queries only
8. **Permission Checks**: Every protected route checks permissions

## Migration Instructions

1. Run the RBAC migration:
```bash
psql $DATABASE_URL -f backend/database/migrations/002_add_rbac_tables.sql
```

2. Verify tables created:
```sql
\dt roles
\dt permissions
\dt user_roles
\dt parent_child_relationships
\dt mentor_student_relationships
\dt activity_logs
```

3. Check default data:
```sql
SELECT * FROM roles;
SELECT COUNT(*) FROM permissions;
SELECT r.name, COUNT(rp.permission_id) as perm_count 
FROM roles r 
LEFT JOIN role_permissions rp ON r.id = rp.role_id 
GROUP BY r.name;
```

## Testing

### Test Role Assignment
```bash
# Register as student
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"student@test.com","password":"test123","username":"teststudent","role":"student"}'

# Register as parent
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"parent@test.com","password":"test123","username":"testparent","role":"parent"}'

# Register as mentor
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"mentor@test.com","password":"test123","username":"testmentor","role":"mentor"}'
```

### Test Permission Access
```bash
# Login and get token
TOKEN=$(curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"student@test.com","password":"test123"}' | jq -r '.token')

# Test protected endpoint
curl http://localhost:3001/api/users/$USER_ID/roles \
  -H "Authorization: Bearer $TOKEN"
```

## Troubleshooting

### User has no roles after registration
Check if role was assigned during registration. Manually assign:
```sql
INSERT INTO user_roles (user_id, role_id, is_active)
SELECT 'user-uuid', id, TRUE FROM roles WHERE name = 'student';
```

### Permission denied errors
Check user's permissions:
```sql
SELECT p.name, p.display_name
FROM user_roles ur
JOIN role_permissions rp ON ur.role_id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
WHERE ur.user_id = 'user-uuid' AND ur.is_active = TRUE;
```

### Activity logs not recording
Ensure logging middleware is applied and user is authenticated.

## Future Enhancements

1. **Temporary Role Elevation**: Allow temporary admin access
2. **Custom Permissions**: Let organizations define custom permissions
3. **Role Hierarchies**: Implement role inheritance
4. **Permission Groups**: Group permissions for easier management
5. **2FA for Sensitive Actions**: Require 2FA for admin operations
6. **Audit Reports**: Generate compliance audit reports
7. **Role Templates**: Predefined role templates for quick setup
