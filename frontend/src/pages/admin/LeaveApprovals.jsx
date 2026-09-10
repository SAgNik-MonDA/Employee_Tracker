import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import API from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import toast from 'react-hot-toast';
import { HiOutlineCheck, HiOutlineX } from 'react-icons/hi';

const LeaveApprovals = () => {
  const { user } = useAuth();
  const { notifications } = useNotifications();
  const location = useLocation();
  const isAdmin = user?.role === 'Admin';
  
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Pending');

  const [confirmModal, setConfirmModal] = useState({ open: false, leaveId: null, action: null, employeeName: '' });
  const [processingId, setProcessingId] = useState(null);

  // Read hash on mount or change
  useEffect(() => {
    if (location.hash === '#pending') setFilter('Pending');
    if (location.hash === '#approved') setFilter('Approved');
    if (location.hash === '#rejected') setFilter('Rejected');
    if (location.hash === '#all') setFilter('All');
  }, [location.hash, location.key]);

  useEffect(() => {
    fetchLeaves();
  }, [filter]);

  // Re-fetch when a new notification arrives
  useEffect(() => {
    if (notifications.length > 0) {
      fetchLeaves();
    }
  }, [notifications.length]);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const url = filter === 'All' ? '/leaves/all-requests' : `/leaves/all-requests?status=${filter}`;
      // Add a timestamp to bypass any caching
      const { data } = await API.get(`${url}${filter === 'All' ? '?' : '&'}_t=${Date.now()}`);
      setLeaves(data);
    } catch (error) {
      toast.error('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    const { leaveId, action } = confirmModal;
    setProcessingId(leaveId);
    
    try {
      await API.put(`/leaves/status/${leaveId}`, { status: action });
      toast.success(`Leave ${action.toLowerCase()} successfully`);
      
      // Optimistically update the UI to instantly remove or update the row
      if (filter === 'Pending') {
        setLeaves(prev => prev.filter(l => l._id !== leaveId));
      } else {
        setLeaves(prev => prev.map(l => l._id === leaveId ? { ...l, status: action } : l));
      }
      
      setConfirmModal({ open: false, leaveId: null, action: null, employeeName: '' });
      // Fetch fresh data in the background
      fetchLeaves();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Update failed');
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status) => {
    const classes = { Pending: 'badge-pending', Approved: 'badge-approved', Rejected: 'badge-rejected' };
    return <span className={classes[status] || 'badge'}>{status}</span>;
  };

  const getLeaveTypeBadge = (type) => {
    const colors = {
      Casual:    'bg-primary-500/20 text-primary-400 border border-primary-500/30',
      Emergency: 'bg-rose-500/20 text-rose-400 border border-rose-500/30',
    };
    return <span className={`badge ${colors[type] || ''}`}>{type}</span>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-surface-100">Leave Approvals</h1>
        <p className="text-surface-500 mt-1">Review and manage employee leave requests</p>
      </div>

      <div className="glass-card p-6">
        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {['Pending', 'Approved', 'Rejected', 'All'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                filter === f
                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25'
                  : 'bg-surface-800/50 text-surface-400 hover:text-surface-200 border border-surface-700/50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Days</th>
                <th>Reason</th>
                <th>Status</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={isAdmin ? 8 : 7} className="text-center py-8 text-surface-500">Loading...</td></tr>
              ) : leaves.length === 0 ? (
                <tr><td colSpan={isAdmin ? 8 : 7} className="text-center py-8 text-surface-500">No leave requests found</td></tr>
              ) : (
                leaves.map((l) => (
                  <tr key={l._id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold">
                          {l.employeeId?.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-surface-200">{l.employeeId?.name || 'Unknown'}</p>
                          <p className="text-xs text-surface-500">{l.employeeId?.department || ''}</p>
                        </div>
                      </div>
                    </td>
                    <td>{getLeaveTypeBadge(l.leaveType)}</td>
                    <td>{new Date(l.startDate).toLocaleDateString()}</td>
                    <td>{new Date(l.endDate).toLocaleDateString()}</td>
                    <td className="font-medium text-surface-200">
                      {l.days ? `${l.days}d` : '—'}
                    </td>
                    <td className="max-w-[180px] truncate text-surface-400">{l.reason || '-'}</td>
                    <td>{getStatusBadge(l.status)}</td>
                    {/* Approve/Reject only for Admin */}
                    {isAdmin && (
                      <td>
                        {l.status === 'Pending' ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setConfirmModal({ open: true, leaveId: l._id, action: 'Approved', employeeName: l.employeeId?.name || 'Unknown' })}
                              disabled={processingId === l._id}
                              className={`p-2 rounded-lg transition-colors ${
                                processingId === l._id 
                                  ? 'bg-surface-700 text-surface-500 cursor-not-allowed'
                                  : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                              }`}
                              title="Approve"
                            >
                              {processingId === l._id && confirmModal.action === 'Approved' ? (
                                <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <HiOutlineCheck className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => setConfirmModal({ open: true, leaveId: l._id, action: 'Rejected', employeeName: l.employeeId?.name || 'Unknown' })}
                              disabled={processingId === l._id}
                              className={`p-2 rounded-lg transition-colors ${
                                processingId === l._id
                                  ? 'bg-surface-700 text-surface-500 cursor-not-allowed'
                                  : 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                              }`}
                              title="Reject"
                            >
                              {processingId === l._id && confirmModal.action === 'Rejected' ? (
                                <div className="w-4 h-4 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <HiOutlineX className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-surface-600">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-950/60 backdrop-blur-sm animate-fade-in p-4">
          <div className="bg-surface-900 border border-surface-700 w-full max-w-sm rounded-2xl shadow-2xl p-6 animate-slide-up">
            <h3 className="text-xl font-bold text-surface-100 mb-2">
              Confirm {confirmModal.action === 'Approved' ? 'Approval' : 'Rejection'}
            </h3>
            <p className="text-surface-400 mb-6 leading-relaxed">
              Are you sure you want to <strong>{confirmModal.action === 'Approved' ? 'approve' : 'reject'}</strong> the leave request for <strong className="text-surface-200">{confirmModal.employeeName}</strong>? This action will notify the employee.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmModal({ open: false, leaveId: null, action: null, employeeName: '' })}
                disabled={processingId !== null}
                className="px-4 py-2 rounded-xl text-sm font-medium text-surface-300 hover:bg-surface-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleStatusUpdate}
                disabled={processingId !== null}
                className={`px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-lg transition-all ${
                  confirmModal.action === 'Approved'
                    ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30'
                    : 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/30'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {processingId !== null ? 'Processing...' : `Yes, ${confirmModal.action === 'Approved' ? 'Approve' : 'Reject'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveApprovals;
