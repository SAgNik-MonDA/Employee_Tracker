import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { HiOutlineCurrencyRupee, HiOutlineDocumentText } from 'react-icons/hi';
import { submitWithdrawal, getMyWithdrawals } from '../../api/withdrawalAPI';

const WithdrawalRequestsSection = ({ profile, fetchProfile }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [filterMonth, setFilterMonth] = useState('All');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());

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

  // Yearly limit calculation (PF Max 2 per year)
  const currentYear = new Date().getFullYear();
  const pfRequestsThisYear = useMemo(() => {
    return requests.filter(req => 
      req.type === 'PF' && 
      new Date(req.createdAt).getFullYear() === currentYear
    ).length;
  }, [requests, currentYear]);

  const pfLimitReached = pfRequestsThisYear >= 2;

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
      if (fetchProfile) fetchProfile();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  // History filtering & Stats
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      const reqDate = new Date(req.createdAt);
      const matchYear = filterYear === 'All' || reqDate.getFullYear().toString() === filterYear;
      const matchMonth = filterMonth === 'All' || (reqDate.getMonth() + 1).toString() === filterMonth;
      return matchYear && matchMonth;
    });
  }, [requests, filterMonth, filterYear]);

  const stats = useMemo(() => {
    return filteredRequests.reduce((acc, req) => {
      acc.totalRequested += req.amount;
      acc.count += 1;
      if (req.status === 'Approved' || req.status === 'Paid') acc.approved += 1;
      if (req.status === 'Rejected') acc.rejected += 1;
      return acc;
    }, { totalRequested: 0, count: 0, approved: 0, rejected: 0 });
  }, [filteredRequests]);


  if (!profile || (!profile.totalPfAccumulated && !profile.totalMediclaimAccumulated && requests.length === 0)) {
    return null; 
  }

  return (
    <div className="mt-8 mb-6">
      <div className="flex items-center justify-between mb-4 border-b border-surface-700/40 pb-2">
        <h3 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">Fund Withdrawals</h3>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Request Form */}
        <div className="glass-card p-5">
          <h4 className="font-bold text-surface-100 mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <HiOutlineCurrencyRupee className="w-5 h-5 text-emerald-400" />
              New Request
            </span>
            <span className="text-xs font-mono font-normal px-2 py-1 bg-surface-800 rounded border border-surface-700">
              ID: {form.type === 'PF' ? (profile?.pfId || 'Not Generated') : (profile?.mediclaimId || 'Not Generated')}
            </span>
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

            {form.type === 'PF' && pfLimitReached && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium">
                ⚠️ You have reached the maximum limit of 2 PF withdrawals for the current year ({currentYear}). The form is locked.
              </div>
            )}

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
                className="input-field disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Enter amount"
                disabled={form.type === 'PF' && pfLimitReached}
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
                  className="input-field resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Why are you withdrawing PF?"
                  disabled={form.type === 'PF' && pfLimitReached}
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
              disabled={submitting || (form.type === 'PF' && (!profile?.totalPfAccumulated || pfLimitReached)) || (form.type === 'Mediclaim' && !profile?.totalMediclaimAccumulated)}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </form>
        </div>

        {/* History Tracking Panel */}
        <div className="glass-card p-5 max-h-[600px] flex flex-col">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <h4 className="font-bold text-surface-100 flex items-center gap-2">
              <HiOutlineDocumentText className="w-5 h-5 text-primary-400" />
              History & Tracking
            </h4>
            <div className="flex gap-2">
              <select 
                value={filterMonth} 
                onChange={e => setFilterMonth(e.target.value)} 
                className="input-field py-1 px-2 text-xs h-auto min-h-0 bg-surface-800"
              >
                <option value="All">All Months</option>
                {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('default', { month: 'short' })}</option>
                ))}
              </select>
              <select 
                value={filterYear} 
                onChange={e => setFilterYear(e.target.value)} 
                className="input-field py-1 px-2 text-xs h-auto min-h-0 bg-surface-800"
              >
                <option value="All">All Years</option>
                {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 shrink-0">
            <div className="bg-surface-800/50 rounded p-2 text-center border border-surface-700/50">
              <p className="text-[10px] text-surface-400 uppercase">Requests</p>
              <p className="text-sm font-bold text-surface-100">{stats.count}</p>
            </div>
            <div className="bg-surface-800/50 rounded p-2 text-center border border-surface-700/50">
              <p className="text-[10px] text-surface-400 uppercase">Total ₹</p>
              <p className="text-sm font-bold text-primary-400">{stats.totalRequested.toLocaleString()}</p>
            </div>
            <div className="bg-surface-800/50 rounded p-2 text-center border border-surface-700/50">
              <p className="text-[10px] text-surface-400 uppercase">Approved</p>
              <p className="text-sm font-bold text-emerald-400">{stats.approved}</p>
            </div>
            <div className="bg-surface-800/50 rounded p-2 text-center border border-surface-700/50">
              <p className="text-[10px] text-surface-400 uppercase">Rejected</p>
              <p className="text-sm font-bold text-rose-400">{stats.rejected}</p>
            </div>
          </div>
          
          <div className="overflow-y-auto flex-1 space-y-3 pr-1">
            {loading ? (
              <p className="text-sm text-surface-400 text-center py-4">Loading history...</p>
            ) : filteredRequests.length === 0 ? (
              <p className="text-sm text-surface-500 text-center py-4">No matching requests found.</p>
            ) : (
              filteredRequests.map(req => (
                <div key={req._id} className="p-3 rounded-lg bg-surface-800/50 border border-surface-700/50">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm font-bold text-surface-200">{req.type} Withdrawal</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${
                      req.status === 'Pending' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      : req.status === 'Approved' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : req.status === 'Paid' ? 'bg-primary-500/10 border-primary-500/30 text-primary-400'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                    }`}>
                      {req.status}
                    </span>
                  </div>
                  <p className="text-sm text-surface-300">Amount: <strong className="text-emerald-400">₹{req.amount.toLocaleString()}</strong></p>
                  <p className="text-xs text-surface-500 mt-1">{new Date(req.createdAt).toLocaleDateString()} {new Date(req.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WithdrawalRequestsSection;
