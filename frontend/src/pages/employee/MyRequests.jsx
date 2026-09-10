import React, { useState, useEffect } from 'react';
import { HiOutlineDocumentText, HiOutlinePlus } from 'react-icons/hi';
import API from '../../api/axios';
import toast from 'react-hot-toast';
import { useNotifications } from '../../context/NotificationContext';

const MyRequests = () => {
  const { notifications } = useNotifications();
  const [requests, setRequests] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    requestType: 'Other',
    reason: '',
    dateRequestedFor: '',
    shiftDate: '',
    currentShift: 'Morning',
    desiredShift: 'Morning',
  });

  const fetchRequests = async () => {
    try {
      const { data } = await API.get('/requests/my-requests');
      setRequests(data);
    } catch (error) {
      toast.error('Failed to load requests');
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // Re-fetch when a new notification arrives
  useEffect(() => {
    if (notifications.length > 0) {
      fetchRequests();
    }
  }, [notifications.length]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        dateRequestedFor: formData.requestType === 'Shift Change' ? formData.shiftDate : formData.dateRequestedFor,
      };
      await API.post('/requests', payload);
      toast.success('Request submitted successfully');
      setShowModal(false);
      setFormData({ requestType: 'Other', reason: '', dateRequestedFor: '', shiftDate: '', currentShift: 'Morning', desiredShift: 'Morning' });
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error submitting request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-surface-100">My Requests</h2>
          <p className="text-surface-400">Submit and track your requests</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <HiOutlinePlus className="w-5 h-5" />
          <span>New Request</span>
        </button>
      </div>

      <div className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden shadow-sm">
        {requests.length === 0 ? (
          <div className="p-8 text-center text-surface-400">
            No requests found.
          </div>
        ) : (
          <div className="divide-y divide-surface-700">
            {requests.map(req => {
              let statusClass = 'bg-amber-500/10 text-amber-400';
              if (req.status === 'Approved') statusClass = 'bg-emerald-500/10 text-emerald-400';
              if (req.status === 'Rejected') statusClass = 'bg-rose-500/10 text-rose-400';

              return (
                <div key={req._id} className="p-4 sm:px-6 hover:bg-surface-800/80 transition-colors">
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-medium text-surface-200">{req.requestType}</span>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusClass}`}>
                        {req.status}
                      </span>
                    </div>
                    <span className="text-sm text-surface-400">
                      For: {new Date(req.shiftDate || req.dateRequestedFor).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                  {req.requestType === 'Shift Change' && (
                    <div className="mb-2 text-xs font-semibold text-primary-400 flex items-center gap-2 bg-primary-500/10 border border-primary-500/20 px-3 py-1.5 rounded-lg w-fit flex-wrap">
                      <span>📅 Shift Date: {new Date(req.shiftDate || req.dateRequestedFor).toLocaleDateString('en-GB')}</span>
                      {req.currentShift && <span>• Current: {req.currentShift}</span>}
                      {req.desiredShift && <span>➜ Desired: {req.desiredShift}</span>}
                    </div>
                  )}
                  <p className="text-sm text-surface-300">{req.reason}</p>
                  {req.reviewNotes && (
                    <div className="mt-2 p-3 bg-surface-900 rounded-lg border border-surface-700">
                      <p className="text-xs text-surface-400"><strong>Note:</strong> {req.reviewNotes}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-950/60 backdrop-blur-sm">
          <div className="bg-surface-900 rounded-2xl w-full max-w-md border border-surface-700 shadow-xl overflow-hidden animate-slide-up">
            <div className="p-6 border-b border-surface-800">
              <h3 className="text-lg font-bold text-surface-100">Submit New Request</h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1">Request Type</label>
                <select
                  value={formData.requestType}
                  onChange={(e) => setFormData({...formData, requestType: e.target.value})}
                  className="input-field"
                  required
                >
                  <option value="Hardware">Hardware</option>
                  <option value="Software">Software</option>
                  <option value="Network/IT">Network/IT</option>
                  <option value="HR/Admin">HR/Admin</option>
                  <option value="Shift Change">Shift Change</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {formData.requestType === 'Shift Change' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1">Assign Shift Date of the Shift *</label>
                    <input
                      type="date"
                      value={formData.shiftDate}
                      onChange={(e) => setFormData({...formData, shiftDate: e.target.value, dateRequestedFor: e.target.value})}
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1">Current Shift (Assigned Shift on Date) *</label>
                    <select
                      value={formData.currentShift}
                      onChange={(e) => setFormData({...formData, currentShift: e.target.value})}
                      className="input-field"
                      required
                    >
                      <option value="General">General (10:00 AM - 6:00 PM)</option>
                      <option value="Morning">Morning (6:00 AM - 2:00 PM)</option>
                      <option value="Evening">Evening (2:00 PM - 10:00 PM)</option>
                      <option value="Night">Night (10:00 PM - 6:00 AM)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1">Desired Shift (To Change To) *</label>
                    <select
                      value={formData.desiredShift}
                      onChange={(e) => setFormData({...formData, desiredShift: e.target.value})}
                      className="input-field"
                      required
                    >
                      <option value="General">General (10:00 AM - 6:00 PM)</option>
                      <option value="Morning">Morning (6:00 AM - 2:00 PM)</option>
                      <option value="Evening">Evening (2:00 PM - 10:00 PM)</option>
                      <option value="Night">Night (10:00 PM - 6:00 AM)</option>
                    </select>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1">Date *</label>
                  <input
                    type="date"
                    value={formData.dateRequestedFor}
                    onChange={(e) => setFormData({...formData, dateRequestedFor: e.target.value})}
                    className="input-field"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1">Reason *</label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({...formData, reason: e.target.value})}
                  className="input-field"
                  rows="3"
                  required
                  placeholder={formData.requestType === 'Shift Change' ? "Explain why you want to change your shift..." : "Explain your request in detail..."}
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="btn-primary">
                  {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyRequests;
