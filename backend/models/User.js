const { Pool } = require('pg');

class User {
  constructor(pool) {
    this.pool = pool || new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }

  /**
   * Find user by ID
   */
  async findById(userId) {
    try {
      const result = await this.pool.query(
        `SELECT p.*, 
         array_agg(DISTINCT r.name) as roles,
         array_agg(DISTINCT perm.name) as permissions
         FROM profiles p
         LEFT JOIN user_roles ur ON p.id = ur.user_id AND ur.is_active = TRUE
         LEFT JOIN roles r ON ur.role_id = r.id
         LEFT JOIN role_permissions rp ON r.id = rp.role_id
         LEFT JOIN permissions perm ON rp.permission_id = perm.id
         WHERE p.id = $1
         GROUP BY p.id`,
        [userId]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error finding user by ID:', error);
      throw error;
    }
  }

  /**
   * Find user by email
   */
  async findByEmail(email) {
    try {
      const result = await this.pool.query(
        'SELECT * FROM profiles WHERE email = $1',
        [email]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error finding user by email:', error);
      throw error;
    }
  }

  /**
   * Find user by username
   */
  async findByUsername(username) {
    try {
      const result = await this.pool.query(
        'SELECT * FROM profiles WHERE username = $1',
        [username]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error finding user by username:', error);
      throw error;
    }
  }

  /**
   * Create new user
   */
  async create(userData) {
    const { id, username, email, avatar_url, date_of_birth, parent_email, preferences } = userData;
    
    try {
      const result = await this.pool.query(
        `INSERT INTO profiles (id, username, email, avatar_url, date_of_birth, parent_email, preferences)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [id, username, email, avatar_url || null, date_of_birth || null, parent_email || null, preferences || {}]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Update user
   */
  async update(userId, updateData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && key !== 'id') {
        fields.push(`${key} = $${paramCount}`);
        values.push(updateData[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(userId);

    try {
      const result = await this.pool.query(
        `UPDATE profiles SET ${fields.join(', ')}, updated_at = NOW()
         WHERE id = $${paramCount}
         RETURNING *`,
        values
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  /**
   * Delete user
   */
  async delete(userId) {
    try {
      await this.pool.query('DELETE FROM profiles WHERE id = $1', [userId]);
      return true;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  /**
   * Assign role to user
   */
  async assignRole(userId, roleName, assignedBy = null, expiresAt = null) {
    try {
      const roleResult = await this.pool.query(
        'SELECT id FROM roles WHERE name = $1',
        [roleName]
      );

      if (roleResult.rows.length === 0) {
        throw new Error(`Role '${roleName}' not found`);
      }

      const roleId = roleResult.rows[0].id;

      const result = await this.pool.query(
        `INSERT INTO user_roles (user_id, role_id, assigned_by, expires_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, role_id) 
         DO UPDATE SET is_active = TRUE, assigned_by = $3, expires_at = $4, assigned_at = NOW()
         RETURNING *`,
        [userId, roleId, assignedBy, expiresAt]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error assigning role:', error);
      throw error;
    }
  }

  /**
   * Remove role from user
   */
  async removeRole(userId, roleName) {
    try {
      const roleResult = await this.pool.query(
        'SELECT id FROM roles WHERE name = $1',
        [roleName]
      );

      if (roleResult.rows.length === 0) {
        throw new Error(`Role '${roleName}' not found`);
      }

      const roleId = roleResult.rows[0].id;

      await this.pool.query(
        'UPDATE user_roles SET is_active = FALSE WHERE user_id = $1 AND role_id = $2',
        [userId, roleId]
      );

      return true;
    } catch (error) {
      console.error('Error removing role:', error);
      throw error;
    }
  }

  /**
   * Get user roles
   */
  async getUserRoles(userId) {
    try {
      const result = await this.pool.query(
        `SELECT r.name, r.display_name, r.description, ur.assigned_at, ur.expires_at
         FROM user_roles ur
         JOIN roles r ON ur.role_id = r.id
         WHERE ur.user_id = $1 AND ur.is_active = TRUE
         AND (ur.expires_at IS NULL OR ur.expires_at > NOW())`,
        [userId]
      );
      return result.rows;
    } catch (error) {
      console.error('Error getting user roles:', error);
      throw error;
    }
  }

  /**
   * Check if user has role
   */
  async hasRole(userId, roleName) {
    try {
      const result = await this.pool.query(
        `SELECT EXISTS(
          SELECT 1 FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          WHERE ur.user_id = $1 AND r.name = $2
          AND ur.is_active = TRUE
          AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
        ) as has_role`,
        [userId, roleName]
      );
      return result.rows[0].has_role;
    } catch (error) {
      console.error('Error checking user role:', error);
      throw error;
    }
  }

  /**
   * Get user permissions
   */
  async getUserPermissions(userId) {
    try {
      const result = await this.pool.query(
        `SELECT DISTINCT p.name, p.display_name, p.description, p.resource, p.action
         FROM user_roles ur
         JOIN role_permissions rp ON ur.role_id = rp.role_id
         JOIN permissions p ON rp.permission_id = p.id
         WHERE ur.user_id = $1 AND ur.is_active = TRUE
         AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
         ORDER BY p.resource, p.action`,
        [userId]
      );
      return result.rows;
    } catch (error) {
      console.error('Error getting user permissions:', error);
      throw error;
    }
  }

  /**
   * Check if user has permission
   */
  async hasPermission(userId, permissionName) {
    try {
      const result = await this.pool.query(
        `SELECT user_has_permission($1, $2) as has_permission`,
        [userId, permissionName]
      );
      return result.rows[0].has_permission;
    } catch (error) {
      console.error('Error checking user permission:', error);
      throw error;
    }
  }

  /**
   * Add parent-child relationship
   */
  async addParentChildRelationship(parentId, childId, relationshipData = {}) {
    try {
      const result = await this.pool.query(
        `INSERT INTO parent_child_relationships 
         (parent_id, child_id, relationship_type, is_primary, can_view_progress, can_manage_settings)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (parent_id, child_id) DO UPDATE
         SET relationship_type = $3, is_primary = $4, can_view_progress = $5, can_manage_settings = $6
         RETURNING *`,
        [
          parentId,
          childId,
          relationshipData.relationship_type || 'parent',
          relationshipData.is_primary !== undefined ? relationshipData.is_primary : true,
          relationshipData.can_view_progress !== undefined ? relationshipData.can_view_progress : true,
          relationshipData.can_manage_settings !== undefined ? relationshipData.can_manage_settings : true
        ]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error adding parent-child relationship:', error);
      throw error;
    }
  }

  /**
   * Get children for parent
   */
  async getChildren(parentId) {
    try {
      const result = await this.pool.query(
        `SELECT p.*, pcr.relationship_type, pcr.is_primary, 
         pcr.can_view_progress, pcr.can_manage_settings
         FROM parent_child_relationships pcr
         JOIN profiles p ON pcr.child_id = p.id
         WHERE pcr.parent_id = $1
         ORDER BY pcr.is_primary DESC, p.username`,
        [parentId]
      );
      return result.rows;
    } catch (error) {
      console.error('Error getting children:', error);
      throw error;
    }
  }

  /**
   * Add mentor-student relationship
   */
  async addMentorStudentRelationship(mentorId, studentId, relationshipData = {}) {
    try {
      const result = await this.pool.query(
        `INSERT INTO mentor_student_relationships 
         (mentor_id, student_id, organization_name, start_date, status, notes)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (mentor_id, student_id) DO UPDATE
         SET organization_name = $3, status = $5, notes = $6, updated_at = NOW()
         RETURNING *`,
        [
          mentorId,
          studentId,
          relationshipData.organization_name || null,
          relationshipData.start_date || new Date(),
          relationshipData.status || 'active',
          relationshipData.notes || null
        ]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error adding mentor-student relationship:', error);
      throw error;
    }
  }

  /**
   * Get students for mentor
   */
  async getStudents(mentorId) {
    try {
      const result = await this.pool.query(
        `SELECT p.*, msr.organization_name, msr.start_date, msr.status, msr.notes
         FROM mentor_student_relationships msr
         JOIN profiles p ON msr.student_id = p.id
         WHERE msr.mentor_id = $1 AND msr.status = 'active'
         ORDER BY msr.start_date DESC`,
        [mentorId]
      );
      return result.rows;
    } catch (error) {
      console.error('Error getting students:', error);
      throw error;
    }
  }

  /**
   * Update points and level
   */
  async updatePointsAndLevel(userId, pointsToAdd) {
    try {
      const user = await this.findById(userId);
      if (!user) throw new Error('User not found');

      const newPoints = user.points + pointsToAdd;
      const newLevel = Math.floor(newPoints / 100) + 1; // Level up every 100 points

      const result = await this.pool.query(
        `UPDATE profiles 
         SET points = $1, level = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [newPoints, newLevel, userId]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error updating points and level:', error);
      throw error;
    }
  }

  /**
   * Get user statistics
   */
  async getUserStatistics(userId) {
    try {
      const result = await this.pool.query(
        `SELECT 
          (SELECT COUNT(*) FROM tasks WHERE user_id = $1 AND status = 'done') as completed_tasks,
          (SELECT COUNT(*) FROM game_scores WHERE user_id = $1) as games_played,
          (SELECT COUNT(*) FROM mood_entries WHERE user_id = $1) as mood_entries,
          (SELECT COUNT(*) FROM focus_sessions WHERE user_id = $1 AND completed = TRUE) as focus_sessions,
          (SELECT COUNT(*) FROM user_achievements WHERE user_id = $1) as achievements_earned,
          p.points, p.level, p.streak_days, p.created_at
         FROM profiles p
         WHERE p.id = $1`,
        [userId]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error getting user statistics:', error);
      throw error;
    }
  }

  /**
   * Log user activity
   */
  async logActivity(userId, action, resource = null, resourceId = null, details = {}, ipAddress = null, userAgent = null) {
    try {
      const result = await this.pool.query(
        `INSERT INTO activity_logs (user_id, action, resource, resource_id, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [userId, action, resource, resourceId, JSON.stringify(details), ipAddress, userAgent]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error logging activity:', error);
      throw error;
    }
  }

  /**
   * Get all users (admin only)
   */
  async getAllUsers(filters = {}, limit = 50, offset = 0) {
    try {
      let query = `
        SELECT p.*, 
        array_agg(DISTINCT r.name) as roles,
        COUNT(DISTINCT t.id) as total_tasks,
        COUNT(DISTINCT gs.id) as games_played
        FROM profiles p
        LEFT JOIN user_roles ur ON p.id = ur.user_id AND ur.is_active = TRUE
        LEFT JOIN roles r ON ur.role_id = r.id
        LEFT JOIN tasks t ON p.id = t.user_id
        LEFT JOIN game_scores gs ON p.id = gs.user_id
        WHERE 1=1
      `;

      const values = [];
      let paramCount = 1;

      if (filters.role) {
        query += ` AND r.name = $${paramCount}`;
        values.push(filters.role);
        paramCount++;
      }

      if (filters.search) {
        query += ` AND (p.username ILIKE $${paramCount} OR p.email ILIKE $${paramCount})`;
        values.push(`%${filters.search}%`);
        paramCount++;
      }

      query += ` GROUP BY p.id ORDER BY p.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      values.push(limit, offset);

      const result = await this.pool.query(query, values);
      
      // Get total count
      const countResult = await this.pool.query(
        'SELECT COUNT(DISTINCT p.id) as total FROM profiles p LEFT JOIN user_roles ur ON p.id = ur.user_id LEFT JOIN roles r ON ur.role_id = r.id WHERE 1=1' +
        (filters.role ? ' AND r.name = $1' : ''),
        filters.role ? [filters.role] : []
      );

      return {
        users: result.rows,
        total: parseInt(countResult.rows[0].total),
        limit,
        offset
      };
    } catch (error) {
      console.error('Error getting all users:', error);
      throw error;
    }
  }
}

module.exports = User;
