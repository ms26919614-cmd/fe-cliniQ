'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle,
  CheckCircle2,
  Loader2,
  Settings,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  Users,
} from 'lucide-react';
import api from '@/lib/api';

// Types
interface DaySchedule {
  id: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  workingDay: boolean;
  breaks: { id: number; breakStart: string; breakEnd: string; label: string }[];
}

interface ClinicSettings {
  id: number;
  clinicName: string;
  workingStartTime: string;
  workingEndTime: string;
  slotDurationMinutes: number;
  maxPatientsPerSlot: number;
  breakStartTime: string | null;
  breakEndTime: string | null;
}

interface SlotData {
  id: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  maxPatients: number;
  active: boolean;
}

interface Holiday {
  id: number;
  holidayDate: string;
  description: string;
}

interface DayOverride {
  id: number;
  overrideDate: string;
  workingDay: boolean;
  startTime: string | null;
  endTime: string | null;
  reason: string;
}

interface ToastState {
  show: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
}

// Constants
const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const DAY_SHORT: Record<string, string> = {
  MONDAY: 'Mon',
  TUESDAY: 'Tue',
  WEDNESDAY: 'Wed',
  THURSDAY: 'Thu',
  FRIDAY: 'Fri',
  SATURDAY: 'Sat',
  SUNDAY: 'Sun',
};

// Map JS getDay() (0=Sun) to our DayOfWeek enum
const DOW_MAP: Record<number, string> = {
  0: 'SUNDAY', 1: 'MONDAY', 2: 'TUESDAY', 3: 'WEDNESDAY',
  4: 'THURSDAY', 5: 'FRIDAY', 6: 'SATURDAY',
};

function formatLocalDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseLocalDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export default function SlotsPage() {
  const [activeTab, setActiveTab] = useState('schedule');
  const [daySchedules, setDaySchedules] = useState<DaySchedule[]>([]);
  const [settings, setSettings] = useState<ClinicSettings | null>(null);
  const [slots, setSlots] = useState<SlotData[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>({ show: false, message: '', type: 'info' });

  // Daily View state
  const today = new Date();
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState(formatLocalDate(today));
  const [dailySlots, setDailySlots] = useState<SlotData[]>([]);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dayOverrides, setDayOverrides] = useState<DayOverride[]>([]);
  const [currentOverride, setCurrentOverride] = useState<DayOverride | null>(null);
  const [overrideForm, setOverrideForm] = useState({ workingDay: false, startTime: '08:00', endTime: '17:00', reason: '' });

  // Fetch all data on component mount
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    const [schedulesRes, settingsRes, slotsRes, holidaysRes, overridesRes] = await Promise.allSettled([
      api.get('/api/day-schedules'),
      api.get('/api/settings'),
      api.get('/api/appointment-slots'),
      api.get('/api/holidays'),
      api.get('/api/day-overrides'),
    ]);

    if (schedulesRes.status === 'fulfilled') setDaySchedules(schedulesRes.value.data || []);
    if (settingsRes.status === 'fulfilled') setSettings(settingsRes.value.data || null);
    if (slotsRes.status === 'fulfilled') setSlots(slotsRes.value.data || []);
    if (holidaysRes.status === 'fulfilled') setHolidays(holidaysRes.value.data || []);
    if (overridesRes.status === 'fulfilled') setDayOverrides(overridesRes.value.data || []);

    setLoading(false);
  };

  // ===== DAILY VIEW HELPERS =====
  const fetchDailySlots = async (dateStr: string) => {
    setDailyLoading(true);
    try {
      const dayDate = parseLocalDate(dateStr);
      const dayOfWeek = DOW_MAP[dayDate.getDay()];
      const res = await api.get(`/api/appointment-slots/day/${dayOfWeek}`);
      setDailySlots(res.data || []);
    } catch {
      setDailySlots([]);
    } finally {
      setDailyLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'daily' && selectedDate) {
      fetchDailySlots(selectedDate);
      // Load override for selected date
      const override = dayOverrides.find((o) => o.overrideDate === selectedDate) || null;
      setCurrentOverride(override);
      if (override) {
        setOverrideForm({
          workingDay: override.workingDay,
          startTime: override.startTime || '08:00',
          endTime: override.endTime || '17:00',
          reason: override.reason || '',
        });
      } else {
        // Default from weekly schedule
        const d = parseLocalDate(selectedDate);
        const dow = DOW_MAP[d.getDay()];
        const sched = daySchedules.find((s) => s.dayOfWeek === dow);
        setOverrideForm({
          workingDay: sched ? !sched.workingDay : false, // flip the default as override
          startTime: sched?.startTime || '08:00',
          endTime: sched?.endTime || '17:00',
          reason: '',
        });
      }
    }
  }, [selectedDate, activeTab, dayOverrides]);

  const overrideMap = new Map(dayOverrides.map((o) => [o.overrideDate, o]));
  const holidaySet = new Set(holidays.map((h) => h.holidayDate));
  const nonWorkingDays = new Set(
    daySchedules.filter((d) => !d.workingDay).map((d) => d.dayOfWeek)
  );
  const isHoliday = (dateStr: string) => holidaySet.has(dateStr);
  const hasOverride = (dateStr: string) => overrideMap.has(dateStr);
  const getOverride = (dateStr: string) => overrideMap.get(dateStr);
  const isNonWorking = (dateStr: string) => {
    // Override takes precedence
    const override = overrideMap.get(dateStr);
    if (override) return !override.workingDay;
    const d = parseLocalDate(dateStr);
    return nonWorkingDays.has(DOW_MAP[d.getDay()]);
  };
  const todayStr = formatLocalDate(today);

  const getCalendarDays = () => {
    const firstDay = new Date(calYear, calMonth, 1);
    const lastDay = new Date(calYear, calMonth + 1, 0);
    const startOffset = firstDay.getDay();
    const days: { date: Date; dateStr: string; inMonth: boolean }[] = [];
    for (let i = 0; i < startOffset; i++) {
      const d = new Date(calYear, calMonth, -startOffset + i + 1);
      days.push({ date: d, dateStr: formatLocalDate(d), inMonth: false });
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dt = new Date(calYear, calMonth, d);
      days.push({ date: dt, dateStr: formatLocalDate(dt), inMonth: true });
    }
    while (days.length < 42) {
      const d = new Date(calYear, calMonth + 1, days.length - startOffset - lastDay.getDate() + 1);
      days.push({ date: d, dateStr: formatLocalDate(d), inMonth: false });
    }
    return days;
  };

  const handleSaveOverride = async () => {
    try {
      setSaving('override');
      const res = await api.post('/api/day-overrides', {
        overrideDate: selectedDate,
        workingDay: overrideForm.workingDay,
        startTime: overrideForm.workingDay ? overrideForm.startTime : null,
        endTime: overrideForm.workingDay ? overrideForm.endTime : null,
        reason: overrideForm.reason,
      });
      const saved: DayOverride = res.data;
      setDayOverrides((prev) => {
        const filtered = prev.filter((o) => o.overrideDate !== selectedDate);
        return [...filtered, saved].sort((a, b) => a.overrideDate.localeCompare(b.overrideDate));
      });
      setCurrentOverride(saved);
      showToast('Override saved', 'success');
    } catch {
      showToast('Failed to save override', 'error');
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteOverride = async () => {
    if (!currentOverride) return;
    try {
      setSaving('override');
      await api.delete(`/api/day-overrides/${currentOverride.id}`);
      setDayOverrides((prev) => prev.filter((o) => o.id !== currentOverride.id));
      setCurrentOverride(null);
      showToast('Override removed — back to weekly default', 'success');
    } catch {
      showToast('Failed to remove override', 'error');
    } finally {
      setSaving(null);
    }
  };

  const handleToggleSlot = async (slotId: number) => {
    try {
      setSaving(`slot-${slotId}`);
      await api.patch(`/api/appointment-slots/${slotId}/toggle`);
      setDailySlots((prev) =>
        prev.map((s) => (s.id === slotId ? { ...s, active: !s.active } : s))
      );
      // Also refresh main slots data
      const slotsRes = await api.get('/api/appointment-slots');
      setSlots(slotsRes.data || []);
      showToast('Slot toggled', 'success');
    } catch {
      showToast('Failed to toggle slot', 'error');
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteSlot = async (slotId: number) => {
    try {
      setSaving(`slot-${slotId}`);
      await api.delete(`/api/appointment-slots/${slotId}`);
      setDailySlots((prev) => prev.filter((s) => s.id !== slotId));
      const slotsRes = await api.get('/api/appointment-slots');
      setSlots(slotsRes.data || []);
      showToast('Slot deleted', 'success');
    } catch {
      showToast('Failed to delete slot', 'error');
    } finally {
      setSaving(null);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ ...toast, show: false }), 3000);
  };

  // ===== WEEKLY SCHEDULE TAB =====
  const handleToggleWorkingDay = async (dayOfWeek: string) => {
    const schedule = daySchedules.find((d) => d.dayOfWeek === dayOfWeek);
    if (!schedule) return;

    try {
      setSaving(dayOfWeek);
      const updated = {
        ...schedule,
        workingDay: !schedule.workingDay,
      };

      await api.put(`/api/day-schedules/${dayOfWeek}`, updated);
      setDaySchedules((prev) =>
        prev.map((d) => (d.dayOfWeek === dayOfWeek ? updated : d))
      );
      showToast(`${dayOfWeek} updated`, 'success');
    } catch (error) {
      console.error('Error updating working day:', error);
      showToast('Failed to update working day', 'error');
    } finally {
      setSaving(null);
    }
  };

  const handleTimeChange = (
    dayOfWeek: string,
    field: 'startTime' | 'endTime',
    value: string
  ) => {
    setDaySchedules((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, [field]: value } : d))
    );
  };

  const handleBreakChange = (
    dayOfWeek: string,
    breakId: number,
    field: string,
    value: string
  ) => {
    setDaySchedules((prev) =>
      prev.map((d) =>
        d.dayOfWeek === dayOfWeek
          ? {
              ...d,
              breaks: d.breaks.map((b) =>
                b.id === breakId ? { ...b, [field]: value } : b
              ),
            }
          : d
      )
    );
  };

  const handleAddBreak = (dayOfWeek: string) => {
    setDaySchedules((prev) =>
      prev.map((d) =>
        d.dayOfWeek === dayOfWeek
          ? {
              ...d,
              breaks: [
                ...d.breaks,
                { id: Date.now(), breakStart: '12:00', breakEnd: '13:00', label: 'Lunch' },
              ],
            }
          : d
      )
    );
  };

  const handleRemoveBreak = (dayOfWeek: string, breakId: number) => {
    setDaySchedules((prev) =>
      prev.map((d) =>
        d.dayOfWeek === dayOfWeek
          ? {
              ...d,
              breaks: d.breaks.filter((b) => b.id !== breakId),
            }
          : d
      )
    );
  };

  const handleSaveSchedule = async (dayOfWeek: string) => {
    const schedule = daySchedules.find((d) => d.dayOfWeek === dayOfWeek);
    if (!schedule) return;

    try {
      setSaving(dayOfWeek);
      await api.put(`/api/day-schedules/${dayOfWeek}`, schedule);
      showToast(`${dayOfWeek} schedule saved`, 'success');
    } catch (error) {
      console.error('Error saving schedule:', error);
      showToast('Failed to save schedule', 'error');
    } finally {
      setSaving(null);
    }
  };

  const handleGenerateSlots = async (dayOfWeek: string) => {
    try {
      setSaving(dayOfWeek);
      await api.post('/api/appointment-slots/generate', {
        daysOfWeek: [dayOfWeek],
      });
      // Reload slots
      const slotsRes = await api.get('/api/appointment-slots');
      setSlots(slotsRes.data || []);
      showToast(`Slots generated for ${dayOfWeek}`, 'success');
    } catch (error) {
      console.error('Error generating slots:', error);
      showToast('Failed to generate slots', 'error');
    } finally {
      setSaving(null);
    }
  };

  const getSlotCountForDay = (dayOfWeek: string) => {
    return slots.filter((s) => s.dayOfWeek === dayOfWeek).length;
  };

  // ===== CLINIC SETTINGS TAB =====
  const handleSettingsChange = (field: string, value: any) => {
    if (settings) {
      setSettings({ ...settings, [field]: value });
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;

    try {
      setSaving('settings');
      await api.put('/api/settings', settings);
      showToast('Settings saved successfully', 'success');
    } catch (error) {
      console.error('Error saving settings:', error);
      showToast('Failed to save settings', 'error');
    } finally {
      setSaving(null);
    }
  };

  // ===== HOLIDAYS TAB =====
  const [newHoliday, setNewHoliday] = useState({ holidayDate: '', description: '' });

  const handleAddHoliday = async () => {
    if (!newHoliday.holidayDate || !newHoliday.description) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    try {
      setSaving('holiday');
      const res = await api.post('/api/holidays', newHoliday);
      setHolidays([...holidays, res.data]);
      setNewHoliday({ holidayDate: '', description: '' });
      showToast('Holiday added successfully', 'success');
    } catch (error) {
      console.error('Error adding holiday:', error);
      showToast('Failed to add holiday', 'error');
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteHoliday = async (id: number) => {
    try {
      setSaving(`holiday-${id}`);
      await api.delete(`/api/holidays/${id}`);
      setHolidays(holidays.filter((h) => h.id !== id));
      showToast('Holiday deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting holiday:', error);
      showToast('Failed to delete holiday', 'error');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Slot Configuration</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your clinic schedule, settings, and holidays
          </p>
        </div>
        <Calendar className="w-10 h-10" style={{ color: '#0d4f5c' }} />
      </div>

      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed top-6 right-6 z-50 rounded-xl px-5 py-3.5 flex items-center gap-3 shadow-lg border
          ${toast.type === 'success' ? 'bg-green-50 border-green-200' : toast.type === 'error' ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-green-500" /> :
           toast.type === 'error' ? <AlertCircle className="w-5 h-5 text-red-500" /> :
           <AlertCircle className="w-5 h-5 text-blue-500" />}
          <span className={`text-sm font-semibold ${toast.type === 'success' ? 'text-green-800' : toast.type === 'error' ? 'text-red-800' : 'text-blue-800'}`}>
            {toast.message}
          </span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl max-w-xl">
        {[
          { key: 'schedule', label: 'Weekly Schedule', icon: Calendar },
          { key: 'daily', label: 'Daily View', icon: Eye },
          { key: 'settings', label: 'Clinic Settings', icon: Settings },
          { key: 'holidays', label: 'Holidays', icon: Calendar },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all
                ${activeTab === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: WEEKLY SCHEDULE */}
      {activeTab === 'schedule' && (
        <div className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {daySchedules.map((schedule) => (
              <div
                key={schedule.dayOfWeek}
                className={`rounded-2xl border border-slate-200 shadow-sm transition-all ${
                  schedule.workingDay ? 'bg-white' : 'bg-slate-50'
                }`}
              >
                {/* Day Header with Toggle */}
                <div className="p-4 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {DAY_SHORT[schedule.dayOfWeek]}
                      </p>
                      <p className="text-xs text-slate-500">{schedule.dayOfWeek}</p>
                    </div>
                    <button
                      onClick={() => handleToggleWorkingDay(schedule.dayOfWeek)}
                      disabled={saving === schedule.dayOfWeek}
                      className={`w-10 h-[22px] rounded-full relative transition-colors disabled:opacity-50
                        ${schedule.workingDay ? 'bg-teal-500' : 'bg-slate-300'}`}
                      title={schedule.workingDay ? 'Mark as non-working' : 'Mark as working'}
                    >
                      <span className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-all
                        ${schedule.workingDay ? 'left-[21px]' : 'left-[3px]'}`} />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                  {schedule.workingDay ? (
                    <>
                      {/* Time Inputs */}
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
                            Start Time
                          </label>
                          <input
                            type="time"
                            value={schedule.startTime}
                            onChange={(e) =>
                              handleTimeChange(
                                schedule.dayOfWeek,
                                'startTime',
                                e.target.value
                              )
                            }
                            className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-900 focus:outline-none focus:border-cyan-700 focus:bg-white focus:ring-2 focus:ring-cyan-700/10 transition-all"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
                            End Time
                          </label>
                          <input
                            type="time"
                            value={schedule.endTime}
                            onChange={(e) =>
                              handleTimeChange(
                                schedule.dayOfWeek,
                                'endTime',
                                e.target.value
                              )
                            }
                            className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-900 focus:outline-none focus:border-cyan-700 focus:bg-white focus:ring-2 focus:ring-cyan-700/10 transition-all"
                          />
                        </div>
                      </div>

                      {/* Breaks Section */}
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          Breaks
                        </label>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {schedule.breaks.map((breakItem) => (
                            <div
                              key={breakItem.id}
                              className="flex gap-1.5 items-end bg-slate-50 p-2.5 rounded-lg"
                            >
                              <input
                                type="time"
                                value={breakItem.breakStart}
                                onChange={(e) =>
                                  handleBreakChange(
                                    schedule.dayOfWeek,
                                    breakItem.id,
                                    'breakStart',
                                    e.target.value
                                  )
                                }
                                className="flex-1 px-2 py-1.5 border-[1.5px] border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-cyan-700"
                              />
                              <input
                                type="time"
                                value={breakItem.breakEnd}
                                onChange={(e) =>
                                  handleBreakChange(
                                    schedule.dayOfWeek,
                                    breakItem.id,
                                    'breakEnd',
                                    e.target.value
                                  )
                                }
                                className="flex-1 px-2 py-1.5 border-[1.5px] border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-cyan-700"
                              />
                              <input
                                type="text"
                                value={breakItem.label}
                                onChange={(e) =>
                                  handleBreakChange(
                                    schedule.dayOfWeek,
                                    breakItem.id,
                                    'label',
                                    e.target.value
                                  )
                                }
                                placeholder="Label"
                                className="flex-1 px-2 py-1.5 border-[1.5px] border-slate-200 rounded-lg text-xs bg-white placeholder-slate-400 focus:outline-none focus:border-cyan-700"
                              />
                              <button
                                onClick={() =>
                                  handleRemoveBreak(schedule.dayOfWeek, breakItem.id)
                                }
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => handleAddBreak(schedule.dayOfWeek)}
                          className="w-full py-2 px-3 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all flex items-center justify-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Break
                        </button>
                      </div>

                      {/* Slot Count Badge */}
                      <div className="flex items-center justify-between p-2.5 bg-gradient-to-r from-cyan-50 to-teal-50 rounded-lg border border-cyan-200">
                        <span className="text-xs font-semibold text-slate-700">
                          Generated Slots:
                        </span>
                        <span className="px-2.5 py-1 bg-white rounded-lg text-xs font-bold text-cyan-700 border border-cyan-200">
                          {getSlotCountForDay(schedule.dayOfWeek)}
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => handleSaveSchedule(schedule.dayOfWeek)}
                          disabled={saving === schedule.dayOfWeek}
                          className="flex-1 py-2 px-3 text-xs font-semibold text-white rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                          style={{
                            background: 'linear-gradient(135deg, #0e7490, #14b8a6)',
                          }}
                        >
                          {saving === schedule.dayOfWeek ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-3.5 h-3.5" />
                              Save
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleGenerateSlots(schedule.dayOfWeek)}
                          disabled={saving === schedule.dayOfWeek || !schedule.workingDay}
                          className="flex-1 py-2 px-3 text-xs font-semibold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          {saving === schedule.dayOfWeek ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Calendar className="w-3.5 h-3.5" />
                              Generate
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-sm text-slate-500">Non-working day</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Toggle to enable scheduling
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: DAILY VIEW */}
      {activeTab === 'daily' && (
        <div className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Mini Calendar */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <button onClick={() => {
                    if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); }
                    else setCalMonth(calMonth - 1);
                  }} className="p-1.5 hover:bg-slate-100 rounded-lg transition-all">
                    <ChevronLeft className="w-4 h-4 text-slate-600" />
                  </button>
                  <span className="text-sm font-semibold text-slate-900">
                    {new Date(calYear, calMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                  <button onClick={() => {
                    if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); }
                    else setCalMonth(calMonth + 1);
                  }} className="p-1.5 hover:bg-slate-100 rounded-lg transition-all">
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-0.5 text-center">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                    <div key={d} className="text-[10px] font-semibold text-slate-400 py-1.5">{d}</div>
                  ))}
                  {getCalendarDays().map(({ dateStr, inMonth }, i) => {
                    const selected = dateStr === selectedDate;
                    const holiday = isHoliday(dateStr);
                    const nonWorking = isNonWorking(dateStr);
                    const overridden = hasOverride(dateStr);
                    const isToday = dateStr === todayStr;
                    const hasSlots = (() => {
                      const d = parseLocalDate(dateStr);
                      return slots.filter((s) => s.dayOfWeek === DOW_MAP[d.getDay()]).length > 0;
                    })();
                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedDate(dateStr)}
                        className={`relative w-full aspect-square flex items-center justify-center text-xs rounded-lg transition-all
                          ${!inMonth ? 'text-slate-300' : ''}
                          ${selected ? 'text-white font-bold' : ''}
                          ${!selected && holiday ? 'bg-red-50 text-red-600 font-semibold' : ''}
                          ${!selected && !holiday && overridden ? 'bg-amber-50 text-amber-700 font-semibold ring-1 ring-amber-300' : ''}
                          ${!selected && nonWorking && !holiday && !overridden ? 'bg-slate-100 text-slate-400' : ''}
                          ${!selected && inMonth && !holiday && !nonWorking && !overridden ? 'hover:bg-cyan-50 text-slate-700' : ''}
                          ${isToday && !selected ? 'ring-1 ring-cyan-400' : ''}
                        `}
                        style={selected ? { background: 'linear-gradient(135deg, #0e7490, #14b8a6)' } : {}}
                        title={holiday ? holidays.find((h) => h.holidayDate === dateStr)?.description || 'Holiday' : overridden ? `Override: ${getOverride(dateStr)?.reason || (getOverride(dateStr)?.workingDay ? 'Working' : 'Non-working')}` : nonWorking ? 'Non-working day' : ''}
                      >
                        {parseLocalDate(dateStr).getDate()}
                        {hasSlots && inMonth && !selected && (
                          <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-cyan-500" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'linear-gradient(135deg, #0e7490, #14b8a6)' }} />
                    <span className="text-[10px] text-slate-500">Selected</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <span className="text-[10px] text-slate-500">Holiday</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <span className="text-[10px] text-slate-500">Override</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                    <span className="text-[10px] text-slate-500">Non-working</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                    <span className="text-[10px] text-slate-500">Has slots</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Slot List + Override for Selected Date */}
            <div className="lg:col-span-2 space-y-4">
              {/* Day Override Card */}
              <div className={`rounded-2xl border shadow-sm p-5 ${currentOverride ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      Date Override
                      {currentOverride && (
                        <span className="ml-2 px-2 py-0.5 bg-amber-200 text-amber-800 text-[10px] font-bold rounded-full uppercase">Active</span>
                      )}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {currentOverride
                        ? `This date has a custom override: ${currentOverride.workingDay ? 'Working day' : 'Non-working day'}${currentOverride.reason ? ` — ${currentOverride.reason}` : ''}`
                        : 'Override the weekly schedule for this specific date'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-slate-500">Status:</label>
                    <button
                      onClick={() => setOverrideForm({ ...overrideForm, workingDay: !overrideForm.workingDay })}
                      className={`w-10 h-[22px] rounded-full relative transition-colors
                        ${overrideForm.workingDay ? 'bg-teal-500' : 'bg-slate-300'}`}
                    >
                      <span className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-all
                        ${overrideForm.workingDay ? 'left-[21px]' : 'left-[3px]'}`} />
                    </button>
                    <span className="text-xs text-slate-600">{overrideForm.workingDay ? 'Working' : 'Non-working'}</span>
                  </div>
                  {overrideForm.workingDay && (
                    <>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Start</label>
                        <input type="time" value={overrideForm.startTime}
                          onChange={(e) => setOverrideForm({ ...overrideForm, startTime: e.target.value })}
                          className="px-2 py-1.5 border-[1.5px] border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-cyan-700"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">End</label>
                        <input type="time" value={overrideForm.endTime}
                          onChange={(e) => setOverrideForm({ ...overrideForm, endTime: e.target.value })}
                          className="px-2 py-1.5 border-[1.5px] border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-cyan-700"
                        />
                      </div>
                    </>
                  )}
                  <div className="flex-1 min-w-[120px]">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Reason</label>
                    <input type="text" value={overrideForm.reason} placeholder="e.g. Doctor on leave"
                      onChange={(e) => setOverrideForm({ ...overrideForm, reason: e.target.value })}
                      className="w-full px-2 py-1.5 border-[1.5px] border-slate-200 rounded-lg text-xs bg-white placeholder-slate-400 focus:outline-none focus:border-cyan-700"
                    />
                  </div>
                  <button onClick={handleSaveOverride} disabled={saving === 'override'}
                    className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg transition-all disabled:opacity-50 flex items-center gap-1"
                    style={{ background: 'linear-gradient(135deg, #0e7490, #14b8a6)' }}
                  >
                    {saving === 'override' ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                    Save Override
                  </button>
                  {currentOverride && (
                    <button onClick={handleDeleteOverride} disabled={saving === 'override'}
                      className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-all disabled:opacity-50 flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {/* Slots Panel */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                {/* Date Header */}
                <div className="p-5 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        {parseLocalDate(selectedDate).toLocaleDateString('en-US', {
                          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                        })}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {isHoliday(selectedDate)
                          ? `Holiday: ${holidays.find((h) => h.holidayDate === selectedDate)?.description}`
                          : isNonWorking(selectedDate)
                          ? 'Non-working day'
                          : `${dailySlots.length} slot${dailySlots.length !== 1 ? 's' : ''} configured`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isHoliday(selectedDate) && !isNonWorking(selectedDate) && (
                        <button
                          onClick={() => {
                            const d = parseLocalDate(selectedDate);
                            handleGenerateSlots(DOW_MAP[d.getDay()]);
                            setTimeout(() => fetchDailySlots(selectedDate), 1000);
                          }}
                          disabled={!!saving}
                          className="px-3 py-2 text-xs font-semibold text-white rounded-xl transition-all disabled:opacity-50 flex items-center gap-1.5"
                          style={{ background: 'linear-gradient(135deg, #0e7490, #14b8a6)' }}
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          Regenerate Slots
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  {dailyLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-cyan-600" />
                    </div>
                  ) : isHoliday(selectedDate) ? (
                    <div className="text-center py-12">
                      <Calendar className="w-10 h-10 text-red-300 mx-auto mb-3" />
                      <p className="text-sm font-semibold text-red-600">
                        {holidays.find((h) => h.holidayDate === selectedDate)?.description || 'Holiday'}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">Clinic is closed on this date</p>
                    </div>
                  ) : isNonWorking(selectedDate) ? (
                    <div className="text-center py-12">
                      <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                      <p className="text-sm font-semibold text-slate-500">Non-working Day</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {DOW_MAP[parseLocalDate(selectedDate).getDay()]} is not a working day
                      </p>
                    </div>
                  ) : dailySlots.length === 0 ? (
                    <div className="text-center py-12">
                      <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                      <p className="text-sm font-semibold text-slate-500">No slots generated</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Click &quot;Regenerate Slots&quot; to create slots for this day
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {dailySlots.map((slot) => (
                        <div
                          key={slot.id}
                          className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                            slot.active
                              ? 'bg-white border-slate-200 hover:border-cyan-200'
                              : 'bg-slate-50 border-slate-100 opacity-60'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            {/* Toggle */}
                            <button
                              onClick={() => handleToggleSlot(slot.id)}
                              disabled={saving === `slot-${slot.id}`}
                              className={`w-10 h-[22px] rounded-full relative transition-colors disabled:opacity-50
                                ${slot.active ? 'bg-teal-500' : 'bg-slate-300'}`}
                              title={slot.active ? 'Deactivate slot' : 'Activate slot'}
                            >
                              <span className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-all
                                ${slot.active ? 'left-[21px]' : 'left-[3px]'}`} />
                            </button>
                            {/* Time */}
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                {slot.startTime} – {slot.endTime}
                              </p>
                              <p className="text-xs text-slate-400">
                                {slot.active ? 'Active' : 'Inactive'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {/* Capacity badge */}
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-50 rounded-lg border border-cyan-100">
                              <Users className="w-3 h-3 text-cyan-700" />
                              <span className="text-xs font-semibold text-cyan-700">
                                {slot.maxPatients} max
                              </span>
                            </div>
                            {/* Delete */}
                            <button
                              onClick={() => handleDeleteSlot(slot.id)}
                              disabled={saving === `slot-${slot.id}`}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                              title="Delete slot"
                            >
                              {saving === `slot-${slot.id}` ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CLINIC SETTINGS */}
      {activeTab === 'settings' && (
        <div className="mt-6">
          <div className="max-w-2xl">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
              {settings && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
                      Clinic Name
                    </label>
                    <input
                      type="text"
                      value={settings.clinicName}
                      onChange={(e) => handleSettingsChange('clinicName', e.target.value)}
                      className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-900 focus:outline-none focus:border-cyan-700 focus:bg-white focus:ring-2 focus:ring-cyan-700/10 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
                        Working Start Time
                      </label>
                      <input
                        type="time"
                        value={settings.workingStartTime}
                        onChange={(e) =>
                          handleSettingsChange('workingStartTime', e.target.value)
                        }
                        className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-900 focus:outline-none focus:border-cyan-700 focus:bg-white focus:ring-2 focus:ring-cyan-700/10 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
                        Working End Time
                      </label>
                      <input
                        type="time"
                        value={settings.workingEndTime}
                        onChange={(e) =>
                          handleSettingsChange('workingEndTime', e.target.value)
                        }
                        className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-900 focus:outline-none focus:border-cyan-700 focus:bg-white focus:ring-2 focus:ring-cyan-700/10 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
                        Slot Duration (minutes)
                      </label>
                      <input
                        type="number"
                        min="5"
                        max="120"
                        value={settings.slotDurationMinutes}
                        onChange={(e) =>
                          handleSettingsChange(
                            'slotDurationMinutes',
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-900 focus:outline-none focus:border-cyan-700 focus:bg-white focus:ring-2 focus:ring-cyan-700/10 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
                        Max Patients Per Slot
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={settings.maxPatientsPerSlot}
                        onChange={(e) =>
                          handleSettingsChange(
                            'maxPatientsPerSlot',
                            parseInt(e.target.value) || 1
                          )
                        }
                        className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-900 focus:outline-none focus:border-cyan-700 focus:bg-white focus:ring-2 focus:ring-cyan-700/10 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
                        Break Start Time (Optional)
                      </label>
                      <input
                        type="time"
                        value={settings.breakStartTime || ''}
                        onChange={(e) =>
                          handleSettingsChange(
                            'breakStartTime',
                            e.target.value || null
                          )
                        }
                        className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-900 focus:outline-none focus:border-cyan-700 focus:bg-white focus:ring-2 focus:ring-cyan-700/10 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
                        Break End Time (Optional)
                      </label>
                      <input
                        type="time"
                        value={settings.breakEndTime || ''}
                        onChange={(e) =>
                          handleSettingsChange(
                            'breakEndTime',
                            e.target.value || null
                          )
                        }
                        className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-900 focus:outline-none focus:border-cyan-700 focus:bg-white focus:ring-2 focus:ring-cyan-700/10 transition-all"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleSaveSettings}
                    disabled={saving === 'settings'}
                    className="w-full py-3 px-4 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{
                      background: 'linear-gradient(135deg, #0e7490, #14b8a6)',
                    }}
                  >
                    {saving === 'settings' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Save Settings
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: HOLIDAYS */}
      {activeTab === 'holidays' && (
        <div className="mt-6">
          <div className="max-w-2xl space-y-6">
            {/* Add Holiday Form */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <h3 className="text-lg font-semibold text-slate-900">Add New Holiday</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
                    Holiday Date
                  </label>
                  <input
                    type="date"
                    value={newHoliday.holidayDate}
                    onChange={(e) =>
                      setNewHoliday({ ...newHoliday, holidayDate: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-900 focus:outline-none focus:border-cyan-700 focus:bg-white focus:ring-2 focus:ring-cyan-700/10 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
                    Description
                  </label>
                  <input
                    type="text"
                    value={newHoliday.description}
                    onChange={(e) =>
                      setNewHoliday({ ...newHoliday, description: e.target.value })
                    }
                    placeholder="e.g., New Year's Day"
                    className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-700 focus:bg-white focus:ring-2 focus:ring-cyan-700/10 transition-all"
                  />
                </div>
              </div>

              <button
                onClick={handleAddHoliday}
                disabled={saving === 'holiday'}
                className="w-full py-3 px-4 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #0e7490, #14b8a6)',
                }}
              >
                {saving === 'holiday' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Add Holiday
                  </>
                )}
              </button>
            </div>

            {/* Holidays List */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-slate-900">
                Holidays ({holidays.length})
              </h3>

              {holidays.length === 0 ? (
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-8 text-center">
                  <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500">No holidays added yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {holidays.map((holiday) => (
                    <div
                      key={holiday.id}
                      className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">
                          {holiday.description}
                        </p>
                        <p className="text-sm text-slate-500">
                          {parseLocalDate(holiday.holidayDate).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteHoliday(holiday.id)}
                        disabled={saving === `holiday-${holiday.id}`}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                      >
                        {saving === `holiday-${holiday.id}` ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
