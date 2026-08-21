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
  /** True while the initial session check is in-flight. Gate all routing on this. */
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; message?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function toAuthUser(raw: any): AuthUser {
  return {
    id: raw.id,
    email: raw.email ?? '',
    user_metadata: {
      full_name: raw.user_metadata?.full_name ?? raw.email?.split('@')[0] ?? '',
    },
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  // Start as loading — nothing renders until we have confirmed auth state
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restore session on mount (Supabase or mock dev session)
    const restoreSession = async () => {
      const { user: sessionUser } = await authService.getSession();
      if (sessionUser) {
        setUser(toAuthUser(sessionUser));
      } else {
        // Check for a persisted mock dev session
        const saved = sessionStorage.getItem('mock_auth_user');
        if (saved) {
          try {
            setUser(JSON.parse(saved));
          } catch {
            sessionStorage.removeItem('mock_auth_user');
          }
        }
      }
      setIsLoading(false);
    };

    restoreSession();

    // Listen for real Supabase auth state changes (login / logout / token refresh)
    const unsubscribe = authService.onAuthStateChange((supabaseUser) => {
      if (supabaseUser) {
        setUser(toAuthUser(supabaseUser));
      } else {
        // Only clear if we don't have a mock dev session active
        const saved = sessionStorage.getItem('mock_auth_user');
        if (!saved) {
          setUser(null);
        }
      }
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    const result = await authService.signInWithPassword(email, password);

    if (result.data?.user) {
      const authUser = toAuthUser(result.data.user);
      setUser(authUser);

      // Persist mock session in sessionStorage (cleared on tab close)
      if ((result as any).isMock) {
        sessionStorage.setItem('mock_auth_user', JSON.stringify(authUser));
      }

      setIsLoading(false);
      return { success: true };
    }

    setIsLoading(false);
    return {
      success: false,
      error: (result.error as any)?.message ?? 'Sign in failed. Please check your credentials.',
    };
  };

  const logout = async () => {
    setIsLoading(true);
    await authService.signOut();
    sessionStorage.removeItem('mock_auth_user');
    setUser(null);
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
