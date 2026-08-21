import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';

const mockAuthEnabled = import.meta.env.DEV && import.meta.env.VITE_ENABLE_MOCK_AUTH === 'true';

// Known mock credentials for local development (when Supabase is not configured)
const MOCK_USERS: Record<string, { id: string; full_name: string }> = {
  'admin@demorealty.com':  { id: 'usr-admin-demo',  full_name: 'Platform Operator' },
  'alice@demorealtyA.com': { id: 'usr-alice-demo',  full_name: 'Alice Vance' },
  'aaron@demorealtyA.com': { id: 'usr-aaron-demo',  full_name: 'Aaron Smith' },
  'bob@demorealtyB.com':   { id: 'usr-bob-demo',    full_name: 'Bob Builder' },
};

export const authService = {
  /**
   * Restore an existing Supabase session on page load.
   * Returns the current user or null — never a mock default.
   */
  async getSession() {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (!error && data.session?.user) {
        return { user: data.session.user, error: null };
      }
    } catch {
      // Supabase not reachable (offline dev mode)
    }
    return { user: null, error: null };
  },

  /**
   * Subscribe to Supabase auth state changes.
   * Returns the unsubscribe function.
   */
  onAuthStateChange(callback: (user: any | null) => void) {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  },

  /**
   * Sign in with email + password.
  * Uses Supabase as the only authentication authority outside explicit local mock mode.
   */
  async signInWithPassword(email: string, password: string) {
    if (!isSupabaseConfigured) {
      if (mockAuthEnabled) {
        const mockUser = MOCK_USERS[email.toLowerCase()];
        if (mockUser && password === 'demo-password') {
          return {
            data: {
              user: {
                id: mockUser.id,
                email,
                user_metadata: { full_name: mockUser.full_name },
              },
              session: null,
            },
            error: null,
            isMock: true,
          };
        }
      }

      return { data: null, error: { message: 'Authentication is not configured.' } };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error && data.session) {
        return { data, error: null };
      }
      return { data: null, error: { message: 'Email or password is incorrect.' } };
    } catch {
      return { data: null, error: { message: 'Unable to reach the authentication service.' } };
    }
  },

  async signOut() {
    try {
      await supabase.auth.signOut();
    } catch {
      // Dev mode — ignore
    }
  },

  async resetPasswordForEmail(email: string) {
    if (!isSupabaseConfigured) {
      return { success: false, message: 'Password recovery is not configured.' };
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      return { success: true };
    } catch {
      return { success: false, message: 'Unable to send the password reset email.' };
    }
  },

  async updatePassword(newPassword: string) {
    try {
      const { data, error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  },
};
