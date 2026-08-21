import React, { useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button } from '@/components/ui';
import { KeyRound, ArrowLeft, CheckCircle2 } from 'lucide-react';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await resetPassword(email);
    setIsSubmitting(false);
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-xl mx-auto shadow-lg shadow-indigo-500/30">
            MT
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Staff Management SaaS</h1>
          <p className="text-xs text-slate-400">Account Recovery & Password Reset</p>
        </div>

        <Card className="border-slate-800 bg-slate-950/80 backdrop-blur-xl text-white shadow-2xl">
          <CardHeader>
            <CardTitle className="text-lg text-white">Reset Password</CardTitle>
            <CardDescription className="text-slate-400">
              Enter your registered work email to receive password reset instructions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <div className="space-y-4 text-center py-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                <div className="space-y-1">
                  <h3 className="font-semibold text-white">Reset Link Dispatched</h3>
                  <p className="text-xs text-slate-400">
                    If an account exists for <strong>{email}</strong>, a password reset link has been sent.
                  </p>
                </div>
                <Link to="/login" className="inline-block mt-4">
                  <Button variant="outline" className="text-xs border-slate-700 text-slate-300">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Login
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Work Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@organization.com"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500" disabled={isSubmitting}>
                  <KeyRound className="w-4 h-4 mr-2" /> {isSubmitting ? 'Sending Link...' : 'Send Reset Link'}
                </Button>

                <div className="pt-2 text-center">
                  <Link to="/login" className="text-xs text-slate-400 hover:text-white inline-flex items-center">
                    <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Login
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
