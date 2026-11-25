import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import API from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import UserAvatar from '../../components/common/UserAvatar';
import ConfirmModal from '../../components/common/ConfirmModal';
import toast from 'react-hot-toast';
import {
  HiOutlineTrash,
  HiOutlineRefresh,
  HiOutlineSearch,
  HiOutlineArrowLeft,
  HiOutlineClock,
  HiOutlineShieldCheck,
  HiOutlineExclamationCircle,
  HiOutlineX,
} from 'react-icons/hi';

const RecycleBin = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';

  const [items, setItems] = useState([]);
  const [retentionDays, setRetentionDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Restore modal state
  const [empToRestore, setEmpToRestore] = useState(null);
  const [restoring, setRestoring] = useState(false);

  // Permanent delete modal state (Admin only)
  const [empToPurge, setEmpToPurge] = useState(null);
  const [purging, setPurging] = useState(false);

  const fetchRecycleBin = async () => {
    try {
      const { data } = await API.get('/auth/recycle-bin');
      setItems(Array.isArray(data?.items) ? data.items : []);
      if (data?.retentionDays) setRetentionDays(data.retentionDays);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load Recycle Bin');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecycleBin();
  }, []);

  const handleConfirmRestore = async () => {
    if (!empToRestore) return;
    setRestoring(true);
    try {
      const { data } = await API.put(`/auth/recycle-bin/${empToRestore._id}/restore`);
      toast.success(data?.message || `${empToRestore.name} restored successfully!`);
      setEmpToRestore(null);
      fetchRecycleBin();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Restore failed');
    } finally {
      setRestoring(false);
    }
  };

  const handleConfirmPermanentDelete = async () => {
    if (!empToPurge) return;
    setPurging(true);
    try {
      const { data } = await API.delete(`/auth/recycle-bin/${empToPurge._id}/permanent`);
      toast.success(data?.message || `${empToPurge.name} permanently deleted`);
      setEmpToPurge(null);
      fetchRecycleBin();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Permanent deletion failed');
    } finally {
      setPurging(false);
    }
  };

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (e) =>
        (e.name || '').toLowerCase().includes(q) ||
        (e.email || '').toLowerCase().includes(q) ||
        (e.employeeCode || '').toLowerCase().includes(q) ||
        (e.department || '').toLowerCase().includes(q) ||
        (e.role || '').toLowerCase().includes(q) ||
        (e.deletedByName || '').toLowerCase().includes(q)
    );
  }, [items, search]);

  const expiringSoonCount = useMemo(
    () => items.filter((e) => (e.daysRemaining ?? 30) <= 5).length,
    [items]
  );

  const getDaysBadgeClass = (days) => {
    if (days <= 3) return 'bg-rose-500/15 text-rose-500 dark:text-rose-300 border-rose-500/40';
    if (days <= 10) return 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/40';
    return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 dark:text-rose-400">
              <HiOutlineTrash className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-surface-100">Recycle Bin</h1>
              <p className="text-sm text-surface-500">
                Deleted employees stay recoverable for {retentionDays} days before automatic permanent removal
              </p>
            </div>
          </div>
        </div>

        <Link
          to="/admin/employees"
          className="btn-secondary inline-flex items-center gap-2 w-fit text-sm"
        >
          <HiOutlineArrowLeft className="w-4 h-4" />
          Back to Manage Employees
        </Link>
      </div>

      {/* Retention Policy & Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 dark:text-amber-300 flex-shrink-0">
            <HiOutlineTrash className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-surface-400">
              Recoverable Employees
            </p>
            <p className="text-2xl font-display font-bold text-surface-100 mt-0.5">
              {items.length}
            </p>
          </div>
        </div>

        <div className="glass-card p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 dark:text-rose-300 flex-shrink-0">
            <HiOutlineExclamationCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-surface-400">
              Expiring Within 5 Days
            </p>
            <p className="text-2xl font-display font-bold text-surface-100 mt-0.5">
              {expiringSoonCount}
            </p>
          </div>
        </div>

        <div className="glass-card p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-[#D2F801]/20 border border-[#84B800]/50 dark:border-[#D2F801]/40 flex items-center justify-center text-[#3F5C00] dark:text-[#D2F801] flex-shrink-0">
            <HiOutlineClock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-surface-400">
              Auto-Purge Policy
            </p>
            <p className="text-lg font-display font-bold text-surface-100 mt-0.5">
              {retentionDays} Days Retention
            </p>
          </div>
        </div>
      </div>

      {/* Info Notice */}
      <div className="glass-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3 text-xs sm:text-sm text-surface-300">
          <HiOutlineShieldCheck className="w-5 h-5 text-[#3F5C00] dark:text-[#D2F801] flex-shrink-0 mt-0.5 sm:mt-0" />
          <span>
            Employees in the Recycle Bin cannot log in or appear in payroll/attendance. Restoring brings back their full account, QR badge, and historical records immediately. Admin accounts cannot be deleted by anyone except the Admin themselves.
          </span>
        </div>
      </div>

      {/* Main List Card */}
      <div className="glass-card p-5 sm:p-6 space-y-5">
        <div className="relative">
          <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500 w-5 h-5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-12"
            placeholder="Search Recycle Bin by name, email, employee code, role or deleted by..."
          />
        </div>

        {loading ? (
          <div className="py-14 text-center text-surface-400">Loading Recycle Bin...</div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center bg-surface-800/30 rounded-2xl border border-[#84B800]/30 dark:border-[#BEEB00]/30 px-4">
            <div className="w-14 h-14 rounded-2xl bg-surface-800/70 flex items-center justify-center text-surface-400 mb-3">
              <HiOutlineTrash className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-surface-100">
              {items.length === 0 ? 'Recycle Bin is empty' : 'No matching employees found'}
            </h3>
            <p className="text-xs text-surface-400 mt-1 max-w-md">
              {items.length === 0
                ? 'When an employee is deleted from Manage Employees, they appear here for 30 days so you can restore them anytime.'
                : 'Try adjusting your search keywords.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Code</th>
                    <th>Role &amp; Department</th>
                    <th>Deleted On</th>
                    <th>Deleted By</th>
                    <th>Auto-Purge Countdown</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((emp) => (
                    <tr key={emp._id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <UserAvatar user={emp} size="sm" />
                          <div className="min-w-0">
                            <p className="font-semibold text-surface-100 truncate">{emp.name}</p>
                            <p className="text-xs text-surface-400 truncate">{emp.email}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="text-xs font-mono text-primary-400 bg-primary-500/10 px-2 py-1 rounded">
                          {emp.employeeCode || '—'}
                        </span>
                      </td>
                      <td>
                        <p className="text-xs font-semibold text-surface-200">{emp.role}</p>
                        <p className="text-[11px] text-surface-400">{emp.department || 'No dept'}</p>
                      </td>
                      <td className="text-xs text-surface-300 whitespace-nowrap">
                        {emp.deletedAt
                          ? new Date(emp.deletedAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td>
                        <span className="text-xs text-surface-300">
                          {emp.deletedByName || 'Admin'}
                        </span>
                        {emp.deletedByRole && (
                          <span className="block text-[10px] text-surface-500">
                            ({emp.deletedByRole})
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${getDaysBadgeClass(
                              emp.daysRemaining
                            )}`}
                          >
                            <HiOutlineClock className="w-3.5 h-3.5" />
                            {emp.daysRemaining} {emp.daysRemaining === 1 ? 'day' : 'days'} left
                          </span>
                          <p className="text-[10px] text-surface-500">
                            Purges{' '}
                            {emp.scheduledPurgeAt
                              ? new Date(emp.scheduledPurgeAt).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : 'after 30 days'}
                          </p>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEmpToRestore(emp)}
                            className="px-3 py-1.5 rounded-lg bg-[#D2F801] hover:bg-[#c3e800] text-[#0B0D11] font-bold text-xs inline-flex items-center gap-1.5 transition-all shadow-sm active:scale-95 whitespace-nowrap"
                            title="Restore employee account"
                          >
                            <HiOutlineRefresh className="w-3.5 h-3.5" />
                            Restore
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => setEmpToPurge(emp)}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-500 dark:text-rose-300 font-semibold text-xs inline-flex items-center gap-1 transition-all whitespace-nowrap"
                              title="Permanently delete now"
                            >
                              <HiOutlineTrash className="w-3.5 h-3.5" />
                              Purge Now
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {filteredItems.map((emp) => (
                <div
                  key={emp._id}
                  className="p-4 rounded-2xl bg-surface-800/40 border border-[#84B800]/40 dark:border-[#BEEB00]/40 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar user={emp} size="sm" />
                      <div className="min-w-0">
                        <p className="font-bold text-surface-100 truncate">{emp.name}</p>
                        <p className="text-xs text-surface-400 truncate">{emp.email}</p>
                        <p className="text-[11px] font-mono text-primary-400 mt-0.5">
                          {emp.employeeCode || 'No code'} • {emp.role}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border flex-shrink-0 ${getDaysBadgeClass(
                        emp.daysRemaining
                      )}`}
                    >
                      {emp.daysRemaining}d left
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-surface-400 pt-2 border-t border-surface-700/40">
                    <div>
                      <span className="block text-[10px] uppercase text-surface-500">Deleted On</span>
                      {emp.deletedAt
                        ? new Date(emp.deletedAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase text-surface-500">Deleted By</span>
                      {emp.deletedByName || 'Admin'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => setEmpToRestore(emp)}
                      className="flex-1 py-2 px-3 rounded-xl bg-[#D2F801] hover:bg-[#c3e800] text-[#0B0D11] font-bold text-xs flex items-center justify-center gap-1.5"
                    >
                      <HiOutlineRefresh className="w-4 h-4" />
                      Restore Employee
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => setEmpToPurge(emp)}
                        className="py-2 px-3 rounded-xl bg-rose-500/15 border border-rose-500/35 text-rose-400 font-semibold text-xs flex items-center justify-center gap-1"
                      >
                        <HiOutlineTrash className="w-4 h-4" />
                        Purge
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Restore Confirmation Modal */}
      {empToRestore && (
        <div className="fixed inset-0 bg-surface-950/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md p-6 space-y-5 shadow-2xl animate-slide-up">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#D2F801]/20 border border-[#84B800]/50 dark:border-[#D2F801]/40 flex items-center justify-center text-[#3F5C00] dark:text-[#D2F801] flex-shrink-0">
                  <HiOutlineRefresh className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-surface-100">Restore Employee Account</h3>
                  <p className="text-xs text-surface-400 mt-0.5">Reactivate login &amp; restore records</p>
                </div>
              </div>
              <button
                onClick={() => setEmpToRestore(null)}
                disabled={restoring}
                className="p-1.5 rounded-lg hover:bg-surface-700/50 text-surface-400"
              >
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-surface-300 leading-relaxed">
                This will immediately restore the employee back into the active roster with their original employee code, QR login badge, attendance, and payroll history intact.
              </p>
              <div className="p-3 rounded-xl bg-surface-900/60 border border-[#84B800]/40 dark:border-[#D2F801]/35 text-xs font-mono font-bold text-surface-100 truncate">
                {empToRestore.name} ({empToRestore.employeeCode || empToRestore.email})
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEmpToRestore(null)}
                disabled={restoring}
                className="btn-secondary text-xs px-4 py-2.5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={restoring}
                className="px-5 py-2.5 rounded-xl bg-[#D2F801] hover:bg-[#c3e800] text-[#0B0D11] font-bold text-xs flex items-center gap-2 shadow-md transition-all disabled:opacity-50"
              >
                {restoring ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-[#0B0D11] border-t-transparent rounded-full animate-spin" />
                    Restoring...
                  </>
                ) : (
                  <>
                    <HiOutlineRefresh className="w-4 h-4" />
                    Confirm Restore
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Modal (Admin only) */}
      <ConfirmModal
        isOpen={Boolean(empToPurge)}
        onClose={() => setEmpToPurge(null)}
        onConfirm={handleConfirmPermanentDelete}
        title="Permanently Delete Employee"
        message="Warning: This will IMMEDIATELY and PERMANENTLY erase this employee account along with their attendance logs, leave history, payslips, and claims. This cannot be undone."
        itemName={empToPurge ? `${empToPurge.name} (${empToPurge.email})` : ''}
        confirmText="Delete Permanently"
        type="danger"
        loading={purging}
      />
    </div>
  );
};

export default RecycleBin;
