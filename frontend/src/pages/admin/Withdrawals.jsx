import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { HiOutlineCheck, HiOutlineX, HiOutlineDownload, HiOutlineCurrencyRupee } from 'react-icons/hi';
import { getAllWithdrawals, reviewWithdrawal, markWithdrawalAsPaid } from '../../api/withdrawalAPI';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const Withdrawals = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Pending');

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const { data } = await getAllWithdrawals();
      setRequests(data);
    } catch (error) {
      toast.error('Failed to load withdrawal requests');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (id, status) => {
    try {
      await reviewWithdrawal(id, { status });
      toast.success(`Request ${status.toLowerCase()} successfully`);
      fetchRequests();
    } catch (error) {
      toast.error(`Failed to ${status.toLowerCase()} request`);
    }
  };

  const handleMarkAsPaid = async (id) => {
    if (!window.confirm('Are you sure you want to mark this as paid? This will deduct the amount and send a payslip email.')) {
      return;
    }
    try {
      await markWithdrawalAsPaid(id);
      toast.success('Withdrawal marked as Paid');
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to mark as paid');
    }
  };

  const filteredRequests = requests.filter(r => 
    activeTab === 'Pending' ? r.status === 'Pending' : r.status !== 'Pending'
  );

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-surface-100 mb-1">
            Withdrawal Requests
          </h1>
          <p className="text-sm text-surface-400">
            Manage employee PF and Mediclaim disbursement requests
          </p>
        </div>
        <div className="flex bg-surface-800 p-1 rounded-xl border border-surface-700/50">
          {['Pending', 'Processed'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab
                  ? 'bg-surface-700 text-surface-100 shadow-sm'
                  : 'text-surface-400 hover:text-surface-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredRequests.length === 0 ? (
          <div className="glass-card p-8 text-center text-surface-400">
            No {activeTab.toLowerCase()} requests found.
          </div>
        ) : (
          filteredRequests.map((request) => (
            <div key={request._id} className="glass-card p-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between group">
              <div className="flex items-start gap-4 flex-1">
                <div className={`p-3 rounded-xl flex-shrink-0 ${request.type === 'PF' ? 'bg-amber-500/20 text-amber-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
                  <HiOutlineCurrencyRupee className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-surface-100 flex items-center gap-2">
                    {request.employeeId?.name}
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                      request.type === 'PF' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                    }`}>
                      {request.type}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                      request.status === 'Pending' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      : request.status === 'Approved' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : request.status === 'Paid' ? 'bg-primary-500/10 border-primary-500/30 text-primary-400'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                    }`}>
                      {request.status}
                    </span>
                  </h3>
                  <div className="mt-2 space-y-1 text-sm text-surface-300">
                    <p><span className="text-surface-500">Amount Requested:</span> <strong className="text-emerald-400">₹{request.amount?.toLocaleString()}</strong></p>
                    {request.type === 'PF' ? (
                      <p><span className="text-surface-500">Reason:</span> {request.reason}</p>
                    ) : (
                      <>
                        <p><span className="text-surface-500">Purpose:</span> {request.purpose}</p>
                        <p><span className="text-surface-500">Disease Name:</span> {request.diseaseName}</p>
                        {request.attachment && (
                          <div className="mt-2">
                            <a href={request.attachment} download="Attachment" className="inline-flex items-center gap-1 text-primary-400 hover:text-primary-300 text-xs bg-primary-500/10 px-2 py-1 rounded">
                              <HiOutlineDownload className="w-4 h-4" /> Download Bill/Prescription
                            </a>
                          </div>
                        )}
                      </>
                    )}
                    <div className="mt-2 text-xs text-surface-500 pt-2 border-t border-surface-700/50">
                      Available Balance: ₹{request.type === 'PF' ? request.employeeId?.totalPfAccumulated?.toLocaleString() : request.employeeId?.totalMediclaimAccumulated?.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-0 border-surface-700/50">
                {request.status === 'Pending' && (
                  <>
                    <button
                      onClick={() => handleReview(request._id, 'Approved')}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-xl transition-colors font-medium text-sm"
                    >
                      <HiOutlineCheck className="w-4 h-4" /> Approve
                    </button>
                    <button
                      onClick={() => handleReview(request._id, 'Rejected')}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded-xl transition-colors font-medium text-sm"
                    >
                      <HiOutlineX className="w-4 h-4" /> Reject
                    </button>
                  </>
                )}
                {request.status === 'Approved' && (
                  <>
                    <button
                      onClick={() => handleMarkAsPaid(request._id)}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-xl transition-colors font-medium text-sm shadow-lg shadow-primary-500/20"
                    >
                      Generate Payslip & Pay
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Withdrawals;
