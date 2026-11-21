import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  HiOutlineShieldCheck,
  HiOutlineDocumentText,
  HiOutlineDownload,
  HiOutlineUpload,
  HiOutlineX,
  HiOutlineCurrencyRupee,
  HiOutlineCalendar,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineClock,
  HiOutlineClipboardCopy,
  HiOutlinePlusCircle,
  HiOutlineInformationCircle,
} from 'react-icons/hi';
import { submitWithdrawal, getMyWithdrawals, downloadSettlementPayslip } from '../../api/withdrawalAPI';
import { useAuth } from '../../context/AuthContext';

const PURPOSE_OPTIONS = [
  'Medical Emergencies',
  'Hospitalization & Surgery',
  'Cashless Treatment',
  'Prescription Medicines & Diagnostic Tests',
  'Critical Illness Cover',
  'Maternity and Newborn Care',
  'Preventive Health Check-up',
  'Family Protection',
  'Other Illness / Treatment',
];

const MediclaimSection = ({ profile, fetchProfile }) => {
  const { user } = useAuth();
  const activeProfile = profile || user;
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  // Filters
  const [filterMonth, setFilterMonth] = useState('All');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());

  // Form State
  const [form, setForm] = useState({
    amount: '',
    reason: '',
    purpose: 'Medical Emergencies',
    attachment: '',
    fileName: '',
    fileSize: '',
  });

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const { data } = await getMyWithdrawals();
      // Filter only Mediclaim requests for this section
      const mediclaimOnly = data.filter((r) => r.type === 'Mediclaim');
      setRequests(mediclaimOnly);
    } catch (error) {
      console.error('Failed to load mediclaim requests', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Prescription file size must be less than 5 MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm({
          ...form,
          attachment: reader.result,
          fileName: file.name,
          fileSize: (file.size / 1024).toFixed(1) + ' KB',
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCopyId = (id) => {
    if (!id || id === 'Not Generated') return;
    navigator.clipboard.writeText(id);
    toast.success('Mediclaim ID copied to clipboard! 📋');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const numericAmount = Number(form.amount);

    if (!form.amount || isNaN(numericAmount) || numericAmount <= 0) {
      return toast.error('Please enter a valid amount.');
    }

    const availableBalance = activeProfile?.totalMediclaimAccumulated || 0;
    if (numericAmount > availableBalance) {
      return toast.error(`Requested amount exceeds your available Mediclaim balance (₹${availableBalance.toLocaleString()}).`);
    }

    if (!form.reason.trim()) {
      return toast.error('Please specify the medical reason or disease name.');
    }

    if (!form.attachment) {
      return toast.error('Please upload your prescription or medical bill document.');
    }

    setSubmitting(true);
    try {
      await submitWithdrawal({
        type: 'Mediclaim',
        amount: numericAmount,
        reason: form.reason.trim(),
        diseaseName: form.reason.trim(),
        purpose: form.purpose,
        attachment: form.attachment,
        prescription: form.attachment,
      });

      toast.success('Mediclaim request submitted to Finance & Admin! 🏥');
      setShowModal(false);
      setForm({
        amount: '',
        reason: '',
        purpose: 'Medical Emergencies',
        attachment: '',
        fileName: '',
        fileSize: '',
      });
      fetchRequests();
      if (fetchProfile) fetchProfile();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit mediclaim request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPayslip = async (reqId, claimId) => {
    setDownloadingId(reqId);
    try {
      const response = await downloadSettlementPayslip(reqId);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Mediclaim_Settlement_${claimId || reqId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Settlement payslip downloaded! 📄');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to download settlement payslip');
    } finally {
      setDownloadingId(null);
    }
  };

  // Filter history
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
        if (req.status === 'Approved' || req.status === 'Paid') {
          acc.approved += 1;
          acc.totalSettled += req.amount;
        } else if (req.status === 'Rejected') {
          acc.rejected += 1;
        } else {
          acc.pending += 1;
        }
        return acc;
      },
      { totalRequested: 0, count: 0, approved: 0, rejected: 0, pending: 0, totalSettled: 0 }
    );
  }, [filteredRequests]);

  const availableBalance = activeProfile?.totalMediclaimAccumulated || 0;

  return (
    <div className="mt-8 mb-8 space-y-6">
      {/* ── Section Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-700/50 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-500/15 text-teal-400 border border-teal-500/30">
              <HiOutlineShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-display font-bold text-surface-100 flex items-center gap-2">
                Mediclaim Health Benefit Portal
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-500/10 text-teal-300 border border-teal-500/30">
                  Medical Fund
                </span>
              </h3>
              <p className="text-xs text-surface-400 mt-0.5">
                Corporate health coverage, emergency reimbursement, prescription claims &amp; settlement slips
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-semibold text-sm shadow-lg shadow-teal-500/20 transition-all duration-200 active:scale-95"
        >
          <HiOutlinePlusCircle className="w-5 h-5" />
          Request Mediclaim
        </button>
      </div>

      {/* ── Balance & Identity Cards ───────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Mediclaim Accumulated */}
        <div className="glass-card p-5 relative overflow-hidden group border border-teal-500/20 bg-gradient-to-br from-teal-950/40 via-surface-900/90 to-surface-900/90">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-teal-400">Total Mediclaim Fund</p>
              <p className="text-3xl font-extrabold text-surface-100 mt-1 font-mono tracking-tight">
                ₹{availableBalance.toLocaleString()}
              </p>
              <p className="text-xs text-surface-400 mt-2 flex items-center gap-1">
                <HiOutlineInformationCircle className="w-4 h-4 text-teal-400" /> Available for medical claims
              </p>
            </div>
            <div className="p-3 rounded-xl bg-teal-500/15 text-teal-400 border border-teal-500/25">
              <HiOutlineCurrencyRupee className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Unique Mediclaim ID */}
        <div className="glass-card p-5 border border-cyan-500/20 bg-gradient-to-br from-cyan-950/40 via-surface-900/90 to-surface-900/90">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 pr-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Mediclaim ID</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xl font-bold font-mono text-surface-100 tracking-wider truncate">
                  {activeProfile?.mediclaimId || 'Not Generated'}
                </span>
                {activeProfile?.mediclaimId && (
                  <button
                    onClick={() => handleCopyId(activeProfile.mediclaimId)}
                    title="Copy Mediclaim ID"
                    className="p-1 rounded text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/20 transition-colors"
                  >
                    <HiOutlineClipboardCopy className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-xs text-surface-400 mt-2">Unique corporate policy identifier</p>
            </div>
            <div className="p-3 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">
              <HiOutlineShieldCheck className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* PF ID Reference */}
        <div className="glass-card p-5 border border-violet-500/20 bg-gradient-to-br from-violet-950/40 via-surface-900/90 to-surface-900/90">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 pr-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-400">PF Account ID</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xl font-bold font-mono text-surface-100 tracking-wider truncate">
                  {activeProfile?.pfId || 'Not Generated'}
                </span>
                {activeProfile?.pfId && (
                  <button
                    onClick={() => handleCopyId(activeProfile.pfId)}
                    title="Copy PF ID"
                    className="p-1 rounded text-violet-400 hover:text-violet-300 hover:bg-violet-500/20 transition-colors"
                  >
                    <HiOutlineClipboardCopy className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-xs text-surface-400 mt-2">Provident Fund identification</p>
            </div>
            <div className="p-3 rounded-xl bg-violet-500/15 text-violet-400 border border-violet-500/25">
              <HiOutlineDocumentText className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Mediclaim Request Modal ────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-surface-900 border border-teal-500/30 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-surface-700/60 bg-gradient-to-r from-teal-950/60 via-surface-900 to-surface-900 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30">
                  <HiOutlineShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg text-surface-100">Submit Mediclaim Request</h3>
                  <p className="text-xs text-teal-400 font-mono">
                    Policy ID: {activeProfile?.mediclaimId || 'Pending Assignment'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-surface-400 hover:text-white hover:bg-surface-800 rounded-lg transition-colors"
              >
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
              {/* Available Limit Banner */}
              <div className="p-3.5 rounded-xl bg-teal-500/10 border border-teal-500/25 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-teal-300 uppercase tracking-wider">Available Balance:</span>
                  <p className="text-lg font-bold text-teal-200 font-mono">₹{availableBalance.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-surface-400">Employee Code:</span>
                  <p className="text-xs font-mono font-medium text-surface-200">{activeProfile?.employeeCode || '—'}</p>
                </div>
              </div>

              {/* Amount of Money */}
              <div>
                <label className="block text-xs font-semibold text-surface-300 uppercase tracking-wider mb-1.5">
                  Amount of Money (₹) <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400 font-bold text-sm">₹</span>
                  <input
                    type="number"
                    min="1"
                    max={availableBalance}
                    required
                    placeholder="Enter claim amount in INR"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="input-field pl-8 font-mono text-sm"
                  />
                </div>
                {form.amount && Number(form.amount) > availableBalance && (
                  <p className="text-xs text-rose-400 mt-1">Amount exceeds your available Mediclaim fund!</p>
                )}
              </div>

              {/* Reason / Disease Name */}
              <div>
                <label className="block text-xs font-semibold text-surface-300 uppercase tracking-wider mb-1.5">
                  Reason / Disease Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acute Appendicitis surgery, Viral Fever, Dental Surgery"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className="input-field text-sm"
                />
              </div>

              {/* Category / Purpose */}
              <div>
                <label className="block text-xs font-semibold text-surface-300 uppercase tracking-wider mb-1.5">
                  Medical Category / Purpose
                </label>
                <select
                  value={form.purpose}
                  onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                  className="input-field text-sm"
                >
                  {PURPOSE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt} className="bg-surface-900 text-surface-100">
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {/* Upload Prescription */}
              <div>
                <label className="block text-xs font-semibold text-surface-300 uppercase tracking-wider mb-1.5">
                  Upload Prescription / Medical Bill <span className="text-rose-400">*</span>
                </label>
                <div className="border-2 border-dashed border-surface-700/80 hover:border-teal-500/50 rounded-xl p-4 transition-colors text-center bg-surface-950/30">
                  <input
                    type="file"
                    id="prescriptionUpload"
                    accept="image/*,.pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label htmlFor="prescriptionUpload" className="cursor-pointer flex flex-col items-center">
                    <HiOutlineUpload className="w-8 h-8 text-teal-400 mb-2" />
                    <span className="text-xs font-semibold text-surface-200">
                      {form.fileName ? form.fileName : 'Click to select prescription (PDF or Image)'}
                    </span>
                    <span className="text-[11px] text-surface-500 mt-1">
                      {form.fileSize ? `Size: ${form.fileSize}` : 'Supports JPG, PNG, PDF up to 5 MB'}
                    </span>
                  </label>
                </div>
                {form.attachment && (
                  <div className="mt-2 flex items-center justify-between text-xs text-teal-400 bg-teal-500/10 px-3 py-1.5 rounded-lg border border-teal-500/20">
                    <span>✅ Prescription ready for submission</span>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, attachment: '', fileName: '', fileSize: '' })}
                      className="text-rose-400 hover:text-rose-300 font-semibold"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {/* Information Note */}
              <div className="p-3 rounded-lg bg-surface-800/60 border border-surface-700/60 text-xs text-surface-400 leading-relaxed">
                💡 <strong>Approval Workflow:</strong> Once submitted, this request will be forwarded to the <strong>Finance &amp; Admin team</strong> with your unique Mediclaim ID. Upon approval, the money will be deducted from your total Mediclaim fund and a formal <strong>Settlement Payslip PDF</strong> will be emailed to you automatically.
              </div>

              {/* Actions */}
              <div className="pt-2 flex justify-end gap-3 border-t border-surface-700/40">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-surface-300 hover:bg-surface-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || (form.amount && Number(form.amount) > availableBalance)}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-semibold text-sm shadow-md shadow-teal-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Submitting...
                    </>
                  ) : (
                    'Submit Request'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Mediclaim Request History ──────────────────────────────────── */}
      <div className="glass-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-3 border-b border-surface-700/40">
          <div>
            <h4 className="font-display font-bold text-base text-surface-100 flex items-center gap-2">
              <HiOutlineClock className="w-5 h-5 text-teal-400" />
              Mediclaim Claim &amp; Reimbursement History
            </h4>
            <p className="text-xs text-surface-400 mt-0.5">
              Track past claims, approval status, fund deductions, and settlement payslips
            </p>
          </div>

          {/* Month & Year Filters */}
          <div className="flex items-center gap-2">
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="bg-surface-800 border border-surface-700 rounded-lg px-2.5 py-1.5 text-xs text-surface-200 focus:outline-none focus:border-teal-500"
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
              className="bg-surface-800 border border-surface-700 rounded-lg px-2.5 py-1.5 text-xs text-surface-200 focus:outline-none focus:border-teal-500"
            >
              <option value="All">All Years</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>
          </div>
        </div>

        {/* Mini Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="p-3 rounded-xl bg-surface-800/40 border border-surface-700/50">
            <p className="text-[11px] font-semibold text-surface-400 uppercase">Total Claims</p>
            <p className="text-lg font-bold text-surface-100 mt-0.5">{stats.count}</p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-[11px] font-semibold text-emerald-400 uppercase">Approved &amp; Settled</p>
            <p className="text-lg font-bold text-emerald-300 mt-0.5">{stats.approved}</p>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <p className="text-[11px] font-semibold text-amber-400 uppercase">Pending Review</p>
            <p className="text-lg font-bold text-amber-300 mt-0.5">{stats.pending}</p>
          </div>
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <p className="text-[11px] font-semibold text-rose-400 uppercase">Rejected</p>
            <p className="text-lg font-bold text-rose-300 mt-0.5">{stats.rejected}</p>
          </div>
        </div>

        {/* Requests List */}
        {loading ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-xs text-surface-400">Loading claim records...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-surface-700/60 rounded-xl bg-surface-950/20">
            <HiOutlineDocumentText className="w-10 h-10 text-surface-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-surface-300">No Mediclaim records found</p>
            <p className="text-xs text-surface-500 mt-1">
              You haven't submitted any Mediclaim requests for the selected period.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRequests.map((req) => {
              const isApproved = req.status === 'Approved' || req.status === 'Paid';
              const isRejected = req.status === 'Rejected';
              const isPending = req.status === 'Pending';

              return (
                <div
                  key={req._id}
                  className="p-4 rounded-xl bg-surface-800/40 hover:bg-surface-800/60 border border-surface-700/50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`p-2.5 rounded-xl flex-shrink-0 ${
                        isApproved
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                          : isRejected
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                      }`}
                    >
                      {isApproved ? (
                        <HiOutlineCheckCircle className="w-5 h-5" />
                      ) : isRejected ? (
                        <HiOutlineXCircle className="w-5 h-5" />
                      ) : (
                        <HiOutlineClock className="w-5 h-5" />
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm text-surface-100 font-mono">
                          {req.claimId || `CLM-${String(req._id).slice(-6).toUpperCase()}`}
                        </span>
                        <span
                          className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold border ${
                            isApproved
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : isRejected
                              ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                              : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          }`}
                        >
                          {isApproved ? 'Approved & Settled' : req.status}
                        </span>
                        <span className="text-xs text-surface-400 font-mono">
                          MED ID: {req.mediclaimId || activeProfile?.mediclaimId || '—'}
                        </span>
                      </div>

                      <p className="text-xs text-surface-300">
                        <strong className="text-teal-400 font-bold">Reason:</strong>{' '}
                        {req.reason || req.diseaseName || 'Medical Emergency'}
                        {req.purpose && <span className="text-surface-500"> ({req.purpose})</span>}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-surface-400">
                        <span>
                          Claimed: <strong className="text-surface-200">₹{req.amount.toLocaleString()}</strong>
                        </span>
                        <span>
                          Date:{' '}
                          {new Date(req.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                        {isApproved && req.remainingBalance !== undefined && (
                          <span className="text-teal-400">
                            Remaining Fund: ₹{req.remainingBalance.toLocaleString()}
                          </span>
                        )}
                        {req.reviewNotes && (
                          <span className="text-surface-400 italic">
                            Note: {req.reviewNotes}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions (Download Prescription & Settlement Slip) */}
                  <div className="flex items-center gap-2 self-end md:self-center">
                    {/* View/Download Prescription */}
                    {req.attachment && (
                      <a
                        href={req.attachment}
                        download={`Prescription_${req.claimId || req._id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-surface-300 hover:text-white bg-surface-700/50 hover:bg-surface-700 transition-colors"
                        title="Download Uploaded Prescription"
                      >
                        <HiOutlineDownload className="w-4 h-4 text-teal-400" />
                        Prescription
                      </a>
                    )}

                    {/* Download Settlement Payslip (Approved only) */}
                    {isApproved && (
                      <button
                        onClick={() => handleDownloadPayslip(req._id, req.claimId)}
                        disabled={downloadingId === req._id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 transition-all shadow-sm"
                        title="Download Official Settlement Payslip PDF"
                      >
                        {downloadingId === req._id ? (
                          <div className="w-3.5 h-3.5 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin"></div>
                        ) : (
                          <HiOutlineDocumentText className="w-4 h-4 text-emerald-400" />
                        )}
                        Settlement Slip
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MediclaimSection;
