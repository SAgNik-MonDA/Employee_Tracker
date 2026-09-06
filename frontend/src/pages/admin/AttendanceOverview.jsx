import { useState, useEffect, useMemo } from 'react';
import API from '../../api/axios';
import toast from 'react-hot-toast';

const AttendanceOverview = () => {
  const [attendance, setAttendance]   = useState([]);
  const [summary, setSummary]         = useState({ totalPresent: 0, totalAbsent: 0, totalOffline: 0, totalOnLeave: 0 });
  const [loading, setLoading]         = useState(true);
  const [selectedDate, setSelectedDate]   = useState(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode]           = useState('date');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear]   = useState(new Date().getFullYear());

  useEffect(() => {
    fetchAttendance();
  }, [selectedDate, selectedMonth, selectedYear, viewMode]);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      let url;
      if (viewMode === 'date') {
        url = `/attendance/all-enriched?date=${selectedDate}`;
      } else {
        url = `/attendance/all-enriched?month=${selectedMonth}&year=${selectedYear}`;
      }
      const { data } = await API.get(url);
      setAttendance(data.records || []);
      setSummary(data.summary   || { totalPresent: 0, totalAbsent: 0, totalOffline: 0, totalOnLeave: 0 });
    } catch (error) {
      toast.error('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  // ── Compute per-employee running counters from fetched records ────────────
  // Records are sorted date DESC from backend; we process them date ASC per employee
  // so the counter increments chronologically.
  const enrichedWithCounters = useMemo(() => {
    const sorted = [...attendance].sort((a, b) => a.date.localeCompare(b.date));
    const counters = {};
    const result = sorted.map((rec) => {
      const empId = rec.employeeId?._id?.toString() || 'unknown';
      if (!counters[empId]) counters[empId] = { present: 0, absent: 0, offline: 0, leave: 0 };
      if (rec.attendanceStatus === 'Present' || rec.attendanceStatus === 'Late') counters[empId].present++;
      if (rec.attendanceStatus === 'Absent')  counters[empId].absent++;
      if (rec.checkOut)                       counters[empId].offline++;
      if (rec.leaveOnDate?.active)            counters[empId].leave++;
      return { ...rec, _counters: { ...counters[empId] } };
    });
    return result.sort((a, b) => b.date.localeCompare(a.date));
  }, [attendance]);

  const getStatusBadge = (status) => {
    const classes = { Present: 'badge-present', Late: 'badge-late', Absent: 'badge-absent' };
    return <span className={classes[status] || 'badge'}>{status}</span>;
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

  const getAttendanceBadge = (attendanceStatus) => {
    if (attendanceStatus === 'Present' || attendanceStatus === 'Late') {
      return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Present</span>;
    }
    if (attendanceStatus === 'Holiday') {
      return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">🎉 Holiday</span>;
    }
    return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">Absent</span>;
  };

  const CounterCell = ({ value, color }) => (
    <td className="text-center">
      <span className={`font-bold text-sm ${color}`}>{value}</span>
    </td>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-surface-100">Attendance Overview</h1>
        <p className="text-surface-500 mt-1">Monitor employee attendance across the organization</p>
      </div>

      <div className="glass-card p-6">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="flex rounded-xl overflow-hidden border border-surface-600/50">
            <button
              onClick={() => setViewMode('date')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${viewMode === 'date' ? 'bg-primary-500 text-white' : 'bg-surface-800 text-surface-400 hover:text-surface-200'}`}
            >
              By Date
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${viewMode === 'month' ? 'bg-primary-500 text-white' : 'bg-surface-800 text-surface-400 hover:text-surface-200'}`}
            >
              By Month
            </button>
          </div>

          {viewMode === 'date' ? (
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="input-field w-auto"
            />
          ) : (
            <>
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="select-field w-auto">
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(2026, i).toLocaleString('en', { month: 'long' })}
                  </option>
                ))}
              </select>
              <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="select-field w-auto">
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </>
          )}
        </div>

        {/* Summary badges */}
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
            <span className="text-violet-400 font-bold text-lg">{summary.totalOnLeave}</span>
            <span className="text-sm text-violet-400/80">On Leave</span>
          </div>
        </div>

        {/* Table */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Dept</th>
                <th>Team ID</th>
                <th>Project Name</th>
                <th>Date</th>
                <th>Attendance</th>
                <th>Online / Offline</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Late (m)</th>
                <th>Early Out (m)</th>
                <th>Status</th>
                <th>Leave Status</th>
                <th className="text-center">No. of Present</th>
                <th className="text-center">No. of Absent</th>
                <th className="text-center">No. of Offline</th>
                <th className="text-center">No. of Leave</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={17} className="text-center py-8 text-surface-500">Loading...</td></tr>
              ) : enrichedWithCounters.length === 0 ? (
                <tr><td colSpan={17} className="text-center py-8 text-surface-500">No attendance records found</td></tr>
              ) : (
                enrichedWithCounters.map((a) => (
                  <tr key={a._id}>
                    {/* Employee */}
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {a.employeeId?.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-surface-200 truncate">{a.employeeId?.name || 'Unknown'}</span>
                          {a.employeeId?.employeeCode && (
                            <span className="text-[10px] font-mono text-primary-400">{a.employeeId.employeeCode}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="text-surface-400">{a.employeeId?.department || '—'}</td>
                    <td>
                      <span className="font-mono text-xs bg-primary-500/10 text-primary-400 px-2 py-1 rounded border border-primary-500/20">
                        {a.teamId}
                      </span>
                    </td>
                    <td className="text-surface-300 max-w-[130px] truncate" title={a.projectName}>{a.projectName}</td>
                    <td className="font-medium text-surface-200">{a.date}</td>
                    <td>{getAttendanceBadge(a.attendanceStatus)}</td>
                    <td>{getOnlineBadge(a.onlineStatus)}</td>
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
                    {/* Per-employee running counters */}
                    <CounterCell value={a._counters.present} color="text-emerald-400" />
                    <CounterCell value={a._counters.absent}  color="text-rose-400" />
                    <CounterCell value={a._counters.offline} color="text-surface-300" />
                    <CounterCell value={a._counters.leave}   color="text-violet-400" />
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AttendanceOverview;
