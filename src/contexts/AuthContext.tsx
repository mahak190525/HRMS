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
  refreshUserRoles: () => Promise<void>;
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
          // Always fetch fresh user data from database to ensure we have the latest role information
          // This ensures role changes are reflected immediately after page refresh
          const userData = JSON.parse(localStorage.getItem('hrms_user') || 'null');
          if (userData && userData.id) {
            console.log('🔄 Fetching fresh user data from database on app initialization...');
            
            try {
              // Fetch fresh user data with all roles from database
              const { data: freshUserData, error } = await supabase
                .from('users')
                .select(`
                  *,
                  role:roles(name, description),
                  department:departments!users_department_id_fkey(name, description)
                `)
                .eq('id', userData.id)
                .single();

              if (error) {
                console.error('Failed to fetch fresh user data:', error);
                // Fallback to localStorage data
                const enhancedUserData = {
                  ...userData,
                  additional_roles: userData.additional_roles || []
                };
                setUser(enhancedUserData);
                setLoading(false);
                return;
              }

              // Enhance with additional roles data
              let enhancedUser = freshUserData;
              if (freshUserData?.additional_role_ids && freshUserData.additional_role_ids.length > 0) {
                const { data: additionalRoles } = await supabase
                  .from('roles')
                  .select('id, name, description')
                  .in('id', freshUserData.additional_role_ids);
                
                enhancedUser = {
                  ...freshUserData,
                  additional_roles: additionalRoles || []
                };
              } else {
                enhancedUser = {
                  ...freshUserData,
                  additional_roles: []
                };
              }
              
              console.log('✅ Fresh user data loaded:', {
                primary_role: enhancedUser.role?.name,
                additional_roles: enhancedUser.additional_roles?.map(r => r.name)
              });
              
              // Update localStorage with fresh data
              localStorage.setItem('hrms_user', JSON.stringify(enhancedUser));
              setUser(enhancedUser);
            } catch (fetchError) {
              console.error('Error fetching fresh user data:', fetchError);
              // Fallback to localStorage data
              const enhancedUserData = {
                ...userData,
                additional_roles: userData.additional_roles || []
              };
              setUser(enhancedUserData);
            }
          } else {
            // No user data in localStorage, clear session
            localStorage.removeItem('hrms_token');
            localStorage.removeItem('hrms_user');
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
        
        // Enhance with additional roles data
        let enhancedUser = userData;
        if (userData.additional_role_ids && userData.additional_role_ids.length > 0) {
          const { data: additionalRoles } = await supabase
            .from('roles')
            .select('id, name, description')
            .in('id', userData.additional_role_ids);
          
          enhancedUser = {
            ...userData,
            additional_roles: additionalRoles || []
          };
        } else {
          enhancedUser = {
            ...userData,
            additional_roles: []
          };
        }
        
        const token = 'demo_jwt_token'; // In real app, this comes from backend
        localStorage.setItem('hrms_token', token);
        localStorage.setItem('hrms_user', JSON.stringify(enhancedUser));
        setUser(enhancedUser);
        console.log('Manual login successful with roles:', {
          user: enhancedUser.full_name,
          primary_role: enhancedUser.role?.name,
          additional_roles: enhancedUser.additional_roles?.map(r => r.name)
        });
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
          // Enhance new user with additional roles (will be empty initially)
          const enhancedUser = {
            ...createdUser,
            additional_roles: []
          };
          
          const token = 'demo_jwt_token';
          localStorage.setItem('hrms_token', token);
          localStorage.setItem('hrms_user', JSON.stringify(enhancedUser));
          setUser(enhancedUser);
          console.log('New user logged in successfully:', enhancedUser);
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
          
          // Enhance with additional roles data
          let enhancedUser = userWithRole;
          if (userWithRole.additional_role_ids && userWithRole.additional_role_ids.length > 0) {
            const { data: additionalRoles } = await supabase
              .from('roles')
              .select('id, name, description')
              .in('id', userWithRole.additional_role_ids);
            
            enhancedUser = {
              ...userWithRole,
              additional_roles: additionalRoles || []
            };
          } else {
            enhancedUser = {
              ...userWithRole,
              additional_roles: []
            };
          }
          
          const token = 'demo_jwt_token';
          localStorage.setItem('hrms_token', token);
          localStorage.setItem('hrms_user', JSON.stringify(enhancedUser));
          setUser(enhancedUser);
          console.log('Existing user logged in successfully with roles:', {
            user: enhancedUser.full_name,
            primary_role: enhancedUser.role?.name,
            additional_roles: enhancedUser.additional_roles?.map(r => r.name)
          });
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
      
      // If role_id or additional_role_ids are being updated, fetch fresh user data from database
      // to ensure we have the complete role information
      if (updates.role_id !== undefined || updates.additional_role_ids !== undefined) {
        console.log('🔄 Refreshing user data after role update...', {
          role_id_changed: updates.role_id !== undefined,
          additional_roles_changed: updates.additional_role_ids !== undefined
        });
        
        // Fetch fresh user data with all roles
        const { data: freshUserData, error } = await supabase
          .from('users')
          .select(`
            *,
            role:roles(name, description),
            department:departments!users_department_id_fkey(name, description)
          `)
          .eq('id', user.id)
          .single();

        if (error) throw error;
        
        // Enhance with additional roles data
        let enhancedUser = freshUserData;
        if (freshUserData?.additional_role_ids && freshUserData.additional_role_ids.length > 0) {
          const { data: additionalRoles } = await supabase
            .from('roles')
            .select('id, name, description')
            .in('id', freshUserData.additional_role_ids);
          
          enhancedUser = {
            ...freshUserData,
            additional_roles: additionalRoles || []
          };
        } else {
          enhancedUser = {
            ...freshUserData,
            additional_roles: []
          };
        }
        
        console.log('✅ User data refreshed with roles:', {
          primary_role: enhancedUser.role?.name,
          additional_roles: enhancedUser.additional_roles?.map(r => r.name)
        });
        
        setUser(enhancedUser);
        localStorage.setItem('hrms_user', JSON.stringify(enhancedUser));
      } else {
        // For other updates, just merge locally
        const updatedUser = {
          ...user,
          ...updates,
          updated_at: new Date().toISOString()
        };
        
        setUser(updatedUser);
        localStorage.setItem('hrms_user', JSON.stringify(updatedUser));
      }
    } catch (error) {
      throw error;
    }
  };

  const refreshUserRoles = async () => {
    if (!user) return;
    
    try {
      console.log('🔄 Refreshing user roles...');
      
      // Fetch fresh user data from database
      const { data: freshUserData, error } = await supabase
        .from('users')
        .select(`
          *,
          role:roles(name, description),
          department:departments!users_department_id_fkey(name, description)
        `)
        .eq('id', user.id)
        .single();

      if (error) throw error;
      
      // Enhance with additional roles data
      let enhancedUser = freshUserData;
      if (freshUserData?.additional_role_ids && freshUserData.additional_role_ids.length > 0) {
        const { data: additionalRoles } = await supabase
          .from('roles')
          .select('id, name, description')
          .in('id', freshUserData.additional_role_ids);
        
        enhancedUser = {
          ...freshUserData,
          additional_roles: additionalRoles || []
        };
      } else {
        enhancedUser = {
          ...freshUserData,
          additional_roles: []
        };
      }
      
      console.log('✅ User roles refreshed:', {
        primary_role: enhancedUser.role?.name,
        additional_roles: enhancedUser.additional_roles?.map(r => r.name)
      });
      
      setUser(enhancedUser);
      localStorage.setItem('hrms_user', JSON.stringify(enhancedUser));
    } catch (error) {
      console.error('Failed to refresh user roles:', error);
    }
  };

  const value = {
    user,
    loading,
    login,
    signup,
    loginWithProvider,
    logout,
    updateUser,
    refreshUserRoles
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