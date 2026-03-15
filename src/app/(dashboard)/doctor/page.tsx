'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users, Clock, CheckCircle2, XCircle, ArrowRight, Calendar,
} from 'lucide-react';
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
  calledAt: string | null;
  createdAt: string;
}

export default function DoctorDashboard() {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [stats, setStats] = useState({ total: 0, waiting: 0, completed: 0, noShow: 0 });
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const currentPatient = queue.find((e) => e.status === 'IN_PROGRESS');

  const fetchQueue = useCallback(async () => {
    try {
      const res = await api.get('/api/queue/today');
      const entries: QueueEntry[] = res.data;
      setQueue(entries);

      const total = entries.length;
      const waiting = entries.filter((e) => e.status === 'WAITING').length;
      const completed = entries.filter((e) => e.status === 'COMPLETED').length;
      const noShow = entries.filter((e) => e.status === 'NO_SHOW').length;
      setStats({ total, waiting, completed, noShow });
    } catch {
      // Queue might be empty
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 5000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  const callNext = async () => {
    setActionLoading('callNext');
    try {
      await api.post('/api/queue/manage/call-next');
      await fetchQueue();
    } catch {
      // No more patients in the queue
    } finally {
      setActionLoading(null);
    }
  };

  const completeVisit = async (visitId: number) => {
    setActionLoading('complete');
    try {
      await api.patch(`/api/queue/manage/visits/${visitId}/status`, { status: 'COMPLETED' });
      await fetchQueue();
    } catch {
      // Error completing
    } finally {
      setActionLoading(null);
    }
  };

  const markNoShow = async (visitId: number) => {
    setActionLoading('noshow');
    try {
      await api.patch(`/api/queue/manage/visits/${visitId}/status`, { status: 'NO_SHOW' });
      await fetchQueue();
    } catch {
      // Error marking no show
    } finally {
      setActionLoading(null);
    }
  };

  const tokenBadgeClass = (status: string) => {
    const map: Record<string, string> = {
      WAITING: 'bg-cyan-50 text-cyan-700',
      IN_PROGRESS: 'bg-cyan-700 text-white',
      COMPLETED: 'bg-green-100 text-green-800',
      NO_SHOW: 'bg-red-100 text-red-700',
    };
    return map[status] || 'bg-slate-100 text-slate-600';
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
        <h2 className="text-2xl font-bold text-slate-900">Doctor Dashboard</h2>
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Calendar className="w-4 h-4" />
          {today}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4 mb-7">
        <StatCard label="Total Today" value={stats.total} sub="Patients registered" icon={Users} color="cyan" />
        <StatCard label="Waiting" value={stats.waiting} sub="In queue" icon={Clock} color="amber" />
        <StatCard label="Completed" value={stats.completed} sub="Seen today" icon={CheckCircle2} color="green" />
        <StatCard label="No Show" value={stats.noShow} sub="Missed" icon={XCircle} color="red" />
      </div>

      {/* Now Serving Banner */}
      {currentPatient ? (
        <div
          className="rounded-2xl px-8 py-7 mb-6 flex justify-between items-center shadow-lg"
          style={{ background: 'linear-gradient(135deg, #0e7490, #14b8a6)', boxShadow: '0 8px 30px rgba(14,116,144,0.25)' }}
        >
          <div>
            <p className="text-white/80 text-xs uppercase tracking-widest font-semibold">Now Serving</p>
            <div className="flex items-baseline gap-4 mt-2">
              <span className="text-5xl font-extrabold text-white leading-none">
                #{currentPatient.tokenNumber}
              </span>
              <div>
                <p className="text-white/90 text-lg font-medium">
                  {currentPatient.patientName}
                  {currentPatient.visitType === 'APPOINTMENT' ? (
                    <span className="ml-2 px-2 py-0.5 rounded-md bg-white/20 text-white text-xs font-semibold">
                      Appt {currentPatient.appointmentTime || ''}
                    </span>
                  ) : (
                    <span className="ml-2 px-2 py-0.5 rounded-md bg-white/10 text-white/70 text-xs font-semibold">
                      Walk-in
                    </span>
                  )}
                </p>
                <p className="text-white/60 text-sm">
                  {currentPatient.phone}
                  {currentPatient.calledAt && ` \u2022 Called at ${currentPatient.calledAt}`}
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => markNoShow(currentPatient.id)}
              disabled={actionLoading === 'noshow'}
              className="px-5 py-3 rounded-xl text-sm font-semibold text-white bg-white/15 border border-white/30 hover:bg-white/25 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              No Show
            </button>
            <button
              onClick={() => completeVisit(currentPatient.id)}
              disabled={actionLoading === 'complete'}
              className="px-5 py-3 rounded-xl text-sm font-semibold text-cyan-700 bg-white hover:bg-green-50 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              Mark Complete
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl px-8 py-7 mb-6 text-center bg-slate-100 border border-slate-200">
          <p className="text-slate-500 text-sm">No patient is being seen right now. Click &quot;Call Next&quot; to begin.</p>
        </div>
      )}

      {/* Queue Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-base font-bold text-slate-900">Today&apos;s Queue</h3>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-cyan-50 text-cyan-700">
              {stats.total} Patients
            </span>
            <button
              onClick={callNext}
              disabled={actionLoading === 'callNext'}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white flex items-center gap-2 shadow-md shadow-cyan-700/20 disabled:opacity-50 transition-all"
              style={{ background: 'linear-gradient(135deg, #0e7490, #14b8a6)' }}
            >
              <ArrowRight className="w-4 h-4" />
              Call Next
            </button>
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/60">
                <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 border-b-2 border-slate-100">Token</th>
                <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 border-b-2 border-slate-100">Patient Name</th>
                <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 border-b-2 border-slate-100">Type</th>
                <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 border-b-2 border-slate-100">Phone</th>
                <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 border-b-2 border-slate-100">Status</th>
                <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 border-b-2 border-slate-100">Time</th>
                <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 border-b-2 border-slate-100">Action</th>
              </tr>
            </thead>
            <tbody>
              {queue.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-sm text-slate-400">
                    No patients in the queue yet
                  </td>
                </tr>
              ) : (
                queue.map((entry) => (
                  <tr
                    key={entry.id}
                    className={`transition-colors ${entry.status === 'IN_PROGRESS' ? 'bg-sky-50' : 'hover:bg-slate-50/60'}`}
                  >
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center justify-center w-9 h-9 rounded-xl text-sm font-bold ${tokenBadgeClass(entry.status)}`}>
                        {entry.tokenNumber}
                      </span>
                    </td>
                    <td className={`px-4 py-3.5 text-sm font-semibold ${entry.status === 'IN_PROGRESS' ? 'text-cyan-700 font-bold' : 'text-slate-700'}`}>
                      {entry.patientName}
                    </td>
                    <td className="px-4 py-3.5">
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
                    <td className="px-4 py-3.5 text-sm text-slate-500">{entry.phone}</td>
                    <td className="px-4 py-3.5">{statusBadge(entry.status)}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-400">{entry.createdAt || '\u2014'}</td>
                    <td className="px-4 py-3.5">
                      {entry.status === 'IN_PROGRESS' ? (
                        <button
                          onClick={() => completeVisit(entry.id)}
                          className="text-cyan-700 text-xs font-semibold hover:underline"
                        >
                          Complete
                        </button>
                      ) : (
                        <span className="text-slate-300">&mdash;</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
