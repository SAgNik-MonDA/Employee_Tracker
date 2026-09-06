import { useState, useEffect } from 'react';
import API from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { HiOutlineCheck, HiOutlineX } from 'react-icons/hi';

const LeaveApprovals = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Pending');

  useEffect(() => {
    fetchLeaves();
  }, [filter]);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const url = filter === 'All' ? '/leaves/all-requests' : `/leaves/all-requests?status=${filter}`;
      const { data } = await API.get(url);
      setLeaves(data);
    } catch (error) {
      toast.error('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      await API.put(`/leaves/status/${id}`, { status });
      toast.success(`Leave ${status.toLowerCase()} successfully`);
      fetchLeaves();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Update failed');
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
                              onClick={() => handleStatusUpdate(l._id, 'Approved')}
                              className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                              title="Approve"
                            >
                              <HiOutlineCheck className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleStatusUpdate(l._id, 'Rejected')}
                              className="p-2 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition-colors"
                              title="Reject"
                            >
                              <HiOutlineX className="w-4 h-4" />
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
    </div>
  );
};

export default LeaveApprovals;
