import React, { useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button } from '@/components/ui';
import { Building2, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const result = await login(email, password);
    if (result.success) {
      // Navigate to '/' — RootResolver determines the correct destination
      navigate('/', { replace: true });
    } else {
      setErrorMsg(result.error ?? 'Invalid email or password.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-xl mx-auto shadow-lg shadow-indigo-500/30">
            MT
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Staff Management Platform</h1>
          <p className="text-xs text-slate-400">Secure organization portal · Sprint 1.5</p>
        </div>

        <Card className="border-slate-800 bg-slate-950/80 backdrop-blur-xl text-white shadow-2xl">
          <CardHeader>
            <CardTitle className="text-lg text-white">Sign In</CardTitle>
            <CardDescription className="text-slate-400">
              Access your staff management tenant portal
            </CardDescription>
          </CardHeader>
          <CardContent>
            {errorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle size={14} />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">Password</label>
                  <Link to="/forgot-password" className="text-[11px] text-indigo-400 hover:text-indigo-300">
                    Forgot Password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500" disabled={isLoading}>
                <Lock className="w-4 h-4 mr-2" /> {isLoading ? 'Signing In...' : 'Sign In to Portal'}
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-800/80 text-center text-[11px] text-slate-400">
              <span>New organization? </span>
              <Link to="/organizations/create" className="font-semibold text-indigo-400 hover:text-indigo-300">
                Create an organization
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
