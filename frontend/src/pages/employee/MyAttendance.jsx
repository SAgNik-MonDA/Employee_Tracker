import { useState, useEffect } from 'react';
import API from '../../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import AttendanceCameraModal from '../../components/common/AttendanceCameraModal';

const MyAttendance = () => {
  const { user } = useAuth();
  const { notifications } = useNotifications();
  const [attendance, setAttendance]     = useState([]);
  const [summary, setSummary]           = useState({ totalPresent: 0, totalAbsent: 0, totalOffline: 0, totalLeaves: 0 });
  const [todayStatus, setTodayStatus]   = useState(null);
  const [loading, setLoading]           = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear]   = useState(new Date().getFullYear());

  // Camera Modal State
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [actionType, setActionType] = useState('check-in'); // 'check-in' or 'check-out'

  // Early Checkout Modal State
  const [earlyCheckoutModalOpen, setEarlyCheckoutModalOpen] = useState(false);
  const [earlyCheckoutReason, setEarlyCheckoutReason] = useState('');
  const [submittingEarlyCheckout, setSubmittingEarlyCheckout] = useState(false);

  useEffect(() => {
    fetchAttendance();
  }, [selectedMonth, selectedYear]);

  // Re-fetch when a new notification arrives
  useEffect(() => {
    if (notifications.length > 0) {
      fetchAttendance();
    }
  }, [notifications.length]);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const localDate = new Date().toLocaleDateString('en-CA');
      const [historyRes, todayRes] = await Promise.all([
        API.get(`/attendance/my-history-enriched?month=${selectedMonth}&year=${selectedYear}`),
        API.get(`/attendance/today?clientDate=${localDate}`)
      ]);
      setAttendance(historyRes.data.records || []);
      setSummary(historyRes.data.summary || { totalPresent: 0, totalAbsent: 0, totalOffline: 0, totalLeaves: 0 });
      setTodayStatus(todayRes.data);
    } catch (error) {
      toast.error('Failed to load attendance');
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayStatus = async () => {
    try {
      const { data } = await API.get('/attendance/today');
      setTodayStatus(data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleCheckIn = () => {
    setActionType('check-in');
    setCameraModalOpen(true);
  };

  const handleCheckOut = () => {
    setActionType('check-out');
    setCameraModalOpen(true);
  };

  const requestEarlyCheckout = async (e) => {
    e.preventDefault();
    if (!earlyCheckoutReason) {
      toast.error('Please provide a reason');
      return;
    }
    setSubmittingEarlyCheckout(true);
    try {
      await API.post('/attendance/early-checkout', { reason: earlyCheckoutReason });
      toast.success('Early check-out request sent to Team Lead');
      setEarlyCheckoutModalOpen(false);
      setEarlyCheckoutReason('');
      fetchTodayStatus();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to request early check-out');
    } finally {
      setSubmittingEarlyCheckout(true);
    }
  };

  const getStatusBadge = (status) => {
    const classes = {
      Present: 'badge-present',
      Late:    'badge-late',
      Absent:  'badge-absent',
    };
    return <span className={classes[status] || 'badge'}>{status}</span>;
  };

  const getAttendanceBadge = (attendanceStatus) => {
    if (attendanceStatus === 'Present' || attendanceStatus === 'Late') {
      return (
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">P</span>
      );
    }
    if (attendanceStatus === 'Holiday') {
      return (
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-black bg-amber-500/20 text-amber-400 border border-amber-500/40">H</span>
      );
    }
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-black bg-rose-500/20 text-rose-400 border border-rose-500/40">A</span>
    );
  };

  const getOnlineBadge = (onlineStatus) => {
    if (onlineStatus === 'Online') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Online
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-surface-700/60 text-surface-400 border border-surface-600/40">
        <span className="w-1.5 h-1.5 rounded-full bg-surface-500" />
        Offline
      </span>
    );
  };

  const getLeaveBadge = (leaveOnDate) => {
    if (!leaveOnDate?.active) return <span className="text-surface-600 text-xs">—</span>;
    const start = new Date(leaveOnDate.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    const end   = new Date(leaveOnDate.endDate).toLocaleDateString('en-IN',   { day: '2-digit', month: 'short', year: 'numeric' });
    return (
      <div className="flex flex-col gap-0.5">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-500/15 text-violet-300 border border-violet-500/30 w-fit">
          🏖 Leave ({leaveOnDate.leaveType})
        </span>
        <span className="text-[10px] text-surface-500">{start} → {end}</span>
      </div>
    );
  };

  const checkIsHolidayToday = () => {
    if (todayStatus?.isHoliday !== undefined && todayStatus.isHoliday) {
      return true;
    }
    if (!user || !Array.isArray(user.weeklyHolidays) || user.weeklyHolidays.length === 0) return false;
    const todayDay = new Date().getDay();
    if (!user.weeklyHolidays.includes(todayDay)) return false;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (user.holidayStartDate) {
      const start = new Date(user.holidayStartDate);
      const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      if (today < startDateOnly) return false;
    }
    if (user.holidayValidUntil) {
      const until = new Date(user.holidayValidUntil);
      const untilDateOnly = new Date(until.getFullYear(), until.getMonth(), until.getDate(), 23, 59, 59, 999);
      if (today > untilDateOnly) return false;
    }
    return true;
  };

  const isTodayHoliday = checkIsHolidayToday();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-surface-100">My Attendance</h1>
        <p className="text-surface-500 mt-1">Track your daily attendance records</p>
      </div>

      {/* Holiday Banner */}
      {isTodayHoliday && (
        <div className="glass-card bg-gradient-to-r from-amber-500/15 via-purple-500/15 to-indigo-500/15 border border-amber-500/30 p-4 flex items-center justify-between text-amber-300 shadow-xl backdrop-blur-md animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎉</span>
            <div>
              <p className="font-bold text-amber-200 text-base">Today is your Weekly Holiday!</p>
              <p className="text-xs text-amber-300/80">Attendance check-in & check-out actions are disabled for today. Enjoy your time off!</p>
            </div>
          </div>
          <span className="text-xs font-semibold px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full border border-amber-500/30">
            Holiday Off Day
          </span>
        </div>
      )}

      {/* Check In/Out Card */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">Today's Status</h2>
        
        {(!user?.faceDescriptor || user.faceDescriptor.length === 0) && !isTodayHoliday && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-2">
            ⚠️ <span>You must set up Face Authentication in your Profile before you can check in or out.</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4">
          {!todayStatus?.checkIn ? (
            <button
              onClick={handleCheckIn}
              disabled={isTodayHoliday || !user?.faceDescriptor || user.faceDescriptor.length === 0}
              className={`btn-success ${
                isTodayHoliday
                  ? 'opacity-50 cursor-not-allowed bg-surface-800 text-surface-500 border-surface-700/50 shadow-none hover:bg-surface-800'
                  : ''
              }`}
              title={isTodayHoliday ? 'Check-in disabled on weekly holidays' : ''}
            >
              🕐 Face Check In
            </button>
          ) : !todayStatus?.checkOut ? (
            <div className="flex items-center gap-3">
              <button
                onClick={handleCheckOut}
                disabled={isTodayHoliday || !user?.faceDescriptor || user.faceDescriptor.length === 0}
                className={`btn-danger ${
                  isTodayHoliday
                    ? 'opacity-50 cursor-not-allowed bg-surface-800 text-surface-500 border-surface-700/50 shadow-none hover:bg-surface-800'
                    : ''
                }`}
                title={isTodayHoliday ? 'Check-out disabled on weekly holidays' : ''}
              >
                🚪 Face Check Out
              </button>
              {todayStatus?.earlyCheckoutStatus === 'None' && !isTodayHoliday && (
                <button onClick={() => setEarlyCheckoutModalOpen(true)} className="px-3 py-1.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-semibold hover:bg-amber-500/20 transition-colors">
                  Request Early Check-out
                </button>
              )}
              {todayStatus?.earlyCheckoutStatus && todayStatus.earlyCheckoutStatus !== 'None' && (
                <span className={`text-xs font-bold px-2 py-1 rounded ${todayStatus.earlyCheckoutStatus === 'Approved' ? 'bg-emerald-500/15 text-emerald-400' : todayStatus.earlyCheckoutStatus === 'Rejected' ? 'bg-rose-500/15 text-rose-400' : 'bg-amber-500/15 text-amber-400'}`}>
                  Early Check-out: {todayStatus.earlyCheckoutStatus.replace('_', ' ')}
                </span>
              )}
            </div>
          ) : (
            <span className="text-emerald-400 font-medium">✅ Attendance completed for today</span>
          )}
          {todayStatus?.checkIn && (
            <span className="text-sm text-surface-400">
              In: <strong className="text-surface-200">{new Date(todayStatus.checkIn).toLocaleTimeString()}</strong>
              {todayStatus.checkOut && (
                <> | Out: <strong className="text-surface-200">{new Date(todayStatus.checkOut).toLocaleTimeString()}</strong></>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Filters + Table */}
      <div className="glass-card p-6">
        {/* Month/Year selectors */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="select-field w-auto"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(2026, i).toLocaleString('en', { month: 'long' })}
              </option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="select-field w-auto"
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Summary counters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <span className="text-emerald-400 font-bold text-lg">{summary.totalPresent}</span>
            <span className="text-sm text-emerald-400/80">Present</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30">
            <span className="text-rose-400 font-bold text-lg">{summary.totalAbsent}</span>
            <span className="text-sm text-rose-400/80">Absent</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-700/50 border border-surface-600/40">
            <span className="text-surface-300 font-bold text-lg">{summary.totalOffline}</span>
            <span className="text-sm text-surface-400">No. of Offline</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/10 border border-violet-500/30">
            <span className="text-violet-400 font-bold text-lg">{summary.totalLeaves}</span>
            <span className="text-sm text-violet-400/80">Approved Leaves</span>
          </div>
        </div>

        {/* Table */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Team ID</th>
                <th>Project Name</th>
                <th>Attendance</th>
                <th>Online / Offline</th>
                <th>Shift</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Late (m)</th>
                <th>Early Out (m)</th>
                <th>Status</th>
                <th>Leave Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="text-center py-8 text-surface-500">Loading...</td></tr>
              ) : attendance.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-8 text-surface-500">No records found</td></tr>
              ) : (
                attendance.map((a) => (
                  <tr key={a._id}>
                    <td className="font-medium text-surface-200">{a.date}</td>
                    <td>
                      <span className="font-mono text-xs bg-primary-500/10 text-primary-400 px-2 py-1 rounded border border-primary-500/20">
                        {a.teamId}
                      </span>
                    </td>
                    <td className="text-surface-300 max-w-[140px] truncate" title={a.projectName}>{a.projectName}</td>
                    <td>{getAttendanceBadge(a.attendanceStatus)}</td>
                    <td>{getOnlineBadge(a.onlineStatus)}</td>
                    <td className="text-xs text-surface-400 font-medium">{a.shiftAssigned || 'General'}</td>
                    <td>{a.checkIn  ? new Date(a.checkIn).toLocaleTimeString()  : '—'}</td>
                    <td>{a.checkOut ? new Date(a.checkOut).toLocaleTimeString() : '—'}</td>
                    <td>
                      {a.lateDuration > 0 ? (
                        <span className="text-rose-400 font-semibold">{a.lateDuration}</span>
                      ) : (
                        <span className="text-surface-500">—</span>
                      )}
                    </td>
                    <td>
                      {a.earlyCheckoutDuration > 0 ? (
                        <span className="text-amber-400 font-semibold">{a.earlyCheckoutDuration}</span>
                      ) : (
                        <span className="text-surface-500">—</span>
                      )}
                    </td>
                    <td>{getStatusBadge(a.status)}</td>
                    <td>{getLeaveBadge(a.leaveOnDate)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AttendanceCameraModal 
        isOpen={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
        actionType={actionType}
        onSuccess={() => {
          fetchAttendance();
          fetchTodayStatus();
        }}
      />

      {/* Early Checkout Modal */}
      {earlyCheckoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-surface-900 border border-surface-700/50 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-surface-700/50 flex justify-between items-center bg-surface-800/30">
              <h3 className="font-display font-semibold text-surface-100">Request Early Check-Out</h3>
              <button onClick={() => setEarlyCheckoutModalOpen(false)} className="p-1 text-surface-400 hover:text-white hover:bg-surface-700 rounded-lg transition-colors">
                ✕
              </button>
            </div>
            <form onSubmit={requestEarlyCheckout} className="p-6">
              <p className="text-sm text-surface-400 mb-4">
                Please provide a valid emergency reason for early check-out. This will be sent to your Team Lead and Project Manager for approval.
              </p>
              <textarea
                value={earlyCheckoutReason}
                onChange={(e) => setEarlyCheckoutReason(e.target.value)}
                className="input-field w-full h-24 resize-none mb-4"
                placeholder="Enter your reason here..."
                required
              />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setEarlyCheckoutModalOpen(false)} className="px-4 py-2 rounded-lg font-medium text-sm text-surface-300 hover:bg-surface-700/50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={submittingEarlyCheckout} className="btn-primary">
                  {submittingEarlyCheckout ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default MyAttendance;
