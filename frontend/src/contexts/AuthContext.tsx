import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

interface User {
  id: string;
  email: string;
  username: string;
  points: number;
  level: number;
  avatar_url?: string;
  streak_days?: number;
  roles: string[];
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  hasRole: (role: string | string[]) => boolean;
  hasPermission: (permission: string | string[]) => boolean;
  isStudent: boolean;
  isParent: boolean;
  isMentor: boolean;
  isAdmin: boolean;
}

interface RegisterData {
  email: string;
  password: string;
  username: string;
  dateOfBirth?: string;
  parentEmail?: string;
  role: 'student' | 'parent' | 'mentor';
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // Configure axios defaults
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      loadUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const loadUser = async () => {
    try {
      const response = await axios.get(`${API_URL}/auth/profile`);
      if (response.data.success) {
        // Fetch roles and permissions
        const rolesResponse = await axios.get(`${API_URL}/users/${response.data.user.id}/roles`);
        const permissionsResponse = await axios.get(`${API_URL}/users/${response.data.user.id}/permissions`);
        
        setUser({
          ...response.data.user,
          roles: rolesResponse.data.roles?.map((r: any) => r.name) || [],
          permissions: permissionsResponse.data.permissions?.map((p: any) => p.name) || []
        });
      }
    } catch (error) {
      console.error('Failed to load user:', error);
      // Token might be invalid
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, { email, password });
      
      if (response.data.success) {
        const { token, user } = response.data;
        setToken(token);
        setUser(user);
        localStorage.setItem('token', token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }
    } catch (error: any) {
      console.error('Login failed:', error);
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const response = await axios.post(`${API_URL}/auth/register`, data);
      
      if (response.data.success) {
        const { token, user } = response.data;
        setToken(token);
        setUser(user);
        localStorage.setItem('token', token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }
    } catch (error: any) {
      console.error('Registration failed:', error);
      throw new Error(error.response?.data?.message || 'Registration failed');
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
  };

  const hasRole = (role: string | string[]): boolean => {
    if (!user || !user.roles) return false;
    const roles = Array.isArray(role) ? role : [role];
    return roles.some(r => user.roles.includes(r));
  };

  const hasPermission = (permission: string | string[]): boolean => {
    if (!user || !user.permissions) return false;
    const permissions = Array.isArray(permission) ? permission : [permission];
    return permissions.some(p => user.permissions.includes(p));
  };

  const value: AuthContextType = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    hasRole,
    hasPermission,
    isStudent: hasRole('student'),
    isParent: hasRole('parent'),
    isMentor: hasRole('mentor'),
    isAdmin: hasRole('admin')
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
