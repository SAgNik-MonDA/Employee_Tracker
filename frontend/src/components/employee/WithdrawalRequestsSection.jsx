import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { HiOutlineCurrencyRupee, HiOutlineDocumentText, HiOutlineClock, HiOutlineShieldCheck } from 'react-icons/hi';
import { submitWithdrawal, getMyWithdrawals } from '../../api/withdrawalAPI';
import { useAuth } from '../../context/AuthContext';

const WithdrawalRequestsSection = ({ profile, fetchProfile }) => {
  const { user } = useAuth();
  const activeProfile = profile || user;
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [filterMonth, setFilterMonth] = useState('All');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());

  const [form, setForm] = useState({
    type: 'PF',
    amount: '',
    reason: '',
  });

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const { data } = await getMyWithdrawals();
      // Filter for PF requests in this section
      const pfOnly = data.filter((r) => r.type === 'PF');
      setRequests(pfOnly);
    } catch (error) {
      console.error('Failed to load withdrawals', error);
    } finally {
      setLoading(false);
    }
  };

  // Yearly limit calculation (PF Max 2 per year)
  const currentYear = new Date().getFullYear();
  const pfRequestsThisYear = useMemo(() => {
    return requests.filter(
      (req) =>
        req.type === 'PF' &&
        new Date(req.createdAt).getFullYear() === currentYear
    ).length;
  }, [requests, currentYear]);

  const pfLimitReached = pfRequestsThisYear >= 2;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const numAmount = Number(form.amount);
    if (!form.amount || isNaN(numAmount) || numAmount <= 0) {
      return toast.error('Enter a valid amount');
    }

    const availablePf = activeProfile?.totalPfAccumulated || 0;
    if (numAmount > availablePf) {
      return toast.error(`Amount exceeds available PF balance (₹${availablePf.toLocaleString()})`);
    }

    if (pfLimitReached) {
      return toast.error(`Maximum 2 PF withdrawal requests allowed per calendar year (${currentYear}).`);
    }

    setSubmitting(true);
    try {
      await submitWithdrawal({ type: 'PF', amount: numAmount, reason: form.reason });
      toast.success('PF withdrawal request submitted for review');
      setForm({
        type: 'PF',
        amount: '',
        reason: '',
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
    return requests.filter((req) => {
      const reqDate = new Date(req.createdAt);
      const matchYear = filterYear === 'All' || reqDate.getFullYear().toString() === filterYear;
      const matchMonth = filterMonth === 'All' || (reqDate.getMonth() + 1).toString() === filterMonth;
      return matchYear && matchMonth;
    });
  }, [requests, filterMonth, filterYear]);

  const stats = useMemo(() => {
    return filteredRequests.reduce(
      (acc, req) => {
        acc.totalRequested += req.amount;
        acc.count += 1;
        if (req.status === 'Approved' || req.status === 'Paid') acc.approved += 1;
        if (req.status === 'Rejected') acc.rejected += 1;
        return acc;
      },
      { totalRequested: 0, count: 0, approved: 0, rejected: 0 }
    );
  }, [filteredRequests]);

  const availablePf = activeProfile?.totalPfAccumulated || 0;

  return (
    <div className="mt-8 mb-6">
      <div className="flex items-center justify-between mb-4 border-b border-surface-700/40 pb-2">
        <h3 className="text-sm font-semibold text-surface-400 uppercase tracking-wider flex items-center gap-2">
          <HiOutlineCurrencyRupee className="w-5 h-5 text-violet-400" />
          Provident Fund (PF) Withdrawal Portal
        </h3>
        <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface-800 text-surface-300 border border-surface-700">
          PF ID: {activeProfile?.pfId || 'Not Generated'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Request Form */}
        <div className="glass-card p-5">
          <h4 className="font-bold text-surface-100 mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <HiOutlineCurrencyRupee className="w-5 h-5 text-violet-400" />
              New PF Withdrawal Request
            </span>
            <span className="text-xs font-mono text-surface-400">
              {pfRequestsThisYear}/2 Used ({currentYear})
            </span>
          </h4>

          <form onSubmit={handleSubmit} className="space-y-4">
            {pfLimitReached && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium">
                ⚠️ You have reached the maximum limit of 2 PF withdrawals for the current year ({currentYear}).
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1">
                Amount (Available PF: ₹{availablePf.toLocaleString()})
              </label>
              <input
                type="number"
                required
                min="1"
                max={availablePf}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="input-field disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Enter amount in INR"
                disabled={pfLimitReached}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1">Reason for Withdrawal</label>
              <textarea
                required
                rows="3"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className="input-field disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="State the reason (e.g. Higher education, Home construction, Marriage)"
                disabled={pfLimitReached}
              />
            </div>

            <button
              type="submit"
              disabled={submitting || pfLimitReached}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit PF Request'}
            </button>
          </form>
        </div>

        {/* PF Withdrawal History */}
        <div className="glass-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-surface-100 flex items-center gap-2">
                <HiOutlineClock className="w-4 h-4 text-violet-400" />
                PF Withdrawal History
              </h4>
              <div className="flex gap-2">
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="bg-surface-800 border border-surface-700 rounded-lg px-2 py-1 text-xs text-surface-300"
                >
                  <option value="All">All Months</option>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={(i + 1).toString()}>
                      {new Date(0, i).toLocaleString('en', { month: 'short' })}
                    </option>
                  ))}
                </select>
                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="bg-surface-800 border border-surface-700 rounded-lg px-2 py-1 text-xs text-surface-300"
                >
                  <option value="All">All Years</option>
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                </select>
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-surface-500">Loading history...</p>
            ) : filteredRequests.length === 0 ? (
              <p className="text-sm text-surface-500 py-6 text-center">No PF requests found for the selected period.</p>
            ) : (
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                {filteredRequests.map((req) => (
                  <div key={req._id} className="p-3 rounded-lg bg-surface-800/50 border border-surface-700/50 flex justify-between items-center text-sm">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-surface-200">₹{req.amount?.toLocaleString()}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                          {req.claimId || 'PF'}
                        </span>
                      </div>
                      <p className="text-xs text-surface-400 mt-1 line-clamp-1">{req.reason}</p>
                      <p className="text-[10px] text-surface-500 mt-0.5">{new Date(req.createdAt).toLocaleDateString('en-IN')}</p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-md font-medium ${
                        req.status === 'Approved' || req.status === 'Paid'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : req.status === 'Rejected'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {req.status === 'Paid' ? 'Approved & Paid' : req.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-surface-700/40 flex justify-between text-xs text-surface-400">
            <span>Filtered Total: <strong className="text-surface-200">₹{stats.totalRequested.toLocaleString()}</strong></span>
            <span>Approved: <strong className="text-emerald-400">{stats.approved}</strong> | Rejected: <strong className="text-rose-400">{stats.rejected}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WithdrawalRequestsSection;
