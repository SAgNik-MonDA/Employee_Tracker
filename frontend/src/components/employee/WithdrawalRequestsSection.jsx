import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { HiOutlineCurrencyRupee, HiOutlineDocumentText } from 'react-icons/hi';
import { submitWithdrawal, getMyWithdrawals } from '../../api/withdrawalAPI';

const WithdrawalRequestsSection = ({ profile }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    type: 'PF',
    amount: '',
    reason: '',
    diseaseName: '',
    purpose: 'Medical Emergencies',
    attachment: ''
  });

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const { data } = await getMyWithdrawals();
      setRequests(data);
    } catch (error) {
      console.error('Failed to load withdrawals', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm({ ...form, attachment: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0) {
      return toast.error('Enter a valid amount');
    }
    
    // Balance check
    if (form.type === 'PF' && Number(form.amount) > (profile?.totalPfAccumulated || 0)) {
      return toast.error('Amount exceeds available PF balance');
    }
    if (form.type === 'Mediclaim' && Number(form.amount) > (profile?.totalMediclaimAccumulated || 0)) {
      return toast.error('Amount exceeds available Mediclaim balance');
    }

    setSubmitting(true);
    try {
      await submitWithdrawal({ ...form, amount: Number(form.amount) });
      toast.success(`${form.type} withdrawal request submitted`);
      setForm({
        type: 'PF',
        amount: '',
        reason: '',
        diseaseName: '',
        purpose: 'Medical Emergencies',
        attachment: ''
      });
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  if (!profile || (!profile.totalPfAccumulated && !profile.totalMediclaimAccumulated)) {
    return null; // No balances to withdraw
  }

  return (
    <div className="mt-8 mb-6">
      <div className="flex items-center justify-between mb-4 border-b border-surface-700/40 pb-2">
        <h3 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">Fund Withdrawals</h3>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Request Form */}
        <div className="glass-card p-5">
          <h4 className="font-bold text-surface-100 mb-4 flex items-center gap-2">
            <HiOutlineCurrencyRupee className="w-5 h-5 text-emerald-400" />
            New Request
          </h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-4 mb-4">
              <label className="flex items-center gap-2 text-sm text-surface-300 cursor-pointer">
                <input type="radio" name="wType" checked={form.type === 'PF'} onChange={() => setForm({ ...form, type: 'PF' })} className="text-primary-500 focus:ring-primary-500" /> PF
              </label>
              <label className="flex items-center gap-2 text-sm text-surface-300 cursor-pointer">
                <input type="radio" name="wType" checked={form.type === 'Mediclaim'} onChange={() => setForm({ ...form, type: 'Mediclaim' })} className="text-primary-500 focus:ring-primary-500" /> Mediclaim
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1">
                Amount (Available: ₹{form.type === 'PF' ? (profile?.totalPfAccumulated || 0).toLocaleString() : (profile?.totalMediclaimAccumulated || 0).toLocaleString()})
              </label>
              <input
                type="number"
                required
                max={form.type === 'PF' ? profile?.totalPfAccumulated : profile?.totalMediclaimAccumulated}
                value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })}
                className="input-field"
                placeholder="Enter amount"
              />
            </div>

            {form.type === 'PF' ? (
              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1">Reason</label>
                <textarea
                  required
                  rows="2"
                  value={form.reason}
                  onChange={e => setForm({ ...form, reason: e.target.value })}
                  className="input-field resize-none"
                  placeholder="Why are you withdrawing PF?"
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-surface-400 mb-1">Purpose</label>
                  <select
                    required
                    value={form.purpose}
                    onChange={e => setForm({ ...form, purpose: e.target.value })}
                    className="input-field"
                  >
                    <option value="Medical Emergencies">Medical Emergencies</option>
                    <option value="Cashless Treatment">Cashless Treatment</option>
                    <option value="Tax Saving / Tax Benefits">Tax Saving / Tax Benefits</option>
                    <option value="Preventive Health Check-up">Preventive Health Check-up</option>
                    <option value="Maternity and Newborn Care">Maternity and Newborn Care</option>
                    <option value="Critical Illness Cover">Critical Illness Cover</option>
                    <option value="Family Protection">Family Protection</option>
                    <option value="Financial Security / Wealth Protection">Financial Security / Wealth Protection</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-400 mb-1">Disease Name</label>
                  <input
                    type="text"
                    required
                    value={form.diseaseName}
                    onChange={e => setForm({ ...form, diseaseName: e.target.value })}
                    className="input-field"
                    placeholder="E.g., Dengue, Surgery"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-400 mb-1">Bill / Prescription (Image/PDF)</label>
                  <input
                    type="file"
                    required
                    accept="image/*,.pdf"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-surface-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-500/10 file:text-primary-400 hover:file:bg-primary-500/20"
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={submitting || (form.type === 'PF' ? !profile?.totalPfAccumulated : !profile?.totalMediclaimAccumulated)}
              className="btn-primary w-full disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </form>
        </div>

        {/* History */}
        <div className="glass-card p-5 max-h-[500px] overflow-y-auto">
          <h4 className="font-bold text-surface-100 mb-4 flex items-center gap-2">
            <HiOutlineDocumentText className="w-5 h-5 text-primary-400" />
            Withdrawal History
          </h4>
          
          {loading ? (
            <p className="text-sm text-surface-400">Loading history...</p>
          ) : requests.length === 0 ? (
            <p className="text-sm text-surface-500">No previous requests found.</p>
          ) : (
            <div className="space-y-3">
              {requests.map(req => (
                <div key={req._id} className="p-3 rounded-lg bg-surface-800/50 border border-surface-700/50">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm font-bold text-surface-200">{req.type} Withdrawal</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                      req.status === 'Pending' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      : req.status === 'Approved' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : req.status === 'Paid' ? 'bg-primary-500/10 border-primary-500/30 text-primary-400'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                    }`}>
                      {req.status}
                    </span>
                  </div>
                  <p className="text-sm text-surface-300">Amount: <strong className="text-emerald-400">₹{req.amount.toLocaleString()}</strong></p>
                  <p className="text-xs text-surface-500 mt-1">{new Date(req.createdAt).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WithdrawalRequestsSection;
