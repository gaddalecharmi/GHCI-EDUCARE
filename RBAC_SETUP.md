# 🎯 MindSpark RBAC Setup Guide

## Role-Based Access Control Implementation

This guide will help you set up and use the comprehensive Role-Based Access Control (RBAC) system for the MindSpark adaptive learning platform.

## 🚀 Quick Start

### 1. Database Setup

First, run the RBAC migration to create all necessary tables:

```bash
# Navigate to backend directory
cd backend

# Run the migration (PostgreSQL)
psql $DATABASE_URL -f database/migrations/002_add_rbac_tables.sql

# Or if using connection string
psql "postgresql://username:password@host:port/database" -f database/migrations/002_add_rbac_tables.sql
```

### 2. Verify Database Setup

Check that all tables were created:

```sql
-- Check roles
SELECT * FROM roles;

-- Check permissions count
SELECT r.name as role, COUNT(rp.permission_id) as permissions
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
GROUP BY r.name;

-- Expected output:
-- student: 10 permissions
-- parent: 8 permissions
-- mentor: 9 permissions
-- admin: 28 permissions (all)
```

### 3. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install axios
```

### 4. Environment Variables

Add to your `.env` file:

```env
DATABASE_URL=postgresql://username:password@host:port/database
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
NODE_ENV=development
PORT=3001
```

### 5. Start the Application

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

## 👥 User Roles

### Student Role
**Purpose**: Neurodivergent learners accessing educational tools

**Features**:
- ✅ Personal dashboard with progress tracking
- ✅ Task management (create, prioritize, complete)
- ✅ Educational brain games
- ✅ Mood tracking
- ✅ Focus tools (breathing exercises, Pomodoro timer)
- ✅ Document upload and AI processing
- ✅ Community chat participation
- ✅ Appointment booking with specialists
- ✅ Browser extension access
- ✅ Points and achievement system

### Parent Role
**Purpose**: Parents/guardians monitoring their children

**Features**:
- ✅ View child's dashboard and progress
- ✅ Access detailed progress reports
- ✅ Manage child's settings
- ✅ Communication with assigned mentors
- ✅ Schedule appointments for child
- ✅ Receive notifications about child's activities
- ✅ Multiple children support

### Mentor Role (NGO)
**Purpose**: NGO mentors guiding multiple students

**Features**:
- ✅ View all assigned students' dashboards
- ✅ Monitor student progress and activities
- ✅ Assign tasks to students
- ✅ Provide feedback and encouragement
- ✅ Access student analytics
- ✅ Communication with parents
- ✅ Manage student relationships
- ✅ Generate student reports

### Admin Role
**Purpose**: System administrators managing the platform

**Features**:
- ✅ Full user management
- ✅ Role assignment and revocation
- ✅ System-wide analytics
- ✅ Activity log access
- ✅ Content management (games, activities)
- ✅ Specialist management
- ✅ System configuration
- ✅ Audit trail access

## 📝 Usage Examples

### Frontend - Role-Based UI

#### 1. Update App.tsx to include Auth

```tsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import ParentDashboard from './pages/ParentDashboard';
import MentorDashboard from './pages/MentorDashboard';
import AdminDashboard from './pages/AdminDashboard';

// Protected Route Component
const ProtectedRoute = ({ children, requiredRole }: { children: React.ReactNode, requiredRole?: string }) => {
  const { user, loading, hasRole } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" />;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return <Navigate to="/dashboard" />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/parent"
            element={
              <ProtectedRoute requiredRole="parent">
                <ParentDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mentor"
            element={
              <ProtectedRoute requiredRole="mentor">
                <MentorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
```

#### 2. Using Role Checks in Components

```tsx
import { useAuth } from '../contexts/AuthContext';

function NavigationMenu() {
  const { user, isStudent, isParent, isMentor, isAdmin } = useAuth();

  return (
    <nav>
      <ul>
        <li><Link to="/dashboard">Dashboard</Link></li>
        
        {isStudent && (
          <>
            <li><Link to="/games">Games</Link></li>
            <li><Link to="/tasks">Tasks</Link></li>
            <li><Link to="/library">Library</Link></li>
          </>
        )}
        
        {isParent && (
          <li><Link to="/parent/children">My Children</Link></li>
        )}
        
        {isMentor && (
          <li><Link to="/mentor/students">My Students</Link></li>
        )}
        
        {isAdmin && (
          <>
            <li><Link to="/admin/users">User Management</Link></li>
            <li><Link to="/admin/logs">Activity Logs</Link></li>
            <li><Link to="/admin/statistics">Statistics</Link></li>
          </>
        )}
      </ul>
    </nav>
  );
}
```

#### 3. Permission-Based Features

```tsx
import { useAuth } from '../contexts/AuthContext';

function TaskManager() {
  const { hasPermission } = useAuth();

  return (
    <div>
      <h2>Tasks</h2>
      
      {hasPermission('manage_own_tasks') && (
        <button>Create New Task</button>
      )}
      
      {hasPermission('assign_tasks') && (
        <button>Assign Task to Student</button>
      )}
      
      {/* Task list */}
    </div>
  );
}
```

### Backend - Protecting Routes

#### 1. Basic Route Protection

```javascript
const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole, requirePermission } = require('../middleware/rbac');

// Any authenticated user
router.get('/profile', authenticateToken, async (req, res) => {
  res.json({ user: req.user });
});

// Students only
router.post('/tasks', authenticateToken, requireRole('student'), async (req, res) => {
  // Create task logic
});

// Parents and admins
router.get('/children', authenticateToken, requireRole(['parent', 'admin']), async (req, res) => {
  // Get children logic
});

// Permission-based
router.post('/documents/process', 
  authenticateToken, 
  requirePermission('upload_documents'), 
  async (req, res) => {
    // Process document logic
  }
);
```

#### 2. Parent Access Control

```javascript
const { authenticateToken, requireParentAccess } = require('../middleware/rbac');

// Parent viewing child's progress
router.get('/children/:childId/progress', 
  authenticateToken, 
  requireParentAccess, 
  async (req, res) => {
    // req.childAccess contains relationship details
    if (!req.childAccess.can_view_progress) {
      return res.status(403).json({ error: 'No permission to view progress' });
    }
    
    // Get child progress
  }
);
```

#### 3. Mentor Access Control

```javascript
const { authenticateToken, requireMentorAccess } = require('../middleware/rbac');

// Mentor assigning task to student
router.post('/students/:studentId/tasks', 
  authenticateToken, 
  requireMentorAccess, 
  async (req, res) => {
    // req.studentAccess contains relationship details
    const { studentId } = req.params;
    const { title, description, priority } = req.body;
    
    // Create task for student
  }
);
```

#### 4. Activity Logging

```javascript
const { authenticateToken, logActivity } = require('../middleware/rbac');

router.post('/important-action', 
  authenticateToken,
  logActivity('important_action', 'resource_type'),
  async (req, res) => {
    // Action will be automatically logged
    // Perform action
  }
);
```

## 🔧 Common Tasks

### Assign Role to Existing User

```bash
# Using the API
curl -X POST http://localhost:3001/api/users/USER_ID/roles \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"roleName": "mentor"}'

# Or directly in database
INSERT INTO user_roles (user_id, role_id, is_active)
SELECT 'user-uuid', id, TRUE FROM roles WHERE name = 'mentor';
```

### Link Parent to Child

```bash
curl -X POST http://localhost:3001/api/parents/PARENT_ID/children \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "childId": "CHILD_UUID",
    "relationshipType": "parent",
    "isPrimary": true,
    "canViewProgress": true,
    "canManageSettings": true
  }'
```

### Link Mentor to Student

```bash
curl -X POST http://localhost:3001/api/mentors/MENTOR_ID/students \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "STUDENT_UUID",
    "organizationName": "Hope NGO",
    "notes": "New student onboarded"
  }'
```

### View Activity Logs (Admin)

```bash
curl http://localhost:3001/api/admin/activity-logs?limit=50 \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

## 🎨 Browser Extension Integration

The browser extension can authenticate users and provide role-specific features:

### Extension Features by Role

**Student**:
- Dyslexia-friendly fonts and colors
- One-click page summaries
- Text-to-speech
- Speech-to-text
- Earn points while browsing

**Parent**:
- Monitor child's browsing time
- Content filtering controls
- Usage reports

**Mentor**:
- Assign reading materials
- Track student engagement

### Extension Authentication

```javascript
// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'login') {
    fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: request.email, password: request.password })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        chrome.storage.local.set({
          token: data.token,
          user: data.user
        });
        sendResponse({ success: true, user: data.user });
      }
    });
    return true;
  }
});
```

## 🐛 Troubleshooting

### Issue: User registered but has no role

**Solution**: Check if role was assigned during registration. Manually assign:

```sql
INSERT INTO user_roles (user_id, role_id, is_active)
SELECT 'user-uuid', id, TRUE FROM roles WHERE name = 'student';
```

### Issue: Permission denied errors

**Solution**: Check user's permissions:

```sql
SELECT p.name, p.display_name, p.resource, p.action
FROM user_roles ur
JOIN role_permissions rp ON ur.role_id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
WHERE ur.user_id = 'user-uuid' AND ur.is_active = TRUE;
```

### Issue: Parent can't see child data

**Solution**: Verify relationship exists:

```sql
SELECT * FROM parent_child_relationships
WHERE parent_id = 'parent-uuid' AND child_id = 'child-uuid';

-- Create if missing
INSERT INTO parent_child_relationships (parent_id, child_id)
VALUES ('parent-uuid', 'child-uuid');
```

### Issue: Activity logs not recording

**Solution**: Ensure:
1. User is authenticated
2. Logging middleware is applied
3. Database user has INSERT permission on activity_logs table

## 📚 Next Steps

1. **Create Role-Specific Dashboards**:
   - Parent dashboard for monitoring children
   - Mentor dashboard for managing students
   - Admin panel for system management

2. **Implement Real-Time Features**:
   - WebSocket notifications for parents
   - Live progress updates for mentors
   - Real-time chat moderation for admins

3. **Add Gamification**:
   - Role-specific achievements
   - Parent engagement rewards
   - Mentor recognition system

4. **Browser Extension Enhancement**:
   - Sync settings across devices
   - Offline mode support
   - Advanced content filtering

5. **Reporting System**:
   - Weekly progress reports for parents
   - Monthly summaries for mentors
   - Admin analytics dashboard

## 🔐 Security Best Practices

1. **Never expose sensitive data**: Always check permissions before returning data
2. **Log important actions**: Use activity logging for audit trails
3. **Validate relationships**: Always verify parent-child and mentor-student relationships
4. **Rate limit endpoints**: Especially authentication and role assignment
5. **Use HTTPS in production**: Never send tokens over unencrypted connections
6. **Rotate JWT secrets regularly**: Change JWT_SECRET periodically
7. **Implement token refresh**: Don't store long-lived tokens

## 📖 Additional Resources

- [Full RBAC Documentation](./backend/docs/RBAC.md)
- [API Documentation](./backend/docs/api.md)
- [Database Schema](./backend/database/migrations/002_add_rbac_tables.sql)

## 🤝 Contributing

When adding new features:
1. Define appropriate permissions
2. Update role_permissions mapping
3. Add middleware to protect routes
4. Document in RBAC.md
5. Add tests for permission checks

## 📄 License

MIT License - See LICENSE file for details
