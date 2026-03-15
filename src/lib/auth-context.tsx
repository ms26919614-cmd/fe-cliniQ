'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import api from './api';

interface User {
  username: string;
  fullName: string;
  role: 'DOCTOR' | 'RECEPTIONIST';
  token: string;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem('cliniq_user');
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch { localStorage.removeItem('cliniq_user'); }
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    const res = await api.post('/api/auth/login', { username, password });
    const userData: User = {
      username: res.data.username,
      fullName: res.data.fullName,
      role: res.data.role,
      token: res.data.token,
    };
    localStorage.setItem('cliniq_token', userData.token);
    localStorage.setItem('cliniq_user', JSON.stringify(userData));
    setUser(userData);
    router.push(userData.role === 'DOCTOR' ? '/doctor' : '/receptionist');
  };

  const logout = () => {
    localStorage.removeItem('cliniq_token');
    localStorage.removeItem('cliniq_user');
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
