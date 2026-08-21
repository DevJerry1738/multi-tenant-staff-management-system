import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from './authService';

export interface AuthUser {
  id: string;
  email: string;
  user_metadata: {
    full_name?: string;
  };
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; message?: string }>;
}

const DEFAULT_USER: AuthUser = {
  id: 'usr-admin-demo',
  email: 'admin@demorealty.com',
  user_metadata: {
    full_name: 'Platform Operator',
  },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(DEFAULT_USER);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check saved session in localStorage
    const saved = localStorage.getItem('auth_user');
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch {
        setUser(DEFAULT_USER);
      }
    }
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    const result = await authService.signInWithPassword(email, password);
    if (result.data?.user) {
      const authUser: AuthUser = {
        id: result.data.user.id,
        email: result.data.user.email || email,
        user_metadata: {
          full_name: result.data.user.user_metadata?.full_name || email.split('@')[0],
        },
      };
      setUser(authUser);
      localStorage.setItem('auth_user', JSON.stringify(authUser));
      setIsLoading(false);
      return true;
    }
    setIsLoading(false);
    return false;
  };

  const logout = async () => {
    setIsLoading(true);
    await authService.signOut();
    setUser(null);
    localStorage.removeItem('auth_user');
    setIsLoading(false);
  };

  const resetPassword = async (email: string) => {
    return await authService.resetPasswordForEmail(email);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
