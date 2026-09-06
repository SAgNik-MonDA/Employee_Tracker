import React, { useState, useEffect } from 'react';
import API from '../../api/axios';
import toast from 'react-hot-toast';
import {
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineClock,
  HiOutlineUser,
  HiOutlineRefresh,
  HiOutlineShieldCheck,
} from 'react-icons/hi';
import UserAvatar from '../../components/common/UserAvatar';

const FaceResets = () => {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({ approved: 0, rejected: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch employees to get current pending requests
      const { data: employees } = await API.get('/auth/employees');
      const pending = employees.filter(e => e.faceResetRequest === 'Pending');
      setPendingRequests(pending);

      // Fetch history & stats
      const { data: historyRes } = await API.get('/auth/face-resets/history');
      setHistory(historyRes.history || []);
      setStats(historyRes.stats || { approved: 0, rejected: 0, total: 0 });
    } catch (error) {
      console.error(error);
      toast.error('Failed to load face reset data');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (id, status) => {
    try {
      await API.put(`/auth/approve-face-reset/${id}`, { status });
      toast.success(`Face reset request ${status.toLowerCase()} successfully!`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to review face reset request');
    }
  };

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
          <HiOutlineShieldCheck className="w-7 h-7 text-primary-400" />
          Face Authentication Resets
        </h1>
        <p className="text-surface-400 mt-1">
          Review employee face reset requests and view complete approval history logs.
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
            <p className="text-2xl font-bold text-surface-100 mt-0.5">{pendingRequests.length}</p>
          </div>
        </div>

        <div className="glass-card p-5 flex items-center gap-4">
          <div className="p-3.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <HiOutlineCheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Approved Resets</p>
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

      {/* Pending Reset Requests Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-surface-100 flex items-center gap-2">
          <HiOutlineUser className="w-5 h-5 text-amber-400" />
          Pending Requests ({pendingRequests.length})
        </h2>

        <div className="glass-card p-6">
          {pendingRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-surface-400">
              <span className="text-4xl mb-3">✅</span>
              <p className="text-base font-medium">No pending face reset requests found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map(req => (
                <div
                  key={req._id}
                  className="p-5 rounded-xl bg-surface-800/50 border border-surface-700/50 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between hover:bg-surface-800/80 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <UserAvatar user={req} size="md" />
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-lg text-surface-100">{req.name || 'Employee'}</span>
                        {req.employeeCode && (
                          <span className="font-mono text-xs text-primary-400 font-semibold bg-primary-500/10 px-2 py-0.5 rounded border border-primary-500/20">
                            ({req.employeeCode})
                          </span>
                        )}
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Pending Review
                        </span>
                      </div>
                      <p className="text-xs text-surface-400 mt-1">
                        Role: <span className="text-surface-300 font-medium">{req.role}</span>
                        {req.designation && <span> · {req.designation}</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 self-end md:self-auto">
                    <button
                      onClick={() => handleReview(req._id, 'Approved')}
                      className="btn-success py-2 px-4 text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-emerald-500/10"
                    >
                      <HiOutlineCheckCircle className="w-4 h-4" />
                      Approve Reset
                    </button>
                    <button
                      onClick={() => handleReview(req._id, 'Rejected')}
                      className="btn-danger py-2 px-4 text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-rose-500/10"
                    >
                      <HiOutlineXCircle className="w-4 h-4" />
                      Reject Request
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Face Reset History Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-surface-100 flex items-center gap-2">
          <HiOutlineRefresh className="w-5 h-5 text-primary-400" />
          Face Reset History Log
        </h2>

        <div className="glass-card p-6">
          {history.length === 0 ? (
            <div className="text-center py-10 text-surface-500 text-sm">
              No face reset history recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-surface-700/50">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-800/80 border-b border-surface-700/50 text-surface-300 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Actioned By</th>
                    <th className="py-3 px-4 text-right">Date & Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-700/30 text-surface-300">
                  {history.map(item => {
                    const isApproved = item.status === 'Approved';
                    const emp = item.employee || {};
                    const reviewer = item.reviewedBy || {};

                    return (
                      <tr key={item._id} className="hover:bg-surface-800/40 transition-colors">
                        {/* Employee Name & Code */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <UserAvatar user={emp} size="xs" />
                            <div>
                              <p className="font-semibold text-surface-100">
                                {item.employeeName || emp.name || 'Employee'}
                              </p>
                              <p className="text-[11px] font-mono text-primary-400">
                                {item.employeeCode || emp.employeeCode || 'N/A'}
                              </p>
                            </div>
                          </div>
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
                            {item.status}
                          </span>
                        </td>

                        {/* Reviewer Details */}
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-semibold text-surface-200">
                              {item.reviewerName || reviewer.name || 'Admin'}
                              {(item.reviewerEmployeeCode || reviewer.employeeCode) && (
                                <span className="font-mono text-surface-400 text-[11px] ml-1">
                                  ({item.reviewerEmployeeCode || reviewer.employeeCode})
                                </span>
                              )}
                            </p>
                            <p className="text-[10px] text-surface-500">{item.reviewerRole || reviewer.role || 'Admin'}</p>
                          </div>
                        </td>

                        {/* Date & Time */}
                        <td className="py-3 px-4 text-right text-surface-400 font-mono text-[11px]">
                          {item.reviewedAt ? new Date(item.reviewedAt).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          }) : '—'}
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

export default FaceResets;
