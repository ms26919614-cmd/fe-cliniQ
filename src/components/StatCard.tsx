import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number | string;
  sub: string;
  icon: LucideIcon;
  color: 'cyan' | 'green' | 'amber' | 'blue' | 'red';
}

const colorMap = {
  cyan: { bg: 'bg-cyan-50', text: 'text-cyan-700' },
  green: { bg: 'bg-green-50', text: 'text-green-600' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
  red: { bg: 'bg-red-50', text: 'text-red-600' },
};

export default function StatCard({ label, value, sub, icon: Icon, color }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.bg}`}>
          <Icon className={`w-5 h-5 ${c.text}`} />
        </div>
      </div>
      <div className="text-3xl font-extrabold text-slate-900">{value}</div>
      <div className="text-xs text-slate-400 mt-1">{sub}</div>
    </div>
  );
}
