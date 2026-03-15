'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tag, Clock, User, CheckCircle2, Calendar } from 'lucide-react';
import api from '@/lib/api';
import StatCard from '@/components/StatCard';

interface QueueEntry {
  id: number;
  tokenNumber: number;
  patientName: string;
  phone: string;
  status: 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'NO_SHOW';
  visitType: 'WALK_IN' | 'APPOINTMENT';
  appointmentTime: string | null;
  createdAt: string;
}

interface RegistrationResult {
  tokenNumber: number;
  patientName: string;
  phone: string;
}

export default function ReceptionistDashboard() {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [stats, setStats] = useState({ total: 0, waiting: 0, inProgress: 0, completed: 0 });
  const [patientName, setPatientName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<RegistrationResult | null>(null);
  const [error, setError] = useState('');

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const fetchQueue = useCallback(async () => {
    try {
      const res = await api.get('/api/queue/today');
      const entries: QueueEntry[] = res.data;
      setQueue(entries);

      const total = entries.length;
      const waiting = entries.filter((e) => e.status === 'WAITING').length;
      const inProgress = entries.filter((e) => e.status === 'IN_PROGRESS').length;
      const completed = entries.filter((e) => e.status === 'COMPLETED').length;
      setStats({ total, waiting, inProgress, completed });
    } catch {
      // Queue might be empty - that's okay
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 10000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim() || !phone.trim()) {
      setError('Patient name and phone number are required');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess(null);

    try {
      const res = await api.post('/api/patients/register', {
        name: patientName.trim(),
        phone: phone.trim(),
      });

      setSuccess({
        tokenNumber: res.data.tokenNumber,
        patientName: res.data.name || patientName.trim(),
        phone: res.data.phone || phone.trim(),
      });
      setPatientName('');
      setPhone('');
      fetchQueue();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Registration failed';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      WAITING: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Waiting' },
      IN_PROGRESS: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'In Progress' },
      COMPLETED: { bg: 'bg-green-100', text: 'text-green-800', label: 'Completed' },
      NO_SHOW: { bg: 'bg-red-100', text: 'text-red-800', label: 'No Show' },
    };
    const s = map[status] || { bg: 'bg-slate-100', text: 'text-slate-600', label: status };
    return (
      <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wide ${s.bg} ${s.text}`}>
        {s.label}
      </span>
    );
  };

  return (
    <div>
      {/* Top Bar */}
      <div className="flex justify-between items-center mb-7">
        <h2 className="text-2xl font-bold text-slate-900">Receptionist Dashboard</h2>
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Calendar className="w-4 h-4" />
          {today}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4 mb-7">
        <StatCard label="Total Tokens" value={stats.total} sub="Issued today" icon={Tag} color="cyan" />
        <StatCard label="Waiting" value={stats.waiting} sub="In the queue" icon={Clock} color="amber" />
        <StatCard label="In Progress" value={stats.inProgress} sub="Being seen now" icon={User} color="blue" />
        <StatCard label="Completed" value={stats.completed} sub="Visits done" icon={CheckCircle2} color="green" />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-2 gap-5">
        {/* Registration Form */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Register Walk-in Patient</h3>
          </div>
          <div className="p-5">
            <form onSubmit={handleRegister}>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Patient Name
                </label>
                <input
                  type="text"
                  placeholder="Enter patient full name"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-900 focus:outline-none focus:border-cyan-700 focus:bg-white focus:ring-2 focus:ring-cyan-700/10 transition-all"
                />
              </div>
              <div className="mb-5">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Phone Number
                </label>
                <input
                  type="text"
                  placeholder="Enter phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-900 focus:outline-none focus:border-cyan-700 focus:bg-white focus:ring-2 focus:ring-cyan-700/10 transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl text-white text-sm font-semibold shadow-lg shadow-cyan-700/25 disabled:opacity-60 transition-all"
                style={{ background: 'linear-gradient(135deg, #0e7490, #14b8a6)' }}
              >
                {submitting ? 'Registering...' : 'Register & Issue Token'}
              </button>
            </form>

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="mt-4 p-3.5 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-green-800">
                    Token #{success.tokenNumber} issued successfully
                  </p>
                  <p className="text-xs text-green-600">
                    Patient: {success.patientName} &bull; Phone: {success.phone}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Today's Queue */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
            <h3 className="text-base font-bold text-slate-900">Today&apos;s Queue</h3>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-cyan-50 text-cyan-700">
              {stats.total} Patients
            </span>
          </div>
          <div className="overflow-auto max-h-[420px]">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 border-b-2 border-slate-100">Token</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 border-b-2 border-slate-100">Patient</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 border-b-2 border-slate-100">Type</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 border-b-2 border-slate-100">Phone</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 border-b-2 border-slate-100">Status</th>
                </tr>
              </thead>
              <tbody>
                {queue.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-sm text-slate-400">
                      No patients in the queue yet
                    </td>
                  </tr>
                ) : (
                  queue.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-sm font-bold bg-cyan-50 text-cyan-700">
                          {entry.tokenNumber}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-700">{entry.patientName}</td>
                      <td className="px-4 py-3">
                        {entry.visitType === 'APPOINTMENT' ? (
                          <span className="inline-block px-2 py-0.5 rounded-md bg-violet-100 text-violet-700 text-[11px] font-semibold">
                            Appt {entry.appointmentTime || ''}
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[11px] font-semibold">
                            Walk-in
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">{entry.phone}</td>
                      <td className="px-4 py-3">{statusBadge(entry.status)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
