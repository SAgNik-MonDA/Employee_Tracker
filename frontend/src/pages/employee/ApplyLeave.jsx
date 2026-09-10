import { useState, useEffect, useMemo } from 'react';
import API from '../../api/axios';
import toast from 'react-hot-toast';
import { useNotifications } from '../../context/NotificationContext';
import {
  HiOutlineCalendar,
  HiOutlineClipboardCheck,
  HiOutlineInformationCircle,
  HiOutlineClock,
  HiOutlineExclamationCircle,
} from 'react-icons/hi';

import { useLocation } from 'react-router-dom';

// ─── Constants ───────────────────────────────────────────────────────────────
const CASUAL_MONTHLY_LIMIT = 2;

// ─── Leave Balance Progress Bar ───────────────────────────────────────────────
const BalanceBar = ({ label, used, total, color }) => {
  const remaining = Math.max(0, total - used);
  const pct = Math.min(100, Math.round((used / total) * 100));
  const barColor =
    pct >= 90 ? 'bg-rose-500' : pct >= 60 ? 'bg-amber-500' : `bg-${color}-500`;

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-surface-200">{label}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
          remaining === 0
            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            : `bg-${color}-500/20 text-${color}-400 border border-${color}-500/30`
        }`}>
          {remaining} left
        </span>
      </div>
      <div className="w-full h-2 bg-surface-700 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-surface-500">
        <span>{used} used</span>
        <span>{total} total</span>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const ApplyLeave = () => {
  const { notifications, socket } = useNotifications();
  const location = useLocation();
  const [leaves, setLeaves]       = useState([]);
  const [balance, setBalance]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData]   = useState({
    leaveType: 'Casual',
    startDate: '',
    endDate: '',
    reason: '',
  });

  useEffect(() => {
    if (location.hash === '#leave-history') {
      const scrollToHistory = () => {
        const element = document.getElementById('leave-history');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      };

      // Try scrolling immediately, and also after a short delay in case of DOM updates
      scrollToHistory();
      setTimeout(scrollToHistory, 100);
      setTimeout(scrollToHistory, 500);
    }
  }, [location.hash, location.key, loading]);

  useEffect(() => {
    fetchAll();
  }, []);

  // Re-fetch when a new notification arrives
  useEffect(() => {
    if (notifications.length > 0) {
      fetchAll();
    }
  }, [notifications.length]);

  // Listen for real-time leave year updates
  useEffect(() => {
    if (!socket) return;
    const handleSettingsUpdated = (data) => {
      if (data.type === 'LEAVE_YEAR_UPDATED') {
        fetchAll(); // Refresh balance dynamically
      }
    };
    socket.on('settings-updated', handleSettingsUpdated);
    return () => socket.off('settings-updated', handleSettingsUpdated);
  }, [socket]);

  const fetchAll = async () => {
    try {
      const [leavesRes, balanceRes] = await Promise.all([
        API.get('/leaves/my-leaves'),
        API.get('/leaves/my-balance'),
      ]);
      setLeaves(leavesRes.data);
      setBalance(balanceRes.data);
    } catch {
      toast.error('Failed to load leave data');
    } finally {
      setLoading(false);
    }
  };

  // ── Computed: days requested ───────────────────────────────────────────────
  const daysRequested = useMemo(() => {
    if (!formData.startDate || !formData.endDate) return 0;
    const start = new Date(formData.startDate);
    const end   = new Date(formData.endDate);
    if (end < start) return 0;
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  }, [formData.startDate, formData.endDate]);

  // ── Computed: simple frontend validation warning ───────────────────────────
  const validationWarning = useMemo(() => {
    if (!balance || daysRequested === 0) return null;
    const type = formData.leaveType;
    const remaining = type === 'Casual' ? balance.casual.remaining : balance.emergency.remaining;
    if (daysRequested > remaining)
      return `Not enough ${type} leave balance. You have ${remaining} day(s) remaining.`;

    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end   = new Date(formData.endDate);
      if (
        start.getMonth() !== end.getMonth() ||
        start.getFullYear() !== end.getFullYear()
      ) {
        return 'Leave dates must be within the same calendar month.';
      }
    }
    return null;
  }, [balance, daysRequested, formData.leaveType, formData.startDate, formData.endDate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.startDate || !formData.endDate) {
      toast.error('Please select start and end dates');
      return;
    }
    if (validationWarning) {
      toast.error(validationWarning);
      return;
    }
    setSubmitting(true);
    try {
      await API.post('/leaves/apply', formData);
      toast.success('Leave request submitted! 📩');
      setFormData({ leaveType: 'Casual', startDate: '', endDate: '', reason: '' });
      fetchAll();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to apply leave');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const cls = {
      Pending:  'badge-pending',
      Approved: 'badge-approved',
      Rejected: 'badge-rejected',
    };
    return <span className={cls[status] || 'badge'}>{status}</span>;
  };

  const getTypeBadge = (type) => {
    const colors = {
      Casual:    'bg-primary-500/20 text-primary-400 border border-primary-500/30',
      Emergency: 'bg-rose-500/20 text-rose-400 border border-rose-500/30',
    };
    return <span className={`badge ${colors[type] || ''}`}>{type}</span>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-surface-100">Apply Leave</h1>
        <p className="text-surface-500 mt-1">Submit a new leave request · Year {balance?.year || new Date().getFullYear()}</p>
      </div>

      {/* ── Leave Balance Cards ─────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="glass-card p-5 animate-pulse">
              <div className="w-32 h-4 bg-surface-700 rounded mb-3" />
              <div className="w-full h-2 bg-surface-700 rounded mb-2" />
              <div className="w-20 h-3 bg-surface-700 rounded" />
            </div>
          ))}
        </div>
      ) : balance ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <BalanceBar
            label="🟢 Casual Leave"
            used={balance.casual.used}
            total={balance.casual.total}
            color="emerald"
          />
          <BalanceBar
            label="🟠 Emergency Leave"
            used={balance.emergency.used}
            total={balance.emergency.total}
            color="amber"
          />
        </div>
      ) : null}

      {/* ── Leave Rules Info ────────────────────────────────────────────── */}
      <div className="glass-card p-4 border border-primary-500/20 bg-primary-500/5">
        <div className="flex gap-3">
          <HiOutlineInformationCircle className="w-5 h-5 text-primary-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-surface-400 space-y-0.5">
            <p>
              <span className="text-primary-400 font-semibold">Casual Leave:</span> Max {balance?.casual?.total || 24} days/year · Max 2 days/month 
              <br/>
              <span className="text-rose-400 font-semibold ml-1">⚠️ Casual leave must be applied at least 3 days in advance.</span>
            </p>
            <p><span className="text-amber-400 font-semibold">Emergency Leave:</span> Max {balance?.emergency?.total || 16} days/year · Distribution: 9 months×1day, 2 months×2days, 1 month max 3days</p>
            <p className="text-surface-500">Leave dates must be within the same calendar month.</p>
          </div>
        </div>
      </div>

      {/* ── Leave Form ──────────────────────────────────────────────────── */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">New Leave Request</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Leave Type */}
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-2">Leave Type</label>
            <select
              value={formData.leaveType}
              onChange={(e) => setFormData({ ...formData, leaveType: e.target.value })}
              className="select-field"
            >
              <option value="Casual">🟢 Casual Leave (Max {balance?.casual?.total || 24}/yr, {CASUAL_MONTHLY_LIMIT}/mo)</option>
              <option value="Emergency">🟠 Emergency Leave (Max {balance?.emergency?.total || 16}/yr)</option>
            </select>
          </div>

          {/* Days info */}
          <div className="flex items-end">
            {daysRequested > 0 ? (
              <div className={`w-full px-4 py-3 rounded-xl text-sm font-medium border ${
                validationWarning
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              }`}>
                {validationWarning ? (
                  <span className="flex items-center gap-2">
                    <HiOutlineExclamationCircle className="w-4 h-4 flex-shrink-0" />
                    {validationWarning}
                  </span>
                ) : (
                  <span>📅 {daysRequested} day{daysRequested > 1 ? 's' : ''} selected</span>
                )}
              </div>
            ) : (
              <div className="w-full px-4 py-3 rounded-xl text-sm text-surface-600 border border-surface-700/50 bg-surface-800/30">
                Select dates to see duration
              </div>
            )}
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-2">Start Date <span className="text-rose-500">*</span></label>
            <input
              type="date"
              required
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="input-field"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-2">End Date <span className="text-rose-500">*</span></label>
            <input
              type="date"
              required
              value={formData.endDate}
              min={formData.startDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              className="input-field"
            />
          </div>

          {/* Reason */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-surface-300 mb-2">Reason <span className="text-rose-500">*</span></label>
            <input
              type="text"
              required
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              className="input-field"
              placeholder="Brief reason for leave (Required)"
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={submitting || !!validationWarning}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : '📩 Submit Leave Request'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Leave History ────────────────────────────────────────────────── */}
      <div id="leave-history" className="glass-card p-6 scroll-mt-20">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">My Leave History</h2>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Days</th>
                <th>Reason</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-surface-500">Loading...</td></tr>
              ) : leaves.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-surface-500">No leave requests yet</td></tr>
              ) : (
                leaves.map((l) => (
                  <tr key={l._id}>
                    <td>{getTypeBadge(l.leaveType)}</td>
                    <td>{new Date(l.startDate).toLocaleDateString()}</td>
                    <td>{new Date(l.endDate).toLocaleDateString()}</td>
                    <td className="font-medium text-surface-200">
                      <span className="flex items-center gap-1">
                        <HiOutlineCalendar className="w-4 h-4 text-surface-500" />
                        {l.days || '—'}d
                      </span>
                    </td>
                    <td className="max-w-[180px] truncate text-surface-400">{l.reason || '—'}</td>
                    <td>{getStatusBadge(l.status)}</td>
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

export default ApplyLeave;
