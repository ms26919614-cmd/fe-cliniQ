'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { Activity, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { user, login, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      router.push(user.role === 'DOCTOR' ? '/doctor' : '/receptionist');
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cyan-50">
        <Loader2 className="w-8 h-8 text-cyan-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden items-center justify-center p-16"
           style={{ background: 'linear-gradient(135deg, #0d4f5c 0%, #0e7490 40%, #22d3ee 100%)' }}>
        <div className="absolute top-[-100px] right-[-100px] w-[400px] h-[400px] rounded-full bg-white/5" />
        <div className="absolute bottom-[-80px] left-[-80px] w-[300px] h-[300px] rounded-full bg-white/[0.04]" />
        <div className="text-center z-10">
          <div className="w-20 h-20 bg-white/15 rounded-2xl flex items-center justify-center mx-auto mb-6 backdrop-blur-sm border border-white/20">
            <Activity className="w-11 h-11 text-white" />
          </div>
          <h1 className="text-white text-4xl font-extrabold tracking-tight">CliniQ</h1>
          <p className="text-white/80 text-base mt-2">Clinic Queue & Token Management</p>
          <p className="text-white/50 text-xs mt-8 uppercase tracking-[3px]">Streamline your clinic workflow</p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-16 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile brand */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-14 h-14 bg-cyan-600 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Activity className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">CliniQ</h1>
          </div>

          <h2 className="text-3xl font-bold text-slate-900 mb-1">Welcome Back</h2>
          <p className="text-slate-500 text-sm mb-8">Sign in to access the clinic portal</p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-white text-sm font-semibold tracking-wide transition-all disabled:opacity-60 shadow-lg shadow-cyan-200"
              style={{ background: 'linear-gradient(135deg, #0e7490, #22d3ee)' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-8">
            CliniQ v1.0 &mdash; Clinic Queue Management System
          </p>
        </div>
      </div>
    </div>
  );
}
