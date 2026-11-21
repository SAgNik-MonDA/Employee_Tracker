import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  HiOutlineCheck,
  HiOutlineX,
  HiOutlineDownload,
  HiOutlineCurrencyRupee,
  HiOutlineShieldCheck,
  HiOutlineDocumentText,
  HiOutlineClipboardCheck,
  HiOutlineFilter,
  HiOutlineSearch,
  HiOutlineCreditCard,
  HiOutlineExternalLink,
  HiOutlineInformationCircle,
} from 'react-icons/hi';
import { getAllWithdrawals, reviewWithdrawal, downloadSettlementPayslip } from '../../api/withdrawalAPI';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const Withdrawals = ({ defaultType = 'All' }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Determine initial type filter based on prop or URL path
  const getInitialType = () => {
    if (location.pathname.includes('mediclaim')) return 'Mediclaim';
    if (location.pathname.includes('pf')) return 'PF';
    return defaultType || 'All';
  };

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Pending'); // 'Pending' | 'Processed'
  const [typeFilter, setTypeFilter] = useState(getInitialType);
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);

  // Review Modal State
  const [reviewModal, setReviewModal] = useState({
    open: false,
    request: null,
    status: '', // 'Approved' | 'Rejected'
    notes: '',
  });
  const [submittingReview, setSubmittingReview] = useState(false);

  // Keep typeFilter in sync when URL changes
  useEffect(() => {
    if (location.pathname.includes('mediclaim')) {
      setTypeFilter('Mediclaim');
    } else if (location.pathname.includes('pf')) {
      setTypeFilter('PF');
    } else if (defaultType && defaultType !== 'All') {
      setTypeFilter(defaultType);
    }
  }, [location.pathname, defaultType]);

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

  const handleOpenReviewModal = (request, status) => {
    setReviewModal({
      open: true,
      request,
      status,
      notes: '',
    });
  };

  const handleCloseReviewModal = () => {
    setReviewModal({
      open: false,
      request: null,
      status: '',
      notes: '',
    });
  };

  const handleConfirmReview = async () => {
    const { request, status, notes } = reviewModal;
    if (!request) return;

    if (status === 'Rejected' && !notes.trim()) {
      toast.error('Please enter a reason for rejection.');
      return;
    }

    setSubmittingReview(true);
    try {
      const { data } = await reviewWithdrawal(request._id, {
        status,
        reviewNotes: notes.trim(),
      });
      toast.success(data.message || `Request ${status.toLowerCase()} successfully`);
      handleCloseReviewModal();
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.message || `Failed to ${status.toLowerCase()} request`);
    } finally {
      setSubmittingReview(false);
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

  const handleTypeTabChange = (t) => {
    setTypeFilter(t);
    if (t === 'Mediclaim') {
      navigate('/admin/mediclaim-requests');
    } else if (t === 'PF') {
      navigate('/admin/pf-withdrawals');
    } else {
      navigate('/admin/withdrawals');
    }
  };

  // Filter requests
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const matchStatus = activeTab === 'Pending' ? r.status === 'Pending' : r.status !== 'Pending';
      const matchType = typeFilter === 'All' || r.type === typeFilter;

      if (!matchStatus || !matchType) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      const emp = r.employeeId || {};
      const empName = (emp.name || '').toLowerCase();
      const empCode = (emp.employeeCode || '').toLowerCase();
      const medId = (r.mediclaimId || emp.mediclaimId || '').toLowerCase();
      const pfId = (r.pfId || emp.pfId || '').toLowerCase();
      const claimId = (r.claimId || '').toLowerCase();
      const reason = (r.reason || r.diseaseName || '').toLowerCase();
      const purpose = (r.purpose || '').toLowerCase();

      return (
        empName.includes(q) ||
        empCode.includes(q) ||
        medId.includes(q) ||
        pfId.includes(q) ||
        claimId.includes(q) ||
        reason.includes(q) ||
        purpose.includes(q)
      );
    });
  }, [requests, activeTab, typeFilter, searchQuery]);

  const summaryStats = useMemo(() => {
    return requests.reduce(
      (acc, r) => {
        if (r.status === 'Pending') {
          acc.pending += 1;
          if (r.type === 'Mediclaim') acc.pendingMediclaim += 1;
          if (r.type === 'PF') acc.pendingPf += 1;
        }
        if (r.status === 'Approved' || r.status === 'Paid') {
          acc.approved += 1;
          if (r.type === 'Mediclaim') acc.mediclaimSettled += r.amount;
          if (r.type === 'PF') acc.pfSettled += r.amount;
        }
        if (r.status === 'Rejected') acc.rejected += 1;
        return acc;
      },
      {
        pending: 0,
        pendingMediclaim: 0,
        pendingPf: 0,
        approved: 0,
        rejected: 0,
        mediclaimSettled: 0,
        pfSettled: 0,
      }
    );
  }, [requests]);

  if (loading) return <LoadingSpinner />;

  // Dynamic header based on active type
  const isMediclaimOnly = typeFilter === 'Mediclaim';
  const isPfOnly = typeFilter === 'PF';

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {isMediclaimOnly ? (
              <span className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
                <HiOutlineShieldCheck className="w-6 h-6" />
              </span>
            ) : isPfOnly ? (
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <HiOutlineCurrencyRupee className="w-6 h-6" />
              </span>
            ) : (
              <span className="p-2 rounded-xl bg-primary-500/10 text-primary-400 border border-primary-500/20">
                <HiOutlineShieldCheck className="w-6 h-6" />
              </span>
            )}
            <h1 className="text-2xl font-bold font-display text-surface-100">
              {isMediclaimOnly
                ? 'Mediclaim Reimbursement Requests'
                : isPfOnly
                ? 'PF (Provident Fund) Withdrawal Requests'
                : 'Mediclaim & PF Fund Disbursement Portal'}
            </h1>
          </div>
          <p className="text-sm text-surface-400">
            {isMediclaimOnly
              ? 'Review employee medical insurance claims, prescriptions, verify Mediclaim ID, approve deductions & issue settlement payslips'
              : isPfOnly
              ? 'Review employee PF withdrawal applications, available accumulated balances, bank accounts & approve fund payouts'
              : 'Review and approve employee Mediclaim claims, PF withdrawals, verify balances, and manage settlement payslips'}
          </p>
        </div>

        {/* Status Switcher (Pending / Processed) */}
        <div className="flex bg-surface-800 p-1 rounded-xl border border-surface-700/50 self-start md:self-auto">
          {['Pending', 'Processed'].map((tab) => {
            const count = requests.filter((r) => {
              const matchStatus = tab === 'Pending' ? r.status === 'Pending' : r.status !== 'Pending';
              const matchType = typeFilter === 'All' || r.type === typeFilter;
              return matchStatus && matchType;
            }).length;

            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
                  activeTab === tab
                    ? 'bg-surface-700 text-surface-100 shadow-sm border border-surface-600/50'
                    : 'text-surface-400 hover:text-surface-300'
                }`}
              >
                <span>{tab}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                    activeTab === tab
                      ? tab === 'Pending' && count > 0
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-surface-600 text-surface-200'
                      : 'bg-surface-800/80 text-surface-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main Category Switcher Tabs ───────────────────────────── */}
      <div className="flex flex-wrap gap-2 border-b border-surface-700/60 pb-3">
        {[
          {
            id: 'Mediclaim',
            label: '🏥 Mediclaim Requests',
            pendingCount: summaryStats.pendingMediclaim,
            color: 'teal',
          },
          {
            id: 'PF',
            label: '🏦 PF Withdrawals',
            pendingCount: summaryStats.pendingPf,
            color: 'amber',
          },
          {
            id: 'All',
            label: '📋 All Fund Requests',
            pendingCount: summaryStats.pending,
            color: 'primary',
          },
        ].map((tab) => {
          const isSelected = typeFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTypeTabChange(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                isSelected
                  ? tab.id === 'Mediclaim'
                    ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/25 ring-2 ring-teal-400/40'
                    : tab.id === 'PF'
                    ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25 ring-2 ring-amber-400/40'
                    : 'bg-primary-600 text-white shadow-lg shadow-primary-500/25 ring-2 ring-primary-400/40'
                  : 'bg-surface-800/80 text-surface-400 hover:text-surface-200 hover:bg-surface-700/60 border border-surface-700/50'
              }`}
            >
              <span>{tab.label}</span>
              {tab.pendingCount > 0 && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    isSelected
                      ? 'bg-black/25 text-white'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {tab.pendingCount} pending
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Stats Banner ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-4 flex items-center gap-3.5 border-l-4 border-amber-500">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400">
            <HiOutlineClipboardCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-surface-400 uppercase">
              {isMediclaimOnly ? 'Pending Mediclaim' : isPfOnly ? 'Pending PF' : 'Total Pending'}
            </p>
            <p className="text-2xl font-bold text-surface-100 mt-0.5">
              {isMediclaimOnly
                ? summaryStats.pendingMediclaim
                : isPfOnly
                ? summaryStats.pendingPf
                : summaryStats.pending}
            </p>
          </div>
        </div>

        <div className="glass-card p-4 flex items-center gap-3.5 border-l-4 border-teal-500">
          <div className="p-3 rounded-xl bg-teal-500/10 text-teal-400">
            <HiOutlineShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-surface-400 uppercase">Mediclaim Settled</p>
            <p className="text-xl font-bold text-teal-300 mt-0.5 font-mono">
              ₹{summaryStats.mediclaimSettled.toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        <div className="glass-card p-4 flex items-center gap-3.5 border-l-4 border-violet-500">
          <div className="p-3 rounded-xl bg-violet-500/10 text-violet-400">
            <HiOutlineCurrencyRupee className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-surface-400 uppercase">PF Disbursed</p>
            <p className="text-xl font-bold text-violet-300 mt-0.5 font-mono">
              ₹{summaryStats.pfSettled.toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        <div className="glass-card p-4 flex items-center gap-3.5 border-l-4 border-emerald-500">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
            <HiOutlineCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-surface-400 uppercase">Total Settled Claims</p>
            <p className="text-2xl font-bold text-emerald-300 mt-0.5">{summaryStats.approved}</p>
          </div>
        </div>
      </div>

      {/* ── Search Bar & Filter Summary ─────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <HiOutlineSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Employee Name, EMP Code, Mediclaim ID, PF ID, Claim ID, Reason..."
            className="w-full pl-10 pr-4 py-2.5 bg-surface-800/80 border border-surface-700 rounded-xl text-sm text-surface-100 placeholder-surface-500 focus:outline-none focus:border-primary-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-surface-400 hover:text-surface-200"
            >
              Clear
            </button>
          )}
        </div>

        <div className="text-xs text-surface-400 font-medium whitespace-nowrap self-end sm:self-center">
          Showing <strong className="text-surface-200">{filteredRequests.length}</strong> {activeTab.toLowerCase()} requests
        </div>
      </div>

      {/* ── Requests List ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5">
        {filteredRequests.length === 0 ? (
          <div className="glass-card p-12 text-center text-surface-400">
            <HiOutlineDocumentText className="w-12 h-12 mx-auto mb-3 text-surface-600" />
            <p className="text-base font-semibold text-surface-300">
              No {activeTab.toLowerCase()} {typeFilter !== 'All' ? typeFilter : ''} requests found.
            </p>
            <p className="text-xs text-surface-500 mt-1 max-w-md mx-auto">
              {searchQuery
                ? `No requests match "${searchQuery}". Try clearing search keywords.`
                : activeTab === 'Pending'
                ? 'All claims have been reviewed and settled! Good job.'
                : 'No settled claims in records yet.'}
            </p>
          </div>
        ) : (
          filteredRequests.map((request) => {
            const isMediclaim = request.type === 'Mediclaim';
            const emp = request.employeeId || {};
            const availableFund = isMediclaim
              ? emp.totalMediclaimAccumulated || 0
              : emp.totalPfAccumulated || 0;
            const remainingBalance = Math.max(0, availableFund - (request.amount || 0));
            const isApproved = request.status === 'Approved' || request.status === 'Paid';
            const isPending = request.status === 'Pending';
            const isRejected = request.status === 'Rejected';
            const bank = emp.bankDetails || {};

            return (
              <div
                key={request._id}
                className="glass-card p-6 flex flex-col gap-5 border border-surface-700/60 hover:border-surface-600 transition-all shadow-md"
              >
                {/* ── Top Header: Employee Info + Badges + Actions ───────── */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-surface-700/50 pb-4">
                  {/* Left: Avatar + Names */}
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg flex-shrink-0 ${
                        isMediclaim
                          ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {emp.profilePicture ? (
                        <img
                          src={emp.profilePicture}
                          alt={emp.name}
                          className="w-full h-full object-cover rounded-2xl"
                        />
                      ) : (
                        <span>{emp.name ? emp.name.charAt(0).toUpperCase() : '?'}</span>
                      )}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-surface-100">{emp.name || 'Unknown Employee'}</h3>
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface-800 text-surface-300 border border-surface-700">
                          {emp.employeeCode || 'N/A'}
                        </span>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full border font-bold ${
                            isMediclaim
                              ? 'bg-teal-500/10 border-teal-500/30 text-teal-300'
                              : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                          }`}
                        >
                          {request.type === 'Mediclaim' ? '🏥 Mediclaim' : '🏦 PF Withdrawal'}
                        </span>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${
                            isPending
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                              : isApproved
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                          }`}
                        >
                          {isApproved ? 'Approved & Settled' : request.status}
                        </span>
                      </div>
                      <p className="text-xs text-surface-400 mt-0.5">
                        {emp.designation || 'Staff'} • {emp.department || 'General'} • {emp.email || 'No email'}
                      </p>
                    </div>
                  </div>

                  {/* Right Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                    {isPending && (
                      <>
                        <button
                          onClick={() => handleOpenReviewModal(request, 'Approved')}
                          className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all"
                        >
                          <HiOutlineCheck className="w-4 h-4" />
                          Approve &amp; Settle
                        </button>
                        <button
                          onClick={() => handleOpenReviewModal(request, 'Rejected')}
                          className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded-xl transition-colors font-medium text-xs border border-rose-500/30"
                        >
                          <HiOutlineX className="w-4 h-4" /> Reject
                        </button>
                      </>
                    )}

                    {isApproved && (
                      <button
                        onClick={() => handleDownloadPayslip(request._id, request.claimId)}
                        disabled={downloadingId === request._id}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/30 text-teal-300 rounded-xl transition-colors font-semibold text-xs shadow-sm"
                      >
                        {downloadingId === request._id ? (
                          <div className="w-3.5 h-3.5 border-2 border-teal-400/30 border-t-teal-400 rounded-full animate-spin"></div>
                        ) : (
                          <HiOutlineDocumentText className="w-4 h-4 text-teal-400" />
                        )}
                        Download Settlement Payslip
                      </button>
                    )}
                  </div>
                </div>

                {/* ── Mid Row: Identifiers & Financial Details ──────────── */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-surface-800/40 p-4 rounded-xl border border-surface-700/40">
                  {/* Identifiers */}
                  <div className="space-y-1">
                    <p className="text-xs text-surface-400 font-semibold uppercase tracking-wider">Identifiers</p>
                    <p className="text-xs text-surface-300">
                      Claim Ref:{' '}
                      <strong className="text-teal-400 font-mono">
                        {request.claimId || `CLM-${String(request._id).slice(-6).toUpperCase()}`}
                      </strong>
                    </p>
                    <p className="text-xs text-surface-300">
                      Mediclaim ID:{' '}
                      <strong className="text-cyan-300 font-mono">
                        {request.mediclaimId || emp.mediclaimId || 'Not Generated'}
                      </strong>
                    </p>
                    <p className="text-xs text-surface-300">
                      PF ID:{' '}
                      <strong className="text-violet-300 font-mono">
                        {request.pfId || emp.pfId || 'Not Generated'}
                      </strong>
                    </p>
                  </div>

                  {/* Financial Breakdown */}
                  <div className="space-y-1">
                    <p className="text-xs text-surface-400 font-semibold uppercase tracking-wider">Financials</p>
                    <p className="text-xs text-surface-300">
                      Requested Amount:{' '}
                      <strong className="text-emerald-400 font-mono text-sm font-bold">
                        ₹{request.amount?.toLocaleString('en-IN')}
                      </strong>
                    </p>
                    <p className="text-xs text-surface-300">
                      Available {request.type} Fund:{' '}
                      <span className="font-mono text-surface-200">
                        ₹{availableFund.toLocaleString('en-IN')}
                      </span>
                    </p>
                    {isPending && (
                      <p className="text-xs text-surface-400">
                        Remaining After Approval:{' '}
                        <span className="font-mono text-cyan-400 font-semibold">
                          ₹{remainingBalance.toLocaleString('en-IN')}
                        </span>
                      </p>
                    )}
                  </div>

                  {/* Submission & Purpose */}
                  <div className="space-y-1">
                    <p className="text-xs text-surface-400 font-semibold uppercase tracking-wider">Reason &amp; Purpose</p>
                    <p className="text-xs text-surface-200 font-medium">
                      {request.reason || request.diseaseName || '—'}
                      {request.purpose && (
                        <span className="text-surface-400 text-xs ml-1">({request.purpose})</span>
                      )}
                    </p>
                    <p className="text-xs text-surface-400">
                      Requested on:{' '}
                      <span className="text-surface-300">
                        {new Date(request.createdAt).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </p>
                  </div>
                </div>

                {/* ── Prescription / Bills Document ─────────────────────── */}
                {(request.attachment || request.prescription) && (
                  <div className="flex items-center gap-3 bg-teal-500/10 border border-teal-500/20 px-4 py-2.5 rounded-xl">
                    <HiOutlineDocumentText className="w-5 h-5 text-teal-400 flex-shrink-0" />
                    <div className="flex-1 text-xs">
                      <span className="font-semibold text-teal-200">Doctor Prescription / Medical Invoice</span>
                      <p className="text-surface-400 text-[11px]">Uploaded by employee for verification</p>
                    </div>
                    <a
                      href={request.prescription || request.attachment}
                      download={`Prescription_${request.claimId || request._id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-white bg-teal-600 hover:bg-teal-500 px-3 py-1.5 rounded-lg font-semibold shadow-sm transition-colors"
                    >
                      <HiOutlineDownload className="w-4 h-4" /> Download / View Document
                    </a>
                  </div>
                )}

                {/* ── Bank Details Box for Disbursement ─────────────────── */}
                <div className="bg-surface-800/60 border border-surface-700/50 rounded-xl p-3.5">
                  <div className="flex items-center gap-2 mb-2">
                    <HiOutlineCreditCard className="w-4 h-4 text-primary-400" />
                    <span className="text-xs font-semibold text-surface-300 uppercase tracking-wider">
                      Employee Bank Transfer Account Details
                    </span>
                  </div>

                  {bank.accountNumber ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-surface-500">Bank Name:</span>
                        <p className="font-semibold text-surface-200">{bank.bankName || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-surface-500">Account No:</span>
                        <p className="font-mono font-semibold text-surface-100">{bank.accountNumber}</p>
                      </div>
                      <div>
                        <span className="text-surface-500">IFSC Code:</span>
                        <p className="font-mono font-semibold text-teal-400">{bank.ifscCode || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-surface-500">Account Holder:</span>
                        <p className="font-semibold text-surface-200">{bank.accountHolderName || emp.name}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-surface-500 italic">
                      Bank details not filled in employee profile. Transfer via company payroll direct account.
                    </p>
                  )}
                </div>

                {/* ── Review History / Settlement Info ──────────────────── */}
                {request.reviewedBy && (
                  <div className="text-xs text-surface-400 pt-1 border-t border-surface-700/40 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Reviewed by:{' '}
                      <strong className="text-surface-200 font-medium">
                        {request.reviewedBy.name} ({request.reviewedBy.role})
                      </strong>
                      {request.reviewNotes && <span> — "{request.reviewNotes}"</span>}
                    </span>
                    {request.updatedAt && (
                      <span className="text-surface-500">
                        {new Date(request.updatedAt).toLocaleString('en-GB')}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Review Modal (Approve / Reject) ─────────────────────────── */}
      {reviewModal.open && reviewModal.request && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-900 border border-surface-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-surface-700/60 pb-3">
              <div className="flex items-center gap-2.5">
                {reviewModal.status === 'Approved' ? (
                  <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                    <HiOutlineCheck className="w-5 h-5" />
                  </span>
                ) : (
                  <span className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
                    <HiOutlineX className="w-5 h-5" />
                  </span>
                )}
                <div>
                  <h3 className="text-lg font-bold text-surface-100">
                    {reviewModal.status === 'Approved'
                      ? `Approve & Settle ${reviewModal.request.type} Claim`
                      : `Reject ${reviewModal.request.type} Claim`}
                  </h3>
                  <p className="text-xs text-surface-400">
                    Ref: {reviewModal.request.claimId} • Employee:{' '}
                    {reviewModal.request.employeeId?.name}
                  </p>
                </div>
              </div>

              <button
                onClick={handleCloseReviewModal}
                disabled={submittingReview}
                className="p-1.5 text-surface-400 hover:text-surface-200 rounded-lg transition-colors"
              >
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            {reviewModal.status === 'Approved' ? (
              <div className="space-y-4 text-xs text-surface-300">
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-xl space-y-1.5">
                  <p className="font-semibold text-emerald-300 text-sm">
                    Disbursing ₹{reviewModal.request.amount?.toLocaleString('en-IN')}
                  </p>
                  <p className="text-surface-400">
                    • <strong>Balance Deduction:</strong> ₹{reviewModal.request.amount?.toLocaleString('en-IN')} will be deducted from employee's {reviewModal.request.type} fund.
                  </p>
                  <p className="text-surface-400">
                    • <strong>Settlement Payslip:</strong> An official Settlement Payslip PDF will be generated with Mediclaim ID &amp; PF ID and automatically emailed to {reviewModal.request.employeeId?.email}.
                  </p>
                  <p className="text-surface-400">
                    • <strong>Audit Ledger:</strong> An audit payroll disbursement entry will be saved in records.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-surface-300 mb-1">
                    Approval Notes / Bank Transfer Ref (Optional):
                  </label>
                  <input
                    type="text"
                    value={reviewModal.notes}
                    onChange={(e) => setReviewModal({ ...reviewModal, notes: e.target.value })}
                    placeholder="e.g. Approved via NEFT/IMPS Ref #12345678"
                    className="w-full px-3.5 py-2.5 bg-surface-800 border border-surface-700 rounded-xl text-xs text-surface-100 placeholder-surface-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs text-surface-300">
                <div className="bg-rose-500/10 border border-rose-500/20 p-3.5 rounded-xl">
                  <p className="font-semibold text-rose-300 text-sm mb-1">Confirm Claim Rejection</p>
                  <p className="text-surface-400">
                    No amount will be deducted. An email and in-app notification explaining the reason will be sent to the employee.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-surface-300 mb-1">
                    Reason for Rejection <span className="text-rose-400">*</span>:
                  </label>
                  <textarea
                    rows={3}
                    value={reviewModal.notes}
                    onChange={(e) => setReviewModal({ ...reviewModal, notes: e.target.value })}
                    placeholder="Please specify why this claim is rejected (e.g. Incomplete prescription, invalid bills, exceeds policy limit)..."
                    className="w-full px-3.5 py-2 bg-surface-800 border border-surface-700 rounded-xl text-xs text-surface-100 placeholder-surface-500 focus:outline-none focus:border-rose-500 transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-surface-700/60">
              <button
                type="button"
                onClick={handleCloseReviewModal}
                disabled={submittingReview}
                className="px-4 py-2 rounded-xl text-xs font-medium text-surface-400 hover:text-surface-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReview}
                disabled={submittingReview}
                className={`flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold text-white shadow-lg transition-all ${
                  reviewModal.status === 'Approved'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-500/20'
                    : 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/20'
                } disabled:opacity-50`}
              >
                {submittingReview ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : reviewModal.status === 'Approved' ? (
                  <HiOutlineCheck className="w-4 h-4" />
                ) : (
                  <HiOutlineX className="w-4 h-4" />
                )}
                {reviewModal.status === 'Approved' ? 'Confirm Approval & Settle' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Withdrawals;
