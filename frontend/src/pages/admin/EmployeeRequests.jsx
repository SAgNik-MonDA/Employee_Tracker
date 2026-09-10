import React, { useState, useEffect } from 'react';
import API from '../../api/axios';
import toast from 'react-hot-toast';

const EmployeeRequests = () => {
  const [requests, setRequests] = useState([]);
  const [reviewModal, setReviewModal] = useState({ open: false, request: null, actionStatus: '' });
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const fetchRequests = async () => {
    try {
      const { data } = await API.get('/requests/all');
      setRequests(data);
    } catch (error) {
      toast.error('Failed to load employee requests');
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const openReviewModal = (req, status) => {
    setReviewModal({ open: true, request: req, actionStatus: status });
    setReviewNotes('');
  };

  const submitReview = async () => {
    if (!reviewModal.request) return;
    setReviewing(true);
    try {
      await API.put(`/requests/${reviewModal.request._id}/review`, {
        status: reviewModal.actionStatus,
        reviewNotes: reviewNotes.trim(),
      });
      toast.success(`Request ${reviewModal.actionStatus.toLowerCase()} successfully`);
      setReviewModal({ open: false, request: null, actionStatus: '' });
      setReviewNotes('');
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update request');
    } finally {
      setReviewing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-surface-100">Employee Requests</h2>
        <p className="text-surface-400">Manage hardware, software, IT, and shift change requests</p>
      </div>

      <div className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden shadow-sm">
        {requests.length === 0 ? (
          <div className="p-8 text-center text-surface-400">
            No requests found.
          </div>
        ) : (
          <div className="divide-y divide-surface-700">
            {requests.map(req => {
              const isPending = req.status === 'Pending';
              let statusClass = 'bg-amber-500/10 text-amber-400';
              if (req.status === 'Approved') statusClass = 'bg-emerald-500/10 text-emerald-400';
              if (req.status === 'Rejected') statusClass = 'bg-rose-500/10 text-rose-400';

              return (
                <div key={req._id} className="p-4 sm:px-6 hover:bg-surface-800/80 transition-colors flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-semibold text-lg text-surface-200">{req.employeeId?.name || 'Employee'}</span>
                      {req.employeeId?.employeeCode && (
                        <span className="font-mono text-xs text-surface-400">({req.employeeId.employeeCode})</span>
                      )}
                      <span className="text-surface-400 text-sm border-l border-surface-600 pl-3">{req.requestType}</span>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusClass}`}>
                        {req.status}
                      </span>
                    </div>
                    <p className="text-sm text-surface-300">
                      <strong>Reason:</strong> {req.reason}
                    </p>
                    <p className="text-xs text-surface-500 mt-1">
                      For Date: {new Date(req.shiftDate || req.dateRequestedFor).toLocaleDateString('en-GB')}
                    </p>
                    {req.requestType === 'Shift Change' && (
                      <div className="mt-2 text-xs font-semibold text-primary-400 flex items-center gap-2.5 bg-primary-500/10 border border-primary-500/20 px-3 py-1.5 rounded-lg w-fit flex-wrap">
                        <span>📅 Date: {new Date(req.shiftDate || req.dateRequestedFor).toLocaleDateString('en-GB')}</span>
                        {req.currentShift && <span>• Current: {req.currentShift}</span>}
                        {req.desiredShift && <span>➔ New: {req.desiredShift}</span>}
                      </div>
                    )}
                    {req.reviewedBy && (
                      <p className="text-xs text-surface-400 mt-2">
                        Reviewed by: {req.reviewedBy.name} ({req.reviewedBy.role})
                        {req.reviewNotes && <span> - "{req.reviewNotes}"</span>}
                      </p>
                    )}
                  </div>
                  
                  {isPending && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => openReviewModal(req, 'Approved')} className="btn-success py-2 px-4 text-sm font-medium">
                        Approve
                      </button>
                      <button onClick={() => openReviewModal(req, 'Rejected')} className="btn-danger py-2 px-4 text-sm font-medium">
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Custom Review Modal (Replaces browser prompt) */}
      {reviewModal.open && reviewModal.request && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-950/60 backdrop-blur-sm">
          <div className="bg-surface-900 rounded-2xl w-full max-w-md border border-surface-700 shadow-2xl overflow-hidden animate-slide-up">
            <div className="p-5 border-b border-surface-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-surface-100 flex items-center gap-2">
                {reviewModal.actionStatus === 'Approved' ? (
                  <span className="text-emerald-400 flex items-center gap-1.5">✓ Approve Request</span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-1.5">✕ Reject Request</span>
                )}
              </h3>
              <button
                onClick={() => setReviewModal({ open: false, request: null, actionStatus: '' })}
                className="text-surface-400 hover:text-surface-200 p-1 rounded-lg hover:bg-surface-800 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Request Summary Box */}
              <div className="p-3.5 rounded-xl bg-surface-800/80 border border-surface-700 space-y-1.5 text-xs text-surface-300">
                <div className="flex justify-between font-semibold text-surface-200">
                  <span>{reviewModal.request.employeeId?.name || 'Employee'} {reviewModal.request.employeeId?.employeeCode ? `(${reviewModal.request.employeeId.employeeCode})` : ''}</span>
                  <span className="text-primary-400">{reviewModal.request.requestType}</span>
                </div>
                {reviewModal.request.requestType === 'Shift Change' && (
                  <div className="text-[11px] text-surface-400 space-y-0.5 pt-1 border-t border-surface-700/50">
                    <p>📅 Shift Date: {new Date(reviewModal.request.shiftDate || reviewModal.request.dateRequestedFor).toLocaleDateString('en-GB')}</p>
                    {reviewModal.request.currentShift && <p>• Current Shift: <strong className="text-surface-200">{reviewModal.request.currentShift}</strong></p>}
                    {reviewModal.request.desiredShift && <p>➔ Desired Shift: <strong className="text-primary-400">{reviewModal.request.desiredShift}</strong></p>}
                  </div>
                )}
                <p className="text-surface-400 italic pt-1 border-t border-surface-700/50">"{reviewModal.request.reason}"</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-surface-300 mb-1.5">
                  Review Notes {reviewModal.actionStatus === 'Approved' ? '(Optional)' : '(Reason for rejection)'}
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="input-field resize-none"
                  rows="3"
                  placeholder={`Enter notes for ${reviewModal.actionStatus.toLowerCase()}ing this request...`}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReviewModal({ open: false, request: null, actionStatus: '' })}
                  className="btn-secondary text-xs py-2 px-4"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitReview}
                  disabled={reviewing}
                  className={`text-xs py-2 px-5 font-semibold rounded-xl transition-all ${
                    reviewModal.actionStatus === 'Approved'
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20'
                      : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20'
                  }`}
                >
                  {reviewing ? 'Processing...' : `Confirm ${reviewModal.actionStatus}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeRequests;
