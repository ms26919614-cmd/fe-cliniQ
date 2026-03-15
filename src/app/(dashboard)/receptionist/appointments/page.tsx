'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CalendarDays, CheckCircle2, Clock, XCircle, Plus, ArrowDown,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import api from '@/lib/api';
import StatCard from '@/components/StatCard';

interface SlotOption {
  id: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  maxPatients: number;
  active: boolean;
  bookedCount: number | null;
}

interface Appointment {
  id: number;
  patientId: number;
  patientName: string;
  phone: string;
  slotId: number;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  tokenNumber: number | null;
  status: string;
  notes: string | null;
  cancelledAt: string | null;
}

interface Holiday {
  id: number;
  holidayDate: string;
  description: string;
}

interface DaySchedule {
  dayOfWeek: string;
  workingDay: boolean;
}

interface DayOverride {
  id: number;
  overrideDate: string;
  workingDay: boolean;
  startTime: string | null;
  endTime: string | null;
  reason: string;
}

export default function AppointmentBookingPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [availableSlots, setAvailableSlots] = useState<SlotOption[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [daySchedules, setDaySchedules] = useState<DaySchedule[]>([]);
  const [dayOverrides, setDayOverrides] = useState<DayOverride[]>([]);

  // Booking form
  const [patientName, setPatientName] = useState('');
  const [phone, setPhone] = useState('');
  const [appointmentDate, setAppointmentDate] = useState(todayStr());
  const [notes, setNotes] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [booking, setBooking] = useState(false);
  const [bookSuccess, setBookSuccess] = useState<{ name: string; date: string; time: string; token: number } | null>(null);
  const [bookError, setBookError] = useState('');

  // Mini calendar state
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());

  // Reschedule modal
  const [rescheduleAppt, setRescheduleAppt] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState<SlotOption[]>([]);
  const [rescheduleSlotId, setRescheduleSlotId] = useState<number | null>(null);
  const [rescheduling, setRescheduling] = useState(false);

  // Cancel modal
  const [cancelAppt, setCancelAppt] = useState<Appointment | null>(null);
  const [cancelling, setCancelling] = useState(false);

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
  function todayStr() {
    return formatLocalDate(new Date());
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  // Day-of-week mapping (JS getDay() 0=Sun → DayOfWeekEnum)
  const DOW_MAP = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

  // --- Fetch ---
  const fetchAppointments = useCallback(async () => {
    try {
      const res = await api.get(`/api/appointments/date/${todayStr()}`);
      setAppointments(res.data);
    } catch { /* empty */ }
  }, []);

  const fetchAvailableSlots = useCallback(async (date: string) => {
    try {
      const res = await api.get(`/api/appointment-slots/available?date=${date}`);
      setAvailableSlots(res.data);
    } catch {
      setAvailableSlots([]);
    }
  }, []);

  const fetchHolidays = useCallback(async () => {
    try {
      const res = await api.get('/api/holidays', { _skipAuthRedirect: true } as any);
      setHolidays(res.data);
    } catch { /* optional — calendar still works without holidays */ }
  }, []);

  const fetchDaySchedules = useCallback(async () => {
    try {
      const res = await api.get('/api/day-schedules', { _skipAuthRedirect: true } as any);
      setDaySchedules(res.data);
    } catch { /* optional — calendar still works without day schedules */ }
  }, []);

  const fetchDayOverrides = useCallback(async () => {
    try {
      const res = await api.get('/api/day-overrides', { _skipAuthRedirect: true } as any);
      setDayOverrides(res.data);
    } catch { /* optional */ }
  }, []);

  useEffect(() => {
    fetchAppointments();
    fetchHolidays();
    fetchDaySchedules();
    fetchDayOverrides();
  }, [fetchAppointments, fetchHolidays, fetchDaySchedules, fetchDayOverrides]);

  useEffect(() => {
    if (appointmentDate) {
      fetchAvailableSlots(appointmentDate);
      setSelectedSlotId(null);
    }
  }, [appointmentDate, fetchAvailableSlots]);

  // --- Mini Calendar helpers ---
  const holidaySet = new Set(holidays.map((h) => h.holidayDate));
  const overrideMap = new Map(dayOverrides.map((o) => [o.overrideDate, o]));
  const nonWorkingDays = new Set(
    daySchedules.filter((d) => !d.workingDay).map((d) => d.dayOfWeek)
  );

  const isHoliday = (dateStr: string) => holidaySet.has(dateStr);
  const isNonWorking = (date: Date, dateStr?: string) => {
    // Check override first
    const ds = dateStr || formatLocalDate(date);
    const override = overrideMap.get(ds);
    if (override) return !override.workingDay;
    return nonWorkingDays.has(DOW_MAP[date.getDay()]);
  };
  const hasOverride = (dateStr: string) => overrideMap.has(dateStr);
  const isPast = (dateStr: string) => dateStr < todayStr();

  const getCalendarDays = () => {
    const firstDay = new Date(calYear, calMonth, 1);
    const lastDay = new Date(calYear, calMonth + 1, 0);
    const startOffset = firstDay.getDay(); // 0=Sunday
    const days: { date: Date; dateStr: string; inMonth: boolean }[] = [];

    // Fill leading blanks
    for (let i = 0; i < startOffset; i++) {
      const d = new Date(calYear, calMonth, -startOffset + i + 1);
      days.push({ date: d, dateStr: formatLocalDate(d), inMonth: false });
    }
    // Fill month days
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dt = new Date(calYear, calMonth, d);
      days.push({ date: dt, dateStr: formatLocalDate(dt), inMonth: true });
    }
    // Fill trailing to complete 6 rows
    while (days.length < 42) {
      const d = new Date(calYear, calMonth + 1, days.length - startOffset - lastDay.getDate() + 1);
      days.push({ date: d, dateStr: formatLocalDate(d), inMonth: false });
    }
    return days;
  };

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); }
    else setCalMonth(calMonth - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); }
    else setCalMonth(calMonth + 1);
  };
  const monthLabel = new Date(calYear, calMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // --- Stats ---
  const stats = {
    booked: appointments.filter((a) => a.status === 'BOOKED').length,
    checkedIn: appointments.filter((a) => a.status === 'CHECKED_IN').length,
    completed: appointments.filter((a) => a.status === 'COMPLETED').length,
    cancelled: appointments.filter((a) => a.status === 'CANCELLED').length,
  };

  // --- Book ---
  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim() || !phone.trim() || !selectedSlotId || !appointmentDate) {
      setBookError('Please fill all fields and select a time slot');
      return;
    }
    setBooking(true);
    setBookError('');
    setBookSuccess(null);
    try {
      const res = await api.post('/api/appointments', {
        patientName: patientName.trim(),
        phone: phone.trim(),
        slotId: selectedSlotId,
        appointmentDate,
        notes: notes.trim() || null,
      });
      const slot = availableSlots.find((s) => s.id === selectedSlotId);
      setBookSuccess({
        name: res.data.patientName,
        date: res.data.appointmentDate,
        time: `${res.data.startTime} – ${res.data.endTime}`,
        token: res.data.tokenNumber,
      });
      setPatientName('');
      setPhone('');
      setNotes('');
      setSelectedSlotId(null);
      fetchAppointments();
      fetchAvailableSlots(appointmentDate);
    } catch (err: any) {
      setBookError(err.response?.data?.message || err.response?.data?.error || 'Booking failed');
    } finally {
      setBooking(false);
    }
  };

  // --- Reschedule ---
  const openReschedule = (appt: Appointment) => {
    setRescheduleAppt(appt);
    setRescheduleDate('');
    setRescheduleSlots([]);
    setRescheduleSlotId(null);
  };

  const fetchRescheduleSlots = async (date: string) => {
    setRescheduleDate(date);
    setRescheduleSlotId(null);
    try {
      const res = await api.get(`/api/appointment-slots/available?date=${date}`);
      setRescheduleSlots(res.data);
    } catch {
      setRescheduleSlots([]);
    }
  };

  const confirmReschedule = async () => {
    if (!rescheduleAppt || !rescheduleSlotId || !rescheduleDate) return;
    setRescheduling(true);
    try {
      await api.patch(`/api/appointments/${rescheduleAppt.id}/reschedule`, {
        newSlotId: rescheduleSlotId,
        newAppointmentDate: rescheduleDate,
      });
      setRescheduleAppt(null);
      fetchAppointments();
    } catch { /* error */ }
    finally { setRescheduling(false); }
  };

  // --- Cancel ---
  const confirmCancel = async () => {
    if (!cancelAppt) return;
    setCancelling(true);
    try {
      await api.patch(`/api/appointments/${cancelAppt.id}/cancel`);
      setCancelAppt(null);
      fetchAppointments();
    } catch { /* error */ }
    finally { setCancelling(false); }
  };

  // --- Check In ---
  const [checkingIn, setCheckingIn] = useState<number | null>(null);
  const handleCheckIn = async (appt: Appointment) => {
    setCheckingIn(appt.id);
    try {
      await api.patch(`/api/appointments/${appt.id}/status`, { status: 'CHECKED_IN' });
      fetchAppointments();
    } catch (err: any) {
      alert(err.response?.data?.message || err.response?.data?.error || 'Check-in failed');
    } finally {
      setCheckingIn(null);
    }
  };

  // --- Status badge ---
  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      BOOKED: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Booked' },
      CHECKED_IN: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Checked In' },
      COMPLETED: { bg: 'bg-green-100', text: 'text-green-800', label: 'Completed' },
      CANCELLED: { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelled' },
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
        <h2 className="text-2xl font-bold text-slate-900">Appointment Booking</h2>
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <CalendarDays className="w-4 h-4" />
          {today}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-7">
        <StatCard label="Today's Bookings" value={appointments.length} sub="Appointments total" icon={CalendarDays} color="cyan" />
        <StatCard label="Checked In" value={stats.checkedIn} sub="Arrived today" icon={CheckCircle2} color="green" />
        <StatCard label="Upcoming" value={stats.booked} sub="Still to arrive" icon={Clock} color="amber" />
        <StatCard label="Cancelled" value={stats.cancelled} sub="Today" icon={XCircle} color="red" />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-2 gap-5">
        {/* Booking Form */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Plus className="w-5 h-5 text-cyan-700" />
            <h3 className="text-base font-bold text-slate-900">Book New Appointment</h3>
          </div>
          <div className="p-5">
            <form onSubmit={handleBook}>
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Patient Name</label>
                  <input type="text" placeholder="Enter patient name" value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-900 focus:outline-none focus:border-cyan-700 focus:bg-white focus:ring-2 focus:ring-cyan-700/10 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Phone Number</label>
                  <input type="text" placeholder="Enter phone" value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-900 focus:outline-none focus:border-cyan-700 focus:bg-white focus:ring-2 focus:ring-cyan-700/10 transition-all" />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Notes (Optional)</label>
                <input type="text" placeholder="e.g. Follow-up visit" value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-900 focus:outline-none focus:border-cyan-700 focus:bg-white focus:ring-2 focus:ring-cyan-700/10 transition-all" />
              </div>

              {/* Mini Calendar Date Picker */}
              <div className="mt-4">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Select Appointment Date</label>
                <div className="border-[1.5px] border-slate-200 rounded-xl overflow-hidden bg-white">
                  {/* Calendar Header */}
                  <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50 border-b border-slate-100">
                    <button type="button" onClick={prevMonth} className="p-1 hover:bg-slate-200 rounded-lg transition-colors">
                      <ChevronLeft className="w-4 h-4 text-slate-600" />
                    </button>
                    <span className="text-sm font-semibold text-slate-900">{monthLabel}</span>
                    <button type="button" onClick={nextMonth} className="p-1 hover:bg-slate-200 rounded-lg transition-colors">
                      <ChevronRight className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>
                  {/* Day Headers */}
                  <div className="grid grid-cols-7 text-center border-b border-slate-100">
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                      <div key={d} className="py-1.5 text-[10px] font-semibold text-slate-400 uppercase">{d}</div>
                    ))}
                  </div>
                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 p-1.5 gap-0.5">
                    {getCalendarDays().map(({ date, dateStr, inMonth }, idx) => {
                      const past = isPast(dateStr);
                      const holiday = isHoliday(dateStr);
                      const nonWorking = isNonWorking(date, dateStr);
                      const overridden = hasOverride(dateStr);
                      const disabled = !inMonth || past || holiday || nonWorking;
                      const selected = dateStr === appointmentDate;
                      const isToday = dateStr === todayStr();

                      return (
                        <button key={idx} type="button"
                          onClick={() => !disabled && setAppointmentDate(dateStr)}
                          disabled={disabled}
                          className={`w-full aspect-square rounded-lg text-xs font-medium flex items-center justify-center transition-all
                            ${!inMonth ? 'text-slate-200' :
                              selected ? 'bg-cyan-700 text-white font-bold' :
                              holiday ? 'bg-red-50 text-red-400 cursor-not-allowed' :
                              nonWorking ? 'bg-slate-50 text-slate-300 cursor-not-allowed' :
                              past ? 'text-slate-300 cursor-not-allowed' :
                              isToday ? 'bg-cyan-50 text-cyan-700 font-bold hover:bg-cyan-100' :
                              'text-slate-700 hover:bg-cyan-50'
                            }`}
                          title={holiday ? holidays.find((h) => h.holidayDate === dateStr)?.description || 'Holiday' :
                                 overridden ? `Override: ${overrideMap.get(dateStr)?.reason || (overrideMap.get(dateStr)?.workingDay ? 'Working day' : 'Non-working')}` :
                                 nonWorking ? 'Non-working day' : ''}
                        >
                          {date.getDate()}
                        </button>
                      );
                    })}
                  </div>
                  {/* Legend */}
                  <div className="flex items-center justify-center gap-4 py-2 border-t border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-cyan-700" /><span className="text-[10px] text-slate-500">Selected</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-300" /><span className="text-[10px] text-slate-500">Holiday</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-slate-300" /><span className="text-[10px] text-slate-500">Non-working</span></div>
                  </div>
                </div>
                {appointmentDate && (
                  <p className="text-xs text-cyan-700 font-semibold mt-1.5">
                    Selected: {new Date(appointmentDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>

              {/* Slot Picker */}
              <div className="mt-4">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Select Time Slot</label>
                {availableSlots.length === 0 ? (
                  <p className="text-sm text-slate-400 py-4 text-center">
                    {isHoliday(appointmentDate)
                      ? `Holiday: ${holidays.find((h) => h.holidayDate === appointmentDate)?.description || 'Clinic closed'}`
                      : isNonWorking(parseLocalDate(appointmentDate), appointmentDate)
                        ? `Non-working day${overrideMap.get(appointmentDate)?.reason ? ` — ${overrideMap.get(appointmentDate)?.reason}` : ' — no appointments available'}`
                        : 'No available slots for this date'}
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {availableSlots.map((slot) => {
                      const booked = slot.bookedCount ?? 0;
                      const remaining = slot.maxPatients - booked;
                      const isFull = remaining <= 0;
                      const isSelected = selectedSlotId === slot.id;
                      const hasBookings = booked > 0 && !isFull;

                      return (
                        <button key={slot.id} type="button"
                          onClick={() => !isFull && setSelectedSlotId(slot.id)}
                          disabled={isFull}
                          className={`py-2.5 px-2 rounded-xl text-center border-[1.5px] transition-all
                            ${isFull
                              ? 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-200'
                              : isSelected
                                ? 'bg-cyan-700 border-cyan-700 text-white'
                                : hasBookings
                                  ? 'bg-amber-50 border-amber-300 hover:border-amber-400'
                                  : 'bg-white border-slate-200 hover:border-cyan-300 hover:bg-cyan-50'
                            }`}>
                          <div className={`text-sm font-bold
                            ${isFull ? 'text-slate-400' : isSelected ? 'text-white' : 'text-slate-900'}`}>
                            {slot.startTime}
                          </div>
                          <div className={`text-[10px] mt-0.5
                            ${isFull
                              ? 'text-red-500 font-semibold'
                              : isSelected
                                ? 'text-white/70'
                                : hasBookings
                                  ? 'text-amber-600 font-semibold'
                                  : 'text-slate-400'
                            }`}>
                            {isFull ? 'Full' : `${remaining} of ${slot.maxPatients} left`}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <button type="submit" disabled={booking}
                className="w-full mt-5 py-3 rounded-xl text-white text-sm font-semibold shadow-lg shadow-cyan-700/25 disabled:opacity-60 transition-all"
                style={{ background: 'linear-gradient(135deg, #0e7490, #14b8a6)' }}>
                {booking ? 'Booking...' : 'Book Appointment'}
              </button>
            </form>

            {bookError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{bookError}</div>
            )}

            {bookSuccess && (
              <div className="mt-4 p-3.5 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-green-800">Appointment booked successfully!</p>
                  <p className="text-xs text-green-600">
                    {bookSuccess.name} &bull; {bookSuccess.date} &bull; {bookSuccess.time}
                    {bookSuccess.token ? ` \u2022 Token #${bookSuccess.token}` : ''}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Today's Appointments */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-cyan-700" />
              <h3 className="text-base font-bold text-slate-900">Today&apos;s Appointments</h3>
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-cyan-50 text-cyan-700">
              {appointments.length} Booked
            </span>
          </div>
          <div className="overflow-auto max-h-[520px]">
            <table className="w-full">
              <thead className="sticky top-0 bg-white">
                <tr>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 border-b-2 border-slate-100">Time</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 border-b-2 border-slate-100">Patient</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 border-b-2 border-slate-100">Status</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 border-b-2 border-slate-100">Actions</th>
                </tr>
              </thead>
              <tbody>
                {appointments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-sm text-slate-400">No appointments today</td>
                  </tr>
                ) : (
                  appointments.map((appt) => (
                    <tr key={appt.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 text-xs font-semibold text-slate-900">
                        {appt.startTime} – {appt.endTime}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-semibold text-slate-700">{appt.patientName}</div>
                        <div className="text-[11px] text-slate-400">{appt.phone}</div>
                      </td>
                      <td className="px-4 py-3">{statusBadge(appt.status)}</td>
                      <td className="px-4 py-3">
                        {appt.status === 'BOOKED' ? (
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleCheckIn(appt)}
                              disabled={checkingIn === appt.id}
                              className="px-2.5 py-1 text-[11px] font-semibold text-white rounded-lg transition-all disabled:opacity-50"
                              style={{ background: 'linear-gradient(135deg, #0e7490, #14b8a6)' }}>
                              {checkingIn === appt.id ? 'Checking In...' : 'Check In'}
                            </button>
                            <button onClick={() => openReschedule(appt)}
                              className="text-cyan-700 text-xs font-semibold hover:underline">Reschedule</button>
                            <button onClick={() => setCancelAppt(appt)}
                              className="text-red-600 text-xs font-semibold hover:underline">Cancel</button>
                          </div>
                        ) : appt.status === 'CHECKED_IN' ? (
                          <span className="text-xs text-amber-600 font-semibold">Token #{appt.tokenNumber}</span>
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

      {/* Reschedule Modal */}
      {rescheduleAppt && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl w-[520px] shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">Reschedule Appointment</h3>
              <button onClick={() => setRescheduleAppt(null)}
                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 text-lg font-bold hover:bg-slate-200">
                &times;
              </button>
            </div>
            <div className="p-6">
              {/* Current info */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Current Appointment</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[11px] text-slate-500 font-semibold">Patient</div>
                    <div className="text-sm font-semibold text-slate-900">{rescheduleAppt.patientName}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500 font-semibold">Phone</div>
                    <div className="text-sm font-semibold text-slate-900">{rescheduleAppt.phone}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500 font-semibold">Date</div>
                    <div className="text-sm font-semibold text-slate-900">{rescheduleAppt.appointmentDate}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500 font-semibold">Time</div>
                    <div className="text-sm font-semibold text-slate-900">{rescheduleAppt.startTime} – {rescheduleAppt.endTime}</div>
                  </div>
                </div>
              </div>

              <div className="text-center my-4">
                <ArrowDown className="w-5 h-5 text-cyan-700 mx-auto" />
              </div>

              {/* New date & slot */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">New Appointment Date</label>
                <input type="date" value={rescheduleDate}
                  onChange={(e) => fetchRescheduleSlots(e.target.value)}
                  min={todayStr()}
                  className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-900 focus:outline-none focus:border-cyan-700 focus:bg-white focus:ring-2 focus:ring-cyan-700/10" />
              </div>

              {rescheduleDate && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Select New Time Slot</label>
                  {rescheduleSlots.length === 0 ? (
                    <p className="text-sm text-slate-400 py-4 text-center">No available slots for this date</p>
                  ) : (
                    <div className="grid grid-cols-4 gap-2">
                      {rescheduleSlots.map((slot) => {
                        const booked = slot.bookedCount ?? 0;
                        const remaining = slot.maxPatients - booked;
                        const isFull = remaining <= 0;
                        const isSelected = rescheduleSlotId === slot.id;
                        const hasBookings = booked > 0 && !isFull;

                        return (
                          <button key={slot.id} type="button"
                            onClick={() => !isFull && setRescheduleSlotId(slot.id)}
                            disabled={isFull}
                            className={`py-2.5 px-2 rounded-xl text-center border-[1.5px] transition-all
                              ${isFull
                                ? 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-200'
                                : isSelected
                                  ? 'bg-cyan-700 border-cyan-700 text-white'
                                  : hasBookings
                                    ? 'bg-amber-50 border-amber-300 hover:border-amber-400'
                                    : 'bg-white border-slate-200 hover:border-cyan-300 hover:bg-cyan-50'
                              }`}>
                            <div className={`text-sm font-bold
                              ${isFull ? 'text-slate-400' : isSelected ? 'text-white' : 'text-slate-900'}`}>
                              {slot.startTime}
                            </div>
                            <div className={`text-[10px] mt-0.5
                              ${isFull
                                ? 'text-red-500 font-semibold'
                                : isSelected
                                  ? 'text-white/70'
                                  : hasBookings
                                    ? 'text-amber-600 font-semibold'
                                    : 'text-slate-400'
                              }`}>
                              {isFull ? 'Full' : `${remaining} of ${slot.maxPatients} left`}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setRescheduleAppt(null)}
                className="px-5 py-2.5 rounded-xl border-[1.5px] border-slate-200 text-sm font-semibold text-slate-500 bg-white">Cancel</button>
              <button onClick={confirmReschedule}
                disabled={rescheduling || !rescheduleSlotId || !rescheduleDate}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #0e7490, #14b8a6)' }}>
                {rescheduling ? 'Rescheduling...' : 'Confirm Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {cancelAppt && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl w-[420px] shadow-2xl p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-7 h-7 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Cancel Appointment?</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              Are you sure you want to cancel the appointment for{' '}
              <span className="font-semibold text-slate-900">{cancelAppt.patientName}</span> on{' '}
              <span className="font-semibold text-slate-900">{cancelAppt.appointmentDate}</span> at{' '}
              <span className="font-semibold text-slate-900">{cancelAppt.startTime} – {cancelAppt.endTime}</span>?
              <br />This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setCancelAppt(null)}
                className="px-6 py-2.5 rounded-xl border-[1.5px] border-slate-200 text-sm font-semibold text-slate-500 bg-white hover:bg-slate-50">
                Keep Appointment
              </button>
              <button onClick={confirmCancel} disabled={cancelling}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 shadow-md shadow-red-600/25 disabled:opacity-50">
                {cancelling ? 'Cancelling...' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
