import { useState, useEffect, useMemo } from 'react';
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
} from 'react-icons/hi';
import { getAllWithdrawals, reviewWithdrawal, downloadSettlementPayslip } from '../../api/withdrawalAPI';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const Withdrawals = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Pending'); // 'Pending' | 'Processed'
  const [typeFilter, setTypeFilter] = useState('All'); // 'All' | 'Mediclaim' | 'PF'
  const [processingId, setProcessingId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

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
    let reviewNotes = '';
    if (status === 'Rejected') {
      const reason = window.prompt('Please enter the reason for rejection (optional):');
      if (reason === null) return; // User cancelled prompt
      reviewNotes = reason;
    } else {
      const confirmApprove = window.confirm(
        'Are you sure you want to approve this claim? This will automatically deduct the amount from the employee\'s fund and email an official Settlement Payslip PDF to them.'
      );
      if (!confirmApprove) return;
    }

    setProcessingId(id);
    try {
      const { data } = await reviewWithdrawal(id, { status, reviewNotes });
      toast.success(data.message || `Request ${status.toLowerCase()} successfully`);
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.message || `Failed to ${status.toLowerCase()} request`);
    } finally {
      setProcessingId(null);
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

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const matchStatus = activeTab === 'Pending' ? r.status === 'Pending' : r.status !== 'Pending';
      const matchType = typeFilter === 'All' || r.type === typeFilter;
      return matchStatus && matchType;
    });
  }, [requests, activeTab, typeFilter]);

  const summaryStats = useMemo(() => {
    return requests.reduce(
      (acc, r) => {
        if (r.status === 'Pending') acc.pending += 1;
        if (r.status === 'Approved' || r.status === 'Paid') {
          acc.approved += 1;
          if (r.type === 'Mediclaim') acc.mediclaimSettled += r.amount;
          if (r.type === 'PF') acc.pfSettled += r.amount;
        }
        if (r.status === 'Rejected') acc.rejected += 1;
        return acc;
      },
      { pending: 0, approved: 0, rejected: 0, mediclaimSettled: 0, pfSettled: 0 }
    );
  }, [requests]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-surface-100 mb-1 flex items-center gap-2.5">
            <HiOutlineShieldCheck className="w-7 h-7 text-teal-400" />
            Mediclaim &amp; Fund Disbursement Portal
          </h1>
          <p className="text-sm text-surface-400">
            Review employee medical reimbursement claims, PF withdrawals, balance deductions, and settlement payslips
          </p>
        </div>

        {/* Tab switcher */}
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
              {tab} ({requests.filter((r) => (tab === 'Pending' ? r.status === 'Pending' : r.status !== 'Pending')).length})
            </button>
          ))}
        </div>
      </div>

      {/* ── Stats Banner ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-4 flex items-center gap-3.5 border-l-4 border-amber-500">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400">
            <HiOutlineClipboardCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-surface-400 uppercase">Pending Review</p>
            <p className="text-2xl font-bold text-surface-100 mt-0.5">{summaryStats.pending}</p>
          </div>
        </div>

        <div className="glass-card p-4 flex items-center gap-3.5 border-l-4 border-teal-500">
          <div className="p-3 rounded-xl bg-teal-500/10 text-teal-400">
            <HiOutlineShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-surface-400 uppercase">Mediclaim Disbursed</p>
            <p className="text-xl font-bold text-teal-300 mt-0.5 font-mono">₹{summaryStats.mediclaimSettled.toLocaleString()}</p>
          </div>
        </div>

        <div className="glass-card p-4 flex items-center gap-3.5 border-l-4 border-violet-500">
          <div className="p-3 rounded-xl bg-violet-500/10 text-violet-400">
            <HiOutlineCurrencyRupee className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-surface-400 uppercase">PF Disbursed</p>
            <p className="text-xl font-bold text-violet-300 mt-0.5 font-mono">₹{summaryStats.pfSettled.toLocaleString()}</p>
          </div>
        </div>

        <div className="glass-card p-4 flex items-center gap-3.5 border-l-4 border-emerald-500">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
            <HiOutlineCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-surface-400 uppercase">Approved Claims</p>
            <p className="text-2xl font-bold text-emerald-300 mt-0.5">{summaryStats.approved}</p>
          </div>
        </div>
      </div>

      {/* ── Type Filter Chips ────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider flex items-center gap-1">
          <HiOutlineFilter className="w-4 h-4" /> Filter:
        </span>
        {['All', 'Mediclaim', 'PF'].map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              typeFilter === t
                ? 'bg-teal-500 text-white shadow-sm'
                : 'bg-surface-800 text-surface-400 hover:text-surface-200 border border-surface-700/50'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Requests List ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4">
        {filteredRequests.length === 0 ? (
          <div className="glass-card p-12 text-center text-surface-400">
            <HiOutlineDocumentText className="w-12 h-12 mx-auto mb-2 text-surface-600" />
            <p className="text-base font-medium">No {activeTab.toLowerCase()} requests found.</p>
            <p className="text-xs text-surface-500 mt-1">
              {typeFilter !== 'All' ? `No ${typeFilter} requests match current criteria.` : 'All requests processed.'}
            </p>
          </div>
        ) : (
          filteredRequests.map((request) => {
            const isMediclaim = request.type === 'Mediclaim';
            const emp = request.employeeId || {};
            const availableFund = isMediclaim
              ? emp.totalMediclaimAccumulated || 0
              : emp.totalPfAccumulated || 0;
            const isApproved = request.status === 'Approved' || request.status === 'Paid';
            const isPending = request.status === 'Pending';
            const isRejected = request.status === 'Rejected';

            return (
              <div
                key={request._id}
                className="glass-card p-6 flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between border border-surface-700/60 hover:border-teal-500/30 transition-all"
              >
                {/* Left Employee & Claim Details */}
                <div className="flex items-start gap-4 flex-1">
                  <div
                    className={`p-3.5 rounded-2xl flex-shrink-0 ${
                      isMediclaim
                        ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {isMediclaim ? (
                      <HiOutlineShieldCheck className="w-7 h-7" />
                    ) : (
                      <HiOutlineCurrencyRupee className="w-7 h-7" />
                    )}
                  </div>

                  <div className="space-y-2 flex-1">
                    {/* Header line: Name + IDs */}
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold text-surface-100">{emp.name || 'Unknown Employee'}</h3>
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface-800 text-surface-300 border border-surface-700">
                        {emp.employeeCode || 'No Code'}
                      </span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full border font-bold ${
                          isMediclaim
                            ? 'bg-teal-500/10 border-teal-500/30 text-teal-300'
                            : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                        }`}
                      >
                        {request.type}
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

                    {/* Policy / Identification badges */}
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <span className="text-surface-400 font-mono">
                        Claim ID:{' '}
                        <strong className="text-teal-400">
                          {request.claimId || `CLM-${String(request._id).slice(-6).toUpperCase()}`}
                        </strong>
                      </span>
                      <span className="text-surface-400 font-mono">
                        Mediclaim ID:{' '}
                        <strong className="text-cyan-300">
                          {request.mediclaimId || emp.mediclaimId || 'Not Assigned'}
                        </strong>
                      </span>
                      <span className="text-surface-400 font-mono">
                        PF ID:{' '}
                        <strong className="text-violet-300">{request.pfId || emp.pfId || 'Not Assigned'}</strong>
                      </span>
                    </div>

                    {/* Financial details & Reason */}
                    <div className="space-y-1 text-sm text-surface-300 pt-1">
                      <p>
                        <span className="text-surface-500">Requested Amount:</span>{' '}
                        <strong className="text-emerald-400 font-mono text-base font-bold">
                          ₹{request.amount?.toLocaleString()}
                        </strong>{' '}
                        <span className="text-xs text-surface-500">
                          (Available {request.type} Fund: ₹{availableFund.toLocaleString()})
                        </span>
                      </p>

                      <p>
                        <span className="text-surface-500">Reason / Illness:</span>{' '}
                        <span className="text-surface-200 font-medium">
                          {request.reason || request.diseaseName || '—'}
                        </span>
                        {request.purpose && (
                          <span className="text-surface-400 text-xs ml-1.5">[{request.purpose}]</span>
                        )}
                      </p>

                      {/* Attachment / Prescription */}
                      {(request.attachment || request.prescription) && (
                        <div className="pt-1">
                          <a
                            href={request.prescription || request.attachment}
                            download={`Prescription_${request.claimId || request._id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 px-3 py-1.5 rounded-lg border border-teal-500/20 font-medium transition-colors"
                          >
                            <HiOutlineDownload className="w-4 h-4" /> Download Medical Prescription / Bills
                          </a>
                        </div>
                      )}

                      {/* Review details */}
                      {request.reviewedBy && (
                        <p className="text-xs text-surface-400 pt-1">
                          Reviewed by:{' '}
                          <span className="text-surface-200">
                            {request.reviewedBy.name} ({request.reviewedBy.role})
                          </span>
                          {request.reviewNotes && ` — "${request.reviewNotes}"`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Actions */}
                <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full lg:w-auto mt-4 lg:mt-0 pt-4 lg:pt-0 border-t lg:border-0 border-surface-700/50">
                  {isPending && (
                    <>
                      <button
                        onClick={() => handleReview(request._id, 'Approved')}
                        disabled={processingId === request._id}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
                      >
                        {processingId === request._id ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                          <HiOutlineCheck className="w-4 h-4" />
                        )}
                        Approve &amp; Settle
                      </button>
                      <button
                        onClick={() => handleReview(request._id, 'Rejected')}
                        disabled={processingId === request._id}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded-xl transition-colors font-medium text-sm"
                      >
                        <HiOutlineX className="w-4 h-4" /> Reject
                      </button>
                    </>
                  )}

                  {isApproved && (
                    <button
                      onClick={() => handleDownloadPayslip(request._id, request.claimId)}
                      disabled={downloadingId === request._id}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/30 text-teal-300 rounded-xl transition-colors font-semibold text-xs shadow-sm"
                    >
                      {downloadingId === request._id ? (
                        <div className="w-4 h-4 border-2 border-teal-400/30 border-t-teal-400 rounded-full animate-spin"></div>
                      ) : (
                        <HiOutlineDocumentText className="w-4 h-4 text-teal-400" />
                      )}
                      Download Settlement Slip
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Withdrawals;
