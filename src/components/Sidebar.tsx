'use client';

import { useAuth } from '@/lib/auth-context';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, Monitor, Settings, LogOut, Activity,
  CalendarDays,
} from 'lucide-react';

interface NavSection {
  title: string;
  items: { label: string; href: string; icon: typeof LayoutDashboard }[];
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const isDoctor = user?.role === 'DOCTOR';

  const sections: NavSection[] = isDoctor
    ? [
        {
          title: 'Main',
          items: [
            { label: 'Dashboard', href: '/doctor', icon: LayoutDashboard },
          ],
        },
        {
          title: 'Appointments',
          items: [
            { label: 'Slot Configuration', href: '/doctor/slots', icon: Settings },
          ],
        },
        {
          title: 'Queue',
          items: [
            { label: 'Queue Display', href: '/queue', icon: Monitor },
          ],
        },
      ]
    : [
        {
          title: 'Main',
          items: [
            { label: 'Dashboard', href: '/receptionist', icon: LayoutDashboard },
          ],
        },
        {
          title: 'Appointments',
          items: [
            { label: 'Book Appointment', href: '/receptionist/appointments', icon: CalendarDays },
          ],
        },
        {
          title: 'Queue',
          items: [
            { label: 'Queue Display', href: '/queue', icon: Monitor },
          ],
        },
      ];

  return (
    <nav className="fixed left-0 top-0 bottom-0 w-64 flex flex-col z-10"
         style={{ background: 'linear-gradient(180deg, #0d4f5c 0%, #0e7490 50%, #14b8a6 100%)' }}>
      {/* Brand */}
      <div className="px-6 py-7 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white text-xl font-extrabold">CliniQ</h1>
            <p className="text-white/50 text-xs">Queue Management</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="px-3 py-2 text-[10px] uppercase tracking-widest text-white/40 font-semibold">
              {section.title}
            </p>
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all
                    ${active
                      ? 'bg-white/[0.18] text-white font-semibold'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                >
                  <Icon className={`w-5 h-5 ${active ? 'opacity-100' : 'opacity-70'}`} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* User / Logout */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 p-2 rounded-xl bg-white/[0.08]">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">
            {user?.fullName?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold truncate">{user?.fullName}</p>
            <p className="text-white/50 text-xs">{user?.role === 'DOCTOR' ? 'Doctor' : 'Receptionist'}</p>
          </div>
          <button onClick={logout} className="text-white/50 hover:text-white transition-colors" title="Logout">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}
