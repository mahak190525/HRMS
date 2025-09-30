import React, { createContext, useContext, useEffect, useState } from 'react';
import bcrypt from 'bcryptjs';
import type { User } from '@/types';
import { supabase } from '@/services/supabase';
import { authApi } from '@/services/api';
import { msalInstance } from '@/hooks/MsalAuthProvider';
import { useInactivityTimeout } from '@/hooks/useInactivityTimeout';
import { InactivityWarningModal } from '@/components/ui/inactivity-warning-modal';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (userData: any) => Promise<void>;
  loginWithProvider: (provider: 'microsoft' | 'google', userData: any) => Promise<void>;
  logout: (isAutoLogout?: boolean) => void;
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

  // Inactivity timeout configuration
  const TIMEOUT_DURATION = 30 * 60 * 1000; // 10 minutes in milliseconds
  const WARNING_DURATION = 60 * 1000; // 1 minute warning

  // Inactivity timeout hook
  const { isWarning, remainingTime, extendSession } = useInactivityTimeout({
  timeout: TIMEOUT_DURATION,
  warningTime: WARNING_DURATION,
  onTimeout: () => {
    console.log("🚪 Logging out due to inactivity");
    logout(true);
  },
  enabled: !!user && !loading,
});

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
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
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

      const { data, error } = await supabase
        .from('users')
        .insert(newUser)
        .select()
        .single();
      
      if (error) throw error;
      
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
      console.log('Manual login attempt for:', email);
      
      const { data: userData, error } = await supabase
        .from('users')
        .select(`
          *,
          role:roles(name, description),
          department:departments!users_department_id_fkey(name, description)
        `)
        .eq('email', email)
        .single();
      
      console.log('Manual login query result:', { userData, error });
      
      if (error && error.code !== 'PGRST116') throw error;
      
      if (userData && userData.status === 'active' && userData.password_hash) {
        // Verify password using bcrypt
        const isPasswordValid = await bcrypt.compare(_password, userData.password_hash);
        
        if (!isPasswordValid) {
          throw new Error('Invalid credentials');
        }
        
        const token = 'demo_jwt_token'; // In real app, this comes from backend
        localStorage.setItem('hrms_token', token);
        localStorage.setItem('hrms_user', JSON.stringify(userData));
        setUser(userData);
        console.log('Manual login successful:', userData);
      } else {
        throw new Error('Invalid credentials or inactive account');
      }
    } catch (error) {
      console.error('Manual login error:', error);
      throw error;
    }
  };

  const loginWithProvider = async (provider: 'microsoft' | 'google', userData: any) => {
    try {
      console.log('Provider login attempt:', { provider, userData });
      
      // Check if user exists with role and department information
      const { data: existingUser, error } = await supabase
        .from('users')
        .select(`
          *,
          role:roles(name, description),
          department:departments!users_department_id_fkey(name, description)
        `)
        .eq('email', userData.email)
        .single();
      
      console.log('Existing user query result:', { existingUser, error });
      
      if (error && error.code === 'PGRST116') {
        console.log('User not found, creating new user...');
        // Create new user
        const newUser = {
          auth_provider: provider,
          provider_user_id: userData.id,
          email: userData.email,
          full_name: userData.name,
          role_id: null, // Will be assigned by HR
          extra_permissions: {},
          status: 'pending' // Requires HR approval
        };
        
        const { data: createdUser, error: createError } = await supabase
          .from('users')
          .insert(newUser)
          .select(`
            *,
            role:roles(name, description),
            department:departments!users_department_id_fkey(name, description)
          `)
          .single();
        
        console.log('New user creation result:', { createdUser, createError });
        
        if (createError) throw createError;
        
        if (createdUser.status === 'active') {
          const token = 'demo_jwt_token';
          localStorage.setItem('hrms_token', token);
          localStorage.setItem('hrms_user', JSON.stringify(createdUser));
          setUser(createdUser);
          console.log('New user logged in successfully:', createdUser);
        } else {
          throw new Error('Account pending approval or inactive');
        }
      } else if (error) {
        throw error;
      } else if (existingUser) {
        console.log('Existing user found:', existingUser);
        if (existingUser.status === 'active') {
          // Check if we have role information, if not fetch it separately
          let userWithRole = existingUser;
          if (!existingUser.role && existingUser.role_id) {
            console.log('Role information missing, fetching separately...');
            const { data: roleData, error: roleError } = await supabase
              .from('roles')
              .select('name, description')
              .eq('id', existingUser.role_id)
              .single();
            
            if (!roleError && roleData) {
              userWithRole = {
                ...existingUser,
                role: roleData
              };
              console.log('Role data fetched separately:', roleData);
            }
          }
          
          const token = 'demo_jwt_token';
          localStorage.setItem('hrms_token', token);
          localStorage.setItem('hrms_user', JSON.stringify(userWithRole));
          setUser(userWithRole);
          console.log('Existing user logged in successfully:', userWithRole);
        } else {
          throw new Error('Account pending approval or inactive');
        }
      }
    } catch (error) {
      console.error('Provider login error:', error);
      throw error;
    }
  };

  const logout = (isAutoLogout = false) => {
    // Log reason for logout
    if (isAutoLogout) {
      console.log('User logged out due to inactivity');
    }
    
    // First clear local storage and state
    localStorage.removeItem('hrms_token');
    localStorage.removeItem('hrms_user');
    setUser(null);
    
    // Then handle MSAL logout if needed
    try {
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        // Set a flag in session storage to indicate auto-logout
        if (isAutoLogout) {
          sessionStorage.setItem('inactivityLogout', 'true');
        }
        msalInstance.logoutRedirect({
          postLogoutRedirectUri: window.location.origin + '/login?logout=true' + (isAutoLogout ? '&reason=inactivity' : '')
        });
        return; // MSAL will handle the redirect
      }
    } catch (error) {
      console.error('MSAL logout error:', error);
    }
    
    // If no MSAL account, redirect immediately
    window.location.href = '/login?logout=true' + (isAutoLogout ? '&reason=inactivity' : '');
  };

  const updateUser = async (updates: Partial<User>) => {
    if (!user) return;
    
    try {
      // Check if user is being marked as ex_employee (resigned)
      if (updates.role_id === 'ex_employee' || updates.status === 'inactive') {
        // Update user object to reflect ex-employee status
        const updatedUser = {
          ...user,
          ...updates,
          role_id: 'ex_employee',
          status: 'inactive' as const, // Use 'inactive' instead of 'resigned'
          updated_at: new Date().toISOString()
        };
        
        setUser(updatedUser);
        localStorage.setItem('hrms_user', JSON.stringify(updatedUser));
        return;
      }
      
      // Update user object with new values while preserving existing structure
      const updatedUser = {
        ...user,
        ...updates,
        updated_at: new Date().toISOString()
      };
      
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
      <InactivityWarningModal
        isOpen={isWarning}
        remainingTime={remainingTime}
        onExtendSession={extendSession}
        onLogout={() => logout(true)}
      />
    </AuthContext.Provider>
  );
}