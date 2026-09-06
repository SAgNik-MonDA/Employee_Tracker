import { useState, useEffect } from 'react';
import API from '../../api/axios';
import toast from 'react-hot-toast';

const EarlyCheckouts = () => {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const { data } = await API.get('/attendance/early-checkout/all');
      setPendingRequests(data || []);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load pending early checkouts');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (id, status) => {
    try {
      await API.put(`/attendance/early-checkout/${id}`, { status });
      toast.success(`Request ${status.toLowerCase()}!`);
      fetchRequests();
    } catch (err) {
      toast.error('Failed to review request');
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
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-surface-100">Early Check-out Approvals</h1>
        <p className="text-surface-500 mt-1">Review and approve early check-out requests from employees.</p>
      </div>

      <div className="glass-card p-6">
        {pendingRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-surface-400">
            <span className="text-5xl mb-4">✅</span>
            <p className="text-lg">No early check-out requests found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingRequests.map(req => {
              const isPending = req.earlyCheckoutStatus.startsWith('Pending');
              const isApproved = req.earlyCheckoutStatus === 'Approved';
              
              let statusClass = 'bg-amber-500/10 text-amber-400';
              if (isApproved) statusClass = 'bg-emerald-500/10 text-emerald-400';
              if (req.earlyCheckoutStatus === 'Rejected') statusClass = 'bg-rose-500/10 text-rose-400';

              return (
              <div key={req._id} className="p-5 rounded-xl bg-surface-800/50 border border-surface-700/50 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between hover:bg-surface-800/80 transition-colors">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-semibold text-lg text-surface-200">{req.employeeId?.name || 'Employee'}</span>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusClass}`}>
                      {req.earlyCheckoutStatus.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-surface-400">
                    <span className="text-surface-300 font-medium">Reason: </span>
                    {req.earlyCheckoutReason}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {req.earlyCheckoutStatus === 'Pending_TL' && (
                    <button onClick={() => handleReview(req._id, 'Pending_PM')} className="btn-success py-2 px-4 text-sm font-medium">
                      Approve as Team Lead
                    </button>
                  )}
                  {req.earlyCheckoutStatus === 'Pending_PM' && (
                    <button onClick={() => handleReview(req._id, 'Approved')} className="btn-success py-2 px-4 text-sm font-medium">
                      Approve as Project Manager
                    </button>
                  )}
                  {isPending && (
                    <button onClick={() => handleReview(req._id, 'Rejected')} className="btn-danger py-2 px-4 text-sm font-medium">
                      Reject
                    </button>
                  )}
                </div>
              </div>
            )})}
          </div>
        )}
      </div>
    </div>
  );
};

export default EarlyCheckouts;
