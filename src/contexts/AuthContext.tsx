import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@/types';
import { db } from '@/services/supabase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (userData: any) => Promise<void>;
  loginWithProvider: (provider: 'microsoft' | 'google', userData: any) => Promise<void>;
  logout: () => void;
  updateUser: (updates: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      try {
        const token = localStorage.getItem('hrms_token');
        if (token) {
          // In a real app, you'd verify the JWT and get user data
          // For now, we'll simulate this
          const userData = JSON.parse(localStorage.getItem('hrms_user') || 'null');
          if (userData) {
            setUser(userData);
          }
        }
      } catch (error) {
        console.error('Session check failed:', error);
        localStorage.removeItem('hrms_token');
        localStorage.removeItem('hrms_user');
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  const signup = async (userData: any) => {
    try {
      // Hash password (in real app, this would be done on backend)
      const hashedPassword = btoa(userData.password); // Simple encoding for demo
      
      const newUser = {
        auth_provider: 'manual',
        provider_user_id: userData.email, // Use email as provider ID for manual signup
        email: userData.email,
        password_hash: hashedPassword,
        full_name: userData.fullName,
        employee_id: null, // Will be assigned by HR
        role_id: null, // Will be assigned by HR
        department_id: null, // Will be assigned by HR
        position: null, // Will be assigned by HR
        phone: userData.phone || null,
        address: null,
        date_of_birth: null,
        date_of_joining: null, // Will be set by HR
        extra_permissions: {},
        status: 'pending', // Requires HR approval
      };

      await db.createUser(newUser);
      
      // In a real app, this would trigger:
      // 1. Email notification to HR
      // 2. Welcome email to user
      // 3. Audit log entry
      
    } catch (error) {
      throw error;
    }
  };

  const login = async (email: string, _password: string) => {
    try {
      // In a real app, this would make an API call to authenticate
      // For demo purposes, we'll simulate a successful login
      const userData = await db.getUserByEmail(email);
      if (userData && userData.status === 'active') {
        const token = 'demo_jwt_token'; // In real app, this comes from backend
        localStorage.setItem('hrms_token', token);
        localStorage.setItem('hrms_user', JSON.stringify(userData));
        setUser(userData);
      } else {
        throw new Error('Invalid credentials or inactive account');
      }
    } catch (error) {
      throw error;
    }
  };

  const loginWithProvider = async (provider: 'microsoft' | 'google', userData: any) => {
    try {
      // Check if user exists
      let existingUser = await db.getUserByEmail(userData.email);
      
      if (!existingUser) {
        // Create new user
        const newUser = {
          auth_provider: provider,
          provider_user_id: userData.id,
          email: userData.email,
          full_name: userData.name,
          role_id: 'employee', // Default role
          extra_permissions: {},
          status: 'pending' // Requires HR approval
        };
        existingUser = await db.createUser(newUser);
      }

      if (existingUser.status === 'active') {
        const token = 'demo_jwt_token';
        localStorage.setItem('hrms_token', token);
        localStorage.setItem('hrms_user', JSON.stringify(existingUser));
        setUser(existingUser);
      } else {
        throw new Error('Account pending approval or inactive');
      }
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('hrms_token');
    localStorage.removeItem('hrms_user');
    setUser(null);
  };

  const updateUser = async (updates: Partial<User>) => {
    if (!user) return;
    
    try {
      const updatedUser = await db.updateUser(user.id, updates);
      setUser(updatedUser);
      localStorage.setItem('hrms_user', JSON.stringify(updatedUser));
    } catch (error) {
      throw error;
    }
  };

  const value = {
    user,
    loading,
    login,
    signup,
    loginWithProvider,
    logout,
    updateUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}