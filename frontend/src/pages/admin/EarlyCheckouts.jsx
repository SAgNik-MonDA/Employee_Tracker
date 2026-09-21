import React, { useState, useEffect, useMemo } from 'react';
import API from '../../api/axios';
import toast from 'react-hot-toast';
import {
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineClock,
  HiOutlineUser,
  HiOutlineRefresh,
  HiOutlineLogout,
} from 'react-icons/hi';
import UserAvatar from '../../components/common/UserAvatar';

const EarlyCheckouts = () => {
  const [allRequests, setAllRequests] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  // Month-wise filter state
  const [filterMonth, setFilterMonth] = useState('All');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [allRes, pendingRes] = await Promise.all([
        API.get('/attendance/early-checkout/all'),
        API.get('/attendance/early-checkout/pending'),
      ]);

      setAllRequests(allRes.data.requests || allRes.data || []);
      setStats(allRes.data.stats || { pending: 0, approved: 0, rejected: 0, total: 0 });
      setPendingRequests(pendingRes.data || []);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load early checkout data');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (id, status) => {
    try {
      await API.put(`/attendance/early-checkout/${id}`, { status });
      toast.success(`Request ${status.toLowerCase()} successfully!`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to review request');
    }
  };

  // Separate history (non-pending) from allRequests and apply month filter
  const historyRequests = useMemo(() => {
    return allRequests.filter(req => {
      const isPending = ['Pending_TL', 'Pending_PM'].includes(req.earlyCheckoutStatus);
      if (isPending) return false;

      const reqDate = new Date(req.date || req.createdAt);
      const matchYear = filterYear === 'All' || reqDate.getFullYear().toString() === filterYear;
      const matchMonth = filterMonth === 'All' || (reqDate.getMonth() + 1).toString() === filterMonth;
      return matchYear && matchMonth;
    });
  }, [allRequests, filterMonth, filterYear]);

  const currentYear = new Date().getFullYear();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-surface-100 flex items-center gap-2.5">
          <HiOutlineLogout className="w-7 h-7 text-primary-400" />
          Early Check-out Approvals
        </h1>
        <p className="text-surface-400 mt-1">
          Review employee early check-out requests and view complete approval history logs.
        </p>
      </div>

      {/* Stats Cards Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-5 flex items-center gap-4">
          <div className="p-3.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <HiOutlineClock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Pending Requests</p>
            <p className="text-2xl font-bold text-surface-100 mt-0.5">{stats.pending}</p>
          </div>
        </div>

        <div className="glass-card p-5 flex items-center gap-4">
          <div className="p-3.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <HiOutlineCheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Approved Check-outs</p>
            <p className="text-2xl font-bold text-surface-100 mt-0.5">{stats.approved}</p>
          </div>
        </div>

        <div className="glass-card p-5 flex items-center gap-4">
          <div className="p-3.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <HiOutlineXCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Rejected Requests</p>
            <p className="text-2xl font-bold text-surface-100 mt-0.5">{stats.rejected}</p>
          </div>
        </div>
      </div>

      {/* Pending Requests Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-surface-100 flex items-center gap-2">
          <HiOutlineUser className="w-5 h-5 text-amber-400" />
          Pending Requests ({pendingRequests.length})
        </h2>

        <div className="glass-card p-6">
          {pendingRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-surface-400">
              <span className="text-4xl mb-3">✅</span>
              <p className="text-base font-medium">No pending early check-out requests found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map(req => (
                <div
                  key={req._id}
                  className="p-5 rounded-xl bg-surface-800/50 border border-surface-700/50 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between hover:bg-surface-800/80 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <UserAvatar user={req.employeeId} size="md" />
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-bold text-lg text-surface-100">
                          {req.employeeId?.name || 'Employee'}
                        </span>
                        {req.employeeId?.employeeCode && (
                          <span className="font-mono text-xs text-primary-400 font-semibold bg-primary-500/10 px-2 py-0.5 rounded border border-primary-500/20">
                            ({req.employeeId.employeeCode})
                          </span>
                        )}
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {req.earlyCheckoutStatus === 'Pending_TL' ? 'Pending (Team Lead)' : 'Pending (PM)'}
                        </span>
                      </div>
                      <p className="text-xs text-surface-400 mt-1">
                        Role: <span className="text-surface-300 font-medium">{req.employeeId?.role || '—'}</span>
                        {req.employeeId?.designation && <span> · {req.employeeId.designation}</span>}
                      </p>
                      <p className="text-xs text-surface-400 mt-1">
                        <span className="text-surface-500">Reason:</span>{' '}
                        <span className="text-surface-200">{req.earlyCheckoutReason || '—'}</span>
                      </p>
                      <p className="text-[11px] text-surface-500 mt-0.5 font-mono">
                        Date: {req.date || '—'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 self-end md:self-auto">
                    {req.earlyCheckoutStatus === 'Pending_TL' && (
                      <button
                        onClick={() => handleReview(req._id, 'Pending_PM')}
                        className="btn-success py-2 px-4 text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-emerald-500/10"
                      >
                        <HiOutlineCheckCircle className="w-4 h-4" />
                        Approve (TL)
                      </button>
                    )}
                    {req.earlyCheckoutStatus === 'Pending_PM' && (
                      <button
                        onClick={() => handleReview(req._id, 'Approved')}
                        className="btn-success py-2 px-4 text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-emerald-500/10"
                      >
                        <HiOutlineCheckCircle className="w-4 h-4" />
                        Approve (PM)
                      </button>
                    )}
                    <button
                      onClick={() => handleReview(req._id, 'Rejected')}
                      className="btn-danger py-2 px-4 text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-rose-500/10"
                    >
                      <HiOutlineXCircle className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Early Checkout History Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-surface-100 flex items-center gap-2">
            <HiOutlineRefresh className="w-5 h-5 text-primary-400" />
            Early Checkout History Log
          </h2>
          <div className="flex gap-2">
            <select
              value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)}
              className="input-field py-1.5 px-3 text-xs h-auto min-h-0 bg-surface-800 border-surface-700/50 rounded-lg"
            >
              <option value="All">All Months</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>
                  {new Date(2000, m - 1).toLocaleString('default', { month: 'short' })}
                </option>
              ))}
            </select>
            <select
              value={filterYear}
              onChange={e => setFilterYear(e.target.value)}
              className="input-field py-1.5 px-3 text-xs h-auto min-h-0 bg-surface-800 border-surface-700/50 rounded-lg"
            >
              <option value="All">All Years</option>
              {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="glass-card p-6">
          {historyRequests.length === 0 ? (
            <div className="text-center py-10 text-surface-500 text-sm">
              No early checkout history recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-surface-700/50">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-800/80 border-b border-surface-700/50 text-surface-300 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Actioned By</th>
                    <th className="py-3 px-4 text-right">Date & Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-700/30 text-surface-300">
                  {historyRequests.map(item => {
                    const isApproved = item.earlyCheckoutStatus === 'Approved';
                    const emp = item.employeeId || {};
                    const reviewer = item.earlyCheckoutReviewedBy || {};

                    return (
                      <tr key={item._id} className="hover:bg-surface-800/40 transition-colors">
                        {/* Employee Name & Code */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <UserAvatar user={emp} size="xs" />
                            <div>
                              <p className="font-semibold text-surface-100">
                                {emp.name || 'Employee'}
                              </p>
                              <p className="text-[11px] font-mono text-primary-400">
                                {emp.employeeCode || 'N/A'}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Reason */}
                        <td className="py-3 px-4">
                          <p className="text-surface-300 max-w-[200px] truncate" title={item.earlyCheckoutReason}>
                            {item.earlyCheckoutReason || '—'}
                          </p>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border inline-flex items-center gap-1 ${
                              isApproved
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}
                          >
                            {isApproved ? <HiOutlineCheckCircle className="w-3.5 h-3.5" /> : <HiOutlineXCircle className="w-3.5 h-3.5" />}
                            {item.earlyCheckoutStatus}
                          </span>
                        </td>

                        {/* Reviewer Details */}
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-semibold text-surface-200">
                              {reviewer.name || 'Admin'}
                              {reviewer.employeeCode && (
                                <span className="font-mono text-surface-400 text-[11px] ml-1">
                                  ({reviewer.employeeCode})
                                </span>
                              )}
                            </p>
                            <p className="text-[10px] text-surface-500">{reviewer.role || 'Admin'}</p>
                          </div>
                        </td>

                        {/* Date & Time */}
                        <td className="py-3 px-4 text-right text-surface-400 font-mono text-[11px]">
                          {item.earlyCheckoutReviewedAt ? new Date(item.earlyCheckoutReviewedAt).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          }) : item.date || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EarlyCheckouts;
