const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { Pool } = require('pg');
const {
  authenticateToken,
  isAdmin,
  isParentOrAdmin,
  isMentorOrAdmin,
  requireParentAccess,
  requireMentorAccess,
  logActivity
} = require('../middleware/rbac');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const userModel = new User(pool);

// ============================================
// Role Management Routes (Admin Only)
// ============================================

/**
 * GET /api/roles
 * Get all available roles
 */
router.get('/roles', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM roles ORDER BY name'
    );

    res.json({
      success: true,
      roles: result.rows
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch roles'
    });
  }
});

/**
 * GET /api/roles/:roleId/permissions
 * Get permissions for a specific role
 */
router.get('/roles/:roleId/permissions', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { roleId } = req.params;

    const result = await pool.query(
      `SELECT p.* FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role_id = $1
       ORDER BY p.resource, p.action`,
      [roleId]
    );

    res.json({
      success: true,
      permissions: result.rows
    });
  } catch (error) {
    console.error('Error fetching role permissions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch role permissions'
    });
  }
});

/**
 * POST /api/users/:userId/roles
 * Assign role to user (Admin only)
 */
router.post('/users/:userId/roles', authenticateToken, isAdmin, logActivity('assign_role', 'users'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { roleName, expiresAt } = req.body;

    if (!roleName) {
      return res.status(400).json({
        success: false,
        error: 'Role name is required'
      });
    }

    const result = await userModel.assignRole(userId, roleName, req.user.id, expiresAt);

    res.json({
      success: true,
      message: 'Role assigned successfully',
      userRole: result
    });
  } catch (error) {
    console.error('Error assigning role:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to assign role'
    });
  }
});

/**
 * DELETE /api/users/:userId/roles/:roleName
 * Remove role from user (Admin only)
 */
router.delete('/users/:userId/roles/:roleName', authenticateToken, isAdmin, logActivity('remove_role', 'users'), async (req, res) => {
  try {
    const { userId, roleName } = req.params;

    await userModel.removeRole(userId, roleName);

    res.json({
      success: true,
      message: 'Role removed successfully'
    });
  } catch (error) {
    console.error('Error removing role:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to remove role'
    });
  }
});

/**
 * GET /api/users/:userId/roles
 * Get user's roles
 */
router.get('/users/:userId/roles', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Only allow users to view their own roles or admins to view any
    if (req.user.id !== userId && !req.user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    const roles = await userModel.getUserRoles(userId);

    res.json({
      success: true,
      roles
    });
  } catch (error) {
    console.error('Error fetching user roles:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user roles'
    });
  }
});

/**
 * GET /api/users/:userId/permissions
 * Get user's permissions
 */
router.get('/users/:userId/permissions', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Only allow users to view their own permissions or admins to view any
    if (req.user.id !== userId && !req.user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    const permissions = await userModel.getUserPermissions(userId);

    res.json({
      success: true,
      permissions
    });
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user permissions'
    });
  }
});

// ============================================
// Parent Management Routes
// ============================================

/**
 * POST /api/parents/:parentId/children
 * Add child to parent (Parent or Admin)
 */
router.post('/parents/:parentId/children', authenticateToken, isParentOrAdmin, async (req, res) => {
  try {
    const { parentId } = req.params;
    const { childId, relationshipType, isPrimary, canViewProgress, canManageSettings } = req.body;

    // Only allow parents to add their own children or admins
    if (req.user.id !== parentId && !req.user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        error: 'You can only manage your own children'
      });
    }

    if (!childId) {
      return res.status(400).json({
        success: false,
        error: 'Child ID is required'
      });
    }

    const relationship = await userModel.addParentChildRelationship(parentId, childId, {
      relationship_type: relationshipType,
      is_primary: isPrimary,
      can_view_progress: canViewProgress,
      can_manage_settings: canManageSettings
    });

    await userModel.logActivity(
      req.user.id,
      'add_child',
      'parent_child_relationship',
      relationship.id,
      { parent_id: parentId, child_id: childId },
      req.ip,
      req.headers['user-agent']
    );

    res.json({
      success: true,
      message: 'Child added successfully',
      relationship
    });
  } catch (error) {
    console.error('Error adding child:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add child'
    });
  }
});

/**
 * GET /api/parents/:parentId/children
 * Get parent's children
 */
router.get('/parents/:parentId/children', authenticateToken, isParentOrAdmin, async (req, res) => {
  try {
    const { parentId } = req.params;

    // Only allow parents to view their own children or admins
    if (req.user.id !== parentId && !req.user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        error: 'You can only view your own children'
      });
    }

    const children = await userModel.getChildren(parentId);

    res.json({
      success: true,
      children
    });
  } catch (error) {
    console.error('Error fetching children:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch children'
    });
  }
});

/**
 * GET /api/parents/:parentId/children/:childId/progress
 * Get child's progress (Parent with access or Admin)
 */
router.get('/parents/:parentId/children/:childId/progress', authenticateToken, requireParentAccess, async (req, res) => {
  try {
    const { childId } = req.params;

    if (!req.childAccess.can_view_progress) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to view this child\'s progress'
      });
    }

    const statistics = await userModel.getUserStatistics(childId);

    res.json({
      success: true,
      progress: statistics
    });
  } catch (error) {
    console.error('Error fetching child progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch child progress'
    });
  }
});

// ============================================
// Mentor Management Routes
// ============================================

/**
 * POST /api/mentors/:mentorId/students
 * Add student to mentor (Mentor or Admin)
 */
router.post('/mentors/:mentorId/students', authenticateToken, isMentorOrAdmin, async (req, res) => {
  try {
    const { mentorId } = req.params;
    const { studentId, organizationName, startDate, notes } = req.body;

    // Only allow mentors to add their own students or admins
    if (req.user.id !== mentorId && !req.user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        error: 'You can only manage your own students'
      });
    }

    if (!studentId) {
      return res.status(400).json({
        success: false,
        error: 'Student ID is required'
      });
    }

    const relationship = await userModel.addMentorStudentRelationship(mentorId, studentId, {
      organization_name: organizationName,
      start_date: startDate,
      notes
    });

    await userModel.logActivity(
      req.user.id,
      'add_student',
      'mentor_student_relationship',
      relationship.id,
      { mentor_id: mentorId, student_id: studentId },
      req.ip,
      req.headers['user-agent']
    );

    res.json({
      success: true,
      message: 'Student added successfully',
      relationship
    });
  } catch (error) {
    console.error('Error adding student:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add student'
    });
  }
});

/**
 * GET /api/mentors/:mentorId/students
 * Get mentor's students
 */
router.get('/mentors/:mentorId/students', authenticateToken, isMentorOrAdmin, async (req, res) => {
  try {
    const { mentorId } = req.params;

    // Only allow mentors to view their own students or admins
    if (req.user.id !== mentorId && !req.user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        error: 'You can only view your own students'
      });
    }

    const students = await userModel.getStudents(mentorId);

    res.json({
      success: true,
      students
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch students'
    });
  }
});

/**
 * GET /api/mentors/:mentorId/students/:studentId/progress
 * Get student's progress (Mentor with access or Admin)
 */
router.get('/mentors/:mentorId/students/:studentId/progress', authenticateToken, requireMentorAccess, async (req, res) => {
  try {
    const { studentId } = req.params;

    const statistics = await userModel.getUserStatistics(studentId);

    // Get recent activities
    const activitiesResult = await pool.query(
      `SELECT * FROM activity_logs 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 20`,
      [studentId]
    );

    res.json({
      success: true,
      progress: statistics,
      recentActivities: activitiesResult.rows
    });
  } catch (error) {
    console.error('Error fetching student progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch student progress'
    });
  }
});

/**
 * PUT /api/mentors/:mentorId/students/:studentId
 * Update student relationship status
 */
router.put('/mentors/:mentorId/students/:studentId', authenticateToken, isMentorOrAdmin, async (req, res) => {
  try {
    const { mentorId, studentId } = req.params;
    const { status, notes, endDate } = req.body;

    if (req.user.id !== mentorId && !req.user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        error: 'You can only manage your own students'
      });
    }

    const result = await pool.query(
      `UPDATE mentor_student_relationships 
       SET status = COALESCE($1, status),
           notes = COALESCE($2, notes),
           end_date = COALESCE($3, end_date),
           updated_at = NOW()
       WHERE mentor_id = $4 AND student_id = $5
       RETURNING *`,
      [status, notes, endDate, mentorId, studentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Relationship not found'
      });
    }

    res.json({
      success: true,
      message: 'Relationship updated successfully',
      relationship: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating student relationship:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update relationship'
    });
  }
});

// ============================================
// Admin Routes
// ============================================

/**
 * GET /api/admin/users
 * Get all users with filters (Admin only)
 */
router.get('/admin/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { role, search, limit = 50, offset = 0 } = req.query;

    const filters = {};
    if (role) filters.role = role;
    if (search) filters.search = search;

    const result = await userModel.getAllUsers(filters, parseInt(limit), parseInt(offset));

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
});

/**
 * GET /api/admin/activity-logs
 * Get activity logs (Admin only)
 */
router.get('/admin/activity-logs', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { userId, action, limit = 100, offset = 0 } = req.query;

    let query = 'SELECT al.*, p.username, p.email FROM activity_logs al LEFT JOIN profiles p ON al.user_id = p.id WHERE 1=1';
    const values = [];
    let paramCount = 1;

    if (userId) {
      query += ` AND al.user_id = $${paramCount}`;
      values.push(userId);
      paramCount++;
    }

    if (action) {
      query += ` AND al.action = $${paramCount}`;
      values.push(action);
      paramCount++;
    }

    query += ` ORDER BY al.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, values);

    res.json({
      success: true,
      logs: result.rows,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activity logs'
    });
  }
});

/**
 * GET /api/admin/statistics
 * Get system statistics (Admin only)
 */
router.get('/admin/statistics', authenticateToken, isAdmin, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM profiles) as total_users,
        (SELECT COUNT(*) FROM profiles WHERE created_at >= NOW() - INTERVAL '7 days') as new_users_week,
        (SELECT COUNT(*) FROM profiles WHERE last_activity >= NOW() - INTERVAL '24 hours') as active_users_today,
        (SELECT COUNT(*) FROM tasks WHERE created_at >= NOW() - INTERVAL '7 days') as tasks_created_week,
        (SELECT COUNT(*) FROM game_scores WHERE created_at >= NOW() - INTERVAL '7 days') as games_played_week,
        (SELECT COUNT(*) FROM documents WHERE created_at >= NOW() - INTERVAL '7 days') as documents_uploaded_week,
        (SELECT COUNT(DISTINCT user_id) FROM user_roles WHERE role_id IN (SELECT id FROM roles WHERE name = 'student')) as total_students,
        (SELECT COUNT(DISTINCT user_id) FROM user_roles WHERE role_id IN (SELECT id FROM roles WHERE name = 'parent')) as total_parents,
        (SELECT COUNT(DISTINCT user_id) FROM user_roles WHERE role_id IN (SELECT id FROM roles WHERE name = 'mentor')) as total_mentors
    `);

    res.json({
      success: true,
      statistics: stats.rows[0]
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

module.exports = router;
