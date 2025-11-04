const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const User = require('../models/User');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const userModel = new User(pool);

/**
 * Enhanced authentication middleware with role support
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required',
        message: 'Please provide a valid authentication token'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get full user data including roles and permissions
    const user = await userModel.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
        message: 'The user associated with this token no longer exists'
      });
    }

    // Get user roles and permissions
    const roles = await userModel.getUserRoles(user.id);
    const permissions = await userModel.getUserPermissions(user.id);

    // Update last activity
    await pool.query(
      'UPDATE profiles SET last_activity = NOW() WHERE id = $1',
      [user.id]
    );

    req.user = {
      id: user.id,
      email: user.email,
      username: user.username,
      points: user.points,
      level: user.level,
      roles: roles.map(r => r.name),
      permissions: permissions.map(p => p.name),
      fullRoles: roles,
      fullPermissions: permissions
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({
        success: false,
        error: 'Invalid token',
        message: 'The provided token is invalid'
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(403).json({
        success: false,
        error: 'Token expired',
        message: 'The provided token has expired. Please log in again'
      });
    } else {
      console.error('Authentication error:', error);
      return res.status(500).json({
        success: false,
        error: 'Authentication failed',
        message: 'An error occurred during authentication'
      });
    }
  }
};

/**
 * Check if user has specific role(s)
 * @param {string|string[]} roles - Role name or array of role names
 */
const requireRole = (roles) => {
  const roleArray = Array.isArray(roles) ? roles : [roles];

  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'You must be logged in to access this resource'
      });
    }

    const hasRequiredRole = roleArray.some(role => req.user.roles.includes(role));

    if (!hasRequiredRole) {
      // Log unauthorized access attempt
      await userModel.logActivity(
        req.user.id,
        'unauthorized_access_attempt',
        'role_check',
        null,
        { required_roles: roleArray, user_roles: req.user.roles },
        req.ip,
        req.headers['user-agent']
      );

      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        message: `This action requires one of the following roles: ${roleArray.join(', ')}`,
        requiredRoles: roleArray
      });
    }

    next();
  };
};

/**
 * Check if user has specific permission(s)
 * @param {string|string[]} permissions - Permission name or array of permission names
 */
const requirePermission = (permissions) => {
  const permArray = Array.isArray(permissions) ? permissions : [permissions];

  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'You must be logged in to access this resource'
      });
    }

    const hasRequiredPermission = permArray.some(perm => req.user.permissions.includes(perm));

    if (!hasRequiredPermission) {
      // Log unauthorized access attempt
      await userModel.logActivity(
        req.user.id,
        'unauthorized_access_attempt',
        'permission_check',
        null,
        { required_permissions: permArray, user_permissions: req.user.permissions },
        req.ip,
        req.headers['user-agent']
      );

      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        message: `This action requires one of the following permissions: ${permArray.join(', ')}`,
        requiredPermissions: permArray
      });
    }

    next();
  };
};

/**
 * Check if user is accessing their own resource or has permission
 */
const requireOwnershipOrRole = (roles, userIdParam = 'userId') => {
  const roleArray = Array.isArray(roles) ? roles : [roles];

  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const targetUserId = req.params[userIdParam] || req.body[userIdParam];

    // Check if user is accessing their own resource
    const isOwner = req.user.id === targetUserId;

    // Check if user has required role
    const hasRequiredRole = roleArray.some(role => req.user.roles.includes(role));

    if (!isOwner && !hasRequiredRole) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        message: 'You can only access your own resources or need elevated permissions'
      });
    }

    req.isOwner = isOwner;
    next();
  };
};

/**
 * Check if parent has access to child's data
 */
const requireParentAccess = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  const childId = req.params.childId || req.body.childId;

  if (!childId) {
    return res.status(400).json({
      success: false,
      error: 'Child ID required'
    });
  }

  try {
    // Check if user is parent of the child
    const result = await pool.query(
      `SELECT * FROM parent_child_relationships 
       WHERE parent_id = $1 AND child_id = $2`,
      [req.user.id, childId]
    );

    if (result.rows.length === 0 && !req.user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You do not have permission to access this child\'s data'
      });
    }

    req.childAccess = result.rows[0];
    next();
  } catch (error) {
    console.error('Error checking parent access:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify parent access'
    });
  }
};

/**
 * Check if mentor has access to student's data
 */
const requireMentorAccess = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  const studentId = req.params.studentId || req.body.studentId;

  if (!studentId) {
    return res.status(400).json({
      success: false,
      error: 'Student ID required'
    });
  }

  try {
    // Check if user is mentor of the student
    const result = await pool.query(
      `SELECT * FROM mentor_student_relationships 
       WHERE mentor_id = $1 AND student_id = $2 AND status = 'active'`,
      [req.user.id, studentId]
    );

    if (result.rows.length === 0 && !req.user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You do not have permission to access this student\'s data'
      });
    }

    req.studentAccess = result.rows[0];
    next();
  } catch (error) {
    console.error('Error checking mentor access:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify mentor access'
    });
  }
};

/**
 * Activity logging middleware
 */
const logActivity = (action, resource = null) => {
  return async (req, res, next) => {
    if (req.user) {
      try {
        const resourceId = req.params.id || req.body.id || null;
        await userModel.logActivity(
          req.user.id,
          action,
          resource,
          resourceId,
          {
            method: req.method,
            path: req.path,
            query: req.query
          },
          req.ip,
          req.headers['user-agent']
        );
      } catch (error) {
        console.error('Error logging activity:', error);
        // Don't fail the request if logging fails
      }
    }
    next();
  };
};

/**
 * Check user is student
 */
const isStudent = requireRole('student');

/**
 * Check user is parent
 */
const isParent = requireRole('parent');

/**
 * Check user is mentor
 */
const isMentor = requireRole('mentor');

/**
 * Check user is admin
 */
const isAdmin = requireRole('admin');

/**
 * Check user is parent or admin
 */
const isParentOrAdmin = requireRole(['parent', 'admin']);

/**
 * Check user is mentor or admin
 */
const isMentorOrAdmin = requireRole(['mentor', 'admin']);

/**
 * Check user is student, parent, or admin
 */
const isStudentParentOrAdmin = requireRole(['student', 'parent', 'admin']);

module.exports = {
  authenticateToken,
  requireRole,
  requirePermission,
  requireOwnershipOrRole,
  requireParentAccess,
  requireMentorAccess,
  logActivity,
  isStudent,
  isParent,
  isMentor,
  isAdmin,
  isParentOrAdmin,
  isMentorOrAdmin,
  isStudentParentOrAdmin
};
