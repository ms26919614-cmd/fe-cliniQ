'use client';

import { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
import api from '@/lib/api';

interface TokenDisplay {
  tokenNumber: number;
  status: string;
  visitType: 'WALK_IN' | 'APPOINTMENT';
  patientName: string;
  appointmentTime: string | null;
}

interface QueueDisplay {
  date: string;
  currentToken: number | null;
  currentPatientName: string | null;
  currentVisitType: 'WALK_IN' | 'APPOINTMENT' | null;
  currentAppointmentTime: string | null;
  totalTokens: number;
  waitingTokens: TokenDisplay[];
  completedTokens: TokenDisplay[];
}

export default function QueueDisplayPage() {
  const [queue, setQueue] = useState<QueueDisplay | null>(null);
  const [time, setTime] = useState(new Date());

  const fetchQueue = async () => {
    try {
      const res = await api.get('/api/queue/display');
      setQueue(res.data);
    } catch (err) {
      console.error('Failed to fetch queue display', err);
    }
  };

  useEffect(() => {
    fetchQueue();
    const queueInterval = setInterval(fetchQueue, 5000);
    const timeInterval = setInterval(() => setTime(new Date()), 1000);
    return () => {
      clearInterval(queueInterval);
      clearInterval(timeInterval);
    };
  }, []);

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen flex flex-col overflow-hidden"
         style={{ background: 'linear-gradient(135deg, #0d4f5c 0%, #0e7490 40%, #14b8a6 80%, #22d3ee 100%)' }}>

      {/* Time */}
      <div className="absolute top-5 right-7 text-white/50 text-sm font-medium">
        {formatTime(time)} &bull; {formatDate(time)}
      </div>

      {/* Header */}
      <div className="text-center pt-8 pb-4">
        <div className="inline-flex items-center gap-3 bg-white/10 px-7 py-2.5 rounded-full backdrop-blur-xl border border-white/15">
          <Activity className="w-7 h-7 text-white" />
          <span className="text-white text-xl font-extrabold">CliniQ</span>
        </div>
        <p className="text-white/50 text-xs mt-2.5 uppercase tracking-[2px]">
          Live Queue Status &bull; No Login Required
        </p>
      </div>

      {/* Main */}
      <div className="flex-1 grid grid-cols-2 gap-6 px-10 pb-6 max-h-[calc(100vh-140px)]">
        {/* Now Serving */}
        <div className="bg-white/[0.08] rounded-3xl backdrop-blur-xl border border-white/10 flex flex-col items-center justify-center p-10 relative overflow-hidden">
          <div className="absolute top-[-60px] right-[-60px] w-[200px] h-[200px] rounded-full bg-white/[0.04]" />
          <p className="text-sm text-white/60 uppercase tracking-[3px] font-semibold mb-4">Now Serving</p>
          <div className="w-48 h-48 rounded-full bg-white/[0.08] flex items-center justify-center mb-6 animate-pulse">
            <span className="text-8xl font-black text-white" style={{ textShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
              {queue?.currentToken ? `#${queue.currentToken}` : '--'}
            </span>
          </div>
          {queue?.currentToken ? (
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-teal-300 text-base font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-300 animate-[pulse_1.5s_ease-in-out_infinite]" />
                Currently Being Seen
              </div>
              {queue.currentPatientName && (
                <p className="text-white/60 text-sm mt-1">{queue.currentPatientName}</p>
              )}
              {queue.currentVisitType === 'APPOINTMENT' ? (
                <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-violet-500/20 text-violet-300 text-[11px] font-semibold">
                  Appointment {queue.currentAppointmentTime || ''}
                </span>
              ) : queue.currentVisitType === 'WALK_IN' ? (
                <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-white/10 text-white/50 text-[11px] font-semibold">
                  Walk-in
                </span>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-white/40 text-base font-semibold">
              No Patient Being Seen
            </div>
          )}
        </div>

        {/* Right */}
        <div className="flex flex-col gap-5">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3.5">
            {[
              { num: queue?.waitingTokens?.length ?? 0, label: 'Waiting' },
              { num: queue?.completedTokens?.length ?? 0, label: 'Completed' },
              { num: queue?.totalTokens ?? 0, label: 'Total Today' },
            ].map((s) => (
              <div key={s.label} className="bg-white/[0.08] rounded-2xl backdrop-blur-xl border border-white/10 py-4 px-5 text-center">
                <div className="text-4xl font-extrabold text-white">{s.num}</div>
                <div className="text-[11px] text-white/50 uppercase tracking-wider font-semibold mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Up Next */}
          <div className="flex-1 bg-white/[0.08] rounded-2xl backdrop-blur-xl border border-white/10 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-white/[0.08] flex justify-between items-center">
              <h3 className="text-white text-sm font-bold">Up Next</h3>
              <span className="bg-white/10 px-3 py-1 rounded-full text-white/70 text-xs font-semibold">
                {queue?.waitingTokens?.length ?? 0} waiting
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
              {queue?.waitingTokens?.length === 0 && (
                <p className="text-white/30 text-center py-8 text-sm">No patients waiting</p>
              )}
              {queue?.waitingTokens?.map((t, i) => (
                <div key={t.tokenNumber}
                     className={`flex items-center gap-4 px-3.5 py-3 rounded-xl ${i === 0 ? 'bg-white/[0.08]' : ''}`}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-extrabold border
                    ${i === 0
                      ? 'bg-teal-300/20 border-teal-300/30 text-teal-300'
                      : 'bg-white/10 border-white/15 text-white'
                    }`}>
                    #{t.tokenNumber}
                  </div>
                  <div className="flex-1">
                    <p className={`text-xs font-medium ${i === 0 ? 'text-teal-300' : 'text-white/40'}`}>
                      {i === 0 ? 'Next in line' : `${i + 1}${i === 1 ? 'nd' : i === 2 ? 'rd' : 'th'} in queue`}
                    </p>
                    <p className="text-[11px] text-white/30 uppercase tracking-wide">
                      {t.patientName}
                    </p>
                  </div>
                  {t.visitType === 'APPOINTMENT' ? (
                    <span className="px-2 py-0.5 rounded-md bg-violet-500/20 text-violet-300 text-[10px] font-semibold">
                      Appt {t.appointmentTime || ''}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-white/10 text-white/40 text-[10px] font-semibold">
                      Walk-in
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-3 text-white/25 text-[11px] tracking-wide">
        CliniQ &mdash; Clinic Queue & Token Management System &bull; Auto-refreshes every 5 seconds
      </div>
    </div>
  );
}
